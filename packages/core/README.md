# @plingjs/core

Pling 的**框架无关内核**。这一层不允许出现任何 Vue / React 概念。

| 模块 | 职责 |
| --- | --- |
| `types.ts` | `Binding`（含**成功判据 `expect`** / **人工接力规格 `handoff`**）/ `Expectation` / **`HandoffSpec` / `HandoffStep`（分步指引）** / **`GuideTarget`（只高亮、不是动作）** / `StateExposure` / **`RecordDeclaration`（一行业务数据）** / **`FeedbackDeclaration`（页面反馈）** / **`RegionRole`（区域结构角色）** / `Adapter` / `Primitive` / `Kind` / `Fidelity` / `Availability` |
| `registry.ts` | 动作注册表：`bind` / **`declareRecord`** / **`declareFeedback`** / `expose` / `declareScope` / **`setPage`（页面身份）** / `snapshot`（`actions` + **`records`** + **`recordIds` / `recordIdsTotal`** + **`offscreenRecordActions`** + **`feedback`** + **`page`** + `unavailable` + `state` + `stateViews` + **区域树 `scopes`** + 动作的 `scopePath`）（`createRegistry({ defaultApproval, recordLimits, feedbackLimits })` 决定没写 `confirm` 的动作默认问不问、行数据 / id 索引 / 反馈留几条） |
| `state.ts` | 状态暴露的**有界序列化**：深度 / 数组 / 字段 / 字符串上限，裁掉必留说明，抗循环引用 |
| `wait.ts` | **等待与期望**：`waitFor(check, { timeout, interval, signal })`（超时返回 `false`，不抛异常；判定之间让出一轮宏任务）+ `DEFAULT_WAIT_TIMEOUT` / `DEFAULT_WAIT_INTERVAL` |
| `pending.ts` | **「页面还在动」的共同计数**：`beginPending()`（**幂等**的结束函数）/ `trackPending(promise)` / `pendingCount()` / `whenIdle({ timeout, interval, confirmTicks })`（等页面停下；**超时返回 `false`，不抛异常**）。给 `@plingjs/agent` 的 `settle` 用 —— 平滑滚动 / 动画期间不要取快照 |
| `primitives.ts` | UI 原语参数表 + 校验（`click` / `type` / `select` / `scroll` / `navigate` / `press` / **`hover`** / **`flow`** / **`call`**） |
| `ids.ts` | id 形状工具：`actionShapeOf`（元素级 id → 动作类，「始终允许」按类记）· **`rowRefOf`（行内动作 → `{ template, record }`，agent 的动作折叠靠它）** · **`toolNameOf` / `MAX_TOOL_NAME_LENGTH`（id → 合法 function name；文本清单与工具 schema 共用同一个名字）** |
| `params.ts` | **声明式参数**：`ToolParam` → JSON Schema（`toJsonSchema`）、`normalizeDeclaredArgs`（类型规整 + 缺必填 / 越 `enum` / 范围 / 长度 / 正则 / 真实日期报可行动的错）。支持 `values` 静态值域、`options` 动态选项（含 `label`）、`min` / `max`（可为函数）、`minLength` / `maxLength`、`pattern`、`format: "date"` |
| `policy.ts` | 权限决策：只看 `approval`（`none` / `ask` / `ask-always`），fail-closed；`supportsAlwaysAllow(approval)` 判断界面能否提供会话内快捷授权（只有 `ask` 可以）；执行侧只要求 `ConfirmGate`（`Pick<Policy, "check">`），自定义策略不必养 `alwaysAllow`。**人工接力**：`HandoffDecision` / `HandoffRequest` / `HandoffGate` / `DEFAULT_HANDOFF_TIMEOUT`（确认是「人批」，接力是「人做」） |
| `diff.ts` | **变更证据**：`SnapshotDiff` / `diffSnapshots(before, after)` / `describeDiff(diff)` —— 比两份快照的 **page** / records / actions / state / **feedback**（含**顺序**），每组列表有上限 |
| `flow.ts` | **复合动作**：`FlowStep` / `FlowStepReport`（含 **`handoff`** 人工步骤标记）/ `FlowReport` · `renderTemplate`（`{{参数}}`，缺值当场报错）· `resolveStepArgs`（对象走占位符 / 函数是逃生口）· `describeFlow` / `describeFlowHuman`（逐步账本，前者给模型、后者给人）· `MAX_FLOW_DEPTH`（嵌套上限 5）· **续跑**：`FlowStep.idempotent` / `FlowResumeInfo` / `RESUME_FLOW_ACTION_ID` |
| `runtime.ts` | 执行流水线（查绑定 → 参数 → 权限 → 校验 → 可用性 → 原语 / **人工接力** → **等期望** → 观察）+ tool-calling 循环（含原地打转检测 / 错误预算保护）。有 `handoff` 的动作不执行 `run`、不叠加确认；无通道 / 取消 / 超时 / 验收失败分别返回 `HANDOFF_FAILED` / `HANDOFF_CANCELLED` / `HANDOFF_TIMEOUT` |
| `errors.ts` | 结构化错误码 |
| `llm.ts` | 模型接口：`Llm = (messages, tools, options?) => result`，可注入假实现；`options` 里是过程能力（`signal` 取消 / `onDelta` 流式） |

```ts
import { createRegistry, createPolicy, createRuntime, sanitizeState } from "@plingjs/core";

// 动作：能点什么
registry.bind(binding);
// 状态：现在是什么样（只读视图，进快照前会被有界序列化）
registry.expose({ key: "list", description: "列表状态", read: () => ({ shown: 1, total: 42 }) });
```

`expose` 的取舍见 [状态与能力模型](https://plingjs.dev/zh/reference/core-declarations-actions-records-regions-state)：**只给视图，不倾倒 store**。

## 区域：`declareScope` 与 `ScopeInfo`

区域声明可以带结构语义；`snapshot()` 会按父链还原成树：

```ts
registry.declareScope({
  id: "filters",
  label: "筛选与工具栏",
  role: "toolbar",
  description: "搜索、筛选、排序、导出",
  parent: "orders_admin",        // 也可传函数：适配器延迟从 DOM 解析
  order: () => 1,                // 页面阅读顺序（适配器按 DOM 报）
  explore: ["pling_scroll_filters"],
});

const snapshot = registry.snapshot();
// snapshot.scopes: { id, role, description, parent, depth, active, order, … }
// snapshot.actions[i].scopePath: ["订单后台", "筛选与工具栏"]
```

`role` 只影响描述与排序，不参与权限；`depth` / `parent` / `order` 由快照统一解析，
因此子区域先于父区域登记也没关系（Vue 的 mounted 顺序就是如此）。

## 页面身份：`PageView` 与 `setPage`

core 不读浏览器环境，只负责存储适配器读到的「我在哪」：

```ts
registry.setPage({
  path: "/orders/SO-1002",
  title: "订单详情",
  name: "order-detail",
  params: { id: "SO-1002" },
});

registry.snapshot().page; // 有界、只读；空对象等价于清空
```

`PageView` 与区域结构分工不同：`page` 回答「这是哪一页、路由参数是什么」，
`scopes` 回答「这一页里有哪些块」。`normalizePage()` 会 trim 字符串、丢掉空值，
并对 `params` / `query` 做有界序列化。`query` 是否出现由适配器按白名单决定，core 不自行读取 URL。

页面身份变化会单独进入 `diffSnapshots()` 的 `page` 段；即使动作 / 状态没变，
路由切换也不会被误判成「无变化」。见 [页面身份与路由](https://plingjs.dev/zh/vue/page-identity-and-routing)。

## 动作的参数：`params`

动作默认是**原子**的（一个元素一次调用）。「挪到第 N 位」这种天生要输入的，用声明式参数：

```ts
registry.bind({
  descriptor: { id: "reorder", primitive: "click", kind: "write", params: toJsonSchema([
    { name: "item", label: "哪一条（行数据里的 id）" },
    { name: "position", label: "目标位置，从 1 开始", type: "number" },
  ]) },
  isAvailable: () => true,
  run: async (args) => todos.moveTo(String(args.item), Number(args.position)),
});
```

三条约定：**默认必填**（`optional: true` 才可选）、**`label` 必填**（它就是给模型的说明）、
**类型只做规整兜底**（`"3"` → `3`；转不了才报错）。校验发生在**权限决策之前** ——
少了参数直接 `INVALID_PARAMS`，不会先弹一次确认。用法见 [带输入的动作与结果验证](https://plingjs.dev/zh/vue/actions-with-input-and-verified-results)。

### 约束：值域、动态选项与格式

真实参数几乎都有边界。写在声明里，模型看到的就是同一份 schema：

```ts
params: [
  {
    name: "orderId",
    label: "订单号，例如 SO-1002",
    pattern: /^SO-\d{4}$/,
    options: () => orders.value.map((order) => ({ value: order.id, label: order.customer })),
  },
  { name: "status", label: "订单状态", values: ["pending", "approved", "rejected"] },
  { name: "due", label: "预计回款日", format: "date" },     // 2026-02-30 也会被拒
  { name: "note", label: "备注", maxLength: 20 },
]
```

- **动态选项 / 动态边界每次重新求值**：`registry.snapshot()` 与执行前校验都优先用
  `Binding.resolveParams()`；Vue 适配器在 `options` / 函数 `min` / `max` 存在时自动绑定它。
- **执行前校验**：流水线第 3 步（权限决策之前）。动态选项的 `description` 只抄前 8 个
  `值（label）`，完整值在 `enum` 里。
- 错误信息照旧可行动：枚举列前 8 个、范围 / 长度带实际值、日期明确说「真实存在」。

用法见 [带输入的动作与结果验证](https://plingjs.dev/zh/vue/actions-with-input-and-verified-results)。

## 复合动作：对模型 1 个 tool，内部走 N 步

顺序写死的事（清筛选 → 搜索 → 开弹窗 → 填 → 保存 → 清搜索）**别让模型自己拼** —— 那是 5 轮往返。
给它 `steps`，框架按顺序走完：

```ts
registry.bind({
  descriptor: { id: "fill_note", primitive: "flow", kind: "write", params: toJsonSchema([
    { name: "orderId", label: "订单号" }, { name: "note", label: "新的备注" },
  ]) },
  isAvailable: () => true,           // 流程没有 run —— 它的实现是编排
  steps: [
    { action: "search_query", args: { text: "{{orderId}}" }, desc: "输入订单号" },
    { action: "edit@order:{{orderId}}", desc: "打开编辑弹窗" },   // 逐步解析：这一行的按钮要等搜索完才在
    { action: "dialog_note", args: { text: "{{note}}" }, desc: "填上备注" },
    { action: "dialog_save", desc: "保存" },
  ],
});
```

四条设计（背景见 [执行生命周期](https://plingjs.dev/zh/concepts/execution-lifecycle)）：

1. **步骤引用已注册的动作 id** —— 权限 / 可用性 / 审计 / 探索动作一条都不用重写，也不会出现「流程能做、人手做不了」；
2. **逐步解析**（弹窗里的按钮在弹窗打开之前不存在）+ **每步之后落定**（复用 `settle`）+ 步间 `betweenSteps`；
3. **一次业务操作一份账**：外层一次确认（档位取步骤最严那档；内层除非更严否则不再问）、一份 `changed`；
4. **失败中断 + 如实说**：`STEP_FAILED` 里带逐步账本与「前几步已经生效」；`optional: true` 的步骤失败则跳过。

`Primitive` 新增 `"flow"`（kind 下限是 `read` —— 流程本身不产生副作用，副作用来自步骤）。
用法见 [流程、异步与失败续跑](https://plingjs.dev/zh/vue/flows-async-work-and-recovery)。

## 流程失败续跑

`STEP_FAILED` 的错误回执里会带一个句柄：

```json
{ "error": { "code": "STEP_FAILED",
  "resume": { "runId": "run-1", "flowId": "set_due_date",
              "failedAt": 4, "total": 5, "from": 4,
              "remaining": ["due_day", "due_confirm"] } } }
```

模型随后调用框架动态暴露的 `pling_resume_flow { runId: "run-1" }`，执行器**只跑失败那一步及之后**，
并把完整账本与整次业务操作的 `changed` 一起返回。

安全性是按失败发生点分的（默认 fail-closed）：

```ts
steps: [
  { action: "open" },
  { action: "save_draft", idempotent: true }, // 执行后失败也允许续跑；不确定就不要写
]
```

| 失败发生时 | 错误码 | 给 `resume` |
| --- | --- | --- |
| 执行原语之前 | `ACTION_NOT_FOUND` / `INVALID_ARGS` / `INVALID_PARAMS` / `ACTION_UNAVAILABLE` / `PERMISSION_DENIED` | ✅ |
| 执行原语之后 | `EXECUTION_FAILED` / `EXPECTATION_FAILED` | 仅 `idempotent: true` |

句柄只在当前 registry（页面会话）内有效；有失败流程时才把 `pling_resume_flow` 挂进注册表，
续跑成功 / 句柄过期后自动摘掉。当前只支持顶层流程，嵌套流程仍按错误信息手动补做。
用法见 [流程、异步与失败续跑](https://plingjs.dev/zh/vue/flows-async-work-and-recovery)。

`Primitive` 另有 `"hover"`：参数是 `{}`，kind 下限 `read`；
省略 `kind` 时仍按 fail-closed 视为 `write`。Vue 适配器会依次派发
`pointerover` / `pointerenter` / `mouseover` / `mouseenter`，不派发离开事件；
纯 CSS `:hover` 不会被合成事件展开。用法见 [流程、异步与失败续跑](https://plingjs.dev/zh/vue/flows-async-work-and-recovery)。

## 函数级动作：`Primitive = "call"`

`call` 没有 DOM 元素：由适配器（如 `@plingjs/vue` 的 `useAgentTool`）注册开发者注入的 `run`。
它复用同一条执行流水线（参数 / 敏感值 / 权限 / 确认 / 审计），区别只是：

- 不参与视口、遮挡、滚动与存在感高亮；
- `fidelity` 由适配器直接给 `high`（实现是开发者写的，不存在 DOM 模拟不准）；
- `run` 的返回值（非 `undefined`）会在成功回执里变成 `data`（有界序列化：深度 3 / 数组 20 / 字段 20 / 字符串 300）。

```ts
registry.bind({
  descriptor: { id: "sync_crm", primitive: "call", description: "同步到 CRM", kind: "write" },
  isAvailable: () => true,
  run: async () => ({ synced: 42 }),      // → result.data = { synced: 42 }
});
```

`kind` 下限是 `read`，但省略 `kind` 时仍按 fail-closed 视为 `write`。
用法见 [函数级工具](https://plingjs.dev/zh/vue/function-level-tools)。

## 不可用 ≠ 不存在

`Binding.isAvailable()` 除了 `true` / `false`，还可以返回 `{ available: false, reason: "先选中至少一条订单" }`。

原因会被带到两个地方：快照里的 `unavailable`（`actions` 之外的单独一段），以及执行时的
`ACTION_UNAVAILABLE` 错误信息。这是必需的 —— 模型的世界观只有动作清单，一个按钮只是从清单里消失，
它就会得出「这个页面没有这个功能」，然后转头告诉用户「做不到」。

`unavailable` **同形状只留一条**（`remove@order:*` 是一类动作，42 行不该产生 42 条一样的原因），
完整数量看 `unavailableTotal` —— 提示层再按形状折叠，最终只占几行 token。

## 变更证据：执行成功 ≠ 生效

执行流水线在**成功路径**上取执行前后两份快照，把差异放进回执：

```json
{ "ok": true, "action": { "id": "toggle@t4", "description": "…" },
  "changed": { "observed": true,
               "records": { "updated": [{ "id": "t4", "fields": ["已完成"] }],
                            "added": [], "removed": [], "reordered": false,
                            "omitted": { "added": 0, "removed": 0, "updated": 0 } } } }
```

- `records.added` / `removed` / `updated` / `reordered` / `total`：行级变化（**顺序**单独报 ——
  拖拽之后集合与字段都没变，只比集合会误判成「无变化」）；
- `actions`：动作清单的增减（筛选 / 删除会带来成批的行内动作变化，只报数量 + 前几个）；
- `state`：状态视图里哪些 key 变了；
- `observed: false` → 回执里多一句**告警**：`No change was observed between snapshots`（这一页只暴露了 N 条记录 / M 个动作…）。
  是告警不是错误：动作确实执行了，报成错误只会让模型白白重试。

两个开关 / 前提：

- `createExecutor({ evidence: false })` 关掉（大页面 / 高频动作；失败路径本来就不取快照）；
- after 快照要在 **DOM 落地之后**取（`createExecutor({ settle })`）——
  Vue 的 `v-for` / `v-if` 下一 tick 才生效，不等就会把「删了一行」报成「无变化」，那是假证据。

见 [记录、行内动作与变更证据](https://plingjs.dev/zh/vue/records-row-actions-and-change-evidence)。

## 记录（行数据）

```ts
registry.declareRecord({ id: "SO-1001", fields: { 客户: "华远科技", 金额: 3200 } });
registry.snapshot().records;      // [{ id, fields, source: "declared" }, …]
registry.snapshot().recordsTotal; // 42（含被上限 / 区域裁掉没列的）
registry.snapshot().recordIds;    // 活跃区域内的可引用 id（默认最多 200 条）
registry.snapshot().recordIdsTotal;
registry.snapshot().offscreenRecordActions; // 行内动作当前不可见，但执行前可 reveal
```

动作是**元素级**的（42 行列表 = 126 个 id；`@plingjs/agent` 会把同类行内动作折叠成一条 `record` 模板，把 `O(行 × 动作)` 收成 `O(动作)`），记录是**行级**的（O(字段)）——
有它模型才能「基于数据判断」，而不是照着动作清单点名。字段在**组装快照时**才读
（接受函数：适配器借此做实时读 + 解包框架的 ref），并走 `sanitizeState` 的有界序列化；
条数上限默认 30（`createRegistry({ recordLimits })`），裁掉的部分**只报数、不静默**。

`records` 与 `recordIds` 是两笔账：前者带字段，受 `maxRecords`（默认 30）限制；
后者只带 id，受 `maxRecordIds`（默认 200）限制。长列表滚到中段时，目标行即使不在字段列表里，
仍可以被行内动作的 `record` 参数引用。活跃区域内、但 `isVisible()` 为 false 的行内动作
进入 `offscreenRecordActions`（带 `offscreen: true`），不会混进可见的 `actions`。
执行器在权限通过后会调用 `Binding.reveal()`，等 `settle()` 落定，再重新检查可见性与可用性；
没有 reveal / reveal 失败 / 滚完仍不可见都会返回 `ACTION_UNAVAILABLE`，不会静默执行。

```ts
// 存在感：core 只发通知，不渲染
interface Binding {
  presence?(state: "acting" | "waiting" | "idle"): void; // idle 在 finally 里发
}
```

普通动作是 `acting → run() → idle`，handoff 是 `waiting → 等用户 → idle`；
动作不可用 / 找不到时不发。怎么画由适配器决定（Vue 默认光圈，见案例 035）。

分步指引：`handoff.steps` 是给人看的步骤，不产生动作。每一步的 `highlight`
先查 `registry.declareGuideTarget()` 登记的纯视觉目标，再回退到同 id 的动作；切步时旧目标
`idle`、新目标 `waiting`，结束时全部 `idle`。`GuideTarget` 不进动作清单、不进快照。

```ts
registry.declareGuideTarget("captcha_input", {
  presence: (state) => presence?.mark(captchaEl, state),
});
```

见 [确认与人工接力](https://plingjs.dev/zh/vue/confirmation-and-human-handoff)。

### 敏感数据

```ts
import { sensitive } from "@plingjs/core";

registry.declareRecord({
  id: "SO-1",
  fields: { 手机: sensitive("13812341234", "token"), 证件: sensitive("110...", "masked") },
});
registry.expose({ key: "me", read: () => ({ phone: sensitive(phone) }) });
```

- `sanitizeState(value, limits, { vault })`：先脱敏再裁剪；没有 vault 时 `token` 退化为隐藏；
- `Registry.tokens`：`tokenOf` / `resolve` / `redact` / `unknownTokens`；
- `Registry.resolveSensitiveArgs(args)`：执行器在参数校验前调用，未知代号 → `INVALID_ARGS`；
- `Registry.redactText(text)`：出站反向脱敏（回执 / 错误 / 反馈）。

同一个记录 id 允许多份声明（列表行 + 详情区是常见写法）：快照取**第一份**，
第一份注销后下一份自动接棒 —— 归档 / 删除掉列表行时，详情区的记录不会跟着凭空消失。

它是**读**：不产生任何可执行动作，所以「未注册不兜底」不受影响。

## 页面反馈

```ts
registry.declareFeedback({
  id: "customer_required",
  message: () => errors.customer,
  field: "customer",
  severity: "error",
  scope: "intake_form",
});

registry.snapshot().feedback;      // [{ id, message, severity, field?, scopePath?, source }]
registry.snapshot().feedbackTotal; // 含因上限 / 区域不活跃没列出的
```

反馈解释「为什么没成」：`message` 给原因，`field` 给该改哪个输入，`scopePath` 给区域。
它和 record 一样是只读数据，有界序列化 / 区域裁剪 / 同 id 先到先得；
`createRegistry({ feedbackLimits: { maxFeedback, maxMessage } })` 控制上限。

`diffSnapshots()` 也比 feedback：新增 / 消失 / 同 id 文案变化都会让 `observed = true`。
这样一次「没有新增记录、但页面出现校验错误」的提交不会被误报成「无变化」。

见 [页面反馈、目标高亮与人工指引](https://plingjs.dev/zh/vue/page-feedback-target-highlighting-and-human-guidance)。

运行：`pnpm --filter @plingjs/core test`
