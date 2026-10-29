import { describe, expect, it } from "vitest";
import { DelegationError } from "../src/errors";
import { createMemoryDelegationStore } from "../src/store";

async function codeOf(run: () => unknown | Promise<unknown>): Promise<string> {
  try {
    await run();
    return "NO_ERROR";
  } catch (error) {
    return error instanceof DelegationError ? error.code : String((error as { code?: unknown })?.code);
  }
}

describe("@plingjs/delegation · memory store", () => {
  it("issues an opaque token and only exposes a safe view", async () => {
    const store = createMemoryDelegationStore({ ttlMs: 60_000 });
    const issued = await store.issue({
      userId: "user-1",
      agentId: "codex",
      scope: ["search_orders", "remove@order", "search_orders"],
    });

    expect(issued.token.startsWith("plg_dlg_")).toBe(true);
    expect(issued.scope).toEqual(["search_orders", "remove@order"]);

    const view = await store.introspect({ token: issued.token });
    expect(view).toMatchObject({
      credentialId: issued.credentialId,
      delegationId: issued.delegationId,
      sessionId: issued.sessionId,
      userId: "user-1",
      agentId: "codex",
      scope: ["search_orders", "remove@order"],
    });
    expect(view).not.toHaveProperty("token");
    expect(view).not.toHaveProperty("tokenHash");
    expect(JSON.stringify(view)).not.toContain(issued.token);
  });

  it("expires credentials at the exact expiry boundary", async () => {
    let clock = 1_000;
    const store = createMemoryDelegationStore({ now: () => clock, ttlMs: 100 });
    const issued = await store.issue({ userId: "u", agentId: "a", scope: ["read"] });

    clock = 1_099;
    await expect(store.introspect({ token: issued.token })).resolves.toBeDefined();
    clock = 1_100;
    await expect(codeOf(() => store.introspect({ token: issued.token }))).resolves.toBe("DELEGATION_EXPIRED");
  });

  it("rotates the token while keeping session and delegation identity", async () => {
    const store = createMemoryDelegationStore();
    const first = await store.issue({ userId: "u", agentId: "a", scope: ["read"] });
    const second = await store.refresh({ token: first.token, userId: "u" });

    expect(second.token).not.toBe(first.token);
    expect(second.credentialId).not.toBe(first.credentialId);
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.delegationId).toBe(first.delegationId);
    expect(second.expiresAt).toBe(first.expiresAt);
    await expect(codeOf(() => store.introspect({ token: first.token }))).resolves.toBe("DELEGATION_REVOKED");
    await expect(store.introspect({ token: second.token })).resolves.toMatchObject({ sessionId: first.sessionId });
  });

  it("rejects cross-user refresh / revoke and revoked credentials", async () => {
    const store = createMemoryDelegationStore();
    const issued = await store.issue({ userId: "owner", agentId: "a", scope: ["read"] });

    await expect(codeOf(() => store.refresh({ token: issued.token, userId: "intruder" }))).resolves.toBe(
      "DELEGATION_BINDING_MISMATCH",
    );
    await expect(codeOf(() => store.revoke({ token: issued.token, userId: "intruder" }))).resolves.toBe(
      "DELEGATION_BINDING_MISMATCH",
    );

    const revoked = await store.revoke({ token: issued.token, userId: "owner" });
    expect(revoked.revokedAt).toBeTypeOf("number");
    await expect(codeOf(() => store.introspect({ token: issued.token }))).resolves.toBe("DELEGATION_REVOKED");
  });

  it("requires an explicit, bounded scope and rejects malformed credentials", async () => {
    const store = createMemoryDelegationStore({ ttlMs: 1_000, maxTtlMs: 2_000 });

    await expect(codeOf(() => store.issue({ userId: "u", agentId: "a", scope: [] }))).resolves.toBe(
      "DELEGATION_INVALID_REQUEST",
    );
    await expect(
      codeOf(() => store.issue({ userId: "u", agentId: "a", scope: ["read"], ttlMs: 2_001 })),
    ).resolves.toBe("DELEGATION_INVALID_REQUEST");
    await expect(codeOf(() => store.introspect({ token: "forged" }))).resolves.toBe(
      "DELEGATION_INVALID_CREDENTIAL",
    );
  });
});
