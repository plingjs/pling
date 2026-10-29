import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { describe, expect, it, vi } from "vitest";
import type {
  SurfaceGatewayClient,
  SurfacePageSession,
  SurfaceWebSocketFactory,
} from "@plingjs/surface-browser";
import { createPling, useSurfaceGateway } from "../src";
import { FakeSocket } from "../../surface-browser/test/fake-socket";

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

function harness(mode: "public-demo" | "bff" = "public-demo") {
  const sockets: FakeSocket[] = [];
  const webSocket: SurfaceWebSocketFactory = (url) => {
    const socket = new FakeSocket(url);
    sockets.push(socket);
    return socket;
  };
  const client: SurfaceGatewayClient = {
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

  const pi = createPling(undefined, { onWarn: () => {} });
  let gateway!: ReturnType<typeof useSurfaceGateway>;
  const Host = defineComponent({
    setup() {
      gateway = useSurfaceGateway({
        app: "todo-test",
        expose: ["todo.add"],
        mode,
        gatewayClient: client,
        autoConnect: false,
        autoClaim: false,
        webSocket,
      });
      return () => h("div");
    },
  });
  const wrapper = mount(Host, { global: { plugins: [pi.plugin] } });
  return { gateway, wrapper, client, sockets };
}

describe("useSurfaceGateway", () => {
  it("connects, pairs, claims and revokes through the browser runtime", async () => {
    const { gateway, wrapper, client, sockets } = harness();
    expect(gateway.state.value).toBe("idle");

    await gateway.connect();
    expect(client.createPublicPageSession).toHaveBeenCalledTimes(1);
    expect(gateway.surface.value).not.toBeNull();
    const socket = sockets[0]!;
    socket.open();
    socket.message({ type: "hello_ack" });
    expect(gateway.state.value).toBe("connected");

    await gateway.pair();
    expect(gateway.pairing.value?.code).toBe("pair_1");
    await gateway.claim();
    expect(client.claimAgent).toHaveBeenCalledWith(
      expect.objectContaining({ pageSessionId: "ps_1" }),
      expect.objectContaining({ pairing: expect.objectContaining({ code: "pair_1" }) }),
    );
    expect(gateway.access.value?.token).toBe("plg_agent_1");

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
    expect(gateway.agent.value?.sessionId).toBe("as_1");

    await gateway.revoke();
    expect(client.revokeAgent).toHaveBeenCalledWith(expect.objectContaining({ pageSessionId: "ps_1" }), "as_1");
    expect(gateway.access.value).toBeNull();

    wrapper.unmount();
    expect(gateway.state.value).toBe("closed");
  });

  it("only claims in public-demo mode", async () => {
    const { gateway, wrapper } = harness("bff");
    await gateway.claim();
    expect(gateway.error.value).toMatch(/public-demo/);
    wrapper.unmount();
  });
});
