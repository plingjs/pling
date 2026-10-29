---
id: V2-03
title: "快速上手：一个完整的 Todo Agent"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 快速上手：一个完整的 Todo Agent

本章从一个可运行的 Vue 2.7 待办页面出发，建立一小块完整的能力面：任务区域、任务记录、新待办输入框、提交按钮和完成按钮。业务页面仍然通过原有的 Vue 处理函数新增和切换待办。

考虑这样一个请求：“把第 1 个待办标记完成，再新增两条。”助手需要知道三类信息：

1. 待办区域是一个有意义的页面区域。
2. 每一行是一条记录，带稳定 id、文字和完成状态。
3. 输入框、提交按钮和完成按钮是能改变这些记录的操作。

裸 DOM 能显示文字，却无法可靠判断哪个按钮表示“完成这条待办”，也无法知道排序后哪一行还是同一条记录。声明补上的正是这层业务含义。

## 描述区域与记录

外层节点命名页面区域，列表声明父区域，于是行内动作有了可推理的位置：

```vue
<section v-scope="{ id: 'todo', label: '待办', role: 'main' }">
  <ul v-scope="{ id: 'todo_list', label: '任务列表', role: 'list', parent: 'todo' }">
    <li v-for="task in tasks" :key="task.id" v-record="{ data: task, label: `待办：${task.text}` }">
      ...
    </li>
  </ul>
</section>
```

记录绑定的是列表正在渲染的同一个对象。用户切换待办后，下一份快照会从该对象读取更新后的 `done`。

## 声明控件

输入框声明一个填充原语，不替代 Vue 的输入处理：

```vue
<input
  v-model="draft"
  v-tool="{ id: 'composer_text', desc: '在这个输入框中填写一条新待办。', action: 'fill',
            params: [{ name: 'text', label: '待办内容' }] }"
/>
```

提交按钮仍然是普通提交按钮。声明补充业务说明和可用条件：

```vue
<button
  type="submit"
  :disabled="!draft.trim() || tasks.length >= 8"
  v-tool="{ id: 'composer_submit', desc: '把新待办输入框中的文字加入列表。',
            available: submitAvailable }"
>
  添加待办
</button>
```

每一行的完成控件使用由稳定任务 id 生成的动作 id：

```vue
<button v-tool="{ id: `toggle@${task.id}`, desc: toggleDescription(task) }" @click="toggleTask(task.id)">
  {{ task.done ? '✓' : '' }}
</button>
```

列表变化时，这个 id 的含义不会漂移。`toggle@t2` 指向特定的业务记录，而不是某个时刻的第二个 DOM 节点。

## 挂载助手

入口在 Vue 实例挂载后创建一次：

```ts
mounted() {
  this.dock = pling.dock({
    title: "待办助手",
    quick: [
      "把“准备明天的议程”加入我的待办",
      "把第 1 个待办标记完成",
    ],
  });
}
```

快捷问题只是建议，不是特权命令。助手仍需先解析当前区域、记录和动作，才能执行操作。

## 运行示例

```bash
pnpm tutorial:dev v2-03
```

打开 `http://127.0.0.1:5243/`。中文界面使用 `pnpm tutorial:dev v2-03 --locale zh`，然后打开 `http://127.0.0.1:5243/?lang=zh`。

```bash
pnpm tutorial:check v2-03
```

确定性测试会检查任务区域、三条记录、已声明控件，并验证通过真实输入和提交处理新增待办，以及通过行内动作切换待办。

## 本章的边界

示例有意不开放删除、编辑和服务端确认。这些操作不能只靠“多一个点击”解决：它们需要稳定记录、确认边界、持久化，以及写入是否真正到达系统的事实证据。

下一步：[基于指令的动作声明](/zh/vue2/directive-based-actions)。
