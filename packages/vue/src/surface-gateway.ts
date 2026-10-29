import {
  getCurrentInstance,
  getCurrentScope,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  type Ref,
  type ShallowRef,
} from "vue";
import type { Confirm } from "@plingjs/core";
import type { AgentSurface, SurfaceExpose, SurfaceSession } from "@plingjs/surface";
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
import { usePling } from "./directive";

export type {
  SurfaceAgentAccess,
  SurfaceConnectionState,
  SurfacePageSession,
  SurfacePairing,
} from "@plingjs/surface-browser";

export type SurfaceGatewayMode = "public-demo" | "bff";
export type SurfaceGatewayBusy = "" | "connect" | "pair" | "claim" | "revoke";

export interface UseSurfaceGatewayOptions {
  /** Stable application name sent in the bridge hello. */
  app: string;
  /**
   * Explicit capability allowlist. This is never inferred from the DOM: it is
   * the maximum set an external Agent may see for this page.
   */
  expose: SurfaceExpose;
  /**
   * `public-demo` creates a page session from the browser and may display an
   * Agent token. `bff` requires `getPageSession`, which must be backed by an
   * authenticated application server.
   */
  mode: SurfaceGatewayMode;
  /** Gateway origin for `public-demo`, e.g. `https://surface.example.com`. */
  gatewayUrl?: string;
  /** Production page-session provider. The BFF keeps the admin token server-side. */
  getPageSession?: () => Promise<SurfacePageSession>;
  /** Inject a configured client; useful for tests or a custom BFF contract. */
  gatewayClient?: SurfaceGatewayClient;
  /** Human confirmation UI and its bridge subscription. */
  approval?: SurfaceApprovalSource & { confirm?: Confirm };
  /** Override the confirmation function independently from the approval source. */
  confirm?: Confirm | null;
  /** Default `true`; set to `false` when the host owns an explicit connect button. */
  autoConnect?: boolean;
  /** Public-demo only. Default `true` in that mode; always false in BFF mode. */
  autoClaim?: boolean;
  /** Agent id supplied when claiming a public-demo pairing. */
  agentId?: string;
  /** Optional tenant/client hints for the public-demo endpoint. */
  tenantId?: string;
  clientKey?: string;
  reconnectMs?: number;
  webSocket?: SurfaceWebSocketFactory;
  /** Extra Surface options such as recordLimit, rateLimit, replay, or onAudit. */
  surface?: Omit<CreatePlingSurfaceOptions, "app" | "expose" | "confirm" | "session">;
}

export interface SurfaceGatewayController {
  readonly mode: SurfaceGatewayMode;
  readonly app: string;
  /** Created after the page session connects; it shares the page's registry. */
  readonly surface: ShallowRef<AgentSurface | null>;
  readonly state: Ref<SurfaceConnectionState | "idle">;
  readonly agent: Ref<SurfaceSession | null>;
  readonly page: ShallowRef<SurfacePageSession | null>;
  readonly pairing: ShallowRef<SurfacePairing | null>;
  readonly access: ShallowRef<SurfaceAgentAccess | null>;
  readonly busy: Ref<SurfaceGatewayBusy>;
  readonly error: Ref<string>;
  connect(): Promise<void>;
  disconnect(): void;
  pair(): Promise<SurfacePairing | null>;
  claim(): Promise<SurfaceAgentAccess | null>;
  revoke(): Promise<void>;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Vue lifecycle + reactive state around the Surface browser runtime.
 *
 * It deliberately does **not** declare business actions or infer capabilities.
 * The host page keeps its `useAgentTool` / `v-tool` declarations and supplies
 * the explicit `expose` allowlist. This composable only removes the repeated
 * session, socket, bridge, pairing, and revocation plumbing.
 */
export function useSurfaceGateway(options: UseSurfaceGatewayOptions): SurfaceGatewayController {
  const pling = usePling();
  const mode = options.mode;
  const autoConnect = options.autoConnect ?? true;
  const autoClaim = options.autoClaim ?? mode === "public-demo";
  const client = options.gatewayClient ?? createSurfaceGatewayClient({ baseUrl: options.gatewayUrl });
  const confirm = options.confirm ?? options.approval?.confirm ?? null;

  const surface = shallowRef<AgentSurface | null>(null);
  const state = ref<SurfaceConnectionState | "idle">("idle");
  const agent = ref<SurfaceSession | null>(null);
  const page = shallowRef<SurfacePageSession | null>(null);
  const pairing = shallowRef<SurfacePairing | null>(null);
  const access = shallowRef<SurfaceAgentAccess | null>(null);
  const busy = ref<SurfaceGatewayBusy>("");
  const error = ref("");

  let transport: SurfaceTransport | null = null;
  let bridge: SurfaceBridge | null = null;
  let offState: (() => void) | null = null;
  let offMessage: (() => void) | null = null;
  let closedByHost = false;

  function disconnect(): void {
    closedByHost = true;
    offState?.();
    offState = null;
    offMessage?.();
    offMessage = null;
    bridge?.close();
    bridge = null;
    transport?.close();
    transport = null;
    surface.value = null;
    state.value = "closed";
    agent.value = null;
    page.value = null;
    pairing.value = null;
    access.value = null;
    error.value = "";
    busy.value = "";
  }

  async function loadPageSession(): Promise<SurfacePageSession> {
    if (mode === "bff") {
      if (!options.getPageSession) {
        throw new Error("bff 模式必须提供 getPageSession，并由应用后端验证登录后创建页面会话");
      }
      return options.getPageSession();
    }
    return client.createPublicPageSession({
      ...(options.tenantId ? { tenantId: options.tenantId } : {}),
      ...(options.clientKey ? { clientKey: options.clientKey } : {}),
    });
  }

  async function connect(): Promise<void> {
    if (busy.value) return;
    busy.value = "connect";
    error.value = "";
    closedByHost = false;
    try {
      offState?.();
      offState = null;
      offMessage?.();
      offMessage = null;
      bridge?.close();
      bridge = null;
      transport?.close();
      transport = null;
      surface.value = null;
      agent.value = null;
      pairing.value = null;
      access.value = null;

      const nextPage = await loadPageSession();
      if (closedByHost) return;
      page.value = nextPage;

      const nextTransport = createSurfaceTransport({
        url: nextPage.surfaceUrl,
        app: options.app,
        ...(options.reconnectMs === undefined ? {} : { reconnectMs: options.reconnectMs }),
        ...(options.webSocket ? { webSocket: options.webSocket } : {}),
      });
      transport = nextTransport;
      state.value = nextTransport.state;

      const runtime = createPlingSurface(pling.registry, {
        app: options.app,
        expose: options.expose,
        confirm,
        session: () => transport?.agent ?? null,
        ...options.surface,
      });
      surface.value = runtime.surface;
      bridge = createSurfaceBridge({
        surface: runtime.surface,
        transport: nextTransport,
        ...(options.approval ? { approval: options.approval } : {}),
      });
      offState = nextTransport.subscribeState((next) => {
        state.value = next;
        if (next === "connected" && autoClaim && !access.value && !agent.value && !busy.value) void claim();
      });
      offMessage = nextTransport.subscribe(() => {
        agent.value = nextTransport.agent;
        if (agent.value) pairing.value = null;
      });
    } catch (reason) {
      error.value = messageOf(reason);
      disconnect();
      error.value = messageOf(reason);
    } finally {
      busy.value = "";
      if (!closedByHost && state.value === "connected" && autoClaim && !access.value && !agent.value) {
        void claim();
      }
    }
  }

  async function pair(): Promise<SurfacePairing | null> {
    const currentPage = page.value;
    if (!currentPage || busy.value) return null;
    busy.value = "pair";
    error.value = "";
    try {
      pairing.value = await client.createPairing(currentPage);
      return pairing.value;
    } catch (reason) {
      error.value = messageOf(reason);
      return null;
    } finally {
      busy.value = "";
    }
  }

  async function claim(): Promise<SurfaceAgentAccess | null> {
    if (mode !== "public-demo") {
      error.value = "claim() 只用于 public-demo；正式环境请使用配对或委托授权流程";
      return null;
    }
    const currentPage = page.value;
    if (!currentPage || busy.value) return null;
    busy.value = "claim";
    error.value = "";
    try {
      access.value = await client.claimAgent(currentPage, {
        ...(options.agentId ? { agentId: options.agentId } : {}),
        ...(pairing.value ? { pairing: pairing.value } : {}),
      });
      pairing.value = null;
      return access.value;
    } catch (reason) {
      error.value = messageOf(reason);
      return null;
    } finally {
      busy.value = "";
    }
  }

  async function revoke(): Promise<void> {
    const currentPage = page.value;
    const agentSessionId = agent.value?.sessionId ?? access.value?.agentSessionId;
    if (!currentPage || !agentSessionId || busy.value) return;
    busy.value = "revoke";
    error.value = "";
    try {
      await client.revokeAgent(currentPage, agentSessionId);
      pairing.value = null;
      access.value = null;
    } catch (reason) {
      error.value = messageOf(reason);
    } finally {
      busy.value = "";
    }
  }

  if (getCurrentScope()) onScopeDispose(disconnect);
  if (getCurrentInstance()) {
    onMounted(() => {
      if (autoConnect) void connect();
    });
  } else if (autoConnect) {
    void connect();
  }

  return {
    mode,
    app: options.app,
    surface,
    state,
    agent,
    page,
    pairing,
    access,
    busy,
    error,
    connect,
    disconnect,
    pair,
    claim,
    revoke,
  };
}
