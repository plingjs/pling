# Pling 文档主目录 v1.12

> 状态：**Locked architecture**（v1.12，2026-10-28）
> 文件角色：**章节 ID、公共 IA、标题、顺序、可见性与成熟度的唯一真相（outline of record）**。
> 上游：`docs/TUTORIAL-BLUEPRINT.md`（读者、写作标准、评审方法）。
> 下游：`docs/tutorial/`（内部正文工作区）、`website/`（公开文档的唯一发布面）。
> 语言：英文标题是公开文档的规范标题；中文标题用于内部评审与中文站。英语为 source of truth。

> **v1.0 不是产品 v1.0。** 本文件锁定的是文档架构，不代表 Pling 已稳定发布。产品成熟度以每页的 `maturity` 与包版本为准。

## 0. 一页结论

Pling 的文档系统采用**双层结构**：

```text
Public Information Architecture（读者看到的 7 个入口）
        │  由本文件的 visibility + route 投影生成
        ▼
Content Ledger（内部内容台账，170 个稳定单元）
        │  逐章正文、翻译、验证与发布状态
        ▼
website/（公开文档唯一真相）
```

默认入口固定为：

```text
Docs · Examples · Surface · Spec · Reference · Evidence · About
```

其中：

- `Docs` 负责首次成功与框架接入；
- `Examples` 负责“先看见它真的能工作”；
- `Surface` 负责外部 Agent 的能力、上下文与控制；
- `Spec` 负责版本化、规范性的互操作契约；
- `Reference` 负责穷举 API、配置、错误码与 Schema；
- `Evidence` 负责证明有效、展示失败与说明边界；
- `About` 负责使命、架构、安全、发布、治理与社区。

首发公开约 **82 页**，但内部台账有 **170 个单元**。未被 `visibility` 选中的单元不进入导航，不以空页伪装成已完成。

产品定位固定为一句话：

> **Pling is the agent capability layer for web apps.**
> 它由 Vue / React / Vanilla SDK、浏览器运行时、Agent Surface 与版本化规范组成；不是一个宿主应用框架。

## 1. 这份文件为什么存在

教程可以重写，代码可以重构，但章节 ID、公共路由、阅读顺序和术语不能在多个文件里各自漂移。

从本版本开始执行：

1. **先改目录，再写正文。** 新增、删除、重命名、移动或改变可见性，同一次改动必须先更新本文件。
2. **ID 是稳定接口。** 一旦页面公开，ID 不随标题或 URL 变化。未公开的规划位可以在评审后调整。
3. **公共 IA 不等于内容台账。** 页面可以有 ID 但不公开；也可以由多个 Reference 子页组成一个公开组。
4. **英文标题是规范标题。** 中文标题是工作翻译，不反过来约束英文。
5. **一页只承担一个主要职责。** Tutorial、Concept、How-to、Reference、Explanation、Spec、Troubleshooting 不混写。
6. **未验证不发布。** `planned` 只是位置保留；`published` 必须同时有正文、链接、示例、失败路径与成熟度标记。
7. **不制造第二套正文。** `docs/tutorial/` 是内部草稿；`website/` 是公开真相；旧页面迁移后只能重定向，不能长期并存。

发生冲突时：

- **ID、标题、顺序、可见性、成熟度**：以本文件为准。
- **为什么这样分章、读者与写作标准**：以 `docs/TUTORIAL-BLUEPRINT.md` 为准。
- **公开正文、最终 URL 与翻译**：以 `website/` 为准。

## 2. 双层契约

### 2.1 公共 IA

公共 IA 只回答“读者从哪里进入、按什么顺序学习、在哪里查”。它只暴露已经具备发布条件的页面。

公共 IA 的约束：

- 主导航最多 7 个一级入口；
- 每个入口的侧边栏默认不超过 12 个顶层条目；
- 未完成的页面不进入导航；`Coming later` 只能出现在独立 Roadmap，不能占据空页；
- 框架学习线有独立 URL，读者不需要看其他框架；
- 共享 Operations 负责跨框架的部署与运维，适配器页只保留短差异；
- 完整教程、迁移指南与 Troubleshooting 不使用 Tab 承载多框架内容。

### 2.2 内容台账

内容台账负责记录所有可能的正文单元：章节、共享任务、Site 页面、Evidence 报告和 Reference 组。

台账的约束：

- 一个 ID 对应一个内容职责；Reference 组可以有生成的子页；
- ID 顺序是稳定引用顺序，不强制等于公共导航顺序；
- 公共导航可以使用单独的阅读顺序，例如把“接入存量 Vue 应用”放在 Quick Start 之后，而不必等待 `V3-22` 的序号；
- 一个单元可以处于 `hidden`、`later`、`0.1` 或 `legacy`，不得用 `planned` 页面填满侧边栏。

## 3. 元数据契约

每个公开页面必须在下游正文或 frontmatter 中声明以下字段。Outline 只记录全局默认与例外。

| 字段 | 取值 | 用途 |
| --- | --- | --- |
| `id` | M / C / OPS / V3 / R / J / V2 / S / EV / SPEC / RCP / REF / TS / SITE | 稳定引用 |
| `title` | 英文规范标题 | 导航、搜索、交叉链接 |
| `kind` | tutorial / concept / how-to / reference / explanation / spec / troubleshooting / site | 写作模板与评审标准 |
| `visibility` | `public` / `hidden` / `legacy` | 是否可进入公共 IA |
| `slice` | `0.1` / `later` / `hidden` / `legacy` | 首发公开范围 |
| `route` | 以 `/` 开头的规范路径 | URL 与重定向目标 |
| `docStatus` | planned / briefed / drafted / verified / reviewed / published / deprecated | 文档生产进度 |
| `maturity` | experimental / preview / stable / deprecated / n/a / blocked / draft | 能力或规范成熟度 |
| `since` | SemVer 或规范版本，例如 `0.1.0` / `0.1` | 首次可用版本 |
| `promise` | 一句话、可验证 | 本章读者能完成什么 |
| `prereq` | ID 列表 | 前置知识 |
| `verify` | 命令行、页面行为或测试 | 如何确认成功 |
| `locales` | `en` / `zh` / `community` | 翻译状态；不完整的语言不出现在切换器 |

### 3.1 文档状态与产品成熟度不是一回事

| 组合 | 含义 |
| --- | --- |
| `published` + `preview` | 页面已发布，但能力仍是预览，不得暗示生产稳定 |
| `published` + `experimental` | 页面已发布，但 API 可能变化；必须显示实验标记 |
| `published` + `stable` | 页面、API、示例与兼容性承诺都已验证 |
| `published` + `deprecated` | 页面保留用于迁移，明确替代方案 |
| `published` + `draft` | 只用于 Spec；明确说明不是标准 |
| `drafted` + `n/a` | 概念页有草稿，但没有“功能稳定度”概念 |

### 3.2 默认成熟度

除非页面另行声明：

- M / C：`n/a`；
- OPS / V3 / R / J / RCP / REF / TS：`preview`；
- S：`experimental`；
- SPEC：`draft`；
- EV / SITE：`n/a`；
- V2：`blocked`；
- 已弃用的页面：`deprecated`。

## 4. 公共信息架构

### 4.1 一级导航

| 一级入口 | 解决的问题 | 内容来源 |
| --- | --- | --- |
| `Docs` | 我怎么开始、怎么接入、怎么运维 | Site Start、C、OPS、V3、R、J、V2 |
| `Examples` | 它真的能工作吗、代码在哪里 | Site Live Demo、Examples、RCP |
| `Surface` | 外部 Agent 如何安全接入 | S |
| `Spec` | 不同实现必须一致什么 | SPEC |
| `Reference` | 参数、签名、错误码、Schema 在哪里 | REF |
| `Evidence` | 你凭什么说有效，失败在哪里 | EV |
| `About` | 为什么做、边界、治理与版本 | M、SITE-05 至 SITE-09 |

`Docs` 下拉包含：

```text
Start · Concepts · Operations · Vue 3 · React · Vanilla / jQuery · Vue 2 Legacy
```

`Examples` 下拉包含：

```text
Live examples · Recipes
```

`About` 下拉包含：

```text
Why Pling · Architecture · Security · Releases · Governance · Community · License
```

### 4.2 规范路由

| 页面族 | 路由前缀 | 说明 |
| --- | --- | --- |
| 首页 | `/` | 英文首页；中文在 `/zh/` |
| 开始 | `/start/` | 选择路径、Demo、首次成功 |
| 概念 | `/concepts/` | 跨框架稳定概念 |
| 共享运维 | `/operations/` | 网关、主题、测试、生产、升级 |
| 框架线 | `/vue/` `/react/` `/vanilla/` `/vue2/` | 各技术栈独立学习线 |
| Surface | `/surface/` | 外部 Agent 接入 |
| Spec | `/spec/0.1/` | 版本化规范；未来 `/spec/0.2/` |
| Recipes | `/recipes/` | 任务型方案；每个框架独立 URL |
| Reference | `/reference/` | 生成式 API 查询 |
| Troubleshooting | `/troubleshooting/` | 症状排障 |
| Evidence | `/evidence/` | Benchmark、互操作、失败与限制 |
| About | `/about/` | 使命、架构、对比、路线 |
| 项目面 | `/security/` `/releases/` `/governance/` `/community/` `/license/` | 信任与开源治理 |

### 4.3 默认阅读路径

```text
开发者：Live demo → Quick start → Inspect a run → Concepts → Recipe
存量项目：Existing app → First action → Coverage → Migrate → Production
评估者：Why → Architecture → Surface → Evidence → Spec
运维者：Operations → Gateway → Security → Support matrix → Production
外部 Agent 开发者：Surface → describe / invoke → Client quickstart → Delegation → Conformance
```

首页必须同时提供两个主 CTA：

- `Try the live demo`（无需模型 Key，先看到结果）；
- `Start building`（已有项目优先，空项目次之）。

`Mission` 不是新人的第一站；它在 `About → Why Pling`，作为评估者路径的入口。

### 4.4 语言与版本

- 英文是根站 `/`，默认 `en-US`；
- 中文是 `/zh/`，第一优先完整翻译；
- 其他语言是 Tier 2，可先标记为 `community preview`，不得冒充官方完整翻译；
- 代码、错误码、协议字段和 API 名永远不翻译；
- 文档语言与页面内 Agent UI 的 locale 是两个独立维度；
- SDK 当前文档只展示 `current`；Spec 使用独立版本路径；
- 没有真实版本切换器时，不展示“即将支持”的版本菜单。

## 5. 产品身份与标准路径

### 5.1 固定术语

| 术语 | 定义 |
| --- | --- |
| **Pling** | Agent capability layer for web apps；中文名「页灵」 |
| **Pling SDK** | Vue / React / Vanilla 的接入包与运行时 |
| **Agent Surface** | 能力、上下文、控制三个平面的契约 |
| **`pling.surface/0.1`** | Surface 的版本化协议标识；目前是 Draft |
| **Evidence** | Benchmark、互操作、失败样本与限制 |
| **Surface Gateway** | 企业侧的身份、委托、限流、审计与策略边界 |
| **Surface Spec** | 规范正文；不是教程，不是产品介绍 |

`framework` 只用来指宿主框架，例如 Vue、React、jQuery。不得写 `Pling Framework`；Pling 是 capability layer，不是另一个应用框架。

### 5.2 Surface 与相邻协议

```text
MCP / A2A / function calling   是传输或调用管道
Agent Surface                  是 Web 应用允许 Agent 做什么的业务契约
```

Surface 不要求所有 Agent 换传输协议；它可以编译或适配到 MCP、HTTP/SSE、postMessage 或未来的浏览器能力。它永远不提供 `click(selector)`、`eval(script)` 这类通用逃逸口。

### 5.3 标准化路线

```text
可运行参考实现
  → 单站点真实证据
  → 两个独立实现
  → Spec 0.1 Draft
  → 中立技术委员会
  → 基金会 / 认证 / 长期治理
```

在这些门槛完成前：

- 不把 `pling.surface/0.1` 称为行业标准；
- 不把认证标志当作营销徽章；
- 不把参考实现称为生产系统；
- 不承诺 Pling 能阻止所有恶意 Agent（CDP 与宿主环境仍可能绕过页面层）。

站点级 `Agent Access Manifest` 是一个有价值的未来扩展方向，但**不属于 0.1**；只有在协议、授权和后端执行边界明确后才进入公开规范。

## 6. 写作与排序规则

### 6.1 标题规则

| 页面类型 | 标题应像 | 示例 |
| --- | --- | --- |
| Tutorial | 读者要完成的动作 | `Add Pling to an existing Vue app` |
| Concept | 稳定名词或问题 | `Execution lifecycle` |
| How-to | 一个可验收的任务 | `Connect a model gateway` |
| Reference | API / 配置名 | `usePlingTool` |
| Troubleshooting | 用户看到的症状 | `Action not found` |
| Spec | 规范性名词 | `Capability model` |

一个标题只能有一个主要职责。出现 `A, B, and C` 时，先判断它们是不是同一个概念链；不是就拆分。

### 6.2 共享与分叉

可以共享：

- 概念、术语、生命周期与不变量；
- 权限、安全、敏感数据、可访问性原则；
- 任务定义、验收标准和失败分类；
- 跨框架的网关、生产、升级与测试流程。

必须分叉：

- 安装、Provider / 插件 / 指令 / ref / DOM API；
- 路由、SSR、构建与部署差异；
- 框架特有的坑、限制与迁移步骤；
- 完整 Quick Start 与完整项目教程。

共享 Operations 可以包含 3–10 行的适配器小片段，但完整教程不得用 Tab 承载。

### 6.3 页面最低结构

每个 Tutorial / How-to 至少包含：

1. 这篇解决什么问题；
2. 适合谁、前置条件、预计时间；
3. 最终结果与可运行示例；
4. 3–7 个步骤；
5. 每步命令、代码与预期结果；
6. 检查点；
7. 至少两个失败模式与修复；
8. 下一步或相关 Reference。

每个 Reference 页面至少包含：

- 签名；
- 默认值；
- 参数与返回值；
- 错误码；
- 版本 `since`；
- 兼容性说明。

## 7. Mission · 使命与定位（M）

回答为什么需要能力层、Pling 是什么、信任边界在哪里、如何走向开放协议。不写 API 教程。

默认成熟度：`n/a`。首发：全部 `0.1`。

| ID | Canonical title | 中文工作标题 | 前置 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| M-01 | Why a capability layer | 为什么需要能力层 | — | reviewed | 0.1 |
| M-02 | What Pling is, and is not | Pling 是什么，不是什么 | M-01 | reviewed | 0.1 |
| M-03 | Trust, authority, and audit | 信任、授权与审计 | M-02 | reviewed | 0.1 |
| M-04 | From single-site bridge to open protocol | 从单站点桥到开放协议 | M-03 | reviewed | 0.1 |

## 8. Shared Concepts · 共享概念主干（C）

只放跨框架稳定的概念、生命周期和不变量。不得出现框架插件名、指令名或组件名。

默认成熟度：`n/a`。

| ID | Canonical title | 中文工作标题 | 前置 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| C-01 | How Pling works | Pling 如何工作 | M-02 | reviewed | 0.1 |
| C-02 | The page capability model | 页面能力模型 | C-01 | reviewed | 0.1 |
| C-03 | What the agent can see | Agent 能看到什么 | C-02 | reviewed | 0.1 |
| C-04 | Execution lifecycle | 执行生命周期 | C-02 | reviewed | 0.1 |
| C-05 | Approval and human handoff | 审批与人工接力 | C-04 / M-03 | reviewed | 0.1 |
| C-06 | Sensitive data and trust boundaries | 敏感数据与信任边界 | C-03 / M-03 | reviewed | 0.1 |
| C-07 | How one agent run works | 一次 Agent 运行如何发生 | C-04 | drafted | 0.1 |
| C-08 | Connecting external agents | 接入外部 Agent | C-01 / M-02 | drafted | later |
| C-09 | Model access and trust boundaries | 模型访问与信任边界 | C-07 | drafted | later |
| C-10 | Diagnostics and observability | 诊断与可观测性 | C-04 / C-09 | drafted | later |
| C-11 | Failure model and error codes | 失败模型与错误码 | C-04 | drafted | 0.1 |
| C-12 | Versioning and compatibility | 版本与兼容性 | C-01 | drafted | later |
| C-13 | Task continuity across pages and tabs | 跨页面与标签页的任务连续性 | C-07 / C-12 | drafted | later |
| C-14 | Projection: Shadow DOM and iframes | 投影：Shadow DOM 与 iframe | C-03 | drafted | later |

## 9. Shared Operations · 跨框架运维（OPS）

这里是跨框架的任务指南。框架页只保留该适配器的短差异并链接回来；不把同一套网关、主题、测试和生产流程复制四份。

默认成熟度：`preview`；`since: 0.1.0`。

| ID | Canonical title | 中文工作标题 | 前置 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| OPS-01 | Add the assistant UI | 添加问答入口与助手界面 | C-01 | drafted | 0.1 |
| OPS-02 | Theme, locale, and accessibility | 主题、语言与可访问性 | OPS-01 | drafted | 0.1 |
| OPS-03 | Connect a model gateway | 接入模型网关 | C-07 | reviewed | 0.1 |
| OPS-04 | Deploy to production | 生产部署 | OPS-03 | drafted | 0.1 |
| OPS-05 | Test and debug capabilities | 测试与调试页面能力 | C-04 | drafted | 0.1 |
| OPS-06 | Expose capabilities to external agents | 向外部 Agent 开放能力 | OPS-03 / S-02 | drafted | later |
| OPS-07 | Upgrade Pling safely | 安全升级 Pling | C-12 | drafted | later |

## 10. Vue 3 · 首条完整学习线（V3）

Vue 3 是首条完整学习线。其他框架复用章节结构，不复用具体写法。

默认成熟度：`preview`；`since: 0.1.0`。V3 是一条连续路径：每一个业务场景只增加一组概念，Todo 的原始业务代码尽量保持不变，变化集中在 Pling 的接入层。`V3-22` 是存量项目的并行入口，公共阅读顺序可以提前给出，但章节 ID 保持稳定。教程按路径完整组织，Reference 才追求能力完整；能力覆盖见 `docs/TUTORIAL-CAPABILITY-MAP.md`。

| ID | Canonical title | 中文工作标题 | 前置 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| V3-01 | Vue 3 learning path | Vue 3 学习路径 | — | drafted | 0.1 |
| V3-02 | Installation and model configuration | 安装与模型配置 | V3-01 | drafted | 0.1 |
| V3-03 | Quick start: a complete Todo agent | Vue 快速上手：一个可用的 Todo Agent | V3-02 | drafted | 0.1 |
| V3-04 | Inspect one agent run | 查看一次 Agent 运行 | V3-03 | drafted | 0.1 |
| V3-05 | Actions with input and verified results | 带输入的动作与结果验证 | V3-04 | drafted | 0.1 |
| V3-06 | Real controls and custom components | 真实控件与自定义组件 | V3-05 | reviewed | 0.1 |
| V3-07 | Records, row actions, and change evidence | 记录、行内动作与变更证据 | V3-06 | drafted | 0.1 |
| V3-08 | Function-level tools | 函数级工具 | V3-07 | drafted | 0.1 |
| V3-09 | Regions, visibility, and overlays | 区域、可见性与遮挡 | V3-08 | drafted | 0.1 |
| V3-10 | Long lists, scrolling, and offscreen actions | 长列表、滚动与视口外动作 | V3-09 | reviewed | 0.1 |
| V3-11 | State exposure | 状态暴露 | V3-10 | drafted | 0.1 |
| V3-12 | Page identity and routing | 页面身份与路由 | V3-11 | drafted | 0.1 |
| V3-13 | Assistant surfaces, layout, and task entry points | 助手入口、布局与任务入口 | V3-04 | drafted | 0.1 |
| V3-14 | Page feedback, target highlighting, and human guidance | 页面反馈、目标高亮与人工指引 | V3-04 | drafted | 0.1 |
| V3-15 | Confirmation and human handoff | 确认与人工接力 | V3-04 / C-05 | drafted | 0.1 |
| V3-16 | Flows, async work, and recovery | 流程、异步与失败续跑 | V3-09 | drafted | 0.1 |
| V3-17 | Runtime limits, observability, and error codes | 运行时限额、观测与错误码 | V3-05 / V3-16 | drafted | 0.1 |
| V3-18 | Sensitive data | 敏感数据 | V3-11 | drafted | 0.1 |
| V3-19 | Model gateway and authentication | 模型网关与鉴权 | V3-13 / OPS-03 | drafted | 0.1 |
| V3-20 | Testing, coverage, and evaluation | 测试、覆盖率与评测 | V3-07 / OPS-05 | drafted | 0.1 |
| V3-21 | Production release | 生产上线 | V3-17 / V3-19 | drafted | 0.1 |
| V3-22 | Migrating an existing Vue app | 在存量 Vue 应用中接入 Pling | V3-03 | drafted | 0.1 |
| V3-23 | Exposing selected capabilities to external agents | 向外部 Agent 开放选定能力 | V3-19 / V3-15 | drafted | 0.1 |
| V3-24 | Nuxt and SSR | Nuxt 与服务端渲染 | V3-12 | drafted | 0.1 |

### 10.1 不进入 V3 主线的能力

以下能力仍然要实现、测试和记录，但不单独占用一个主线章节。它们进入 Reference、Recipe 或案例，避免主线变成能力清单。

| 能力 | 承载位置 | 原因 |
| --- | --- | --- |
| L1 自动派生（`derive: true`） | Reference · derivation / case 020 | 可选模式；不能让读者误以为未声明也会兜底 |
| `PreToolUse` / `PostToolUse` 钩子 | Reference · hooks / Enterprise Recipe | 企业策略与审计层，不是首次接入所需 |
| Shadow DOM、同源 iframe、混合框架与 namespace | Concept · projection / Reference | 属于页面投影问题，依赖具体宿主结构 |
| 跨标签页、跨设备连续性 | Concept · continuity / Recipe | 需要存储与恢复策略，不是单页能力 |
| 拖拽排序、虚拟列表、上传、向导、批量操作 | Recipes + 对应案例 | 任务型能力，由多个基础概念组合而成 |
| 第三方插件注册体系 | 产品完成后再定义 | 当前只有 Vue 插件安装、钩子与 namespace，不能称为插件生态 |

## 11. React · 第二条完整学习线（R）

默认成熟度：`preview`；`since: 0.1.0`。`R-22` 在公共阅读顺序中紧跟 Quick Start。

| ID | Canonical title | 中文工作标题 | 前置 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| R-01 | React learning path | React 学习路径 | — | drafted | 0.1 |
| R-02 | Install, provider, and mount | 安装、Provider 与首次挂载 | R-01 | drafted | 0.1 |
| R-03 | Quick start: add Pling to a React app | React 快速上手：一个可用的 Todo Agent | R-02 | drafted | 0.1 |
| R-04 | Inspect one agent run | 查看一次 Agent 运行 | R-03 | drafted | 0.1 |
| R-05 | Actions with input and verified results | 带输入的动作与结果验证 | R-04 | drafted | 0.1 |
| R-06 | Real controls and custom components | 真实控件与自定义组件 | R-05 | drafted | 0.1 |
| R-07 | Records, row actions, and change evidence | 记录、行内动作与变更证据 | R-06 | drafted | 0.1 |
| R-08 | Function-level tools | 函数级工具 | R-07 | drafted | 0.1 |
| R-09 | Regions, visibility, and overlays | 区域、可见性与遮挡 | R-08 | drafted | 0.1 |
| R-10 | Long lists, scrolling, and offscreen actions | 长列表、滚动与视口外动作 | R-09 | drafted | 0.1 |
| R-11 | State exposure | 状态暴露 | R-10 | drafted | 0.1 |
| R-12 | Page identity and routing | 页面身份与路由 | R-11 | drafted | 0.1 |
| R-13 | Assistant surfaces, layout, and task entry points | 助手入口、布局与任务入口 | R-12 | drafted | 0.1 |
| R-14 | Page feedback, target highlighting, and guidance | 页面反馈、目标高亮与人工指引 | R-04 | drafted | 0.1 |
| R-15 | Confirmation and human handoff | 确认与人工接力 | R-04 / C-05 | drafted | 0.1 |
| R-16 | Flows, async work, and recovery | 复合动作、异步与失败续跑 | R-09 | drafted | 0.1 |
| R-17 | Runtime limits, observability, and error codes | 运行时限额、观测与错误码 | R-05 / R-16 | drafted | later |
| R-18 | Sensitive data | 敏感数据 | R-11 | drafted | later |
| R-19 | Model gateway and authentication | 模型网关与鉴权 | R-13 / OPS-03 | drafted | later |
| R-20 | Testing, coverage, and evaluation | 测试、覆盖率与评测 | R-07 / OPS-05 | drafted | later |
| R-21 | Production release | 生产上线 | R-17 / R-19 | drafted | later |
| R-22 | Migrating an existing React app | 在存量 React 应用中接入 Pling | R-03 | drafted | 0.1 |
| R-23 | Exposing selected capabilities to external agents | 向外部 Agent 开放选定能力 | R-19 / R-15 | drafted | later |
| R-24 | Next.js and SSR | Next.js 与 SSR | R-12 | drafted | later |

## 12. Vanilla / jQuery · DOM 兼容路线（J）

jQuery 不单独造适配器；它归入 DOM 适配层，但教程必须覆盖动态 DOM、异步更新和 MPA 的真实问题。

默认成熟度：`preview`；`since: 0.1.0`。

| ID | Canonical title | 中文工作标题 | 前置 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| J-01 | Vanilla and jQuery overview | 原生 JS 与 jQuery 概览 | C-01 | drafted | 0.1 |
| J-02 | Script setup and first mount | 脚本接入与首次挂载 | J-01 | drafted | 0.1 |
| J-03 | Quick start: add Pling to a vanilla page | 原生页面快速上手 | J-02 | drafted | 0.1 |
| J-04 | Declarative actions with data attributes | 用 data 属性声明动作 | J-03 | drafted | 0.1 |
| J-05 | Imperative actions for dynamic DOM | 动态 DOM 的命令式动作 | J-04 | drafted | later |
| J-06 | Records and tables | 记录与表格 | J-04 | drafted | 0.1 |
| J-07 | Forms, async updates, and dialogs | 表单、异步更新与弹窗 | J-06 | drafted | later |
| J-08 | Mount the assistant UI | 挂载问答入口与助手界面 | J-04 | drafted | 0.1 |
| J-09 | Protect sensitive data and destructive actions | 保护敏感数据与危险操作 | J-07 | drafted | later |
| J-10 | Connect vanilla pages to the model gateway | 原生页面接入模型网关 | J-08 / OPS-03 | drafted | later |
| J-11 | MPA and task continuity | MPA 与任务连续性 | J-07 / C-13 | drafted | later |
| J-12 | Test and debug vanilla capabilities | 测试与调试原生页面能力 | J-06 / OPS-05 | drafted | later |
| J-13 | Add Pling to an existing jQuery app | 在存量 jQuery 应用中接入 Pling | J-03 | drafted | 0.1 |
| J-14 | Expose selected capabilities to external agents | 向外部 Agent 开放选定能力 | J-10 / S-04 | drafted | later |

## 13. Vue 2 Legacy · 规划位（V2）

`@plingjs/vue2` 已实现并通过独立类型检查、测试和发布冒烟验证。它是真实适配器，但只支持 Vue 2.7 和明确列出的子集；不得把它描述为与 Vue 3 等价。

默认成熟度：`preview`；支持声明、安装、快速上手、指令动作与助手入口随 0.1 发布，记录与弹窗、Vue 2 到 Vue 3 迁移留在后续版本。

| ID | Canonical title | 中文工作标题 | 前置 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| V2-01 | Vue 2 support statement | Vue 2 支持声明 | — | drafted | 0.1 |
| V2-02 | Install and first mount | 安装与首次挂载 | V2-01 | drafted | 0.1 |
| V2-03 | Quick start | 快速上手 | V2-02 | drafted | 0.1 |
| V2-04 | Directive-based actions | 基于指令的动作声明 | V2-03 | drafted | 0.1 |
| V2-05 | Records and dialogs | 记录与弹窗 | V2-04 | drafted | later |
| V2-06 | Mount the assistant UI | 挂载问答入口与助手界面 | V2-04 | drafted | 0.1 |
| V2-07 | Test and deploy a Vue 2 app | 测试与部署 Vue 2 应用 | V2-04 | drafted | 0.1 |
| V2-08 | Migrating from Vue 2 to Vue 3 | 从 Vue 2 迁移到 Vue 3 | V2-07 | drafted | later |

## 14. Agent Surface · 能力开放（S）

Surface 是与框架学习线并列的产品面，不是“高级功能”子菜单。它面向应用团队、Agent 客户端开发者和企业架构师。

默认成熟度：`experimental`；`since: 0.1.0-alpha`。

| ID | Canonical title | 中文工作标题 | 前置 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| S-01 | What is Agent Surface | 什么是 Agent Surface | M-02 | reviewed | 0.1 |
| S-02 | Designing safe capabilities | 设计安全的能力 | S-01 | reviewed | 0.1 |
| S-03 | Context and sensitive data | 上下文与敏感数据 | S-01 / C-06 | drafted | 0.1 |
| S-04 | Identity, consent, and delegation | 身份、同意与委托 | M-03 / S-01 | drafted | 0.1 |
| S-05 | Surface basics: describe and invoke | Surface 基础：describe 与 invoke | S-02 / S-03 / S-04 | drafted | 0.1 |
| S-06 | Transports and adapters | 传输与适配器 | S-05 | drafted | later |
| S-07 | Build an external agent client | 构建外部 Agent 客户端 | S-05 | drafted | 0.1 |
| S-08 | Deploy a Surface gateway | 部署 Surface 网关 | S-04 / S-06 | drafted | later |
| S-09 | Revoke access and audit actions | 撤销访问与审计操作 | S-04 / S-08 | drafted | later |
| S-10 | Conformance and interoperability | 一致性与互操作 | S-05 | drafted | later |
| S-11 | Threat model and legal boundaries | 威胁模型与法律边界 | M-03 / S-09 | drafted | later |
| S-12 | Versioning and governance | 版本与治理 | S-10 / S-11 | drafted | later |

## 15. Evidence · 证据与边界（EV）

Evidence 是独立产品面，不附属于营销页，也不藏在 Spec 后面。每份证据必须记录日期、commit、Spec 版本、模型、任务集、运行参数、失败样本与适用范围。

默认成熟度：`n/a`。

| ID | Canonical title | 中文工作标题 | 前置 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| EV-01 | Benchmark methodology and reproducibility | 基准方法与可复现性 | M-04 | drafted | 0.1 |
| EV-02 | Surface vs DOM, Playwright, and vision | Surface 与 DOM、Playwright、视觉方案对照 | EV-01 | drafted | later |
| EV-03 | Conformance and interoperability matrix | 一致性与互操作矩阵 | S-10 | drafted | later |
| EV-04 | Failure catalog and known limitations | 失败样本与已知限制 | EV-01 | drafted | 0.1 |
| EV-05 | Adoption evidence and case studies | 采用证据与案例 | EV-01 | drafted | later |
| EV-06 | Security audits and incident history | 安全审计与事件记录 | S-11 | drafted | later |

## 16. Protocol Specification · 协议规范（SPEC）

规范区回答“什么是真的”，不是教程。使用版本化 URL、规范性语言、机器可读 Schema、错误码注册表和一致性测试向量。

默认成熟度：`draft`；`since: 0.1`。0.1 公开时只发布 `SPEC-01` 至 `SPEC-05`。

| ID | Canonical title | 中文工作标题 | 前置 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| SPEC-01 | Scope and terminology | 范围与术语 | — | drafted | 0.1 |
| SPEC-02 | Capability model | 能力模型 | SPEC-01 | drafted | 0.1 |
| SPEC-03 | Context model | 上下文模型 | SPEC-02 | drafted | 0.1 |
| SPEC-04 | Control model | 控制模型 | SPEC-01 | drafted | 0.1 |
| SPEC-05 | Messages and envelopes | 消息与包络 | SPEC-02 / SPEC-03 / SPEC-04 | drafted | 0.1 |
| SPEC-06 | Errors and execution results | 错误与执行结果 | SPEC-05 | drafted | later |
| SPEC-07 | Transport bindings | 传输绑定 | SPEC-05 | drafted | later |
| SPEC-08 | Security and privacy | 安全与隐私 | SPEC-04 / SPEC-07 | drafted | later |
| SPEC-09 | Conformance | 一致性 | SPEC-05 / SPEC-06 / SPEC-07 / SPEC-08 | drafted | later |
| SPEC-10 | Versioning and governance | 版本与治理 | SPEC-09 | drafted | later |

## 17. Recipes · 任务型方案（RCP）

任务定义、业务背景和验收标准共享；每个框架的步骤与代码分开。不得把四套代码塞进同一页的 Tab。

默认成熟度：`preview`；`since: 0.1.0`。

| ID | Canonical title | 中文工作标题 | 前置 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| RCP-01 | Login, session, and protected pages | 登录、会话与受保护页面 | OPS-03 | drafted | 0.1 |
| RCP-02 | Table rows and batch actions | 表格行与批量操作 | C-02 | drafted | 0.1 |
| RCP-03 | Form fill, validation, and submit | 表单填写、校验与提交 | C-04 | drafted | 0.1 |
| RCP-04 | Multi-step modal and wizard | 多步弹窗与向导 | RCP-03 | drafted | later |
| RCP-05 | Dangerous actions and confirmation | 危险操作与确认 | C-05 | drafted | later |
| RCP-06 | File upload and asynchronous work | 文件上传与异步任务 | C-04 | drafted | later |
| RCP-07 | Search, filters, and long lists | 搜索、筛选与长列表 | C-02 | drafted | later |
| RCP-08 | Multi-page task continuity | 多页任务连续性 | C-13 | drafted | later |
| RCP-09 | Expose three safe capabilities to an external agent | 向外部 Agent 开放三个安全能力 | S-03 | drafted | later |
| RCP-10 | Connect an external agent through MCP | 通过 MCP 接入外部 Agent | S-06 | drafted | later |
| RCP-11 | Delegated access with user consent | 经用户同意的委托访问 | S-04 | drafted | later |
| RCP-12 | Approval, audit, and revocation for agent actions | Agent 操作的审批、审计与撤销 | S-09 | drafted | later |
| RCP-13 | Use your own model key | 使用自己的模型密钥 | OPS-03 | drafted | later |
| RCP-14 | Pass Surface conformance with another implementation | 让另一实现通过 Surface 一致性验证 | S-10 | drafted | later |

## 18. Reference · 精确查询（REF）

Reference 负责穷举、签名、默认值、错误码和兼容性。**REF ID 是组，不是单页**；每个组可以生成多个 API 子页，子页由源码类型、Schema 与测试生成，不手写第二份签名。

默认成熟度：`preview`；`since: 0.1.0`。`REF-10` 跟随 Vue 2.7 的真实支持范围。

| ID | Canonical title | 中文工作标题 | 前置 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| REF-01 | Core declarations: actions, records, regions, state | 核心声明：动作、记录、区域、状态 | C-02 | drafted | 0.1 |
| REF-02 | Agent runtime, sessions, context, limits | Agent 运行时、会话、上下文与限额 | C-07 | drafted | 0.1 |
| REF-03 | UI messages, theme, locale | UI 文案、主题与语言 | OPS-02 | drafted | later |
| REF-04 | Surface protocol | Surface 协议 | S-05 | drafted | 0.1 |
| REF-05 | Delegation and trust boundaries | 委托与信任边界 | S-04 | drafted | later |
| REF-06 | Node gateway | Node 网关 | OPS-03 | drafted | later |
| REF-07 | Vue 3 adapter | Vue 3 适配器 | V3-02 | drafted | 0.1 |
| REF-08 | React adapter | React 适配器 | R-02 | drafted | 0.1 |
| REF-09 | Vanilla / jQuery adapter | 原生 JS 与 jQuery 适配器 | J-02 | drafted | 0.1 |
| REF-10 | Vue 2 adapter | Vue 2 适配器 | V2-02 | drafted | 0.1 |
| REF-11 | Error codes and diagnostics | 错误码与诊断 | C-11 | drafted | 0.1 |
| REF-12 | Continuity and projection | 连续性与投影 | C-13 / C-14 | drafted | later |
| REF-13 | Surface conformance and interoperability | Surface 一致性与互操作 | S-10 | drafted | later |
| REF-14 | Protocol schemas and registries | 协议 Schema 与注册表 | SPEC-05 | drafted | later |

## 19. Troubleshooting · 症状排障（TS）

标题使用用户观察到的症状，不暴露内部实现。正文先给判断树，再给修复步骤。

默认成熟度：`preview`。

| ID | Canonical title | 中文工作标题 | 前置 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| TS-01 | Nothing happens when the agent acts | Agent 执行后没有任何反应 | V3-04 / OPS-05 | drafted | 0.1 |
| TS-02 | Action not found | 找不到动作 | C-02 | drafted | 0.1 |
| TS-03 | Action is unavailable | 动作不可用 | C-04 | drafted | 0.1 |
| TS-04 | Confirmation denied or stuck | 确认被拒绝或卡住 | C-05 | drafted | later |
| TS-05 | Model request fails | 模型请求失败 | OPS-03 | drafted | 0.1 |
| TS-06 | Records stale or duplicated | 记录过期或重复 | C-02 | drafted | 0.1 |
| TS-07 | Navigation loses the task | 导航后任务丢失 | C-13 | drafted | later |
| TS-08 | Sensitive value leaks or is missing | 敏感值泄露或缺失 | C-06 | drafted | later |
| TS-09 | Too many tokens or steps | Token 或步数过多 | C-07 | drafted | later |
| TS-10 | SSR or hydration breaks the page | SSR 或 hydration 破坏页面 | V3-18 / R-16 | drafted | later |

## 20. Site Surfaces · 项目与信任面（SITE）

这些不是教程章节，而是世界级开源项目必须具备的公共入口。它们拥有稳定 ID 与路由，但不受“一页一个教学内容”的章节模板约束。

默认成熟度：`n/a`。

| ID | Canonical title | 中文工作标题 | 路由 | 状态 | 首发 |
| --- | --- | --- | --- | --- | --- |
| SITE-01 | Home | 首页 | `/` | drafted | 0.1 |
| SITE-02 | Start here | 开始 | `/start/` | drafted | 0.1 |
| SITE-03 | Live examples | 在线案例 | `/examples/` | drafted | 0.1 |
| SITE-04 | Examples and recipes index | 示例与任务索引 | `/recipes/` | drafted | 0.1 |
| SITE-05 | Security and trust center | 安全与信任中心 | `/security/` | reviewed | 0.1 |
| SITE-06 | Releases, support matrix, and upgrades | 发布、支持矩阵与升级 | `/releases/` | reviewed | 0.1 |
| SITE-07 | Governance, RFC, and community | 治理、RFC 与社区 | `/governance/` | reviewed | later |
| SITE-08 | License and trademark | 许可证与商标 | `/license/` | reviewed | 0.1 |
| SITE-09 | Documentation for agents | 面向 Agent 的文档 | `/llms.txt` | drafted | later |

`SITE-05` 必须包含：威胁模型入口、漏洞披露、隐私边界、供应链安全、Agent 被攻击时的暂停与撤销方式。它不是法律合规承诺。

`SITE-06` 必须包含：SDK 版本、浏览器支持、Vue/React/Node 支持矩阵、升级路径、弃用策略、已知不兼容。

`SITE-07` 必须包含：公开 RFC、技术指导委员会的产生方式、商标与认证规则、行为准则、贡献流程和利益冲突说明。

`SITE-09` 至少生成 `llms.txt`、完整 Markdown 导出与可引用的稳定锚点；这是 Agent 时代文档站的基础能力，不替代人工可读页面。

## 21. 首发切片（0.1）

首发不是把 170 个单元全部做成空页，而是发布一条完整、可信的路径。预计公开约 **82 页**。

| 切片 | 公开 ID | 目的 |
| --- | --- | --- |
| `0.1-start` | M-01 至 M-04、SITE-01/02/03/04/05/06/08 | 让人先理解、先跑通、先看到证据与边界 |
| `0.1-concepts` | C-01 至 C-06 | 建立共享心智模型 |
| `0.1-vue` | V3-01 至 V3-12 | Vue 3 首条完整接入线 |
| `0.1-react` | R-01 至 R-14、R-22 | React 平滑接入线 |
| `0.1-vanilla` | J-01 至 J-04、J-06、J-08、J-13 | 原生 JS / jQuery 接入线 |
| `0.1-ops` | OPS-01 至 OPS-05 | 跨框架的入口、网关、生产、测试 |
| `0.1-surface` | S-01 至 S-05、S-07 | 外部 Agent 的最小真实闭环 |
| `0.1-spec` | SPEC-01 至 SPEC-05 | 公开最小协议，标记 Draft |
| `0.1-recipes` | RCP-01 至 RCP-03 | 最常见业务任务 |
| `0.1-reference` | REF-01/02/04/07/08/09/11 | 能查、能排障 |
| `0.1-troubleshooting` | TS-01/02/03/05/06 | 首次接入最常见失败 |
| `0.1-evidence` | EV-01、EV-04 | 说明已证明与未证明什么 |

React / Vanilla 的公开页面随对应适配器验证完成度开放；Vue 2.7 已可用，但其文档只描述 `packages/vue2` 实际支持的子集。

## 22. 旧站点迁移

当前 `website/` 是中文优先的 `/guide/` + `/reference/` 结构，约有 39 个 guide 源文件与 24 个 reference 源文件。新 IA 不允许长期与旧 IA 并存。

迁移规则：

1. 先建立完整的旧 URL → 新 route 映射；没有映射的页面不删除、不公开；
2. 内容先迁移到英文新页面，再生成 `/zh/` 翻译；
3. 旧 URL 只保留 301，不再接收新内容；
4. `/guide/*` 的正文按主题拆入 `/start/`、`/concepts/`、`/operations/` 或框架线；
5. `/cookbook/*` 进入 `/recipes/*`；
6. `/design/*` 进入 `/about/architecture` 或 `/concepts/*`；
7. `/examples/*` 保留为 Examples 产品面；
8. 旧 `/reference/*` 按 API 组迁移，不保留巨型手写页；
9. 迁移完成前不得宣称新 IA 已上线。

关键映射示例：

| 旧路由 | 新规范路由 |
| --- | --- |
| `/guide/introduction` | `/start/what-is-pling` |
| `/guide/quick-start` | `/start/quick-start` |
| `/guide/installation` | `/vue/install` |
| `/guide/migration` | `/vue/existing-app` |
| `/guide/concepts` | `/concepts/` |
| `/guide/react` | `/react/` |
| `/guide/vanilla` | `/vanilla/` |
| `/guide/node-gateway` | `/operations/model-gateway` |
| `/guide/theme-i18n` | `/operations/theme-locale-accessibility` |
| `/guide/external-agents` | `/surface/quickstart` |
| `/guide/offscreen` | `/vue/long-lists` |
| `/guide/flows` | `/vue/flows` |
| `/guide/handoff` | `/vue/handoff` |
| `/guide/trust` | `/concepts/approval` |
| `/cookbook/` | `/recipes/` |
| `/design/` | `/about/architecture` |
| `/reference/*` | `/reference/*`（按组重组） |

## 23. 质量门禁

公开文档上线前必须通过以下检查。实现可以分阶段，但规则从本版本开始生效。

### 23.1 内容门禁

- 每页只有一个主要承诺；
- 前置条件、预计时间、最终结果齐全；
- 代码片段来自真实示例或生成源；
- 至少两个失败模式与修复；
- 所有协议/API 名称与当前包版本一致；
- 没有未实现能力的暗示；
- 没有把 Spec Draft 写成标准；
- 没有把 `experimental` 写成 `stable`。

### 23.2 工程门禁

建议新增 `pnpm docs:check`，至少验证：

- 每个公开页面有 `id`、`route`、`promise`、`maturity`、`since`；
- 没有重复 route、死链或未映射的旧链接；
- 代码块可从示例构建；
- Spec Schema 与错误码注册表可解析；
- 翻译缺失不会被语言切换器伪装为完整；
- 公共导航不包含 `hidden` 页面；
- Reference 签名与包导出一致。

发布前同时运行：`pnpm check`、`pnpm typecheck`、`pnpm test`、`pnpm pack:check`、`pnpm docs:check`（后两者在具备时）。

### 23.3 安全与信任门禁

- 威胁模型覆盖 prompt injection、审批绕过、委托重放、敏感值泄露、CDP 绕过；
- 安全页面说明“能防什么、不能防什么”；
- 公开漏洞披露渠道与响应时间；
- 高风险动作默认 fail-closed；
- 不把前端确认说成后端授权；
- 不把 Pling 称为法律合规认证。

## 24. 已定型的决策

| # | 决策 |
| --- | --- |
| 1 | 公开 IA 与内容台账分层；170 个内部单元不进入同一个侧边栏 |
| 2 | 首发先 Start / Demo / Quick Start，Mission 放在 About |
| 3 | 产品身份固定为 agent capability layer；`framework` 只指宿主框架 |
| 4 | 公共导航固定为 Docs / Examples / Surface / Spec / Reference / Evidence / About |
| 5 | Evidence 是一级产品面，阅读顺序在 Spec 之前 |
| 6 | Spec 与教程同站但独立版本化；0.1 只作为 Draft |
| 7 | 框架特有内容分线；跨框架运维进入 OPS，避免四份重复 |
| 8 | Recipes 共享任务定义，每个框架拥有独立实现 URL，不用大 Tab 混排 |
| 9 | Vue 2.7 已作为真实适配器开放；文档明确列出子集，不把它描述成 Vue 3 等价 |
| 10 | Quick Start 以存量应用为主路径，空项目为次路径；Demo 不需要模型 Key |
| 11 | 标题按 Tutorial / Concept / Reference / Troubleshooting / Spec 分别使用动作、名词、API、症状、规范术语 |
| 12 | 英文根站、中文 `/zh/`；机器翻译标记为 community preview，不冒充官方 |
| 13 | 旧 `/guide`、`/cookbook`、`/design` 迁移后只保留 301，不保留第二份正文 |
| 14 | Vue 3 增加 Nuxt/SSR；React 保留 Next.js/SSR；`V3-18` 不再作为“Where to go next” |
| 15 | `Agent Access Manifest` 作为未来扩展方向记录，不进入 0.1 承诺 |

## 25. 维护规则

- 新增、删除、重命名或移动页面，先改本文件，再改正文与站点；
- 章节 ID 一旦公开，只能弃用不能悄悄复用；
- 每次改公共 IA，必须同步导航、搜索、重定向与 `docs/tutorial/README.md`；
- 每次改 API 名、默认值或错误码，必须在同一改动里更新 Reference 与 `since`；
- 每次更新 Spec 或 Evidence，必须记录日期、版本、commit 与适用范围；
- 每次发布 Case 或 Example，必须更新示例索引，不把内部案例当作公开教程；
- 历史 Case、archive 与旧页面永不删除，只允许迁移、标记 deprecated 或重定向。

## 26. 目录变更记录

| 版本 | 日期 | 变化 |
| --- | --- | --- |
| v0.1 | 2026-10-24 | 建立唯一目录契约；收录 M / C / V3 / R / J / V2 / S / SPEC / RCP / REF / TS 共 136 个章节位；标注首批 drafted 章节与首发切片 |
| v1.1 | 2026-10-25 | 将 Vue 3 主线细化为 24 章连续路径；拆开记录与长列表、区域与指引入口、确认与流程；把派生、钩子、投影、连续性等能力移出主线；更新内容台账与首发切片 |
| v1.2 | 2026-10-25 | 删除独立的 Vue 3 学习线概览；学习线直接从安装、模型配置与首次渲染开始；章节位由 164 调整为 163，首发切片改为 V3-02 至 V3-12 |
| v1.3 | 2026-10-27 | 删除独立的 React 学习线概览；React 线从安装、Provider 与首次挂载开始；章节位由 163 调整为 162，首发切片改为 R-02 至 R-07、R-10、R-17 |
| v1.4 | 2026-10-27 | 恢复 Vue 3 与 React 的独立学习路径入口；安装章前置改为对应入口章；章节位由 162 调整为 164，首发切片改为 V3-01 至 V3-12、R-01 至 R-07、R-10、R-17 |
| v1.5 | 2026-10-27 | React 主线与 Vue 3 的 24 章路径对齐：R-04 改为运行检查，新增动作输入、真实控件、函数工具、长列表、页面反馈与限额等章节；旧 R-05/R-10/R-12/R-17/R-18 分别迁移；章节位由 164 调整为 170，首发切片改为 R-01 至 R-07、R-13、R-22 |
| v1.6 | 2026-10-27 | R-08 函数级工具进入 0.1 草稿；React 首发切片扩展到 R-01 至 R-08、R-13、R-22 |
| v1.7 | 2026-10-27 | R-09 区域、可见性与遮挡进入 0.1 草稿；React 首发切片扩展到 R-01 至 R-09、R-13、R-22 |
| v1.8 | 2026-10-27 | R-10 长列表、滚动与视口外动作进入 0.1 草稿；React 首发切片扩展到 R-01 至 R-10、R-13、R-22 |
| v1.9 | 2026-10-27 | R-11 状态暴露进入 0.1 草稿，前置修正为 R-10；React 首发切片扩展到 R-01 至 R-11、R-13、R-22 |
| v1.10 | 2026-10-27 | R-12 页面身份与路由进入 0.1 草稿，前置修正为 R-11；React 首发切片扩展到 R-01 至 R-12、R-13、R-22 |
| v1.11 | 2026-10-27 | R-13 助手入口、布局与任务入口进入 0.1 草稿，前置修正为 R-12；React 首发切片收缩为 R-01 至 R-13、R-22 |
| v1.12 | 2026-10-28 | R-14 页面反馈、目标高亮与人工指引进入 0.1 草稿；前置保持 R-04，React 首发切片扩展为 R-01 至 R-14、R-22 |
| v1.0 | 2026-10-24 | 定型双层文档架构；新增公共 IA、158 个内容单元、OPS / EV / SITE；固定 7 个一级入口；增加成熟度与 `since`；拆分多职责标题；引入 Evidence、迁移与文档门禁；解决 v0.1 的 10 个待定决策 |

