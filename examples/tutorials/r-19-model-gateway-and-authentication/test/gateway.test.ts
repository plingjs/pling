// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPlingGateway } from "@plingjs/server";
import { createDemoAuth } from "../src/demo-auth.mjs";
import { browserAgentConfig } from "../src/agent-config";

const origin = "http://127.0.0.1:5259";

function authFor(password = "demo-password") {
  return createDemoAuth({ password, publicOrigin: origin, secureCookie: false });
}

describe("R-19 · model gateway and authentication", () => {
  it("keeps the provider key out of browser configuration", () => {
    expect(browserAgentConfig).toEqual({ baseUrl: "/api/llm/v1", model: "server-model", apiKey: "" });
  });

  it("rejects an unauthenticated request before contacting the provider", async () => {
    let upstreamCalls = 0;
    const gateway = createPlingGateway({
      upstream: "https://provider.example/v1",
      authorize: authFor().authorize,
      allowAnonymous: false,
      fetch: (async () => {
        upstreamCalls += 1;
        return new Response("{}");
      }) as typeof fetch,
    });

    const response = await gateway.handle(
      new Request(`${origin}/api/llm/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "server-model", messages: [] }),
      }),
    );

    expect(response.status).toBe(401);
    expect(upstreamCalls).toBe(0);
  });

  it("fails closed when no authorization hook is configured", async () => {
    const gateway = createPlingGateway({ upstream: "https://provider.example/v1" });
    const response = await gateway.handle(
      new Request(`${origin}/api/llm/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "server-model", messages: [] }),
      }),
    );
    expect(response.status).toBe(503);
  });

  it("adds the provider key, pins the model, and audits metadata only", async () => {
    const auth = authFor();
    const session = auth.login("demo-password")!;
    let seenAuthorization = "";
    let seenBody = "";
    const audits: Array<Record<string, unknown>> = [];
    const gateway = createPlingGateway({
      upstream: { baseUrl: "https://provider.example/v1", apiKey: "server-provider-key" },
      model: "server-model",
      allowedModels: ["server-model"],
      authorize: auth.authorize,
      onAudit: (event) => {
        audits.push(event as unknown as Record<string, unknown>);
      },
      fetch: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        seenAuthorization = new Headers(init?.headers).get("authorization") ?? "";
        seenBody = String(init?.body);
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });

    const response = await gateway.handle(
      new Request(`${origin}/api/llm/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: session.cookie.split(";", 1)[0]!,
        },
        body: JSON.stringify({ model: "an-expensive-model", messages: [{ role: "user", content: "private prompt" }] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(seenAuthorization).toBe("Bearer server-provider-key");
    expect(JSON.parse(seenBody).model).toBe("server-model");
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ status: 200, model: "server-model", user: { id: "demo-user" } });
    expect(JSON.stringify(audits[0])).not.toContain("private prompt");
  });

  it("uses an HttpOnly cookie and rejects a revoked session", async () => {
    const auth = authFor("longer-password");
    const session = auth.login("longer-password")!;
    expect(session.cookie).toContain("HttpOnly");
    expect(session.cookie).toContain("SameSite=Lax");

    const headers = new Headers({ cookie: session.cookie.split(";", 1)[0]! });
    expect(auth.authorize({ headers })).toMatchObject({ ok: true, user: { id: "demo-user" } });
    auth.logout(headers);
    expect(auth.authorize({ headers })).toMatchObject({ ok: false, status: 401 });
  });
});
