---
id: J-07
title: "表单、异步更新与弹窗"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 表单、异步更新与弹窗

编辑表单带来两个单纯点击没有的问题：弹窗控件应只在打开时存在；保存可能在点击处理函数返回后才完成。过早报告成功，会让模型对页面产生错误认识。

示例从行内动作打开弹窗，在它可见时注册控件，并等保存后的值真正出现，才把这一步报告为成功。

## 通过现有行内动作打开弹窗

每一行有一个带稳定 id 的编辑按钮：

```ts
pling.tool(editButton, {
  id: `edit@${task.id}`,
  desc: `编辑“${task.text}”。`,
});
```

点击它会运行用户同样会触发的 `openEdit`。该函数填充表单并显示弹窗，此时还没有修改任务。

## 只在弹窗打开时注册控件

弹窗初始隐藏。`openEdit` 在它变为可见时声明区域和控件：

```ts
dialogCleanups = [
  pling.scope(dialog, {
    id: "edit_dialog",
    label: "编辑待办",
    role: "dialog",
  }),
  pling.tool(editText, {
    id: "edit_text",
    desc: "填写这条待办更新后的内容。",
    action: "fill",
    params: [{ name: "text", label: "待办内容" }],
  }),
  pling.tool(saveButton, { id: "edit_save", desc: "保存修改后的待办内容。" }),
  pling.tool(cancelButton, { id: "edit_cancel", desc: "关闭弹窗，不保存修改。" }),
];
```

`closeDialog` 在隐藏元素前，按相反顺序调用每个清理函数。这与动态行遵循同一条所有权规则，只是对象换成了临时界面。用 CSS 隐藏但仍在注册表中的弹窗，对模型仍然可见。

## 等待异步结果

保存按钮会提交表单，但页面用短暂延迟模拟持久化：

```ts
async function saveEdit(): Promise<void> {
  const id = editingId;
  const text = editText.value.trim();
  if (!id || !text) return;

  editStatus.textContent = "正在保存…";
  await new Promise((resolve) => setTimeout(resolve, 80));

  const task = tasks.find((candidate) => candidate.id === id);
  if (!task) return;
  task.text = text;
  lastSaved = { id, text };
  closeDialog();
  replaceRow(task);
}
```

动作声明的不是“点击完成”，而是成功判据：

```ts
expect: {
  desc: "待办内容已更新，并且弹窗已关闭。",
  check: () => lastSaved?.id === task.id && editingId === null,
  timeout: 2_000,
}
```

执行器会等待该条件成立，再返回成功。如果页面一直停在“正在保存…”，模型收到的是期望失败，而不是假成功。任何业务效果在事件处理函数返回后才到达的动作，都适合这样处理。

## 文本变化后重新绑定行

记录标签和编辑说明包含任务文字。保存后，示例替换行并重新注册：

```ts
function replaceRow(task: Task): void {
  const entry = rows.get(task.id);
  if (!entry) return;
  for (const cleanup of entry.cleanups.reverse()) cleanup();
  rows.delete(task.id);
  const replacement = mountRow(task, false);
  entry.element.replaceWith(replacement);
}
```

这样可见标签、记录字段和动作说明保持一致。如果只改文本节点，记录可能仍携带旧值，直到下一次实时读取。

## 运行示例

```bash
pnpm tutorial:dev j-07
```

打开 `http://127.0.0.1:5272/`，或使用 `--locale zh` 和 `http://127.0.0.1:5272/?lang=zh`。

```bash
pnpm tutorial:check j-07
```

检查会打开 `edit@t2`，确认弹窗动作出现，填充 `edit_text`，保存并等待异步记录更新，最后确认弹窗关闭后所有弹窗动作消失。

## 常见问题

**在页面启动时声明弹窗动作。** 弹窗关闭后它们仍然可用。应在打开路径绑定，在关闭路径解绑。

**点击后立刻返回成功。** 表单可能还在保存。应暴露页面可检查的结果，并在等待时间有界时用 `expect` 声明。

**编辑后保留旧行记录。** 重新绑定行可以更新包含新值的标签和说明。

**用隐藏弹窗充当确认步骤。** 可见性不是同意。危险操作仍需要确认策略和服务端授权。

下一步：[挂载问答入口与助手界面](/zh/vanilla/mount-the-assistant-ui)。
