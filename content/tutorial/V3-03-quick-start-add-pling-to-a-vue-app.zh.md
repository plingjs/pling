---
id: V3-03
title: "Vue 快速上手：一个可用的 Todo Agent"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# Vue 快速上手：一个可用的 Todo Agent

一个能对话的助手，不等于一个能完成页面任务的 Agent。模型可能理解“把预约设计评审标记为完成”，却不知道页面上有哪些任务、每一行代表什么，也没有一个明确、安全的入口可以改变状态。

本章用一个完整的 Todo 页面建立第一条可用路径。页面原有业务代码保持不变；接入层只补四类信息：哪些区域属于同一个页面模块、每一行是什么数据、哪些操作允许 Agent 使用，以及助手入口放在哪里。

读完之后，助手应当能够新增一条待办，也能按任务内容完成已有的待办。它不会获得整页所有按钮的控制权。这个边界正是本章最重要的部分。

## 这一章会得到什么

起点是一个可以正常使用的 Vue 3 + Vite 项目。它已经有任务列表、新增表单、完成勾选、筛选和删除，模型连接也已在上一章配置完成。

本章只增加下列接入代码：

1. 在应用入口创建一个共享的 Pling 实例；
2. 用 `v-scope` 描述任务列表所在区域；
3. 用 `v-record` 把每一行任务声明为 Agent 可读取的记录；
4. 用 `v-tool` 开放新增输入、提交和完成勾选；
5. 用 `<AgentDock>` 挂载助手。

任务数据、`addTask`、`toggleTask`、表单提交和页面布局都不重写。Agent 操作的是已有控件，最终仍进入这些业务函数。

## 安装与前置条件

安装 Vue 适配器，并在应用入口引入一次发布包样式：

| 包管理器 | 命令 |
| --- | --- |
| pnpm | `pnpm add @plingjs/vue` |
| npm | `npm install @plingjs/vue` |
| Yarn | `yarn add @plingjs/vue` |

```ts
import "@plingjs/vue/style.css";
```

模型地址、模型名和认证方式沿用[安装与模型配置](/zh/vue/installation-and-model-configuration)中的配置。本章不再重复模型设置。

## 在应用入口创建一次运行时

在创建 Vue 应用的位置创建 Pling 实例，并安装插件：

```ts{2,3,6,8}
import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";

const pling = createPling();

createApp(App).use(pling.plugin).mount("#app");
```

`createPling()` 持有当前页面的能力注册表。`pling.plugin` 注册 Vue 指令，并让助手组件使用同一个实例。

这段代码应当放在应用入口，而不是每个业务组件里。页面只有一个能力注册表，多个实例会让动作、记录和助手看到的页面不一致。

## 业务代码保持原样

示例页面的核心状态仍然由 Vue 管理：

```ts
interface Task {
  id: string;
  text: string;
  done: boolean;
}

const tasks = ref<Task[]>([
  { id: "t1", text: "检查发布清单", done: false },
  { id: "t2", text: "预约设计评审", done: false },
  { id: "t3", text: "跟进客户", done: true },
]);

function addTask(text: string): Task | null {
  const value = text.trim();
  if (!value || tasks.value.length >= 8) return null;

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
```

新增待办仍然通过 `draft`、`submitDraft` 和 `addTask` 完成；完成状态仍然通过 `toggleTask` 修改。后面的声明不会为 Agent 复制另一套业务逻辑。

## 从一句请求开始

先看一个具体请求：

> 把第 1 条待办勾选完成，新增一条“10 点睡觉”的待办。

这句话没有提到页面元素，却包含两个确定的操作。要把它拆成可执行步骤，模型至少需要知道三件事。

| 模型需要知道 | 这个页面里的事实 | 由什么提供 |
| --- | --- | --- |
| 哪一块是待办区域，负责什么 | 任务列表和新增表单都在 `todo` 区域 | `v-scope` |
| “第 1 条”是哪条任务，当前状态是什么 | 当前列表中的 `t1`，内容“检查发布清单”，状态 `open` | `v-record` |
| 可以做哪些动作，分别执行到哪个控件 | 填写新待办、提交表单、勾选 `t1` | `v-tool` |

有了这些信息，模型才能把请求对应到页面上的真实控件：

```text
toggle(record: "t1")              -> 第 1 条任务的复选框
composer_text(text: "10 点睡觉")  -> 新增待办的输入框
composer_submit()                 -> “添加待办”按钮
```

如果 `t1` 已经完成，记录中的 `status` 和动作说明会告诉模型：同一个控件此时会取消完成，而不是再次完成。动作声明落在页面原有控件上，因此执行目标是真实的输入框、按钮和复选框，而不是框架另外发明的一套命令。

接下来的三节分别补齐区域、记录和动作。业务代码仍然不变。

## 先描述任务区域

一个复杂页面通常有页头、筛选栏、任务列表、弹窗等不同区域。人一眼能看出某个“确认”属于哪个区域；模型只看到一组动作时，未必能作出同样的判断。

把任务列表和新增表单放进一个具名区域：

```vue{2-5}
<section
  v-scope="{
    id: 'todo',
    label: '待办',
    description: '待办列表，以及新增待办的表单。',
    role: 'main',
  }"
>
  <!-- 任务列表与新增表单 -->
</section>
```

这一段会进入模型的页面上下文。它告诉模型：下面的动作属于同一个任务模块，这块区域负责读取和修改待办。

`role` 只是结构提示，不是权限。`v-scope` 也不会自动开放区域里的控件；真正的操作仍然必须逐个声明。

在只有一个列表的 Todo 页面里，区域描述看似可有可无。页面一旦出现多个名称相近的按钮，它会成为模型区分目标的重要依据。区域语义的完整规则会在后续章节展开。

## 让每一行成为可读记录

如果模型只看见 `toggle@t2`，它知道有一个可点击的复选框，却不知道 `t2` 是什么。它需要读到每一行的业务字段：

```vue{5-11}
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
    <!-- 任务内容与完成勾选 -->
  </li>
</ul>
```

记录 id 来自 `task.id`。模型会看到一份精简的行视图：

```text
t1: text 检查发布清单; status open
t2: text 预约设计评审; status open
t3: text 跟进客户; status completed
```

字段由开发者选择。不要把整个对象自动交给模型，也不要从 DOM 文本里抓取。`status: 'completed'` 比 `done: false` 更容易判断，而内部实现字段或与任务无关的信息没有必要暴露。

记录是只读视图。要让 Agent 改变任务，仍然需要声明一个动作。

## 开放三个已有控件

### 填写新待办

输入框继续使用原来的 `v-model`，只增加动作声明：

```vue{4-8}
<input
  id="new-task"
  v-model="draft"
  v-tool="{
    id: 'composer_text',
    desc: '在这个输入框中填写一条新待办的内容。',
    kind: 'write',
  }"
  autocomplete="off"
/>
```

`id` 是模型调用、测试和运行记录里使用的稳定名称。`desc` 说明控件的作用和边界。`kind` 把这一步标为会修改页面状态的操作。

### 提交新待办

提交按钮同样保留原来的表单处理：

```vue{4-8}
<button
  type="submit"
  v-tool="{
    id: 'composer_submit',
    desc: '把新待办输入框中的文字加入待办列表。',
    kind: 'write',
  }"
  :disabled="draft.trim() === ''"
>
  添加待办
</button>
```

输入框为空时，原生按钮处于禁用状态，模型当前看不到 `composer_submit`。填入内容后，它会重新出现。这不需要额外声明可用性；控件原本的状态就是事实来源。

这两步对应的还是页面原有表单。当用户说“新增一条回复客户的待办”，模型通常会先调用 `composer_text`，再调用 `composer_submit`。虽然多一次往返，但它走的是人实际使用的路径。下一章之后会把两步合并成一个业务动作。

### 标记完成

完成复选框也已经存在，只需给它一个带行身份的 id：

```vue{5-9}
<input
  type="checkbox"
  :checked="task.done"
  @change="toggleTask(task.id)"
  v-tool="{
    id: `toggle@${task.id}`,
    desc: task.done ? `将“${task.text}”标记为未完成。` : `将“${task.text}”标记为已完成。`,
    kind: 'write',
  }"
/>
```

`@` 后面的部分是记录 id。因为页面已经用 `v-record` 声明了 `t1`、`t2`、`t3`，同一类行内动作会折叠成一个面向模型的工具：

```text
toggle(record)
  将“{record}”标记为已完成或未完成。
  record: t1 / t2 / t3
```

模型选择业务记录，框架再映射回精确的 `toggle@t2` 这样的元素级动作。记录、折叠与变更证据的完整机制会在后续章节单独说明；本章只需要知道，模型不是在猜一个内部元素 id。

筛选、删除和“清除已完成”仍然没有声明。人对它们的使用不受影响，Agent 当前看不到这些能力。`kind` 也不等于权限或用户同意；它只是动作风险的可读分类。

## 挂载助手入口

把助手入口放在页面外壳里：

```vue{1,5-8}
<script setup lang="ts">
import { AgentDock } from "@plingjs/vue";
</script>

<template>
  <main class="page">
    <!-- Todo 页面 -->
    <AgentDock title="待办助手" :quick="['把第 1 个待办标记完成，然后由你决定创建 2 个待办']" />
  </main>
</template>
```

`AgentDock` 提供启动按钮、对话、执行状态和运行记录。`quick` 只是给人的快捷问题，不创建动作，也不改变已有会话。

这条快捷问题会先完成当前第 1 条待办，再由模型自己决定创建哪两条待办，适合观察一次请求如何展开成多步页面操作。

助手界面不进入 Todo 业务组件内部。之后更换入口、布局或主题时，不需要修改任务状态与能力声明。

## 改动范围

| 位置 | 改动 |
| --- | --- |
| 应用入口 | 创建 Pling 实例，安装 Vue 插件，引入样式 |
| 任务区域 | 增加一个 `v-scope` 描述 |
| 每一行任务 | 增加 `v-record`，暴露文本和完成状态 |
| 输入框与提交按钮 | 增加两个明确命名的 `v-tool` |
| 完成复选框 | 增加一个带行身份的 `v-tool` |
| 页面外壳 | 挂载 `<AgentDock>` |

以下内容保持不变：

- 任务数组和初始数据；
- `addTask`、`submitDraft`、`toggleTask`；
- 表单提交、筛选、删除和清除已完成；
- 页面布局与样式；
- 所有没有声明的控件。

## 运行并验证

从仓库根目录启动本章示例：

```bash
pnpm tutorial:dev v3-03 --locale zh
```

打开：

```text
http://127.0.0.1:5196/?lang=zh
```

按下面顺序检查：

1. 打开待办助手，发送“把‘回复客户’加入待办”。
2. 新任务只出现一次，并经过原来的 `addTask`。
3. 点击快捷问题“把第 1 个待办标记完成，然后由你决定创建 2 个待办”。
4. 当前第 1 条进入完成状态，记录中的 `status` 从 `open` 变为 `completed`；同时新增两条由模型决定内容的待办，它们仍经过原来的 `addTask`。
5. 打开“运行”（Activity）。完成会显示一次记录级的 `toggle` 调用；两条新增各显示填写与提交两步。
6. 尝试让助手删除任务或筛选列表。当前动作列表里没有这些能力。

使用英文界面时，启动命令不加 `--locale zh`，打开 `http://127.0.0.1:5196/`。

## 一次成功运行里发生了什么

新增待办通常需要三次模型请求：模型选择填写输入框，再选择提交按钮，最后根据工具结果给出答复。完成一条已有待办通常更短：模型读取记录，调用 `toggle`，再确认结果。

实际调用次数取决于模型是否在同一个回复里发起多个工具调用。比次数更重要的是每一步是否基于当前页面快照，而不是基于模型猜出的 DOM。

下一章会打开只读运行检查器，直接查看模型收到的系统提示词、工具清单、真实 messages 与页面快照。之后遇到“为什么它选了这个动作”或“为什么没有看到这个按钮”时，可以先检查请求，而不是反复改提示词。

## 常见失败

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 控制台提示 `Failed to resolve directive: tool` | Vue 插件没有安装 | 在入口调用 `.use(pling.plugin)` |
| 模型能对话，但看不到输入动作 | 输入框没有 `v-tool`，或动作 id 重复 | 检查声明与页面内唯一性 |
| 输入框已填好，提交动作仍消失 | 按钮在空输入时被禁用 | 先填写内容；可用性来自原生控件状态 |
| 模型改了错行 | 记录字段不足，或动作说明没有写清目标 | 暴露 `text` 与 `status`，并让说明包含任务文本 |
| 模型说没有删除或筛选能力 | 这些控件没有声明 | 本章的预期边界，不是缺陷 |
| 模型请求失败 | 模型地址、代理或密钥未配置 | 回到模型配置章节检查，并重启开发服务 |

## 下一步

现在页面已经有一条完整、可用的 Agent 路径，但它仍有两个明显限制：新增需要填写和提交两步，动作成功与否只靠页面变化和模型回答来判断。

继续阅读[查看一次 Agent 运行](/zh/vue/inspect-one-agent-run)，先学会观察模型实际收到了什么；之后的章节再把两步交互合并成一个带参数与结果判据的业务动作。
