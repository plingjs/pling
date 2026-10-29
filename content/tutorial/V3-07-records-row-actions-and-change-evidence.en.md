---
id: V3-07
title: "Records, row actions, and change evidence"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Records, row actions, and change evidence

The previous chapter answered where an action lands. A list introduces two additional questions: how the model knows what each row represents, and how an execution result proves that the intended row changed. Exposing every row checkbox and delete button as a separate action makes the action list grow with the data; an element id alone does not tell the model which business record it is operating on.

This chapter addresses the **data representation of page objects** and **observable evidence for execution**. Actions can operate on a declared record rather than only on a DOM element; repeated row actions are folded into one tool with a `record` argument; and after execution, the framework compares before-and-after snapshots and reports visible changes to fields, records, and actions.

The two concepts are **record projection** and **change evidence**. They address different questions: records identify the object of an operation, action folding limits context size, and change evidence describes what became visible after execution. None of them replaces authorization, a success expectation, or transactional semantics.

## Problem and goal

First, the action list still grows with the number of rows. Three tasks with a checkbox and a delete button produce six row-level action ids. A hundred tasks produce two hundred. Sending all of them to a model is wasteful, and truncating them makes the page look incomplete.

Second, an id such as `toggle@t2` says which element to operate, but not what `t2` means. The model can click the second checkbox without knowing that it belongs to “Book the design review” or that the task is still open. A user normally asks for an operation by describing the data, not by naming an internal element id.

This chapter adds two pieces to the same Todo application:

- `v-record` exposes the data for each row;
- row actions with a shared id prefix are folded into one model-facing tool with a `record` argument.

It then shows the result that closes the remaining loop: after an action runs, the framework compares the page before and after and returns **change evidence**. That evidence distinguishes “the action was invoked” from “a visible part of the page changed”.

The business state and operations remain unchanged. The new integration code is one record declaration per row and the two row action declarations on the existing controls. After this chapter, the reader should be able to explain what records, action folding, and change evidence answer, and what they do not prove.

## Declare records the agent may read

Each task is already a plain object with an `id`, text, completion state, and priority. The list item becomes a record with one directive:

```vue
<li
  v-for="task in visibleTasks"
  :key="task.id"
  v-record="{
    data: task,
    fields: {
      text: task.text,
      status: task.done ? 'completed' : 'open',
      priority: priorityLabel(task.priority),
    },
  }"
>
```

The record id is `task.id` (`t1`, `t2`, …). The agent sees a separate, small view of the row:

```text
t1: text Review the launch checklist; status open; priority Today
t2: text Book the design review; status open; priority Soon
t3: text Send the customer follow-up; status completed; priority Later
```

The short form is also valid:

```vue
<li v-for="task in tasks" :key="task.id" v-record="task">
```

It takes the id from `task.id` (or `task.key`) and exposes every other property. The explicit form is used here because raw values are not always useful to a model. `status: 'open'` is easier to interpret than `done: false`, and the display label `Soon` is more informative than the internal enum `soon`.

The rule is deliberate: Pling reads declared data; it does not scrape the text inside the row. DOM scraping would turn visual formatting into facts, lose the real types, and sometimes read information that was never meant to leave the page. If a field affects the agent's decision, expose it. If it does not, leave it out.

The declaration registers the row, while its fields are read when the snapshot is assembled. A changed completion state or priority is therefore visible on the next turn without re-registering the row. Replacing the object with a different id does re-register it.

## Fold row actions

The checkbox and the delete button already exist. They only need action ids that encode both the operation and the row:

```vue
<input
  type="checkbox"
  v-tool="{
    id: `toggle@${task.id}`,
    desc: `Mark “${task.text}” as ${task.done ? 'open' : 'completed'}.`,
    kind: 'write',
  }"
  :checked="task.done"
  @change="toggleTask(task.id)"
/>

<button
  type="button"
  v-tool="{
    id: `remove@${task.id}`,
    desc: `Delete “${task.text}”. This cannot be undone.`,
    kind: 'danger',
  }"
  @click="removeTask(task.id)"
>
  ×
</button>
```

The ids are `toggle@t1`, `toggle@t2`, `remove@t1`, and so on. The `@` is a convention understood by the framework: everything before the final separator is the action template, and the suffix is the record id.

Registration still contains every element-level id. That is necessary for exact execution, permissions, and audit. The change happens in the model-facing projection: when at least two actions share a template and those record ids exist, Pling emits one tool instead of one tool per row.

Folded tools have an additional required `record` parameter:

```text
toggle(record)
  Mark “{record}” as open or completed.
  record: one of t1 / t2 / t3

remove(record)
  Delete “{record}”. This cannot be undone.
  record: one of t1 / t2 / t3
```

The action count becomes proportional to the number of operation types, not the number of rows times operation types. A hundred rows with the same two operations still produce two row-action tools.

Two conditions are intentional. A template is not folded when only one row uses it, because a direct id is shorter. It is also not folded without records, because `record` must refer to data the model has actually seen. The row declaration supplies that identity; the action id alone is not treated as a source of business data.

## Select and invoke a record

The user can now ask:

```text
Mark “Book the design review” as completed.
```

The model reads the record list, finds that the phrase belongs to `t2`, and calls the folded tool:

```json
{ "record": "t2" }
```

The protocol layer maps that call back to the exact registered action `toggle@t2`. The executor uses the same permission gate, target resolution, visibility check, and event path as before. Folding changes the shape of the model interface, not the implementation of the operation.

This separation matters for audit. The model chooses among business records; the framework and application still act on a precise element-level action. Logs can retain `toggle@t2`, while the user sees the task text that made the choice meaningful.

The `record` value must come from the current record list. The model should not guess `t7` because the page contains ten rows, and it should not derive a record id from a display position. If a target is not visible because of scrolling, later chapters address discovery and long lists; this chapter only establishes that the reference must already be known.

## Generate change evidence

Executing the call above returns more than `{ ok: true }`. The executor captures a snapshot before the action, waits for the page to settle, captures another snapshot, and compares the parts the model can see. A successful toggle returns relevant evidence like this:

```json
{
  "changed": {
    "observed": true,
    "records": {
      "added": [],
      "removed": [],
      "updated": [{ "id": "t2", "fields": ["status"] }],
      "reordered": false,
      "omitted": { "added": 0, "removed": 0, "updated": 0 }
    }
  }
}
```

Deleting `t3` reports both the missing row and the actions that vanished with it:

```json
{
  "changed": {
    "observed": true,
    "records": {
      "added": [],
      "removed": ["t3"],
      "updated": [],
      "reordered": false,
      "omitted": { "added": 0, "removed": 0, "updated": 0 },
      "total": { "from": 3, "to": 2 }
    },
    "actions": {
      "added": [],
      "removed": ["toggle@t3", "remove@t3"],
      "omitted": { "added": 0, "removed": 0 }
    }
  }
}
```

Adding a task reports `records.added` with the new id. A filter or search may primarily report changes to the action list, because the set of rows that can be operated on has changed.

The payload is intentionally narrow. `updated` lists field names rather than old and new values, and each collection is capped at five items with an `omitted` count. This is enough for an agent to verify that the intended row changed, without turning every action result into a second copy of the page.

The executor takes evidence **after** the adapter's `settle` step. This matters for Vue: a list update caused by `v-for` is not necessarily reflected in the DOM in the same microtask. Reading the after-snapshot too early produces false evidence — usually “no change” immediately after a successful deletion.

## Limits of change evidence

Three concepts now appear together, and they should not be merged:

| Mechanism | Question it answers | What it does not prove |
| --- | --- | --- |
| Policy / approval | May this caller attempt this action? | That the page changed. |
| `expect` | Did the declared business predicate become true? | Everything else that changed around it. |
| `changed` | Which exposed rows, actions, state, or feedback differ between two snapshots? | That the change was complete, correct, or visible to every consumer. |

`changed.observed: false` is a warning, not a failed action. A control may have run without effect, or the effect may live in data the page does not expose. The result says which case the framework can see and avoids claiming more. Read-only actions do not produce the no-change warning, because navigation and scrolling often change no records by design.

Evidence is also not transactional. If a handler adds a row and removes it before the after-snapshot, the intermediate change is invisible. If a network request finishes after the snapshot, it is outside the window. A business invariant that must hold across several resources still belongs in the application or server, not in a DOM diff.

## Evidence in execution results

The agent receives `changed` in the tool result and is instructed to use it when saying whether an action took effect. The execution record in the assistant UI shows the same result in human-readable form, for example an updated record, a removed row, or no observed change.

This closes a concrete failure mode from DOM automation. A simulated click can succeed while the underlying control is disabled, guarded by stale state, or wired to a handler that ignores the current mode. Without a before/after comparison, the agent only knows that it dispatched an event. With records and evidence, it can state what part of the page is observably different.

It can still be wrong about intent. Evidence reports a change; it does not decide whether that change is what the user wanted. The model must use the action description, parameters, and the user's request together.

## Verify the layers separately

The fixture tests do not rely on a model's prose. They check three independent layers:

1. **Declaration.** The snapshot contains `t1`, `t2`, and `t3` in page order with only the declared fields.
2. **Protocol projection.** `buildProtocol()` produces folded `toggle` and `remove` tools whose required `record` argument contains the current ids, while exact element-level ids remain available for execution.
3. **Execution evidence.** Direct execution of `toggle@t2` reports `status` as updated; `remove@t3` reports the removed row and disappeared actions; `add_task` reports the added row. A replay model then calls the folded tools with `record` values and produces the expected page state.

The distinction is useful in maintenance. A broken record declaration should not make the diff test fail for an unrelated reason, and a wrong evidence shape should not be hidden by a model answer that happens to sound correct.

## Verify the chapter example

From the repository root:

```bash
pnpm tutorial:dev v3-07
```

The script packs the framework packages, installs them into an isolated copy of the fixture, and starts Vite on port `5217`.

Manual checks:

1. Ask the assistant: `Mark “Book the design review” as completed.` The second row should become completed, and the execution record should report one updated record.
2. Ask: `Delete “Send the customer follow-up”.` The third row should disappear. The execution record should mention the removed row and the row actions that disappeared with it.
3. Ask: `Add “Draft the release note” with later priority.` The new row should appear and the result should identify the added record.
4. Use the debug view to compare the record list with the three exposed fields. There should be no hidden object properties in the model view.

## Scope and next step

- Long lists and records outside the viewport are covered later. This fixture has three visible tasks.
- Records are not a security boundary by themselves. They are a selective view; sensitive values need the later data-restriction mechanisms.
- The diff compares exposed snapshots. It does not observe hidden data, server state, or a change that finishes after the evidence window.
- It is not a transaction and does not guarantee ordering across several actions.
- A row action still needs a faithful element path or a declared `run`; records do not make an unsafe target safe.
- The example uses local component state. Reading a Pinia or Vuex store is a separate state-exposure concern, not a replacement for row declarations.

The next chapter, [Function-level tools](/vue/function-level-tools), covers business operations that have no useful DOM element to click. Records describe which object an operation should affect; a function-level tool is for operations whose implementation is already a function rather than a control.
