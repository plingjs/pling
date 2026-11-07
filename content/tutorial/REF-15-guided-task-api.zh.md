---
id: REF-15
title: "引导任务 API"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 引导任务 API

引导任务处理的是这样一类场景：用户清楚自己要的结果，却说不清中间步骤。定义描述目标、约束、成功判据和工作记忆字段；确定性的业务写入可以使用有序步骤，但对话不是逐字段脚本。所有界面渲染同一份任务快照。

API 在 `@plingjs/agent`，参考 DOM 面板在 `@plingjs/vanilla`。两者都不另建权限模型。宿主注入的仍是页面已经在用的执行器、Surface 或业务服务。

```ts
import {
  createTaskController,
  type TaskDefinition,
  type TaskRunSnapshot,
} from "@plingjs/agent";
```

## 组成

| 组成 | 回答什么 | 不做什么 |
| --- | --- | --- |
| `TaskDefinition` | 目标、约束、成功判据、工作记忆，以及可选的确定性步骤 | 不执行，也不批准任何东西 |
| `TaskRunSnapshot` | 用户此刻应该看到什么 | 不持有模型会话 |
| `TaskInvoke` | 调用交给哪个现有执行器 | 不新增传输层或权限规则 |
| `GuidedTaskPanel` | 怎样用普通 DOM 把一次运行渲染成完整面板或对话卡片 | 不替代框架组件，也不执行任务 |

带 `steps` 的定义是确定性任务；没有步骤时进入 Agent 模式，必须提供 `prompt` 或 `prompt(values)`。

## TaskDefinition

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 是 | 稳定任务 id，在同一控制器内唯一 |
| `title` | `string` | 是 | 面向人的任务名称 |
| `description` | `string` | 否 | 任务做什么、什么场景下选它 |
| `objective` | `string` | 否 | 任务要达成的结果 |
| `constraints` | `readonly string[]` | 否 | 助手在协助过程中必须守住的边界 |
| `successCriteria` | `readonly string[]` | 否 | 怎样才算真正完成，必须可观察 |
| `requiresRecord` | `boolean` | 否 | 必须由页面提供已选记录后才能启动 |
| `examples` | `readonly string[]` | 否 | 任务卡上的示例说法 |
| `fields` | `readonly TaskField[]` | 否 | 当前工作记忆，以及可能需要人做出的决定 |
| `risk` | `read` / `write` / `danger` | 否 | 展示用风险提示；动作仍执行自己的风险规则 |
| `steps` | `readonly TaskStep[]` | 否 | 确定性业务动作调用；存在时进入步骤模式 |
| `prompt` | `string \| (values) => string` | Agent 模式必填 | 把任务交给助手时使用的模板 |
| `confirm` | `boolean \| "always"` | 否 | 任务级确认偏好 |

`examples` 只负责填入表单，不能直接执行写操作。这样一条建议不会变成误触的命令。

## 绑定当前记录

很多业务任务从表格行或详情页开始。用户点「写备注」时，页面已经知道是哪一节课、哪张订单或哪个会员。再让用户在表单里输入这个 id，既别扭又容易出错。

`TaskBinding` 承载页面事实，它不是另一份字段值。

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

panel.open("lesson.note", {}, {
  record: { id: "lesson_42", label: "瑜伽基础 · 2026-03-16 10:00" },
});
```

`requiresRecord` 为真且没有非空记录 id 时，`start()` 会抛错。通用任务列表应把这类任务显示成入口，而不是允许在没有上下文时直接启动的按钮。

## TaskField

字段是用户要做出的决定，不是数据库列。当前店铺、租户、操作人等由服务端确定的事实不要放进字段。

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | 是 | 写入值与步骤参数函数使用的键 |
| `label` | `string` | 是 | 面向人的字段名 |
| `type` | `text` / `textarea` / `number` / `boolean` / `date` / `select` / `lookup` | 否 | 输入控件；默认 text |
| `optional` | `boolean` | 否 | 允许为空；默认必填 |
| `placeholder` | `string` | 否 | 输入提示或选择提示 |
| `help` | `string` | 否 | 字段旁的简短说明 |
| `defaultValue` | `TaskValue` | 否 | 运行开始时的初始值 |
| `values` | `readonly TaskChoice[]` | 否 | 小型封闭选项集 |
| `recommended` | `TaskValue` | 否 | 仅在用户明确委托这一项选择时使用的建议值 |
| `lookup` | `TaskLookup` | 否 | 大集合的异步搜索 |
| `searchAction` | `string` | 否 | 为该查找暴露的动作 id；默认 `search_<name>` |
| `minChars` | `number` | 否 | 最少查询字符数；默认 1，且不会更低 |
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
};
```

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

`args` 收到的是字段值与绑定的副本。步骤修改参数对象，不会改到控制器内部保存的状态。

```ts
const approve: TaskStep = {
  label: "在页面上签署审批",
  action: "sign_approval",
  handoff: "这次审批必须由当前用户亲自签署。",
};
```

`handoff` 会把运行暂停在 `waitingFor: "handoff"`。宿主恢复任务时必须自己核对页面；任务层返回一个布尔值，并不能证明用户已经完成操作。

## 运行状态

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

`planned`、`running` 和 `verifying` 不是同一时刻的三个名字。`planned` 表示执行前路线已经冻结；`running` 表示调用正在进行；`verifying` 表示调用已返回，页面正在被读取以确认结果。把它们合并，进度界面就会误导用户「事情到底做没做」。

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

## TaskController 方法

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

任务级确认不是第二套权限系统。它回答的是「这份具体计划要不要继续」，底层动作仍执行自己的风险、审批、作用域与审计规则。任务不可能批准一个执行器本来就会拒绝的动作。

## 任务目录（TaskCatalog）

`createTaskCatalog()` 管理“当前页面此刻有哪些任务”。它不执行任务，只负责可用性、激活、命令转发和向模型投影任务清单。

```ts
import { createTaskCatalog } from "@plingjs/agent";

const catalog = createTaskCatalog({
  registry: pling.registry,
  isScopeActive: (id) => pling.registry.isScopeActive(id),
});
```

Vue 3 通过 `pling.task` 暴露同一份目录，并把任务目录与任务控制器合并成一个对象。因此页面通常直接调用 `pling.task.define()`、`pling.task.active()` 和 `pling.task.command()`。

目录暴露 `actionId` 与 `updateActionId`。前者是当前实际绑定的 `pling_start_task` id，后者是当前实际绑定的 `pling_update_task` id。多个运行时共享一个注册表时，应读取这两个属性，而不是假定默认 id。

### define(registration)

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 否 | 注册 id；默认取 `definition.id`，两者不一致会抛错 |
| `definition` | `TaskDefinition` | 是 | 可执行任务定义 |
| `guide` | `TaskGuideDefinition` | 否 | 用户可见的展示定义；没有 guide 时任务仍可无界面执行 |
| `controller` | `TaskController` | 否 | 任务运行控制器；有 controller 才会真正启动运行 |
| `route` | `string \| readonly string[] \| (page) => boolean` | 否 | 匹配页面路径或路由名；省略表示不限制路由 |
| `scope` | `string \| readonly string[]` | 否 | 这些作用域必须全部活跃；省略表示不限制区域 |
| `autoStart` | `boolean` | 否 | 上下文匹配时自动展示；默认 `false` |
| `initialValues` | `TaskValues \| () => TaskValues` | 否 | 自动或显式启动时的初始值 |
| `binding` | `TaskBinding \| () => TaskBinding` | 否 | 当前记录等页面事实 |
| `state` | `() => TaskGuideState` | 否 | 渲染时读取的实时状态；`snapshot` 缺省时自动取 controller 快照 |
| `onActivate` | `(task) => void \| Promise<void>` | 否 | 任务变为 active 后调用，适合同步表单、打开弹窗、定位字段 |
| `onDeactivate` | `(task) => void` | 否 | 任务失去 active 状态时调用 |
| `onCommand` | `(command, task) => void \| Promise<void>` | 否 | 接收引导按钮发出的业务命令 |

`define()` 返回注销函数。注销会同时移除 controller 注册、清理 active 状态并刷新订阅者。

登记项提供 `controller` 时，目录会订阅它的运行状态。`setValue()`、`run()`、`cancel()` 等操作产生的新快照会继续通知目录订阅者。因此 Vue 3 的内置 `AgentInline` / `AgentDock` 不需要页面手动调用 `refresh()`，步骤、忙碌态、错误和完成结果会随运行更新。

同一时刻只有一个 active guide。自动任务的优先级按注册顺序；显式激活会覆盖当前自动任务。上下文不再匹配时，显式激活会被清除。调用 `deactivate()` 后，该上下文不会立刻重新自动激活；直到路由或可用任务集合发生变化才恢复。

### 激活与状态

```ts
const task = catalog.activate("course.create", {
  values: { name: "瑜伽基础" },
  startedBy: "agent",
});

catalog.active();   // ActiveGuidedTask | null
catalog.available(); // 当前上下文中可用的注册项
catalog.command({ action, step: null, stepIndex: 0, done: false });
catalog.deactivate();
```

`activate()` 会拒绝该任务未声明的字段，返回 `INVALID_ARGS`，不会留下半激活状态。

### 更新工作记忆

任务启动后，模型会看到目标、约束、成功判据、字段值、缺口和当前引导步骤。这份状态每轮重建。模型可以只回答用户的问题而不写字段，也可以只更新用户补充、修正或委托的一项。

这些变化通过独立的 `pling_update_task` 动作写入：

```json
{
  "task": "course.create",
  "values": { "cards": "月卡" },
  "clear": []
}
```

该动作只在任务 active 且未进入终态时可用；只接受声明过的字段，拒绝 `agentWritable: false` 的页面专属字段；它只更新 `TaskRun.values`，不会直接执行业务写入。页面可以订阅运行快照，把变化同步回原表单。真正的写入仍使用任务声明的动作、执行器、审批、审计和回读验证。

`ActiveGuidedTask` 包含：

| 属性 | 说明 |
| --- | --- |
| `id` | 任务 id |
| `definition` | 可执行定义 |
| `guide` | 展示定义，可能没有 |
| `controller` | 任务控制器，可能没有 |
| `state` | 当前渲染状态 |
| `startedBy` | `page` 或 `agent`，用于诊断和后续策略 |

`activate()` 的 `values` 只能包含 `definition.fields` 声明过的字段。未知字段会抛 `INVALID_ARGS`，不会留下半激活状态。

### 模型动作：pling_start_task

任务目录第一次注册任务时，会向当前 registry 绑定一个窄动作：

```ts
{
  id: "pling_start_task",
  kind: "read",
  confirm: false,
  params: {
    task: "string",   // enum 来自当前可用任务 id
    values: "object", // properties 按当前任务字段生成
  },
}
```

`values` 不是任意对象。任务目录会把当前可用任务的字段合并成一个显式的 `properties` schema：字段类型、说明、可选性、枚举候选和 lookup 动作都会写进去，并设置 `additionalProperties: false`。多个任务使用同名字段时，说明会列出它们分别属于哪些任务。

JSON Schema 不能根据 `task` 的值动态切换形状，所以这份 schema 描述的是“当前页可能出现的字段集合”。真正启动时，`activate()` 还会按所选任务再次校验字段白名单，模型不能把另一项任务的字段混进来。

```json
{
  "task": "course.create",
  "values": {
    "name": "晨间瑜伽",
    "teacherId": "teacher_18",
    "cards": ["monthly"]
  }
}
```

模型只能选择当前可用任务。不存在或当前不可用的 id 返回 `INVALID_ARGS`；未知字段同样拒绝。动作本身只读，不会直接写业务数据。启动后，真正的业务写入仍然经过任务步骤对应的动作、执行器、确认和审计。

只应由引导路径调用的写动作，可以在登记时设 `modelVisible: false`。它不会进入模型的工具清单或动作快照，但注册表仍保留这个动作，页面按钮与任务步骤照常可以调用。

```ts
useAgentTool({
  id: "create_course",
  desc: "创建课程",
  kind: "write",
  modelVisible: false,
  params: [{ name: "name", label: "课程名称" }],
  run: ({ name }) => api.createCourse(String(name)),
});
```

上例是 Vue 3 / React 的函数动作写法；Vue 2 与原生 JS 把同一组字段传给 `pling.action()`。

这只是一条“别把入口摆给模型”的可见性边界，不是权限系统。真正的越权拦截仍由执行器的风险规则、作用域、业务 API 和审计完成；`modelVisible: false` 也不能阻止页面代码或任务步骤调用它。

动作只在目录里至少有一个任务时出现。页面完全没有引导任务时，快照里不会多出一个永远不可用的工具。多个 `createPling` 实例共享 registry 时，后续目录会自动使用 `pling_start_task_2` 等 id，避免冲突；系统提示里会写实际 id。

## TaskGuideDefinition

`TaskDefinition` 描述必须发生什么，`TaskGuideDefinition` 描述这件事怎样讲给人听。两者用同一个 `taskId` 关联，但不能互相代替：前者可以独立执行，后者不拥有执行权限。

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `taskId` | `string` | 是 | 必须与任务定义 id 一致 |
| `title` | `string` | 是 | 引导卡标题 |
| `welcome` | `string` | 否 | 步骤开始前的简短说明 |
| `footer` | `string` | 否 | 卡片底部的小字提示 |
| `cancel` | `TaskGuideAction` | 否 | 标题栏的离开任务操作；渲染器只发出命令，由页面决定是否结束运行 |
| `stepSubtitle` | `string` | 否 | 支持 `{step}` 与 `{total}` 的步骤副标题 |
| `avatar` | `string` | 否 | 内置渲染器使用的短头像文字 |
| `labels` | `TaskGuideLabels` | 否 | 覆盖运行中、已完成、当前、未开始与错误文案 |
| `fields` | `TaskGuideFields` | 否 | 提供后改为紧凑的水平字段轨道；完整步骤卡不再渲染 |
| `steps` | `readonly TaskGuideStep[]` | 是 | 面向人的有序步骤 |
| `done` | `TaskGuideDone` | 否 | 完成文案、摘要与后续命令 |

每个 `TaskGuideStep` 可以显示只读摘要、指向页面上的原控件、等待用户亲自完成，或发出一个业务命令。按钮只携带 `command` 字符串，由页面的 `onCommand` 决定它表示什么；引导层不会因为多了一个按钮就多出一条执行路径。

```ts
const guide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "新建课程",
  welcome: "我会陪你确认课程信息，并填入右侧表单。",
  stepSubtitle: "第 {step} 步，共 {total} 步",
  steps: [
    {
      id: "name",
      label: "课程名称",
      title: "先填写课程名称",
      description: "我已经定位到右侧的名称输入框。",
      handoff: {
        title: "由你确认名称",
        description: "填写后回到对话，我会继续检查。",
      },
      primary: { label: "我已填好", command: "name.done" },
    },
  ],
  done: {
    title: "课程已创建",
    description: "课程列表的第一条就是新课程。",
  },
};
```

步骤里的只读摘要由 `TaskGuideRow` 组成。它最重要的字段不是 `value`，而是 `status`：页面已经存在的值、尚未写入的建议值、仍然缺失的值，必须让用户一眼分清。

### 紧凑字段轨道

当任务要在聊天面板顶部常驻、又不能挤占对话空间时，传 `fields`。渲染器只保留标题、阶段状态和一行可横向滚动的字段节点：已填写的节点显示勾，必填与可选各自标注。点击节点默认发出 `focus-<field>`，由页面把对应控件滚进视野。字段的推荐值、解释和下一步提示放在对话里，不塞进固定区。

```ts
const guide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "创建课程",
  stepSubtitle: "课程管理 · 第 {step} 步，共 {total} 步",
  fields: () => [
    { field: "name", label: "课程名称", required: true, filled: Boolean(draft.name) },
    { field: "difficulty", label: "难度", filled: Boolean(draft.difficulty), suggested: true },
    { field: "cover", label: "课程封面", required: true, filled: draft.cover },
  ],
  steps: [/* 业务阶段，仅用于标题里的第几步 */],
};
```

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `field` | `string` | 是 | 页面字段名；默认命令为 `focus-<field>` |
| `label` | `string` | 是 | 节点上的短标签 |
| `required` | `boolean` | 否 | 是否必填；渲染为“必填”或“可选” |
| `filled` | `boolean` | 否 | 页面当前是否已有值；有值时显示勾 |
| `suggested` | `boolean` | 否 | 有推荐值但尚未写入页面，节点使用虚线强调 |
| `command` | `string` | 否 | 覆盖默认定位命令；仍然只通过 `onCommand` 交给页面 |

字段轨道只表达进度和定位，不包含输入框。推荐值、追问与失败解释仍应由对话或页面完成；这样固定区不会随字段数量变高，也不会出现两套表单。

| 属性 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `label` | `string` | 是 | 字段名或业务事实 |
| `value` | `string \| number \| boolean \| null \| undefined` | 是 | 展示值；渲染器只格式化，不修改页面 |
| `format` | `"text" \| "stars" \| "check" \| "number"` | 否 | 显示格式；`stars` 用于 1–5 星，`check` 只接受布尔语义的值 |
| `status` | `"current" \| "suggested" \| "missing"` | 否 | 值来自页面、建议，还是尚未填写 |
| `badge` | `string` | 否 | 业务自有短标记，例如“已填入”“建议”“待填写” |
| `note` | `string` | 否 | 来源或帮助文字；建议值应在这里写明“尚未写入页面” |
| `action` | `TaskGuideAction` | 否 | 行级命令，例如“采用”“定位”“去选择”，仍走 `onCommand` |

```ts
const rows: TaskGuideRow[] = [
  {
    label: "课程名称",
    value: "瑜伽基础",
    status: "suggested",
    badge: "建议",
    note: "来自示例模板，尚未写入页面",
    action: { label: "采用", command: "apply-name" },
  },
  {
    label: "授课老师",
    value: "周敏",
    status: "current",
    badge: "已填入",
    action: { label: "定位", command: "focus-teacher" },
  },
];
```

Vue 3 的业务页面通常只注册这个定义。`AgentInline` 和 `AgentDock` 会自动读取 active 任务并交给内置 `AgentTaskGuide` 渲染。需要普通 DOM 时，`@plingjs/vanilla` 的 `createTaskGuide()` 使用同一份 `TaskGuideDefinition`；`AgentTaskGuide` 则是对它的 Vue 生命周期封装，供有意替换默认展示的产品使用。

## 紧凑操作行（GuideActionItem）

`TaskGuideRow` 适合“一个字段一行”的摘要；当引导把下一步收敛成几个动作时，用更轻的 `GuideActionItem`。它不渲染字段表格，只渲染一行按钮，任何适配器都可以挂载同一份 DOM。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | `string` | 是 | 测试与宿主记录的稳定 id，不发给模型 |
| `label` | `string` | 是 | 按钮上的短动作，例如“自动填写”“定位 · 课程名称” |
| `command` | `string` | 是 | 点击时发回宿主的业务命令；渲染器不理解它 |
| `kind` | `"primary" \| "secondary" \| "suggestion" \| "skip"` | 否 | 视觉强调；只有 `suggestion` 会渲染 `preview` |
| `preview` | `string` | 否 | 长推荐的单行省略预览，约 `300px` 封顶 |
| `ariaLabel` | `string` | 否 | 可见标签省略字段名或预览被截断时的完整无障碍名称 |
| `disabled` | `boolean` | 否 | 写入进行中时禁用；禁用按钮不会发出命令 |

```ts
const items: GuideActionItem[] = [
  {
    id: "use-note",
    label: "自动填写",
    preview: "请提前 10 分钟到店；开课前 2 小时内不可取消。",
    ariaLabel: "自动填写约课须知：请提前 10 分钟到店；开课前 2 小时内不可取消。",
    command: "apply-note",
    kind: "suggestion",
  },
  { id: "skip-note", label: "跳过", command: "skip-note", kind: "skip" },
];
```

普通 DOM 用 `createGuideActions({ items, hint, ariaLabel, locale, onCommand })`，Vue 与 React 用 `AgentGuideActions`。组件只负责挂载和同步，命令仍由宿主的 `onCommand` 处理。

这里刻意不把长推荐拼进 `label`：一旦按钮宽度由推荐文案决定，操作行就会换行、挤压对话，用户也分不清“这是建议”还是“页面已经写入”。完整值放在聊天正文、`title` 和 `aria-label`；按钮只回答“点它会做什么”。

渲染器位于 `@plingjs/dom`，不依赖任何 UI 框架。Vue 与 React 包只提供生命周期外壳，因此三端的折行、省略、焦点与禁用态只有一份实现。它不会写字段、不会调用业务函数，也不会生成第二条执行路径。

## TaskRunSnapshot

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `taskId` | `string` | 定义 id |
| `title` | `string` | 面向人的任务标题 |
| `mode` | `steps` / `agent` | 确定性步骤或交给助手 |
| `status` | `TaskRunStatus` | 当前运行状态 |
| `fields` | `readonly TaskField[]` | 供界面渲染的字段定义 |
| `values` | `TaskValues` | 当前字段值 |
| `binding` | `TaskBinding` | 提供过页面事实时存在 |
| `steps` | `readonly TaskStepSnapshot[]` | 有序进度与结果 |
| `prompt` | `string` | Agent 模式在字段齐全后生成 |
| `waitingFor` | `confirmation` / `handoff` | 当前在等待什么 |
| `confirmation` | `{ required; confirmed }` | 定义要求确认时存在 |
| `error` | `{ code, message }` | 运行或必需步骤失败时存在 |
| `startedAt` | `number` | 注入时钟的毫秒时间戳 |
| `finishedAt` | `number` | 完成、失败或取消后存在 |

步骤状态是 `pending`、`running`、`ok`、`skipped` 或 `failed`。可选步骤跳过后，错误仍保留在该步骤快照中，整个运行继续。

## TaskRunContext

执行桥收到 `{ taskId, values, binding, signal, report }`。`values` 与 `binding` 是副本。运行被取消或替换时，`signal` 中止。

`report("running")`、`report("waiting", "confirmation" | "handoff")` 与 `report("verifying")` 让长执行桥描述子状态，不必另建一套快照存储。已过期的运行会忽略这些上报。

## 查找动作

`registerTaskLookupActions` 会把每个 lookup 字段注册成窄范围只读动作：

```ts
const off = registerTaskLookupActions(pling, controller.list(), { maxResults: 8 });
```

生成的动作接收 `{ query }`，返回 `{ query, minChars?, choices }`，最多 50 个候选。它不写入、不绕过作用域，也不跳过最终写操作自己的执行器。界面与模型共用同一个 `field.lookup`，所以重名选项在两边看到的是同一批候选。

多个任务共用一份搜索实现时，用 `searchAction` 指定同一个 id。省略时动作 id 是 `search_<fieldName>`；重复 id 会保留第一份实现并发出告警。

## Agent 模式中的提示词模板

Agent 模式用于无法安全固定路径的任务。它只生成提示词，不调用模型。

```ts
controller.register({
  id: "student.summary",
  title: "说明学员会员情况",
  fields: [{ name: "name", label: "学员姓名" }],
  prompt: "请总结 {{name}} 的会员情况，并列出即将到期的会员卡。",
});

controller.start("student.summary", { name: "李娜" });
const snapshot = await controller.run();
// snapshot.prompt 可直接交给 pling.ask()。
```

宿主把 `snapshot.prompt` 交给现有助手入口。任务控制器不持有会话，也不持有模型连接。

## 渲染一次运行

Vue 3 的 `<AgentInline>` 会订阅 `pling.task`，自动把 active guide 渲染在对话里。页面只需注册任务，不必再手写聊天壳或手动挂载 `AgentTaskGuide`。只有需要完全不同的任务展示时，才通过 `#task` 插槽覆盖默认引导。

`@plingjs/vanilla` 仍然提供两种底层外观。`createTaskPanel()` 是完整任务工作区；`createTaskCard()` 是适合放进对话的紧凑任务卡。两者共享字段、查找、执行、确认与失败处理，差别只在展示。

```ts
import { createTaskCard } from "@plingjs/vanilla";

const card = createTaskCard(controller, {
  locale: "zh-CN",
  onPrompt: (prompt) => pling.ask(prompt),
});

pling.dock({
  layout: "sidebar",
  sidebarMode: "fused",
  task: card.element,
});
```

Agent 模式任务会发出 `pling-task-prompt`，运行结束后发出 `pling-task-complete`。`open(taskId, values?, binding?)`、`close()`、`refresh()`、`setCatalog()` 与 `destroy()` 管理任务卡生命周期。

常用任务不必一直占着聊天空间。构造时传 `catalog: false`，由页面按钮或表格行动作调用 `card.open(...)`。`setCatalog(false)` 只在没有活动运行时隐藏任务目录，不会关掉进行中的任务，也不会丢掉已填写内容。

`requiresRecord` 任务在通用列表中显示为不可直接启动。表格行或详情页带着绑定打开它，所以面板可以直接显示已选记录，不再向用户要 id。

### 各框架组件

| 适配器 | 对话承载 | 任务视图 | 打开绑定任务 |
| --- | --- | --- | --- |
| Vue 3 | `AgentInline` / `AgentDock` 自动渲染 active guide；`#task` 可覆盖 | 默认内置引导，低层可用 `AgentTaskCard` | 注册任务后由页面或 `pling_start_task` 激活；低层任务卡可通过 ref 调用 `open(taskId, values?, binding?)` |
| React | `AgentChat` 的 `task` 属性或 `AgentDock` 的 `task` 属性 | `AgentTaskCard` | 通过 `AgentTaskCardHandle` 调用 `open(taskId, values?, binding?)` |
| Vue 2.7 | `pling.dock({ task })` | `createTaskCard()` | 调用 `card.open(taskId, values?, binding?)` |
| 原生 JS | `pling.dock({ task })` | `createTaskCard()` | 调用 `card.open(taskId, values?, binding?)` |

`AgentDock` 还暴露 `open()` 与 `close()`，所以表格行可以先展开助手，再激活对应任务。普通 Vue 3 页面不需要写 `#task`：内置助手会渲染任务目录里的 active guide。

```vue
<template>
  <AgentDock ref="dock" layout="sidebar" sidebar-mode="fused" :default-open="true" />
</template>
```

只有产品确实要换掉任务展示时，才使用 `#task` 插槽；这不是普通业务页面的必需步骤。

```tsx
const dock = useRef<AgentDockHandle>(null);
const card = useRef<AgentTaskCardHandle>(null);

<AgentDock
  ref={dock}
  layout="sidebar"
  sidebarMode="fused"
  defaultOpen
  task={<AgentTaskCard ref={card} controller={tasks} onPrompt={pling.ask} />}
/>;
```

需要独立任务工作区时仍可使用 `createTaskPanel()`。`GuidedTaskPanelOptions.variant` 接受 `"panel"` 或 `"card"`；`createTaskCard()` 是后者的简写。

## 结构化快捷任务

`quick` 仍接受普通字符串。结构化写法把按钮标签和提示词分开，短按钮不必被迫配一句含糊的指令。

```ts
const quick: QuickTaskItem[] = [
  "显示本周未付款订单",
  {
    label: "整理今日待办",
    prompt: "检查今天的待办，归档已完成项，保留未完成项。",
    description: "归档已完成项，其余保持不动。",
  },
];
```

应用明确知道某项目前不可用时，可以用 `disabled: true` 保留入口但禁止触发。

## Surface 任务

外部 Agent 可以收到同一批业务任务，作为描述性元数据：

```ts
const tasks: SurfaceTask[] = [{
  id: "order.approve",
  title: "审批订单",
  steps: [{ action: "approve@order", label: "批准当前订单" }],
  risk: "destructive",
  playbook: ["先读取订单", "确认状态后再审批"],
}];
```

Surface 任务解释能力之间怎样配合。它不授予能力、不扩大会话范围，也不绕过审批。`invoke` 仍要经过现有暴露清单、执行器与审计路径。

## 错误码

| 错误码 | 含义 | 恢复方式 |
| --- | --- | --- |
| `TASK_FIELDS_REQUIRED` | 缺少必填值 | 补全字段后重新运行 |
| `TASK_ACTION_FAILED` | 执行桥返回业务失败 | 阅读信息、修正原因、重试 |
| `TASK_STEP_FAILED` | 执行桥抛出异常或拒绝 | 重试或修改任务输入 |
| 可选字段上的 `TASK_FIELDS_REQUIRED` | 不适用；可选字段不会阻断 | 保持为空即可 |

未知任务 id、未知字段名、重复定义、缺少绑定记录，以及执行开始后修改字段会同步抛错。这些属于编程或宿主错误，不应作为面向用户的失败状态。

## 当前边界

- 任务模型不提供通用 Planner，也不自动生成步骤。
- 一个控制器同时只有一个活动运行；并行业务任务需要独立控制器。
- 步骤结果会交给宿主，但后续步骤只接收字段值与绑定，不自动串联前一步结果。
- 四个适配器共用同一份 DOM 渲染器。框架组件只负责挂载与暴露方法，不复制任务状态机。
- 对话任务卡负责入口、决定、进度与接力；页面原有表单和控件仍是业务输入的事实来源。
- Surface 任务只是描述。Agent 需要更多上下文时仍要调用 `describe`，并遵守会话作用域。

## 版本与兼容性

| 项目 | 取值 |
| --- | --- |
| 适用版本 | `@plingjs/agent`、`@plingjs/vanilla`、`@plingjs/surface` `0.1.0-alpha.7` |
| 引入版本 | `0.1.0-alpha.7` |
| 运行环境 | 支持 ES2022 模块的浏览器；任务控制器在 Node.js 20 或更高版本可用 |
| Peer 依赖 | 无 |
| 稳定性 | 实验性；快照可能增加字段，但不会改变已有字段的含义 |

任务控制器不依赖 DOM。`createTaskPanel` 与 `createTaskCard` 是 `@plingjs/vanilla` 中的参考渲染器；各适配器渲染同一份 `TaskRunSnapshot`，而不是另写一套执行逻辑。
