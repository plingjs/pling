---
id: V3-08
title: "函数级工具"
locale: zh
source_locale: en
translation_status: synced
status: drafted
---

# 函数级工具

上一章让 Agent 看懂任务行。它可以用记录 id 指出某一条任务，对那一行执行动作，并查看暴露页面在操作前后的差异。但此前出现的每个动作仍依附于一个控件：表单、复选框、删除按钮或菜单项。

并非所有业务操作都有这样的控件。应用可能支持把全部未完成待办标记完成，却没有提供批量按钮；也可能已经实现了“导出当前视图”的能力，但只能通过代码调用。本章要解决的是：如何暴露这类实现，而不伪造一个隐藏元素并派发合成点击。

答案是**函数级工具**：动作的实现来自应用函数，而不是 DOM 交互。它与元素动作共用动作身份、可用性、参数校验、策略、执行、成功判据和审计路径。差异只来自一个事实：它没有目标元素。

## 没有控件承载的操作

本章示例是批量操作：把所有未完成待办标记为已完成。页面已经提供每行的复选框，以及用于删除已完成待办的菜单项；它刻意没有“完成全部未完成项”按钮。

一种看似省事的做法，是把 `v-tool` 挂到一个隐藏按钮上，再让动作点击它。这个捷径会带来几个不容易察觉的问题：

- 动作声称操作的是一个人既看不见、也无法到达的元素；
- 可见性、遮挡和滚动规则开始作用在一个虚构目标上；
- 页面多出一个只为 Agent 存在的控件，连同它的键盘与无障碍表面；
- 按钮的样式或事件处理一旦变化，业务函数没变，声明出的操作也可能失效。

这些问题不是理论上的。框架若因为隐藏按钮存在而报告动作可用，模型得到的页面能力描述就失真了。声明应当描述业务操作，而不是描述绕路方案。

## 保留上一章的页面模型

Todo 应用继续保留区域、记录、行内动作、筛选和变更证据。新增内容只有一段普通业务函数和一个工具声明：

```vue{1-7,42-47,74-89}
<script setup lang="ts">
import { computed, ref } from "vue";
import {
  AgentDock,
  useAgentTool,
  type AgentToolOptions,
} from "@plingjs/vue";

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const tasks = ref<Task[]>([
  { id: "t1", text: "Review the launch checklist", done: false },
  { id: "t2", text: "Book the design review", done: false },
  { id: "t3", text: "Send the customer follow-up", done: true },
]);

const remaining = computed(
  () => tasks.value.filter((task) => !task.done).length,
);

function toggleTask(id: string): void {
  const task = tasks.value.find((item) => item.id === id);
  if (task) task.done = !task.done;
}

function completeOpenTasks(): number {
  const openTasks = tasks.value.filter((task) => !task.done);
  for (const task of openTasks) task.done = true;
  return openTasks.length;
}

const completeOpenTasksAction = {
  id: "complete_open_tasks",
  desc: "Mark every open task as completed. This changes all open records in one operation.",
  kind: "write",
  available: () =>
    remaining.value > 0
      ? true
      : "There are no open tasks. Every task is already completed.",
  run: () => ({ completed: completeOpenTasks() }),
  expect: {
    desc: "No task remains open",
    check: () => remaining.value === 0,
  },
} satisfies AgentToolOptions;

useAgentTool(completeOpenTasksAction);
</script>

<template>
  <section
    v-scope="{
      id: 'todo',
      label: 'Tasks',
      description: 'The task list, the composer, and the controls for finding and filtering tasks.',
      role: 'main',
    }"
  >
    <ul>
      <li
        v-for="task in tasks"
        :key="task.id"
        v-record="{
          data: task,
          fields: {
            text: task.text,
            status: task.done ? 'completed' : 'open',
          },
        }"
      >
        <input
          type="checkbox"
          :checked="task.done"
          v-tool="{
            id: `toggle@${task.id}`,
            desc: `Mark “${task.text}” as ${task.done ? 'open' : 'completed'}.`,
            kind: 'write',
          }"
          @change="toggleTask(task.id)"
        />
      </li>
    </ul>

    <AgentDock title="Todo assistant" />
  </section>
</template>
```

模板里没有任何元素代表 `complete_open_tasks`。模型看到的仍是区域和记录；新动作通过共享的任务数组改变这些记录。

这种分离是本章的核心。页面模型回答应用包含什么、允许暴露什么；函数级工具是某项已暴露能力的一种实现。它不需要对应视觉控件，也不应该假装自己有。

## 把函数声明为动作

`useAgentTool` 注册的动作描述与 `v-tool` 相同，只是使用不同的原语：

```ts
const completeOpenTasksAction = {
  id: "complete_open_tasks",
  desc: "Mark every open task as completed. This changes all open records in one operation.",
  kind: "write",
  available: () =>
    remaining.value > 0
      ? true
      : "There are no open tasks. Every task is already completed.",
  run: () => ({ completed: completeOpenTasks() }),
  expect: {
    desc: "No task remains open",
    check: () => remaining.value === 0,
  },
} satisfies AgentToolOptions;

useAgentTool(completeOpenTasksAction);
```

声明里没有 `action`、`target` 或 `fidelity`。没有元素需要点击、填写、按键或解析目标。框架把动作记录为 `call` 原语，保真度为 `high`；这里的高保真表示调用直接到达开发者提供的实现，不表示业务结果正确。

各字段职责不同：

| 字段 | 在本例中的职责 |
| --- | --- |
| `id` | 稳定的模型侧身份与执行键，与所有 `v-tool` id 共用命名空间。 |
| `desc` | 没有可见控件可供推断时，用一句话解释操作。必填。 |
| `kind` | `write` 表示操作会改变应用状态，但它本身不是授权决定。 |
| `available` | 报告当前页面状态下能否尝试该操作。 |
| `run` | 调用既有业务实现一次，并返回有界数据。 |
| `expect` | 声明调用后应用预期应观察到的结果。 |

本例没有输入，因此不需要 `params`。函数需要参数时，规则会在下一节说明。

## 参数必须声明，不能靠推断

函数级工具可以使用与 `v-tool` 相同的 `params` 声明。例如，一个驳回订单的操作可以声明必填的 `reason` 字符串，以及一组有界的原因代码。参数校验发生在策略判断和 `run` 之前，格式不合法的调用不会进入业务函数。

实现是 JavaScript 函数，并不意味着参数会自动得到校验。TypeScript 类型在运行时已经消失，模型也读不到它们。只要参数影响正确性，就应在 `params` 中声明；当操作会到达不可信的服务端边界时，函数内部还应再次校验。

`run` 接收一个已经校验过的参数对象。本章动作没有参数，因此实现忽略该对象并返回 `{ completed: 2 }`。返回值可以省略；存在时会经过框架的有界序列化进入执行结果的 `data`。它适合返回数量、生成的 id 或简短确认，不适合把整张任务表或整个外部响应塞回上下文。

## 可用性是页面状态，不是权限

有两条未完成任务时，`available` 返回 `true`。执行后不再有未完成任务，它返回一句原因：

```text
There are no open tasks. Every task is already completed.
```

这句话会进入页面快照，也会成为 `ACTION_UNAVAILABLE` 结果中的原因。它告诉模型下一步该做什么，而不是让模型猜测一个已知动作为什么消失。

函数级工具没有原生禁用状态、隐藏父元素或被遮挡目标。因此，开发者声明的判断是框架能做的唯一可用性检查。它不能替代授权、租户隔离或服务端校验。没有按钮的操作也可能高度敏感；调用方是否可以尝试，仍由策略决定。

## 一次调用，一个预期结果

`run` 就是整个业务调用：

```ts
run: () => ({ completed: completeOpenTasks() })
```

它不填写隐藏输入框、不点击隐藏按钮，也不叙述一串 DOM 事件。现有状态被直接更新，结果说明改变了多少条记录。保持实现窄小很重要：Agent 需要稳定的业务操作，页面视觉控件则应能变化，而不牵连工具。

成功判据也只声明一次：

```ts
expect: {
  desc: "No task remains open",
  check: () => remaining.value === 0,
}
```

框架在 `run` 之后等待该条件。条件成立时，结果带上判据说明；超时则报告 `EXPECTATION_FAILED`，表示函数已经返回，但没有观察到声明的页面状态。对异步实现而言，这个区别尤其重要：Promise 结束不等同于界面更新完成。

## 结果能够证明什么

业务变化会通过上一章建立的记录体现出来。成功调用返回的结构如下：

```json
{
  "ok": true,
  "action": {
    "id": "complete_open_tasks",
    "description": "Mark every open task as completed. This changes all open records in one operation."
  },
  "expect": "No task remains open",
  "data": { "completed": 2 },
  "changed": {
    "observed": true,
    "records": {
      "added": [],
      "removed": [],
      "updated": [
        { "id": "t1", "fields": ["status"] },
        { "id": "t2", "fields": ["status"] }
      ],
      "reordered": false,
      "omitted": { "added": 0, "removed": 0, "updated": 0 },
      "total": { "from": 3, "to": 3 }
    },
    "actions": {
      "added": [],
      "removed": [],
      "omitted": { "added": 0, "removed": 0 }
    }
  }
}
```

结果分成三层：

- `data.completed` 是函数返回值；
- `expect` 是框架实际观察到的应用判据；
- `changed` 是两份已暴露快照之间的差异。

它们都不是服务端回执。如果任务数组之后还要同步到网络，本地改动成功、随后服务端拒绝，仍可能产生上面的结果。远程正确性重要时，应用需要暴露单独的服务端确认。

变更摘要同样有边界。它只报告已暴露记录及其声明字段，无法证明私下写入了审计行、已经发出邮件，或数据库完成了没有页面投影的写入。

## 如何选择声明方式

三种形式职责不同：

| 声明 | 适用情形 | 重要后果 |
| --- | --- | --- |
| 带浏览器原语的 `v-tool` | 真实控件会接收交互，且其原生行为可靠。 | 动作绑定元素，受目标解析、可见性与遮挡规则影响。 |
| 带 `run` 的 `v-tool` | 真实控件存在，但复现它的 DOM 交互不可靠，或会把一个业务操作拆成多步。 | 动作仍绑定元素；注入路径直接执行业务操作。 |
| `useAgentTool` | 操作已经作为应用逻辑存在，但不应有控件代表它。 | 没有目标、可见性判断、悬停或存在感高亮；可用性完全由开发者声明。 |

不要仅仅为了省掉一份清楚的控件声明而使用函数级工具。真实按钮已经承载操作时，声明按钮通常更容易让用户理解，也更容易让应用审计。只有在“没有控件”本身就是产品事实时，才使用函数级形式。

打开弹窗、填写多个字段再保存之类复合行为，应交给流程层，而不是藏进一个不透明的函数。单个函数级工具应对应一个可以解释清楚的业务操作。

## 常见设计错误

多数错误出在结构，而不是语法：

| 现象 | 原因 | 更好的处理 |
| --- | --- | --- |
| 页面状态不合适时仍能调用工具 | 没有 `available`，或只检查组件是否挂载 | 检查业务前置条件，并返回可读原因。 |
| 调用成功，却没有可见证据 | 函数在页面落定前就返回，或受影响数据没有暴露 | 添加 `expect`，暴露相关记录字段，并等待渲染边界。 |
| 本应被阻止的操作返回成功 | 把 `kind` 或 `available` 当成授权 | 独立执行策略与服务端授权。 |
| 批量操作后上下文迅速膨胀 | `run` 返回了每个对象或整个外部响应 | 只返回数量、id 与有界摘要。 |
| 组件消失后动作仍然存在 | 在未被追踪的 Vue scope 之外调用了 `useAgentTool` | 把注册绑定到组件生命周期，或显式销毁所属运行时。 |

框架会拒绝缺少 `desc` 的声明、拒绝重复动作 id，并让不可用动作连同原因保留在清单里。这些检查避免静默歧义，但不替应用决定业务策略。

## 验证本章示例

从仓库根目录启动：

```bash
pnpm tutorial:dev v3-08 --locale zh
```

打开 `http://127.0.0.1:5218/?lang=zh`。英文界面使用 `pnpm tutorial:dev v3-08` 和 `http://127.0.0.1:5218/`。

依次检查：

1. 对助手说：`把所有未完成待办都标记为已完成。` 两条未完成行应变为已完成，记录字段与可见勾选状态同时更新。
2. 打开最近操作。`complete_open_tasks` 的执行记录应包含 `completed: 2`、判据“没有待办仍处于未完成状态”，以及 `t1`、`t2` 两条记录更新。
3. 再问一次。动作应继续出现在能力清单中，但带上声明的不可用原因，而不是再次执行。
4. 刷新页面，手动新增一条待办，确认表单、复选框、删除按钮和筛选仍使用上一章的声明。
5. 让助手新增一条待办，再执行“完成全部未完成项”。新任务也应进入同一份记录差异。
6. 查看调试视图的工具列表。`complete_open_tasks` 不应有元素目标，也不应被折叠成记录模板。

## 本章边界与下一章

本章增加了函数级动作，但没有增加新的可见性模型。函数级工具在挂载且可用时始终存在；它没有可以被滚出视口、被父元素隐藏或被弹窗遮挡的元素。这对真正没有控件的操作很方便，却不是绕过控件可见性规则的方法。

下一章回到元素层，讨论区域、可见性与遮挡：页面如何告诉 Agent 当前活跃的是哪个区域，哪些控件被裁剪或覆盖，以及弹窗打开后哪些动作仍然有效。

下一章：[区域、可见性与遮挡](/zh/vue/regions-visibility-and-overlays)。
