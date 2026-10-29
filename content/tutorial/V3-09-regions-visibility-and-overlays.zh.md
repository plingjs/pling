---
id: V3-09
title: "区域、可见性与遮挡"
locale: zh
source_locale: en
translation_status: synced
status: drafted
---

# 区域、可见性与遮挡

前两章让动作与记录变得明确。每个动作都有稳定身份和说明；行内动作还能通过记录参数指定业务对象。模型不再需要从 DOM 结构猜出操作，也不必只凭元素顺序辨认目标。

但当页面中出现多处相似控件，或弹窗暂时使页面其余部分不可操作时，这些信息仍不够。扁平的动作清单无法告诉模型，哪一个“保存”属于记录编辑器，哪一个属于设置表单；也无法解释一个刚刚还存在的能力为什么从清单中消失。

本章为页面模型补上两类上下文：

- **区域**说明动作位于页面结构的哪个位置；
- **可用性**说明动作仍然存在，但此刻不能使用，以及需要先满足什么条件。

示例沿用 Todo 应用，并加入一个真实的编辑弹窗。弹窗不是视觉占位：它会修改任务，并在打开期间让背景页面进入 `inert` 状态。结构与临时可用性是本章的两个主题。二者都不授予权限，也不替代业务校验。

## 扁平动作清单为何会产生歧义

假设不同区域中存在两个用途相近的操作：

```text
save              Save the current record.
save              Save the account settings.
```

改进名称和说明能缓解问题，却不能消除根因：模型不知道每个操作属于页面的哪一部分。人可以依靠空间关系阅读页面，模型拿到的却是一张列表。

本文的 Todo 页面也有同类问题，只是规模更小。页面包含新增表单、任务列表、筛选和批量操作。新增动作属于编辑区，行内动作属于列表记录，筛选属于视图工具栏。小页面上，名称通常足以区分；页面一大、控件一多，结构就成为必要信息。

弹窗还带来第二个问题。编辑器打开时，任务列表被覆盖，也不应再接受交互。如果这些动作直接从快照中消失，模型有理由认为页面已经没有新增表单或行内动作。它需要的是更准确、也更弱的陈述：这些动作仍然存在，但当前打开的编辑器阻止了使用。

所以，本章的目标不是暴露更多控件，而是让页面模型更接近事实：

1. 动作带有可读的区域路径；
2. 即使弹窗在 DOM 中渲染于逻辑祖先之外，它仍属于页面树；
3. 被覆盖的控件继续以“存在但不可用”的形式出现，并说明原因；
4. 没有目标元素的动作必须显式声明可用性条件。

业务函数和数据模型保持不变。接入层新增的是区域声明、弹窗语义，以及一个可用性判断。

## 用一棵小树描述页面

Todo 工作区原本已经有一个区域。本章把它的内部结构显式写出来：

```vue{2-13,20-29,35-44}
<section
  v-scope="{
    id: 'todo',
    label: 'Tasks',
    description: 'The task workspace: adding, editing, filtering, and reviewing tasks.',
    role: 'main',
  }"
>
  <form
    v-scope="{
      id: 'composer',
      label: 'Task composer',
      description: 'Create a task and choose its priority.',
      role: 'form',
    }"
    v-tool="addTaskAction"
  >
    <!-- 输入框、优先级选择与提交按钮 -->
  </form>

  <ul
    v-scope="{
      id: 'task_list',
      label: 'Task list',
      description: 'The tasks currently in view, with completion, edit, and removal actions.',
      role: 'list',
    }"
  >
    <!-- 任务行 -->
  </ul>

  <footer
    v-scope="{
      id: 'view_controls',
      label: 'View controls',
      description: 'Search, filtering, and bulk operations for the task list.',
      role: 'toolbar',
    }"
  >
    <!-- 搜索框，以及筛选与批量操作 -->
  </footer>
</section>
```

这棵树不是从视觉样式推断出来的，而是应用主动声明的结构。模型收到的内容大致如下：

```text
## Page structure (regions)
- main "Tasks" (todo): ...
  - form "Task composer" (composer): ...
  - list "Task list" (task_list): ...
  - toolbar "View controls" (view_controls): ...
```

动作会继承声明它的区域路径。新增动作因此带有 `region:Tasks / Task composer`；编辑、完成或删除动作带有 `region:Tasks / Task list`；筛选动作带有 `region:Tasks / View controls`。

即使多个动作的说明相似，这条路径也能帮助模型选择。它依据的是应用声明的页面结构，而不是 CSS 或元素顺序。

`role` 是结构性提示，可选值为 `page`、`header`、`nav`、`main`、`aside`、`section`、`form`、`dialog`、`toolbar`、`list` 和 `footer`。它影响页面的描述与阅读顺序，不会暴露其中的控件，也不授予访问权或替业务操作做校验。表单区域里的按钮不会仅仅因为所在区域标成 `form` 就获得授权。

子区域通常从 DOM 继承父区域。快照在挂载后解析父子关系，因此子组件先于父组件注册也不会产生断裂的树。但组件通过 portal、teleport 或固定定位覆盖层渲染到逻辑祖先之外时，DOM 关系不再足够。下一节单独处理这种情况。

## 把弹窗放回页面树

编辑器挂载在 Todo 工作区旁边，而不是它的内部：

```vue{10-14}
<div
  v-if="editingTask"
  class="overlay"
  v-scope="{
    id: 'edit_dialog',
    label: 'Edit task',
    description: 'Change one task title. While this editor is open, the rest of the task page cannot be used.',
    role: 'dialog',
    parent: 'todo',
  }"
>
  <section
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-task-title"
  >
    <!-- 编辑器字段与操作 -->
  </section>
</div>
```

CSS 覆盖层与 Todo 区块是同级节点。固定定位和 `z-index` 让它覆盖页面，却不会改变 DOM 祖先关系。`parent: 'todo'` 补上缺失的页面关系：在模型看到的区域树里，弹窗属于任务工作区；在浏览器 DOM 中，它仍可留在工作区之外。

原生 `role="dialog"` 与 `aria-modal="true"` 向辅助技术描述这是一个弹窗。它们不会自动创建框架层的模态边界。弹窗之所以进入页面模型，是因为它有 `v-scope` 声明；背景之所以不可用，是因为其交互状态发生了变化，而不是因为 DOM 中出现了 `dialog` 这个词。

弹窗只暴露编辑当前任务所需的动作：

```vue{7-12,22-27,34-39}
<input
  id="edit-task-text"
  v-model="editText"
  v-tool="{
    id: 'edit_note',
    desc: 'Replace the text of the task currently being edited.',
    kind: 'write',
    action: 'fill',
  }"
/>

<button
  type="button"
  v-tool="{
    id: 'edit_cancel',
    desc: 'Close the editor without changing the task.',
    kind: 'read',
  }"
  @click="cancelEdit"
>
  Cancel
</button>

<button
  type="button"
  v-tool="{
    id: 'edit_save',
    desc: 'Save the task text and close the editor.',
    kind: 'write',
  }"
  @click="saveEdit"
>
  Save changes
</button>
```

`edit_note` 与 `edit_save` 是两个独立操作，因为对应两个不同的人为决定。填写内容不会保存；保存也不负责填入内容。调用失败时，模型因此能说清是输入没有完成，还是保存没有完成。

`edit_save` 有目标按钮，仍会经过正常的元素检查。输入为空时，原生保存按钮处于禁用状态，动作会报告为不可用。这个条件不需要再写一条 `available` 判断。

## 让背景不可用，而不是消失

覆盖层可能只在视觉上遮住页面，键盘和辅助技术仍能到达下面的控件。示例因此在弹窗存在期间，将 Todo 工作区标记为惰性：

```vue{3-4}
<section
  class="todo"
  :inert="editingTask ? true : undefined"
  :aria-hidden="editingTask ? 'true' : undefined"
  v-scope="{ /* region declaration */ }"
>
  <!-- 任务工作区 -->
</section>
```

`inert` 是主要的交互边界。在支持的浏览器中，惰性子树里的内容无法获得焦点、无法点击，也不会进入顺序键盘导航。`aria-hidden="true"` 同时把背景从无障碍树中移除。在这里，两者互相补充，不能互相替代。

框架在报告元素动作可用前会读取这些状态。它也识别原生 `disabled`、`hidden`、`display: none` 和 `visibility: hidden`，并在浏览器中做几何检查，判断目标是否被裁剪或实际遮挡。具体组合取决于页面。关键规则是：隐藏控件不能靠删掉声明来实现。

编辑器打开后，模型会在可用动作中看到弹窗操作，背景动作则进入单独一段：

```text
## Actions that exist but are unavailable right now
- add_task: Element is inside an inert subtree: <form class="composer"> ... (Add one task ... ) | region: Tasks / Task composer
- toggle@t1: Element is inside an inert subtree: <section class="todo"> ... (Mark ... ) | region: Tasks / Task list
- show_all_tasks: Element is inside an inert subtree: <section class="todo"> ... (Show every task ... ) | region: Tasks / View controls
```

同类行内动作会去重，模型不会为每一条任务收到一份完全相同的理由。它看到的是：这一类动作仍然存在，当前有一个共同条件阻止使用。

“存在但不可用”不等于建议模型再试一次。弹窗打开时，模型即使按精确 id 调用 `add_task`，执行器也会返回 `ACTION_UNAVAILABLE`。页面事件处理不会被允许绕过自身当前的交互状态。

这个区别同时关系到准确性和恢复能力。模型可以告诉用户“编辑器打开时无法使用新增区”，然后先保存或取消编辑器，再重试；它不需要编造一个不存在的功能，也不需要刷新页面。

## 函数级工具必须显式判断

上一章的批量操作没有元素目标，因此 Todo 区块上的 `inert` 无法使它失效。如果它在编辑期间仍可用，模型就可能一边编辑一条任务，一边修改整个列表。

函数级声明必须自行带上同一项页面状态条件：

```ts{7-14}
const completeOpenTasksAction = {
  id: 'complete_open_tasks',
  desc: 'Mark every open task as completed. This changes all open records in one operation.',
  kind: 'write',
  available: () =>
    editingTask.value
      ? 'Finish or cancel the open task editor before changing the task list.'
      : remaining.value > 0
        ? true
        : 'There are no open tasks. Every task is already completed.',
  run: () => ({ completed: completeOpenTasks() }),
  expect: {
    desc: 'No task remains open',
    check: () => remaining.value === 0,
  },
} satisfies AgentToolOptions;

useAgentTool(completeOpenTasksAction);
```

第一个分支不是 `inert` 的复制，而是无 DOM 目标操作缺失的业务事实。后两个分支处理列表为空的情况。每种失败都返回模型可以采取行动的条件。

这就是函数级工具的通用规则：没有元素的工具不会继承可见性、遮挡、原生禁用或惰性祖先状态。开发者必须判断哪些页面条件使操作有意义，并通过 `available` 表达。若某个函数在页面状态无效时仍可能被直接调用，函数内部也需要保留运行时检查。

`available` 仍然是在描述页面，而不是授权。它可以说明编辑器已打开、未选择任何记录、列表已满；它不能证明调用方有权修改数据、当前租户拥有这条记录，或服务端规则允许操作。这些检查必须在 UI 层之外独立完成。

## 模型实际收到什么

页面上下文现在有三层有用信息。区域段描述工作区与打开的弹窗：

```text
## Page structure (regions)
- main "Tasks" (todo): ...
  - form "Task composer" (composer): ...
  - list "Task list" (task_list): ...
  - toolbar "View controls" (view_controls): ...
  - dialog "Edit task" (edit_dialog): ...
```

可用动作清单包含弹窗操作，不包含被阻止的背景动作。下一段以 `## Actions that exist but are unavailable right now` 开头，列出相应原因。任务记录仍然可读，模型因此知道正在编辑哪条任务，以及它当前的内容。

弹窗打开期间，折叠后的 `edit` 行内模板也会消失，因为实现它的所有元素此刻都不可用。弹窗关闭后，它会重新出现。这是当前动作投影的结果，不是声明被删除，也不是记录数据发生变化。

`edit_save` 之后的下一轮，模型会收到新的快照：弹窗已经消失，任务记录包含新文本，背景动作重新可用。模型不需要记住上一轮弹窗是否打开；当前页面快照就是事实来源。

## 可见性不等于权限

区域与可用性让页面模型更忠实，但它们本身不能保证应用安全：

| 事实 | 能说明什么 | 不能说明什么 |
| --- | --- | --- |
| 区域归属 | 动作声明在页面的哪一部分。 | 谁可以调用它。 |
| `inert` 或被遮挡目标 | 此刻浏览器无法通过正常路径使用该控件。 | 业务操作合法或已获授权。 |
| `available` | 开发者认为当前页面状态允许尝试。 | 调用方有权限，或服务端会接受结果。 |
| 一次成功的 UI 动作 | 声明的实现已运行，页面已落定。 | 远程写入成功，或策略已经被执行。 |

区域名也不是校验规则。重命名区域、把区域嵌套到弹窗下，或把它标成活跃，都不会改变执行器的权限模型。动作仍要经过策略、参数校验、确认流程，以及应用自行实现的授权。

几何检查同样是局部且有时效的。它只回答：当前浏览器此刻看起来能否到达这个控件。它不能证明控件符合用户意图，也无法阻止恶意页面或扩展修改 DOM。只要操作具有实际后果，服务端授权与业务校验就仍然必要。

`aria-hidden` 也不是让控件变安全的通用方法。把一个可聚焦子树从辅助技术中隐藏，却不让它惰性，可能使键盘用户进入一个看不见的交互区域。模态场景应使用平台提供的交互边界，并让背景语义与真实行为一致。

## 常见设计错误

| 现象 | 原因 | 更好的处理 |
| --- | --- | --- |
| 弹窗标成 `dialog`，背景动作却仍可用 | 把结构角色误当成了模态边界 | 让背景真正进入惰性或不可操作状态，并用快照验证。 |
| 弹窗在区域树里变成第二个根 | 它渲染在逻辑祖先之外，又没有显式父区域 | 声明实际的父区域 id。 |
| 弹窗打开后，模型说新增表单不存在 | 不可用动作既没进可用清单，也没进不可用清单 | 保留动作，并附上可读原因。 |
| 弹窗打开时批量函数仍能执行 | 函数级工具无法从目标元素继承 `inert` | 在 `available` 中加入页面状态条件，并在执行时再次校验。 |
| 相似控件仍被选错 | 虽然声明了区域，动作却没有可读路径 | 为区域提供稳定 id、名称和符合职责的说明。 |
| 动作被阻止，用户却不知道下一步 | 原因写成了实现细节，而不是可采取的行动 | 使用“请先保存或取消当前编辑器”这类面向状态的原因。 |

这些都是页面模型错误。应在测试中检查运行时快照，而不是把判断留给模型文本。

## 验证本章示例

从仓库根目录启动：

```bash
pnpm tutorial:dev v3-09 --locale zh
```

打开 `http://127.0.0.1:5222/?lang=zh`。英文界面使用 `pnpm tutorial:dev v3-09` 和 `http://127.0.0.1:5222/`。

依次检查：

1. 让助手把第 2 条待办改名为“与 Mina 预约设计评审”。编辑器应打开，弹窗进入页面结构；调用 `edit_save` 后任务文本应更新。
2. 对比打开编辑器前后的页面结构。根 Todo 区域应包含 `composer`、`task_list` 与 `view_controls`；弹窗打开后应出现在 `todo` 之下。
3. 编辑器打开期间查看不可用动作。新增表单、行内动作、筛选和 `complete_open_tasks` 都应带原因保留，而不是看起来消失。
4. 在测试或调试界面中按精确 id 调用一个被阻止的背景动作。结果应为 `ACTION_UNAVAILABLE`，而不是成功派发事件。
5. 保存或取消编辑器。背景动作应重新出现；如果保存成功，新快照应包含更新后的任务文本。
6. 运行 `pnpm tutorial:check v3-09`。确定性检查会分别验证区域树、显式弹窗父区域、惰性原因、函数级守卫、模型回放与中文文案，不依赖实时模型措辞。

## 本章边界与下一章

本章讨论了结构区域、覆盖层的显式父子关系，以及“动作不存在”和“动作暂时不可用”的区别。它还没有处理长列表、滚动、视口外记录，以及为超出视口内容生成的探索动作。这些内容属于下一章。

本章也没有把页面状态变成授权。正确的区域树告诉模型它在哪里；正确的不可用原因告诉它需要先改变什么。二者都不能替代策略、用户同意或服务端校验。

下一章：[长列表、滚动与视口外动作](/zh/vue/long-lists-scrolling-and-offscreen-actions)。
