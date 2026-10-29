---
id: J-05
title: "Imperative actions for dynamic DOM"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Imperative actions for dynamic DOM

A browser page replaces nodes all the time: a row is deleted, a table is refreshed, a dialog is rebuilt, or a list is rendered from a new server response. In a component adapter, the component lifecycle normally tells the adapter when to unbind. In a plain DOM application, that lifecycle belongs to your code.

The Vanilla adapter therefore returns an unsubscribe function from every `pling.scope()`, `pling.record()`, and `pling.tool()` call. The page must keep those functions with the node they describe.

## Give every row its own declaration set

The example keeps a map from task id to the row and its cleanup functions:

```ts
const rows = new Map<string, { element: HTMLLIElement; cleanups: Array<() => void> }>();

function mountRow(task: Task): HTMLLIElement {
  const row = document.createElement("li");
  const check = document.createElement("button");
  const remove = document.createElement("button");

  const rowCleanups = [
    pling.record(row, { data: task, label: `Task: ${task.text}` }),
    pling.tool(check, { id: `toggle@${task.id}`, desc: copy.toggleDesc(task.text) }),
    pling.tool(remove, { id: `remove@${task.id}`, desc: copy.removeDesc(task.text), kind: "danger" }),
  ];

  rows.set(task.id, { element: row, cleanups: rowCleanups });
  list.append(row);
  return row;
}
```

The declaration is tied to the row's stable business id. The DOM node is not used as the identity of the task.

## Remove the declarations before the node

Removing a row must clean up its record and actions before the element disappears:

```ts
function removeTask(id: string): void {
  const entry = rows.get(id);
  if (!entry) return;

  for (const cleanup of entry.cleanups.reverse()) cleanup();
  rows.delete(id);
  entry.element.remove();
  tasks.splice(tasks.findIndex((task) => task.id === id), 1);
  syncSummary();
}
```

The order matters. If the node is removed first, the adapter can still unregister by reference, but a page that replaces a whole list without calling cleanup will leave records and actions in the registry that no user can reach. The next model turn would then see controls that no longer exist.

## Replacing the whole list

When a server response replaces every row, dispose the old row set and bind the new one:

```ts
function replaceTasks(next: Task[]): void {
  for (const entry of rows.values()) {
    for (const cleanup of entry.cleanups.reverse()) cleanup();
  }
  rows.clear();
  list.replaceChildren();
  tasks.splice(0, tasks.length, ...next);
  tasks.forEach((task) => list.append(mountRow(task)));
}
```

Do not merely assign `list.innerHTML = ...`. That destroys the old nodes without giving the page a chance to remove the old declarations. If you must use `innerHTML` as an initial render step, bind after it and keep the resulting cleanup functions.

## Why not derive actions from every button?

The adapter can optionally derive a limited set of low-confidence actions from visible controls, but it is off by default. A button with the text “Remove” does not tell the page whether it removes the current row, clears a filter, or opens a dialog. Explicit declarations keep the operation, the record, and the risk level under the application's control.

Dynamic rendering does not change that rule. Rebind an explicit declaration when the node is recreated.

## Run the example

```bash
pnpm tutorial:dev j-05
```

Open `http://127.0.0.1:5270/`, or use `--locale zh` and `http://127.0.0.1:5270/?lang=zh`.

```bash
pnpm tutorial:check j-05
```

The test removes a row through `remove@t2` and verifies that the row, its record, its toggle action, and its remove action all disappear from the registry. It also confirms that adding and toggling still work after a removal.

## Common failures

**Reusing a cleanup function for a new node.** Unsubscribing the old node does not register the new one. Keep the two operations separate.

**Storing only one cleanup per task.** A row usually has a record, several controls, and possibly a scope. Return all of them from the row's mount function.

**Using an array index as the action id.** After a deletion, the same id can refer to a different task. Use the business id.

**Forgetting the initial bind.** Dynamically generated rows and server-rendered rows both need a declaration. If the page starts with HTML, run the binder after the markup exists.

Next: [Records and tables](/vanilla/records-and-tables).
