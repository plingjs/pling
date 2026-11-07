---
id: J-15
title: "面向真实业务流程的引导任务"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 面向真实业务流程的引导任务

原生页面不需要框架也能提供引导任务。它需要稳定任务定义、一个助手对话入口，以及通往现有业务服务的执行桥。任务卡负责字段、查找、进度和错误，但不会引入第二套执行路径。

## 把任务卡放进助手对话

用 `createTaskCard()` 把任务卡挂进助手对话。业务页面仍然可操作，原有控件留在原地；任务卡只是一个更清楚的入口，负责页面不容易展示的决定与步骤。

课程管理后台的任务目录可以先放四个结果：新建课程、查学员会员卡、创建老师、排一节课。每个定义可以留在当前页面，也可以从应用自己的 task 模块导入。第五个结果“写课程备注”放在每条课表行上，因为它需要先选中一节课。

## 把任务步骤接到业务服务

控制器只接收一个 `invoke` 函数。这个函数决定步骤去动作执行器、只读 API，还是业务服务。任务卡不直接拿模型或网络权限。

```ts
import { createTaskController } from "@plingjs/agent";
import { createTaskCard } from "@plingjs/vanilla";
import { courseApi } from "./course-api";

const tasks = createTaskController({
  invoke: (action, args) => courseApi.invoke(action, args),
});

tasks.register({
  id: "student.cards",
  title: "查学员会员卡",
  fields: [
    {
      name: "studentRef",
      label: "学员",
      type: "lookup",
      lookup: (query) => courseApi.searchStudents(query),
    },
  ],
  steps: [
    { label: "读取学员", action: "get_student" },
    { label: "读取会员卡", action: "get_student_cards" },
  ],
});

const card = createTaskCard(tasks, { locale: "zh-CN", catalog: false });
const dock = pling.dock({
  layout: "sidebar",
  sidebarMode: "fused",
  defaultOpen: true,
  task: card.element,
});
```

同一个 `invoke` 边界让应用以后能把 DOM 动作换成 API-backed 函数动作，而任务 id 和面向人的文案保持不变。

[课程管理后台](/demos/course-workspace/?lang=zh)就是这一章的可运行版本，包含五个任务、一次被拒绝的时段，以及通过正常页面渲染更新的课程库和课表。

课程创建演示采用更接近真实后台的方式：进入页面时打开原有的“创建新课程”表单，助手侧栏只显示四步引导。第一步展示推荐值摘要并写入原表单；第二步选择老师和可用卡；第三步停下来，让用户在页面里选择封面；第四步从页面重新读取并核对。聊天里不再复制一套课程字段。`examples/shared/course-workspace/course-guide.ts` 负责这段引导，`course-form.ts` 仍是业务输入的唯一来源。下一步动作使用 `@plingjs/dom` 的共享紧凑操作行，长推荐只占一行预览，不会把按钮撑宽。

但这四个阶段只是页面自己的呈现，不是任务层的脚本。`course.create` 同时声明 `objective`、`constraints` 和 `successCriteria`，并通过 `pling.task.define` 把同一个 controller 注册进任务目录。模型可以回答“你会做什么”，接收“课程名叫减脂瑜伽”这样的修正，或者在用户说“卡片你来选”时调用 `pling_update_task`，只写被委托的字段；页面订阅 `TaskRunSnapshot`，把变化同步回原表单并重新推导当前阶段。真正的保存仍走 `create_course`、执行器和回读。

备注任务使用记录绑定，不靠隐藏的 id 输入框：

```ts
tasks.register({
  id: "lesson.note",
  title: "写课程备注",
  requiresRecord: true,
  fields: [{ name: "note", label: "备注", type: "textarea" }],
  steps: [{
    label: "保存备注",
    action: "update_lesson_note",
    args: (values, binding) => ({ lessonId: binding.record?.id, note: values.note }),
  }],
});

dock.open();
card.open("lesson.note", {}, {
  record: { id: lesson.id, label: `${lesson.course} · ${lesson.date} ${lesson.time}` },
});
```

没有绑定记录时，定义会拒绝启动。表单只问备注，任务头部显示绑定的课程。

## 让查找结果安全且可读

搜索结果包含稳定引用与人能读的标签。两个学员同名时，显示脱敏手机号或其他区分信息。写入前，服务端重新解析引用，并检查店铺与会话范围。

```ts
const lookup = (query: string) =>
  courseApi.searchStudents(query).then((students) =>
    students.map((student) => ({
      value: student.ref,
      label: student.name,
      description: student.maskedPhone,
    })),
  );
```

不要把引用做成可编辑文本框。没有结果时就明确说找不到，不要编造记录，也不要静默退回第一行。

## 让运行可观察

执行期间显示当前步骤及其原因。写入结束后回读，或使用已声明的期望验证。失败时保留已选输入和失败步骤，让人可以重试或改选择。

Agent 模式任务会发出 `pling-task-prompt`，确定性任务结束会发出 `pling-task-complete`。原生宿主可以把提示词交给 `pling.ask()`，并根据完成事件刷新自己的视图。

## 不接模型也能测

引导任务是确定性的，大部分检查不需要模型调用。测试空字段、重名查找、成功写入、服务端拒绝和取消。浏览器和单测使用同一份任务定义；控制器与框架无关。

页面或路由销毁时调用任务卡的 `destroy()`。它会取消活动任务、中止搜索并移除订阅，而业务页面继续管理自己的 DOM。

## 完成清单

- 页面先展示能完成的结果，再要求用户写提示词。
- 任务卡挂进助手对话，页面保留自己的操作控件。
- 搜索结果带标签，引用在服务端重新校验。
- 行级动作通过绑定拿到课程，不靠文本输入框。
- 步骤调用现有执行器或业务服务。
- 写入失败后仍可见、可恢复。
- 保存备注后，行内容与活动记录更新。
- 普通界面不显示动作 id 或原始参数。

## 下一步

无法描述为固定顺序的请求，可以增加 Agent 模式任务。日常流程继续使用确定性任务；视觉或人工步骤交还用户，不要强迫 Agent 模拟。

