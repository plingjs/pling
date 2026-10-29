import { describe, expect, it, vi } from "vitest";
import { createSurfaceGatewayClient, SurfaceClientError } from "../src";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pageBody() {
  return {
    pageSessionId: "ps_1",
    token: "plg_page_short",
    expiresAt: Date.now() + 60_000,
    tenantId: "demo",
    surfaceUrl: "wss://surface.example.com/surface",
    pairingUrl: "https://surface.example.com/v1/pairings",
    agentSessionsUrl: "https://surface.example.com/v1/agent-sessions",
    mcpUrl: "https://surface.example.com/mcp",
    scope: ["todo.add"],
  };
}

describe("createSurfaceGatewayClient", () => {
  it("creates a public page session and appends the page token to the socket URL", async () => {
    const fetchImpl = vi.fn(async () => response(pageBody()));
    const client = createSurfaceGatewayClient({
      baseUrl: "https://surface.example.com/",
      fetch: fetchImpl as typeof fetch,
    });

    const page = await client.createPublicPageSession({ tenantId: "demo", clientKey: "test" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://surface.example.com/v1/demo/page-sessions",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ tenantId: "demo", clientKey: "test" }) }),
    );
    expect(page.pageToken).toBe("plg_page_short");
    expect(page.surfaceUrl).toBe("wss://surface.example.com/surface?token=plg_page_short");
  });

  it("claims a pairing and revokes the resulting Agent session", async () => {
    const page = {
      ...pageBody(),
      pageToken: "plg_page_short",
      surfaceUrl: "wss://surface.example.com/surface?token=plg_page_short",
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          code: "pair_1",
          tenantId: "demo",
          tenantName: "Demo",
          mcpUrl: "https://surface.example.com/mcp",
          expiresAt: Date.now() + 60_000,
          scope: ["todo.add"],
        }),
      )
      .mockResolvedValueOnce(
        response({
          agentSessionId: "as_1",
          token: "plg_agent_short",
          tenantId: "demo",
          pageSessionId: "ps_1",
          agentId: "codex",
          scope: ["todo.add"],
          expiresAt: Date.now() + 60_000,
          mcpUrl: "https://surface.example.com/mcp",
        }),
      )
      .mockResolvedValueOnce(response({ ok: true }));
    const client = createSurfaceGatewayClient({ fetch: fetchImpl as typeof fetch });

    const access = await client.claimAgent(page, { agentId: "codex", ttlMs: 30_000 });
    await client.revokeAgent(page, access.agentSessionId);

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(page.pairingUrl);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({ pageToken: "plg_page_short" });
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(page.agentSessionsUrl);
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({
      code: "pair_1",
      agentId: "codex",
      ttlMs: 30_000,
    });
    expect(fetchImpl.mock.calls[2]?.[0]).toBe("https://surface.example.com/v1/agent-sessions/revoke");
    expect(access.token).toBe("plg_agent_short");
  });

  it("keeps claimAgent usable when the method is destructured", async () => {
    const page = {
      ...pageBody(),
      pageToken: "plg_page_short",
      surfaceUrl: "wss://surface.example.com/surface?token=plg_page_short",
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          code: "pair_1",
          tenantId: "demo",
          tenantName: "Demo",
          mcpUrl: "https://surface.example.com/mcp",
          expiresAt: Date.now() + 60_000,
          scope: ["todo.add"],
        }),
      )
      .mockResolvedValueOnce(
        response({
          agentSessionId: "as_1",
          token: "plg_agent_short",
          tenantId: "demo",
          pageSessionId: "ps_1",
          agentId: "codex",
          scope: ["todo.add"],
          expiresAt: Date.now() + 60_000,
          mcpUrl: "https://surface.example.com/mcp",
        }),
      );
    const client = createSurfaceGatewayClient({ fetch: fetchImpl as typeof fetch });
    const claimAgent = client.claimAgent;

    await expect(claimAgent(page, { agentId: "codex" })).resolves.toMatchObject({
      token: "plg_agent_short",
    });
  });

  it("surfaces gateway error codes and status", async () => {
    const client = createSurfaceGatewayClient({
      baseUrl: "https://surface.example.com",
      fetch: (async () =>
        response({ error: { code: "PAGE_NOT_CONNECTED", message: "页面未连接" } }, 409)) as typeof fetch,
    });

    await expect(client.createPublicPageSession()).rejects.toMatchObject({
      code: "PAGE_NOT_CONNECTED",
      message: "页面未连接",
      status: 409,
    } satisfies Partial<SurfaceClientError>);
  });
});
