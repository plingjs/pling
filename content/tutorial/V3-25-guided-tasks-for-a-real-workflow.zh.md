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

## 让模型接住一整句话

创建课程本来需要填很多项，逐项追问会把人拖回表单问答。这个示例没有在页面里写意图分类器；助手直接读当前任务上下文，再把一句话里的字段写进工作记忆：

```text
孕妇瑜伽，陈老师，2 星，介绍自动填写
```

模型看到的是当前 active task 的目标、约束、字段、已填值、缺口与当前阶段。它把这句话理解为 `name`、`teacherId`、`difficulty` 和 `intro` 四个值，调用一次 `pling_update_task`；页面按字段声明逐项校验，再把变化同步回原表单。助手只追问真正缺少的内容，例如“可用卡还没定”；如果老师不在列表里，它会停下来问人，不会把相近的名字偷偷替换掉。缺少封面时，助手把页面定位到上传区，然后把选择文件交还给人。

字段校验属于页面，不属于对话。`TaskField` 可以声明数值的 `min` / `max`、文本的 `minLength` / `maxLength`、`pattern`，可以给小型封闭集合一个 `values` 列表，也可以写一个使用当前工作记忆的 `validate(value, values)`。这些检查在写入任务快照之前执行：类型不对、老师不存在、难度越界或扣次格式错误都会返回失败，不会出现“写了一半”的页面状态。模型可以重试、换一种问法或请用户确认，但它无法绕过这条边界。

```ts
const courseTask = {
  id: "course.create",
  fields: [
    { name: "name", label: "课程名称", type: "text", minLength: 1, maxLength: 40 },
    {
      name: "teacherId",
      label: "授课老师",
      type: "lookup",
      lookup: teacherLookup,
      validate: (value) =>
        teachers.some((teacher) => teacher.id === value) ? null : "请从 search_teachers 的结果中选择老师。",
    },
    { name: "difficulty", label: "难度", type: "number", optional: true, min: 1, max: 5 },
  ],
};
```

模型不会因为“这一轮还没回答”就把用户的问题当成字段值。用户问“这个字段是什么意思”、说“先帮我看看”，或者临时改主意，都留在同一段对话里；任务状态只是工作记忆，不是必须照做的脚本。后续“难度改成 4 星”或“把课程名字改成减脂瑜伽”同样由模型理解为当前任务的修正，只更新对应字段。只有它确实无法判断指哪一项时，才会向用户确认。

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
    step: 1,
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

`TaskGuideDefinition` 回答“用户看到什么”：任务标题、欢迎语、当前字段表，以及模型可以调用的界面命令。

```ts
export const courseGuide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "创建课程",
  welcome: "把课程信息一次说给我，也可以直接在页面填写，我来补缺。",
  agent: {
    review: "review-task",
    proposeSave: "propose-save",
    cancel: "cancel-task",
  },
  fields: () => courseCreateFieldNodes(locale, draft(), teachers, skipped),
  steps: [
    {
      id: "course.fill",
      label: "创建课程",
      title: "创建课程",
      description: "把课程信息写进原表单，再由人确认保存。",
    },
  ],
};
```

`steps` 只描述业务阶段，供标题和进度文案使用，不决定下一步问什么。这个案例只有一个阶段；真正的“还差哪一项”来自 `fields()` 对页面当前值的推导。引导里没有 `input`、`textarea` 或 `select`，真正写值、打开弹窗、定位字段，仍由页面处理。

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

### 页面保留最后一下

模型能感知、解释、追问和修正，但页面仍然掌握三个不可让渡的动作：定位、核对与保存。

- `pling_focus_field` 只把某个已声明字段滚进视野并高亮，不写值；
- `pling_review_task` 打开页面自己的只读核对；
- `pling_propose_save` 只打开确认，不执行业务写入；
- `pling_cancel_task` 结束引导，已经写进页面的值不会自动回滚。

这些工具不是框架的隐藏默认值。引导必须在 `guide.agent` 里显式声明 `review` / `proposeSave` / `cancel` 命令，模型才会看到对应工具；没有声明就不出现，也不会产生“点了没反应”的空动作。这样业务可以决定自己的保存路径：有的先弹确认，有的要求二次校验，有的根本不允许在任务里保存。

```ts
guide: {
  taskId: "course.create",
  agent: {
    review: "review-task",
    proposeSave: "propose-save",
    cancel: "cancel-task",
  },
}
```

`proposeSave` 对应的页面命令由页面自己处理，例如打开原有确认弹窗、重新读取表单、执行 `create_course` 和回读。模型只能说“我准备保存了，请在页面确认”，不能在用户没有确认时宣称已经完成。

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
    guide-placement="end"
    :debug="{ maxCalls: 8 }"
    model-settings="readonly"
  >
    <template #guide>
      <AgentGuideActions :items="guideActions" @command="onGuideCommand" />
    </template>
  </AgentInline>
</aside>
```

`AgentInline` 订阅任务目录，但这里用 `task-placement="none"` 关掉了内置任务卡，并用 `guide-placement="end"` 把 `#guide` 插槽放到最新消息之后。不是任务层不重要，而是“创建课程”本身就是一张连续填写的表单：顶部再放一条字段轨道，会让聊天变成第二套操作路径。用户只需要一个叙事入口，下一步动作直接出现在对话末尾；`AgentGuideActions` 只发出页面已声明的命令，不写字段，也不调用业务动作。

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

字段表由页面当前值推导，不需要 `status` / `badge` 行模板，也不需要步骤计数器：

```ts
const guideField = computed(() => {
  const gaps = courseCreateFieldNodes(locale, draft, teachers, skipped.value);
  return gaps.find((field) => field.required && !field.filled && !field.skipped)
    ?? gaps.find((field) => !field.filled && !field.skipped);
});
```

`guideActions` 只根据这个缺口生成短动作：定位当前字段、使用推荐值、跳过可选项；必填项齐了才出现“核对”。十个输入框不等于十个步骤，字段级差异由字段表表达。

建议不符合实际时，用户不需要先“拒绝”：直接在页面里改就行。引导读到的是页面新值，后续“采用”也不会覆盖用户已经输入的内容。

按钮不会打开新的输入框。它把值写进页面上已经存在的控件，然后滚动到对应字段，并在表单上打出蓝色标记。用户看到的是“填这里”，不是聊天里的一句“已定位”。

页面只处理显式命令，不解析自然语言：

```ts
function onGuideCommand(command: string): void {
  if (command === "save-course") void saveCourse();
  else if (command === "resume-editing") resumeEditing();
  else if (command === "pick-cover") void pickCover();
  else if (command === "locate-field") locateField(guideField.value);
  else if (command === "use-suggestion") useSuggestion(guideField.value);
  else if (command === "skip-field") skipField(guideField.value);
  else if (command === "start-review") startReview();
  else if (command === "focus-save") focusSave();
}
```

判断“用户想创建课程还是想先问功能”属于模型的工作；页面只负责执行“定位课程名称”“采用这个推荐”这类明确命令。这样用户中途问问题、改主意或暂停，都不会被页面误当成下一步。

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

任务菜单和模型都可以发出“取消任务”。它只是一个普通命令：

```ts
const guide: TaskGuideDefinition = {
  taskId: "course.create",
  title: "创建课程",
  cancel: { label: "取消任务", command: "cancel-task" },
  agent: { cancel: "cancel-task" },
  // ...
};
```

页面收到 `cancel-task` 后调用 `pling.task.deactivate()`。引导消失，控制器里的运行被取消，不会留下一个“看起来还在，其实已经结束”的面板。取消不会回滚已经写入表单的值，因为页面才是用户正在编辑的事实来源。

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

上传封面要读取本地文件，不适合由助手代选。封面是必填项，引导不会伪造一个布尔值，而是把用户带到原页面的上传区域；操作行此时只保留“上传封面”，不提供“继续”。

用户选完图片后，页面从文件输入和原表单重新读取全部字段，才出现“核对”。这个停顿不是失败，而是任务边界的一部分。没有它，流程看上去更快，但用户会在最后一步才发现自己漏了一项必须亲自完成的操作。

核对读取名称、老师、卡片、封面、扣卡次数和金额。只有这些值都有效，操作行才会出现“确认保存”；点击后才执行 `create_course`。

## 保存后从页面确认

动作返回成功不等于业务完成。这个案例在写入后检查课程库：新记录必须出现在第一位，且名称、老师和可用卡与核对值一致。

```ts
const result = await controller.run();
if (result.status === "done" && courses.value[0]?.id === newCourseId.value) {
  modalOpen.value = false;
  reviewOpen.value = false;
  return true;
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
- 完成封面后保存，新课程出现在课程列表第一位；扣卡次数显示为 `1`，不是 `1.0`。
- 再点“再做一次”创建第二门课，第一门课仍在课程库中；消息变多后聊天记录仍可上下滚动。
- 聊天和页面操作过程中没有控制台错误。

## 接入另一个页面

不需要复制这套界面。按下面顺序做：

1. 用 `TaskDefinition` 定义字段、动作和回读条件。
2. 用 `TaskGuideDefinition` 写面向用户的步骤、摘要和命令名。
3. 在页面里调用 `pling.task.define()`，声明 `route`、`scope` 和 `autoStart`。
4. 实现命令处理函数：写入已有控件、定位、打开弹窗或调用任务控制器。
5. 写入后重新读取业务数据，用页面结果决定是否显示完成。

当任务需要由用户主动选择，或者只能在某个详情页、某一行记录上启动时，把 `route`、`scope` 或 `requiresRecord` 写清楚。不要用页面上的临时状态去猜——任务目录会根据这些声明判断当前是否可用。

React 19、React 16.3、Vue 2.7 和原生 JS 版本沿用同一套任务定义、字段推导和操作行，只替换适配器的挂载方式。五个版本都已经提供同样的创建课程流程、人工确认和回读验证。
