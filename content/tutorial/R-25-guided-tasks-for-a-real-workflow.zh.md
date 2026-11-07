---
id: R-25
title: "面向真实业务流程的引导任务"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 面向真实业务流程的引导任务

React 应用经常有一个信息丰富的表格，但助手入口仍然是一个空白输入框。引导任务反过来：页面先提供当前角色能完成的结果，再只收集必须由人决定的内容。

这一章沿用 Vue 线里的课程管理后台。React 负责渲染与状态；共享任务控制器负责字段和步骤；现有动作或业务服务执行每一步。

## 把任务卡放进对话

任务目录属于助手对话，不是第二块工具面板。展示少量稳定结果，不要把每个 API 都变成入口。课程管理后台里，“新建课程”“查学员会员卡”“创建老师”“排一节课”，以及从课表行进入的“写课程备注”，已经覆盖多数日常工作。无法归类的请求再交给输入框。

任务卡应该用普通语言说明结果与示例，不展示动作 id 或参数 schema；那些属于实现细节。

## 在 render 之外创建控制器

控制器可以随当前工作区存在。执行桥调用已经负责引用、店铺范围和权限校验的业务服务。

```tsx
import { useRef } from "react";
import { AgentDock, AgentTaskCard, usePling } from "@plingjs/react";
import type { AgentDockHandle, AgentTaskCardHandle } from "@plingjs/react";
import { createTaskController, type TaskController } from "@plingjs/agent";

export function CourseWorkspace() {
  const pling = usePling();
  const dock = useRef<AgentDockHandle>(null);
  const card = useRef<AgentTaskCardHandle>(null);
  const tasks: TaskController = createTaskController({
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

  return (
    <AgentDock
      ref={dock}
      layout="sidebar"
      sidebarMode="fused"
      defaultOpen
      task={<AgentTaskCard ref={card} controller={tasks} onPrompt={pling.ask} />}
    />
  );
}
```

`AgentTaskCard` 只负责挂载生命周期；字段、查找、确认与运行状态机仍在共享任务控制器里。因此 legacy 入口也能渲染同一张 DOM 任务卡，不需要假装 Hooks 存在。Dock 使用融合侧栏，页面与对话可以同时可见。

打开 [React 19 课程管理后台](/demos/course-workspace-react/?lang=zh)可以看到新建课程、任务定义、重名查找与冲突失败如何跑在同一份业务服务上。React 页面替换的只是后台的渲染方式。若项目仍停留在 React 16.3，可对照 [React 16.3 版本](/demos/course-workspace-react16/?lang=zh)，它使用 legacy 入口完成同样的五个任务。

课程创建演示采用更接近真实后台的方式：进入页面时打开原有的“创建新课程”表单，助手侧栏只显示四步引导。第一步展示推荐值摘要并写入原表单；第二步选择老师和可用卡；第三步停下来，让用户在页面里选择封面；第四步从页面重新读取并核对。聊天里不再复制一套课程字段。`examples/shared/course-workspace/course-guide.ts` 负责这段引导，`course-form.ts` 仍是业务输入的唯一来源。下一步动作使用 `@plingjs/dom` 的共享紧凑操作行：按钮只保留短动作，长推荐作为单行预览，完整值留在聊天、`title` 与 `aria-label`，避免推荐文案把按钮撑宽。

但这四个阶段只是页面自己的呈现，不是任务层的脚本。`course.create` 同时声明 `objective`、`constraints` 和 `successCriteria`，并通过 `pling.task.define` 把同一个 controller 注册进任务目录。模型可以回答“你会做什么”，接收“课程名叫减脂瑜伽”这样的修正，或者在用户说“卡片你来选”时调用 `pling_update_task`，只写被委托的字段；页面订阅 `TaskRunSnapshot`，把变化同步回原表单并重新推导当前阶段。真正的保存仍走 `create_course`、执行器和回读。

备注任务从课表行打开，不放进四张任务卡。React 先展开 Dock，再把选中的课程作为绑定传给任务卡，所以表单不问 id：

```ts
dock.current?.open();
card.current?.open("lesson.note", {}, {
  record: { id: lesson.id, label: `${lesson.course} · ${lesson.date} ${lesson.time}` },
});
```

定义里设置 `requiresRecord: true`，唯一字段是备注文本。没有绑定记录时，控制器会拒绝启动，而不是拿空 id 去执行。

## 用带标签的选择解析人与记录

查找结果应包含稳定引用和人能读的标签。重名时，说明必须能区分两者。手机号尾号、会员编号或最近课程，比数据库主键有用。选中的值本身不构成授权。

```ts
const choices = students.map((student) => ({
  value: student.ref,
  label: student.name,
  description: `${student.maskedPhone} · ${student.recentCourse}`,
}));
```

服务端重新解析提交的引用，并检查它是否属于当前店铺。过期引用、跨租户引用或不存在的记录必须产生可见失败。

lookup 字段也可以暴露成只读动作。`registerTaskLookupActions(controller.list())` 让助手按姓名搜索，并拿到与界面相同的带标签候选。后续写操作仍要通过现有作用域和审批检查。

## 让执行继续走原路径

任务控制器不调用 `fetch`、不点击 DOM，也不替写操作审批。它通过 `invoke` 提交动作名和参数。执行桥可以调用注册表执行器、API-backed 函数动作或 Surface 网关。

只读查询可以用紧凑的 API。写入应走已经负责校验、幂等、通知和审计的业务服务。写入后，通过现有期望或回读步骤验证结果。

## 在 React 中检查一次运行

工作区卸载时，`AgentTaskCard` 会销毁 DOM 任务卡，取消订阅和进行中的查找。任务控制器仍限定在当前工作区；新页面可以注册新的任务集合，不必继承上一次运行。

测试重名、空必填字段、时间不可用、写入失败和取消。界面不能把失败或取消的运行显示成成功。

## 完成清单

- 用户不写提示词也能开始工作。
- 组件没有复制执行或权限逻辑。
- 查找结果能区分重名。
- 行级备注任务显示绑定的课程，只询问备注内容。
- 任务卡随工作区卸载而销毁。
- 写入后经过验证。
- 保存备注后，行内容与活动记录更新。
- 同一份任务定义可以由其他适配器渲染。

## 下一步

只有当每个任务都有不同且稳定的结果时，才从一个任务扩展成一组。自由请求可以使用带提示词模板的 Agent 模式任务；需要人工操作时，暂停并交还控制权，不要模拟用户。

