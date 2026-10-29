---
id: V3-05
title: "带输入的动作与结果验证"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 带输入的动作与结果验证

上一章让一次 Agent 运行变得可观察，但新增入口仍由两个原子动作组成：先填 `composer_text`，再点 `composer_submit`。这条路径可以工作，却要求模型复现界面操作，而不是调用用户真正请求的业务操作。它还把一个操作拆成两次执行，没有统一的位置声明有效输入，也没有位置判断结果是否已经出现。

本章只替换新增路径。页面、任务列表、任务区域、记录和行内勾选动作沿用上一章。表单仍可手动使用；表单和助手现在都把任务文本交给同一个 `addTask`。声明在这层函数外面补上三部分：参数契约、可用条件和结果判据。

## 为什么两个控件动作不等于一个业务操作

用户说“新增一条‘回复客户’的待办”时，旧声明要求模型先判断 `composer_text` 对应新增输入框，填入文本，再等提交按钮变为可用，最后调用 `composer_submit`。模型处理的是表单的交互顺序，不是用户的请求。

这种耦合有三个实际代价：

- 一个业务操作占用多次模型调用；
- 页面布局或交互方式变化时，业务操作没有变，工具说明却可能失真；
- 参数校验和结果检查没有自然归属，因为两个原语各只覆盖操作的一半。

页面本来就有负责完整业务操作的 `addTask`。缺少的是一条声明，让模型能按用户请求的粒度调用它。

## 保留原有页面模型

下面的代码保留了上一章的区域、记录和行内勾选，只把新增入口改成一条业务动作。为便于阅读，示例省略了文案和样式代码；可运行夹具使用中英文 `copy` 对象。

```vue{39-64,82}
<script setup lang="ts">
import { ref } from "vue";
import { AgentDock, type ToolOptions } from "@plingjs/vue";

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const MAX_TASKS = 8;
const tasks = ref<Task[]>([
  { id: "t1", text: "检查发布清单", done: false },
  { id: "t2", text: "预约设计评审", done: false },
  { id: "t3", text: "跟进客户", done: true },
]);
const draft = ref("");
let sequence = 3;
let lastAddedId: string | null = null;

function addTask(text: string): Task | null {
  const value = text.trim();
  if (!value || tasks.value.length >= MAX_TASKS) return null;

  const task = { id: `t${++sequence}`, text: value, done: false };
  tasks.value.unshift(task);
  return task;
}

function submitDraft(): void {
  if (addTask(draft.value)) draft.value = "";
}

function toggleTask(id: string): void {
  const task = tasks.value.find((item) => item.id === id);
  if (task) task.done = !task.done;
}

const addTaskAction = {
  id: "add_task",
  desc: "使用提供的文本向待办列表添加一条待办。",
  kind: "write",
  params: [
    {
      name: "text",
      label: "待办内容，1–80 个字符，不能只包含空格",
      minLength: 1,
      maxLength: 80,
      pattern: /\S/,
    },
  ],
  available: () =>
    tasks.value.length < MAX_TASKS
      ? true
      : `列表已满（${MAX_TASKS} 项）。请先删除一条待办再添加。`,
  run: ({ text }: Record<string, unknown>) => {
    lastAddedId = addTask(String(text))?.id ?? null;
  },
  expect: {
    desc: "新待办已经出现在列表中",
    check: () =>
      lastAddedId !== null && tasks.value.some((task) => task.id === lastAddedId),
  },
} satisfies ToolOptions;
</script>

<template>
  <main class="page">
    <section
      class="todo"
      v-scope="{
        id: 'todo',
        label: '待办',
        description: '待办列表，以及新增待办的表单。',
        role: 'main',
      }"
    >
      <header class="todo__header">
        <h1>待办</h1>
      </header>

      <form class="composer" v-tool="addTaskAction" @submit.prevent="submitDraft">
        <label for="new-task">新待办</label>
        <input id="new-task" v-model="draft" maxlength="80" autocomplete="off" />
        <button type="submit" :disabled="draft.trim() === '' || tasks.length >= MAX_TASKS">
          添加待办
        </button>
      </form>

      <ul class="tasks">
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
          <label>
            <input
              type="checkbox"
              :checked="task.done"
              v-tool="{
                id: `toggle@${task.id}`,
                desc: `将“${task.text}”标记为${task.done ? '未完成' : '已完成'}。`,
                kind: 'write',
              }"
              @change="toggleTask(task.id)"
            />
            <span>{{ task.text }}</span>
          </label>
        </li>
      </ul>

      <AgentDock title="待办助手" />
    </section>
  </main>
</template>
```

高亮的动作声明和表单上的 `v-tool` 绑定是本章新增的部分。`add_task` 取代了原来的两个输入区动作；区域、记录字段和行内勾选仍保持上一章的含义。

页面仍有两个入口，但只有一个业务操作：

```text
手动：  form submit -> submitDraft() -> addTask()
Agent：add_task({ text }) -> run()    -> addTask()
```

## 模型实际看到什么

一条声明会生成模型可见的动作描述。模型能看到动作 id、说明、风险等级、参数 schema 和当前可用性；看不到 `run` 与 `expect` 的函数体。

| 字段 | 用途 | 模型是否看到 |
| --- | --- | --- |
| `id` | 调用、事件和诊断使用的稳定名称 | 是 |
| `desc` | 说明操作做什么、作用于什么 | 是 |
| `kind` | 执行策略使用的风险分类 | 是 |
| `params` | 根据参数声明生成的 JSON Schema | 是 |
| `available` | 此刻能否执行；不能执行时带原因 | 是 |
| `run` | 接收已校验参数的页面边界 | 否 |
| `expect` | 检查结果是否出现的页面判据 | 否 |

`id` 应该命名业务操作，而不是界面控件。按钮文案从“添加待办”改成“新建待办”时，`add_task` 不应跟着改名。`desc` 应该说明结果；“点击按钮”只是在重复模型无需再选择的机制。

`kind` 描述风险，不描述样式。`read` 表示读取，`write` 表示改变页面或业务状态，`danger` 表示破坏性或格外敏感的操作。示例明确写出 `write`；省略时框架仍按 `write` 处理。

## 参数是一份契约

`text` 参数会变成下面的 JSON Schema：

```json
{
  "type": "object",
  "properties": {
    "text": {
      "type": "string",
      "description": "待办内容，1–80 个字符，不能只包含空格",
      "minLength": 1,
      "maxLength": 80,
      "pattern": "\\S"
    }
  },
  "required": ["text"]
}
```

约束写在声明里，而不是让模型从说明文字中自己推断。参数默认必填；只有操作确实允许省略时才使用 `optional: true`。`label` 说明什么值有效，`minLength`、`maxLength`、`pattern`、数字范围与枚举则在调用前可见。

参数校验发生在确认与权限决策之前，也发生在 `run` 之前。缺少参数或格式不对的调用不会弹出确认框，也不会到达 `addTask`。模型会收到 `INVALID_PARAMS` 和失败的具体约束，可以据此修正调用。

声明了 `params` 后，`run` 收到整个已校验的参数对象。没有 `params` 的原子动作保留原语输入：click 不传值，fill 传 `text`，select 传 `value`，press 传 `key`。

## `run` 只是边界

`run` 把声明过的参数接到应用已有操作上。示例中只做三件事：读取 `text`、调用 `addTask`、记下新任务的 id 供结果判据使用。

它没有第二份任务状态。以后任务的存储、保存或同步方式变化，手动表单和 Agent 仍然都从 `addTask` 进入。

不需要输入、行为就是普通控件交互时，可以省略 `run`；框架执行声明的原语，组件已有的处理函数随之运行。需要参数，或操作无法用一次可信的 DOM 事件表达时，再使用 `run`。`run` 可以是异步函数，框架会等它完成后再检查结果。

## `available` 表达页面状态

`available` 回答动作在当前页面状态下能否执行。它不是权限判断，也不是后端授权，不能替代其中任何一个。它让模型能区分“业务不允许”和“列表已满，暂时不能新增”。

可用时返回 `true`。不可用时返回字符串；原因会进入页面快照和 `ACTION_UNAVAILABLE` 错误。列表已有八条任务时，示例返回：

```text
列表已满（8 项）。请先删除一条待办再添加。
```

原生条件仍然生效。目标被禁用、隐藏或被弹窗遮住时，即使 `available` 返回 `true`，动作也不可用。

## `expect` 检查结果是否发生

`run` 返回只证明函数执行结束，不证明页面到了预期状态。页面可能仍在等待渲染、动画或网络响应。

`expect` 把预期结果写成可检查的条件：

```ts
expect: {
  desc: "新待办已经出现在列表中",
  check: () =>
    lastAddedId !== null && tasks.value.some((task) => task.id === lastAddedId),
}
```

执行后，框架会等待判据成立。默认超时是两秒，可以通过 `expect.timeout` 修改。判据成立时，回执带上这句说明；超时时报告 `EXPECTATION_FAILED`，明确表示动作已经执行，但没有观察到声明的结果。

这个区别避免了两个相反的错误：把尚未完成的异步操作说成“成功但没有变化”，或者把它当成“点击失败”并诱导重复提交。`expect` 仍然是页面状态的证据，不是服务端确认、权限检查或审计记录。

## 执行结果与变化证据

任务列表已经以记录形式暴露，因此框架可以比较动作前后的页面。成功的 `add_task` 会带回已经验证的结果和可见变化：

```json
{
  "changed": {
    "observed": true,
    "records": {
      "added": ["t4"],
      "removed": [],
      "updated": [],
      "reordered": false,
      "omitted": { "added": 0, "removed": 0, "updated": 0 },
      "total": { "from": 3, "to": 4 }
    },
    "actions": {
      "added": ["toggle@t4"],
      "removed": [],
      "omitted": { "added": 0, "removed": 0 }
    }
  }
}
```

变化证据回答的问题比 `expect` 更窄。`expect` 说明声明的业务条件是否成立；`changed` 说明两份快照之间有哪些已暴露的记录和动作不同。两者都不能证明变化正确或完整。记录与行内动作的折叠、以及变化证据的边界，会在后续记录章节详细展开。

本章的三种失败结果含义不同：

| 结果 | 含义 | 已经发生了什么 |
| --- | --- | --- |
| `INVALID_PARAMS` | 参数缺失，或违反了声明约束 | 确认和业务操作都没有执行 |
| `ACTION_UNAVAILABLE` | 页面或业务前置条件不成立 | 业务操作没有执行，回执包含原因 |
| `EXPECTATION_FAILED` | 已执行，但没有观察到声明结果 | `run` 可能已经改变页面；盲目重试可能重复操作 |

## 验证本章示例

从仓库根目录启动：

```bash
pnpm tutorial:dev v3-05 --locale zh
```

打开 `http://127.0.0.1:5198/?lang=zh`。英文界面使用 `pnpm tutorial:dev v3-05` 和 `http://127.0.0.1:5198/`。

依次检查：

1. 在表单输入 `回复客户` 并提交。任务应出现在顶部，输入框应清空。
2. 对助手说：`把“准备明天的议程”加入我的待办。` 运行应选择 `add_task` 并传入文本，而不是填写和提交两个控件动作。
3. 打开 **最近操作**。执行记录应显示 `add_task`、传入的文本和已经验证的结果判据。
4. 对照成功回执与记录列表。新会话中应报告新增记录 `t4`，以及随之出现的 `toggle@t4` 动作。
5. 让助手把 `预约设计评审` 标记为已完成。这可以确认上一章的行内勾选仍使用同一套记录模型。
6. 连续新增到八条，再请求一条。动作仍应出现在能力清单中，但返回列表已满的原因，页面不应改变。
7. 刷新页面，恢复最初的三条任务。

## 下一章

新增操作现在有一个模型可见的身份、经过校验的输入、可用条件和明确的结果。下一类问题更具体：当控件是原生元素、被组件包裹，或组件内部同时存在多个候选目标时，声明的交互究竟由哪个 DOM 元素接收？

下一章[真实控件与自定义组件](/zh/vue/real-controls-and-custom-components)沿用同一个 Todo 应用，依次处理原生优先级选择框、自定义搜索框，以及包含多个筛选按钮的组件。
