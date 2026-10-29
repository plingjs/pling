import { describe, expect, it } from "vitest";
import type { Llm } from "@plingjs/core";
import { createMemoryContinuityAuthority } from "../src/residency";
import { createLocalSession } from "../src/session";
import { allowAll, makeRegistry, noSettle } from "./helpers";

const registry = () => makeRegistry([{ id: "add", onRun: () => undefined }]);

async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("等待超时");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("跨标签页任务驻留", () => {
  it("remote scope 必须显式注入由宿主裁决的 authority", () => {
    expect(() => createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "不会执行" }),
      settle: noSettle,
      continuity: { scope: "remote" },
    })).toThrow(/必须显式提供 authority/);
  });

  it("A 执行 → B 只读跟随 → B 接管 → A 失权停止 → B 恢复后继续", async () => {
    let now = 1_000;
    const authority = createMemoryContinuityAuthority({ now: () => now });
    let releaseA: () => void = () => {};
    const slowA: Llm = async (_messages, _tools, options) => {
      await new Promise<void>((resolve, reject) => {
        const signal = options?.signal;
        if (signal?.aborted) {
          reject(new DOMException("aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
          once: true,
        });
        releaseA = resolve;
      });
      return { content: "A 完成" };
    };

    const a = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: slowA,
      settle: noSettle,
      continuity: { scope: "browser", authority, leaseTtlMs: 10_000 },
    });

    const pendingA = a.send("把购物车清空");
    await waitFor(() => Boolean(a.continuity.sessionId));
    const tasks = await a.continuity.tasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ status: "active", ownerActive: true });
    const taskId = tasks[0]!.sessionId;

    const b = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "B 已继续完成" }),
      settle: noSettle,
      continuity: { scope: "browser", authority, leaseTtlMs: 10_000 },
    });

    await b.continuity.follow(taskId);
    expect(b.continuity.role).toBe("follower");
    expect(b.events().some((event) => event.type === "user" && event.text === "把购物车清空")).toBe(true);

    await b.continuity.takeover(taskId);
    expect(b.continuity.role).toBe("owner");
    expect(a.continuity.role).toBe("follower");
    expect(a.continuity.leaseLost).toBe(true);
    expect(a.status()).toBe("cancelled");
    expect(
      a.events().some((event) => event.type === "notice" && event.text.includes("失去任务执行权")),
    ).toBe(true);

    await expect(pendingA).resolves.toBe("(Cancelled)");
    releaseA();

    const revBefore = (await authority.read(taskId))!.revision;
    await b.send("继续把购物车清空");
    await b.continuity.flush();
    const after = await authority.read(taskId);
    expect(after!.revision).toBeGreaterThan(revBefore);
    expect(after!.messages.some((message) => message.content.includes("B 已继续完成"))).toBe(true);
    expect(after!.messages.some((message) => message.content.includes("A 完成"))).toBe(false);
  });

  it("lease 心跳过期后旧 owner 停止，新上下文仍需显式 takeover", async () => {
    let now = 1_000;
    const authority = createMemoryContinuityAuthority({ now: () => now });
    const slow: Llm = async (_messages, _tools, options) => {
      await new Promise<void>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
          once: true,
        });
      });
      return { content: "完成" };
    };
    const a = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: slow,
      settle: noSettle,
      continuity: { scope: "browser", authority, leaseTtlMs: 2_000 },
    });
    const pending = a.send("做一个任务");
    await waitFor(() => Boolean(a.continuity.sessionId));
    const taskId = a.continuity.sessionId!;

    now = 10_000;
    const b = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "好" }),
      settle: noSettle,
      continuity: { scope: "browser", authority, leaseTtlMs: 2_000 },
    });
    await b.continuity.follow(taskId);
    expect(b.continuity.role).toBe("follower");
    await b.continuity.takeover(taskId);
    expect(b.continuity.role).toBe("owner");
    await expect(pending).resolves.toBe("(Cancelled)");
  });

  it("只读跟随者直接发送会 fork 新任务，源任务与 owner 完全不受影响", async () => {
    const authority = createMemoryContinuityAuthority();
    let releaseA: () => void = () => {};
    const slowA: Llm = async (_messages, _tools, options) => {
      await new Promise<void>((resolve, reject) => {
        if (options?.signal?.aborted) {
          reject(new DOMException("aborted", "AbortError"));
          return;
        }
        options?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
        releaseA = resolve;
      });
      return { content: "A 完成" };
    };
    const a = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: slowA,
      settle: noSettle,
      continuity: { scope: "browser", authority, leaseTtlMs: 10_000 },
    });
    const pendingA = a.send("整理全量订单");
    await waitFor(() => Boolean(a.continuity.sessionId));
    const sourceId = a.continuity.sessionId!;
    const sourceBefore = await authority.read(sourceId);

    const b = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "B 的分叉完成了" }),
      settle: noSettle,
      continuity: { scope: "browser", authority, leaseTtlMs: 10_000 },
    });
    await b.continuity.follow(sourceId);
    const answer = await b.send("只处理今天到期的订单");
    expect(answer).toBe("B 的分叉完成了");
    const forkedId = b.continuity.sessionId!;
    expect(forkedId).not.toBe(sourceId);
    expect(b.continuity.role).toBe("owner");
    expect(b.events().some((event) => event.type === "notice" && event.text.includes("分叉"))).toBe(true);
    await b.continuity.flush();

    const sourceAfter = await authority.read(sourceId);
    expect(sourceAfter).toMatchObject({
      revision: sourceBefore!.revision,
      ownerId: sourceBefore!.ownerId,
      leaseId: sourceBefore!.leaseId,
      goal: "整理全量订单",
      status: "active",
    });
    const forked = await authority.read(forkedId);
    expect(forked).toMatchObject({ goal: "只处理今天到期的订单", status: "done" });
    expect(forked!.messages.some((message) => message.content.includes("B 的分叉完成了"))).toBe(true);
    expect((await authority.list()).length).toBe(2);

    releaseA();
    await expect(pendingA).resolves.toBe("A 完成");
  });

  it("显式 fork 会保留源历史与目标，并让本页只成为新任务的 owner", async () => {
    const authority = createMemoryContinuityAuthority();
    const a = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "源任务完成" }),
      settle: noSettle,
      continuity: { scope: "browser", authority, leaseTtlMs: 10_000 },
    });
    await a.send("源任务目标");
    await a.continuity.flush();
    const sourceId = a.continuity.sessionId!;
    const source = await authority.read(sourceId);

    const b = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "不会执行" }),
      settle: noSettle,
      continuity: { scope: "browser", authority, leaseTtlMs: 10_000 },
    });
    const forkedId = await b.continuity.fork(sourceId);
    expect(forkedId).not.toBe(sourceId);
    expect(b.continuity.role).toBe("owner");
    expect(b.events().some((event) => event.type === "user" && event.text === "源任务目标")).toBe(true);
    const forked = await authority.read(forkedId);
    expect(forked).toMatchObject({ goal: "源任务目标", status: "active" });
    expect(forked!.ownerId).toBeDefined();
    const sourceAfter = await authority.read(sourceId);
    expect(sourceAfter!.revision).toBe(source!.revision);
    expect(sourceAfter!.ownerId).toBe(source!.ownerId);
    expect(sourceAfter!.status).toBe("done");
  });

  it("只读跟随一个已完成任务后，可以直接开始新任务", async () => {
    const authority = createMemoryContinuityAuthority();
    const a = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "第一个任务完成" }),
      settle: noSettle,
      continuity: { scope: "browser", authority, leaseTtlMs: 10_000 },
    });
    await a.send("第一个任务");
    await a.continuity.flush();
    const first = a.continuity.sessionId!;

    const b = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm: async () => ({ content: "第二个任务完成" }),
      settle: noSettle,
      continuity: { scope: "browser", authority, leaseTtlMs: 10_000 },
    });
    await b.continuity.follow(first);
    expect(b.continuity.role).toBe("follower");
    expect(b.continuity.completed).toBe(true);

    await b.send("第二个任务");
    expect(b.continuity.role).toBe("owner");
    expect(b.continuity.sessionId).not.toBe(first);
    expect((await authority.list()).length).toBe(2);
  });

  it("取消会释放租约；再次发送时重新认领同一个任务", async () => {
    const authority = createMemoryContinuityAuthority();
    let calls = 0;
    const llm: Llm = async (_messages, _tools, options) => {
      calls += 1;
      if (calls === 1) {
        await new Promise<void>((_resolve, reject) => {
          if (options?.signal?.aborted) {
            reject(new DOMException("aborted", "AbortError"));
            return;
          }
          options?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        });
      }
      return { content: "继续完成" };
    };
    const a = createLocalSession({
      registry: registry(),
      policy: allowAll,
      llm,
      settle: noSettle,
      continuity: { scope: "browser", authority, leaseTtlMs: 10_000 },
    });
    const pending = a.send("一个会被停止的任务");
    await waitFor(() => Boolean(a.continuity.sessionId));
    const taskId = a.continuity.sessionId!;

    a.cancel();
    await expect(pending).resolves.toBe("(Cancelled)");
    await a.continuity.flush();
    const suspended = await authority.read(taskId);
    expect(suspended!.ownerId).toBeUndefined();
    expect(suspended!.status).toBe("suspended");
    expect((await a.continuity.tasks())[0]).toMatchObject({ ownerActive: false });
    expect(a.continuity.role).toBe("unowned");

    await a.send("继续");
    await a.continuity.flush();
    expect(a.continuity.sessionId).toBe(taskId);
    const resumed = await authority.read(taskId);
    expect(resumed!.messages.some((message) => message.content.includes("继续完成"))).toBe(true);
  });
});
