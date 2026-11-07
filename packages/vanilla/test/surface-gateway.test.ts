import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  SurfaceGatewayClient,
  SurfacePageSession,
  SurfaceWebSocketFactory,
} from "@plingjs/surface-browser";
import type { SurfaceTask } from "@plingjs/surface";
import { createPling, type VanillaPlingOptions } from "../src";
import { FakeSocket } from "../../surface-browser/test/fake-socket";
import { waitFor } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function pageSession(): SurfacePageSession {
  return {
    pageSessionId: "ps_1",
    pageToken: "plg_page_1",
    expiresAt: Date.now() + 60_000,
    tenantId: "demo",
    surfaceUrl: "wss://surface.example.com/surface?token=plg_page_1",
    pairingUrl: "https://surface.example.com/v1/pairings",
    agentSessionsUrl: "https://surface.example.com/v1/agent-sessions",
    mcpUrl: "https://surface.example.com/mcp",
    scope: ["todo.add"],
  };
}

function client(): SurfaceGatewayClient {
  return {
    createPublicPageSession: vi.fn(async () => pageSession()),
    createPairing: vi.fn(async () => ({
      code: "pair_1",
      tenantId: "demo",
      tenantName: "Demo",
      mcpUrl: "https://surface.example.com/mcp",
      expiresAt: Date.now() + 60_000,
      scope: ["todo.add"],
    })),
    claimAgent: vi.fn(async () => ({
      agentSessionId: "as_1",
      token: "plg_agent_1",
      tenantId: "demo",
      pageSessionId: "ps_1",
      agentId: "codex",
      scope: ["todo.add"],
      expiresAt: Date.now() + 60_000,
      mcpUrl: "https://surface.example.com/mcp",
    })),
    revokeAgent: vi.fn(async () => {}),
  };
}

function harness(
  mode: "public-demo" | "bff" = "public-demo",
  options: {
    gatewayClient?: SurfaceGatewayClient;
    getPageSession?: () => Promise<SurfacePageSession>;
    autoClaim?: boolean;
    pling?: VanillaPlingOptions;
    surface?: { tasks?: readonly SurfaceTask[] };
  } = {},
) {
  const sockets: FakeSocket[] = [];
  const webSocket: SurfaceWebSocketFactory = (url) => {
    const socket = new FakeSocket(url);
    sockets.push(socket);
    return socket;
  };
  const gatewayClient = options.gatewayClient ?? client();
  const pling = createPling({ onWarn: () => {}, ...options.pling });
  const gateway = pling.surfaceGateway({
    app: "todo-test",
    expose: ["todo.add"],
    mode,
    gatewayClient,
    autoConnect: false,
    autoClaim: options.autoClaim ?? false,
    webSocket,
    ...(options.getPageSession ? { getPageSession: options.getPageSession } : {}),
    ...(options.surface ? { surface: options.surface } : {}),
  });
  return { pling, gateway, client: gatewayClient, sockets };
}

async function connect(gateway: ReturnType<typeof harness>["gateway"], sockets: FakeSocket[]) {
  await gateway.connect();
  const socket = sockets.at(-1);
  if (!socket) throw new Error("Expected a socket");
  socket.open();
  socket.message({ type: "hello_ack" });
  return socket;
}

describe("Vanilla Surface gateway", () => {
  it("connects, pairs, claims and revokes through the shared browser runtime", async () => {
    const { pling, gateway, client: api, sockets } = harness();
    const listener = vi.fn();
    gateway.subscribe(listener);
    expect(gateway.getSnapshot()).toMatchObject({ state: "idle", surface: null, page: null });

    const socket = await connect(gateway, sockets);
    expect(api.createPublicPageSession).toHaveBeenCalledOnce();
    expect(gateway.state).toBe("connected");
    expect(gateway.surface).not.toBeNull();
    expect(gateway.page?.pageSessionId).toBe("ps_1");
    expect(listener).toHaveBeenCalled();

    await gateway.pair();
    expect(gateway.pairing?.code).toBe("pair_1");
    await gateway.claim();
    expect(api.claimAgent).toHaveBeenCalledWith(
      expect.objectContaining({ pageSessionId: "ps_1" }),
      expect.objectContaining({ pairing: expect.objectContaining({ code: "pair_1" }) }),
    );
    expect(gateway.access?.token).toBe("plg_agent_1");
    expect(gateway.pairing).toBeNull();

    socket.message({
      type: "agent_session",
      action: "opened",
      session: {
        agentId: "codex",
        sessionId: "as_1",
        userId: "u_1",
        scope: ["todo.add"],
        expiresAt: Date.now() + 60_000,
      },
    });
    expect(gateway.agent?.sessionId).toBe("as_1");

    await gateway.revoke();
    expect(api.revokeAgent).toHaveBeenCalledWith(expect.objectContaining({ pageSessionId: "ps_1" }), "as_1");
    expect(gateway.access).toBeNull();

    gateway.disconnect();
    expect(gateway.getSnapshot()).toMatchObject({ state: "closed", page: null, agent: null, access: null });
    pling.destroy();
  });

  it("automatically claims a public-demo session after the socket is ready", async () => {
    const { pling, gateway, client: api, sockets } = harness("public-demo", { autoClaim: true });
    await gateway.connect();
    const socket = sockets[0]!;
    socket.open();
    socket.message({ type: "hello_ack" });

    await waitFor(() => gateway.access !== null);
    expect(api.claimAgent).toHaveBeenCalledOnce();
    expect(gateway.access?.agentSessionId).toBe("as_1");
    pling.destroy();
  });

  it("requires a server-backed page session in bff mode", async () => {
    const { pling, gateway } = harness("bff");
    await gateway.connect();
    expect(gateway.state).toBe("closed");
    expect(gateway.error).toMatch(/bff mode requires getPageSession/);
    pling.destroy();
  });

  it("only permits public-demo claim and keeps the reason visible", async () => {
    const { pling, gateway } = harness("bff", {
      getPageSession: vi.fn(async () => pageSession()),
    });
    await gateway.claim();
    expect(gateway.error).toMatch(/public-demo/);
    expect(gateway.access).toBeNull();
    pling.destroy();
  });

  it("keeps the page snapshot stable across subscribers and releases it on destroy", async () => {
    const { pling, gateway, sockets } = harness();
    await connect(gateway, sockets);
    const snapshots: string[] = [];
    const off = gateway.subscribe(() => snapshots.push(gateway.state));

    await gateway.pair();
    expect(snapshots).toContain("connected");
    off();
    const before = snapshots.length;
    gateway.disconnect();
    expect(snapshots).toHaveLength(before);

    pling.destroy();
    expect(gateway.state).toBe("closed");
    expect(gateway.surface).toBeNull();
  });

  it("passes descriptive tasks through to the public Surface description", async () => {
    const { pling, gateway, sockets } = harness("public-demo", {
      surface: {
        tasks: [{
          id: "todo.add",
          title: "Add a todo",
          steps: [{ action: "todo.add", label: "Add the item" }],
        }],
      },
    });
    const socket = await connect(gateway, sockets);
    await gateway.pair();
    await gateway.claim();
    socket.message({
      type: "agent_session",
      action: "opened",
      session: {
        agentId: "codex",
        sessionId: "as_1",
        userId: "u_1",
        scope: ["todo.add"],
        expiresAt: Date.now() + 60_000,
      },
    });

    expect(gateway.surface?.describe().tasks).toEqual([
      expect.objectContaining({ id: "todo.add", title: "Add a todo" }),
    ]);
    pling.destroy();
  });
});
