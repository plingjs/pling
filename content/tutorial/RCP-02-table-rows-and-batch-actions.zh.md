---
id: RCP-02
title: "表格行与批量操作"
locale: zh
source_locale: en
translation_status: synced
status: drafted
---

# 表格行与批量操作

表格不是“一堆按钮”。模型需要先认出是哪一行、读到决定操作的字段、调用行内动作，并理解当前选择代表什么。批量操作又多一层问题：它面对的是一个集合，不是单条记录。

## 可运行页面

下面的订单表把稳定记录 id、选中集合和批量通过放在同一个业务页面上。筛选变化后，旧选择不会误落到另一行。

<DemoPlayground id="recipe-table-batch" />

从仓库根目录运行：

```bash
pnpm dev:examples
```

打开 `http://localhost:5191/demos/recipe-table-batch/?lang=zh`。页面源码与逐项说明位于 `examples/demos/recipe-table-batch/`；本方案不依赖后端服务，状态只保存在当前标签页。

## 业务任务

用户说：

> “把选中的三笔订单通过，再把 SO-1042 驳回，客户已经取消。”

页面需要暴露：

- 表格区域；
- 每笔订单作为记录，包含 `id`、客户、金额与状态；
- 带稳定 id 的行内动作；
- 当前选中集合与批量动作；
- 报告总数、可见数与选中数的状态。

模型不能靠位置猜行号，也不应该收到 200 个独立的批量按钮。

## 声明方式

### Vue 3

```vue
<template>
  <section v-scope="{ id: 'orders', label: '订单列表', role: 'list' }">
    <tr v-for="order in visible" :key="order.id" v-record="{ data: order }">
      <td>{{ order.id }}</td>
      <td>{{ order.customer }}</td>
      <td>
        <button v-tool="{ id: `approve@${order.id}`, desc: `通过订单：${order.id}` }" @click="approve(order.id)">
          通过
        </button>
        <button v-tool="{ id: `reject@${order.id}`, desc: `驳回订单：${order.id}`, kind: 'danger' }" @click="reject(order.id)">
          驳回
        </button>
      </td>
    </tr>
  </section>
</template>
```

```ts
useAgentState("orders_view", () => ({
  filter,
  visible: visible.value.length,
  total: orders.value.length,
  selected: selected.value.size,
}), { description: "当前订单筛选与选择计数" });

useAgentTool({
  id: "approve_selected",
  desc: "通过当前选中的所有订单",
  kind: "write",
  available: () => (selected.value.size ? true : "当前没有选中订单"),
  run: () => approveMany([...selected.value]),
  expect: {
    desc: "选中的订单都已通过",
    check: () => [...selected.value].every((id) => statusOf(id) === "approved"),
  },
});
```

### React

```tsx
const row = usePlingRecord({ data: order });
const approve = usePlingTool<HTMLButtonElement>({ id: `approve@${order.id}`, desc: `通过订单：${order.id}` });

useAgentTool({
  id: "approve_selected",
  desc: "通过当前选中的所有订单",
  kind: "write",
  available: () => (selected.size ? true : "当前没有选中订单"),
  run: () => approveMany([...selected]),
});

usePlingState("orders_view", () => ({
  filter,
  visible: visible.length,
  total: orders.length,
  selected: selected.size,
}), { description: "当前订单筛选与选择计数" });
```

### 原生 JS / jQuery

```ts
pling.scope(table, { id: "orders", label: "订单列表", role: "list" });
pling.record(rowElement, { data: order });
pling.tool(approveButton, { id: `approve@${order.id}`, desc: `通过订单：${order.id}` });

pling.action({
  id: "approve_selected",
  desc: "通过当前选中的所有订单",
  kind: "write",
  available: () => (selected.size ? true : "当前没有选中订单"),
  run: () => approveMany([...selected]),
});

pling.state("orders_view", () => ({ filter, visible: visible.length, total: orders.length, selected: selected.size }));
```

### Vue 2.7

```ts
import { defineComponent, onBeforeUnmount } from "vue";
import { usePling } from "@plingjs/vue2";

export default defineComponent({
  setup() {
    const pling = usePling();
    const off = pling.action({
      id: "approve_selected",
      desc: "通过当前选中的所有订单",
      kind: "write",
      available: () => (selected.size ? true : "当前没有选中订单"),
      run: () => approveMany([...selected]),
    });
    onBeforeUnmount(off);
  },
});
```

模板中每行使用 `v-record="{ data: order }"` 与 `v-tool="{ id: \`approve@${order.id}\`, desc: ... }"`。

## 执行与验证

1. 用户勾选若干行，状态报告 `selected: 3`。
2. 模型调用 `approve_selected`。
3. 批量函数更新业务状态。
4. `expect` 等到选中的订单都变为已通过。
5. 下一份快照显示新状态；`selected` 是否清空由页面自己的业务决定。

如果批量操作只成功了一部分，要返回真实结果。不要把部分失败合并成“已通过”。

## 常见失败

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| 模型操作了错误的行 | 行内动作 id 使用了下标 | 使用业务主键 |
| 提示词里塞满几百个动作 | 每行都成了独立的全局动作 | 用记录 + 行内动作，让框架折叠 |
| 批量动作使用了旧选择 | `run` 在声明时捕获了数组 | 在 `run` 内读取当前选择 |
| 没有选中也能批量执行 | 缺少 `available()` 前置条件 | 返回原因字符串 |
| 视口外的行无法操作 | 行内动作被隐藏，但没有记录 id 可引用 | 保留记录 id，让适配器 reveal；见[长列表、滚动与视口外动作](/zh/vue/long-lists-scrolling-and-offscreen-actions) |
| 删除被当成普通写入 | 省略了 `kind`，默认为 `write` | 破坏性动作标 `danger` 并加确认 |

## 安全边界

选中是界面概念，不是授权决定。批量函数仍要逐条检查当前用户是否有权通过该订单。模型传来的记录 id 只是引用，不是权限证明。

破坏性批量操作使用 `kind: "danger"` 并要求确认。集合很大时，先给出数量与样例预览，再执行。

## 证据

本方案的可运行源码是 `examples/demos/recipe-table-batch/`。`src/App.vue` 同时包含记录声明、选中集合、状态视图与批量工具，适合对照正文逐段阅读。

## 本地验证

手动选择两行并让助手通过，然后切换筛选再尝试复用旧选择。失效 id 应被忽略，批量结果应说明实际处理了哪些订单；不要只显示一个笼统的“成功”。
