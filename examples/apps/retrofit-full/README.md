# Full retrofit: a normal order workbench

This is the second retrofit fixture. It starts with a conventional Vue order
desk, then adds Pling without replacing the application architecture. The final
page has an in-page assistant and an optional external Agent Surface.

The two runnable pages are intentionally separate:

| Page | Runtime | What it proves |
| --- | --- | --- |
| `/baseline/` | Plain Vue | Search, filtering, approval, notes, and deletion work without Pling |
| `/` | Vue + Pling | The same operations are declared, scoped, auditable, and optionally exposed externally |

Both pages share `src/shared/orders.ts`, `src/shared/copy.ts`, and
`src/shared/app.css`. The baseline is not a mock: it loads the same seed data
and calls the same pure business functions.

## Run it

From the repository root:

```bash
pnpm --filter @plingjs/example-retrofit-full dev
```

Open:

- baseline: `http://127.0.0.1:5231/baseline/?lang=zh`
- integrated: `http://127.0.0.1:5231/?lang=zh`

The dev script starts or reuses the example model gateway. The browser calls
`/api/agent/v1`; provider credentials never enter the Vite bundle.

## The retrofit, one decision at a time

### 0. Baseline first

`src/baseline/App.vue` is an ordinary application component. It contains the
real queue, metrics, filters, search, modal note editor, approval/reopen logic,
and deletion. No Pling dependency is imported by `src/baseline/main.ts`.

The first review question is not “what can the agent do?” It is “does the
application already work, and which operations are genuinely safe to expose?”

### 1. Install the adapter

Reference: `src/integrated/main.ts`

```ts
const pling = createPling({
  namespace: "northstar",
  diagnostics: false,
  agent: { config: { limits: { maxTurns: 100 } }, trace: true },
});

createApp(App, { locale }).use(pling.plugin).mount("#app");
```

`trace: true` makes the request
inspector available in the built-in Activity view.

Why `namespace: "northstar"`? It prevents this application's ids from colliding
when it is embedded in a larger workspace or mixed-framework page.

### 2. Draw the regions

Reference: `src/integrated/App.vue`, `v-scope` on the order queue and modal.

```vue
<section v-scope="{ id: 'order_queue', role: 'main' }">
<div v-scope="{ id: 'order_records', role: 'list' }">
<section v-scope="{ id: 'order_detail', role: 'dialog' }">
```

Why: a flat tool list loses the meaning of “queue versus detail”. A dialog is a
different region, not a cosmetic overlay. When it is open, controls behind it
should be treated as covered or unavailable, not silently operated.

### 3. Declare actions, not selectors

Reference: every `v-tool` in `src/integrated/App.vue`.

The declarations fall into three groups:

| Group | Examples | Kind |
| --- | --- | --- |
| Search and filtering | `order_search`, `filter_high` | write (view state only) |
| Navigation | `open_order@SO-2041`, `close_order` | write (dialog state) |
| Business writes | `approve@SO-2041`, `reopen@SO-2044`, `orders.set_note` | write |
| Destructive operations | `delete@SO-2041` | danger |

Why stable ids such as `approve@SO-2041` matter: the same id appears in the
agent request, the execution trace, tests, allowlists, and audit records. A
generated id that changes whenever Vue rerenders makes those guarantees
impossible.

Why kind matters: `danger` is the default approval boundary. It is not a
decoration. Pling treats click and form primitives as writes at minimum, so a
filter can be low risk without pretending it is a read. A destructive action
mislabeled as `write` still skips that boundary and fails review.

### 4. Declare row records

Reference: the `v-record` on each order card.

```vue
<article v-record="{
  data: order,
  id: order.id,
  label: `${order.id} · ${order.customer}`,
  fields: { customer, amount, status, risk, owner, note }
}">
```

Why: the model needs to identify the row a tool belongs to. `delete@SO-2041`
means nothing without the customer, amount, and note attached to `SO-2041`.

The field list is deliberate. If this were a real order desk, a provider token,
card number, or internal fraud score should not be added just because it exists
in the component object.

### 5. Expose a bounded view of the queue

Reference: `useAgentState("order_queue_view", …)`.

The state contains the active filter, query, visible count, total, pending,
approved, high-risk count, and selected record id. It does not expose the whole
store or component instance.

Why: records answer “what rows exist”. State answers “which slice is visible,
and what is the overall queue?” A model that sees only three filtered rows must
know whether those are all orders or a narrow view.

### 6. Make note editing one operation

Reference: `useAgentTool({ id: "orders.set_note", … })`.

The manual UI has three steps: open the dialog, edit the textarea, click Save.
The assistant should not reproduce those three steps. It receives one business
tool:

```ts
useAgentTool({
  id: "orders.set_note",
  kind: "write",
  params: [orderId, note],
  run: ({ record, note }) => updateOrderNote(record, note),
});
```

Why: an operation should be one tool when its business meaning is one operation.
This reduces model errors, keeps traces readable, and prevents an agent from
leaving a dialog half-open.

The note field and manual Save button are intentionally not separately exposed
as agent tools. They remain human UI. This is also why `diagnostics: false` is
set in this example: not every interactable control is meant to be an agent
capability.

### 7. Add the in-page assistant

Reference: the `<AgentDock />` at the end of the integrated component.

The dock receives the explicit action registry. It cannot operate a selector
that was never declared. The same `orders.set_note` tool is available whether
the detail modal is open or closed because it is a business operation, not a
DOM script.

### 8. Open a narrowed external Surface

Reference: `useSurfaceGateway` and `SurfaceAccessPanel` in the integrated
component.

The external allowlist is deliberately smaller than the page's full capability
set:

```ts
const EXTERNAL_SCOPE = [
  "northstar/orders.set_note",
  "northstar/open_order@",
  "northstar/close_order",
  "northstar/order_search",
  "northstar/filter_high",
  "northstar/reset_filters",
];
```

The allowlist uses fully qualified ids because the page mounts with
`namespace: "northstar"`. The short ids in the component remain readable; the
namespace is applied once at the adapter boundary. `surface.config.json` and
`retrofit/capabilities.json` must use the same qualified form, and
`test/external-scope.test.ts` fails if the three drift apart.

Approval and deletion are absent. An external Agent can read the queue, open an
order, and update a note. It cannot approve or delete an order, even if it
guesses the id. The page remains the authority for those operations.

Start the local reference gateway in a separate terminal:

```bash
SURFACE_CONFIG="$(pwd)/examples/apps/retrofit-full/surface.config.json" \
SURFACE_ADMIN_TOKEN="$(openssl rand -hex 32)" \
pnpm surface:dev
```

Then open **External access** in the integrated page, connect, and copy the
generated Codex command. Keep the page open while the Agent is connected.

Why the gateway sits between the page and the Agent: the browser keeps a
WebSocket session with a narrow page token; the Agent receives a separate
bearer token and an MCP endpoint. The Agent never receives the page's cookie,
the gateway admin token, or a generic `click(selector)` escape hatch.

For a real deployment, use the BFF mode rather than the public-demo endpoint:
the application authenticates the user, creates the page session on the server,
and keeps the gateway's admin token server-side.

## Change map

| Change | Main location | Reason | Risk |
| --- | --- | --- | --- |
| Adapter install | `src/integrated/main.ts` | Create runtime and install directives | low |
| Region tree | `v-scope` declarations | Give actions a page structure | low |
| Stable action ids | `v-tool` declarations | Reproducible traces and allowlists | low |
| Risk levels | `kind` on writes/danger | Drive confirmation and review | high if mislabeled |
| Row records | `v-record` on order articles | Let the model identify real rows | medium if fields are too broad |
| Bounded state | `useAgentState` | Explain filters and totals | low |
| Function tool | `orders.set_note` | One business operation, one tool | medium |
| Assistant | `<AgentDock />` | Human conversation surface | low |
| External Surface | `useSurfaceGateway` | Narrow capability exposure | high; review allowlist |

## Verification

```bash
pnpm --filter @plingjs/example-retrofit-full test
pnpm --filter @plingjs/example-retrofit-full typecheck
pnpm --filter @plingjs/example-retrofit-full build
```

Manual checks:

1. `/baseline/` works with Pling absent and the gateway stopped.
2. `/` allows every manual operation before the assistant is used.
3. Ask “把 Globex 的备注改成‘客户确认周五回电’” and inspect Activity. The trace
   should show one `orders.set_note` call, not a sequence of DOM clicks.
4. Ask to delete an order. The confirmation gate should identify it as a
   danger action and show the exact order id.
5. Open the detail dialog, then ask the assistant to change another order's
   note. The function tool should work without moving the dialog.
6. With the local gateway running, connect an external client. `describe` must
   list only the six capabilities in `EXTERNAL_SCOPE`; approval and deletion
   must be absent.

## Automation boundary

`retrofit/capabilities.json` is the machine-readable review contract for this
project. It is read-only. A scanner or Codex skill may propose additions, but it
must not apply them without review.

The review is intentionally staged:

- low-risk view actions can be reviewed in a group;
- writes need stable ids and a business-level tool definition;
- danger actions need a named human reviewer and a browser smoke test;
- external exposure is reviewed separately from internal assistant access;
- authentication, sensitive values, approvals, and permission changes stop the
  pipeline until a person resolves them.

This example is a better fixture for automation than a greenfield app because
the baseline, the final state, and the capability manifest can all be compared.

## Known limits

- Orders live in memory and reset on reload.
- The modal's manual Save button remains a human control; agent writes use the
  single `orders.set_note` tool.
- The public-demo Surface path is for local demonstration. Production must use
  an authenticated BFF page session and replace the gateway's in-memory stores.
- The example does not model tenant authorization. A real order desk must check
  every record against the signed-in user's tenant and permissions.
