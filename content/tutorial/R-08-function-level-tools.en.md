---
id: R-08
title: "Function-level tools"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Function-level tools

The previous chapter gave the agent a way to identify a task by record id and inspect the difference between two exposed page states. Every action still belonged to a real control: a form, a checkbox, a delete button, or a menu item.

Applications also contain operations without a matching control. A page may support marking every open task complete without offering a bulk button; the capability may exist for a mobile flow, a command-line client, or another interface and remain reachable only through code. The agent should be able to use that capability without pretending that the page contains a clickable element.

A **function-level tool** is the declaration for such an operation. Its implementation is an ordinary application function rather than a DOM interaction. It keeps the same action id, policy check, executor, and receipt shape as every other action. The only difference is that it has no target element.

## An operation without a control

The Todo example still has per-row completion, deletion, filtering, and record projection. It has no “complete all” button. The new business operation is simply to mark every open task as completed.

One possible shortcut is to add a hidden button, attach a tool to it, and let the agent click it. That moves the problem into harder-to-maintain territory:

- the action claims to operate on an element that a person cannot see or reach;
- visibility, obstruction, and scrolling rules now apply to an artificial target;
- the page gains a control that exists only for the agent, including its keyboard and accessibility surface;
- a change to the button's styling or event handling can break the tool even when the business function has not changed.

The semantic problem is more important. The model should see “complete every open task”, not “click a hidden button”. If the page does not expose that control, the capability layer should not invent it.

## Keep the existing business function

Manual interaction remains unchanged. `toggleTask`, `removeTask`, filtering, and form submission still use the original React state and event handlers. The new bulk operation changes the same `tasks` array:

```tsx{1-13}
const tasksRef = useRef(tasks);
tasksRef.current = tasks;

function completeOpenTasks(): number {
  const current = tasksRef.current;
  const openTasks = current.filter((task) => !task.done);
  const next = current.map((task) =>
    task.done ? task : { ...task, done: true }
  );
  tasksRef.current = next;
  setTasks(next);
  return openTasks.length;
}
```

The function has one job: find the open tasks, update them, and return the number that changed. It does not click anything, and it does not copy the page structure into a second state store.

The extra `tasksRef` is a React timing detail, not a framework requirement. A callback registered by a declaration can still run after a component has rendered again. If it captures one particular rendering's `tasks` array, availability and the success predicate may read stale state. The ref points at the current collection on every render; the bulk function also writes the next array into the ref before calling `setTasks`, so the success predicate can inspect the business state immediately. React and the framework's settle step still determine when the DOM commits.

## Declare the action with `useAgentTool`

Once the business function exists, register it as an action:

```tsx{1-16}
useAgentTool({
  id: "complete_open_tasks",
  desc: copy.completeOpenDesc,
  kind: "write",
  available: () =>
    tasksRef.current.some((task) => !task.done)
      ? true
      : copy.completeOpenNone,
  run: () => ({ completed: completeOpenTasks() }),
  expect: {
    desc: copy.completeOpenExpect,
    check: () => tasksRef.current.every((task) => task.done),
  },
});
```

The declaration has no `action`, `target`, or `fidelity` field. There is no element to click, fill, press, or resolve. The framework records the action with the `call` primitive. `fidelity: "high"` means the call reaches the supplied function directly; it does not mean the business result is correct.

The fields answer different questions:

| Field | Job |
| --- | --- |
| `id` | Stable model-facing identity and the key used by the executor. It shares a namespace with element actions. |
| `desc` | Explains what the operation does. It matters more when there is no visible control to infer meaning from. |
| `kind` | `write` states that the operation changes application state; it is not authorization by itself. |
| `available` | Whether the operation is worth attempting in the current page state. |
| `run` | Calls the business implementation once and returns a bounded result. |
| `expect` | States what the application expects to observe after the call. |

This action takes no input, so it does not need `params`. If the operation needs an order number, a reason, or a filter, declare the argument as you would for an element action; the executor validates it before `run`. TypeScript types disappear at runtime and the model cannot read them, so an interface type alone is not enough.

## The same execution pipeline as element actions

“No element” does not mean “bypass the executor”. The framework still resolves the action by id, validates arguments, checks policy and confirmation, invokes `run`, waits for the success predicate, and compares the page before and after. A function-level tool gets no extra privilege and has no private `eval` or `click(selector)` escape hatch.

The differences are confined to element-specific steps. A function-level tool has no target to resolve, no native disabled state, and no element that can be clipped or covered by a dialog. `available` therefore becomes the main page-state check the developer can provide. It says whether the operation makes sense now; it does not perform tenant isolation, user authorization, or server-side validation.

When the component unmounts, the hook unregisters its action, so the capability list does not keep a function that no longer exists.

## One call, one observable outcome

`run` is the whole business call:

```tsx
run: () => ({ completed: completeOpenTasks() })
```

It does not fill a hidden input or dispatch a synthetic click. The task collection is updated directly, and the return value keeps only a count. That value becomes `data` in the execution result. Counts, short ids, and confirmations belong there; the whole task list or a full external response does not.

The success criterion belongs in `expect`:

```tsx
expect: {
  desc: copy.completeOpenExpect,
  check: () => tasksRef.current.every((task) => task.done),
}
```

The framework waits for that condition after `run`. When it holds, the receipt carries “No task remains open”; when it times out, the result is `EXPECTATION_FAILED`. That distinction separates “the function returned” from “the application reached the expected state”.

In React, do not write `expect` against a value captured by one render, and do not substitute the current filtered rows for the business state. The first may never observe the new array; the second proves only that visible rows are complete, not that every task is complete.

An example receipt looks like this:

```json
{
  "ok": true,
  "action": {
    "id": "complete_open_tasks",
    "description": "Mark every open task as completed. This changes all open records in one operation."
  },
  "expect": "No task remains open",
  "data": { "completed": 2 },
  "changed": {
    "observed": true,
    "records": {
      "added": [],
      "removed": [],
      "updated": [
        { "id": "t1", "fields": ["status"] },
        { "id": "t2", "fields": ["status"] }
      ],
      "reordered": false
    }
  }
}
```

The three layers have different uses:

- `data` is the business summary returned by the function;
- `expect` is the success condition the framework actually observed;
- `changed` is the difference between exposed records across the execution.

None of them is a server transaction receipt. If the task collection is later synchronized over the network, local state may succeed and the server may still reject the write. An application must expose a separate server acknowledgement when remote correctness matters. The change summary is also limited to declared fields; it cannot prove what happened in a database, an email service, or an audit log.

## Choosing a declaration form

The React adapter offers three forms for different situations:

| Declaration | Use it when | Consequence |
| --- | --- | --- |
| `usePlingTool` with a native interaction | A real control receives the interaction and its native behavior is reliable. | The action is bound to an element and participates in target resolution, visibility, and obstruction rules. |
| `usePlingTool` with `run` | A real control exists, but reproducing its DOM interaction would be unreliable or would split one business operation into several steps. | The action remains element-bound; the injected path performs the business function directly. |
| `useAgentTool` | The operation already exists as application logic, but no control should represent it. | There is no target, visibility check, or hover highlight. Availability is entirely declared by the developer. |

Do not use a function-level tool merely to avoid writing a clear control declaration. When a real button owns the operation, declaring that button is usually easier to understand and easier to keep aligned with what the user sees. Use the function-level form when the absence of a control reflects the product.

Compound behavior such as opening a dialog, filling several fields, and saving should be composed as a flow rather than hidden inside an opaque function. One function-level tool should represent one understandable business operation.

## Common mistakes

| Symptom | Cause | Better response |
| --- | --- | --- |
| The tool remains present when the operation is not possible | No `available` predicate, or a check of component mounting only | Check the business precondition and return a readable reason. |
| The call succeeds but its result cannot be confirmed | The function returns before the page settles, or the affected fields are not exposed | Add `expect`, expose the relevant fields, and wait for React to render. |
| A filter makes the page look fully complete | The success predicate checks the visible DOM instead of the business state | Read the current task collection, not the current list view. |
| A bulk operation makes the context grow | `run` returns every object or a complete external response | Return a count, ids, or a bounded summary. |
| `kind` is treated as permission | `write` or `danger` is assumed to decide who may call the action | Keep policy, confirmation, and server-side authorization independent. |
| A hook is called after an early return | `useAgentTool` is not at the component's top level | Keep the hook at the top level so registration follows the component lifecycle. |

The framework rejects a missing `desc`, rejects duplicate action ids, and keeps unavailable actions visible with their reason. It does not decide the business policy, and it does not treat a function result as proof that an external system accepted the change.

## Verify the example

From the repository root, start the English example:

```bash
pnpm tutorial:dev r-08
```

Open `http://127.0.0.1:5248/`. For the Chinese interface, use `pnpm tutorial:dev r-08 --locale zh` and `http://127.0.0.1:5248/?lang=zh`. The example source is in `examples/tutorials/r-08-function-level-tools`.

Check these paths:

1. Ask the assistant: `Mark every open task as completed.` The two open rows should become complete, with their record fields and visible checked state updated together.
2. Open **Activity**, then **Diagnostics**. The `complete_open_tasks` receipt should include `completed: 2`, the expectation `No task remains open`, and updates for `t1` and `t2`.
3. Ask again. The action should remain in the capability list with the declared unavailable reason instead of running a second time.
4. Reload the page, then add, complete, and delete tasks manually. Confirm that the form, checkboxes, delete buttons, and filters still behave as before.
5. Ask the assistant to add a task, then complete every open task. The new task should participate in the same record diff.
6. Inspect the tool list in diagnostics. `complete_open_tasks` should have no element target and should not be folded into a record template.

## Scope and next step

A function-level tool solves the problem of an operation without a control. It does not solve the problem of whether a control is visible. While mounted and available, the tool always exists; it has no target that can be scrolled out of view, clipped by a parent, or covered by a dialog. It is not a way to bypass the visibility rules that apply to real controls.

The next chapter returns to the element layer. It covers regions, visibility, and overlays: how a page tells the agent which area is active, which controls are clipped or covered, and which actions remain valid after a dialog opens.

Next: [Regions, visibility, and overlays](/react/regions-visibility-and-overlays).
