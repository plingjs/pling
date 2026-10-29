---
id: R-06
title: "真实控件与自定义组件"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 真实控件与自定义组件

上一章把表单上的两个控件动作合并成了一个业务动作 `add_task`。这对“新增待办”是正确的，但不意味着页面上的每个交互都应该变成抽象的业务函数。优先级选择、搜索和筛选仍然属于页面已有的控件；Agent 应该操作这些控件，而不是绕开它们。

还有另一个问题。声明可以落在原生元素上，也可以落在组件外壳上。组件外壳通常并不接收事件。如果框架点击的是外壳，动作可能报告成功，页面却没有变化。本章讨论的正是这段距离：交互最终落到哪个元素，框架依据什么做出这个选择。

## 上一章留下的空白

仍然从新增待办开始。用户可能接着说：

> 添加“准备明天的议程”，优先级设为稍后，然后搜索“议程”。

新增本身已经有 `add_task`。优先级和搜索不同。它们是用户看得见、能够直接操作的控件，行为由页面负责。Agent 应当使用同样的控件，而不是调用一个页面并不存在的 `set_priority` 或 `perform_search`。

这里有两个必须分开的问题：

- **要执行什么交互？** 设置下拉框的值、向输入框填写文字、按下 Enter、点击多个按钮中的一个，或者把指针移到菜单上。
- **由哪个元素接收？** 原生控件、自定义组件内部唯一的输入框，或者显式指定的某个按钮。

第一个问题属于交互原语，第二个问题属于目标解析。任何一边出错，结果都可能写着“已点击”，应用却什么也没做。

## 示例中的控件

页面沿用上一章的 Todo 结构，并增加四类控件：

| 动作 | 原语 | 实际目标 | 保真度 |
| --- | --- | --- | --- |
| `select_priority` | `select` | 原生优先级 `<select>` | `high`（`native`） |
| `search_text` | `type` | `SearchBox` 内部唯一的输入框 | `auto` |
| `search_enter` | `press` | 同一个输入框 | `auto` |
| `show_all_tasks` | `click` | `TaskFilters` 内的一个按钮 | `high`（显式 `target`） |
| `show_open_tasks` | `click` | `TaskFilters` 内的一个按钮 | `high`（显式 `target`） |
| `show_completed_tasks` | `click` | `TaskFilters` 内的一个按钮 | `high`（显式 `target`） |
| `open_bulk_menu` | `hover` | `BulkMenu` 的根元素 | `high`（显式声明） |
| `clear_completed` | `click` | 菜单展开后挂载的按钮 | `high`（`native`） |

这些声明不是同一种操作的不同写法。`add_task` 是带输入校验和成功判据的业务动作；上表中的其余动作是页面交互。保留它们，是因为页面本来就以这些控件提供能力，用户也会直接使用它们。

## 原生控件的目标不需要猜

优先级选择器就是一个普通的 React `<select>`，值已经由应用控制：

```tsx{1-11}
const priorityRef = usePlingTool<HTMLSelectElement>({
  id: "select_priority",
  desc: copy.selectPriorityDesc,
  kind: "write",
  action: "select",
  params: [{
    name: "value",
    label: copy.selectPriorityParamLabel,
    values: ["today", "soon", "later"],
  }],
});
```

这条声明没有复制一份优先级状态。`select` 原语写入原生 value，并派发 `change` 事件；React 原有的 `onChange` 接到事件后，更新 `addTask` 使用的状态。

```tsx{3-6}
<select
  id="task-priority"
  ref={priorityRef}
  value={priority}
  aria-label={copy.priorityAria}
  onChange={(event) => setPriority(event.target.value as Priority)}
>
  <option value="today">{copy.priorities.today}</option>
  <option value="soon">{copy.priorities.soon}</option>
  <option value="later">{copy.priorities.later}</option>
</select>
```

实际接收交互的就是这个原生元素，不需要在内部继续查找，因此解析结果是 `high`，原因是 `native`。`params` 仍然有意义：它说明 `value` 必填，并把模型可选的值收窄到页面真正能处理的三项。

选择优先级本身不会新增待办。因此 `add_task` 执行时读取当前优先级：

```tsx{2}
run: (args: Record<string, unknown>) => {
  lastAddedId.current = addTask(String(args.text), priority)?.id ?? null;
},
```

## 声明可以挂在组件上

搜索框是一个自定义组件，内部只有一个输入框。组件负责图标、受控值和 Enter 行为：

```tsx{6,15-19}
export const SearchBox = forwardRef<HTMLDivElement, SearchBoxProps>(function SearchBox(
  { value, label, placeholder, onChange, onSearch },
  ref,
) {
  return (
    <div className="search-box" ref={ref}>
      <span className="search-box__icon" aria-hidden="true">⌕</span>
      <input
        type="search"
        aria-label={label}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          onSearch();
        }}
      />
    </div>
  );
});
```

两个声明挂在组件外壳上，而不是直接挂在内部输入框上：

```tsx{1-12,14-17}
const searchTextRef = usePlingTool<HTMLDivElement>({
  id: "search_text",
  desc: copy.searchTextDesc,
  kind: "write",
  action: "fill",
});
const searchEnterRef = usePlingTool<HTMLDivElement>({
  id: "search_enter",
  desc: copy.searchEnterDesc,
  kind: "write",
  action: "press",
  key: "Enter",
});

const searchRef = useMemo(
  () => mergeRefs(searchTextRef, searchEnterRef),
  [searchEnterRef, searchTextRef],
);
```

React 侧写的是 `action: "fill"`，适配器把它投影为 `type` 原语。工具列表显示这个原语；运行记录显示动作 id，不显示原语名。`mergeRefs` 让两个声明附着在同一个 DOM 节点上。每个动作仍保留自己的 id、原语和说明。框架在外壳内部找到恰好一个符合条件的输入框，因此给出 `auto`：这条 DOM 路径可信，但输入框的含义仍由组件决定，而不是由框架推断。

拆成两个动作不是示例的偶然选择。页面本身就把“填写搜索词”和“应用搜索”分开：输入文字不会改变列表，按下 Enter 才会。保留 `search_text` 与 `search_enter`，既忠实于页面，也让第二步出现在运行记录里。

## 多个控件必须显式指定目标

`TaskFilters` 内部有三个按钮。它们使用同一种原语，自动查找没有合理的依据判断该选哪一个。只给组件外壳声明一个 `click`，结果只能是歧义。

每个动作分别指定按钮：

```tsx{1-8,10-17,19-26}
const showAllRef = usePlingTool<HTMLDivElement>({
  id: "show_all_tasks",
  desc: copy.showAllDesc,
  kind: "read",
  action: "click",
  target: 'button[data-filter="all"]',
});
const showOpenRef = usePlingTool<HTMLDivElement>({
  id: "show_open_tasks",
  desc: copy.showOpenDesc,
  kind: "read",
  action: "click",
  target: 'button[data-filter="active"]',
});
const showCompletedRef = usePlingTool<HTMLDivElement>({
  id: "show_completed_tasks",
  desc: copy.showCompletedDesc,
  kind: "read",
  action: "click",
  target: 'button[data-filter="completed"]',
});

const filtersRef = useMemo(
  () => mergeRefs(showAllRef, showOpenRef, showCompletedRef),
  [showAllRef, showCompletedRef, showOpenRef],
);
```

`target` 是在声明元素内部查找的 CSS 选择器，不是对整份文档的搜索。这个边界很重要：动作仍然属于开发者声明的组件，页面后面的另一个按钮也不会碰巧满足条件。

只有 `target` 在声明元素内部恰好匹配一个元素时，保真度才是 `high`，原因是 `declared`。如果一个都匹配不到，动作仍会注册，但解析结果是 `low`，原因是 `target-missing`。选择器是开发者对组件结构的说明，不是权限检查，也不能证明点击一定产生了正确的业务结果。

## 悬停才出现的动作

批量菜单默认关闭，清除按钮在菜单打开前根本不在 DOM 中。`clear_completed` 声明在这个按钮上，所以菜单关闭时不存在对应绑定：动作完全不在注册表里，而不是处于“不可用”状态。如果改在始终挂载的外壳上声明，再用 `target` 指向按钮，行为会不同：动作仍会注册，但按钮不存在时解析为 `low`，原因是 `target-missing`。

菜单由指针进入打开：

```tsx{10-12,24-29}
export const BulkMenu = forwardRef<HTMLDivElement, BulkMenuProps>(function BulkMenu(
  { label, clearLabel, clearRef, completed, onClear },
  ref,
) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="bulk"
      ref={ref}
      onMouseOver={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="bulk__trigger"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>
      {open ? (
        <div className="bulk__menu">
          <button
            ref={clearRef}
            className="todo__clear"
            type="button"
            disabled={completed === 0}
            onClick={onClear}
          >
            {clearLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
});
```

两个声明挂在不同元素上：

```tsx{1-12}
const openBulkMenuRef = usePlingTool<HTMLDivElement>({
  id: "open_bulk_menu",
  desc: copy.openBulkMenuDesc,
  kind: "read",
  action: "hover",
  fidelity: "high",
});
const clearCompletedRef = usePlingTool<HTMLButtonElement>({
  id: "clear_completed",
  desc: copy.clearCompletedDesc,
  kind: "danger",
});
```

悬停动作声明在始终挂载的外壳上。`fidelity: "high"` 是开发者明确声明：指针处理函数确实由这个根元素拥有。悬停原语执行后，React 渲染出菜单，清除按钮自己的声明才进入注册表。清除动作不需要 `target`，因为按钮本身就是声明元素。

“不可用”和“不存在”是两种不同的失败。已经挂载的动作可能因为被禁用或遮挡而不可用；声明元素根本没有渲染时，动作不会进入注册表；声明元素已经挂载、但 `target` 找不到时，动作仍会注册，只是解析为 `low`，原因是 `target-missing`。模型无法调用不存在的动作，而注册为 `low` 的动作也没有可辩护的 DOM 路径。

## 保真度是证据，不是成功标记

示例产生不同的保真度，是因为依据不同：

| 值 | 来源 | 在本例中的含义 |
| --- | --- | --- |
| `high`，`native` | 声明就在原生 `<select>` 或按钮上 | 元素可以直接接收原语 |
| `high`，`declared` | 开发者提供了 `target` | 组件内部有一个明确、可审查的元素 |
| `high`，`declared` | 开发者在拥有事件的元素上声明 `fidelity: "high"` | 这个说明应当与组件处理函数一致 |
| `auto` | 外壳内部恰好找到一个符合条件的输入框 | DOM 路径可信，但组件仍拥有行为 |
| `low` | 关闭了查找、`target` 没有匹配，或仍有多个候选 | 不能把执行结果当成页面已经响应的证明 |

显式 `target` 和显式 `fidelity` 都报告原因 `declared`，区别在开发者提供了什么。这个原因只解释目标为何被接受，不表示业务操作已经成功。

这个值从不表示“业务操作成功”。点击可能落到正确按钮上，却仍被校验拦截、遇到服务端错误，或者写入了错误的数据。反过来，`low` 也不保证事件一定无效；它只说明框架没有可辩护的目标解释。

`autoTarget: false` 与 `run` 也不同。它只是禁止在声明元素内部查找目标。如果该元素自己处理点击，可以配合显式保真度声明；如果它不处理，动作仍然没有可靠的 DOM 路径，应改用 `run` 或声明正确目标。

## 什么时候不该模拟控件

确实存在无法通过 DOM 事件忠实操作组件的场景。画布编辑器、会销毁行节点的虚拟列表、维护内部键盘状态机的控件，都可能没有稳定的目标元素。这时应通过 `run` 暴露一个小而明确的业务操作，并声明成功判据。

不要用 `run` 掩盖没有解决的目标问题。页面已有行为正确的原生控件，就使用它；组件能明确指出内部控件，就用 `target`。只有当交互本身不是契约、真正的契约是业务操作时，才让 `run` 接手。

## 运行并验证

在仓库根目录启动中文界面：

```bash
pnpm tutorial:dev r-06 --locale zh
```

打开 `http://127.0.0.1:5246/?lang=zh`。示例源码位于 `examples/tutorials/r-06-real-controls-and-custom-components`；英文界面使用 `pnpm tutorial:dev r-06` 和 `http://127.0.0.1:5246/`。

依次检查：

1. 选择“稍后”，输入“准备明天的议程”并提交。新行应带有“稍后”标记。
2. 在搜索框输入“客户”。列表暂时不应变化；按 Enter 后，只应剩下“跟进客户”。
3. 清空搜索框并按 Enter，再选择“全部”。依次点击“未完成”“已完成”“全部”，每次都应看到列表变化。
4. 把指针移到“更多”上。菜单应打开，并显示“清除已完成（1）”。点击它，确认已完成行消失，然后重新选择“全部”。
5. 对助手说：`添加“起草发布说明”，优先级设为稍后，然后搜索“发布”。` 此时没有搜索条件、筛选为“全部”，新待办才能通过结果判据。真实模型应依次调用 `select_priority`、`add_task`、`search_text` 和 `search_enter`。
6. 打开 **运行**，再选择 **诊断信息**。在 **动作** 中确认 id 与原语；在 **本次调用时的页面** 中确认该请求里存在哪些动作。这两个视图都不显示目标选择器，也不显示目标被接受的原因，因此目标声明要对照第 3–6 节的代码检查。本次运行没有打开菜单，所以工具列表里不应出现 `clear_completed`。

## 下一章

这一页现在同时包含原生控件、单输入组件、多按钮组件，以及悬停后才出现的内容。每次交互都会得到一个保真度和一个原因：直接控件是 `native`，显式目标或显式声明是 `declared`，只有一个候选被找到时是 `auto`，没有可辩护目标时是 `low`。运行记录会显示非 `high` 的值；目标选择器仍留在源码里。所有交互都停留在页面层级，没有凭空发明业务捷径。

下一章转向重复的行内动作。它讨论一长串记录如何只暴露一个操作，而不是为每一行生成一个工具，以及数据改变之后还能留下哪些可核对的证据。
