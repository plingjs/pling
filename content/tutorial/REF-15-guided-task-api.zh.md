---
id: REF-15
title: "引导任务 API"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 引导任务 API

引导任务处理的是这样一类场景：用户清楚自己要的结果，却说不清中间步骤。API 提供两种接入方式：

- `pling.task.goal()` 只声明目标、约束和成功条件。字段来自真实页面，执行走真实动作。这是默认方式。
- `pling.task.define()` 声明字段、步骤和运行控制器。只有页面动作无法表达校验、查找或固定顺序时才使用。

两种方式共用任务目录、权限、确认和审计。目标不会另建执行通道，进阶任务也不会。

```ts
import type { TaskGoalInput } from "@plingjs/agent";
```

## 先选路径

| 需求 | 使用 |
| --- | --- |
| 一句话操作现有表单，随后保存 | `v-scope` + `v-record` + `v-tool`，不需要任务 API |
| 结果要在弹窗关闭或路由变化后继续存在 | `pling.task.goal()` |
| 要固定任务入口、取消和完成记录 | `pling.task.goal()` |
| 外部 Agent 需要任务说明和完成边界 | `pling.task.goal()` |
| 字段需要类型、范围、正则或业务校验 | 进阶 `define()` + `TaskField` |
| 大集合需要异步查找和候选确认 | 进阶 `define()` + `lookup` |
| 多个动作必须按固定顺序执行 | 进阶 `define()` + `TaskStep` |
| 任务在无界面宿主里运行 | `createTaskController()` |

大多数页面停在第一行或第二行。不要因为“要接 Agent”就先写字段表。

## 最小接入：goal()

```ts
const disposeGoal = pling.task.goal(courseGoal(props.locale));
onBeforeUnmount(disposeGoal);
```

`goal()` 返回注销函数。组件卸载时调用它，目标和它的引导一起移除。

`goal()` 注册的是目标，不是工作流。它不接受字段、步骤、控制器、表单工具或业务回调。完整参数如下。

### TaskGoalInput

| 属性 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | `string` | 是 | 无 | 稳定目标 id，在同一目录内唯一 |
| `title` | `string` | 是 | 无 | 面向人的目标名称 |
| `goal` | `string` | 是 | 无 | 要达成的结果。不能为空 |
| `description` | `string` | 否 | 取 `goal` | 目标卡或任务列表里的补充说明 |
| `constraints` | `readonly string[]` | 否 | 无 | 模型必须守住的边界，例如页面动作是唯一入口、上传必须由人完成 |
| `successCriteria` | `readonly string[]` | 否 | 无 | 可观察的完成条件，例如新记录出现在列表第一位 |
| `examples` | `readonly string[]` | 否 | 无 | 用户可能说出的示例句子 |
| `risk` | `read` / `write` / `danger` | 否 | `write` | 目标级风险提示；动作仍执行自己的风险规则 |
| `route` | `string \| readonly string[] \| (page) => boolean` | 否 | 全路由 | 限制目标可以从哪些路径或路由名启动 |
| `scope` | `string \| readonly string[]` | 否 | 无限制 | 列出的区域必须全部活跃，目标才可用 |
| `keepActive` | `boolean` | 否 | `true` | 显式启动后，路由或区域暂时不匹配时是否保留 |
| `labels` | `TaskGuideLabels` | 否 | 内置文案 | 覆盖运行中、已完成等标签 |
| `cancelLabel` | `string` | 否 | `Cancel task` | 取消按钮文案 |
| `stepSubtitle` | `string` | 否 | 内置文案 | 紧凑目标卡的副标题 |

示例：

```ts
const goal: TaskGoalInput = {
  id: "course.create",
  title: "创建课程",
  goal: "在课程管理里新建一门课程：自己打开真实表单，按用户给出的信息填写，封面请用户上传，保存后回读课程库确认新课程在第一位。",
  constraints: [
    "页面上的动作是唯一操作入口；不要另造字段名、选择器或表单。",
    "只填写用户明确给出或明确委托的内容；不确定就问。",
    "封面必须由用户亲自上传，你不能替用户选择本地文件。",
    "用户的问题、修改、暂停和放弃优先于继续填表。",
  ],
  successCriteria: [
    "新课程出现在课程库第一位",
    "名称、老师、可用卡和封面与用户确认的一致",
    "保存动作已回读课程库并确认了这条新记录",
  ],
  examples: ["创建孕妇瑜伽，陈静，2 星，月卡，介绍自动填写"],
  cancelLabel: "取消任务",
};
```

### 它注册了什么

`goal()` 内部会：

1. 创建一份没有字段的 `TaskDefinition`，把 `goal` 写进 `objective`；
2. 创建一张紧凑引导卡，只有标题、目标、取消和完成状态；
3. 默认 `keepActive: true`；
4. 注册 `pling_start_task`、`pling_cancel_task`、`pling_complete_task` 三条生命周期动作；
5. 把目标、约束、成功条件和示例投影给模型。

它不会：

- 打开弹窗；
- 读取或写入表单；
- 调用保存函数；
- 放宽任何动作的权限；
- 生成第二套页面。

### 目标的生命周期

```ts
const active = pling.task.active();
active?.goal;                  // true
active?.startedBy;             // "page" | "agent"
active?.state.snapshot?.status; // "running" | "done"
active?.state.completed;       // boolean
```

启动方式有两种：

- 页面调用 `pling.task.activate("course.create")`；
- 模型调用 `pling_start_task`，并传 `task: "course.create"`。

启动只改变任务目录状态。目标不会调用页面上任何函数。真实页面仍然停在原处，等模型调用 `new_course` 等动作。

目标状态只有两种：

| 状态 | 含义 |
| --- | --- |
| `running` | 目标已启动，尚未完成或取消 |
| `done` | 页面满足成功条件，模型调用了完成动作 |

取消后目标从 active 状态移除，不保留 `cancelled` 快照。已经写进页面的值不回滚。

### 完成与取消

模型在目标激活后会看到 `pling_complete_task`：

```json
{
  "task": "course.create"
}
```

这条动作只关闭目标。它不保存、不提交、不改业务数据。模型只能在页面已经满足成功条件时调用。通常顺序是：

1. 调用页面保存动作；
2. 保存动作的 `expect` 回读结果；
3. 回读通过；
4. 调用 `pling_complete_task`。

如果保存还没发生，模型不应该完成目标。目标卡显示已完成，只代表生命周期结束，不代表又执行了一次写入。

取消由人点目标卡上的按钮，或模型调用 `pling_cancel_task`。取消只结束目标。页面上的草稿和已填值保持原样。

### 模型看到什么

目标激活后，系统提示会包含：

```text
Active task: course.create — 创建课程
Objective: 在课程管理里新建一门课程……
Constraints: 页面上的动作是唯一操作入口；……
Success criteria: 新课程出现在课程库第一位 | ……
Started by: agent
Mode: goal only. The page's real actions are the only way to operate the page.
```

同时明确告诉模型：

- 这个任务没有字段 schema；
- 不要调用 `pling_update_task`；
- 不要发明字段名或第二张表单；
- 用页面真实动作操作；
- 页面满足成功条件后调用 `pling_complete_task`。

目标没有字段时，`pling_update_task` 不可用。模型不会看到一份空的字段表，也不会被要求逐项填写。

## TaskCatalog

`createTaskCatalog()` 管理“当前页面此刻有哪些任务”。它不执行任务，只负责可用性、激活、命令转发和向模型投影任务清单。

```ts
import { createTaskCatalog } from "@plingjs/agent";

const catalog = createTaskCatalog({
  registry: pling.registry,
  isScopeActive: (id) => pling.registry.isScopeActive(id),
});
```

Vue 3、React、Vue 2.7 和原生 JS 的适配器都通过 `pling.task` 暴露同一份目录。页面通常直接调用 `pling.task.goal()`、`pling.task.define()` 和 `pling.task.active()`。

### 属性

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `actionId` | `readonly string` | 当前实际绑定的 `pling_start_task` id |
| `updateActionId` | `readonly string` | 当前实际绑定的 `pling_update_task` id |
| `focusActionId` | `readonly string` | 指向已声明引导字段的动作 id |
| `reviewActionId` | `readonly string` | 打开页面只读核对的动作 id |
| `proposeSaveActionId` | `readonly string` | 打开页面确认步骤的动作 id |
| `cancelActionId` | `readonly string` | 结束 active 引导的动作 id |
| `completeActionId` | `readonly string` | 完成 goal-only 目标的动作 id |

多个运行时共享一个注册表时，读取这些属性，不要假定默认 id。比如第一个目录使用 `pling_start_task`，第二个目录会自动使用 `pling_start_task_2`。

### 方法

| 方法 | 签名 | 行为 |
| --- | --- | --- |
| `goal(input)` | `(input: TaskGoalInput) => () => void` | 注册最小目标，返回注销函数 |
| `define(registration)` | `(registration: GuidedTaskRegistration) => () => void` | 注册进阶任务，返回注销函数 |
| `get(id)` | `(id: string) => GuidedTaskRegistration \| undefined` | 读取一个登记项，即使当前不可用 |
| `list()` | `() => readonly GuidedTaskRegistration[]` | 按注册顺序列出全部任务 |
| `available()` | `() => readonly GuidedTaskRegistration[]` | 列出当前路由和作用域匹配的任务 |
| `active()` | `() => ActiveGuidedTask \| null` | 返回当前展示的任务 |
| `activate(id, options?)` | `(id: string, options?: GuidedTaskActivationOptions) => ActiveGuidedTask` | 显式启动或恢复任务 |
| `deactivate()` | `() => void` | 结束当前任务 |
| `command(command)` | `(command: TaskGuideCommand) => boolean` | 把引导命令转发给 `onCommand` |
| `complete()` | `() => boolean` | 标记当前 goal-only 目标完成；进阶任务返回 `false` |
| `views()` | `() => readonly GuidedTaskView[]` | 当前可用任务的紧凑只读说明 |
| `refresh()` | `() => void` | 通知订阅者实时状态变化 |
| `subscribe(listener)` | `(listener: () => void) => () => void` | 订阅可用性、激活和快照变化 |
| `destroy()` | `() => void` | 注销动作、清理订阅并释放控制器登记 |

`activate()` 的 `options`：

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `values` | `TaskValues` | `{}` | 已提供的字段值；只接受定义中声明过的字段 |
| `startedBy` | `"page" \| "agent"` | `"page"` | 记录由页面还是模型开启 |

目标没有字段，所以 `values` 通常不需要。进阶任务会校验字段名和值。

### ActiveGuidedTask

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 任务 id |
| `definition` | `TaskDefinition` | 本次运行使用的定义 |
| `guide` | `TaskGuideDefinition` | 当前引导，可能没有 |
| `controller` | `TaskController` | 运行控制器；目标层没有 |
| `state` | `TaskGuideState` | 实时渲染状态 |
| `startedBy` | `"page" \| "agent"` | 由谁开启 |
| `goal` | `boolean` | 是否为 `goal()` 创建的紧凑目标 |

## 进阶：define(registration)

只有页面动作无法表达需求时，才使用 `define()`。

```ts
pling.task.define({
  definition: courseDefinition,
  guide: courseGuide,
  controller,
  route: "/courses/new",
  scope: "create-course-form",
  autoStart: true,
  state: () => ({ snapshot: controller.snapshot(), step: currentStep.value }),
  onCommand: (command) => runCourseCommand(command),
});
```

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 否 | 注册 id；默认取 `definition.id`，两者不一致会抛错 |
| `definition` | `TaskDefinition` | 是 | 可执行任务定义 |
| `guide` | `TaskGuideDefinition` | 否 | 用户可见的展示定义；没有 guide 时任务仍可无界面执行 |
| `controller` | `TaskController` | 否 | 任务运行控制器；有 controller 才会真正启动运行 |
| `route` | `GuidedTaskRoute` | 否 | 匹配页面路径或路由名；省略表示不限制 |
| `scope` | `string \| readonly string[]` | 否 | 这些作用域必须全部活跃 |
| `autoStart` | `boolean` | 否 | 上下文匹配时自动展示；默认 `false` |
| `keepActive` | `boolean` | 否 | 显式启动后，上下文暂时不匹配时是否保留；默认 `false` |
| `initialValues` | `TaskValues \| () => TaskValues` | 否 | 自动或显式启动时的初始值 |
| `binding` | `TaskBinding \| () => TaskBinding` | 否 | 当前记录等页面事实 |
| `state` | `() => TaskGuideState` | 否 | 渲染时读取的实时状态 |
| `onActivate` | `(task) => void \| Promise<void>` | 否 | 任务变为 active 后调用 |
| `onDeactivate` | `(task) => void` | 否 | 任务失去 active 状态时调用 |
| `onCommand` | `(command, task) => void \| Promise<void>` | 否 | 接收引导按钮发出的业务命令 |

`define()` 返回注销函数。注销会移除 controller 注册、清理 active 状态并刷新订阅者。

同一时刻只有一个 active guide。自动任务按注册顺序选择；显式激活覆盖当前自动任务。调用 `deactivate()` 后，当前上下文不会立刻重新自动激活。

## TaskDefinition

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 是 | 稳定任务 id |
| `title` | `string` | 是 | 面向人的任务名称 |
| `description` | `string` | 否 | 任务做什么、什么场景下选它 |
| `objective` | `string` | 否 | 任务要达成的结果 |
| `constraints` | `readonly string[]` | 否 | 助手必须守住的边界 |
| `successCriteria` | `readonly string[]` | 否 | 可观察的完成条件 |
| `requiresRecord` | `boolean` | 否 | 必须由页面提供已选记录后才能启动 |
| `examples` | `readonly string[]` | 否 | 任务卡上的示例说法 |
| `fields` | `readonly TaskField[]` | 否 | 工作记忆和需要人做出的决定 |
| `risk` | `read` / `write` / `danger` | 否 | 展示用风险提示 |
| `steps` | `readonly TaskStep[]` | 否 | 确定性业务动作调用 |
| `prompt` | `string \| (values) => string` | Agent 模式必填 | 把任务交给助手时使用的模板 |
| `confirm` | `boolean \| "always"` | 否 | 任务级确认偏好 |

带 `steps` 的定义是确定性任务。没有步骤时进入 Agent 模式，必须提供 `prompt` 或 `prompt(values)`。

## TaskField

字段是用户要做出的决定，不是数据库列。当前店铺、租户、操作人等由服务端确定的事实不要放进字段。

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | 是 | 写入值与步骤参数函数使用的键 |
| `label` | `string` | 是 | 面向人的字段名 |
| `type` | `text` / `textarea` / `number` / `boolean` / `date` / `select` / `lookup` | 否 | 输入控件；默认 `text` |
| `optional` | `boolean` | 否 | 允许为空；默认必填 |
| `placeholder` | `string` | 否 | 输入提示或选择提示 |
| `help` | `string` | 否 | 字段旁的简短说明 |
| `defaultValue` | `TaskValue` | 否 | 运行开始时的初始值 |
| `values` | `readonly TaskChoice[]` | 否 | 小型封闭选项集 |
| `recommended` | `TaskValue` | 否 | 仅在用户明确委托这一项时使用的建议值 |
| `lookup` | `TaskLookup` | 否 | 大集合的异步搜索 |
| `min` / `max` | `number` | 否 | 数值字段的最小值与最大值 |
| `minLength` / `maxLength` | `number` | 否 | 文本长度边界，按去除首尾空白后的字符数计算 |
| `pattern` | `string` | 否 | 不带分隔符的正则源码 |
| `validate` | `(value, values) => string \| null \| undefined` | 否 | 业务级校验，在写入前运行 |
| `searchAction` | `string` | 否 | 为该查找暴露的动作 id；默认 `search_<name>` |
| `minChars` | `number` | 否 | 最少查询字符数；默认 1 |
| `agentWritable` | `boolean` | 否 | 上传、验证码等页面专属值设为 `false`；默认 `true` |

每个 `TaskChoice` 都有稳定的 `value`、给人看的 `label`，以及可选的 `description`，用于区分重名结果。

```ts
const studentField: TaskField = {
  name: "studentRef",
  label: "学员",
  type: "lookup",
  minChars: 2,
  searchAction: "search_students",
  recommended: "student_li_na",
  lookup: async (query, { signal }) => api.searchStudents(query, { signal }),
  validate: (value) =>
    students.some((student) => student.id === value)
      ? null
      : "请从搜索结果中选择学员。",
};
```

这些检查在 `pling_update_task` 写入之前执行。一次提交里只要有字段类型不对、越界、长度不符、正则不匹配或 `validate` 返回原因，整次更新都不会落地。

`validate` 接收本次提交后的候选值视图。它不能绕过字段白名单、`agentWritable`、权限、确认或业务执行器。

## TaskStep

一个步骤调用一个现有动作，不声明第二套执行器。

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 否 | 稳定步骤 id；默认使用从 1 开始的序号 |
| `label` | `string` | 是 | 面向人的步骤名称 |
| `summary` | `string` | 否 | 为什么执行这一步，或在检查什么 |
| `action` | `string` | 是 | 已注册动作或受治理业务操作 |
| `args` | `object \| (values, binding) => object` | 否 | 静态参数、已填字段与绑定的页面事实 |
| `optional` | `boolean` | 否 | 失败记为跳过，后续步骤继续 |
| `handoff` | `boolean \| string` | 否 | 这一步必须由用户在页面上完成 |

`args` 收到字段值与绑定的副本。步骤修改参数对象，不会改到控制器内部保存的状态。

```ts
const approve: TaskStep = {
  label: "在页面上签署审批",
  action: "sign_approval",
  handoff: "这次审批必须由当前用户亲自签署。",
};
```

`handoff` 会把运行暂停在 `waitingFor: "handoff"`。宿主恢复任务时必须自己核对页面。任务层返回一个布尔值，不能证明用户已经完成操作。

## TaskBinding

很多业务任务从表格行或详情页开始。用户点“写备注”时，页面已经知道是哪一节课。

```ts
interface TaskRecordBinding {
  id: string;
  label?: string;
}

interface TaskBinding {
  record?: TaskRecordBinding;
}
```

任务定义用 `requiresRecord: true` 声明这个约定。步骤直接从 `binding.record?.id` 取值，不再把它暴露成字段。

```ts
const addNote: TaskDefinition = {
  id: "lesson.note",
  title: "写课程备注",
  requiresRecord: true,
  fields: [{ name: "note", label: "备注", type: "textarea" }],
  steps: [{
    label: "保存备注",
    action: "update_lesson_note",
    args: (values, binding) => ({
      lessonId: binding.record?.id,
      note: values.note,
    }),
  }],
};

controller.start("lesson.note", {}, {
  record: { id: "lesson_42", label: "瑜伽基础 · 2026-03-16 10:00" },
});
```

`requiresRecord` 为真且没有非空记录 id 时，`start()` 会抛错。通用任务列表应把这类任务显示成入口，而不是允许没有上下文时直接启动。

## createTaskController

```ts
createTaskController(options: {
  invoke: (action, args, context) => unknown | Promise<unknown>;
  now?: () => number;
}): TaskController;
```

`invoke` 是唯一的执行桥。它应调用现有执行器、受治理的 Surface 或业务服务。

执行桥可以返回 `void`、`{ ok: true }` 或现有 `ExecResult`。返回 `error`，或 `result.ok === false`，都算步骤失败。无法识别的返回形状按成功处理，并把结果存进步骤快照。

```ts
const controller = createTaskController({
  invoke: async (action, args, context) => {
    if (context.signal.aborted) throw new Error("已取消");
    return executor.execute(action, JSON.stringify(args));
  },
});
```

### TaskController 方法

| 方法 | 签名 | 行为 |
| --- | --- | --- |
| `register` | `(definition) => () => void` | 添加定义；重复 id 会抛错 |
| `get` | `(id) => TaskDefinition \| undefined` | 读取一个已注册定义 |
| `list` | `() => readonly TaskDefinition[]` | 按注册顺序列出任务 |
| `start` | `(id, values?, binding?) => TaskRunSnapshot` | 启动运行并记录页面事实 |
| `setValue` | `(name, value) => TaskRunSnapshot` | 在收集或就绪阶段更新字段 |
| `plan` | `() => TaskRunSnapshot` | 把字段值冻结为 `planned`，不调用执行桥 |
| `confirm` | `() => TaskRunSnapshot` | 完成待处理的任务级确认 |
| `run` | `() => Promise<TaskRunSnapshot>` | 执行步骤或返回 Agent 提示词 |
| `cancel` | `() => TaskRunSnapshot` | 中止当前步骤并标记为已取消 |
| `reset` | `() => void` | 清空当前运行，不删除定义 |
| `snapshot` | `() => TaskRunSnapshot \| null` | 读取当前运行 |
| `subscribe` | `(listener) => () => void` | 每次状态变化后接收快照 |

开始另一个任务会取消上一次运行。执行开始后不能再改字段。必填字段缺失时调用 `plan()` 或 `run()` 会返回 `collecting` 快照和 `TASK_FIELDS_REQUIRED`，不会调用执行桥。

定义设置了 `confirm` 时，第一次 `run()` 会停在 `planned`，随后停在 `waiting`。由人确认后，宿主调用 `confirm()`，再调用一次 `run()`。

```ts
controller.register({ ...approveOrder, confirm: "always" });
controller.start("order.approve", { orderId: "SO-1001" });

let run = await controller.run();
if (run.status === "waiting" && run.waitingFor === "confirmation") {
  showPlan(run.steps);
  run = controller.confirm();
  run = await controller.run();
}
```

任务级确认不是第二套权限系统。它回答“这份具体计划要不要继续”，底层动作仍执行自己的风险、审批、作用域与审计规则。

### 运行状态

| 状态 | 含义 | 常见下一步 |
| --- | --- | --- |
| `collecting` | 仍缺少必填值 | 填写字段 |
| `ready` | 字段齐全，尚未执行 | `plan()` 或 `run()` |
| `planned` | 计划已确定并可见 | 确认，或开始执行 |
| `running` | 某个步骤正在执行 | 等待，或上报进度 |
| `waiting` | 正在等待确认或人工接力 | `confirm()`，或在页面上完成 |
| `verifying` | 动作已返回，宿主正在核对结果 | 查看证据后继续 |
| `done` | 所有必需步骤已完成 | 展示结果 |
| `failed` | 某个必需步骤失败 | 修正原因或重试 |
| `cancelled` | 运行被取消或被新运行替换 | 需要时重新开始 |

`planned`、`running` 和 `verifying` 不是同一时刻的三个名字。`planned` 表示执行前路线已经冻结；`running` 表示调用正在进行；`verifying` 表示调用已返回，宿主正在读取页面确认结果。

## TaskGuideDefinition

`goal()` 会自动生成一张紧凑引导。进阶任务可以自己声明：

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `taskId` | `string` | 是 | 必须与任务定义 id 一致 |
| `title` | `string` | 是 | 引导卡标题 |
| `compact` | `boolean` | 否 | 只显示目标、取消和完成状态 |
| `welcome` | `string` | 否 | 步骤轨前方的引导说明 |
| `footer` | `string` | 否 | 引导正文下的小字说明 |
| `cancel` | `TaskGuideAction` | 否 | 标题栏离开任务操作 |
| `stepSubtitle` | `string` | 否 | 步骤副标题模板，支持 `{step}` 和 `{total}` |
| `avatar` | `string` | 否 | 短头像文字或首字母 |
| `agent` | `{ focusField?, review?, proposeSave?, cancel? }` | 否 | 模型可以触发的页面命令 |
| `labels` | `TaskGuideLabels` | 否 | 覆盖运行中、已完成、当前、完成、未开始、已跳过与错误文案 |
| `fields` | `readonly TaskGuideField[] \| (snapshot) => readonly TaskGuideField[]` | 否 | 字段轨道的只读投影 |
| `steps` | `readonly TaskGuideStep[]` | 是 | 面向人的步骤；目标卡传空数组 |
| `done` | `{ title?, description? }` | 否 | 完成卡文案 |

`guide.agent` 里的命令只打开页面自己的界面，不执行写入：

- `focusField` 启用 `pling_focus_field`，只做滚动和高亮；
- `review` 启用 `pling_review_task`，打开只读核对；
- `proposeSave` 启用 `pling_propose_save`，打开确认界面；
- `cancel` 启用 `pling_cancel_task`，结束任务。

省略对应命令时，模型看不到该工具；调用返回 `ACTION_UNAVAILABLE`，而不是执行一个没有页面的空动作。

## 更新工作记忆

进阶任务启动后，模型会看到目标、约束、成功判据、字段值、缺口和当前引导步骤。模型可以只回答用户的问题而不写字段，也可以只更新用户补充、修正或委托的一项。

这些变化通过独立的 `pling_update_task` 动作写入：

```json
{
  "task": "course.create",
  "values": { "cards": "月卡" },
  "clear": []
}
```

该动作只在任务 active 且未进入终态时可用；只接受声明过的字段，拒绝 `agentWritable: false` 的页面专属字段；它只更新 `TaskRun.values`，不会直接执行业务写入。页面可以订阅运行快照，把变化同步回原表单。真正的写入仍使用任务声明的动作、执行器、审批、审计和回读验证。

目标任务没有字段，所以 `pling_update_task` 不可用。模型应直接调用页面动作。

## 模型动作

### pling_start_task

任务目录第一次注册任务时，会向当前 registry 绑定一个窄动作：

```ts
{
  id: "pling_start_task",
  kind: "read",
  confirm: false,
  params: {
    task: "string",   // enum 来自当前可用任务 id
    values: "object", // 只有进阶任务有字段属性
  },
}
```

动作只接受当前可用的任务 id。`values` 只允许任务声明过的字段。未知 id 或未知字段返回 `INVALID_ARGS`。

传入值只是预填一次任务运行，不会跳过动作自己的权限、确认和审计。

### pling_complete_task

目标激活后可用。它只关闭 goal-only 目标，不写业务数据。进阶任务使用自己的完成状态，不暴露这条动作。

```json
{
  "task": "course.create"
}
```

调用前必须确认页面已经满足成功条件。仅仅因为用户说了“谢谢”，或因为助手讲完了下一步，不应该调用它。

### pling_cancel_task

取消当前任务。已经写进页面的值不回滚。目标被移除；进阶控制器的运行被取消。

### 其它页面动作

`pling_focus_field`、`pling_review_task`、`pling_propose_save` 只在 active guide 声明对应命令时可用。它们共同遵守一条规则：只改变界面或发出页面命令，不执行业务写入。

## 渲染

Vue 3、React、Vue 2.7 和原生 JS 共用同一份任务状态机和 DOM 渲染器。适配器只负责挂载和暴露方法，不复制执行逻辑。

| 适配器 | 对话承载 | 任务视图 |
| --- | --- | --- |
| Vue 3 | `AgentInline` / `AgentDock` 自动渲染 active guide；`#task` 可覆盖 | 默认内置引导，低层可用 `AgentTaskCard` |
| React | `AgentChat` 或 `AgentDock` 的 `task` 属性 | `AgentTaskCard` |
| Vue 2.7 | `pling.dock({ task })` | `createTaskCard()` |
| 原生 JS | `pling.dock({ task })` | `createTaskCard()` |

普通业务页面不需要写 `#task`。内置助手会订阅任务目录并渲染 active guide。

```vue
<AgentInline
  title="页灵助手"
  :debug="{ maxCalls: 8 }"
  collapsible
  speakers
  composer="multiline"
  task-placement="inline"
/>
```

目标卡只显示目标、取消和完成，不包含表单控件。唯一的输入框是底部聊天框。要填表，仍然在页面上填。

## Surface 任务

外部 Agent 可以收到同一批业务任务，作为描述性元数据：

```ts
const tasks: SurfaceTask[] = [{
  id: "course.create",
  title: "创建课程",
  goal: "在课程管理里新建一门课程并回读课程库",
  constraints: ["页面动作是唯一入口", "封面由用户上传"],
  successCriteria: ["新课程出现在课程库第一位"],
  risk: "write",
  playbook: ["先调用 new_course 打开真实表单", "只在保存回读通过后完成目标"],
}];
```

Surface 任务解释能力之间怎样配合。它不授予能力、不扩大会话范围，也不绕过审批。`invoke` 仍要经过现有暴露清单、执行器与审计路径。

## 错误码

| 错误码 | 含义 | 恢复方式 |
| --- | --- | --- |
| `TASK_FIELDS_REQUIRED` | 缺少必填值 | 补全字段后重新运行 |
| `TASK_ACTION_FAILED` | 执行桥返回业务失败 | 阅读信息、修正原因、重试 |
| `TASK_STEP_FAILED` | 执行桥抛出异常或拒绝 | 重试或修改任务输入 |
| `ACTION_UNAVAILABLE` | 当前任务或动作不可用 | 检查 active 状态、目标和作用域 |
| `INVALID_ARGS` | 未知任务、未知字段或值不合法 | 修正调用参数 |

未知任务 id、未知字段名、重复定义、缺少绑定记录，以及执行开始后修改字段会同步抛错。这些属于编程或宿主错误，不应作为面向用户的失败状态。

## 当前边界

- 目标不提供 Planner，也不自动生成步骤。
- 目标不执行任何业务动作；它只管理生命周期。
- 一个控制器同时只有一个活动运行；并行业务任务需要独立控制器。
- 步骤结果会交给宿主，但后续步骤只接收字段值与绑定，不自动串联前一步结果。
- 四个适配器共用同一份 DOM 渲染器。
- 对话任务卡负责入口、决定、进度与接力；页面原有表单和控件仍是业务输入的事实来源。
- Surface 任务只是描述。Agent 需要更多上下文时仍要调用 `describe`，并遵守会话作用域。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/agent`、`@plingjs/vanilla`、`@plingjs/surface` `0.1.0-alpha.10` |
| 引入版本 | `0.1.0-alpha.6` |
| `goal()` 引入版本 | `0.1.0-alpha.9` |
| 运行环境 | 支持 ES2022 模块的浏览器；任务控制器在 Node.js 20 或更高版本可用 |
| Peer 依赖 | 无 |
| 稳定性 | 实验性；快照可能增加字段，但不会改变已有字段的含义 |

任务控制器不依赖 DOM。`createTaskPanel` 与 `createTaskCard` 是 `@plingjs/vanilla` 中的参考渲染器；各适配器渲染同一份 `TaskRunSnapshot`，而不是另写一套执行逻辑。

`goal()` 是推荐入口。`define()` 保留给需要字段校验、查找、固定步骤或无界面运行的场景。
