import { afterEach, describe, expect, it } from "vitest";
import { beginPending, pendingCount } from "@plingjs/core";
import { defaultSettle, SETTLE_IDLE_TIMEOUT } from "../src/loop";

/**
 * 落定（S4b）：`settle` 不只要等「DOM 更新落地」，还要等**页面自己停下来**。
 *
 * 为什么合在一起：这两件事在代码里是两行，但在语义上是一句话 ——
 * 「现在看到的，就是这一步做完之后的样子」。少了后半句，
 * 平滑滚动 300–500ms 期间的快照会被当成最终状态（可见性、变更证据全跟着错）。
 */

afterEach(() => {
  // 兜底：别把登记漏给下一个用例
  while (pendingCount() > 0) beginPending()();
});

describe("defaultSettle：等页面停下来", () => {
  it("没有东西在动时正常返回（只是多了「确认真的停了」的几十毫秒）", async () => {
    await expect(defaultSettle()).resolves.toBeUndefined();
  });

  it("页面还在动（滚动中）→ 等它停才返回", async () => {
    const end = beginPending();
    setTimeout(end, 80);

    const started = Date.now();
    await defaultSettle();
    expect(Date.now() - started).toBeGreaterThanOrEqual(80);
    expect(pendingCount()).toBe(0);
  });

  it("一直有人在动 → 到点就走（不把每一步都挂死）", async () => {
    const end = beginPending();
    const started = Date.now();
    await defaultSettle();
    const elapsed = Date.now() - started;

    expect(elapsed).toBeGreaterThanOrEqual(SETTLE_IDLE_TIMEOUT);
    expect(elapsed).toBeLessThan(SETTLE_IDLE_TIMEOUT + 400);
    end();
  });
});
