import { describe, expect, it, vi } from "vitest";
import type { LlmMessage } from "@plingjs/core";
import { createLlmChain } from "../src/chain";
import { errorFromStatus } from "../src/retry";
import { Telemetry } from "../src/telemetry";

const messages: LlmMessage[] = [{ role: "user", content: "abcd" }];

describe("LLM 调用链（装饰器装配）", () => {
  it("观测：每次调用记 token / 耗时 / 成败", async () => {
    const telemetry = new Telemetry();
    const chain = createLlmChain({
      base: async () => ({ content: "应答", toolCalls: [{ id: "c1", name: "a", arguments: '{"x":1}' }] }),
      model: "deepseek-chat",
      telemetry,
      now: () => 1000,
    });

    const result = await chain.llm(messages, []);

    expect(result.content).toBe("应答");
    const summary = telemetry.summary();
    expect(summary.llmCalls).toBe(1);
    expect(summary.promptTokens).toBe(4 + 1); // system 开销 4 + "abcd"
    expect(summary.completionTokens).toBeGreaterThan(0);
    expect(summary.llmErrorRate).toBe(0);
    expect(summary.estimatedCostYuan).toBeGreaterThan(0); // 单次调用也要看得见（精度到 1e-6 元）
    expect(telemetry.estimateCost("deepseek-chat", 1_000_000, 0)).toBe(1); // 口径：元/百万 token
  });

  it("失败也记一条（ok=false），错误继续往上抛给循环", async () => {
    const telemetry = new Telemetry();
    const chain = createLlmChain({
      base: async () => {
        throw errorFromStatus(401, "bad key");
      },
      model: "m",
      telemetry,
    });

    await expect(chain.llm(messages, [])).rejects.toThrow(/401/);
    expect(telemetry.summary().llmErrorRate).toBe(1);
  });

  it("重试会被记成 retry 事件（可观测「这个月被限流了几次」）", async () => {
    const telemetry = new Telemetry();
    let attempts = 0;
    const chain = createLlmChain({
      base: async () => {
        attempts += 1;
        if (attempts === 1) throw errorFromStatus(429, "rate limited");
        return { content: "ok" };
      },
      model: "m",
      telemetry,
      sleep: async () => {},
    });

    await chain.llm(messages, []);
    expect(telemetry.summary().retries).toBe(1);
    expect(telemetry.events.filter((event) => event.type === "retry")).toHaveLength(1);
  });

  it("熔断状态可以从链上取出来（面板要展示它）", async () => {
    const telemetry = new Telemetry();
    const chain = createLlmChain({
      base: async () => { throw errorFromStatus(400, "bad"); },
      model: "m",
      telemetry,
      maxRetries: 0,
    });
    await chain.llm(messages, []).catch(() => undefined);
    expect(chain.breaker.state).toBe("closed"); // 单次失败不熔断
  });
});
