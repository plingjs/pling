// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { ResidencyEnvelope } from "@plingjs/agent";
import {
  ContinuityConformanceError,
  assertContinuityBackendConformance,
  runContinuityBackendConformance,
} from "../src/conformance";
import { ContinuityBackendError } from "../src/errors";
import { createMemoryContinuityBackend } from "../src/testing";
import type { ContinuityBackend } from "../src/types";

function envelope(sessionId: string): ResidencyEnvelope {
  return {
    version: 2,
    sessionId,
    revision: 1,
    status: "active",
    summary: "测试检查点",
    messages: [],
    events: [],
    updatedAt: 1,
  };
}

function codeOf(run: () => unknown): string {
  try {
    run();
    return "NO_ERROR";
  } catch (error) {
    return error instanceof ContinuityBackendError ? error.code : String(error);
  }
}

describe("@plingjs/continuity-http/testing · memory backend", () => {
  it("用服务端时间让任务与租约过期", () => {
    let now = 1_000;
    const backend = createMemoryContinuityBackend({ now: () => now, taskTtlMs: 1_500 });
    backend.create("alice", { envelope: envelope("task_expire"), ownerId: "owner-a", ttlMs: 1_500 });
    expect(backend.read("alice", "task_expire")).not.toBeNull();
    now += 1_501;
    expect(backend.read("alice", "task_expire")).toBeNull();
    expect(codeOf(() => backend.claim("alice", "task_expire", {
      expectedRevision: 1,
      ownerId: "owner-b",
      ttlMs: 1_500,
    }))).toBe("NOT_FOUND");
  });

  it("release 递增 revision 并清掉 owner；之后可重新 claim", () => {
    const backend = createMemoryContinuityBackend();
    const grant = backend.create("alice", {
      envelope: envelope("task_release"),
      ownerId: "owner-a",
      ttlMs: 30_000,
    });
    expect(backend.release("alice", "task_release", {
      ownerId: "owner-a",
      leaseId: grant.leaseId,
    })).toBe(true);
    expect(backend.read("alice", "task_release")).toMatchObject({
      revision: 2,
      status: "suspended",
    });
    expect(backend.read("alice", "task_release")?.ownerId).toBeUndefined();
    expect(backend.claim("alice", "task_release", {
      expectedRevision: 2,
      ownerId: "owner-b",
      ttlMs: 30_000,
    })).toMatchObject({ ownerId: "owner-b", revision: 3 });
  });

  it("没有显式 preempt 就不能抢 live lease", () => {
    const backend = createMemoryContinuityBackend();
    const grant = backend.create("alice", {
      envelope: envelope("task_held"),
      ownerId: "owner-a",
      ttlMs: 30_000,
    });
    expect(codeOf(() => backend.claim("alice", "task_held", {
      expectedRevision: grant.revision,
      ownerId: "owner-b",
      ttlMs: 30_000,
    }))).toBe("LEASE_HELD");
    expect(backend.claim("alice", "task_held", {
      expectedRevision: grant.revision,
      ownerId: "owner-b",
      ttlMs: 30_000,
      preempt: true,
    })).toMatchObject({ ownerId: "owner-b", revision: 2 });
  });

  it("TTL 与 ownerId 在创建时就校验，非法值不会被静默接受", () => {
    const backend = createMemoryContinuityBackend();
    expect(codeOf(() => backend.create("alice", {
      envelope: envelope("task_bad_ttl"),
      ownerId: "owner-a",
      ttlMs: 0,
    }))).toBe("INVALID_STATE");
    expect(codeOf(() => backend.create("alice", {
      envelope: envelope("task_bad_owner"),
      ownerId: "",
      ttlMs: 30_000,
    }))).toBe("INVALID_STATE");
  });

  it("订阅只收到元数据，业务正文不会进入 change", () => {
    const backend = createMemoryContinuityBackend();
    const changes: unknown[] = [];
    const unsubscribe = backend.subscribe("alice", (change) => changes.push(change));
    backend.create("alice", {
      envelope: { ...envelope("task_subscribe"), goal: "非常敏感的目标" },
      ownerId: "owner-a",
      ttlMs: 30_000,
    });
    expect(JSON.stringify(changes)).toContain("task_subscribe");
    expect(JSON.stringify(changes)).not.toContain("非常敏感的目标");
    unsubscribe();
    expect(backend.stats("alice").listeners).toBe(0);
  });

  it("审计事件包含用户、动作与 revision，且不会改变原子结果", () => {
    const audit: Record<string, unknown>[] = [];
    const backend = createMemoryContinuityBackend({ onAudit: (event) => audit.push(event) });
    backend.create("alice", {
      envelope: envelope("task_audit"),
      ownerId: "owner-a",
      ttlMs: 30_000,
    });
    expect(audit[0]).toMatchObject({
      type: "pling.continuity.audit",
      userId: "alice",
      action: "create",
      sessionId: "task_audit",
      revision: 1,
    });
  });

  it("参考内存后端通过生产适配器一致性套件", async () => {
    let now = 1_000_000;
    const backend = createMemoryContinuityBackend({ now: () => now });
    const report = await assertContinuityBackendConformance(backend, {
      expiryTtlMs: 1_100,
      advanceTime: () => {
        now += 1_200;
      },
    });
    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "create:isolates-users",
        "claim:blocks-live-owner-without-preempt",
        "cas:rejects-stale-revision",
        "remove:rejects-non-owner",
        "lease:expired-fails-closed",
      ]),
    );
  });

  it("坏适配器会逐项报告失败，而不是在第一项停止", async () => {
    let now = 2_000_000;
    const reference = createMemoryContinuityBackend({ now: () => now });
    const broken: ContinuityBackend = {
      ...reference,
      claim: (userId, sessionId, input) => reference.claim(userId, sessionId, { ...input, preempt: true }),
    };
    const report = await runContinuityBackendConformance(broken, {
      advanceTime: () => {
        now += 1_200;
      },
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === "claim:blocks-live-owner-without-preempt")).toMatchObject({
      ok: false,
      error: expect.stringContaining("LEASE_HELD"),
    });
    expect(report.checks.length).toBeGreaterThan(8);
    await expect(assertContinuityBackendConformance(broken, {
      advanceTime: () => {
        now += 1_200;
      },
    })).rejects.toBeInstanceOf(ContinuityConformanceError);
  });
});
