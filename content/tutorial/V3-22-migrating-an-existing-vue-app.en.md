---
id: V3-22
title: "Migrating an existing Vue app"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Migrating an existing Vue app

An existing Vue page already contains most of what an assistant needs: validated forms, tested row handlers, permission checks, and a state model. A migration should expose those working paths. It should not create a second set of handlers beside them.

The example starts with an ordinary Todo page. Its business functions do not import Pling. The integration then adds an application plugin, names one page region, connects the existing form and row controls, and exposes a narrow read-only view. The existing layout and handlers stay in place.

## Leave the business functions where they are

The application functions remain the source of truth:

```ts
export function addTask(tasks: Task[], text: string, id: string): Task[] | null {
  const value = text.trim();
  if (!value || tasks.length >= MAX_TASKS) return null;
  return [{ id, text: value, done: false }, ...tasks];
}

export function toggleTask(tasks: Task[], id: string): Task[] {
  return tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));
}
```

These functions can be tested without a browser assistant, called from a click handler, and called from an agent action. No Pling type appears in their signatures.

Install the runtime once at the application entry:

```ts
const pling = createPling();

createApp(App)
  .use(pling.plugin)
  .mount("#app");
```

Installing the plugin only makes the runtime available. It does not expose a control or a state field. Every visible capability still needs an explicit declaration.

## Name the page region

Mark the existing work area with a stable region:

```vue
<section
  v-scope="{
    id: 'todo',
    label: copy.region,
    description: copy.regionDescription,
    role: 'main',
  }"
>
```

The region tells the agent where these operations belong. It is not a permission boundary. Availability, risk level, and confirmation are decided by each action declaration and by the execution policy.

Choose a region a person would recognise, such as the current list, dialog, or work panel. If the page contains unrelated tools with different risk, do not wrap the whole application in one region just to save a declaration.

## Connect the controls that already do the work

Start with one complete task path. In this page that path consists of the existing input, submit button, and row checkbox:

```vue
<input
  v-model="draft"
  v-tool="{ id: 'draft_text', desc: copy.draftDescription, kind: 'write' }"
/>
<button type="submit" v-tool="submitTaskAction">
  {{ copy.add }}
</button>

<li
  v-for="task in tasks"
  :key="task.id"
  v-record="{ data: task, fields: { text: task.text, status: task.done ? 'completed' : 'open' } }"
>
  <input
    type="checkbox"
    :checked="task.done"
    v-tool="{ id: `toggle@${task.id}`, desc: copy.toggle(task.text, task.done), kind: 'write' }"
    @change="toggle(task.id)"
  />
</li>
```

`v-record` gives each row a stable record id (`task.id`) and a short field set. Do not build ids from row position or visible text: sorting, filtering, and translation all change those values.

The submit action is more than a click. It has to know when the list is full and when the submitted task has actually appeared:

```ts
const submitTaskAction = computed<ToolOptions>(() => ({
  id: "submit_task",
  desc: copy.value.submitDescription,
  kind: "write",
  available: () =>
    tasks.value.length < MAX_TASKS ? true : copy.value.listFull(MAX_TASKS),
  run: () => { lastAddedId = submitDraft(); },
  expect: {
    desc: copy.value.addExpect,
    check: () =>
      lastAddedId !== null && tasks.value.some((task) => task.id === lastAddedId),
  },
}));
```

`lastAddedId` is returned by `submitDraft()` and identifies the record added by this submission. `expect` checks that id specifically, so an existing row cannot make the action look successful.

`available` keeps the action in the list but explains why it cannot run. That is more useful than silently removing it. `expect` waits for the observable result and fails with `EXPECTATION_FAILED` if the task never appears.

The add flow is intentionally two steps here because the existing form is two steps. If the product model is better served by one operation, a parameterised tool can call the same `addTask` function directly. The choice is about the business operation, not about hiding implementation from the agent.

## Expose a narrow view of the existing state

The agent needs to know what is on the page. It does not need the component's full state:

```ts
useAgentState(
  "todo_migration",
  () => ({ ...counts.value, visibleIds: tasks.value.map((task) => task.id) }),
  { description: copy.stateDescription },
);
```

This view is read-only. Writes still pass through declared actions, so they use the same availability checks, policy, confirmation, and execution evidence. Keep the view bounded: counts, the active filter, and record ids are usually enough. Internal fields and sensitive values should not enter it.

## Keep a manual path and verify parity

Not every control should be exposed. The CSV export in the example is a real staff operation. It remains available to a person, has no action declaration, and is marked `data-pling-ignore`. The page only says that the export is manual; the implementation marker is not shown as user-facing copy.

`data-pling-ignore` stops automatic derivation and coverage warnings beneath that element. It is not an authorization mechanism. If the operation must never be available to an agent, leave it undeclared and enforce permissions in the application or backend as usual.

The migration test checks both paths against the same visible state:

- the original business functions still work without a Pling context;
- a person can add and complete a task through the existing form and checkbox;
- the agent's form actions update the same handlers and the same list;
- an intentionally unexposed control does not appear in the registry;
- Chinese and English descriptions describe the same operation.

Run the English example:

```bash
pnpm tutorial:dev v3-22
```

Open `http://127.0.0.1:5235/`. For Chinese, run:

```bash
pnpm tutorial:dev v3-22 --locale zh
```

Open `http://127.0.0.1:5235/?lang=zh`.

The ledger beside the Todo list marks the integration points. The assistant can fill the form, submit it, and toggle rows. The CSV export remains manual.

Run the deterministic check with:

```bash
pnpm tutorial:check v3-22
```

## Expand the exposed surface gradually

A practical migration order is:

1. Install the plugin and keep the existing tests.
2. Name one page region and expose one low-risk read operation.
3. Add one complete write path with an observable success condition.
4. Expose record-level actions after ids and field boundaries are stable.
5. Add sensitive, administrative, and bulk operations last, with explicit policy and confirmation.

This keeps the page usable at every step and makes regressions easier to locate. If the first write path works, the migration boundary is sound before more capabilities are added.

## Failure modes

**Building a second set of handlers for the agent.** Two implementations drift. Route agent actions into the existing functions and verify the visible result.

**Exposing every detected control.** A visible control can still be too risky, too broad, or unrelated to the intended task. Detection is not approval.

**Passing the whole component or store to the model.** This spends context on internal fields and increases the chance of leaking sensitive data. Expose a named read view instead.

**Using translated labels as ids.** A copy edit or locale change breaks the action. Use stable application ids and localise only the description.

**Treating `data-pling-ignore` as a security boundary.** It only suppresses declaration and coverage discovery. Authorization still belongs in the action policy and the backend.
