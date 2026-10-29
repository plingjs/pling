---
id: REF-14
title: "协议 Schema 与注册表"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 协议 Schema 与注册表

Pling 周围存在几种不同的“schema”。把它们分开，才能避免一个熟悉的词掩盖互不兼容的契约。

| 层次 | 权威来源 | 用途 |
| --- | --- | --- |
| 能力输入 schema | 动作或能力上的 `JsonSchema` | 告诉 Agent 哪些输入字段有效 |
| Surface 传输类型 | `@plingjs/surface` 的 TypeScript 类型 | 精确的 `describe` / `invoke` 包络 |
| 动作注册表 | `@plingjs/core` 的运行时 `Registry` | 当前页面实际能路由的能力 |
| 错误注册表 | 各包的类型联合与冻结映射 | 稳定错误码与 HTTP 映射 |
| 存储 schema | 应用后端 | 委托、连续性、审计与业务数据 |

0.1 仓库没有发布独立的 Surface 包络 JSON Schema 包，也没有公开 schema registry URL。当前权威来源是包内 TypeScript 声明与规范性规范。不能因为能力本身带有 `inputSchema`，就推断存在整套 JSON Schema 包。

## 能力输入 schema

能力使用 `@plingjs/core` 的 `JsonSchema` 类型。它有意保持较小，主要服务于模型工具声明：

```ts
interface JsonSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
}
```

运行时从声明参数生成这个 schema。它不是完整 JSON Schema 文档或校验器。执行器仍会校验值、可用性与业务规则。不能因为请求满足表面形状就认为已获得权限。

### 记录级 schema

`approve@order` 这类折叠能力不会在可见属性中重复 `record`，而是提供记录模板元数据。调用方传入 `input.record`，宿主再拼回具体执行 id。忽略 `record.total`、`record.offscreen` 或模板 id 的校验器，可能接受一个结构上合法、但宿主必须拒绝的调用。

## Surface 传输类型

`@plingjs/surface` 的主要导出包括：

| 类型 | 用途 |
| --- | --- |
| `SURFACE_PROTOCOL` | `"pling.surface/0.1"` |
| `SurfaceMethod` | `"describe" \| "invoke"` |
| `SurfaceDescribeRequest` | Describe 请求包络 |
| `SurfaceInvokeRequest` | Invoke 请求包络 |
| `SurfaceResponse` | 成功或协议失败 |
| `SurfaceDescription` | 能力与有界上下文 |
| `SurfaceCapability` | 单项投影能力 |
| `SurfaceContext` | 页面、区域、记录、状态、反馈与不可用项 |
| `SurfaceObservation` | 调用后的有界变化 |
| `SurfaceFailure` | `ok: false` 协议错误 |
| `SurfaceSession` | 已验证身份、过期、范围与撤销 |
| `SurfaceAuditEvent` | 仅元数据的审计记录 |
| `SurfaceApprovalBinding` | 外部审批后端绑定的不可变字段 |
| `SurfaceApprovalChallenge` | 面向真人的挑战；token 不属于它 |

规范中的 JSON 示例对字段名与含义具有规范性。TypeScript 声明增加编译期约束，但不能替代运行时校验。

## 运行时动作注册表

注册表不是静态协议文档。它由页面构建，并随当前 UI 变化。能力消失可能因为：

- 区域不再活跃；
- 动作变得不可用；
- 站点白名单变化；
- 会话范围变化；
- 弹窗或路由替代了相关声明。

`describe` 返回快照。`invoke` 会重新检查暴露范围，再交给执行器重新检查可用性。永久缓存旧描述是不安全的。

## 错误注册表

### Surface

`SurfaceErrorCode` 包含：

```text
INVALID_REQUEST
PROTOCOL_VERSION_UNSUPPORTED
METHOD_NOT_SUPPORTED
CAPABILITY_NOT_EXPOSED
RATE_LIMITED
RATE_LIMIT_UNAVAILABLE
REPLAY_DETECTED
REPLAY_GUARD_UNAVAILABLE
INTERNAL_ERROR
SESSION_REQUIRED
SESSION_INVALID
SESSION_EXPIRED
SESSION_REVOKED
```

业务执行码是 `@plingjs/core` 的另一个 `ActionErrorCode` 联合，例如 `ACTION_NOT_FOUND`、`ACTION_UNAVAILABLE`、`INVALID_PARAMS`、`PERMISSION_DENIED`、`EXPECTATION_FAILED`、`STEP_FAILED` 与人工接力错误。它们位于成功的 Surface 响应中，因为协议已经到达执行器。

### 委托

`DELEGATION_ERRORS` 是从错误码到 HTTP 状态与默认消息的冻结映射，覆盖请求无效、凭证无效、绑定不匹配、未找到、已撤销、已过期与内部错误。它属于可选委托包，不属于 Surface 线协议。

### 连续性

`ContinuityAuthorityErrorCode` 覆盖任务已存在、未找到、revision 冲突、租约被占用/过期/撤销、owner 不匹配、未授权、存储不可用与状态无效。`@plingjs/continuity-http` 把这些码映射成 HTTP 响应。

### 网关

服务端网关返回 OpenAI 兼容错误体，但使用自己的稳定错误码，例如 `INVALID_JSON`、`MODEL_REQUIRED`、`MODEL_NOT_ALLOWED`、`UNAUTHORIZED`、`PAYLOAD_TOO_LARGE`、`UPSTREAM_TIMEOUT`、`UPSTREAM_RATE_LIMITED` 与 `GATEWAY_MISCONFIGURED`。不能把 Surface 错误码复用于网关故障。

## 兼容规则

- `pling.surface/0.1` 是协商协议版本，不是 npm 包版本；
- 包版本使用 semver，协议版本使用显式字符串；
- 宽容读取方可忽略新增字段，写入方不能假设旧读取方理解它们；
- 删除字段、改变含义、改变错误码类别或强制新方法，都是破坏性协议变化；
- 未知响应字段应忽略；未知的必需请求字段应拒绝；
- 业务错误码与协议错误码必须保持不同命名空间；
- 注册表状态是运行时快照，不是持久配置工件。

## 未发布的工件

本仓库没有发布：

- 根级 `surface.schema.json`；
- 公开 schema registry 服务；
- 自动为全部能力生成的 OpenAPI 或 MCP server 定义；
- 所有可能业务能力的机器可读目录。

如果未来增加这些工件，必须从同一份类型生成，并用同一组夹具测试。手写第二份 schema 会造成本参考页正要避免的漂移。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/surface` `0.1.0-alpha.2` |
| 协议 | `pling.surface/0.1`（Draft） |
| 引入版本 | `0.1.0-alpha.2`（首个发布的 alpha） |
| 运行环境 | 支持 ES2022 模块的浏览器；Node 侧使用需 Node.js 20 或更高版本 |
| Peer 依赖 | 无 |
| 稳定性 | 草案协议；包版本与协议版本独立 |

传输格式的类型与注册表随 `pling.surface/0.1` 版本化；npm 包版本是另一条版本线。当前版本没有发布 schema 工件，因此类型与一致性夹具仍是参考依据。
