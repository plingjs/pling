---
id: SITE-06
title: "发布、支持矩阵与升级"
locale: zh
source_locale: en
translation_status: reviewed
status: reviewed
---

# 发布、支持矩阵与升级

Pling 的软件包使用语义化版本，Surface 能力协议使用独立版本字符串。一次包发布可以只包含修复而不改变 `pling.surface/0.1`；一次协议变更即使没有 npm 依赖变化，也可能影响独立实现。

升级时先分清这两条版本线，再决定改动范围。

## 当前发布线

当前所有公开包处于 `0.1.0-alpha.3`。这是 alpha 线：API 可能变化，只为最新发布的 alpha 提供安全修复。包已发布或示例能运行，不代表已经适合生产。

| 包 | 职责 | 当前版本线 |
| --- | --- | --- |
| `@plingjs/core` | 注册表、执行、策略与结果原语 | `0.1.0-alpha.3` |
| `@plingjs/dom` | DOM 定位、投影、滚动与浏览器原语 | `0.1.0-alpha.3` |
| `@plingjs/agent` | 循环、上下文、工具与连续性契约 | `0.1.0-alpha.3` |
| `@plingjs/surface` | Agent Surface 投影与 `describe` / `invoke` | `0.1.0-alpha.3` |
| `@plingjs/surface-browser` | 页面侧 Surface 会话、WebSocket、桥接与重连 | `0.1.0-alpha.3` |
| `@plingjs/delegation` | 可选委托凭证生命周期 | `0.1.0-alpha.3` |
| `@plingjs/continuity-http` | 可选远程连续性 HTTP 集成 | `0.1.0-alpha.3` |
| `@plingjs/server` | OpenAI 兼容模型网关 | `0.1.0-alpha.3` |
| `@plingjs/ui` | 适配器共享的界面组件与样式 | `0.1.0-alpha.3` |
| `@plingjs/vue` | Vue 3 适配器 | `0.1.0-alpha.3` |
| `@plingjs/react` | React 适配器 | `0.1.0-alpha.3` |
| `@plingjs/vanilla` | 无框架 DOM 适配器 | `0.1.0-alpha.3` |
| `@plingjs/vue2` | Vue 2.7 适配器 | `0.1.0-alpha.3` |

本站记录的协议是 `pling.surface/0.1`，仍为公开草案。`0.1` 只定义 `describe` 与 `invoke`，不承诺 `attach`、`observe`、`handoff`、`detach` 或强制传输。

## 支持矩阵

| 环境 | 支持范围 | 实际边界 |
| --- | --- | --- |
| Vue 3 | peer 依赖 `^3`；文档面向 3.4+ | 示例使用对象形式 `v-bind` 与组合式 API |
| React | peer 依赖 `>=18` | 示例使用 React 19；不对其他旧主版本作兼容承诺 |
| Vue 2 | `@plingjs/vue2` 仅支持 `^2.7.0`；2.6 及更早可使用 `@plingjs/vanilla` 手动接入 | 2.6 及更早版本缺少状态辅助函数需要的组合式 API，没有指令与自动清理 |
| 原生 JS | 无框架 peer 依赖 | 仍需要 DOM 与现代浏览器 API |
| Node | 仓库开发与网关示例要求 20+ | 这不是对无关应用服务端的限制 |

浏览器支持不是认证清单。仓库测试运行在 `jsdom`，示例面向当前常青浏览器。依赖 Shadow DOM、iframe 访问、Web Crypto、`EventSource` 或 Web Locks 的能力会继承平台限制。上线前应在真实浏览器矩阵中测试，尤其是嵌入式 webview 与较旧的企业客户端。

## 版本与兼容策略

- 补丁版本应保持已记录的 API 与协议行为。
- 次版本可以增加能力、选项或字段。
- `0.x` 阶段若保留已知的安全或正确性缺陷，次版本仍可能包含有记录的破坏性变更。
- 破坏协议的变更必须使用新协议版本并提供迁移说明，不能藏在补丁说明里。
- 弃用 API 至少保留一个次版本，除非它正在造成主动风险。
- 安全修复可能只回移到最新 alpha；`0.1` 没有长期支持承诺。

## 升级步骤

1. 阅读 changelog，分别比较包版本与协议版本。
2. 更新 lockfile，并把全部 `@plingjs/*` 一起升级，避免适配器与内核混用不兼容版本。
3. 运行 `pnpm check`、`pnpm typecheck` 与相关包测试。
4. 运行对应框架示例和自己的能力回归测试。
5. 演练会话过期、凭证撤销与旧记录动作。
6. 传输变化后检查网关请求体、超时与重试预算。
7. 通过功能开关上线，先比较审计结果，再扩大暴露范围。

渐进发布时，可以先让新构建在旧能力范围下观察只读能力。不要把扩大写入或危险能力与升级放在同一步。

## 已知不兼容与限制

- `@plingjs/vue2` 不支持 Vue 2.6 及更早版本；这类项目可改用 `@plingjs/vanilla` 手动接入。
- `0.1` 协议没有通用 DOM 选择器或 JavaScript 执行逃逸口。
- 跨域 iframe 运行时不作为内存对象共享，必须使用显式传输。
- 参考委托与连续性包不提供生产数据库、Redis、SSO 或完整审计归档。
- `*/testing` 入口中的内存适配器只用于测试与本地参考。
- `surface.plingjs.dev` 是官方演示端点，不是多租户客户网关。
- 当前没有公开的第三方 Surface 一致性套件或认证标识。

## 发布记录

每次发布说明应列明包版本、协议版本、commit 或制品标识、测试命令、迁移影响与已知限制。基准或评测声明必须指向冻结任务集与记录模型，不能推广到所有站点或服务商。

完整文档索引见[文档索引](/zh/roadmap)，升级操作见[安全升级 Pling](/zh/operations/upgrade-pling-safely)。
