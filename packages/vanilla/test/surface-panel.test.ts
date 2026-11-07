import { afterEach, describe, expect, it, vi } from "vitest";
import type { SurfaceGatewayClient, SurfacePageSession } from "@plingjs/surface-browser";
import { createPling, createSurfaceAccessPanel } from "../src";
import { FakeSocket } from "../../surface-browser/test/fake-socket";
import { click, waitFor } from "./helpers";

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

function api(): SurfaceGatewayClient {
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
  locale = "en-US",
  gatewayClient: SurfaceGatewayClient = api(),
) {
  const sockets: FakeSocket[] = [];
  const pling = createPling({ onWarn: () => {}, ui: { locale, classNames: { panel: "brand-panel" } } });
  const gateway = pling.surfaceGateway({
    app: "todo-test",
    expose: ["todo.add"],
    mode,
    gatewayClient,
    autoConnect: false,
    autoClaim: false,
    ...(mode === "bff" ? { getPageSession: async () => pageSession() } : {}),
    webSocket: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
  });
  return { pling, gateway, gatewayClient, sockets };
}

async function connect(gateway: ReturnType<typeof harness>["gateway"], sockets: FakeSocket[]) {
  await gateway.connect();
  const socket = sockets[0]!;
  socket.open();
  socket.message({ type: "hello_ack" });
  await waitFor(() => gateway.state === "connected");
}

describe("Vanilla Surface access panel", () => {
  it("matches the Vue shell: labelled heading, UI classes, locale and idle state", () => {
    const { pling, gateway } = harness();
    const panel = createSurfaceAccessPanel(gateway, { ui: pling.ui });
    const root = panel.element;

    expect(root.classList).toContain("pling-surface");
    expect(root.classList).toContain("brand-panel");
    expect(root.hasAttribute("data-pling-ui")).toBe(true);
    expect(root.getAttribute("aria-labelledby")).toBe("pling-surface-title");
    expect(root.querySelector("h2")?.id).toBe("pling-surface-title");
    expect(root.textContent).toContain("External Agent");
    expect(root.textContent).toContain("Not connected");
    expect([...root.querySelectorAll("button")].map((item) => item.textContent)).toContain("Connect Surface");

    pling.ui.setLocale("zh-CN");
    expect(root.textContent).toContain("外部 Agent");
    expect(root.textContent).toContain("未连接");
    panel.destroy();
    expect(root.isConnected).toBe(false);
    pling.destroy();
  });

  it("connects, creates a public-demo token and renders the exact Codex command", async () => {
    const { pling, gateway, gatewayClient, sockets } = harness();
    const panel = createSurfaceAccessPanel(gateway, { ui: pling.ui, mount: document.body });
    const connectButton = [...panel.element.querySelectorAll("button")]
      .find((item) => item.textContent === "Connect Surface");
    click(connectButton ?? null);
    await waitFor(() => sockets.length === 1);
    sockets[0]!.open();
    sockets[0]!.message({ type: "hello_ack" });
    await waitFor(() => gateway.state === "connected");
    expect(panel.element.textContent).toContain("Page connected");
    expect(panel.element.textContent).toContain("ps_1");

    const claim = [...panel.element.querySelectorAll("button")]
      .find((item) => item.textContent === "Create Agent token");
    expect(claim?.disabled).toBe(false);
    click(claim ?? null);
    await waitFor(() => gateway.access !== null);
    expect(gatewayClient.claimAgent).toHaveBeenCalledOnce();
    expect(panel.element.textContent).toContain("plg_agent_1");
    expect(panel.element.textContent).toContain("codex mcp add pling-surface");

    const revoke = [...panel.element.querySelectorAll("button")]
      .find((item) => item.textContent === "Revoke Agent");
    expect(revoke).toBeUndefined();
    panel.destroy();
    pling.destroy();
  });

  it("renders the pairing flow for bff mode and disables it until connected", async () => {
    const { pling, gateway, gatewayClient, sockets } = harness("bff");
    const panel = createSurfaceAccessPanel(gateway, { ui: pling.ui });
    const pairButton = () => [...panel.element.querySelectorAll("button")]
      .find((item) => item.textContent === "Create pairing code");
    expect(pairButton()?.disabled).toBe(true);

    await connect(gateway, sockets);
    click(pairButton() ?? null);
    await waitFor(() => gateway.pairing !== null);
    expect(gatewayClient.createPairing).toHaveBeenCalledOnce();
    expect(panel.element.textContent).toContain("pair_1");
    expect(panel.element.textContent).toContain("Give the one-time code");
    panel.destroy();
    pling.destroy();
  });

  it("renders an alert for connection errors and offers reconnect", async () => {
    const gatewayClient = api();
    gatewayClient.createPublicPageSession = vi.fn(async () => {
      throw new Error("gateway offline");
    });
    const { pling, gateway } = harness("public-demo", "en-US", gatewayClient);
    const panel = createSurfaceAccessPanel(gateway, { ui: pling.ui });
    await gateway.connect();
    expect(panel.element.querySelector('[role="alert"]')?.textContent).toContain("gateway offline");
    expect(panel.element.textContent).toContain("Connection closed");
    panel.destroy();
    pling.destroy();
  });
});
