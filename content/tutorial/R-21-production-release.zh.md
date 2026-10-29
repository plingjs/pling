---
id: R-21
title: "生产上线"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 生产上线

助手在预览环境能跑，不代表可以上线。差别往往不在聊天面板，而在开发时为了方便打开的那些条件：客户端里放了供应商密钥、模型可以随意选、循环没有上限、来源允许全部、遥测没有投递端点，也没有关闭功能的方法。

本章给 React Todo 示例增加一道可执行的发布预检。预检在切换流量前检查部署配置，但它不能代替网关、审计系统或线上健康检查。

## 把发布条件写成可执行代码

示例把发布配置与页面动作分开：

```ts
export interface ReleaseConfig {
  environment: "preview" | "production";
  gatewayUrl: string;
  browserApiKey: string;
  modelPolicy: { mode: "pinned" | "allowlist"; models: string[] };
  appOrigin: string;
  allowedOrigins: string[];
  maxTurns: number;
  contextTokens: number;
  telemetryEndpoint: string;
  killSwitchUrl: string;
}

const review = evaluateRelease(config, locale);
```

示例里的 `config` 是页面内置的预览值，模型和网关地址只用于展示检查结果，并不会切换真实模型流量。真实项目应在构建或部署时注入这份配置，不要把生产策略放在用户可编辑的前端状态里。

`evaluateRelease` 返回一组 `pass`、`warn` 或 `fail` 的检查。任何一项失败都会让 `ready` 为 false。部署流水线应当因此以非零状态退出；只把结果渲染在页面上，无法阻止发布。

示例把检查放在 `src/release.ts`，页面只负责展示结果。流水线需要自己读取 `ready` 并决定退出码，例如：

```ts
const review = evaluateRelease(config, locale);
if (!review.ready) {
  for (const check of review.checks.filter((item) => item.status === "fail")) {
    console.error(`${check.id}: ${check.detail}`);
  }
  process.exit(1);
}
```

这是一道静态预检。它能确认网关地址是 HTTPS、浏览器密钥字段为空、模型白名单非空；它不能证明远端网关、遥测收集器或停用端点此刻可达。后者需要真实请求和健康探测。

## 检查的是证据，不是布尔声明

示例检查八项：

| 检查 id | 需要的证据 |
| --- | --- |
| `gateway_tls` | 网关使用 HTTPS；仅预览允许本机回环 HTTP |
| `browser_key` | `browserApiKey` 为空 |
| `model_policy` | 一个固定模型，或不含通配符的模型白名单 |
| `turn_budget` | `maxTurns` 为正数；生产配置不超过 20，预览配置不超过 100 |
| `context_budget` | 明确声明 2,048 到 128,000 token 之间的上下文窗口 |
| `telemetry` | 有合法的 HTTP(S) 遥测端点 |
| `origin_allowlist` | 包含应用来源，且没有 `*` |
| `kill_switch` | 配置了不必重发前端就能关闭助手的 HTTP(S) 地址；实际可达性仍需单独验证 |

这些检查刻意保持有限。它们用于拦住容易犯、也容易评审的配置错误，不代替网关自己的模型策略、限流、鉴权或审计。

`previewConfig` 使用 `maxTurns: 100`，因为教程演示允许更多轮。`productionConfig` 使用 `10`。不要因为演示看起来更顺，就把演示预算复制到生产。

## 发布控制不进入动作面

发布面板带有 `data-pling-ignore`，覆盖率扫描不会把它里面的控件当作未声明的页面能力。更重要的是，这个面板里没有任何发布动作。

动作列表里只有 Todo 控件和只读的 `release_status`。没有“更换模型”“开放来源”或“关闭停用开关”。用户可以让助手解释发布为什么被阻断，助手可以报告失败的检查 id；它不能批准或修改发布。

发布控制应放在部署流水线、独立管理端或带自身授权检查的内部 API 后面。仅仅因为页面能渲染这些控件，就把它们做成浏览器动作，是授权设计上的错误。

`.env.local` 只适合在本机接入一个受限的开发模型。`VITE_*` 变量会被打进浏览器产物，生产供应商密钥必须留在网关；本章示例的 `previewConfig` 也只是静态配置，页面不会用它替换实际的模型客户端。

## 预检之后还要观察真实请求

切换流量前，用真实请求验证整条链路：

```text
request → gateway auth → model allowlist → upstream timeout → response
                 │              │                 │
                 └─ audit user  └─ audit model    └─ retry exhausted / request id
```

至少记录：

- 按状态码分组的请求量与失败率；
- 模型延迟与 token 消耗；
- 工具错误码，尤其是 `ACTION_NOT_FOUND`、`INVALID_ARGS`、`STEP_FAILED`；
- 每个会话使用的轮数与耗尽的重试；
- 当前发布版本和提示词版本。

浏览器应当显示稳定错误码和请求 id。运维人员应能凭它找到对应审计记录，而不必翻聊天内容。

## 分阶段放量

第一次上线不应是“全部用户、全部页面”。更稳妥的起点是：

1. 一个页面、一组能力；
2. 指定用户组或内部流量；
3. 比稳定期预期更低的预算与轮数上限；
4. 一个只关闭助手、不影响业务页面的停用开关；
5. 一条不依赖模型供应商的回滚路径。

观察任务完成率、放弃率、工具错误和每个成功任务的成本。一个看起来很惊艳、但工具错误率很高的页面，还没有到发布条件。

## 运行示例

运行英文示例：

```bash
pnpm tutorial:dev r-21
```

打开 `http://127.0.0.1:5261/`。运行中文示例：

```bash
pnpm tutorial:dev r-21 --locale zh
```

打开 `http://127.0.0.1:5261/?lang=zh`。源码位于 `examples/tutorials/r-21-production-release`。

Todo 列表正常使用，发布面板展示每项检查、证据和原因。发布控制刻意不在 Agent 动作列表里。

确定性检查：

```bash
pnpm tutorial:check r-21
```

测试验证生产配置通过、不安全配置会因预期原因失败，以及 Agent 能看到的 `release_*` 动作只有只读的 `release_status`。

## 常见问题

**为了让演示更顺而关闭限额。** 生产循环需要预算。教程里的 `maxTurns: 100` 明确是演示值，不是生产默认值。

**让 Agent 控制发布门禁。** 如果助手能修改自己的限额、模型或停用开关，门禁只是摆设。这些控制必须放在 Agent 动作之外。

**没有回滚就发布。** 需要重新发前端才能关闭的“停用开关”不是回滚。应提前确定如何关闭功能，以及关闭后业务页面如何运行。

**只看 HTTP 200。** 模型请求可以成功，但所有工具调用都失败。需要同时观测动作与业务结果，而不只是传输状态。

**把预检当成运行状态证明。** 配置可以通过，但网关或遥测端点可能已经不可达。要在流水线里保留预检，同时运行真实探测。

**把发布清单当作文档。** 要在测试和部署流水线里执行它。文档无法阻止发布，失败的检查可以。
