import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker, LlmError, backoffDelay, errorFromStatus, isAborted, isRetryable, withRetry } from "../src/retry";

describe("错误分类：哪些值得重试", () => {
  it("408 / 425 / 429 / 5xx 可重试，400 / 401 不可重试", () => {
    expect(errorFromStatus(408, "timeout").retryable).toBe(true);
    expect(errorFromStatus(425, "too early").retryable).toBe(true);
    expect(errorFromStatus(429, "rate limited").retryable).toBe(true);
    expect(errorFromStatus(501, "not implemented").retryable).toBe(true);
    expect(errorFromStatus(503, "boom").retryable).toBe(true);
    expect(errorFromStatus(599, "upstream").retryable).toBe(true);
    expect(errorFromStatus(400, "bad params").retryable).toBe(false);
    expect(errorFromStatus(401, "bad key").retryable).toBe(false);
  });

  it("确定性错误直接说下一步查哪里", () => {
    expect(errorFromStatus(401, "bad key").message).toContain("API key");
    expect(errorFromStatus(403, "forbidden").message).toContain("权限");
    expect(errorFromStatus(404, "missing").message).toContain("baseUrl");
  });

  it("网络层 TypeError 视为可重试", () => {
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryable(new LlmError("坏参数", { retryable: false }))).toBe(false);
  });

  it("识别统一错误体的 retryable / retryExhausted", () => {
    const no = errorFromStatus(503, JSON.stringify({ error: { retryable: false } }));
    expect(no.retryable).toBe(false);

    const exhausted = errorFromStatus(
      504,
      JSON.stringify({ error: { retryable: true, retryExhausted: true } }),
    );
    expect(exhausted.retryable).toBe(false);
    expect(exhausted.retryExhausted).toBe(true);

    const downgradeOnly = errorFromStatus(400, JSON.stringify({ error: { retryable: true } }));
    expect(downgradeOnly.retryable).toBe(false);
  });
});

describe("重试 + 退避", () => {
  it("可重试错误：退避后重试并成功", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const onRetry = vi.fn();
    let attempts = 0;
    const fn = withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) throw errorFromStatus(429, "慢点");
        return "ok";
      },
      { maxRetries: 3, baseDelayMs: 100, sleep, onRetry, },
    );

    expect(await fn()).toBe("ok");
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("不可重试错误：一次就抛，不浪费时间", async () => {
    const sleep = vi.fn(async () => {});
    const fn = withRetry(async () => { throw errorFromStatus(400, "参数错"); }, { sleep });
    await expect(fn()).rejects.toThrow(/400/);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("网关已耗尽重试：客户端只调用一次，不再放大预算", async () => {
    const sleep = vi.fn(async () => {});
    let attempts = 0;
    const fn = withRetry(
      async () => {
        attempts += 1;
        throw errorFromStatus(
          504,
          JSON.stringify({ error: { retryable: true, retryExhausted: true } }),
        );
      },
      { maxRetries: 3, baseDelayMs: 0, sleep },
    );

    await expect(fn()).rejects.toMatchObject({ retryExhausted: true, retryable: false });
    expect(attempts).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("本层预算耗尽：错误被标记 retryExhausted，上层不会再次重试", async () => {
    const sleep = vi.fn(async () => {});
    let attempts = 0;
    const fn = withRetry(
      async () => {
        attempts += 1;
        throw errorFromStatus(504, "still down");
      },
      { maxRetries: 1, baseDelayMs: 0, sleep },
    );

    const error = await fn().catch((caught: unknown) => caught);
    expect(error).toMatchObject({ retryExhausted: true });
    expect(isRetryable(error)).toBe(false);
    expect(attempts).toBe(2);
  });

  it("退避带 jitter，落在 [50%, 100%] 区间内", () => {
    expect(backoffDelay(1, 1000, () => 0)).toBe(500);
    expect(backoffDelay(1, 1000, () => 1)).toBe(1000);
    expect(backoffDelay(3, 1000, () => 1)).toBe(4000);
  });

  it("单次退避受 maxDelayMs 约束", async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    let attempts = 0;
    const fn = withRetry(
      async () => {
        attempts += 1;
        throw errorFromStatus(503, "busy");
      },
      { maxRetries: 2, baseDelayMs: 1_000, maxDelayMs: 300, sleep },
    );

    await expect(fn()).rejects.toBeInstanceOf(LlmError);
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    for (const call of sleep.mock.calls) expect(call[0]).toBe(300);
  });
});

describe("熔断器三态", () => {
  it("连续失败到阈值 → open；冷却结束 → half_open；成功 → closed", () => {
    let clock = 0;
    const breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1000, now: () => clock });

    for (let i = 0; i < 3; i++) breaker.onFailure();
    expect(breaker.state).toBe("open");
    expect(breaker.beforeCall()).toBe(false); // 短路中

    clock = 1000;
    expect(breaker.beforeCall()).toBe(true); // 半开试探
    expect(breaker.state).toBe("half_open");

    breaker.onSuccess();
    expect(breaker.state).toBe("closed");
  });

  it("半开时再失败 → 立刻回到 open", () => {
    let clock = 0;
    const breaker = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 100, now: () => clock });
    breaker.onFailure();
    breaker.onFailure();
    clock = 100;
    breaker.beforeCall();
    breaker.onFailure();
    expect(breaker.state).toBe("open");
  });

  it("熔断打开时连底层函数都不会被调用", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    const base = vi.fn(async () => "ok");
    const fn = withRetry(base, { breaker, maxRetries: 0 });

    breaker.onFailure(); // 打开
    await expect(fn()).rejects.toThrow(/熔断/);
    expect(base).not.toHaveBeenCalled();
  });
});

describe("取消：不是故障，别按故障处理", () => {
  it("认得出「被取消」的两种长相：自己的错误类型，和各家的 AbortError", () => {
    expect(isAborted(new LlmError("已取消", { aborted: true }))).toBe(true);
    expect(isAborted(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isAborted(new TypeError("fetch failed"))).toBe(false);
  });

  it("取消永远不重试（重试也会被立刻再取消一次，只是白等）", async () => {
    const sleep = vi.fn(async () => {});
    let attempts = 0;
    const fn = withRetry(
      async () => {
        attempts += 1;
        throw new LlmError("已取消", { aborted: true });
      },
      { maxRetries: 3, baseDelayMs: 10, sleep },
    );

    await expect(fn()).rejects.toMatchObject({ aborted: true });
    expect(attempts).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("取消不该把熔断器打开（否则用户点几次停止就把模型「熔断」了）", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 });
    const fn = withRetry(
      async () => {
        throw new LlmError("已取消", { aborted: true });
      },
      { breaker, maxRetries: 0 },
    );

    await expect(fn()).rejects.toMatchObject({ aborted: true });
    expect(breaker.state).toBe("closed");
  });
});
