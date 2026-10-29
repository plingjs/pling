---
id: V2-05
title: "记录与弹窗"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 记录与弹窗

当每一行都有自己的数据时，只给动作清单不够。模型需要知道页面当前有三条待办、哪一条已完成、编辑动作属于哪一行。弹窗又带来第二个问题：它的控件只应该在弹窗打开时存在。

Vue 2 的 `v-record` 把一个元素声明为一条业务记录。字段从模板正在渲染的同一个对象读取，因此人或动作做出的修改会出现在下一份注册表快照里。

```ts
directives: [{
  name: "record",
  value: {
    data: task,
    label: copy.recordLabel(task.text),
  },
}]
```

行内动作仍使用记录 id 生成稳定动作 id：

```ts
directives: [{ name: "tool", value: {
  id: `edit@${task.id}`,
  desc: copy.editDesc(task.text),
} }]
```

因此 `edit@t2` 指向第二条任务的操作，而不是排序后碰巧存在的第二个 DOM 节点。

## 通过动作打开弹窗

编辑按钮没有传入 `run`。执行器点击真实按钮，Vue 处理函数设置 `editingId`：

```ts
beginEdit(task) {
  this.editingId = task.id;
  this.editText = task.text;
}
```

只有 `editingId` 有值时，弹窗才渲染。它的控件也在这个条件分支里声明：

```vue
<div v-if="editing" role="dialog" aria-modal="true"
     v-scope="{ id: 'edit_dialog', label: 'Edit task', role: 'dialog' }">
  <input v-tool="{ id: 'edit_text', action: 'fill', desc: '...' }" />
  <button v-tool="{ id: 'edit_save', desc: '...' }" @click="saveEdit">Save</button>
</div>
```

模型看到的是当前页面事实。弹窗关闭时，`edit_save` 和 `edit_text` 不存在；弹窗打开时，作用域说明它们位于哪里；弹窗关闭后，这些登记随 Vue 元素一起移除。

`role="dialog"` 和 `aria-modal="true"` 面向用户与辅助技术。它们不能替代 Pling 的作用域。作用域告诉能力层哪一块区域处于活动状态，ARIA 属性则把同一事实告诉浏览器。

## 只修改一条记录

保存时调用已有的 Vue 修改逻辑：

```ts
saveEdit() {
  const task = this.tasks.find((item) => item.id === this.editingId);
  const text = this.editText.trim();
  if (!task || !text) return;
  task.text = text;
  this.editingId = null;
}
```

下一份快照会从更新后的对象读取 `text`。记录里的字段变化是业务状态确实移动的证据，不是服务端已经接受写入的证明。如果应用通过 API 持久化，应另外暴露确认结果。

## 运行示例

```bash
pnpm tutorial:dev v2-05
```

打开 `http://127.0.0.1:5266/`；中文使用 `--locale zh` 和 `http://127.0.0.1:5266/?lang=zh`。

```bash
pnpm tutorial:check v2-05
```

测试通过 `edit@t2` 打开弹窗，确认弹窗动作出现，修改记录并核对实时字段，最后确认关闭弹窗后动作被移除。

## 常见问题

**在页面根节点声明弹窗动作。** 弹窗关闭时它们仍然可见。应放在真正创建控件的条件分支内。

**把弹窗当成危险操作的授权。** 打开表单不等于批准写入。破坏性操作仍需要确认策略，并在真正权威的服务端再做一次校验。

**忘记记录名称。** 模型需要一行的人类可读名称，尤其是渲染文本被截断或包含敏感值时。

**以为作用域会让元素可见。** 作用域描述区域。动作是否可用还取决于 DOM 是否存在、可见性、遮挡、前置条件和执行器策略。
