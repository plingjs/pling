---
id: V2-09
title: "面向真实业务流程的引导任务"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 面向真实业务流程的引导任务

Vue 2.7 应用可以提供与 Vue 3 相同的引导任务。业务页面保留 options API 和员工已经熟悉的控件；共享任务控制器只收集页面无法推断的决定，实际写入仍交给现有服务校验和执行。

课程管理后台有四个从任务目录启动的任务，以及一个从课表行启动的任务。行级任务的关键区别在于：选中的课程是页面提供的事实，不是让用户填写的值。

## 先展示结果，而不是动作 id

任务首屏应列出当前角色稳定需要的结果。课程管理后台里，员工看到“新建课程”“查学员会员卡”“创建老师”“排一节课”。第五个结果“写课程备注”放在课程旁，因为它必须先有一节课。

任务标题、字段标签和示例都应使用工作台里的说法。动作 id 与参数 schema 留在调试视图，不进入普通界面。

## 从 Vue 2 挂载共享任务卡

DOM 任务卡独立于 Vue 渲染器。Vue 2 负责组件生命周期；控制器和任务卡在挂载后创建，并在 `beforeDestroy` 中释放。任务卡通过助手 Dock 的 `task` 选项挂进对话，不另占一块页面区域。

```vue
<script>
import { createTaskController } from "@plingjs/agent";
import { createTaskCard, registerTaskLookupActions } from "@plingjs/vanilla";
import { courseApi } from "./course-api";

export default {
  name: "CourseTasks",
  data() {
    return { card: null, dock: null, stopLookups: null };
  },
  mounted() {
    this.tasks = createTaskController({
      invoke: (action, args) => courseApi.invoke(action, args),
    });
    this.tasks.register({
      id: "student.cards",
      title: "查学员会员卡",
      fields: [{
        name: "studentRef",
        label: "学员",
        type: "lookup",
        searchAction: "search_students",
        lookup: (query) => courseApi.searchStudents(query),
      }],
      steps: [{ label: "读取会员卡", action: "get_student_cards" }],
    });
    this.stopLookups = registerTaskLookupActions(
      this.$pling,
      this.tasks.list(),
    );
    this.card = createTaskCard(this.tasks, {
      locale: "zh-CN",
      catalog: false,
    });
    this.dock = this.$pling.dock({
      layout: "sidebar",
      sidebarMode: "fused",
      defaultOpen: true,
      task: this.card.element,
    });
  },
  beforeDestroy() {
    this.stopLookups?.();
    this.card?.destroy();
    this.dock?.destroy();
  },
};
</script>
```

控制器不会把 Vue 实例变成响应式，也不会复制动作注册表。它发布快照，任务卡只订阅这一份运行状态。执行桥由宿主注入，并继续调用应用服务。

## 把课表行绑定到任务

备注任务声明 `requiresRecord: true`。定义里只有备注字段，步骤从页面提供的绑定中读取课程 id。

```ts
this.tasks.register({
  id: "lesson.note",
  title: "写课程备注",
  requiresRecord: true,
  fields: [{ name: "note", label: "备注", type: "textarea" }],
  steps: [{
    label: "保存课程备注",
    action: "update_lesson_note",
    args: (values, binding) => ({
      lessonId: binding.record?.id,
      note: values.note,
    }),
  }],
});

openNote(lesson) {
  this.dock.open();
  this.card.open("lesson.note", {}, {
    record: {
      id: lesson.id,
      label: `${lesson.course} · ${lesson.date} ${lesson.time}`,
    },
  });
}
```

没有非空记录 id 时，`start()` 会拒绝启动，而不是拿空课程 id 去执行。通用任务列表也会把这类任务显示成必须从记录行或详情页打开的入口，而不是可以直接运行的任务卡。表单只问备注，任务头部显示绑定的课程。

## 用查找代替原始 id

用户知道学员姓名或手机号，不知道 `studentId`。查找应返回带标签的选项；两名学员重名时，还要带上足以区分的脱敏信息。

```ts
const search = (query) =>
  courseApi.searchStudents(query).then((students) =>
    students.map((student) => ({
      value: student.ref,
      label: student.name,
      description: student.maskedPhone,
    })),
  );
```

选中的 `ref` 仍然不构成授权。服务端会在读取会员卡或写入课程前重新解析它，并检查当前店铺、会话与权限。缺失、过期或跨店铺的引用都必须明确失败。

`registerTaskLookupActions` 会把同一份查找暴露成助手使用的窄范围只读动作。它不会开放整表查询，也不会绕过写操作自己的审批路径。

## 业务执行留在 Vue 2 之外

任务桥可以调用现有函数动作或应用服务。不要在 Vue 2 组件里放第二套模型循环、第二套权限校验或直接 `fetch`。

写入后回读结果，或使用动作已有的期望验证。必填步骤失败时停止并保留错误；可选步骤失败时可标记跳过。服务端失败或取消的运行不能显示成成功。

## 在真实 Vue 2.7 构建中核对

打开 [Vue 2.7 课程管理后台](/demos/course-workspace-vue2/?lang=zh)，逐项检查：

课程创建演示采用更接近真实后台的方式：进入页面时打开原有的“创建新课程”表单，助手侧栏只显示四步引导。第一步展示推荐值摘要并写入原表单；第二步选择老师和可用卡；第三步停下来，让用户在页面里选择封面；第四步从页面重新读取并核对。聊天里不再复制一套课程字段。`examples/shared/course-workspace/course-guide.ts` 负责这段引导，`course-form.ts` 仍是业务输入的唯一来源。下一步动作使用 `@plingjs/dom` 的共享紧凑操作行，Vue 2.7、React 与原生 JS 挂载的是同一份 DOM。

但这四个阶段只是页面自己的呈现，不是任务层的脚本。`course.create` 同时声明 `objective`、`constraints` 和 `successCriteria`，并通过 `pling.task.define` 把同一个 controller 注册进任务目录。模型可以回答“你会做什么”，接收“课程名叫减脂瑜伽”这样的修正，或者在用户说“卡片你来选”时调用 `pling_update_task`，只写被委托的字段；页面订阅 `TaskRunSnapshot`，把变化同步回原表单并重新推导当前阶段。真正的保存仍走 `create_course`、执行器和回读。

- 助手对话里不要求写提示词，也能看到业务任务卡。
- 搜索重名学员时，两个候选与区分信息都出现。
- “写课程备注”从课表行打开，任务头部显示对应课程。
- 没有选择学员时，任务不能直接运行。
- 成功排课后，显示人话结果和已完成步骤。
- 服务端拒绝时，失败步骤与错误信息仍留在屏幕上。
- 保存备注后，行内容与活动记录更新，表单全程不问课程 id。
- 组件卸载时销毁任务卡，并中止尚未完成的查找。

用 Vue 2.7 运行页面，而不是 Vue 3 兼容模式。共享任务卡应使用与其他章节相同的快照、文案与失败行为。

## 完成清单

- 控制器在组件挂载后创建，并在组件销毁时释放。
- 任务目录包含四个稳定任务；行级备注任务通过绑定打开。
- 任务字段使用查找或带标签的选择，而不是原始 id。
- 步骤调用现有业务边界。
- 失败或取消不会显示成成功。
- 同一份任务定义离开 Vue 2 仍然有效。

## 下一步

当角色有多个稳定任务时，把定义移到应用自己的 task 模块，让 Vue 继续负责布局与业务状态。自由请求用带提示词模板的 Agent 模式任务，而不是硬造确定性路径。
