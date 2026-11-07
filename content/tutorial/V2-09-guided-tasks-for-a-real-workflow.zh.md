---
id: V2-09
title: "面向真实业务流程的引导任务"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 面向真实业务流程的引导任务

Vue 2.7 也能提供与 Vue 3、React 和原生 JS 相同的引导任务，而且不需要把老项目重写成 Vue 3。业务页面继续使用已有的表单、服务和校验；Vue 2.7 负责组件生命周期与渲染，任务定义、字段推导、执行器和操作行来自共享的 `examples/shared/course-workspace/`。

这一章沿用课程管理后台。页面进入时打开原有的“创建新课程”表单；助手不复制一套字段，而是理解用户的一段话，把变化写回原表单，再在需要人决定的地方停下来。

## 一句话接住整段课程描述

创建课程原本需要填写很多字段。逐项追问会把人拖回表单问答，因此这个示例不在页面里写自然语言正则，也不维护关键词表。用户可以直接说：

```text
孕妇瑜伽，陈老师，2 星，介绍自动填写，用月卡
```

模型看到当前任务的 `objective`、`constraints`、字段表、已填值、缺口和引导阶段，把这句话理解为 `name`、`teacherId`、`difficulty`、`intro` 和 `cards`，调用一次 `pling_update_task` 写入工作记忆。页面订阅 `TaskRunSnapshot`，把变化同步到原表单。

如果老师不在列表里，助手会停下来列出候选；如果封面还没上传，它只把页面定位到上传区，文件选择交给人。用户中途问“这个字段是什么意思”、改主意或暂停，仍然是一段普通对话。任务状态是工作记忆，不是必须照做的脚本。

字段校验属于页面。`TaskField` 支持 `min` / `max`、`minLength` / `maxLength`、`pattern`、封闭集合 `values` 和业务 `validate(value, values)`。模型只能通过 `pling_update_task` 写声明过的字段；类型不对、老师不存在或难度越界都会返回失败，不会留下“写了一半”的表单。

## 任务定义：目标、约束与工作记忆

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
    { name: "teacherId", label: "授课老师", type: "lookup", searchAction: "search_teachers" },
    { name: "cards", label: "可用卡片", type: "select", values: cardChoices },
    { name: "cover", label: "课程封面", type: "boolean", agentWritable: false },
  ],
  steps: [{ id: "course.save", label: "写入课程库并回读", action: "create_course", args: (values) => values }],
};
```

`steps` 只描述一次确定性业务写入，不代表对话脚本。先收集哪个字段、什么时候追问、什么时候回答用户，由模型根据任务工作记忆决定。

## Vue 2.7 只负责挂载共享运行时

这个示例使用 Vue 2.7 的组合式 API 和渲染函数。`onMounted` 中创建共享任务运行时，`Vue.nextTick` 保证任务激活时弹窗作用域已经挂上：

```ts
import { Vue, onBeforeUnmount, onMounted } from "./vue2-runtime";
import { createTaskCard } from "@plingjs/vanilla";
import {
  createCourseTaskRuntime,
  createCourseTaskView,
} from "../../../shared/course-workspace/runtime";

onMounted(() => {
  void Vue.nextTick(() => {
    taskRuntime = createCourseTaskRuntime({
      registry: pling.registry,
      ask: (prompt) => pling.ask(prompt),
      catalog: pling.task,
      service,
      locale,
      form: courseForm,
      onComplete: () => { version.value += 1; },
    });

    taskCard = createTaskCard(taskRuntime.controller, {
      locale: zh ? "zh-CN" : "en-US",
      title: copy.value.taskPanelTitle,
      onPrompt: (prompt) => void pling.ask(prompt),
    });

    taskView = createCourseTaskView(taskCard, taskRuntime);
    dock = pling.dock({
      title: zh ? "页灵助手" : "Pling assistant",
      layout: "sidebar",
      sidebarMode: "fused",
      defaultOpen: true,
      task: taskView.element,
      mount: root.querySelector<HTMLElement>("#dock-mount"),
    });
  });
});

onBeforeUnmount(() => {
  taskRuntime?.destroy();
  taskView?.destroy();
  taskCard?.destroy();
  dock?.destroy();
});
```

`course-form.ts` 仍是业务输入的唯一来源。用户点“自动填写”时，页面把推荐值写进原控件；用户直接改表单时，下一次引导读取的是页面新值。聊天里不会再长出一套课程表单。

## 页面只执行显式命令

页面不解析用户说了什么，只执行已经声明的界面命令。课程引导暴露少量命令：

- `focus-*`：把真实字段滚进视野并高亮；
- `use-suggestion` / `apply-*`：把推荐值写进原控件；
- `skip-field`：跳过可选项；
- `review-task`：打开只读核对；
- `propose-save`：打开确认，不执行写入；
- `cancel-task`：结束引导。

模型侧对应的窄工具是 `pling_focus_field`、`pling_review_task`、`pling_propose_save` 和 `pling_cancel_task`。它们和普通动作一样经过权限、审计和可用性判断；没有在 `guide.agent` 里声明的命令不会出现在模型上下文里。

## 保存必须由人确认

任务的最后一步不是模型“宣布完成”，而是页面执行一次真实写入：

1. 必填项没有齐时，操作行只提供定位、自动填写或跳过，不出现“确认保存”。
2. 封面未上传时，只保留“上传封面”，并高亮原页面的文件选择区。
3. 用户点击“确认保存”后，页面重新读取全部字段，调用 `controller.run()`。
4. `create_course` 以 `modelVisible: false` 注册，模型不能绕过确认直接写入。
5. 写入后检查课程库，新记录必须出现在第一位，才进入完成态。

创建完成后点“再做一次”，第一门课程仍留在课程库；第二门课程继续走同一套任务。消息变多后，聊天记录仍可上下滚动。

## 在浏览器里核对

打开 [Vue 2.7 课程管理后台](/demos/course-workspace-vue2/?lang=zh)，依次检查：

- 首屏打开创建课程表单，助手只显示一条轻量操作行，没有独立任务面板。
- 输入“孕妇瑜伽，陈老师，2 星，介绍自动填写，用月卡”，值一次写回原表单，老师解析为陈静。
- 任务中问无关问题，助手先回答，不会把问题当成课程名。
- 说“难度改成 4 星”，只更新难度。
- 输入不存在的老师，助手停下来列出可选老师，不静默替换。
- 没有封面不能保存；上传后出现“确认保存”。
- 确认后新课程出现在课程库第一位，扣卡次数显示为 `1`。
- 再做一次创建第二门课程，第一门仍存在，聊天记录可以滚动。

## Vue 2.7 的边界

Vue 2.7 是最后一个提供组合式 API 的 Vue 2 版本，因此这个示例可以直接复用 Vue 3 章节的任务模型和 DOM 操作行。Vue 2.6 及更早版本没有这套组合式 API，不要强行安装 `@plingjs/vue2` 后期待同样的生命周期桥接；把页面当作原生 JS 使用 `@plingjs/vanilla` 即可，业务任务定义和 `course-form.ts` 不需要重写。

## 最小接入顺序

1. 用 `TaskDefinition` 声明字段、校验、动作和回读条件。
2. 用 `TaskGuideDefinition` 声明欢迎语、字段表和 `agent` 命令；`steps` 只写业务阶段，不写逐字段脚本。
3. 用 `pling.task.define()` 或共享运行时注册任务，声明 `route`、`scope` 和 `autoStart`。
4. 在页面实现显式命令：定位、采用推荐、跳过、核对、确认保存、取消。
5. 写入后重新读取业务数据，用页面结果决定是否完成。

Vue 2.7、Vue 3、React 19、React 16.3 和原生 JS 版本共用同一套任务定义、字段推导和操作行，只替换适配器的挂载方式。
