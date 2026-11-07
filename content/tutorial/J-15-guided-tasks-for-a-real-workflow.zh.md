---
id: J-15
title: "面向真实业务流程的引导任务"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 面向真实业务流程的引导任务

原生页面不需要框架也能提供引导任务。它真正需要的是一条稳定的业务边界、一个助手入口，以及把任务工作记忆写回现有表单的一层薄适配。课程管理后台保留原来的表单、动作和校验；助手负责理解用户、更新工作记忆和解释下一步。

## 一句话创建课程，而不是逐字段问答

示例页面进入时打开“创建新课程”表单。用户可以直接说：

```text
孕妇瑜伽，陈老师，2 星，介绍自动填写，用月卡
```

模型把这句话理解为 `name`、`teacherId`、`difficulty`、`intro` 和 `cards`，通过 `pling_update_task` 一次写入当前任务。`runtime.ts` 订阅 `TaskRunSnapshot`，把变化同步到原表单。页面没有自然语言正则，也不会把整句话塞进课程名。

不在老师列表里的名字会让助手停下来提问；封面必须由本人上传；可用卡、难度和介绍可以一次说清，也可以直接在页面改。用户中途问“这个字段是什么意思”、改主意或暂停，都仍然是一段普通对话。

## 任务定义：目标 + 约束 + 工作记忆

`TaskDefinition` 描述“要完成什么”，而不是“下一句该问什么”。课程任务的字段表既给模型看，也给页面推导当前缺口：

```ts
const courseTask: TaskDefinition = {
  id: "course.create",
  title: "创建课程",
  objective: "帮助用户把一门可上架的课程创建到课程库，而不是机械地逐个询问字段。",
  constraints: [
    "课程名称、授课老师、可用卡与封面是完成条件；难度、介绍、须知、扣卡次数和价格可省略。",
    "封面必须由用户亲自上传，助手不能伪造。",
    "所有写入仍走 create_course 动作、执行器和回读校验。",
  ],
  successCriteria: ["新课程出现在课程库第一位", "写入后重新读取课程列表验证成功"],
  fields: [
    { name: "name", label: "课程名称", minLength: 1, maxLength: 40 },
    {
      name: "teacherId",
      label: "授课老师",
      type: "lookup",
      searchAction: "search_teachers",
      validate: (value) => teachers.some((teacher) => teacher.id === value) ? null : "请从搜索结果中选择老师。",
    },
    { name: "cards", label: "可用卡片", type: "select", values: cardChoices },
    { name: "cover", label: "课程封面", type: "boolean", agentWritable: false },
    { name: "difficulty", label: "难度", type: "number", optional: true, min: 1, max: 5 },
  ],
  steps: [
    {
      id: "course.save",
      label: "写入课程库并回读",
      action: "create_course",
      args: (values) => values,
    },
  ],
};
```

字段支持 `min` / `max`、`minLength` / `maxLength`、`pattern`、封闭集合 `values` 和业务 `validate(value, values)`。这些检查在值进入任务快照之前执行；模型可以重试或换一种问法，但无法绕过页面校验。

`steps` 只描述一次确定性业务写入，不代表对话脚本。课程创建只有一个 `create_course` 步骤；先收集哪些字段、什么时候追问、什么时候直接回答用户，由模型根据任务工作记忆决定。

## 页面只执行显式命令

页面不解析用户说了什么，只执行已经声明的界面命令。共享运行时把任务目录、控制器和引导接到一起：

```ts
taskRuntime = createCourseTaskRuntime({
  registry: pling.registry,
  ask: (prompt) => pling.ask(prompt),
  catalog: pling.task,
  service,
  locale,
  form: courseForm,
  onComplete: () => render(),
});
```

`createCourseTaskRuntime` 会注册 `course.create`、`teacher.create`、`course.schedule` 等任务，并创建课程引导。引导暴露少量命令：

- `focus-*`：把真实字段滚进视野并高亮；
- `use-suggestion` / `apply-*`：把推荐值写进原控件；
- `skip-field`：跳过可选项；
- `start-review` / `review-task`：打开只读核对；
- `propose-save`：打开确认，不执行写入；
- `cancel-task`：结束引导。

模型侧对应的窄工具是 `pling_focus_field`、`pling_review_task`、`pling_propose_save` 和 `pling_cancel_task`。它们和普通动作一样经过权限、审计和可用性判断；没有在 `guide.agent` 里声明的命令不会出现在模型上下文里。

## 挂进原生 JS 助手

原生 JS 入口只负责把现有页面、任务运行时和助手 dock 接起来：

```ts
import { createTaskCard } from "@plingjs/vanilla";
import {
  createCourseTaskRuntime,
  createCourseTaskView,
} from "../../../shared/course-workspace/runtime";

taskRuntime = createCourseTaskRuntime({
  registry: pling.registry,
  ask: (prompt) => pling.ask(prompt),
  catalog: pling.task,
  service,
  locale,
  form: courseForm,
});

taskCard = createTaskCard(taskRuntime.controller, {
  locale: locale === "zh" ? "zh-CN" : "en-US",
  title: copy.taskPanelTitle,
  onPrompt: (prompt) => void pling.ask(prompt),
});

const taskView = createCourseTaskView(taskCard, taskRuntime);
dock = pling.dock({
  title: "页灵助手",
  layout: "sidebar",
  sidebarMode: "fused",
  defaultOpen: true,
  task: taskView.element,
  mount: document.querySelector("#dock-mount")!,
});
```

`course-form.ts` 仍是业务输入的唯一来源。用户点“自动填写”时，页面把推荐值写进原控件；用户直接改表单时，下一次引导读取的是页面新值。聊天里不会再长出一套课程表单。

## 保存必须由人确认

任务的最后一步不是模型“宣布完成”，而是页面执行一次真实写入：

1. 必填项没有齐时，操作行只提供定位、自动填写或跳过，不出现“确认保存”。
2. 封面未上传时，只保留“上传封面”，并高亮原页面的文件选择区。
3. 用户点击“确认保存”后，页面重新读取全部字段，调用 `controller.run()`。
4. `create_course` 以 `modelVisible: false` 注册，模型不能绕过确认直接写入。
5. 写入后检查课程库，新记录必须出现在第一位，才进入完成态。

创建完成后点“再做一次”，第一门课程仍留在课程库；第二门课程继续走同一套任务。消息变多后，聊天记录仍可上下滚动。

## 在浏览器里核对

打开 [原生 JS 课程管理后台](/demos/course-workspace/?lang=zh)，依次检查：

- 首屏打开创建课程表单，助手只显示一条轻量操作行，没有独立任务面板。
- 输入“孕妇瑜伽，陈老师，2 星，介绍自动填写，用月卡”，值一次写回原表单，老师解析为陈静。
- 任务进行中问一个无关问题，助手先回答，不会把问题当成课程名。
- 说“难度改成 4 星”，只更新难度。
- 输入不存在的老师，助手停下来列出可选老师，不静默替换。
- 没有封面时不能确认保存；上传封面后出现“确认保存”。
- 确认后新课程出现在课程库第一位，扣卡次数显示为 `1`。
- 再次创建第二门课程，第一门仍存在，聊天记录可以滚动。

## 最小接入顺序

1. 用 `TaskDefinition` 声明字段、校验、动作和回读条件。
2. 用 `TaskGuideDefinition` 声明欢迎语、字段表和 `agent` 命令；`steps` 只写业务阶段，不写逐字段脚本。
3. 用 `pling.task.define()` 或共享运行时注册任务，声明 `route`、`scope` 和 `autoStart`。
4. 在页面实现显式命令：定位、采用推荐、跳过、核对、确认保存、取消。
5. 写入后重新读取业务数据，用页面结果决定是否完成。

React、Vue 3、Vue 2.7 和原生 JS 版本共用同一套任务定义、字段推导和操作行，只替换适配器的挂载方式。
