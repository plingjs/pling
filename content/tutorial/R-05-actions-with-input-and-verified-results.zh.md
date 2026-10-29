---
id: R-05
title: "带输入的动作与结果验证"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 带输入的动作与结果验证

上一章的检查器让一个事实变得很清楚：用户要求新增待办时，第一次请求里有 `composer_text`，没有 `composer_submit`；等输入框有了内容，第二次请求才出现提交按钮。模型实际上被要求还原一条表单操作链：找到输入框、填入文字、等待按钮可用、再点击提交。

这条链路忠实地描述了页面，却不是用户真正请求的操作。用户只说了一件事：新增一条待办。本章保持表单原样，改变的是 Agent 能调用的东西——用一个业务动作 `add_task` 取代两个控件动作。

## 表单不等于业务动作

对人来说，表单是合适的界面：输入框和提交按钮放在一起，焦点、键盘提交和禁用状态都由浏览器处理。但这些细节不必成为 Agent 的工作模型。

只暴露输入框和按钮时，Agent 必须自行推断：

- 哪个输入框属于当前请求；
- 是否必须先填写内容，按钮才会启用；
- 按钮此刻是否存在、是否可用；
- 按下按钮后，新增是否真的完成。

这会带来三个实际代价。一个业务操作可能消耗多次工具调用；页面布局或交互一改，声明就可能失真，尽管业务操作没有变化；参数规则与成功条件也没有一个统一的落点。

把声明放到表单上，并不会移除表单。它让 Agent 从页面原本就有的入口进入：添加待办的那个函数。

| 用户看到的事情 | 本章之前 | 本章之后 |
| --- | --- | --- |
| “添加一条名为‘回复客户’的待办。” | 填写输入框，再点击提交 | 调用 `add_task`，传入待办内容 |
| 输入规则 | 输入框长度与按钮禁用状态 | 声明 `text` 参数 |
| “还能继续添加吗？” | 按钮变为禁用 | `available` 返回原因 |
| “加成功了吗？” | 从列表变化中推断 | 明确的 `expect` 结果 |

## 在表单上声明业务动作

React 侧的改动很局部。输入框和提交按钮仍是普通元素，表单仍负责人工提交。上一章的两个控件声明，现在合并成绑定在表单上的一个声明：

```tsx{6,8-18,20-44}
const [tasks, setTasks] = useState<Task[]>(() =>
  copy.seedTasks.map((task, index) => ({ id: `t${index + 1}`, ...task })),
);
const [draft, setDraft] = useState("");
const sequence = useRef(copy.seedTasks.length);
const lastAddedId = useRef<string | null>(null);

function addTask(value: string): Task | null {
  const text = value.trim();
  if (!text || tasks.length >= MAX_TASKS) return null;
  const task = { id: `t${++sequence.current}`, text, done: false };
  setTasks((current) => [task, ...current]);
  return task;
}

function submitDraft(): void {
  if (addTask(draft)) setDraft("");
}

const addTaskRef = usePlingTool<HTMLFormElement>({
  id: "add_task",
  desc: copy.addTaskDesc,
  kind: "write",
  params: [{
    name: "text",
    label: copy.addTaskParamLabel,
    minLength: 1,
    maxLength: 80,
    pattern: /\S/,
  }],
  available: () =>
    tasks.length < MAX_TASKS ? true : copy.addTaskFullReason,
  run: (args: Record<string, unknown>) => {
    lastAddedId.current = addTask(String(args.text))?.id ?? null;
  },
  expect: {
    desc: copy.addTaskExpect,
    check: () =>
      lastAddedId.current !== null &&
      Boolean(document.querySelector(
        `[data-task-id="${lastAddedId.current}"]`,
      )),
  },
});
```

表单的字段保持不变，只是把 ref 从输入框和按钮移到表单本身：

```tsx{3,5-8}
<form
  className="composer"
  ref={addTaskRef}
  onSubmit={(event) => {
    event.preventDefault();
    submitDraft();
  }}
>
  <label className="composer__label" htmlFor="new-task">{copy.newTaskLabel}</label>
  <div className="composer__row">
    <input
      id="new-task"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      autoComplete="off"
      maxLength={80}
      placeholder={copy.placeholder}
    />
    <button
      type="submit"
      disabled={!draft.trim() || tasks.length >= MAX_TASKS}
    >
      {copy.addTask}
    </button>
  </div>
</form>
```

删除上一章的 `composerRef` 和 `submitRef`；输入框和按钮不再需要各自的 Pling 声明。

声明里提供了 `run`，调用 `add_task` 时框架就把参数交给这个函数，不再模拟点击表单。人仍然可以输入并提交；人工路径和 Agent 路径最终都会进入同一个 `addTask`。

`lastAddedId` 使用 ref，是因为 `run` 写入它、`expect` 稍后读取它，两边需要一个共同的当前值。待办列表本身仍是普通 React 状态。`usePlingTool` 会从每次渲染读取最新的 `available` 和 `run`，因此不需要再复制一份列表。

## 在执行前描述输入

`params` 是动作参数契约：

```ts
params: [{
  name: "text",
  label: "待办内容，1–80 个字符，不能只包含空格",
  minLength: 1,
  maxLength: 80,
  pattern: /\S/,
}]
```

这段字段规则会被投影成随工具一起发送的 JSON Schema：

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

参数默认必填；只有确实允许省略时才声明 `optional: true`。校验发生在确认与 `run` 之前，因此缺少 `text`、空字符串或只有空格都会返回 `INVALID_PARAMS`，既不弹出确认，也不会改变列表。

这个契约约束的是输入形态。它不是授权。合法的待办文字不能证明当前用户有权新增待办，参数规则也不能代替服务端权限检查。

## 连接已有的业务函数

声明没有另写一套新增逻辑：

```ts
run: (args: Record<string, unknown>) => {
  lastAddedId.current = addTask(String(args.text))?.id ?? null;
},
```

人工表单调用 `addTask(draft)`，Agent 路径通过 `run` 调用 `addTask(text)`。新增逻辑仍然只有一处；`available` 和按钮禁用只是把同一个前置条件提前告诉模型与用户。

`run` 可以是异步函数，框架会等它的 Promise 结束后再检查结果。但函数返回仍不等于页面已经到达预期状态：React 可能还没提交新行，应用也可能仍在等待请求。后面的声明用来补上这部分证据。

## 说明页面前置条件

列表已满时，表单仍然存在，但新增操作不能执行。`available` 把这个状态说清楚：

```ts
available: () =>
  tasks.length < MAX_TASKS ? true : copy.addTaskFullReason,
```

这段原因会进入页面快照的 **不可用** 区域。若仍用旧动作 id 执行，同样的原因会随 `ACTION_UNAVAILABLE` 返回。模型因此能区分“页面没有新增动作”和“动作存在，但列表已满”。

`available` 表达页面与业务前置条件，不是授权判断。执行时，框架还会检查目标是否被禁用、隐藏、遮挡或不在可视区域。区域裁剪是另一条暴露规则：活跃区域外的动作不会进入模型收到的快照，但这不是针对已知动作 id 的权限检查。服务端授权仍然必要。

## 让成功条件可观察

`add_task` 声明操作后页面应当满足什么：

```ts
expect: {
  desc: "新待办已经出现在列表中",
  check: () =>
    lastAddedId.current !== null &&
    Boolean(document.querySelector(
      `[data-task-id="${lastAddedId.current}"]`,
    )),
}
```

这个检查寻找实际渲染出的待办行，而不只检查 `addTask` 返回的 id。React 里“更新状态”和“提交出新的一行”是两个时刻，判据必须落在后一个时刻。`run` 之后，框架默认最多轮询两秒，可用 `expect.timeout` 调整。条件成立时，执行结果会包含这段说明；始终不成立时返回 `EXPECTATION_FAILED`，含义是操作执行了，但页面没有出现声明的结果。

这样不会把尚未渲染的更新当成成功而掩盖页面故障，也不会把已经发生的操作误报成点击失败、诱导重复提交。`expect` 记录的是页面证据，不是服务端确认、审计记录，也不证明声明的业务条件之外还有什么结果。

## 结果还带回变化证据

列表行已经以记录形式暴露，因此框架可以比较动作前后的页面。一次成功的新增会得到类似结果：

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

`expect` 回答的是“声明的页面条件是否成立”；`changed` 回答的是一个更窄的问题：“两份快照之间，哪些已暴露的记录和动作不同”。两者不能互相替代，也都不能证明业务结果一定正确。记录字段吻合，仍可能是错误的业务结果。

## 在运行记录中对照声明

上一章启用的检查器仍然可用，因此不需要猜测这次改动。让助手新增一条待办，打开 **运行**，再选择 **诊断信息**。

在处理新增的那次模型调用里：

1. **发送的工具** 中有 `add_task`，包含 `text` 参数和校验规则；
2. 不再出现 `composer_text` 或 `composer_submit`，页面上已经没有这两个声明；
3. 响应里只有一次 `add_task` 调用，并带入请求中的文字；
4. 下一次请求的 **请求消息** 里包含工具结果，其中有成功判据说明与前面的记录变化。

模型调用次数不是固定契约。模型可能一步完成，也可能先读页面、再调用动作，或者停下来询问缺少的细节。无论几步完成，Agent 面对的是一个业务动作，不再需要还原一串表单操作。

## 区分失败结果的含义

| 结果 | 含义 | 已经发生了什么 |
| --- | --- | --- |
| `INVALID_PARAMS` | 参数缺失，或违反了声明规则 | 确认和业务函数都没有执行 |
| `ACTION_UNAVAILABLE` | 页面或业务前置条件不成立 | 业务函数没有执行，结果包含原因 |
| `EXPECTATION_FAILED` | 函数执行了，但没有观察到声明的页面结果 | 页面可能已经改变；不检查就重试可能重复操作 |

输入校验、可用性、执行和结果观察因此必须分开声明。把它们压成一个布尔值，就无法解释究竟是哪一步失败了。

## 运行并验证

在仓库根目录执行中文界面：

```bash
pnpm tutorial:dev r-05 --locale zh
```

打开 `http://127.0.0.1:5245/?lang=zh`。示例源码位于 `examples/tutorials/r-05-actions-with-input-and-verified-results`；英文界面使用 `pnpm tutorial:dev r-05` 和 `http://127.0.0.1:5245/`。

依次检查：

1. 在表单输入 `回复客户` 并提交。待办应出现在顶部，输入框应清空。
2. 对助手说：`把“准备明天的议程”加入我的待办。` 结果应使用 `add_task`，而不是填写和点击两个控件。
3. 打开 **运行**，再选择 **诊断信息**。执行新增的那次请求里，**发送的工具** 应包含 `add_task`，不包含 `composer_*`。
4. 展开 **发送的工具**，确认 `add_task` 的 `text` 参数带有长度与空白字符规则。
5. 打开下一次请求，在工具消息中查看成功判据和新记录；列表中应出现请求的待办。
6. 把列表补到八条，再查看下一次请求。**发送的工具** 中不应再有 `add_task`，**不可用** 中应出现列表已满的原因。不可用动作会在请求发出前被过滤掉，模型无法选中；直接用旧动作 id 调用才会返回 `ACTION_UNAVAILABLE`。
7. 把一条已有待办标记完成。行内动作仍应只更新这一条记录。

人工表单与 Agent 路径现在共用同一个业务操作，页面也仍然是一张普通的待办列表。

## 下一章

新增操作现在有了稳定身份、经过校验的输入、明确的可用条件和可观察的结果。下一类问题发生在 DOM 上：声明最终落到哪个元素？原生输入框、组件外壳，以及内部包含多个控件的组件，都可能让自动解析选中错误目标。

下一章讨论真实控件与自定义组件，包括自动定位何时可信，以及声明在什么时候需要给出更精确的目标。
