---
id: RCP-07
title: "Search, filters, and long lists"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Search, filters, and long lists

A long list creates two different problems. The model may not see the rows outside the viewport, and it may mistake the current filtered result for the whole data set. Adding one action per row makes the first problem worse by flooding the tool list.

The solution is not “give the model all the data”. It is to expose a stable record identity, a small description of the current view, and explicit search, scroll, or load-more operations.

## Runnable page

The ticket queue below contains 160 local records and reports total, matched, and rendered counts separately. Search, status filters, and “show 30 more” never put the whole table into context.

<DemoPlayground id="recipe-search-long-list" />

From the repository root:

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-search-long-list/`. The source and observation steps are in `examples/demos/recipe-search-long-list/`; fixture data lives in the page, so no backend is required.

## What the model needs

For a query such as “show unpaid orders for Acme and open the oldest one”, the model needs:

- the current search phrase and status filter;
- the number of matches and the total number of rows;
- whether more rows exist outside the rendered or loaded set;
- each rendered row as a record with a business id;
- one row action family, not hundreds of unique global names;
- a way to bring an offscreen region or row into view.

It does not need every invoice line, internal note, or customer address just to choose a row.

## Search as one operation

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

Two details matter. `query` and `status` are optional, so the model can change one without guessing the other. The expectation checks the applied values, not the input draft: a search box can display a new phrase while the table still shows the previous result.

## State for the current view

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

Keep the field names stable across languages. `open` is a code; the visible label may be “Open”, “待处理”, or another translation. Do not expose the unsubmitted search draft as if it controlled the table.

## Records, row actions, and scrolling

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

### Vanilla / jQuery

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

A `v-scope` with `role: "list"` and a scrollable container creates two read-only exploration actions: `pling_reveal_<id>` scrolls the page to the region, and `pling_scroll_<id>` moves within it. They disappear from the action list when they are not applicable. Rows outside the visual viewport remain addressable by record id, so a row action does not need to be “visible” in the browser viewport to be called.

## Pagination and total counts

There are three different counts:

- `loaded`: records currently present in the page;
- `matched`: records matching the server-side filter;
- `total`: all records in the tenant or business scope.

Name them explicitly. A model that receives only `matched` may treat it as `total`; a model that receives only the visible row count may assume the other rows do not exist.

For server pagination, expose `load_more` as one action with a stable cursor. Do not expose a separate action for every page number unless jumping to a page is a real user task.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| The model thinks three visible rows are the whole list | No state and no totals | Expose applied filters, `matched`, `total`, and `hasMore` |
| The model describes a search that has not been submitted | State reads the input draft | Expose the applied value |
| The tool list contains hundreds of row actions | Each row registered a unique global operation | Use record identity and one folded row-action family |
| An offscreen row cannot be opened | The row was removed from the DOM or has no record id | Keep stable records; use real pagination for virtualized content |
| The model repeatedly scrolls a region | It has no count or `hasMore` signal | Report whether more content exists and when all is loaded |
| `load_more` reports success but no row appears | `expect` was omitted | Check the loaded count or the new record id |

## Virtual lists

Pling can reveal an element only if it exists in the DOM. A virtual list that never renders a record cannot be found by scrolling. Provide an application action for the missing capability, such as `find_order` or `load_order_page`, and return the resulting record. Do not claim that `pling_scroll_*` can reach unreachable rows.

## Security boundary

Search parameters are not authorization. A query must be scoped to the current tenant and permissions on the server. Do not expose a total count that reveals records the caller may not see.

## Evidence

The runnable source for this recipe is `examples/demos/recipe-search-long-list/`. Data volume, filters, state view, and incremental rendering are in `src/App.vue`, which reproduces the case where matched rows exceed rendered rows.

## Local verification

Search for `Globex` or switch to urgent tickets, then show 30 more. The assistant should see the applied filter and all three counts, not the input draft; an unrendered row cannot be opened by guessing its id.

