import type { SurfaceSession } from "@plingjs/surface";
import type {
  SurfaceConnectionState,
  SurfaceTransport,
  SurfaceWebSocket,
  SurfaceWebSocketFactory,
} from "./types";

export interface SurfaceTransportOptions {
  /** WebSocket URL including the short-lived page token. */
  url: string;
  app?: string;
  reconnectMs?: number;
  webSocket?: SurfaceWebSocketFactory;
  /** Override for tests or hosts whose global WebSocket is not available. */
  webSocketFactory?: SurfaceWebSocketFactory;
}

const defaultWebSocket: SurfaceWebSocketFactory = (url) =>
  new WebSocket(url) as unknown as SurfaceWebSocket;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sessionOf(value: unknown): SurfaceSession | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.agentId !== "string" ||
    typeof value.sessionId !== "string" ||
    typeof value.userId !== "string" ||
    typeof value.expiresAt !== "number" ||
    !Array.isArray(value.scope) ||
    value.scope.some((item) => typeof item !== "string")
  ) {
    return null;
  }
  return {
    agentId: value.agentId,
    sessionId: value.sessionId,
    userId: value.userId,
    expiresAt: value.expiresAt,
    scope: value.scope as string[],
    ...(typeof value.revokedAt === "number" ? { revokedAt: value.revokedAt } : {}),
  };
}

/**
 * Page-side WebSocket transport.
 *
 * The page token authenticates the socket. The Agent's identity and scope
 * arrive in the gateway's `agent_session` message; the page never receives an
 * Agent token from this transport.
 */
export function createSurfaceTransport(options: SurfaceTransportOptions): SurfaceTransport {
  const factory = options.webSocket ?? options.webSocketFactory ?? defaultWebSocket;
  let state: SurfaceConnectionState = "connecting";
  let agent: SurfaceSession | null = null;
  let socket: SurfaceWebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let generation = 0;
  const listeners = new Set<(message: unknown) => void>();
  const stateListeners = new Set<(state: SurfaceConnectionState) => void>();

  const setState = (next: SurfaceConnectionState): void => {
    if (state === next) return;
    state = next;
    for (const listener of stateListeners) listener(next);
  };

  const connect = (): void => {
    if (closed) return;
    setState("connecting");
    const currentGeneration = ++generation;
    const next = factory(options.url);
    socket = next;

    next.addEventListener("open", () => {
      if (socket !== next || closed) return;
      next.send(JSON.stringify({ type: "hello", protocol: "pling.bridge/0.1", app: options.app ?? "pling-surface" }));
    });

    next.addEventListener("message", (event) => {
      if (socket !== next || closed) return;
      const data = isRecord(event) ? event.data : null;
      if (typeof data !== "string") return;
      let message: unknown;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      if (isRecord(message) && message.type === "hello_ack") setState("connected");
      if (isRecord(message) && message.type === "agent_session") {
        if (message.action === "opened") agent = sessionOf(message.session);
        else if (message.action === "closed") agent = null;
      }
      for (const listener of listeners) listener(message);
    });

    next.addEventListener("close", (event) => {
      if (socket === next) socket = null;
      if (closed || currentGeneration !== generation) return;
      agent = null;
      const code = isRecord(event) && typeof event.code === "number" ? event.code : 1006;
      if ([4001, 4002, 4003].includes(code)) {
        closed = true;
        setState("closed");
        return;
      }
      setState("disconnected");
      reconnectTimer = setTimeout(connect, options.reconnectMs ?? 1_500);
    });

    next.addEventListener("error", () => {
      // `close` owns reconnect and the terminal state.
    });
  };

  connect();

  return {
    get state() {
      return state;
    },
    get agent() {
      return agent;
    },
    post(message: unknown) {
      if (socket?.readyState === 1) socket.send(JSON.stringify(message));
    },
    subscribe(handler) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
    subscribeState(handler) {
      stateListeners.add(handler);
      return () => stateListeners.delete(handler);
    },
    close() {
      closed = true;
      generation += 1;
      agent = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      listeners.clear();
      stateListeners.clear();
      const current = socket;
      socket = null;
      setState("closed");
      current?.close(1000, "page closed");
    },
  };
}
