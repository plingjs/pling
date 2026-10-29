---
id: RCP-02
title: "Table rows and batch actions"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Table rows and batch actions

A table is not “a list of buttons”. The model needs to identify the row, read the fields that determine the decision, call a row action, and understand what the current selection means. Batch actions add a second problem: the operation is about a set, not a single record.

## Runnable page

The order table below keeps stable record ids, a selected set, and batch approval on one business page. A stale selection cannot silently move to a different row after the filter changes.

<DemoPlayground id="recipe-table-batch" />

From the repository root:

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-table-batch/`. The page source and walkthrough are in `examples/demos/recipe-table-batch/`; the recipe needs no backend service and keeps state in the current tab.

## The business task

The user says:

> “Approve the three selected orders, then reject SO-1042 because the customer cancelled.”

The page must expose:

- the table region;
- each order as a record with `id`, customer, amount, and status;
- row actions with stable ids;
- a selected set and a batch action;
- state that reports total, visible, and selected counts.

The model must not guess row ids from positions, and it must not receive 200 individual batch buttons.

## Declarations

### Vue 3

```vue
<template>
  <section v-scope="{ id: 'orders', label: 'Orders', role: 'list' }">
    <tr v-for="order in visible" :key="order.id" v-record="{ data: order }">
      <td>{{ order.id }}</td>
      <td>{{ order.customer }}</td>
      <td>
        <button v-tool="{ id: `approve@${order.id}`, desc: `Approve ${order.id}` }" @click="approve(order.id)">
          Approve
        </button>
        <button v-tool="{ id: `reject@${order.id}`, desc: `Reject ${order.id}`, kind: 'danger' }" @click="reject(order.id)">
          Reject
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
}), { description: "Current order filter and selection counts" });

useAgentTool({
  id: "approve_selected",
  desc: "Approve every currently selected order",
  kind: "write",
  available: () => (selected.value.size ? true : "No orders are selected"),
  run: () => approveMany([...selected.value]),
  expect: {
    desc: "The selected orders are no longer pending",
    check: () => [...selected.value].every((id) => statusOf(id) === "approved"),
  },
});
```

### React

```tsx
const row = usePlingRecord({ data: order });
const approve = usePlingTool<HTMLButtonElement>({ id: `approve@${order.id}`, desc: `Approve ${order.id}` });

useAgentTool({
  id: "approve_selected",
  desc: "Approve every currently selected order",
  kind: "write",
  available: () => (selected.size ? true : "No orders are selected"),
  run: () => approveMany([...selected]),
});

usePlingState("orders_view", () => ({
  filter,
  visible: visible.length,
  total: orders.length,
  selected: selected.size,
}), { description: "Current order filter and selection counts" });
```

### Vanilla / jQuery

```ts
pling.scope(table, { id: "orders", label: "Orders", role: "list" });
pling.record(rowElement, { data: order });
pling.tool(approveButton, { id: `approve@${order.id}`, desc: `Approve ${order.id}` });

pling.action({
  id: "approve_selected",
  desc: "Approve every currently selected order",
  kind: "write",
  available: () => (selected.size ? true : "No orders are selected"),
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
      desc: "Approve every currently selected order",
      kind: "write",
      available: () => (selected.size ? true : "No orders are selected"),
      run: () => approveMany([...selected]),
    });
    onBeforeUnmount(off);
  },
});
```

The template uses `v-record="{ data: order }"` and `v-tool="{ id: \`approve@${order.id}\`, desc: ... }"` on each row.

## Execution and verification

1. The user selects rows. State reports `selected: 3`.
2. The model calls `approve_selected`.
3. The batch function updates the business state.
4. `expect` waits until every selected order is approved.
5. The next snapshot shows new statuses, and `selected` is either cleared or still reported, depending on the page's behavior.

If the batch partially succeeds, return the real result. Do not collapse a partial failure into “approved”.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| The model addresses the wrong row | Row action id uses an index | Use the business key |
| The prompt contains hundreds of actions | Each row is a separate global action | Use records plus row actions; rely on folding |
| Batch action uses a stale selection | `run` captured the array at declaration time | Read the current selection inside `run` |
| Batch action is available with zero selection | No `available()` predicate | Return a reason string |
| An offscreen row cannot be approved | The row action is hidden but not addressable by record | Keep the record id and let the adapter reveal it; see [long lists, scrolling, and offscreen actions](/vue/long-lists-scrolling-and-offscreen-actions) |
| A delete looks like a read | `kind` is omitted and defaults to `write` | Mark destructive actions `danger` and add confirmation |

## Security boundary

Selection is a UI concept, not an authorization decision. The batch function must re-check that the current user may approve each order. A record id supplied by the model is a reference, not proof of permission.

Use `kind: "danger"` for destructive batch actions and require confirmation. For very large sets, prefer an explicit preview: show the count and a sample before executing.

## Evidence

The runnable source for this recipe is `examples/demos/recipe-table-batch/`. Its `src/App.vue` contains the records, selected set, state view, and batch tool together, so each part can be read against the text above.

## Local verification

Select two rows and ask the assistant to approve them. Change the filter and try to reuse the old selection. Stale ids should be ignored, and the result should name the rows that were actually processed instead of reporting a generic success.
