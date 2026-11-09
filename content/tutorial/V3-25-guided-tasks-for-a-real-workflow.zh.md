---
id: V3-25
title: "面向真实业务流程的引导任务"
locale: zh
source_locale: en
translation_status: draft
status: drafted
---

# 面向真实业务流程的引导任务

前面的章节用 Todo 说明了一件事：页面把动作声明清楚，助手就能完成一次具体操作。真实后台更难。一个业务任务要跨越弹窗、多个字段和一次人工上传，用户还会中途提问、改主意，甚至把弹窗关掉。

## 出发点：不要复制一行业务表单

这一章只做“创建课程”一件事。页面是原本的课程管理后台：课程库在左侧，右上角有“新建课程”按钮，点开后是原表单。我们没有另做一套聊天专用表单，也没有让页面代码替助手打开弹窗、填写字段或保存。

同一张页面提供了两个可运行版本：

- [案例07：只用指令创建课程](/zh/examples/course-create-directives-vue3) 只用 `v-scope`、`v-record`、`v-tool`。
- [案例06：持久目标创建课程](/zh/examples/course-workspace-vue3) 在同一张页面上多注册一个目标。

两个版本都能完成创建课程。区别不在功能多少，而在页面能不能自己说清楚，以及结果需不需要跨过页面变化继续存在。

## 先看两条接入路径

| 你的页面 | 建议路径 |
| --- | --- |
| 一张稳定表单，保存后结束 | 只用指令，不引入任务层 |
| 弹窗会关，用户会离开再回来 | 指令加一个目标 |
| 任务要跨路由或跨页面继续 | 指令加一个目标 |
| 需要固定任务入口、取消和完成记录 | 指令加一个目标 |
| 外部 Agent 需要同一份任务说明和完成边界 | 指令加一个目标 |
| 字段要校验、查找、按固定顺序调用多个动作 | 进阶 `TaskDefinition` 和 `TaskController` |

这张表是本章的主线。大多数页面停在第一行就够了。只有出现后面几行的需求，才值得增加目标层。

## 只用指令时，页面已经能说清什么

案例07 没有任何任务声明。页面通过三类指令把自己交给助手：

```vue
<button
  type="button"
  v-tool="{
    id: 'new_course',
    kind: 'read',
    label: page.newCourse,
    desc: copy.newCourseDesc
  }"
  @click="openCreate"
>
  {{ page.newCourse }}
</button>
```

`new_course` 绑定在真实按钮上。页面加载时弹窗是关闭的。助手要新建课程，就调用这条动作，按钮自己的 `@click` 打开弹窗。页面没有 `if (agent) openCreate()` 这样的分支。

弹窗内部用 `v-scope` 划出区域：

```vue
<section
  class="course-modal"
  v-scope="{
    id: 'create-course-form',
    label: page.form.title,
    description: copy.formScope,
    role: 'dialog'
  }"
  v-record="draftRecord"
>
```

`v-scope` 只给这组控件一个稳定的区域 id。它不暴露数据，也不提供执行能力。弹窗关闭后，这个区域和区域里的动作一起从页面消失。

`v-record` 把当前草稿公开成只读记录：

```ts
const draftRecord = computed(() => ({
  data: { ...draft },
  id: "course-draft",
  label: copy.value.draftLabel,
  fields: {
    name: draft.name,
    difficulty: draft.difficulty,
    teacher: teacherName.value || draft.teacherId,
    cards: draft.cards,
    intro: draft.intro,
    cover: draft.cover,
    required: [page.value.form.name, page.value.form.teacher, page.value.form.cards, page.value.form.cover],
    missing: requiredMissing.value,
  },
}));
```

助手因此能回答“还差什么”，不需要再声明一个读取工具。记录里的 `missing` 由页面计算，和页面自己的保存校验使用同一份规则。

每个真实控件再声明一条动作：

```vue
<input
  v-model="draft.name"
  v-tool="{
    id: 'course_name',
    action: 'fill',
    label: page.form.name,
    desc: copy.fieldDesc.name
  }"
/>
```

`action: 'fill'` 表示这条动作接收一个文本值。下拉框用 `action: 'select'`。难度不是原生输入框，而是一排自绘的星星按钮，所以每一颗星各自声明一条点击动作：

```vue
<button
  v-for="score in 5"
  :key="score"
  type="button"
  v-tool="{
    id: `course_difficulty_${score}`,
    kind: 'write',
    label: `${page.form.difficulty} ${score}`,
    desc: copy.difficultyDesc(score)
  }"
  @click="setDifficulty(score)"
>
  ★
</button>
```

这就是自定义组件的处理方式。控件是不是 `input` 不重要，重要的是它有没有一个真实、可点击或可输入的入口。星星按钮走点击动作，上传按钮走人工接力，保存按钮走页面自己的保存函数。

上传必须由人完成：

```vue
<button
  class="upload-tile"
  v-tool="{
    id: 'course_cover',
    kind: 'write',
    label: page.form.cover,
    desc: copy.coverDesc,
    handoff: {
      reason: copy.coverHandoff,
      expect: { desc: copy.coverExpect, check: () => draft.cover }
    }
  }"
  @click="coverInput?.click()"
>
```

`handoff` 让执行器停下来等人。助手可以调用 `pling_locate` 把上传区滚进视野并高亮，但不能替用户选择本地文件。人完成后，页面用 `draft.cover` 给出完成证据。

保存动作带一条回读条件：

```ts
const saveTool = computed(() => ({
  id: "save_course",
  kind: "write",
  label: page.value.form.save,
  desc: copy.value.saveDesc,
  run: () => saveCourse(),
  expect: {
    desc: copy.value.saveExpect,
    check: () => courses.value[0]?.id === newCourseId.value,
  },
}));
```

`expect` 由执行流水线在动作返回后检查。新课程没有出现在课程库第一位，保存就按失败处理。助手得到的不是“接口返回 200”，而是页面上的真实结果。

### 一句话如何变成几次动作

用户说：

```text
孕妇瑜伽，陈静，2 星，月卡，介绍自动填写
```

页面里没有正则表达式，也没有意图分类器。助手拿到的是：

- 当前可用的动作和它们的说明；
- 课程草稿的当前值、必填项和缺口；
- 每个控件的标签、输入类型和可选值；
- 哪些动作是人工接力。

它先打开真实弹窗，再按用户给出的信息调用 `course_name`、`course_teacher`、`course_difficulty_2`、`course_cards` 和 `course_intro`。遇到“介绍自动填写”这种明确委托，动作说明允许它根据课程名称、难度和老师生成一段介绍。没有给出封面时，它不会假装上传成功，而是请用户选择文件。

用户如果问“还差什么”，助手读 `draftRecord` 就能回答。用户如果说“老师换成林老师”，它只改老师，不会从头再问一遍课程名。对话由模型根据当前页面状态决定，不是固定字段脚本。

### 业务动作 id 不是框架 API

`course_name`、`course_intro`、`course_cover` 这些名字由这个示例自己决定。Pling 提供的是声明机制，不是一套课程字段表。换到订单后台，同一套写法会声明 `order_note`、`refund_reason` 或 `approve_order`。

动作 id 起什么名字，模型看到的就是什么名字。名字要稳定、具体，说明要讲清楚这个控件做什么、什么时候可用、完成后页面会变成什么样。

## 什么时候还需要一个目标

案例07 有一个边界：弹窗一关，`create-course-form` 区域和里面的字段动作都不存在了。用户如果这时问“刚才那门课还差什么”，助手只能看到课程库，看不到草稿。

这时可以加一个目标。案例06 的全部任务接入只有三行：

```ts
const pling = usePling();
const disposeGoal = pling.task.goal(courseGoal(props.locale));
onBeforeUnmount(disposeGoal);
```

`courseGoal()` 只描述结果和边界：

```ts
export function courseGoal(locale: Locale): TaskGoalInput {
  return {
    id: "course.create",
    title: locale === "zh" ? "创建课程" : "Create a course",
    goal: "在课程管理里新建一门课程：自己打开真实表单，按用户给出的信息填写，封面请用户上传，保存后回读课程库确认新课程在第一位。",
    constraints: [
      "页面上的动作是唯一操作入口；不要另造字段名、选择器或表单。",
      "只填写用户明确给出或明确委托的内容；不确定就问。",
      "封面必须由用户亲自上传，你不能替用户选择本地文件。",
      "用户的问题、修改、暂停和放弃优先于继续填表。",
    ],
    successCriteria: [
      "新课程出现在课程库第一位",
      "名称、老师、可用卡和封面与用户确认的一致",
      "保存动作已回读课程库并确认了这条新记录",
    ],
    examples: ["创建孕妇瑜伽，陈静，2 星，月卡，介绍自动填写"],
  };
}
```

这里没有 `fields`，没有 `steps`，没有 `controller`，没有表单回调，也没有保存函数。目标只回答四个问题：

- 这件事要达成什么；
- 哪些边界不能越过；
- 怎样才算完成；
- 弹窗关闭或路由变化后，为什么它还在。

`goal()` 默认 `keepActive: true`。目标由人或模型显式启动后，弹窗关闭、区域消失或短暂离开原路由，目标仍然 active。助手可以继续对话，重新打开表单，或者请用户先上传封面。

`route` 和 `scope` 可以限制目标从哪里启动。比如只在课程管理页显示，或只在某个区域出现时可用。它们决定“此刻能不能开始”，不决定“能不能操作页面”。真正的操作仍然逐条经过页面动作。

### 目标不是权限，也不是执行器

这一点要单独说清楚：

- 目标不会打开弹窗。`new_course` 才是打开弹窗的动作。
- 目标不会填写字段。`course_name`、`course_teacher` 才是填写动作。
- 目标不会保存。`save_course` 才是保存动作。
- 目标不会放宽权限。每条动作仍然执行自己的风险等级、确认、作用域和审计规则。

目标只做生命周期管理。它让一件事在页面变化后仍然存在，并在完成或取消时留下一个明确状态。

### 目标如何结束

模型启动目标后，会多看到一条 `pling_complete_task`。它只在页面已经满足全部成功条件时调用。调用它不会写业务数据，也不会代替 `save_course`，只把目标标成完成。

保存动作的 `expect` 先通过，目标才应该完成。顺序是：

1. 助手调用 `save_course`；
2. 页面自己的保存函数写入课程库；
3. `expect` 回读课程库，确认新课程在第一位；
4. 助手看到回读成功，调用 `pling_complete_task`；
5. 目标卡显示已完成。

用户也可以取消。取消只结束目标，不回滚已经写进表单的值。页面是用户正在编辑的地方，框架不替用户撤销输入。

## 从一句话到一门课程

下面按真实操作顺序走一遍案例06。

### 1. 用户提出任务

```text
创建课程：孕妇瑜伽，陈静，2 星，月卡，介绍自动填写
```

助手在当前页面看到 `course.create` 这个目标，也看到页面上的 `new_course`。它先调用 `pling_start_task`，再调用 `new_course`。

启动目标不会改变页面。弹窗仍然是关闭的。只有 `new_course` 的点击处理会打开它。

### 2. 助手打开真实表单

`new_course` 执行后，`@click="openCreate"` 运行：

```ts
function openCreate(): void {
  if (newCourseId.value) {
    Object.assign(draft, emptyCourseDraft());
    newCourseId.value = "";
    highlightedCourseId.value = "";
  }
  modalOpen.value = true;
  saveError.value = "";
}
```

这是页面原本的“新建课程”逻辑。清空上一次草稿、打开弹窗、重置错误提示，全部由页面负责。助手只是点了按钮。

### 3. 助手填写用户给出的字段

弹窗打开后，字段动作进入页面。助手按动作说明调用：

- `course_name` 写入“孕妇瑜伽”；
- `course_teacher` 选中“陈静”；
- `course_difficulty_2` 点击第二颗星；
- `course_cards` 选中“月卡”；
- `course_intro` 根据“介绍自动填写”生成并写入介绍。

每一步都是人也能做的同一个操作。Vue 的 `v-model`、`@change` 和页面校验照常运行。

### 4. 只追问真正的缺口

助手读 `draftRecord.fields.missing`，发现课程封面还没上传。它会说还差封面，并在用户问“在哪里点”时调用 `pling_locate`，把上传区标记出来。

用户选择文件后，`handleCoverSelected` 把 `draft.cover` 设为 `true`。`handoff` 的 `expect` 通过，助手继续下一步。

### 5. 保存并回读

助手调用 `save_course`。页面校验四项必填：名称、老师、可用卡、封面。通过后创建课程，把新记录放到课程库第一位。

`expect` 检查：

```ts
check: () => courses.value[0]?.id === newCourseId.value
```

检查通过，助手才调用 `pling_complete_task`。目标卡从“进行中”变成“已完成”。

### 6. 中途关掉弹窗

用户如果在这时关掉弹窗，`create-course-form` 区域消失，字段动作也不在页面上了。目标仍然 active，因为 `goal()` 默认保留。

用户可以继续问：

```text
刚才那门课还差什么？
```

助手会说明当前目标还在，但表单已经关闭；它可以重新调用 `new_course` 打开表单，再读草稿继续。表单里的值还在 `draft` 里，因为页面组件没有被卸载。

### 7. 用户可以随时提问或改主意

引导不是“下一题”。用户可以说：

- “为什么封面不能你来传？”
- “老师换成林老师。”
- “先别建了。”
- “这门课的名字改成孕妇流瑜伽。”

助手先回答或处理这句话，再决定要不要继续目标。改一个字段时，它只调用对应动作。取消时，调用 `pling_cancel_task` 或点目标卡上的取消按钮。目标结束，页面上的值保持原样。

## 自定义控件怎么接

真实后台里，很多控件不是 `input` 或 `select`。按控件的真实交互声明动作，不需要为了 Agent 改写成表单：

| 控件 | 接法 |
| --- | --- |
| 原生输入框 | `v-tool` 加 `action: 'fill'` |
| 原生下拉框 | `v-tool` 加 `action: 'select'` |
| 一排星级按钮 | 每颗星一条点击动作 |
| 自绘日期选择器 | 打开面板、选择日期各一条动作，或封装成一个带参数的动作 |
| 上传、签名、验证码 | `handoff`，由人完成 |
| 需要多步弹窗的操作 | 每条真实按钮一条动作，必要时用 `steps` 组合 |

自绘日期选择器如果需要接收一个值，可以用带参数的动作：

```ts
v-tool="{
  id: 'course_start_date',
  desc: '设置课程开始日期，格式 YYYY-MM-DD',
  params: [{ name: 'date', label: '开始日期' }],
  run: ({ date }) => setStartDate(String(date))
}"
```

这里的 `run` 仍然调用页面自己的 `setStartDate`。Agent 不需要知道日期面板长什么样，只需要知道这个动作接收什么值。

上传、验证码、支付确认这类步骤不要模拟。用 `handoff` 把控制权交还给人，再用 `expect` 检查页面是否真的完成。

## 为什么不在页面里写意图判断

有些接入会在页面里写：

```ts
if (/创建课程/.test(text)) openCreate();
```

这条正则会把“创建课程需要哪些信息？”也当成创建命令。用户问问题、改需求、说“先别建”，正则都理解不了。页面一旦承担意图识别，就会变成第二套对话逻辑，还要和模型争谁说了算。

这个案例把理解交给模型，把执行留给页面。模型能看到目标、动作说明、记录和当前页面状态，所以它能区分提问、修改、委托和取消。页面只负责真实控件的可用性和结果。

## 跟着做：从一张真实页面开始

下面按文件改。每一步都能单独运行，也能单独验证。先完成案例07 的七步，再看是否需要第八步。

### 准备：运行两个案例

在仓库根目录执行：

```bash
pnpm dev:examples
```

打开：

- `http://127.0.0.1:5191/demos/course-create-directives-vue3/?lang=zh`
- `http://127.0.0.1:5191/demos/course-workspace-vue3/?lang=zh`

先手动点一次“新建课程”，填几个字段，再关闭弹窗。你会看到两个案例的页面完全相同，差别只在案例06 多注册了一个目标。

案例07 的入口文件只有一层：

```vue
<!-- examples/demos/course-create-directives-vue3/src/App.vue -->
<script setup lang="ts">
import CourseCreatePage from "../../../shared/course-create/CourseCreatePage.vue";
import type { Locale } from "../../../shared/course-workspace/copy";

defineProps<{ locale: Locale }>();
</script>

<template>
  <CourseCreatePage :locale="locale" task-placement="none" />
</template>
```

真正的接入代码在 `examples/shared/course-create/CourseCreatePage.vue`。你不需要为 Agent 新做一张表单，也不需要把业务页面搬进聊天窗口。

### 第一步：保留原页面，先确认基线

先只启动原页面。弹窗保持关闭，课程库正常显示。不要急着加任务，也不要在页面加载时调用 `openCreate()`。

基线有三个特征：

1. 页面停在课程列表，用户能看到“新建课程”；
2. 点“新建课程”才出现表单；
3. 关闭弹窗后，表单和字段一起消失。

这三点决定了后面的接入方式。助手必须像用户一样，先找到新建按钮，再操作表单。

### 第二步：给真实按钮加 `v-tool`

找到页面右上角的“新建课程”按钮，加一条动作：

```vue
<button
  class="primary-button"
  type="button"
  v-tool="{
    id: 'new_course',
    kind: 'read',
    label: page.newCourse,
    desc: copy.newCourseDesc
  }"
  @click="openCreate"
>
  <span>＋</span>{{ page.newCourse }}
</button>
```

这条声明只告诉助手“这个按钮做什么”。点击后执行的仍然是页面自己的 `@click="openCreate"`。

打开助手的调试面板，确认动作清单里出现 `new_course`。然后对助手说：

```text
帮我新建一门课程
```

助手应该调用 `new_course`，由按钮打开弹窗。页面里不应该出现 `if (agent) openCreate()` 这类分支。

### 第三步：用 `v-scope` 圈出弹窗

弹窗打开后，才把表单区域暴露给助手：

```vue
<div v-if="modalOpen" class="modal-layer">
  <section
    class="course-modal"
    role="dialog"
    aria-modal="true"
    v-scope="{
      id: 'create-course-form',
      label: page.form.title,
      description: copy.formScope,
      role: 'dialog'
    }"
    v-record="draftRecord"
  >
    <!-- 原表单控件 -->
  </section>
</div>
```

`v-scope` 只命名区域。区域里的控件还没有自动变成可执行动作，数据也还没有暴露。

验证点在关闭弹窗之后：`create-course-form` 应该从助手的上下文里消失。这样助手不会误以为一个已经关掉的表单还能填写。

### 第四步：用 `v-record` 公开草稿

表单需要一份可读的当前值。用计算属性生成只读记录：

```ts
const draftRecord = computed(() => ({
  data: { ...draft },
  id: "course-draft",
  label: copy.value.draftLabel,
  fields: {
    name: draft.name,
    difficulty: draft.difficulty,
    teacher: teacherName.value || draft.teacherId,
    cards: draft.cards,
    intro: draft.intro,
    cover: draft.cover,
    required: [
      page.value.form.name,
      page.value.form.teacher,
      page.value.form.cards,
      page.value.form.cover,
    ],
    missing: requiredMissing.value,
  },
}));
```

记录里只放助手需要的业务字段。不要把整个 store、整个表单实例或所有内部状态倒进去。

`missing` 由页面自己的校验规则计算。这样助手回答“还差什么”时，和用户点保存时看到的是同一份结果。

验证方法：先打开空表单，问“还差什么”；填上课程名和老师，再问一次。助手应该读到 `draftRecord`，缺口从四项减少到两项，而不是靠猜。

### 第五步：给每个真实控件加动作

输入框用 `fill`：

```vue
<input
  v-model="draft.name"
  v-tool="{
    id: 'course_name',
    action: 'fill',
    label: page.form.name,
    desc: copy.fieldDesc.name
  }"
/>
```

下拉框用 `select`，说明里列出页面真实的选项：

```vue
<select
  :value="draft.teacherName"
  v-tool="{
    id: 'course_teacher',
    action: 'select',
    label: page.form.teacher,
    desc: copy.teacherDesc(teacherValues)
  }"
  @change="setTeacher(($event.target as HTMLSelectElement).value)"
>
  <option value="">{{ page.form.teacherPlaceholder }}</option>
  <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.name">
    {{ teacher.name }} · {{ teacher.subject }}
  </option>
</select>
```

`teacherValues` 来自页面数据，不是另写一份常量。老师列表变化时，动作说明会跟着变化。

自绘控件按真实交互拆动作。难度是五颗星，每颗星就是一条点击动作：

```vue
<button
  v-for="score in 5"
  :key="score"
  type="button"
  v-tool="{
    id: `course_difficulty_${score}`,
    kind: 'write',
    label: `${page.form.difficulty} ${score}`,
    desc: copy.difficultyDesc(score)
  }"
  @click="setDifficulty(score)"
>
  ★
</button>
```

上传不能由模型代做，使用 `handoff`：

```vue
<button
  class="upload-tile"
  type="button"
  v-tool="{
    id: 'course_cover',
    kind: 'write',
    label: page.form.cover,
    desc: copy.coverDesc,
    handoff: {
      reason: copy.coverHandoff,
      expect: { desc: copy.coverExpect, check: () => draft.cover }
    }
  }"
  @click="coverInput?.click()"
>
  <!-- 上传区 -->
</button>
```

验证时输入一句完整需求：

```text
创建课程：孕妇瑜伽，陈静，2 星，月卡，介绍自动填写
```

助手应该打开真实弹窗，再分别调用名称、老师、难度、可用卡和介绍动作。它不能直接把值写进某个隐藏对象。

再问：

```text
上传封面在哪里点？
```

助手应该调用 `pling_locate`，把上传区滚进视野并高亮。文件选择器不会自己弹出，用户仍然要亲自选文件。

### 第六步：保存要回读页面结果

保存不是“接口返回 200”就结束。给保存按钮加一个 `expect`：

```ts
const saveTool = computed(() => ({
  id: "save_course",
  kind: "write",
  label: page.value.form.save,
  desc: copy.value.saveDesc,
  run: () => saveCourse(),
  expect: {
    desc: copy.value.saveExpect,
    check: () => courses.value[0]?.id === newCourseId.value,
  },
}));
```

`saveCourse()` 仍然是页面原来的保存函数。它校验必填项，创建课程，把新记录放到课程库第一位。

`expect` 在动作返回后运行。新课程没有出现在第一位，保存就按失败处理。此时助手不能报告成功，也不能完成目标。

验证方法：

1. 故意不上传封面，点保存，页面应提示缺少封面；
2. 上传封面后保存，新课程应出现在列表第一位；
3. 观察动作结果，`expect` 应该返回通过；
4. 刷新页面，确认这是页面自己的保存逻辑，不是聊天记录伪造的结果。

### 第七步：需要连续性时再加目标

只有前面六步还不满足时，才进入这一步。典型情况是弹窗会关闭，用户会离开再回来，或者外部 Agent 需要固定的完成边界。

案例06 的全部任务接入只有三行：

```ts
const pling = usePling();
const disposeGoal = pling.task.goal(courseGoal(props.locale));
onBeforeUnmount(disposeGoal);
```

`courseGoal()` 只写结果、边界和成功条件：

```ts
export function courseGoal(locale: Locale): TaskGoalInput {
  return {
    id: "course.create",
    title: locale === "zh" ? "创建课程" : "Create a course",
    goal: "在课程管理里新建一门课程：自己打开真实表单，按用户给出的信息填写，封面请用户上传，保存后回读课程库确认新课程在第一位。",
    constraints: [
      "页面上的动作是唯一操作入口；不要另造字段名、选择器或表单。",
      "只填写用户明确给出或明确委托的内容；不确定就问。",
      "封面必须由用户亲自上传，你不能替用户选择本地文件。",
      "用户的问题、修改、暂停和放弃优先于继续填表。",
    ],
    successCriteria: [
      "新课程出现在课程库第一位",
      "名称、老师、可用卡和封面与用户确认的一致",
      "保存动作已回读课程库并确认了这条新记录",
    ],
    examples: ["创建孕妇瑜伽，陈静，2 星，月卡，介绍自动填写"],
  };
}
```

这里不能加 `fields`、`steps`、`controller` 或保存回调。字段来自真实页面，保存来自 `save_course`，目标只负责让这件事在页面变化后继续存在。

验证方法：

1. 启动创建任务，等助手打开弹窗；
2. 关闭弹窗，问“刚才那门课还差什么”；
3. 案例06 的目标仍然存在，助手可以重新打开表单继续；
4. 案例07 没有目标，助手只能从当前页面重新判断；
5. 保存并通过 `expect` 后，助手才调用 `pling_complete_task`。

### 第八步：只有页面动作不够时才用进阶 API

进阶 `TaskDefinition` 和 `TaskController` 解决这些问题：

- 字段需要类型、范围、正则或业务校验；
- 大集合需要异步查找和候选确认；
- 多个动作必须按固定顺序执行，并共用一份字段值；
- 任务要在没有界面的宿主里运行。

它能做更多事，也会带来第二份字段定义。单页表单不需要它。先用页面动作把流程跑通，再判断是否真的缺少这些能力。

## 常见错误

### 页面替助手打开弹窗

如果页面在加载时直接设置 `modalOpen = true`，助手就失去了“找到新建按钮并点击”的机会。任务也应该从课程库开始，不能默认把表单摊开。

### 给自绘控件补一个隐藏输入框

隐藏输入框看起来省事，实际会制造第二套交互。用户在页面上点星星，助手却写隐藏字段，两边状态很容易不一致。按控件真实行为声明动作。

### 动作说明不写可选值

老师列表来自页面数据，说明里却不列姓名。模型只能猜，猜错后动作会失败。说明应该由页面数据生成，页面变化时一起变化。

### `expect` 只检查函数有没有抛错

保存函数没有抛错，不代表业务已经生效。`expect` 要读页面结果，例如新记录是否在列表第一位。检查不到结果，就不能报告成功。

### 在页面里写正则判断意图

`if (/创建课程/.test(text)) openCreate()` 会把提问也当成命令。意图理解应该交给模型，页面只提供动作和状态。

### 目标里重复写字段

目标里再写一份 `fields`，页面表单就成了第二份真相。字段改名、选项变化或校验调整时，两处很容易漂移。目标是生命周期，不是表单 schema。

## 最终效果

完成前面六步后，页面已经能完成创建课程：

| 用户说 | 助手做 | 页面反应 |
| --- | --- | --- |
| “创建孕妇瑜伽，陈静，2 星，月卡” | 调用 `new_course`，再填写对应字段 | 弹窗打开，原表单出现用户给出的值 |
| “还差什么？” | 读 `draftRecord` 的 `missing` | 只报告真实缺口，不猜 |
| “上传封面在哪里点？” | 调用 `pling_locate` | 上传区滚进视野并高亮 |
| 用户选择封面并说“保存” | 调用 `save_course`，等待 `expect` | 新课程进入课程库第一位 |
| 保存结果通过 | 报告保存结果 | 列表回读与页面状态一致 |

完成第七步后，弹窗关闭也不会丢掉目标。助手可以重新打开表单继续，只有保存并回读成功后才调用 `pling_complete_task`。

## 在浏览器里核对

打开 [案例06](/demos/course-workspace-vue3/?lang=zh) 和 [案例07](/demos/course-create-directives-vue3/?lang=zh)，依次检查：

- 首次进入时弹窗是关闭的，页面停在课程库。
- 输入“创建孕妇瑜伽，陈静，2 星，月卡，介绍自动填写”，助手自己点击“新建课程”，弹窗由页面按钮打开。
- 名称、老师、难度、可用卡和介绍写进原表单，样式和手动填写一致。
- 问“还差什么”，助手读草稿记录回答，不凭空猜。
- 问“上传封面在哪里点”，页面滚到上传区并高亮，文件选择器不会自己弹出。
- 用户选择封面后，保存成功，新课程出现在课程库第一位。
- 保存后目标才完成；完成动作没有再次写入课程。
- 关掉弹窗再问“刚才那门课还差什么”，案例06 的目标仍然 active，案例07 没有目标层。
- 点取消后目标消失，已经填进表单的值不被回滚。
- 聊天变长后记录仍能滚动，页面没有控制台错误。

## 和进阶 API 的边界

`pling.task.goal()` 是默认的任务接入。它没有字段表，也没有步骤控制器。字段来自真实页面，执行来自真实动作。

`pling.task.define()` 仍然保留，用于这些确实需要声明的场景：

- 字段需要类型、范围、正则或业务校验；
- 大集合需要异步查找和候选确认；
- 多个动作必须按固定顺序执行，并且要共用一份字段值；
- 任务需要在没有界面的宿主里运行。

这些能力解决的是“页面动作不够表达”的问题，不是“接 Agent 必须先写任务”的问题。大多数单页表单不需要它们。

完整的参数、状态和方法见[引导任务 API](/zh/reference/guided-task-api)。
