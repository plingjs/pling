import { describe, expect, it, vi } from "vitest";
import { DEFAULT_WAIT_INTERVAL, DEFAULT_WAIT_TIMEOUT, waitFor } from "../src/wait";

/**
 * `waitFor`（S4）：等一个判据成立。
 *
 * 这一层的契约只有三条，测试也就是守这三条：
 *   1. 条件本来成立 → 立刻返回 true，一次都不睡；
 *   2. 条件后来成立 → 轮询到它成立；
 *   3. 一直不成立 → 到点返回 false（**不抛异常**）。
 */

/** 假的「时钟 + 睡眠」：不真的等，把 sleep 直接推给下一次循环 */
function fakeTime() {
  let now = 0;
  return {
    now: () => now,
    sleep: vi.fn(async (ms: number) => {
      now += ms;
    }),
  };
}

describe("waitFor", () => {
  it("条件本来成立：立刻返回 true，一次都不睡", async () => {
    const sleep = vi.fn(async () => {});
    const check = vi.fn(() => true);
    expect(await waitFor(check, { sleep })).toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("条件后来成立：轮询到它成立就返回，不等满超时", async () => {
    const time = fakeTime();
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 0);
    // 真实定时器 + 真实时钟：第 3 次判定时 ready 已经置位
    let calls = 0;
    const ok = await waitFor(() => (calls += 1) >= 3 && ready, { timeout: 100, interval: 1 });
    expect(ok).toBe(true);
    expect(calls).toBe(3);
    expect(time).toBeDefined();
  });

  it("一直不成立：超时返回 false，不抛异常", async () => {
    const { now, sleep } = fakeTime();
    const check = vi.fn(() => false);
    expect(await waitFor(check, { timeout: 100, interval: 30, now, sleep })).toBe(false);
    // 100ms 预算 / 30ms 一次：0、30、60、90 各判一次，最后一段只睡剩下的 10ms 再判一次到点
    expect(check).toHaveBeenCalledTimes(5);
    expect(sleep).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenLastCalledWith(10);
  });

  it("timeout: 0 = 只判一次，不等待", async () => {
    const sleep = vi.fn(async () => {});
    const check = vi.fn(() => false);
    expect(await waitFor(check, { timeout: 0, sleep })).toBe(false);
    expect(check).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("判据自己抛异常：原样抛出（那是开发者的 bug，吞掉只会让人查不到）", async () => {
    await expect(waitFor(() => {
      throw new Error("check 写错了");
    })).rejects.toThrow("check 写错了");
  });

  it("支持异步判据，也支持取消", async () => {
    expect(await waitFor(async () => true)).toBe(true);
    const controller = new AbortController();
    controller.abort();
    const check = vi.fn(() => false);
    expect(await waitFor(check, { signal: controller.signal })).toBe(false);
    expect(check).not.toHaveBeenCalled();
  });

  it("默认值：2s 超时、30ms 间隔", () => {
    expect(DEFAULT_WAIT_TIMEOUT).toBe(2000);
    expect(DEFAULT_WAIT_INTERVAL).toBe(30);
  });
});
