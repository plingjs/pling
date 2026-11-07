import type { Confirm } from "@plingjs/core";
import type { AgentSurface, SurfaceExpose } from "@plingjs/surface";
import {
  createPlingSurface,
  createSurfaceBridge,
  createSurfaceGatewayClient,
  createSurfaceTransport,
  type CreatePlingSurfaceOptions,
  type SurfaceAgentAccess,
  type SurfaceApprovalSource,
  type SurfaceBridge,
  type SurfaceConnectionState,
  type SurfaceGatewayClient,
  type SurfacePageSession,
  type SurfacePairing,
  type SurfaceTransport,
  type SurfaceWebSocketFactory,
} from "@plingjs/surface-browser";
import type { PlingPage } from "@plingjs/dom";

export type {
  SurfaceAgentAccess,
  SurfaceConnectionState,
  SurfacePageSession,
  SurfacePairing,
} from "@plingjs/surface-browser";

export type SurfaceGatewayMode = "public-demo" | "bff";
export type SurfaceGatewayBusy = "" | "connect" | "pair" | "claim" | "revoke";

export interface VanillaSurfaceGatewayOptions {
  /** Stable application name sent in the bridge hello. */
  app: string;
  /** Explicit capability allowlist; never inferred from the DOM. */
  expose: SurfaceExpose;
  mode: SurfaceGatewayMode;
  gatewayUrl?: string;
  getPageSession?: () => Promise<SurfacePageSession>;
  gatewayClient?: SurfaceGatewayClient;
  approval?: SurfaceApprovalSource & { confirm?: Confirm };
  confirm?: Confirm | null;
  autoConnect?: boolean;
  autoClaim?: boolean;
  agentId?: string;
  tenantId?: string;
  clientKey?: string;
  reconnectMs?: number;
  webSocket?: SurfaceWebSocketFactory;
  surface?: Omit<CreatePlingSurfaceOptions, "app" | "expose" | "confirm" | "session">;
}

export interface VanillaSurfaceGatewaySnapshot {
  surface: AgentSurface | null;
  state: SurfaceConnectionState | "idle";
  agent: NonNullable<SurfaceTransport["agent"]> | null;
  page: SurfacePageSession | null;
  pairing: SurfacePairing | null;
  access: SurfaceAgentAccess | null;
  busy: SurfaceGatewayBusy;
  error: string;
}

export interface VanillaSurfaceGateway {
  readonly mode: SurfaceGatewayMode;
  readonly app: string;
  readonly surface: AgentSurface | null;
  readonly state: SurfaceConnectionState | "idle";
  readonly agent: NonNullable<SurfaceTransport["agent"]> | null;
  readonly page: SurfacePageSession | null;
  readonly pairing: SurfacePairing | null;
  readonly access: SurfaceAgentAccess | null;
  readonly busy: SurfaceGatewayBusy;
  readonly error: string;
  getSnapshot(): VanillaSurfaceGatewaySnapshot;
  subscribe(listener: () => void): () => void;
  connect(): Promise<void>;
  disconnect(): void;
  pair(): Promise<SurfacePairing | null>;
  claim(): Promise<SurfaceAgentAccess | null>;
  revoke(): Promise<void>;
  destroy(): void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Plain-DOM lifecycle around a page-side Surface connection. */
export function createSurfaceGateway(
  page: Pick<PlingPage, "registry">,
  options: VanillaSurfaceGatewayOptions,
): VanillaSurfaceGateway {
  const mode = options.mode;
  const autoConnect = options.autoConnect ?? true;
  const autoClaim = options.autoClaim ?? mode === "public-demo";
  const client = options.gatewayClient ?? createSurfaceGatewayClient({ baseUrl: options.gatewayUrl });
  const confirm = options.confirm ?? options.approval?.confirm ?? null;
  const listeners = new Set<() => void>();

  let surface: AgentSurface | null = null;
  let state: SurfaceConnectionState | "idle" = "idle";
  let agent: NonNullable<SurfaceTransport["agent"]> | null = null;
  let pageSession: SurfacePageSession | null = null;
  let pairing: SurfacePairing | null = null;
  let access: SurfaceAgentAccess | null = null;
  let busy: SurfaceGatewayBusy = "";
  let error = "";
  let transport: SurfaceTransport | null = null;
  let bridge: SurfaceBridge | null = null;
  let offState: (() => void) | null = null;
  let offMessage: (() => void) | null = null;
  let closedByHost = false;
  let destroyed = false;

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function clearConnection(): void {
    offState?.();
    offState = null;
    offMessage?.();
    offMessage = null;
    bridge?.close();
    bridge = null;
    transport?.close();
    transport = null;
    surface = null;
    state = "closed";
    agent = null;
    pageSession = null;
    pairing = null;
    access = null;
    error = "";
    busy = "";
    notify();
  }

  function disconnect(): void {
    closedByHost = true;
    clearConnection();
  }

  async function loadPageSession(): Promise<SurfacePageSession> {
    if (mode === "bff") {
      if (!options.getPageSession) {
        throw new Error("bff mode requires getPageSession backed by an authenticated application server");
      }
      return options.getPageSession();
    }
    return client.createPublicPageSession({
      ...(options.tenantId ? { tenantId: options.tenantId } : {}),
      ...(options.clientKey ? { clientKey: options.clientKey } : {}),
    });
  }

  async function connect(): Promise<void> {
    if (destroyed || busy) return;
    busy = "connect";
    error = "";
    closedByHost = false;
    notify();
    try {
      offState?.();
      offState = null;
      offMessage?.();
      offMessage = null;
      bridge?.close();
      bridge = null;
      transport?.close();
      transport = null;
      surface = null;
      agent = null;
      pairing = null;
      access = null;

      const nextPage = await loadPageSession();
      if (closedByHost || destroyed) return;
      pageSession = nextPage;

      const nextTransport = createSurfaceTransport({
        url: nextPage.surfaceUrl,
        app: options.app,
        ...(options.reconnectMs === undefined ? {} : { reconnectMs: options.reconnectMs }),
        ...(options.webSocket ? { webSocket: options.webSocket } : {}),
      });
      transport = nextTransport;
      state = nextTransport.state;

      const runtime = createPlingSurface(page.registry, {
        app: options.app,
        expose: options.expose,
        confirm,
        session: () => transport?.agent ?? null,
        ...options.surface,
      });
      surface = runtime.surface;
      bridge = createSurfaceBridge({
        surface: runtime.surface,
        transport: nextTransport,
        ...(options.approval ? { approval: options.approval } : {}),
      });
      offState = nextTransport.subscribeState((next) => {
        state = next;
        notify();
        if (next === "connected" && autoClaim && !access && !agent && !busy) void claim();
      });
      offMessage = nextTransport.subscribe(() => {
        agent = nextTransport.agent;
        if (agent) pairing = null;
        notify();
      });
    } catch (reason) {
      error = messageOf(reason);
      clearConnection();
      error = messageOf(reason);
      notify();
    } finally {
      busy = "";
      notify();
      if (!closedByHost && !destroyed && state === "connected" && autoClaim && !access && !agent) {
        void claim();
      }
    }
  }

  async function pair(): Promise<SurfacePairing | null> {
    const current = pageSession;
    if (!current || busy) return null;
    busy = "pair";
    error = "";
    notify();
    try {
      pairing = await client.createPairing(current);
      return pairing;
    } catch (reason) {
      error = messageOf(reason);
      return null;
    } finally {
      busy = "";
      notify();
    }
  }

  async function claim(): Promise<SurfaceAgentAccess | null> {
    if (mode !== "public-demo") {
      error = "claim() is only available in public-demo mode; production pages should use pairing or delegated authorization";
      notify();
      return null;
    }
    const current = pageSession;
    if (!current || busy) return null;
    busy = "claim";
    error = "";
    notify();
    try {
      access = await client.claimAgent(current, {
        ...(options.agentId ? { agentId: options.agentId } : {}),
        ...(pairing ? { pairing } : {}),
      });
      pairing = null;
      return access;
    } catch (reason) {
      error = messageOf(reason);
      return null;
    } finally {
      busy = "";
      notify();
    }
  }

  async function revoke(): Promise<void> {
    const current = pageSession;
    const agentSessionId = agent?.sessionId ?? access?.agentSessionId;
    if (!current || !agentSessionId || busy) return;
    busy = "revoke";
    error = "";
    notify();
    try {
      await client.revokeAgent(current, agentSessionId);
      pairing = null;
      access = null;
    } catch (reason) {
      error = messageOf(reason);
    } finally {
      busy = "";
      notify();
    }
  }

  const gateway: VanillaSurfaceGateway = {
    mode,
    app: options.app,
    get surface() {
      return surface;
    },
    get state() {
      return state;
    },
    get agent() {
      return agent;
    },
    get page() {
      return pageSession;
    },
    get pairing() {
      return pairing;
    },
    get access() {
      return access;
    },
    get busy() {
      return busy;
    },
    get error() {
      return error;
    },
    getSnapshot: () => ({ surface, state, agent, page: pageSession, pairing, access, busy, error }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect,
    disconnect,
    pair,
    claim,
    revoke,
    destroy() {
      destroyed = true;
      disconnect();
      listeners.clear();
    },
  };

  if (autoConnect) void connect();
  return gateway;
}
