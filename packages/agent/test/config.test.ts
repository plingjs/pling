import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_CONFIG,
  DEFAULT_LIMITS,
  DEFAULT_RETRY,
  checkAgentRetry,
  checkAgentLimits,
  compactAt,
  composeSystemPrompt,
  describeAgentConfig,
  describeLimits,
  readAgentConfig,
  readAgentLimits,
  readAgentRetry,
  resolveAgentConfig,
  type AgentConfig,
} from "../src/config";
import { DEFAULT_SYSTEM_PROMPT } from "../src/prompt";

const config = (overrides: Partial<AgentConfig> = {}): AgentConfig => ({
  baseUrl: "https://api.example.com/v1",
  model: "some-model",
  apiKey: "sk-test",
  temperature: 0.3,
  maxTokens: 512,
  systemPrompt: "你好",
  stream: true,
  defaultApproval: "danger",
  minActionIntervalMs: 0,
  retry: { ...DEFAULT_RETRY },
  limits: { ...DEFAULT_LIMITS },
  ...overrides,
});

describe("配置就是一个普通对象 + 一组环境变量", () => {
  it("未标注动作的默认确认策略可配：VITE_AGENT_DEFAULT_APPROVAL", () => {
    expect(readAgentConfig({}).defaultApproval).toBe("danger");
    expect(readAgentConfig({ VITE_AGENT_DEFAULT_APPROVAL: "kind" }).defaultApproval).toBe("kind");
    // 写错一个字不该让应用起不来：退回默认（不打断用户）
    expect(readAgentConfig({ VITE_AGENT_DEFAULT_APPROVAL: "写错了" }).defaultApproval).toBe("danger");
    expect(resolveAgentConfig({ env: { VITE_AGENT_DEFAULT_APPROVAL: "kind" } }).defaultApproval).toBe("kind");
    // 显式传的最优先
    expect(
      resolveAgentConfig({ env: { VITE_AGENT_DEFAULT_APPROVAL: "kind" }, config: { defaultApproval: "kind" } })
        .defaultApproval,
    ).toBe("kind");
  });

  it("每步之间的最小间隔可配：VITE_AGENT_MIN_ACTION_INTERVAL_MS（默认 0 = 不等）", () => {
    expect(readAgentConfig({}).minActionIntervalMs).toBe(0);
    expect(readAgentConfig({ VITE_AGENT_MIN_ACTION_INTERVAL_MS: "600" }).minActionIntervalMs).toBe(600);
    // 写错 / 负数都当成 0：不该变成「等一个负数」，也不该让应用起不来
    expect(readAgentConfig({ VITE_AGENT_MIN_ACTION_INTERVAL_MS: "写错了" }).minActionIntervalMs).toBe(0);
    expect(readAgentConfig({ VITE_AGENT_MIN_ACTION_INTERVAL_MS: "-100" }).minActionIntervalMs).toBe(0);
    // 三层合并照旧：显式传的最优先
    expect(
      resolveAgentConfig({ env: { VITE_AGENT_MIN_ACTION_INTERVAL_MS: "600" }, config: { minActionIntervalMs: 200 } })
        .minActionIntervalMs,
    ).toBe(200);
  });

  it("默认配置故意留空 baseUrl / model：框架不替应用假定用哪家模型", () => {
    expect(DEFAULT_AGENT_CONFIG.baseUrl).toBe("");
    expect(DEFAULT_AGENT_CONFIG.model).toBe("");
    expect(DEFAULT_AGENT_CONFIG.limits).toEqual(DEFAULT_LIMITS);
  });

  it("从环境变量读：填了就按填的来，空串 / 空格 / 乱填都当没给", () => {
    const env = {
      VITE_AGENT_BASE_URL: " https://api.deepseek.com/v1 ",
      VITE_AGENT_MODEL: "deepseek-chat",
      VITE_AGENT_API_KEY: "sk-x",
      VITE_AGENT_TEMPERATURE: "0.7",
      VITE_AGENT_MAX_TOKENS: "2048",
      VITE_AGENT_STREAM: "false",
      VITE_AGENT_SYSTEM_PROMPT: "你是这个应用里的助手",
    };
    expect(readAgentConfig(env)).toMatchObject({
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "sk-x",
      temperature: 0.7,
      maxTokens: 2048,
      stream: false,
      systemPrompt: "你是这个应用里的助手",
    });

    expect(readAgentConfig({ VITE_AGENT_BASE_URL: "   " }).baseUrl).toBe("");
    expect(readAgentConfig({ VITE_AGENT_TEMPERATURE: "abc" }).temperature).toBe(0.3);
    expect(readAgentConfig({ VITE_AGENT_STREAM: "也许" }).stream).toBe(true);
  });

  it("三层合并：默认值 ← 环境变量 ← 显式传的（显式传的只覆盖给了的字段）", () => {
    const merged = resolveAgentConfig({
      env: { VITE_AGENT_BASE_URL: "/llm/v1", VITE_AGENT_MODEL: "from-env", VITE_AGENT_MAX_TURNS: "3" },
      config: { model: "explicit", limits: { keepRecent: 2 } },
    });

    expect(merged.baseUrl).toBe("/llm/v1");
    expect(merged.model).toBe("explicit");
    expect(merged.limits.maxTurns).toBe(3); // 没被显式覆盖 → 用环境变量
    expect(merged.limits.keepRecent).toBe(2);
    expect(merged.stream).toBe(true); // 谁都没给 → 框架默认
  });
});

describe("配置能不能用：不静默失败", () => {
  it("缺什么就说缺什么，并且告诉你去哪儿补", () => {
    const missingBase = describeAgentConfig(config({ baseUrl: "" }));
    expect(missingBase).toMatchObject({
      ready: false,
      code: "MODEL_BASE_URL_MISSING",
      params: { env: "VITE_AGENT_BASE_URL" },
    });
    expect(missingBase.hint).toContain("VITE_AGENT_BASE_URL");

    const missingModel = describeAgentConfig(config({ model: "" }));
    expect(missingModel).toMatchObject({
      code: "MODEL_NAME_MISSING",
      params: { env: "VITE_AGENT_MODEL" },
    });

    const missingKey = describeAgentConfig(config({ apiKey: "" }));
    expect(missingKey).toMatchObject({
      code: "MODEL_API_KEY_MISSING",
      params: { env: "VITE_AGENT_API_KEY", baseUrl: "https://api.example.com/v1" },
    });
    for (const broken of [config({ baseUrl: "" }), config({ model: "" }), config({ apiKey: "" })]) {
      expect(describeAgentConfig(broken).hint).toContain(".env.local");
    }
  });

  it("走相对路径（dev server 代理 / 将来的薄 Node 层）时不需要 apiKey", () => {
    expect(describeAgentConfig(config({ baseUrl: "/llm/v1", apiKey: "" }))).toEqual({ ready: true, hint: "" });
  });

  it("齐了就是 ready；提示文案可以换成应用自己的（比如指向自己的配置文件）", () => {
    expect(describeAgentConfig(config())).toEqual({ ready: true, hint: "" });
    expect(describeAgentConfig(config({ baseUrl: "" }), { fixHint: "去看 README" }).hint).toContain("去看 README");
  });

  it("注入了模型就不要求 baseUrl / apiKey（脚本模型 / 自己的薄 Node 层 / 无网络演示）", () => {
    const bare = { baseUrl: "", model: "", apiKey: "" };
    expect(describeAgentConfig(config(bare), { hasLlm: true })).toEqual({ ready: true, hint: "" });
    // 没注入时该报的还是要报（别把这个开关变成「什么都放行」）
    expect(describeAgentConfig(config(bare)).ready).toBe(false);
    // 限额校验不受影响
    const broken = describeAgentConfig(config({ ...bare, limits: { ...DEFAULT_LIMITS, maxTurns: 0 } }), { hasLlm: true });
    expect(broken).toMatchObject({ ready: false, code: "LIMITS_INVALID" });
    expect(broken.hint).toContain("VITE_AGENT_MAX_TURNS");
  });
});

describe("限额：五个数字，全部可配", () => {
  it("不填就是框架默认值", () => {
    expect(readAgentLimits({})).toEqual(DEFAULT_LIMITS);
  });

  it("填了就按填的来", () => {
    expect(
      readAgentLimits({
        VITE_AGENT_MAX_TURNS: "3",
        VITE_AGENT_CONTEXT_TOKENS: " 4096 ",
        VITE_AGENT_RESERVE_FOR_OUTPUT: "512",
        VITE_AGENT_COMPACT_RATIO: "0.5",
        VITE_AGENT_KEEP_RECENT: "2",
      }),
    ).toEqual({ maxTurns: 3, contextTokens: 4096, reserveForOutput: 512, compactRatio: 0.5, keepRecent: 2 });
    expect(readAgentLimits({ VITE_AGENT_MAX_TURNS: "abc" }).maxTurns).toBe(10);
  });

  it("压缩水位 = (预算 − 预留) × 比例，默认 5734", () => {
    expect(compactAt(DEFAULT_LIMITS)).toBe(5734);
    expect(compactAt({ ...DEFAULT_LIMITS, contextTokens: 4096, reserveForOutput: 512, compactRatio: 0.5 })).toBe(1792);
  });

  it("生效值能说成一句话，给面板挂着", () => {
    expect(describeLimits(DEFAULT_LIMITS)).toBe(
      "上下文 8192 · 预留输出 1024 · 约 5734 起压缩 · 压缩后留 6 条 · 每次最多 10 轮",
    );
  });

  it("填错了当场指出来（压缩逻辑会跑成怪样子，不能等出问题才发现）", () => {
    expect(checkAgentLimits(DEFAULT_LIMITS)).toEqual([]);
    expect(checkAgentLimits({ ...DEFAULT_LIMITS, compactRatio: 5 }).join()).toContain("VITE_AGENT_COMPACT_RATIO");
    expect(checkAgentLimits({ ...DEFAULT_LIMITS, maxTurns: 0 }).join()).toContain("VITE_AGENT_MAX_TURNS");
    expect(checkAgentLimits({ ...DEFAULT_LIMITS, maxTurns: 1.5 }).join()).toContain("VITE_AGENT_MAX_TURNS");
    expect(checkAgentLimits({ ...DEFAULT_LIMITS, keepRecent: -1 }).join()).toContain("VITE_AGENT_KEEP_RECENT");
    expect(checkAgentLimits({ ...DEFAULT_LIMITS, contextTokens: 2048, reserveForOutput: 2048 }).join()).toContain(
      "至少要留 1024",
    );
  });

  it("限额不对时整份配置算不可用，hint 里点名是哪个变量", () => {
    const readiness = describeAgentConfig(config({ limits: { ...DEFAULT_LIMITS, maxTurns: 0 } }));
    expect(readiness.ready).toBe(false);
    expect(readiness.hint).toContain("VITE_AGENT_MAX_TURNS");
  });
});

describe("重试预算：默认保守，显式可配", () => {
  it("不填就是框架默认值，三层合并支持只改一个字段", () => {
    expect(readAgentRetry({})).toEqual(DEFAULT_RETRY);
    expect(
      readAgentRetry({
        VITE_AGENT_MAX_RETRIES: "1",
        VITE_AGENT_RETRY_BASE_DELAY_MS: "100",
        VITE_AGENT_RETRY_MAX_DELAY_MS: "800",
      }),
    ).toEqual({ maxRetries: 1, baseDelayMs: 100, maxDelayMs: 800 });
    expect(readAgentConfig({ VITE_AGENT_MAX_RETRIES: "2" }).retry.maxRetries).toBe(2);
    expect(
      resolveAgentConfig({
        env: { VITE_AGENT_MAX_RETRIES: "2", VITE_AGENT_RETRY_BASE_DELAY_MS: "300" },
        config: { retry: { baseDelayMs: 50 } },
      }).retry,
    ).toEqual({ maxRetries: 2, baseDelayMs: 50, maxDelayMs: 4000 });
  });

  it("写错当场指出来；不会把负数退避带进运行时", () => {
    expect(checkAgentRetry(DEFAULT_RETRY)).toEqual([]);
    expect(checkAgentRetry({ ...DEFAULT_RETRY, maxRetries: 6 }).join()).toContain("VITE_AGENT_MAX_RETRIES");
    expect(checkAgentRetry({ ...DEFAULT_RETRY, baseDelayMs: -1 }).join()).toContain(
      "VITE_AGENT_RETRY_BASE_DELAY_MS",
    );
    expect(
      checkAgentRetry({ ...DEFAULT_RETRY, baseDelayMs: 500, maxDelayMs: 100 }).join(),
    ).toContain("VITE_AGENT_RETRY_MAX_DELAY_MS");

    const readiness = describeAgentConfig(config({ retry: { ...DEFAULT_RETRY, maxRetries: -1 } }));
    expect(readiness).toMatchObject({ ready: false, code: "RETRY_INVALID" });
    expect(readiness.hint).toContain("重试配置有问题");
  });
});

describe("系统提示：应用的角色说明是「追加」，不是「替换」", () => {
  it("留空就用框架规则；填了就接在后面，框架规则一个字不少", () => {
    expect(composeSystemPrompt("")).toBe(DEFAULT_SYSTEM_PROMPT);
    expect(composeSystemPrompt("   ")).toBe(DEFAULT_SYSTEM_PROMPT);

    const composed = composeSystemPrompt("你是这个 Todo 应用里的助手。");
    expect(composed.startsWith(DEFAULT_SYSTEM_PROMPT)).toBe(true);
    expect(composed).toContain("## This application");
    expect(composed).toContain("你是这个 Todo 应用里的助手。");
  });
});
