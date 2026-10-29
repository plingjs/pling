import { describe, expect, it, vi } from "vitest";
import { createMemoryDelegationEventBus, type MemoryDelegationEventBus } from "../src/events";
import { createDelegationHandler } from "../src/server";
import { createMemoryDelegationStore } from "../src/store";
import type {
  DelegationEventBus,
  DelegationIdentity,
  DelegationInvalidationEvent,
  DelegationStore,
} from "../src/types";

const BASE = "http://pling.test/delegation";

function setup(
  overrides: { identity?: DelegationIdentity; now?: () => number; events?: DelegationEventBus } = {},
) {
  const store = createMemoryDelegationStore({ now: overrides.now, ttlMs: 60_000 });
  const events = overrides.events ?? createMemoryDelegationEventBus();
  const identity: DelegationIdentity = overrides.identity ?? {
    async resolve({ setCookie }) {
      setCookie("pling_user=demo; Path=/; HttpOnly");
      return { userId: "user-1", expiresAt: 999_999 };
    },
  };
  const handler = createDelegationHandler({ store, events, identity, now: overrides.now });
  return { store, events, handler };
}

async function json(response: Response): Promise<Record<string, any>> {
  return (await response.json()) as Record<string, any>;
}

async function post(token?: string, body?: unknown): Promise<RequestInit> {
  return {
    method: "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

describe("@plingjs/delegation · Web handler", () => {
  it("runs issue → introspect → refresh → revoke without leaking the token", async () => {
    const { handler, events } = setup();
    const rotated: DelegationInvalidationEvent[] = [];
    events.subscribe("user-1", (event) => rotated.push(event));

    const sessionResponse = await handler.handle(new Request(`${BASE}/session`));
    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.headers.get("set-cookie")).toContain("pling_user=demo");
    expect(await json(sessionResponse)).toMatchObject({ ok: true, userId: "user-1" });

    const issuedResponse = await handler.handle(
      new Request(`${BASE}/issue`, await post(undefined, { agentId: "codex", scope: ["search_orders"] })),
    );
    const issued = (await json(issuedResponse)).credential;
    expect(issued.token.startsWith("plg_dlg_")).toBe(true);

    const introspectedResponse = await handler.handle(
      new Request(`${BASE}/introspect`, await post(issued.token)),
    );
    const introspected = await json(introspectedResponse);
    expect(introspected.credential.userId).toBe("user-1");
    expect(JSON.stringify(introspected)).not.toContain(issued.token);

    const missingBearer = await handler.handle(new Request(`${BASE}/introspect`, { method: "POST" }));
    expect(missingBearer.status).toBe(401);
    expect(await json(missingBearer)).toMatchObject({ error: { code: "DELEGATION_INVALID_CREDENTIAL" } });

    const refreshedResponse = await handler.handle(
      new Request(`${BASE}/refresh`, await post(issued.token)),
    );
    const refreshed = (await json(refreshedResponse)).credential;
    expect(refreshed.sessionId).toBe(issued.sessionId);
    expect(refreshed.token).not.toBe(issued.token);
    expect(rotated).toEqual([
      expect.objectContaining({
        reason: "rotated",
        credentialId: issued.credentialId,
        replacedBy: refreshed.credentialId,
      }),
    ]);

    const oldResponse = await handler.handle(new Request(`${BASE}/introspect`, await post(issued.token)));
    expect(oldResponse.status).toBe(409);
    expect(await json(oldResponse)).toMatchObject({ error: { code: "DELEGATION_REVOKED" } });

    const revokedResponse = await handler.handle(
      new Request(`${BASE}/revoke`, await post(refreshed.token)),
    );
    expect(revokedResponse.status).toBe(200);
    expect(JSON.stringify(await json(revokedResponse))).not.toContain(refreshed.token);

    const afterResponse = await handler.handle(new Request(`${BASE}/introspect`, await post(refreshed.token)));
    expect(afterResponse.status).toBe(409);
  });

  it("uses the authenticated user for binding and rejects another user", async () => {
    let currentUser = "user-1";
    const { handler } = setup({
      identity: {
        async resolve() {
          return { userId: currentUser, expiresAt: 999_999 };
        },
      },
    });
    const issued = (
      await json(
        await handler.handle(
          new Request(`${BASE}/issue`, await post(undefined, { agentId: "codex", scope: ["read"] })),
        ),
      )
    ).credential;

    currentUser = "user-2";
    for (const action of ["refresh", "revoke"]) {
      const response = await handler.handle(new Request(`${BASE}/${action}`, await post(issued.token)));
      expect(response.status).toBe(403);
      expect(await json(response)).toMatchObject({ error: { code: "DELEGATION_BINDING_MISMATCH" } });
    }
  });

  it("streams ready + allowlisted revocation events and cleans up on cancel", async () => {
    const { handler, events } = setup();
    const response = await handler.handle(new Request(`${BASE}/events`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const ready = decoder.decode((await reader.read()).value);
    expect(ready).toContain("event: ready");

    events.publish({
      type: "credential_revoked",
      reason: "revoked",
      at: 123,
      credentialId: "dcr_1",
      delegationId: "del_1",
      sessionId: "ses_1",
      userId: "user-1",
      agentId: "codex",
    });
    const chunk = decoder.decode((await reader.read()).value);
    expect(chunk).toContain("event: credential_revoked");
    expect(chunk).toContain("dcr_1");
    expect(chunk).not.toContain("plg_dlg_");

    await reader.cancel();
    expect((events as MemoryDelegationEventBus).size()).toBe(0);
  });

  it("fails closed when identity cannot resolve a user", async () => {
    const { handler } = setup({ identity: { resolve: vi.fn(async () => null) } });
    const response = await handler.handle(new Request(`${BASE}/session`));
    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ error: { code: "DELEGATION_INVALID_CREDENTIAL" } });
  });

  it("recognizes stable error shapes from separately installed store adapters", async () => {
    const store = {
      async issue() {
        throw { code: "DELEGATION_INVALID_CREDENTIAL", status: 401, message: "adapter rejected" };
      },
      async introspect() {
        throw { code: "DELEGATION_INVALID_CREDENTIAL", status: 401, message: "adapter rejected" };
      },
      async refresh() {
        throw new Error("unreachable");
      },
      async revoke() {
        throw new Error("unreachable");
      },
    } as unknown as DelegationStore;
    const handler = createDelegationHandler({
      store,
      events: createMemoryDelegationEventBus(),
      identity: { resolve: async () => ({ userId: "u", expiresAt: 999_999 }) },
    });

    const response = await handler.handle(new Request(`${BASE}/introspect`, await post("plg_dlg_forged")));
    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ error: { code: "DELEGATION_INVALID_CREDENTIAL" } });
  });

  it("awaits async event publishers and treats notification failure as non-fatal", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let published = false;
    const events: DelegationEventBus = {
      subscribe: () => () => {},
      publish: async () => {
        await gate;
        published = true;
      },
      close: () => {},
    };
    const { handler } = setup({ events });
    const issued = (
      await json(
        await handler.handle(
          new Request(`${BASE}/issue`, await post(undefined, { agentId: "codex", scope: ["read"] })),
        ),
      )
    ).credential;

    let settled = false;
    const responsePromise = handler.handle(new Request(`${BASE}/revoke`, await post(issued.token))).then((response) => {
      settled = true;
      return response;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(settled).toBe(false);
    release();
    expect((await responsePromise).status).toBe(200);
    expect(published).toBe(true);

    const failingEvents: DelegationEventBus = {
      subscribe: () => () => {},
      publish: async () => {
        throw new Error("event bus unavailable");
      },
      close: () => {},
    };
    const failing = setup({ events: failingEvents });
    const second = (
      await json(
        await failing.handler.handle(
          new Request(`${BASE}/issue`, await post(undefined, { agentId: "codex", scope: ["read"] })),
        ),
      )
    ).credential;
    const revoked = await failing.handler.handle(new Request(`${BASE}/revoke`, await post(second.token)));
    expect(revoked.status).toBe(200);
    const after = await failing.handler.handle(new Request(`${BASE}/introspect`, await post(second.token)));
    expect(after.status).toBe(409);
  });
});
