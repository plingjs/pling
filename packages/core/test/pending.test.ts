import { describe, expect, it, vi } from "vitest";
import { beginPending, pendingCount, trackPending, whenIdle } from "../src/pending";

/**
 * 「页面还在动」的登记处（S4b）。
 *
 * 契约：
 *   1. 登记 / 注销的**计数**要准（幂等，不能漏减，也不能变负）；
 *   2. `whenIdle` 要**连续确认**若干次才敢说「停了」—— 滚动是下一帧才开始的；
 *   3. 一直有人在动时超时返回 `false`（**不抛异常**），不能把循环挂死。
 */

/** 假的时钟 + 睡眠：不真的等，把 sleep 直接推给下一次判定 */
function fakeTime() {
  let now = 0;
  return {
    now: () => now,
    sleep: vi.fn(async (ms: number) => {
      now += ms;
    }),
  };
}

describe("pending：谁在动谁登记", () => {
  it("登记与注销成对，计数回到 0", () => {
    expect(pendingCount()).toBe(0);
    const end = beginPending();
    expect(pendingCount()).toBe(1);
    end();
    expect(pendingCount()).toBe(0);
  });

  it("结束函数是幂等的（滚动观察器会「先结束上一段、再开始新的一段」）", () => {
    const end = beginPending();
    end();
    end();
    end();
    expect(pendingCount()).toBe(0);
  });

  it("可以同时有多件事在动", () => {
    const a = beginPending();
    const b = beginPending();
    expect(pendingCount()).toBe(2);
    a();
    expect(pendingCount()).toBe(1);
    b();
    expect(pendingCount()).toBe(0);
  });

  it("trackPending：promise 结束（含失败）就自动注销", async () => {
    const ok = trackPending(new Promise<void>((resolve) => setTimeout(resolve, 5)));
    expect(pendingCount()).toBe(1);
    await ok;
    expect(pendingCount()).toBe(0);

    const bad = trackPending(Promise.reject(new Error("boom")).catch(() => {}));
    expect(pendingCount()).toBe(1);
    await bad;
    expect(pendingCount()).toBe(0);
  });
});

describe("whenIdle：等页面停下来", () => {
  it("本来就没在动：连续确认两次后返回 true", async () => {
    const { now, sleep } = fakeTime();
    expect(await whenIdle({ now, sleep })).toBe(true);
    expect(sleep).toHaveBeenCalledTimes(1); // 第 1 次空闲 → 睡一觉再确认 → 第 2 次空闲
  });

  it("滚动期间不返回：热闹 → 安静之后才说「停了」", async () => {
    const { now, sleep } = fakeTime();
    const end = beginPending();
    let released = false;
    // 第 3 次判定之前放开（模拟滚动结束）
    const release = async (): Promise<void> => {
      await sleep(40);
      end();
      released = true;
    };
    const [idle] = await Promise.all([whenIdle({ timeout: 500, interval: 20, now, sleep }), release()]);
    expect(idle).toBe(true);
    expect(released).toBe(true);
    expect(pendingCount()).toBe(0);
  });

  it("一直在动：超时返回 false（不抛异常、不挂死）", async () => {
    const { now, sleep } = fakeTime();
    const end = beginPending();
    expect(await whenIdle({ timeout: 100, interval: 20, now, sleep })).toBe(false);
    end();
  });

  it("confirmTicks = 1 时只看一次（给不关心竞态的调用方用）", async () => {
    const { now, sleep } = fakeTime();
    expect(await whenIdle({ confirmTicks: 1, now, sleep })).toBe(true);
    expect(sleep).not.toHaveBeenCalled();
  });
});
