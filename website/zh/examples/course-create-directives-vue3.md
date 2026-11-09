---
id: SITE-03-course-create-directives-vue3
layout: page
pageClass: demo-page
title: "案例07：只用指令创建课程（Vue 3）"
description: 同一张课程页面，只用 v-scope、v-record、v-tool。弹窗初始关闭，助手自己点击真实新建按钮，操作真实控件。
status: draft
release: 0.1
locale: zh
---

<DemoPlayground id="course-create-directives-vue3" />

## 出发点：不要为 Agent 再做一张表单

这张页面来自一个普通的课程后台。用户点“新建课程”，弹窗打开，填完表单后保存。页面原本就有课程库、表单、老师下拉框、星级按钮和上传区。

接入 Agent 时，最容易走错的一步是再写一份“课程字段表”。字段名、必填项、老师选项和保存逻辑都会变成第二份真相。页面改一次，接入代码就要跟着改一次。

案例07 换一种做法：页面只说明自己有什么区域、当前值是什么、每个控件能做什么。助手像用户一样操作这张页面。

这个案例没有任务目标。它和[案例06](/zh/examples/course-workspace-vue3)跑同一条创建课程流程，只使用三类声明：

- `v-scope` 命名课程库和新建课程弹窗；
- `v-record` 公开当前草稿和已保存课程；
- `v-tool` 把每个真实控件声明成动作。

## 具体实现：从入口到保存

入口在 `examples/demos/course-create-directives-vue3/src/App.vue`，它只渲染共享页面。真正的接入代码在 `examples/shared/course-create/CourseCreatePage.vue`。

第一步是保留真实入口。页面加载时弹窗关闭，只有 `new_course` 动作：

```vue
<button
  type="button"
  v-tool="{ id: 'new_course', kind: 'read', label: page.newCourse, desc: copy.newCourseDesc }"
  @click="openCreate"
>
  {{ page.newCourse }}
</button>
```

助手调用 `new_course` 后，运行的是按钮自己的 `@click="openCreate"`。页面里没有 `if (agent) openCreate()`。

第二步是命名弹窗区域，并公开草稿：

```vue
<section
  v-scope="{ id: 'create-course-form', label: page.form.title, description: copy.formScope }"
  v-record="draftRecord"
>
  <!-- 原表单 -->
</section>
```

`v-scope` 只圈出区域。`v-record` 提供当前值、必填项和缺口。弹窗关闭后，两者一起消失。

第三步是给每个真实控件加动作。输入框用 `fill`，下拉框用 `select`。难度不是原生输入框，而是一排自绘按钮，所以每颗星各有一条点击动作：

```vue
<button
  v-for="score in 5"
  :key="score"
  type="button"
  v-tool="{ id: `course_difficulty_${score}`, kind: 'write', label: `${page.form.difficulty} ${score}`, desc: copy.difficultyDesc(score) }"
  @click="setDifficulty(score)"
>
  ★
</button>
```

封面必须由人上传，因此使用 `handoff`。助手可以定位上传区，但不能替用户选择本地文件。

最后一步是保存。`save_course` 调用页面原来的保存函数，并用 `expect` 回读课程库：

```ts
expect: {
  desc: copy.value.saveExpect,
  check: () => courses.value[0]?.id === newCourseId.value,
}
```

新课程没有出现在列表第一位，保存就按失败处理。

## 运行并验证

在仓库根目录执行：

```bash
pnpm dev:examples
```

打开 `http://127.0.0.1:5191/demos/course-create-directives-vue3/?lang=zh`，依次试：

1. 页面应停在课程库，弹窗是关闭的。
2. 输入“创建孕妇瑜伽，陈静，2 星，月卡，介绍自动填写”，助手应自己点击“新建课程”。
3. 名称、老师、难度、可用卡和介绍应写入原表单，样式和手动输入一致。
4. 问“还差什么”，助手应读取草稿记录回答。
5. 问“上传封面在哪里点”，页面应滚到上传区并高亮；文件选择器不会自己弹出。
6. 你选择封面并保存后，新课程应出现在课程库第一位。

## 最终效果

开发者只改动了原页面里的声明，没有新增第二张表单，也没有把业务逻辑搬进聊天窗口。

用户说一句话，助手完成以下动作：

1. 点击真实的“新建课程”；
2. 在原表单里填写用户给出的字段；
3. 读取草稿，只追问真正缺失的封面；
4. 调用真实保存动作；
5. 从课程库回读结果，再报告成功。

代码位置、运行命令和每一步的验证方法都在上面的对应小节。想比较“多一个持久目标”的版本，打开[案例06](/zh/examples/course-workspace-vue3)。

## 业务动作 id 由你决定

`course_name`、`course_intro`、`course_cover` 这些名字由这个示例自己决定，不是 Pling 预定义的 API。框架提供声明机制，页面决定名称、说明和约束。换到订单后台，同一套写法会声明 `order_note`、`refund_reason` 或 `approve_order`。

## 开发者还需要描述什么

指令不会自动推导字段 schema。动作说明要写清楚哪些值必填、有哪些可选值、成功后页面会变成什么样。

页面新增字段，就新增一条 `v-tool`。下拉选项变化，说明也要跟着改。对稳定表单来说，这点成本很小。表单很长、经常变化或跨多个页面时，它就会变成第二份 schema。

## 自定义控件

难度是一排自绘的星星按钮，不是原生输入框。每颗星各自声明点击动作。上传使用 `handoff`，由用户选择文件。这就是非 `input` / `select` 控件的正常接法。

问“上传封面在哪里点”，助手调用内置的 `pling_locate`，把上传区滚进视野并高亮。它不会打开文件选择器，也不会修改草稿。

## 什么时候加目标

一张稳定的单页表单就是全部工作时，用这个案例。结果需要在弹窗关闭或路由变化后继续存在时，换到[案例06](/zh/examples/course-workspace-vue3)。
