# Integration Playbook

This reference turns a normal application into a Pling-enabled application
without replacing its business architecture. Use it after choosing the
integration level in `SKILL.md`.

## 1. Pick the adapter and repository shape

| Application | Adapter | Declaration style |
| --- | --- | --- |
| Vue 3 | `@plingjs/vue` | `v-tool`, `v-scope`, `v-record`, composables, Dock |
| React 16.8+ | `@plingjs/react` | provider, ref hooks, function-tool hook, Dock |
| React 16.3–16.7 | `@plingjs/react/legacy` | provider, render-prop declarations, Dock |
| Vanilla / jQuery | `@plingjs/vanilla` | explicit `pling.tool/scope/record/state/action/dock` |
| Vue 2.7 | `@plingjs/vue2` | Vue directives plus Vue 2.7 composables |
| Vue 2.6 or earlier | `@plingjs/vanilla` | manual DOM wiring after mount; no Vue 3 Composition API |

Keep a reference baseline and apply the integration in place, or use two entry
points that share the same business functions, copy, and CSS:

```text
src/                      # production application
  shared/                 # business logic, types, API client, copy, CSS
  baseline/               # optional plain entry point without Pling
  integrated/             # Pling declarations and assistant entry
retrofit/
  capabilities.json       # reviewed capability contract
```

The baseline is evidence, not a mock. Both entry points should use the same
business operations. A visual mock that only resembles the application cannot
prove that the retrofit preserved behavior.

## 2. Establish the baseline before edits

Run the project's real commands and capture the output:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Then exercise the main workflow in a browser. Record unrelated failures and the
rollback point. Do not combine a framework upgrade, auth migration, redesign,
and Pling retrofit in one change.

## 3. Install the runtime once

The runtime creates a registry and adapter namespace. Application code should
not create a second executor or a parallel action registry.

### Vue 3

```ts
import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";

const pling = createPling({
  namespace: "northstar",
  agent: {
    config: { baseUrl: "/api/agent/v1", model: "your-model" },
  },
});

createApp(App).use(pling.plugin).mount("#app");
```

### React

```tsx
import { createRoot } from "react-dom/client";
import { AgentDock, PlingProvider, createPling } from "@plingjs/react";
import { App } from "./App";

const pling = createPling({
  namespace: "northstar",
  agent: {
    config: { baseUrl: "/api/agent/v1", model: "your-model" },
  },
});

createRoot(document.getElementById("root")!).render(
  <PlingProvider pling={pling}>
    <App />
    <AgentDock />
  </PlingProvider>,
);
```

### Vanilla

```ts
import { createPling } from "@plingjs/vanilla";

const pling = createPling({
  namespace: "northstar",
  agent: {
    config: { baseUrl: "/api/agent/v1", model: "your-model" },
  },
});

const offScope = pling.scope(document.querySelector("#orders")!, {
  id: "orders",
  label: "Order queue",
  role: "list",
});

const offTool = pling.tool(document.querySelector("#search")!, {
  id: "orders.search",
  desc: "Filter the order queue by customer or order id",
  action: "fill",
});

// Replace these with the application's own state and derived values.
const offState = pling.state("orders.view", () => ({
  query,
  filter,
  shown: visibleOrders().length,
  total: orders.length,
}));

pling.dock({ title: "Order assistant" });

// Call on teardown.
offTool();
offScope();
offState();
pling.destroy();
```

### Vue 2.7

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({ namespace: "northstar" });
Vue.use(pling.plugin);
```

For Vue 2.6 and earlier, mount first and declare through the vanilla API in a
component lifecycle hook. Clean up the returned unsubscribe functions manually.

### Demo-only limits

Repository demos may raise the loop limit to 100 turns at the entry point:

```ts
createPling({ agent: { config: { limits: { maxTurns: 100 } } } });
```

Do not change framework defaults for a production site merely to make a demo
run longer. Production should choose limits from task length, cost, and risk.

## 4. Add a namespace before ids spread

Use one namespace per application or framework island:

```ts
createPling({ namespace: "northstar" });
```

Local declarations remain readable (`orders.search`), while the effective id is
the fully qualified `northstar/orders.search`. Surface allowlists, deployment
config, manifests, traces, and tests must use the effective id. Decide the
namespace before writing external configuration; changing it later invalidates
every allowlist and audit expectation.

## 5. Write the capability contract

Inventory the application without editing it. Keep these categories separate:

| Category | Questions |
| --- | --- |
| Regions | Which sections, lists, dialogs, and toolbars explain the page? What is their nesting? |
| Actions | Which controls change view or business state? What business function runs? |
| Records | Which entities must the Agent identify? What is the stable id and minimal label? |
| State | Which filter, selection, count, or pagination explains the current view? |
| Sensitive data | Which fields, credentials, identity data, notes, or financial values must never be exposed? |

Create `retrofit/capabilities.json` for review. A practical shape is:

```json
{
  "app": "northstar-order-desk",
  "source": "src/baseline/App.vue",
  "target": "src/integrated/App.vue",
  "scopes": {
    "orders": "The order queue",
    "order_detail": "The dialog for one order"
  },
  "capabilities": [
    {
      "id": "orders.search",
      "kind": "write",
      "primitive": "type",
      "scope": "orders",
      "review": "low",
      "params": ["query"],
      "expect": "The visible rows reflect the query"
    },
    {
      "id": "orders.set_note",
      "kind": "write",
      "primitive": "call",
      "scope": "orders",
      "review": "human",
      "params": ["orderId", "note"],
      "expect": "The record note equals the submitted note"
    }
  ],
  "state": [
    {
      "key": "orders.view",
      "fields": ["query", "filter", "shown", "total", "selected"]
    }
  ],
  "external": {
    "mode": "bff",
    "allowlist": ["northstar/orders.search", "northstar/orders.set_note"],
    "excluded": ["northstar/orders.delete@", "northstar/orders.approve@"]
  },
  "forbidden": [
    "generic click(selector) or eval",
    "whole-store or whole-form exposure",
    "Agent approval of a destructive action"
  ]
}
```

The manifest is a review contract. A scanner may propose entries, but a human
must approve every id, scope, kind, parameter, and external inclusion before the
template is changed.

## 6. Declare regions, actions, records, and state

### Regions

Regions explain page structure and visibility. They are not CSS wrappers added
solely to make the model see more.

```vue
<section v-scope="{ id: 'orders', label: 'Order queue', role: 'list' }">
  ...
</section>

<section v-scope="{ id: 'order_detail', label: 'Order detail', role: 'dialog' }">
  ...
</section>
```

Use a dialog region when modal behavior matters. Controls behind an open modal
should be unavailable, and the Agent should work in the intended region rather
than guessing from a flat tool list.

### Element actions

Use an element action when the original element is the real operation and the
browser behavior is part of that operation:

```vue
<button
  v-tool="{
    id: `orders.delete@${order.id}`,
    desc: `Delete order ${order.id} for ${order.customer}`,
    kind: 'danger',
    confirm: 'always',
  }"
  @click="remove(order)"
>
  Delete
</button>
```

The business handler remains the existing handler. Pling records and invokes the
declared capability; it does not become the business implementation.

### Function actions

Use a function action when the operator thinks in one business operation but the
UI needs several steps:

```ts
// Existing application refs/functions: orders, selectedOrder, saveNote().
const lastExpectedNote = ref<{ orderId: string; note: string } | null>(null);

useAgentTool({
  id: "orders.set_note",
  desc: "Set the internal callback note for one order",
  kind: "write",
  params: [
    { name: "orderId", label: "Order id", options: orderOptions },
    { name: "note", label: "Note", minLength: 1, maxLength: 500 },
  ],
  available: () => selectedOrder.value ? true : "Open an order first",
  run: async ({ orderId, note }) => {
    const updated = await saveNote(String(orderId), String(note));
    lastExpectedNote.value = { orderId: updated.id, note: updated.note };
    return { changed: true, orderId: updated.id };
  },
  expect: {
    desc: "The order record shows the new note",
    check: () => {
      const expected = lastExpectedNote.value;
      return Boolean(
        expected &&
          orders.value.some(
            (order) => order.id === expected.orderId && order.note === expected.note,
          ),
      );
    },
  },
});
```

The important design is one tool for `set note`, not a three-tool simulation of
open → type → click.

### Records

Use a record for each row or entity the Agent must identify:

```vue
<li
  v-for="order in orders"
  :key="order.id"
  v-record="{
    data: order,
    id: order.id,
    label: `${order.id} · ${order.customer}`,
    fields: {
      customer: order.customer,
      amount: order.amount,
      status: order.status,
    },
  }"
>
```

Record ids must survive rerenders. Do not use array indexes, transient object
identity, or timestamps. Expose only fields needed for selection, explanation,
and verification.

### State

Expose a bounded read-only view, not the store:

```ts
useAgentState(
  "orders.view",
  () => ({
    query,
    filter,
    shown: visibleOrders.value.length,
    total: orders.value.length,
    selected: selectedId.value,
  }),
  { description: "The current order queue view" },
);
```

State answers “what am I looking at?”. Records answer “which entity is this?”.
Do not duplicate large records into state or use state as a write channel.

## 7. Model access belongs on the server

Never put a provider API key in a frontend build, browser storage, a Surface
capability, or a tool argument. Use a same-origin BFF or `@plingjs/server`:

```ts
import { createPlingGateway, toNodeHandler } from "@plingjs/server";

const gateway = createPlingGateway({
  upstream: { baseUrl: process.env.MODEL_BASE_URL!, apiKey: process.env.MODEL_API_KEY! },
  model: process.env.MODEL_NAME,
  authorize: async ({ headers }) => verifySignedInUser(headers),
  allowAnonymous: false,
  onAudit: (event) => audit.writeMetadata(event),
});

http.createServer(toNodeHandler(gateway)).listen(8080, "127.0.0.1");
```

The browser points at the same-origin proxy, for example `/api/agent/v1`.
Provider credentials stay on the server. The model proxy is not the Surface
Gateway: one handles model calls, the other brokers page capabilities for an
external Agent.

## 8. Add external Surface only after the page works

First verify the in-page assistant can complete the task by calling declared
capabilities. Then add external access with a smaller allowlist:

```ts
const EXTERNAL_SCOPE = [
  "northstar/orders.search",
  "northstar/order_detail@",
  "northstar/orders.set_note",
] as const;

const gateway = useSurfaceGateway({
  app: "northstar-order-desk",
  mode: "bff",
  expose: EXTERNAL_SCOPE,
  getPageSession: () => api.createPageSession(),
  approval: approvalController,
  confirm: approvalController.confirm,
});
```

The page allowlist is a ceiling, not the final authorization. The verified page
session and Agent session narrow it further; a public-demo tenant configuration
seeds the page-session scope, and the business backend still performs final
authorization. Use deployment tests to ensure the manifest, page allowlist, BFF
page-session scope, and any public-demo tenant scope do not drift.

External exposure rules:

- start read-only, then one reversible write;
- exclude approval, delete, permission, identity, payment, and bulk operations;
- do not expose a raw “open dialog / fill field / click save” sequence when the
  business operation is “set note”;
- confirm status is read-only for the Agent; it cannot approve itself;
- one page session binds one active Agent session in the reference Gateway;
- keep the page open for calls to work.

## 9. Validate change evidence

For each business write, define what “worked” means. Prefer `expect` or a
structured result that points to the changed record. Do not report success merely
because a click did not throw.

Test:

- stable ids after rerender and route changes;
- record fields after replacing a row object;
- unavailable reason when a precondition fails;
- dialog coverage makes background controls unavailable;
- danger confirmation refusal and approval;
- evidence that a write changed the expected business field;
- describe excludes blocked ids and a guessed invoke fails closed.

## 10. Common failure modes

| Symptom | Likely cause | Correct move |
| --- | --- | --- |
| Tool id works in the page but not through Surface | Namespace omitted from the allowlist | Use the fully qualified effective id |
| Agent clicks text fields and buttons independently | The business operation was modeled as UI steps | Add one function tool for the operation |
| Huge context and secret leakage | Whole store/form was exposed | Project minimal state and record fields |
| Excluded action still runs | Page and Gateway scopes are treated as independent | Intersect both; add a negative test |
| Modal action runs against the background | Dialog region/coverage not declared | Declare the dialog and verify unavailable controls |
| “Success” with no business change | No observable expectation | Add `expect` or structured result evidence |
| Third-party Agent cannot connect | Page not open, pairing expired, origin denied, or Agent token revoked | Check the lifecycle and error code before changing code |
| Sessions disappear after restart | Reference Gateway in-memory store | Use a durable control-plane adapter before production |

## 11. Automated retrofit boundary

An Agent or scanner can:

- scan routes, components, and handlers;
- propose regions, action ids, parameters, and record fields;
- draft a manifest and a diff plan;
- flag sensitive or destructive capabilities;
- add tests for declared contracts.

It must not silently rewrite templates, invent authorization, expose a whole
store, or make a destructive action executable. Require human approval for the
manifest and for every change that crosses auth, sensitive data, deletion,
approval, payment, or external exposure.

