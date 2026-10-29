---
id: V3-06
title: "真实控件与自定义组件"
locale: zh
source_locale: en
translation_status: reviewed
status: reviewed
---

# 真实控件与自定义组件

上一章处理的是“把业务意图声明为一个动作”。动作声明之后，运行时还必须回答另一个问题：这次点击、输入、选择或按键，究竟应该落到哪个 DOM 元素上？声明挂在按钮、输入框、组件根节点或容器上，实际接收事件的元素可能不同；如果目标不明确，动作看起来执行了，业务处理函数却可能从未被触发。

本章解决目标解析问题。对应的概念是**交互原语与目标元素的分离**：`click`、`fill`、`press`、`select` 等描述浏览器要执行什么交互，目标解析则决定哪个元素接收它。框架不能从 HTML 推断“删除”或“搜索”的业务含义；它只能根据声明范围、原生控件和显式目标做出可解释的选择。

目标解析还需要一份可信度证据。原生控件可以直接接收事件，自定义组件可能需要进入其 DOM 子树，多个候选控件则必须由开发者显式指定。`fidelity` 记录的是框架对定位结果的判断，不是业务操作成功的证明。

本章继续使用同一个 Todo 应用，观察三类结构：

- 直接接收原语的原生控件；
- 内部只有一个原语候选元素的自定义组件；
- 内部有多个控件、必须由开发者指定目标的自定义组件。

本章同时说明 `press`、`hover` 和 `run` 的适用边界。它们分别对应键盘事件、指针事件，以及无法忠实模拟 DOM 交互时交给业务代码执行的路径。

## 问题与目标

本章要解决的是“动作描述正确，但事件没有落到预期元素”这一类失败。它通常不会在简单按钮上出现，却会在组件封装、多个候选控件和悬停展开内容中暴露出来。

读者需要区分两件事：浏览器执行了什么交互，以及哪个元素接收了它。原生控件可以提供明确路径；自定义组件可以沿 DOM 子树解析；存在歧义时必须显式声明目标，而不是让框架猜测。完成本章后，读者应能判断一个动作为何命中、为何未命中，以及何时应当放弃模拟并改用 `run`。

## 控件结构与改动范围

应用的基本结构没有变化。任务数组、新增逻辑、筛选逻辑和破坏性操作仍然由业务代码持有。示例页面包含优先级下拉框、搜索框、筛选组件和悬停展开的批量菜单；本章讨论的是这些已有控件如何被声明和定位，而不是重新实现它们的业务行为。

上一章的任务区域、任务记录和行内完成动作继续保留，含义不变。本章只把目标解析应用到新增或本章才打开目标解析的控件上。

页面现在有这些声明：

| 动作 id | 原语 | 页面中的目标 | 保真度 |
| --- | --- | --- | --- |
| `add_task` | 带 `run` 的 `click` | 新增表单 | `high`（`injected`） |
| `select_priority` | `select` | 原生 `<select>` | `high`（`native`） |
| `search_text` | `type` | `SearchBox` 内部的输入框 | `auto` |
| `search_enter` | `press` | 同一个输入框 | `auto` |
| `show_all_tasks` | `click` | `TaskFilters` 内的按钮 | `high`（显式 `target`） |
| `show_open_tasks` | `click` | `TaskFilters` 内的按钮 | `high`（显式 `target`） |
| `show_completed_tasks` | `click` | `TaskFilters` 内的按钮 | `high`（显式 `target`） |
| `open_bulk_menu` | `hover` | `BulkMenu` 根元素 | `high`（显式声明） |
| `clear_completed` | `click` | 菜单打开后的原生按钮 | `high`（`native`） |

这张表把两个经常混在一起的问题分开了：

1. **浏览器要执行什么交互？** 这是原语。
2. **哪个元素接收它？** 这是目标。

保真度为 high，表示框架有明确理由相信原语到达了预期元素。它不表示业务操作已经成功。业务结果仍要由 `expect`、服务端响应或其他页面检查来证明。

## 原生控件的目标解析

优先级选择器就是一个原生 `<select>`：

```vue
<select
  id="task-priority"
  v-model="priority"
  v-tool="{
    id: 'select_priority',
  desc: '选择下一条通过 add_task 添加的待办所使用的优先级。',
    kind: 'write',
    action: 'select',
    params: [{
      name: 'value',
    label: '下一条待办的优先级：today、soon 或 later',
      values: ['today', 'soon', 'later'],
    }],
  }"
>
  <option value="today">今天</option>
  <option value="soon">近期</option>
  <option value="later">稍后</option>
</select>
```

`select` 原语会设置原生 value，并派发 `change` 事件。Vue 的 `v-model` 通过原有绑定收到事件。动作里没有第二份优先级状态，也没有调用 Pling 专用的组件更新接口。

`params` 仍然有用。它告诉模型 `value` 必填，并把可选值限制为页面真正能消费的三个值。传入 `someday` 会在原生元素改变之前失败，模型收到 `INVALID_PARAMS`，而不是一次没有说明的空操作。

规则很普通：如果声明元素本身就是原生可交互控件，原语直接作用在它身上，不需要目标查找，保真度就是 `high`。

## 输入与按键的原语边界

搜索文本和筛选结果是两个步骤。输入短语不会应用搜索，按回车才会。页面把这个过程明确写出来：

```vue
<SearchBox
  v-model="searchDraft"
  v-tool="[
    {
      id: 'search_text',
      desc: '在待办搜索框中输入短语。此时还不会应用搜索。',
      kind: 'write',
      action: 'fill',
    },
    {
      id: 'search_enter',
      desc: '在待办搜索框中按 Enter，应用已经输入的短语。',
      kind: 'read',
      action: 'press',
      key: 'Enter',
    },
  ]"
  @search="applySearch"
/>
```

`action: 'fill'` 映射到 `type` 原语。它聚焦输入框，通过原生 value setter 写入文本，再派发 `input` 和 `change`。`action: 'press'` 在目标元素上按页面给出的键名派发 `keydown` 和 `keyup`。

页面的 `SearchBox` 监听 `@keydown.enter`，并发出 `search` 事件。第二个动作因此有可见效果。框架不会替你发明一次表单提交，也不会重放完整的人类输入过程。如果组件只监听某个不属于浏览器事件流的框架私有事件，`press` 到不了那里。

这里也没有隐含的“清空搜索”步骤。动作说明和页面行为都只描述当前步骤。模型要完成搜索，需要依次调用 `search_text` 和 `search_enter`。把两者合成一个工具属于后面的流程能力。

## 自定义组件中的目标解析

`SearchBox` 的根元素是一个 `<div>`，里面有一个 `<input>`。`v-tool` 写在组件上，Vue 会把它作用在组件的单根元素上。框架随后在这个根元素内部解析原语目标。

对于 fill 动作，候选元素是 input、textarea 和 contenteditable。`SearchBox` 里只有一个 input，所以 `search_text` 和 `search_enter` 都定位到这个输入框，保真度为 `auto`。

`auto` 的含义很窄：

```text
声明元素内部，符合当前原语的候选元素恰好只有一个。
```

它不表示框架理解“搜索”这个词，不表示这个输入框属于预期业务流程，也不表示搜索结果是正确的。它只表示事件该送到哪个元素不存在歧义。组件语义仍由开发者负责。

反向规则同样重要：

| 声明元素内部的情况 | 结果 |
| --- | --- |
| 没有符合原语的元素 | `low`，原因 `unresolved`；动作多半无效 |
| 恰好一个符合原语的元素 | `auto`；动作送到该元素 |
| 有多个候选元素 | `low`，原因 `ambiguous`；框架不猜 |
| 显式 `target` 选择器命中元素 | `high`，原因 `declared` |
| 显式 `target` 选择器没有命中 | `low`，原因 `target-missing` |
| `autoTarget: false` | 不查内部元素；除非显式声明保真度，否则是 `low` |

候选元素按原语区分。click 找 button、链接、summary、checkbox、radio、button role 和可聚焦元素；fill 与 press 找文本输入；select 找 `<select>`。这样，旁边的按钮不会在明确是文本操作时错误地成为候选。

## 显式目标与歧义处理

筛选控件是自定义组件 `TaskFilters`。它的根元素包含三个原生按钮。如果在根元素上直接声明 click 而没有其他信息，就有三个可能目标，框架记录 `low`，不会猜。

应用可以在声明中消除歧义：

```vue
<TaskFilters
  v-model="filter"
  v-tool="[
    {
      id: 'show_all_tasks',
      desc: '显示全部待办，包括已完成的待办。',
      kind: 'read',
      target: 'button[data-filter="all"]',
    },
    {
      id: 'show_open_tasks',
      desc: '只显示尚未完成的待办。',
      kind: 'read',
      target: 'button[data-filter="active"]',
    },
    {
      id: 'show_completed_tasks',
      desc: '只显示已完成的待办。',
      kind: 'read',
      target: 'button[data-filter="completed"]',
    },
  ]"
/>
```

`target` 是在声明元素内部求值的 CSS 选择器，不是在整份文档里查询。这样可以把动作限制在拥有它的组件内部。

选择器应该明确指向预期元素，并能在普通样式变化后继续成立。只用于装饰的 class 不适合作为目标；与控件角色绑定的 data 属性通常更稳定。

提供目标之后，动作的保真度是 `high`，原因是 `declared`。原语仍然作用在真实 DOM 元素上，组件自己的 click 处理函数正常执行。Pling 不会调用组件的私有方法，也不会替组件发出自定义事件。

## `hover` 的事件语义

批量菜单默认关闭。菜单没有打开时，清除已完成动作不在注册表里。组件在根元素收到 `mouseover` 时打开菜单：

```vue
<template>
  <div class="bulk" @mouseover="open = true" @mouseleave="open = false">
    <button class="bulk__trigger" type="button" @click="open = !open">更多</button>
    <div v-if="open" class="bulk__menu"><slot /></div>
  </div>
</template>
```

声明是：

```vue
<BulkMenu
  v-tool="{
    id: 'open_bulk_menu',
    desc: '将指针移到“更多”上以展开批量操作。只有菜单展开时才会出现“清除已完成”。',
    kind: 'read',
    action: 'hover',
    fidelity: 'high',
  }"
>
  <button v-tool="clearCompletedAction">清除已完成</button>
</BulkMenu>
```

`hover` 原语会派发 `pointerover`、`pointerenter`、`mouseover` 和 `mouseenter`，因此能触达根元素的 `@mouseover` 处理函数。菜单渲染出来，Vue 挂载按钮，`clear_completed` 才进入动作列表。

这里有两个必须保留的边界：

1. 合成鼠标事件不会让浏览器进入 CSS `:hover` 状态。只依靠 `:hover` 选择器展开的菜单，不一定能被它打开。
2. `hover` 没有自动候选集。框架无法只靠一棵子树判断“人会把指针移到哪里”，所以不做猜测。应该把事件绑在真正负责行为的元素上，或者提供 `target`；当声明元素本身就是正确接收者时，也可以显式声明 `fidelity`。

示例使用显式 `fidelity: 'high'`，因为根元素确实监听了该事件。这个声明说明的是执行机制，不是承诺菜单一定有用，也不是承诺后续业务动作一定成功。

批量动作仍然是 `kind: 'danger'`。打开菜单只是让能力出现，不等于批准它执行。`clear_completed` 仍要经过已有的确认策略。

## 无法忠实模拟时的 `run`

当页面已经有有意义的 DOM 事件时，原语是好选择。自定义组件不一定有这样的路径。它可能渲染到 canvas，依赖框架私有的事件序列，或者提供一个比直接操作内部节点更安全的命令式方法。

这些情况下，可以给动作挂一层很薄的 `run`，调用组件原有的业务方法：

```ts
const submit = {
  id: 'submit_order',
  desc: '提交当前工单。',
  kind: 'write',
  run: () => orderForm.submit(),
};
```

框架会把注入动作记为 `high`，因为它没有声称 DOM 模拟是可靠的。这也带来一个后果：此时的 `high` 描述的是执行路径，不是业务结果。仍然要用 `expect`、HTTP 响应或其他页面检查确认操作真的发生。

当 DOM 路径不是组件提供的契约时，使用 `run`。不要用它来掩盖一个错误的目标。清楚的 `target` 加上页面原有原生事件，更容易审查，也能保留页面自己的行为。

`autoTarget: false` 是更窄的控制。它阻止框架在声明元素内部查找目标，但不会让声明元素本身变成可交互元素。如果事件确实由该元素拥有，就配合显式保真度声明；如果没有，就使用 `run` 或声明正确目标。

## 保真度的含义

`fidelity` 会出现在三个地方：

- 给模型的动作列表里，非 `high` 值会带标签；
- 执行结果里，非 `high` 值会被带上；
- 自动定位没有结果或存在歧义时，开发期警告里会说明。

这些值只回答一个有限的问题：

| 值 | 说明 | 不说明 |
| --- | --- | --- |
| `high` | 声明元素是原生元素、使用了注入路径，或开发者提供了显式目标。 | 业务操作成功。 |
| `auto` | 声明元素内部恰好找到一个符合原语的元素。 | 组件语义正确。 |
| `low` | 框架找不到可辩护的目标，或开发者关闭了自动查找。 | 浏览器事件必然无效；事件仍可能到达声明元素自己的处理函数。 |

框架不会静默修复 `low` 动作。只要页面可用性和裁剪没有移除它，它仍然可调用；执行结果会带上“效果未验证”的警告。这比假装事件到达了预期控件更诚实。

开发者显式写的 `fidelity` 是声明，不是运行时证明。把它设为 `high` 会取消目标警告，并改变模型看到的标签。只有当开发者能解释“为什么就是这个元素接收原语”时才应这样写。团队评审应当能对照组件代码核实这个解释。

## 目标解析的验证

夹具对容易出错的路径提供了确定性测试：

1. 手工新增仍然按所选优先级创建任务。
2. 原生 `<select>` 只接受声明的优先级，并更新已有的 `v-model`。
3. 填写搜索框不会应用筛选，按下回车才会。
4. 多按钮组件通过显式目标完成筛选。
5. 悬停菜单后，`clear_completed` 才出现。
6. 没有显式保真度声明时，包装元素的 `autoTarget: false` 保持为 `low`。
7. 自己处理 click 的包装元素可以声明 `high` 并执行处理函数。
8. 回放模型可以端到端执行选择、添加、搜索和按键序列。

测试文件还会检查注册表中的 `fidelity`。这不是 DOM 断言的重复。一个点击恰好因为测试挂在了第一个按钮上而成功，不能证明自动解析在多控件页面上是安全的。

## 验证本章示例

在仓库根目录启动打包后的示例：

```bash
pnpm tutorial:dev v3-06 --locale zh
```

源文件位于 `examples/tutorials/v3-06-real-controls-and-custom-components`。脚本会打包框架包为本地 tarball，复制夹具，安装这些 tarball，并在端口 `5216` 启动 Vite。

可以手动检查以下路径：

1. 选择 `稍后`，输入 `准备明天的议程` 并提交。新行应显示 `稍后` 标记。
2. 在搜索框输入 `客户`。列表此时不应变化；按回车后，只应剩下 `跟进客户`。
3. 点击自定义筛选组件中的 `未完成`，再点击 `已完成`。手工按钮应正常工作。
4. 把指针移到 `更多` 上。菜单应打开，并显示 `清除已完成 (1)`。
5. 对助手说：`添加“起草发布说明”，优先级设为稍后，然后搜索“发布”。` 回放测试走同一序列；真实模型应调用 `select_priority`、`add_task`、`search_text` 和 `search_enter`。
6. 打开执行记录，把记录中的动作 id 与“控件结构与改动范围”一节的表对照。非 `high` 的结果会被明确标注。

## 本章边界与后续

内置目标查找有明确的限制：

- 只在声明元素的子树内查找，不扫描整份文档；
- 不跨越 shadow root；
- 不理解 canvas、虚拟列表或组件内部状态机；
- 不会把一串交互自动合并成一个业务动作；
- 不判断操作是否安全、是否获授权、是否可逆。

这些是不同机制。没有可靠 DOM 路径的组件，应通过 `run` 暴露一个小的业务操作，最好配合成功判据。必须保持为一个工具的交互序列属于流程层。危险操作需要自己的确认与授权策略。

下一章[记录、行内动作与变更证据](/zh/vue/records-row-actions-and-change-evidence)会从单个控件转向行数据。它会解释重复行动作如何折叠、一行如何被识别，以及操作改变数据后留下什么证据。
