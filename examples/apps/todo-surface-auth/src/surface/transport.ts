import { ref, shallowRef, type Ref } from "vue";
import type { SurfaceSession } from "@plingjs/surface";

export type GatewayConnectionState = "connecting" | "connected" | "disconnected" | "closed";

export interface SurfaceTransport {
  post(message: unknown): void;
  subscribe(handler: (message: unknown) => void): () => void;
  close(): void;
}

export interface GatewayTransport extends SurfaceTransport {
  readonly state: Ref<GatewayConnectionState>;
  readonly agent: Ref<SurfaceSession | null>;
}

/**
 * Browser transport to the Surface Gateway.
 *
 * The page token authenticates the WebSocket. Agent identity and scope arrive
 * in a signed-in-gateway `agent_session.opened` message; the page never reads an
 * Agent token.
 */
export function createGatewayTransport(options: { url: string; app?: string; reconnectMs?: number }): GatewayTransport {
  const state = ref<GatewayConnectionState>("connecting");
  const agent = shallowRef<SurfaceSession | null>(null);
  const listeners = new Set<(message: unknown) => void>();
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let generation = 0;

  const connect = (): void => {
    if (closed) return;
    state.value = "connecting";
    const currentGeneration = ++generation;
    const next = new WebSocket(options.url);
    socket = next;

    next.addEventListener("open", () => {
      if (socket !== next) return;
      next.send(JSON.stringify({ type: "hello", protocol: "pling.bridge/0.1", app: options.app ?? "todo-surface-demo" }));
    });

    next.addEventListener("message", (event) => {
      if (socket !== next) return;
      let message: unknown;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (isRecord(message) && message.type === "hello_ack") state.value = "connected";
      if (isRecord(message) && message.type === "agent_session") {
        if (message.action === "opened" && isSurfaceSessionMessage(message.session)) {
          agent.value = {
            agentId: message.session.agentId,
            sessionId: message.session.sessionId,
            userId: message.session.userId,
            scope: message.session.scope,
            expiresAt: message.session.expiresAt,
          };
        } else if (message.action === "closed") {
          agent.value = null;
        }
      }
      for (const listener of listeners) listener(message);
    });

    next.addEventListener("close", (event) => {
      if (socket === next) socket = null;
      if (closed || currentGeneration !== generation) return;
      agent.value = null;
      if ([4001, 4002, 4003].includes(event.code)) {
        closed = true;
        state.value = "closed";
        return;
      }
      state.value = "disconnected";
      reconnectTimer = setTimeout(connect, options.reconnectMs ?? 1_500);
    });

    next.addEventListener("error", () => {
      // The close event owns reconnect and state transitions.
    });
  };

  connect();

  return {
    state,
    agent,
    post(message: unknown) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    },
    subscribe(handler: (message: unknown) => void) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
    close() {
      closed = true;
      generation += 1;
      state.value = "closed";
      agent.value = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      listeners.clear();
      const current = socket;
      socket = null;
      current?.close(1000, "page closed");
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSurfaceSessionMessage(value: unknown): value is {
  agentId: string;
  sessionId: string;
  userId: string;
  scope: string[];
  expiresAt: number;
} {
  return (
    isRecord(value) &&
    typeof value.agentId === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.userId === "string" &&
    Array.isArray(value.scope) &&
    value.scope.every((item) => typeof item === "string") &&
    typeof value.expiresAt === "number"
  );
}
