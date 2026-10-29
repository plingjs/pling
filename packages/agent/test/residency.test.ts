import { describe, expect, it } from "vitest";
import {
  ContinuityAuthorityError,
  RESIDENCY_VERSION,
  createBrowserContinuityAuthority,
  createMemoryContinuityAuthority,
  type ResidencyEnvelope,
} from "../src/residency";

function envelope(sessionId = "task_1"): ResidencyEnvelope {
  return {
    version: RESIDENCY_VERSION,
    sessionId,
    revision: 0,
    status: "active",
    goal: "处理订单",
    summary: "",
    messages: [{ role: "user", content: "处理订单" }],
    events: [{ type: "user", text: "处理订单" }],
    updatedAt: 1_000,
  };
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("ContinuityAuthority", () => {
  it("create → claim → compareAndSwap → release 保持单一 owner 与单调 revision", async () => {
    let now = 1_000;
    const authority = createMemoryContinuityAuthority({ now: () => now });
    const first = await authority.create({ envelope: envelope(), ownerId: "a", ttlMs: 10_000 });
    expect(first.revision).toBe(1);
    expect(first.leaseExpiresAt).toBe(11_000);

    const claimed = await authority.claim({
      sessionId: "task_1",
      expectedRevision: first.revision,
      ownerId: "b",
      ttlMs: 10_000,
      preempt: true,
    });
    expect(claimed.revision).toBe(2);
    expect(claimed.ownerId).toBe("b");

    await expect(
      authority.compareAndSwap({
        sessionId: "task_1",
        expectedRevision: first.revision,
        ownerId: "a",
        leaseId: first.leaseId,
        next: envelope(),
      }),
    ).rejects.toMatchObject({ code: "OWNER_MISMATCH" });

    const saved = await authority.compareAndSwap({
      sessionId: "task_1",
      expectedRevision: claimed.revision,
      ownerId: "b",
      leaseId: claimed.leaseId,
      next: { ...envelope(), messages: [{ role: "assistant", content: "已处理" }] },
    });
    expect(saved.revision).toBe(3);
    expect(saved.messages.at(-1)?.content).toBe("已处理");
    expect(saved.ownerId).toBe("b");

    await authority.release({ sessionId: "task_1", ownerId: "b", leaseId: claimed.leaseId });
    const released = await authority.read("task_1");
    expect(released?.status).toBe("suspended");
    expect(released?.ownerId).toBeUndefined();
    expect(released?.revision).toBe(4);
  });

  it("版本冲突与已有 owner 都 fail-closed；expired 租约可以被重新 claim", async () => {
    let now = 1_000;
    const authority = createMemoryContinuityAuthority({ now: () => now });
    const first = await authority.create({ envelope: envelope(), ownerId: "a", ttlMs: 5_000 });

    await expect(
      authority.claim({
        sessionId: "task_1",
        expectedRevision: first.revision + 10,
        ownerId: "b",
        ttlMs: 5_000,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });

    await expect(
      authority.claim({
        sessionId: "task_1",
        expectedRevision: first.revision,
        ownerId: "b",
        ttlMs: 5_000,
      }),
    ).rejects.toMatchObject({ code: "LEASE_HELD" });

    now = 7_000;
    const claimed = await authority.claim({
      sessionId: "task_1",
      expectedRevision: first.revision,
      ownerId: "b",
      ttlMs: 5_000,
    });
    expect(claimed.ownerId).toBe("b");
  });

  it("浏览器 adapter 用同一套语义写 localStorage，并拒绝非 owner 写入", async () => {
    let now = 1_000;
    const storage = memoryStorage();
    const locks = {
      request: async <T>(_name: string, run: () => Promise<T> | T): Promise<T> => run(),
    };
    const authority = createBrowserContinuityAuthority({
      storage,
      locks,
      channel: null,
      now: () => now,
      ttlMs: 10_000,
    });
    const first = await authority.create({ envelope: envelope("task_web"), ownerId: "a", ttlMs: 10_000 });
    expect((await authority.list())[0]).toMatchObject({ sessionId: "task_web", ownerActive: true });

    await expect(
      authority.compareAndSwap({
        sessionId: "task_web",
        expectedRevision: first.revision,
        ownerId: "b",
        leaseId: first.leaseId,
        next: envelope("task_web"),
      }),
    ).rejects.toBeInstanceOf(ContinuityAuthorityError);

    now = 20_000;
    expect(await authority.read("task_web")).toBeNull();
  });
});
