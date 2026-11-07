# Starter retrofit: a normal Todo app

This example shows the smallest useful way to add Pling to an existing Vue 3
application. It deliberately keeps two runnable pages:

| Page | Runtime | What it proves |
| --- | --- | --- |
| `/baseline/` | Plain Vue | The application works before any Pling code is loaded |
| `/` | Vue + Pling | The same business operations are exposed through explicit declarations |

The two pages share business functions, copy, and CSS. Only the entry point,
template attributes, and `createPling` setup differ. That keeps the retrofit
reviewable: a reviewer can compare the two app components without diffing an
entire project.

## Run it

From the repository root:

```bash
pnpm --filter @plingjs/example-retrofit-starter dev
```

Open:

- baseline: `http://127.0.0.1:5230/baseline/?lang=zh`
- integrated: `http://127.0.0.1:5230/?lang=zh`

The dev script reuses the example model gateway when one is already running,
otherwise it starts `examples/gateway.mjs`. The browser only calls
`/api/agent/v1`; the provider URL and key stay in `examples/.env.local`.

## The retrofit, one decision at a time

### 0. Baseline first

`src/baseline/App.vue` is a complete, ordinary Vue component. It has local
state, normal event handlers, a filter, inline editing, and destructive
actions. There are no `@plingjs/*` imports, no directives, and no assistant
surface.

Start with this file. A baseline that cannot run without the framework is not a
baseline; it is already an integration.

### 1. Install the adapter and mount the plugin

Reference: `src/integrated/main.ts`

```ts
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";

const pling = createPling({
  namespace: "daylist",
  ui: { locale: "zh-CN" },
  agent: { config: { limits: { maxTurns: 100 } }, trace: true },
});

createApp(App, { locale }).use(pling.plugin).mount("#app");
```

Why: `createPling` creates the application runtime. `pling.plugin` installs the
directives and supplies the runtime to built-in surfaces. `namespace: "daylist"`
prevents action-id collisions when the application is embedded in a larger
page.

Checkpoint: the baseline still runs at `/baseline/`, and the integrated route
renders without an assistant yet.

### 2. Declare the region before the actions

Reference: `src/integrated/App.vue`, the `v-scope` on `<main>` and `<ul>`.

```vue
<main v-scope="{ id: 'daylist', role: 'main', label: '…', description: '…' }">
  <ul v-scope="{ id: 'task_list', role: 'list', label: '…' }">
```

Why: a model needs a stable map of the page. Without a region, a flat action
list loses the distinction between the composer, the task collection, and the
summary. The region is descriptive; it does not grant permission.

Checkpoint: the page looks and behaves exactly as before.

### 3. Declare the real controls

Reference: `src/integrated/App.vue`, every `v-tool` declaration.

The first three declarations are enough for the core loop:

```vue
<input v-tool="{ id: 'new_todo_text', action: 'fill', desc: '…' }" />
<button v-tool="{ id: 'add_todo', kind: 'write', desc: '…' }">Add</button>
<button v-tool="{ id: 'toggle@t1', kind: 'write', desc: '…' }" />
```

Why: Pling does not guess capabilities from arbitrary DOM. An undeclared button
is invisible to the agent. Stable ids make tests, audit records, allowlists,
and later external Surface access deterministic.

The integrated example also declares:

- filters (`kind: "write"`) because clicking is a write primitive. They do not
  mutate business data, but the framework will not label a click "read";
- inline edit fill/save (`kind: "write"`);
- remove and clear (`kind: "danger"`) because they are destructive;
- `available` on add, so a full list returns a useful reason instead of
  advertising an impossible action.

Checkpoint: open Activity after one request. The request should contain only
the controls declared in this file.

### 4. Add records to the rows

Reference: `src/integrated/App.vue`, the `v-record` on each `<li>`.

```vue
<li v-record="{
  data: task,
  id: task.id,
  label: task.text,
  fields: { text: task.text, done: task.done },
}">
```

Why: without records, a model knows that `toggle@t1` exists but not what `t1`
means. Records carry the small, intentional view of the row: stable id, human
label, and the fields needed to choose an operation.

Do not pass the whole object by default. If a row later contains an internal
margin, an email address, or a provider token, those fields should not enter
the model request accidentally.

### 5. Expose a bounded read model

Reference: `src/integrated/App.vue`, `useAgentState("daylist_view", …)`.

The view contains the current filter, visible count, total, open, completed,
and capacity. It does not expose component internals or a store object.

Why: records answer “which tasks exist”; state answers “what slice am I looking
at, and what is the overall shape of the list?” This prevents a model from
mistaking a filtered list for the complete set.

### 6. Add the assistant surface

Reference: `src/integrated/App.vue`, the final `<AgentDock />`.

Why: `AgentDock` owns conversation, model calls, trace, and the activity view.
It does not create business actions; it operates the actions already declared
on the page. `default-open` is appropriate for this teaching example. In a
real application, use a quiet launcher or a dedicated assistant column.

Checkpoint: ask “把第一条未完成任务标记为完成，然后新增一条‘发送修订后的范围说明’”.
The agent should use `toggle@t1` and `add_todo`, not synthetic DOM clicks.

### 7. Connect model access

Reference: `examples/.env.example`, `examples/gateway.mjs`, and
`examples/apps/retrofit-starter/vite.config.ts`.

The browser sees `VITE_AGENT_BASE_URL=/api/agent/v1`. Vite proxies that path to
the local example gateway on port `5192`. The gateway reads
`PLING_UPSTREAM_BASE_URL` and `PLING_UPSTREAM_API_KEY` from the server
environment and forwards an OpenAI-compatible request.

Why: a key packaged into a frontend build is public. A real deployment must
keep the provider credential behind a same-origin proxy or BFF.

## File map

| Path | Responsibility |
| --- | --- |
| `src/baseline/App.vue` | Ordinary Vue baseline; no framework imports |
| `src/integrated/App.vue` | Same business page plus scopes, actions, records, state, dock |
| `src/integrated/main.ts` | Adapter installation and runtime configuration |
| `src/shared/todos.ts` | Framework-free business operations |
| `src/shared/copy.ts` | English and Chinese copy, including action descriptions |
| `src/shared/app.css` | Layout and visual design shared by both pages |
| `retrofit/capabilities.json` | Machine-readable review inventory for the retrofit |

## Verification

```bash
pnpm --filter @plingjs/example-retrofit-starter test
pnpm --filter @plingjs/example-retrofit-starter typecheck
pnpm --filter @plingjs/example-retrofit-starter build
```

Manual checks:

1. `/baseline/` works with the gateway stopped.
2. `/` renders the same task data and supports every manual operation.
3. Activity shows the system prompt, declared tools, real messages, and the
   resulting page evidence.
4. Deleting a task and clearing completed tasks show the confirmation gate.
5. The assistant cannot act on the summary card or any undeclared control.

## Automation boundary

The manifest in `retrofit/capabilities.json` is intentionally read-only. A
future scanner may propose entries, but it must not silently rewrite templates.

The safe order for automated work is:

1. Scan the baseline and produce a capability plan.
2. Require a human to approve every id, scope, kind, and parameter.
3. Apply one capability group at a time.
4. Run typecheck, unit tests, build, and a browser smoke test.
5. Stop for review on authentication, sensitive data, destructive actions,
   payments, or permission changes.

This example is the first fixture for that workflow: the baseline, final
component, and manifest are all visible in one place.

## Known limits

- Todo data lives in memory and resets on reload.
- The example demonstrates an in-page assistant, not external Surface access.
- There is no authentication layer; the production example owns that boundary.
