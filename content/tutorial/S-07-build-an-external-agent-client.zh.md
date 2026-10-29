---
id: S-07
title: "构建外部 Agent 客户端"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 构建外部 Agent 客户端

外部客户端需要循环，而不是提示词技巧。它要取得有效会话、发现当前能力面、选择允许的操作、用新请求 id 调用，并解释协议结果与业务结果。模型可以提出决定，但客户端负责协议交换与人工审批边界。

## 最小状态机

```text
验证身份 → describe → 决定 → invoke → 检查结果
                    ↑                  │
                    └── 新页面 / 重试 ──┘
```

不要在导航、大范围筛选变化或会话范围变化后沿用旧描述。也不要把 HTTP 成功等同于业务成功。

## 客户端骨架

```ts
const surface = createSurfaceClient({ transport });

let description = await surface.describe({ limit: 8 });

const capability = chooseCapability(description, args);
if (!capability) throw new Error("没有匹配的已暴露能力");

const requestId = crypto.randomUUID();
const response = await surface.invoke(capability.id, inputFor(capability, args), { requestId });

if (!response.ok) {
  // 协议 / 会话 / 限流失败：不能宣称业务操作已执行。
  return reportProtocolFailure(response.error);
}

if (response.result && "error" in response.result) {
  // 业务失败：先看稳定错误码，再决定是否重新描述。
  return reportBusinessFailure(response.result.error);
}

// 有 response.after 时使用它；否则下一次决策前重新 describe。
```

具体客户端 API 由传输决定。关键是请求包络，以及把 `ok: false` 与 `result.error` 分开。

## 身份验证

客户端不能接受模型参数中的身份。身份在协议循环之前完成：同页桥使用浏览器会话；网关使用委托 Agent token。Token 应限制能力、可过期、可撤销，不能出现在模型上下文、日志或页面投影中。

若需要真人审批，客户端可以收到 `pending_approval` 或页面宿主提供的 review URL；宿主提供状态工具时可以轮询结果。它不能获得批准函数。审批由页面呈现，并恢复同一请求。

## 工具说明

MCP facade 把 `describe` 能力映射成工具，必须保留：

- 稳定 id 与说明；
- 输入 schema；
- 风险与审批元数据；
- 记录目标约定；
- 有界记录窗口。

不要为了方便 facade 暴露通用 `click` 或 `eval`。不要从 UI 文案合成能力。页面没有声明的操作，不属于外部能力面。

## 处理失败

| 失败 | 客户端行为 |
| --- | --- |
| `ACTION_NOT_FOUND` | 重新 describe；页面可能已变化 |
| `ACTION_UNAVAILABLE` | 报告原因；前置条件改变前不要重试 |
| `INVALID_PARAMS` | 按 schema 修正参数 |
| `EXPECTATION_FAILED` | 重新观察页面再决定 |
| `PERMISSION_DENIED` | 停止；请求真人处理，而不是 Agent 处理 |
| `SESSION_EXPIRED` / `SESSION_REVOKED` | 重新登录或申请新委托 |
| `RATE_LIMITED` | 遵守 `retryAfterMs`，不要空转 |
| `REPLAY_DETECTED` | 只有逻辑上新请求才使用新 id；否则先检查前次结果 |

## 测试客户端

先在确定性页面上测试：成功读取、带 schema 的写入、不可用动作、确认拒绝、会话过期和重复请求 id。再用真实浏览器会话与真人审批测试危险动作。

记录请求 id、协议版本、能力 id、结果和耗时，不记录完整页面投影或 token。一个无法解释自己调用了哪项能力、为什么调用的客户端，还不适合自主工作流。

参见 [Surface 基础](/zh/surface/surface-basics-describe-and-invoke)与 [通过 MCP 接入外部 Agent](/zh/recipes/connect-an-external-agent-through-mcp)。
