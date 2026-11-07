---
id: R-25
title: "面向真实业务流程的引导任务"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 面向真实业务流程的引导任务

React 应用经常有一个信息丰富的后台页面，但助手入口仍然是一个空白输入框。引导任务把顺序反过来：页面先说明当前角色能完成什么，助手再根据用户的一段话补齐信息、解释下一步，并把人带到真实字段。

这一章沿用课程管理后台。React 负责渲染、Hook 或 class 生命周期；任务定义、字段推导、执行器和引导操作行来自共享的 `examples/shared/course-workspace/`，React 版本不复制任何一套业务规则。

## 页面不动，助手接住整件事

创建课程仍然是原来的表单。助手弹窗里没有第二套输入框，只有一条轻量操作行：

```text
孕妇瑜伽，陈老师，2 星，介绍自动填写，用月卡
```

模型把这句话理解为 `name`、`teacherId`、`difficulty`、`intro` 和 `cards`，调用 `pling_update_task` 写入任务工作记忆。页面订阅 `TaskRunSnapshot`，把值同步到原表单；用户直接在页面改，下一次引导读取的也是页面新值。

字段校验属于页面，不属于对话。`TaskField` 支持 `min` / `max`、`minLength` / `maxLength`、`pattern`、封闭 `values` 和业务 `validate(value, values)`。模型只能通过 `pling_update_task` 写声明过的字段，无法绕过校验，也无法伪造必须由人上传的封面。

## React 只负责挂载共享运行时

React 19 使用 Hooks，React 16.3 使用 class 与 render props，但两者挂载的是同一个 `createCourseTaskRuntime`：

```tsx
React.useEffect(() => {
  taskRuntime.current = createCourseTaskRuntime({
    registry: pling.registry,
    ask: (prompt) => pling.ask(prompt),
    catalog: pling.task,
    service,
    locale,
    form: courseForm,
    onComplete: () => setRevision((value) => value + 1),
  });

  taskCard.current = createTaskCard(taskRuntime.current.controller, {
    locale: locale === "zh" ? "zh-CN" : "en-US",
    title: COPY[locale].taskPanelTitle,
    onPrompt: (prompt) => void pling.ask(prompt),
  });

  taskView.current = createCourseTaskView(taskCard.current, taskRuntime.current);
  taskHost.current?.replaceChildren(taskView.current.element);

  return () => {
    taskRuntime.current?.destroy();
    taskView.current?.destroy();
    taskCard.current?.destroy();
    courseForm.destroy();
  };
}, [pling, service, locale, courseForm]);
```

组件树只多了一个任务视图槽：

```tsx
<AgentDock
  title="页灵助手"
  placeholder="告诉助手你要做什么，或继续当前任务…"
  layout="sidebar"
  sidebarMode="fused"
  defaultOpen
  debug={{ maxCalls: 8 }}
  task={<div ref={taskHost} />}
/>
```

`course-form.ts` 仍是业务输入的唯一来源；`course-guide.ts` 负责定位、自动填写、核对和取消这些显式命令。React 组件不写自然语言正则，也不决定“下一个该问哪个字段”。

## 任务不是脚本

课程任务声明目标、约束、成功判据和字段表：

```ts
const courseTask: TaskDefinition = {
  id: "course.create",
  title: "创建课程",
  objective: "帮助用户把一门可上架的课程创建到课程库，而不是机械地逐个询问字段。",
  constraints: [
    "课程名称、授课老师、可用卡与封面是完成条件；难度、介绍、须知、扣卡次数和价格可省略。",
    "封面必须由用户亲自上传，助手不能伪造。",
  ],
  successCriteria: ["新课程出现在课程库第一位", "写入后重新读取课程列表验证成功"],
  fields: [
    { name: "name", label: "课程名称", minLength: 1, maxLength: 40 },
    { name: "teacherId", label: "授课老师", type: "lookup", searchAction: "search_teachers" },
    { name: "cards", label: "可用卡片", type: "select", values: cardChoices },
    { name: "cover", label: "课程封面", type: "boolean", agentWritable: false },
  ],
  steps: [{ id: "course.save", label: "写入课程库", action: "create_course", args: (values) => values }],
};
```

模型可以回答用户的问题、接收修正、暂停或在信息足够时打开核对。它不能因为“还差课程名”就把一句话塞进课程名，也不能绕过 `create_course` 的权限和回读。

## 页面掌握最后一下

引导声明模型可调用的命令：

```ts
const guide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "创建课程",
  welcome: "把课程信息一次说给我，也可以直接在页面填写，我来补缺。",
  agent: {
    review: "review-task",
    proposeSave: "propose-save",
    cancel: "cancel-task",
  },
  fields: () => courseCreateFieldNodes(locale, draft, teachers, skipped),
  steps: [{ id: "course.fill", label: "创建课程", title: "创建课程", description: "写回原表单，由人确认保存。" }],
};
```

- `pling_focus_field` 只定位和高亮，不写值；
- `pling_review_task` 打开只读核对；
- `pling_propose_save` 只打开确认，不执行写入；
- `pling_cancel_task` 结束引导，不回滚已经写进表单的值。

必填项没齐时不会出现“确认保存”；封面没上传时只保留“上传封面”。点击确认后，页面重新读取全部字段，执行 `create_course`，再检查课程库第一条是否就是刚创建的课程。

## 两个 React 版本

打开 [React 19 课程管理后台](/demos/course-workspace-react/?lang=zh)和 [React 16.3 课程管理后台](/demos/course-workspace-react16/?lang=zh)，两者应表现一致：

- 首屏打开创建课程表单，聊天里只有操作行，没有独立任务面板。
- 输入“孕妇瑜伽，陈老师，2 星，介绍自动填写，用月卡”，值一次写回原表单，老师解析为陈静。
- 任务中问无关问题，助手先回答，不会把问题当成课程名。
- “难度改成 4 星”只更新难度。
- 不存在的老师会停下来列出候选，不静默替换。
- 没有封面不能保存；上传后确认，新课程出现在第一位，扣卡次数为 `1`。
- 再做一次创建第二门课程，第一门仍存在，聊天记录可以滚动。

React 16.3 没有 Hooks，但业务结果、任务定义和引导命令与 React 19 完全相同；变化只在 class 生命周期和 render props 的挂载方式。
