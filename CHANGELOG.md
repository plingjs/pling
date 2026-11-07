# Changelog

Pling 使用[语义化版本](https://semver.org/lang/zh-CN/)。`0.x` 阶段 API 仍可能调整，
每次影响接入方式的变更都会记录在这里，并同步到 `website/releases/index.md` 的版本策略。

## [0.1.0-alpha.6] — 2026-11-07

- 新增任务层：`TaskDefinition`、`TaskRun`、任务目录、引用 / lookup、人类可读动作文案，
  以及把任务从固定脚本降级为“目标 + 约束 + 工作记忆”的运行时。
- Vue、React 与原生 JS 新增引导式任务卡、任务面板和跨框架一致的引导命令处理；
  Surface 同步提供任务说明、playbook、风险与示例，外部 Agent 可复用页面声明的能力。
- 新增共享的紧凑操作行 `createGuideActions()` / `AgentGuideActions`：长推荐值不再撑宽按钮，
  改为短动作加单行省略预览，完整内容保留在聊天正文、`title` 与 `aria-label`。
- 新增 V3-25、R-25、J-15、V2-09、REF-15、C-15 等中英文教程，并补齐任务 API、lookup、
  人类可读层、API / UI 双执行与 Surface 任务的来龙去脉。
- 新增案例 06「引导任务创建课程」，同步 Vue 3、React、React 16、Vue 2.7 与原生 JS
  课程工作台；经典案例入口、API 索引、示例清单和机器可读文档同步更新。

## [0.1.0-alpha.5] — 2026-11-03

- `@plingjs/react` 新增 React 16.3–16.7 兼容入口，React 16.3 与 16.8+
  分别通过 legacy 与 hooks 入口接入；发布包冒烟同时覆盖两套入口。
- Vue 3、React 与原生 JS 的助手停靠区新增 `overlay` / `fused` 布局模式，
  教程侧栏可以用融合模式占位，而不是覆盖业务页面。
- 修复 Vue 3 与 React 深层路由直达、刷新和返回列表时的语言参数保留；
  文档补充前端路由与服务端回退要求。
- 全部教程 Demo 默认开启调试记录（`maxCalls: 8`），并统一修正中英文文案、
  审批与人工接力、异步流程、目标高亮和示例卡布局。
- 新增 React 16.3 可运行 Todo 示例，补齐各框架的路由、助手表面、反馈、
  确认与流程章节夹具，同步 API 索引与机器可读文档。

## [0.1.0-alpha.4] — 2026-10-30

- 14 个公开包统一更新 npm 包级英文描述，修正首次发布时遗留的中文元数据与
  `@plingjs/surface-browser` 占位描述。
- 本版只调整发布元数据，包 API、协议与运行时行为与 `0.1.0-alpha.3` 一致。

## [0.1.0-alpha.3] — 2026-10-30

- 新增 `@plingjs/surface-browser`：把页面侧 Surface 会话、WebSocket 传输、`describe` / `invoke`
  桥接、审批转发、配对、重连与卸载清理收敛为一个浏览器运行时包。
- Vue 3 新增 `useSurfaceGateway()` 与 `SurfaceAccessPanel`，接入方不再手写页面会话、socket、
  bridge、配对码和撤销流程；能力声明与 `expose` 白名单仍由应用显式提供。
- 新增 `@plingjs/surface-gateway`：多租户页面会话、一次性配对、Agent token、MCP 端点、
  scope 收缩、TTL、撤销、审批状态转发与审计回调的 Node 参考实现。默认绑定 loopback、
  不信任伪造的 `X-Forwarded-For`，页面过期会撤销其全部 Agent 会话；生产所需持久化、
  分布式限流与租户级管理凭证仍需接入方提供。
- 带登录的 Todo Surface 案例改用 BFF 页面会话和 `useSurfaceGateway()`；浏览器仍不接触
  Surface admin token，破坏性动作仍由页面确认。
- 13 个公开包统一升级到 `0.1.0-alpha.3`；npm README 改为英文，并链接到
  `https://plingjs.dev` 的当前文档。

## [0.1.0-alpha.2] — 2026-10-29

首个可发布 alpha 的工作版本，当前包含：

- 发布前守卫：统一版本、许可证、仓库元数据、内部依赖与 CI 包名检查。
- 许可证切换为 Apache-2.0，并随发布包携带 NOTICE。
- Tarball 冒烟：验证只发布 `dist/`、不泄漏 `src/`、不夹带 `workspace:*`，并检查 README / LICENSE。
- 修复实际发布路径：所有包通过 `publishConfig.directory = "dist"` 从产物目录发布，避免 npm tarball 误带 `src/`；`0.1.0-alpha.1` 已废弃。
- `@plingjs/core`：动作注册表、UI 原语、权限、执行流水线与变更证据。
- `@plingjs/dom`：框架无关的目标解析、可用性判定、滚动与浏览器 UI 原语。
- `@plingjs/agent`：同构会话循环、上下文组装、确认闸门、钩子、观测、评测与连续性。
- `@plingjs/vue` / `@plingjs/react` / `@plingjs/vanilla`：三种适配器共享同一套执行契约。
- `@plingjs/surface` / `@plingjs/delegation`：外部 Agent 的能力发现、调用边界与委托凭证。
- `@plingjs/continuity-http`：跨标签页 / 跨设备连续性 HTTP 集成包。
- `@plingjs/server`：OpenAI 兼容的薄 Node 网关、服务端密钥、鉴权与审计。

### Known limits

- 包仍处于 alpha，公开 API 尚未承诺稳定兼容。
- 内存后端只用于测试与本地演示；生产存储、广播和身份提供方由接入方实现。
