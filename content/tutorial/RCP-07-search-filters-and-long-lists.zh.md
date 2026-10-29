---
id: RCP-07
title: "搜索、筛选与长列表"
locale: zh
source_locale: en
translation_status: translated
status: drafted
---

# 搜索、筛选与长列表

长列表带来两个不同问题：模型看不到视口外的行，也可能把当前筛选结果当成全部数据。给每一行各加一个动作，会让第二个问题更严重，因为工具清单会被大量行级按钮淹没。

解法不是“把所有数据交给模型”，而是提供稳定的记录身份、当前视图的小型说明，以及明确的搜索、滚动或加载更多操作。

## 可运行页面

下面的工单队列包含 160 条本地记录，并把总数、匹配数与已渲染数分开报告。搜索、状态筛选和“再显示 30 条”都不会把整张表塞进上下文。

<DemoPlayground id="recipe-search-long-list" />

从仓库根目录运行：

```bash
pnpm dev:examples
```

打开 `http://localhost:5191/demos/recipe-search-long-list/?lang=zh`。源码与观察步骤在 `examples/demos/recipe-search-long-list/`；示例数据在页面内，不依赖后端。

## 模型需要什么

用户说“显示 Acme 未付款的订单，并打开最早的一条”时，模型需要：

- 当前搜索词与状态筛选；
- 匹配数量与全部记录数量；
- 是否还有未渲染或未加载的记录；
- 每个已渲染行作为带业务 id 的记录；
- 一类行级动作，而不是几百个全局唯一动作名；
- 把视口外区域或行带到可见位置的方式。

它不需要为了选一行而读取每张发票明细、内部备注或客户地址。

## 把搜索当成一次操作

```ts
const searchOrders = {
  id: "search_orders",
  desc: "Search orders by text, status, or both, then update the table",
  kind: "read",
  params: [
    { name: "query", label: "Text to match in customer or order id", optional: true, maxLength: 80 },
    { name: "status", label: "Order status", optional: true, values: ["open", "paid", "cancelled"] },
  ],
  run: async (args) => {
    const query = String(args.query ?? "").trim();
    const status = String(args.status ?? "");
    await loadOrders({ query, status });
  },
  expect: {
    desc: "The table has applied the requested search",
    check: () => appliedQuery.value === query && appliedStatus.value === status,
  },
};
```

有两个细节。`query` 与 `status` 都是可选的，模型可以只改一个而不猜另一个。成功判据检查已经应用的值，而不是输入草稿：搜索框可能显示新词，而表格仍在展示上一次结果。

## 当前视图状态

```ts
useAgentState(
  "orders_view",
  () => ({
    query: appliedQuery.value,
    status: appliedStatus.value,
    matched: rows.value.length,
    total: totalOrders.value,
    hasMore: nextPage.value !== null,
  }),
  { description: "Applied order search, result count, total, and next-page availability" },
);
```

字段名不应随语言变化。`open` 是稳定代码；界面显示可以是“Open”“待处理”或其他翻译。不要把尚未提交的搜索草稿当作控制表格的值暴露出去。

## 记录、行级动作与滚动

### Vue 3

```vue
<section v-scope="{ id: 'orders', label: 'Order results', role: 'list' }" class="results">
  <article v-for="order in rows" :key="order.id" v-record="{ data: order }">
    <strong>{{ order.id }}</strong>
    <span>{{ order.customer }}</span>
    <button
      v-tool="{ id: `open@${order.id}`, desc: `Open order ${order.id}`, kind: 'read' }"
      @click="openOrder(order.id)"
    >
      Open
    </button>
  </article>
</section>
```

```ts
import { ref } from "vue";
import { useAgentState, useAgentTool } from "@plingjs/vue";

const loadedBeforeRun = ref(0);
useAgentTool({
  id: "load_more_orders",
  desc: "Load the next page of order results",
  kind: "read",
  available: () => (nextPage.value ? true : "All matching orders are already loaded"),
  run: async () => {
    loadedBeforeRun.value = rows.value.length;
    await loadPage(nextPage.value!);
  },
  expect: {
    desc: "At least one more order is loaded",
    check: () => rows.value.length > loadedBeforeRun.value,
  },
});

useAgentState("orders_view", () => ({
  query: appliedQuery.value,
  status: appliedStatus.value,
  matched: rows.value.length,
  total: totalOrders.value,
  hasMore: nextPage.value !== null,
}), { description: "Applied order search and result counts" });
```

### React

```tsx
import { useRef } from "react";
import {
  useAgentTool,
  usePlingRecord,
  usePlingScope,
  usePlingState,
  usePlingTool,
} from "@plingjs/react";

function Row({ order }: { order: Order }) {
  const record = usePlingRecord({ data: order });
  const open = usePlingTool<HTMLButtonElement>({
    id: `open@${order.id}`,
    desc: `Open order ${order.id}`,
    kind: "read",
  });
  return (
    <article ref={record}>
      <strong>{order.id}</strong> {order.customer}
      <button ref={open} onClick={() => openOrder(order.id)}>Open</button>
    </article>
  );
}

export function OrderList(props: {
  orders: Order[];
  nextPage: string | null;
  loadPage: (cursor: string) => Promise<void>;
  appliedQuery: string;
  appliedStatus: string;
  totalOrders: number;
}) {
  const listScope = usePlingScope<HTMLDivElement>({ id: "orders", label: "Order results", role: "list" });
  const loadedBefore = useRef(0);
  const countRef = useRef(props.orders.length);
  countRef.current = props.orders.length;

  useAgentTool({
    id: "load_more_orders",
    desc: "Load the next page of order results",
    kind: "read",
    available: () => (props.nextPage ? true : "All matching orders are already loaded"),
    run: async () => {
      loadedBefore.current = props.orders.length;
      await props.loadPage(props.nextPage!);
    },
    expect: {
      desc: "At least one more order is loaded",
      check: () => countRef.current > loadedBefore.current,
    },
  });

  usePlingState("orders_view", () => ({
    query: props.appliedQuery,
    status: props.appliedStatus,
    matched: props.orders.length,
    total: props.totalOrders,
    hasMore: props.nextPage !== null,
  }), { description: "Applied order search and result counts" });

  return (
    <section ref={listScope}>
      {props.orders.map((order) => <Row key={order.id} order={order} />)}
    </section>
  );
}
```

### 原生 JS / jQuery

```ts
pling.scope(list, { id: "orders", label: "Order results", role: "list" });

for (const order of rows) {
  const row = list.querySelector(`[data-order="${order.id}"]`);
  pling.record(row, { data: order });
  pling.tool(row.querySelector(".open"), {
    id: `open@${order.id}`,
    desc: `Open order ${order.id}`,
    kind: "read",
  });
}

pling.action({
  id: "load_more_orders",
  desc: "Load the next page of order results",
  kind: "read",
  available: () => (state.nextPage ? true : "All matching orders are already loaded"),
  run: () => {
    state.loadedBefore = state.rows.length;
    return loadPage(state.nextPage);
  },
  expect: {
    desc: "At least one more order is loaded",
    check: () => state.rows.length > state.loadedBefore,
  },
});

pling.state("orders_view", () => ({
  query: state.appliedQuery,
  status: state.appliedStatus,
  matched: state.rows.length,
  total: state.totalOrders,
  hasMore: state.nextPage !== null,
}));
```

### Vue 2.7

```vue
<section v-scope="{ id: 'orders', label: 'Order results', role: 'list' }" class="results">
  <article v-for="order in rows" :key="order.id" v-record="{ data: order }">
    <strong>{{ order.id }}</strong>
    <span>{{ order.customer }}</span>
    <button
      v-tool="{ id: `open@${order.id}`, desc: `Open order ${order.id}`, kind: 'read' }"
      @click="openOrder(order.id)"
    >
      Open
    </button>
  </article>
</section>
```

```ts
import { onBeforeUnmount, ref } from "vue";
import { useAgentState, usePling } from "@plingjs/vue2";

const pling = usePling();
const loadedBefore = ref(0);
const off = pling.action({
  id: "load_more_orders",
  desc: "Load the next page of order results",
  kind: "read",
  available: () => (nextPage.value ? true : "All matching orders are already loaded"),
  run: () => {
    loadedBefore.value = rows.value.length;
    return loadPage(nextPage.value!);
  },
  expect: {
    desc: "At least one more order is loaded",
    check: () => rows.value.length > loadedBefore.value,
  },
});

onBeforeUnmount(off);

useAgentState("orders_view", () => ({
  query: appliedQuery.value,
  status: appliedStatus.value,
  matched: rows.value.length,
  total: totalOrders.value,
  hasMore: nextPage.value !== null,
}), { description: "Applied order search and result counts" });
```

带 `role: "list"` 的可滚动 `v-scope` 会生成两个只读探索动作：`pling_reveal_<id>` 把页面滚到该区域，`pling_scroll_<id>` 在区域内滚动。不适用时它们会从动作清单中消失。视口外的行仍通过记录 id 可寻址，所以行级动作不必在浏览器视口内才可调用。

## 三种计数

必须区分：

- `loaded`：当前页面中已有记录；
- `matched`：符合服务端筛选条件的记录；
- `total`：租户或业务范围内的全部记录。

只给 `matched` 时，模型可能把它当成 `total`；只给可见行数时，模型可能认为其他行不存在。

服务端分页应暴露一个携带稳定游标的 `load_more`。除非“跳到第几页”本身是用户任务，不要为每个页码建动作。

## 常见失败

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 模型把三行可见记录当成全部 | 没有状态与总数 | 暴露已应用筛选、`matched`、`total`、`hasMore` |
| 模型描述了一个尚未提交的搜索 | 状态读取了输入草稿 | 暴露已经应用的值 |
| 工具清单出现数百个行级动作 | 每行注册了唯一全局操作 | 用记录身份与一类折叠行级动作 |
| 视口外的行无法打开 | 该行已从 DOM 移除，或没有记录 id | 保留稳定记录；虚拟列表使用真实分页 |
| 模型反复滚动同一区域 | 没有数量或 `hasMore` 信号 | 说明是否还有更多，何时已加载完 |
| `load_more` 说成功但没有新行 | 缺少 `expect` | 检查已加载数量或新记录 id |

## 虚拟列表

只有存在于 DOM 的元素才能被 Pling 揭示。虚拟列表从未渲染的记录无法靠滚动找到。为缺失能力提供应用动作，例如 `find_order` 或 `load_order_page`，并返回结果记录。不要宣称 `pling_scroll_*` 能触达不存在的行。

## 安全边界

搜索参数不是授权。查询必须在服务端限制租户与权限。不要暴露会泄露调用方无权查看记录的总数。

## 证据

本方案的可运行源码是 `examples/demos/recipe-search-long-list/`。数据量、筛选、状态视图与分页渲染都在 `src/App.vue` 中，能直接复现“匹配数大于已渲染数”的情况。

## 本地验证

搜索 `Globex` 或切换到紧急工单，再点击“再显示 30 条”。确认助手看到的是已应用的筛选与三个计数，而不是输入框草稿；未渲染行不能靠猜测打开。

