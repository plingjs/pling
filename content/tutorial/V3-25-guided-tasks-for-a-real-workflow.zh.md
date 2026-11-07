---
id: V3-25
title: "面向真实业务流程的引导任务"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 面向真实业务流程的引导任务

前面的 Todo 已经证明：页面把动作声明清楚，助手就能完成一次具体操作。真实后台的难点通常不在“能不能点击”，而在于一个业务任务要跨过多个字段、几处判断和一次人工决定。

以创建课程为例。员工知道要新建一门课，却未必记得先填什么、老师和可用卡如何关联、封面是否需要本人选择，也不一定知道保存后去哪里确认。把这些内容全部塞进聊天，会变成第二套表单；只留在原页面，用户又容易迷路。

这一章用“创建课程”这一件事来拆解引导任务。页面仍然只有原来的课程表单，助手在对话框里说明当前步骤、展示只读摘要、定位真实字段，并在保存后回读课程库确认结果。

## 先接住一整句话

创建课程本来需要填很多项，逐项追问会把人拖回表单问答。这个示例先让业务自己识别一句话，再把结果一次写回页面：

```text
孕妇瑜伽，陈老师，2 星，介绍自动填写
```

课程名、老师、难度和介绍会同时进入原表单。助手只需要补充真正缺少的内容，例如“可用卡还没定”；如果老师不在列表里，它会停下来问人，不会把相近的名字偷偷替换掉。缺少封面的情况更明确：助手把页面定位到封面上传区，然后把选择文件交还给人。

`AgentInline` 提供了可选的 `beforeSend`，但它只负责确定性快路径：明确说出的字段值、明确的保存、核对、取消命令，由页面当场处理并返回 `{ handled: true, reply }`。问句、帮助请求、模糊修正、委托选择（例如“卡片你来选”“你来帮我随便填”）和普通聊天一律返回 `undefined`，交给模型结合任务工作记忆判断。疑问句不会因为“当前正等着填课程名”就被当成字段值写进表单。

```ts
async function handleBeforeSend(text: string) {
  const result = parseCourseIntake(text, { /* 当前老师、卡片与页面草稿 */ });
  if (shouldUseAgent(result)) return undefined;

  applyIntakePatch(result.patch);
  return {
    handled: true,
    reply: composeCourseIntakeReply({ draft, result, /* ... */ }),
  };
}
```

模板里用 `:before-send="handleBeforeSend"` 绑定处理函数。它不是事件监听器；写成 `@before-send` 会注册一个不会执行函数的事件。

用户随后说“难度改成 4 星”或“把课程名字改成减脂瑜伽”，解析器只改当前草稿里的对应字段，不会重新问一遍全部信息。解析不出要改哪一项时，助手会直接请用户说清楚，而不是猜一个字段写进去。

## 两种进入方式，一套任务

用户可能从两个方向开始：

- 打开“创建课程”弹窗时，任务因为当前上下文自动出现；
- 对助手说“帮我创建一门瑜伽课”，助手从当前可用任务中选择并开启它。

这两条路最终都落到同一个任务定义、同一个引导定义和同一个执行器上。页面不需要为“自动出现”和“助手开启”各写一套界面。

先看页面注册任务的代码：

```ts
pling.task.define({
  definition: createCourseTaskDefinition(taskOptions),
  guide: guideDefinition,
  controller,
  scope: "create-course-form",
  autoStart: true,
  initialValues: currentTaskValues,
  state: () => ({
    snapshot: taskSnapshot.value,
    step: step.value,
    busy: busy.value,
    error: taskError.value,
    completed: completed.value,
  }),
  onActivate: applyTaskRunValues,
  onCommand,
});
```

`scope` 表示只有创建课程弹窗存在时任务才可用。`autoStart` 让它在上下文匹配时自动展示。关闭弹窗后作用域消失，引导随之隐藏；重新打开时再恢复。

如果希望助手能在用户提出请求时主动开启，也不需要再加一段逻辑。任务注册后，模型会看到当前可用的任务；它调用 `pling_start_task`，任务目录就会激活同一个 `course.create`，内置助手面板随即显示引导。

## 任务与引导为什么分开

`TaskDefinition` 回答“要完成什么、受什么约束、怎样算完成”：`objective` 是目标，`constraints` 是模型必须守住的边界，`successCriteria` 是可观察的完成条件，`fields` 只是当前已知的工作记忆。固定 `steps` 只在业务写入确实可以确定性执行时使用；它不是对话脚本。

```ts
export const courseTask = {
  id: "course.create",
  title: "创建课程",
  objective: "帮用户把一门可上架的课程创建到课程库，而不是逐项盘问字段。",
  constraints: [
    "封面必须由用户亲自上传，助手不能伪造。",
    "所有写入仍走 create_course 动作、执行器和回读校验。",
    "用户的问题、修改、暂停和放弃优先于继续收集字段。",
  ],
  successCriteria: [
    "新课程出现在课程库第一位",
    "名称、老师、可用卡和封面与用户确认的一致",
  ],
  fields: [
    { name: "name", label: "课程名称", type: "text", recommended: "瑜伽基础" },
    {
      name: "teacherId",
      label: "授课老师",
      type: "lookup",
      lookup: searchTeachers,
      searchAction: "search_teachers",
      recommended: "teacher_zhoumin",
    },
    { name: "cards", label: "课程可用卡片", type: "select", values: cardChoices },
    { name: "cover", label: "课程封面", type: "boolean", agentWritable: false },
  ],
  steps: [
    {
      id: "course.save",
      label: "写入课程库并回读",
      action: "create_course",
      args: (values) => ({
        name: values.name,
        teacherId: values.teacherId,
        cards: values.cards,
        cover: values.cover,
      }),
    },
  ],
};
```

它不依赖 Vue，也不知道聊天窗口长什么样。任务可以只有执行步骤，也可以带一份用户可见的引导。

`TaskGuideDefinition` 回答“用户看到什么”：步骤标题、说明、只读摘要、按钮文案，以及哪一步必须交还给人。

```ts
export const courseGuide = {
  taskId: "course.create",
  title: "创建课程",
  steps: [
    {
      id: "course.basics",
      label: "课程信息",
      title: "先确定课程内容",
      description: "下面三项会写进页面里的原表单。",
      rows: () => [
        { label: "课程名称", value: draft.name || recommended.name },
        { label: "难度", value: draft.difficulty || 3, format: "stars" },
      ],
      primary: { label: "填入推荐内容并继续", command: "apply-basics" },
      secondary: { label: "在页面中定位", command: "focus-basics" },
    },
    // 教学与约课、课程封面、核对并保存……
  ],
};
```

引导里没有 `input`、`textarea` 或 `select`。它只展示摘要和命令名。真正写值、打开弹窗、定位字段，仍由页面处理。

分开还有一个直接好处：同一个任务可以自动执行，也可以只作为对话里的操作手册。没有界面也能跑；没有执行步骤时，也可以只给助手一段 playbook。

## 助手只能选择，不能发明任务

任务目录是当前页面对“可以做什么”的声明。模型拿到的是一份可用任务清单，以及每个任务的目标、约束、字段和步骤摘要。任务激活后，模型还会看到当前字段值、仍缺失的必填项、当前引导步骤和可用的引导动作；这份状态是每轮重建的工作记忆，不是一段必须照做的脚本。它可以选择其中一个任务，也可以把用户已经说出的字段值一并传入：

```json
{
  "task": "course.create",
  "values": {
    "name": "瑜伽基础",
    "teacherId": "teacher_zhoumin"
  }
}
```

这里有三条边界：

- 任务 id 必须来自当前可用清单，编造 id 会返回 `INVALID_ARGS`；
- `values` 只能出现任务定义里声明过的字段，未知字段同样拒绝；
- 传入值只是填写任务草稿，不会绕过 `create_course` 的权限、确认和审计。

所以“助手主动创建任务”并不等于让模型自由生成一套流程。它创建的是**一次已注册任务的运行**。未来如果要做真正的动态任务组合，仍然应该先经过任务模板、校验和用户确认，再进入同一个任务目录，而不是让模型直接调用任意动作拼装工作流。

### 激活后，任务不是脚本

任务激活后，模型会收到一份结构化的当前状态，再决定这一轮该回答、追问、写值、暂停还是交还给人。它不会因为“下一个必填字段是课程名”就把整句话塞进课程名，也不会在用户问“你会做什么”时继续走下一步。

模型只通过一个窄动作更新工作记忆：

```json
{
  "task": "course.create",
  "values": { "cards": "月卡" },
  "clear": []
}
```

对应动作是 `pling_update_task`。它只写当前 active task、只接受声明过的字段，并拒绝 `agentWritable: false` 的页面专属字段。`TaskField.recommended` 只是在用户明确委托时给模型的推荐值，不是自动写入；`agentWritable: false` 的封面仍由用户在页面上传。工作记忆更新后，Vue 页面订阅 `TaskRunSnapshot`，把变化同步回原表单并高亮字段。真正的业务写入仍由 `create_course`、执行器、确认和回读完成。

## 不再手写第二套聊天界面

旧写法需要页面在聊天消息流里手动挂载 `AgentTaskGuide`，再自己维护标题、消息区和样式。这样很容易出现一个案例一种外观，业务页面也会被助手 UI 绑住。

现在页面只保留业务表单和任务注册，助手界面直接使用内置组件：

```vue
<aside class="assistant" aria-label="页灵助手">
  <AgentInline
    class="assistant-agent"
    :title="createCopy.assistantTitle"
    :placeholder="page.assistant.placeholder"
    task-placement="none"
    :debug="{ maxCalls: 8 }"
    model-settings="readonly"
  />
</aside>
```

`AgentInline` 订阅任务目录，但这里用 `task-placement="none"` 关掉了内置任务卡。不是任务层不重要，而是“创建课程”本身就是一张连续填写的表单：顶部再放一条字段轨道，会让聊天变成第二套操作路径。用户只需要一个叙事入口，下一步动作直接出现在对话末尾。

任务定义仍然负责字段、顺序、命令和结果判据，只是把展示权交还给业务。`task-placement` 有三个值：默认的 `inline` 把内置引导放进对话流，`pinned` 把它固定在聊天标题下方，`none` 则完全隐藏。需要常驻步骤条的产品可以选前两种；像这个案例一样，页面和聊天各自只做一件事时，`none` 更干净。

如果产品需要自己的任务展示，仍然可以用 `#task` 插槽覆盖默认引导。关键是不要一边保留内置字段轨道，一边又在聊天里重复同一套引导。

## 长推荐不该把按钮撑开

“自动填写”最初把推荐值直接拼进按钮文案。课程名称短的时候没有暴露问题；到了“约课须知”这种一句话的字段，按钮被撑成横跨整个面板的宽块，操作行换行，聊天内容被挤到下面，用户第一眼看到的是一个大按钮，而不是下一步该做什么。

最简单的修法是把文案截断，但截断解决不了这个交互问题：用户点按钮之前，必须知道点完会填进什么。把全文藏进图标或二级菜单也不行，那只是把“不确定”换成了“找不到”。

现在的规则是**短动作 + 单行预览**：

- 按钮只保留动作，例如“自动填写”“定位 · 课程名称”；
- 推荐值放在按钮内的灰色预览里，单行、最多约 `300px`、超出省略；
- 完整值仍在聊天气泡里，鼠标悬停有 `title`，读屏用户拿到的是完整的 `aria-label`；
- 推荐值只代表“点击后会写入”，在用户点击之前，页面表单没有任何变化。

```ts
const items: GuideActionItem[] = [
  {
    id: "use-note",
    label: "自动填写",
    preview: "请提前 10 分钟到店；开课前 2 小时内不可取消。",
    ariaLabel: "自动填写约课须知：请提前 10 分钟到店；开课前 2 小时内不可取消。",
    command: "apply-note",
    kind: "suggestion",
  },
];
```

这段渲染逻辑不属于某一个适配器。它放在 `@plingjs/dom`，Vue、React 和原生 JS 只是各自的生命周期外壳：

```vue
<AgentGuideActions :items="guideActions" @command="onGuideCommand" />
```

渲染器只发回业务自己声明的 `command`，它不认识课程、字段或表单，也不会替页面写入任何值。这样三端不会各写一份 CSS，长文案在三个适配器里的折行、省略和禁用态才是同一套行为。

几个容易忽略的边界：

- 写入过程中按钮进入 `disabled`，但标签保留“保存中……”而不是整行消失，用户知道操作还在进行；
- 可选字段给一个“跳过”，避免用户为了前进而编一个值；
- 窄屏下 `max-width: 100%`，预览先省略，动作永远不换行；
- 英文推荐通常更长，预览仍然只能占一行，不能靠 `word-break` 把按钮拉高；
- 这条规则只约束“操作行”。聊天正文该展示的完整推荐仍然完整展示，两者不是同一层信息。

## 把值写回原表单

第一版的引导会把推荐内容直接当成页面值展示，用户看不出“这是建议”还是“页面已经填了”。现在两者分开。下面这些行状态描述的是内置引导的契约；这个案例虽然隐藏了任务卡，推荐值与命令仍然按同一套规则工作：

- 页面表单仍然是唯一输入源；
- 推荐值只带 `suggested` 状态，标注“尚未写入页面”；
- 用户点“采用”后，值才写进原控件，状态变成 `current`；
- 用户直接在页面里改，下一次引导读到的是页面新值。

任务行用 `status`、`badge`、`note` 和 `action` 表达这件事：

```ts
const row: TaskGuideRow = filled
  ? {
      label: "课程名称",
      value: draft.name,
      status: "current",
      badge: "已填入",
      action: { label: "定位", command: "focus-name" },
    }
  : {
      label: "课程名称",
      value: recommended.name,
      status: "suggested",
      badge: "建议",
      note: "来自示例课程模板，尚未写入页面",
      action: { label: "采用", command: "apply-name" },
    };
```

`action.command` 不进入第二套执行通道。它和步骤按钮一样，最终都交给页面的 `onCommand`。

建议不符合实际时，用户不需要先“拒绝”：直接在页面里改就行。引导读到的是页面新值，后续“采用”也不会覆盖用户已经输入的内容。

按钮不会打开新的输入框。它把值写进页面上已经存在的课程名称、难度和课程介绍控件，然后滚动到对应字段，并在表单上打出蓝色标记。用户看到的是“填这里”，不是聊天里的一句“已定位”。

```ts
async function onCommand(command: TaskGuideCommand) {
  switch (command.action.command) {
    case "apply-basics":
      applyBasics();
      await focusFields(["name", "difficulty", "intro"]);
      break;
    case "focus-teaching":
      await focusFields(["teacher", "cards", "note"]);
      break;
    case "save-course":
      await saveCourse();
      break;
    case "cancel-task":
      pling.task.deactivate();
      break;
    default:
      if (command.action.command.startsWith("apply-")) {
        applyField(command.action.command.slice("apply-".length));
      } else if (command.action.command.startsWith("focus-")) {
        await focusFields([command.action.command.slice("focus-".length)]);
      }
  }
}
```

步骤也不该由按钮手动 `step.value++`。页面已经有这些字段，直接按表单状态推导：

```ts
const step = computed(() => {
  if (!draft.name.trim()) return 1;
  if (!draft.teacherId || !draft.cards.trim()) return 2;
  if (!draft.cover) return 3;
  return 4;
});
```

这样用户在页面里改值、助手通过 `pling_start_task` 带入值，或者用户点“采用”，都会走到同一个步骤判断。不要按输入框数量拆步骤：十个框不等于十个步骤。按业务决策分组，一般三到五组就够；字段级的差异交给任务行表达。

当助手带着字段值开启任务时，页面也需要把这些值同步回原表单。这个案例在 `onActivate` 里做一次：

```ts
function applyTaskRunValues(task: ActiveGuidedTask): void {
  const values = task.state.snapshot?.values;
  if (!values) return;
  if (values.name !== undefined) draft.name = String(values.name ?? "");
  if (values.teacherId !== undefined) {
    draft.teacherId = String(values.teacherId ?? "");
    draft.teacherName = teachers.find((teacher) => teacher.id === draft.teacherId)?.name ?? "";
  }
  // 其余字段同理
}
```

页面始终是事实来源。用户在表单里手动改了值，下一步重新读取的就是页面当前值，而不是任务定义里的初始示例。

## 取消，以及在页面之间活下来

如果使用内置任务卡，右上角有“取消任务”。它只发出一个普通命令：

```ts
const guide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "创建课程",
  cancel: { label: "取消任务", command: "cancel-task" },
  steps: courseSteps,
};
```

页面收到 `cancel-task` 后调用 `pling.task.deactivate()`。引导消失，控制器里的运行被取消，不会留下一个“看起来还在，其实已经结束”的面板。这个案例把入口放在助手的任务菜单里，底层仍是同一条命令。

如果任务会关闭弹窗、跳到详情页，或者中间短暂离开原作用域，登记时加 `keepActive`：

```ts
pling.task.define({
  definition: courseDefinition,
  guide: courseGuide,
  controller,
  scope: "create-course-form",
  autoStart: true,
  keepActive: true,
  // ...
});
```

`keepActive` 只对“人或助手明确开启”的任务生效，不会让一个自动出现的任务无限粘住页面。它解决的是上下文暂时不匹配时任务被误关；跨页面的阶段切换、未保存保护和分支编排仍然要由业务流程自己定义，不能指望一个布尔值包办。

## 人工接力要明确停下来

上传封面要读取本地文件，不适合由助手代选。第三步因此不显示“继续”，而是展示一条人工接力说明，并把用户带到原页面的封面上传区域。

用户选完图片后，任务才进入核对步骤。这个停顿不是失败，而是任务计划的一部分。没有它，流程看上去更快，但用户会在最后一步才发现自己漏了一项必须亲自完成的操作。

核对步骤从页面重新读取名称、老师、卡片、封面、扣卡次数和金额。只有这些值都有效，保存按钮才真正执行 `create_course`。

## 保存后从页面确认

动作返回成功不等于业务完成。这个案例在写入后检查课程库：新记录必须出现在第一位，且名称、老师和可用卡与核对值一致。

```ts
const result = await controller.run();
if (result.status === "done" && courses.value[0]?.id === newCourseId.value) {
  modalOpen.value = false;
  step.value = 4;
  return;
}
```

完成卡展示的是这次回读的结果，不是预先写好的“成功”文案。

## 在浏览器里核对

打开 [Vue 3 创建课程案例](/demos/course-workspace-vue3/?lang=zh)，依次检查：

- 首屏只出现课程库和创建课程表单，不混入老师排课等其他模块。
- 聊天卡里没有输入框、下拉框或文本域。
- 打开创建课程弹窗后任务处于激活状态；聊天里不出现独立任务卡或字段轨道。
- 输入“孕妇瑜伽，陈老师，2 星，介绍自动填写”，四项值一次出现在原表单，只追问还缺的可用卡。
- 接着说“难度改成 4 星”，只更新难度，不重新询问课程名和老师。
- 输入一个不存在的老师，助手应列出可选老师并在表单里标记授课老师，不静默替换。
- 输入“帮我改一下”这类没有指向的修正，助手应先问清楚要改哪一项。
- 输入“瑜伽进阶2星 老师随意，月卡”，老师取推荐值，课程名保持“瑜伽进阶”，不出现“进阶老师”这种误判。
- 没有选择封面就保存时，任务停在封面并给出明确提示。
- 完成封面后保存，新课程出现在课程列表第一位。
- 聊天和页面操作过程中没有控制台错误。

## 接入另一个页面

不需要复制这套界面。按下面顺序做：

1. 用 `TaskDefinition` 定义字段、动作和回读条件。
2. 用 `TaskGuideDefinition` 写面向用户的步骤、摘要和命令名。
3. 在页面里调用 `pling.task.define()`，声明 `route`、`scope` 和 `autoStart`。
4. 实现命令处理函数：写入已有控件、定位、打开弹窗或调用任务控制器。
5. 写入后重新读取业务数据，用页面结果决定是否显示完成。

当任务需要由用户主动选择，或者只能在某个详情页、某一行记录上启动时，把 `route`、`scope` 或 `requiresRecord` 写清楚。不要用页面上的临时状态去猜——任务目录会根据这些声明判断当前是否可用。

React、Vue 2 和原生 JS 版本沿用同一套任务定义和展示定义，只替换适配器的挂载方式。这个案例先完成 Vue 3，确认交互方向后再逐端补齐。
