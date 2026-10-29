---
id: R-07
title: "Records, row actions, and change evidence"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Records, row actions, and change evidence

The previous chapter followed each interaction down to the element that actually receives it. A list adds a problem that a single control does not expose: when many rows share the same checkbox and delete button, how does the agent know which business object it is changing, and how can the result show that the intended row changed?

Three mechanisms answer different parts of that problem. A **record** describes the data in a row. A **folded row action** turns many element-level controls into one operation with a `record` argument. **Change evidence** compares the visible page before and after execution. None of them replaces authorization, a success condition, or transactional guarantees.

The earlier chapters already used a record and the folded `toggle` action in the Todo path. This chapter makes the rules explicit, adds a second row operation with a destructive outcome, and separates what each form of evidence can and cannot prove.

## Element-level declarations multiply in a list

The Todo page now has three rows. If each row exposes a completion button and a delete button as independent actions, the model receives six row actions. A hundred rows produce two hundred. The list grows with the data, while the number of operations the user can actually request remains two.

The element ids have a second problem. `toggle@t2` may tell the framework where to dispatch an event, but it does not tell the model what `t2` means. The model can click the second checkbox without knowing that the row is “Book the design review”, that it is still open, or that the user's phrase referred to that row rather than the one above it.

The page therefore needs three things:

- a stable identity and a small data view for every row;
- one model-facing operation per kind of row action, rather than one per row;
- a result that reports observable changes to the exposed data and controls.

The business behavior stays ordinary React. The row still uses component state, the same click handlers, and the same buttons. Pling adds declarations around that behavior; it does not create a second Todo store.

## Declare what each row means

Each task already has a stable `id`, text, completion state, and priority. The row component declares a record and attaches it to the list item:

```tsx{2-8,14-18,31-39}
function TaskRow({ task, copy, onToggle, onRemove }: TaskRowProps) {
  const rowRef = usePlingRecord<HTMLLIElement>({
    data: task,
    fields: {
      text: task.text,
      status: task.done ? "completed" : "open",
      priority: copy.priorities[task.priority],
    },
  });
  const toggleRef = usePlingTool<HTMLButtonElement>({
    id: `toggle@${task.id}`,
    desc: copy.toggleDesc(task.text, task.done),
  });
  const removeRef = usePlingTool<HTMLButtonElement>({
    id: `remove@${task.id}`,
    desc: copy.removeDesc(task.text),
    kind: "danger",
  });

  return (
    <li ref={rowRef} className={task.done ? "task is-done" : "task"} data-task-id={task.id}>
      <button ref={toggleRef} type="button" className="task__check" onClick={() => onToggle(task.id)}>
        {task.done ? "✓" : ""}
      </button>
      <span className="task__body">
        <span className="task__text">{task.text}</span>
        <span className={`task__priority priority--${task.priority}`}>
          {copy.priorities[task.priority]}
        </span>
      </span>
      <button
        ref={removeRef}
        type="button"
        className="task__remove"
        aria-label={copy.deleteTaskAria(task.text)}
        onClick={() => onRemove(task.id)}
      >
        ×
      </button>
    </li>
  );
}
```

The record id comes from `task.id`, producing `t1`, `t2`, and `t3`. The model sees only the fields selected in the declaration:

```text
t1: text Review the launch checklist; status open; priority Today
t2: text Book the design review; status open; priority Soon
t3: text Send the customer follow-up; status completed; priority Later
```

`usePlingRecord(task)` is the short form. It takes the id from `task.id` or `task.key` and exposes the remaining object properties. The explicit form is used here for three reasons:

- a completion boolean is less useful than a stable `open` / `completed` value;
- the model should see the human-readable priority rather than guess what `soon` means;
- fields unrelated to the operation, including future private or derived data, do not leave the page merely because they live on the same object.

The distinction between `status` and `priority` is deliberate. `status` is a stable machine value because row actions and evidence depend on it; translating it would make the same state appear different after a locale change. `priority` is a display label selected for the current interface. If application logic also needed to compare priorities, expose the stable enum as a separate field instead of parsing the label.

The declaration registers the row; it does not copy the row into a second store. The selected fields are read from the current object when a snapshot is assembled. A completion or priority change is therefore visible on the next turn without re-registering the row. Replacing the row with a different id creates a different record.

Pling never scrapes the text inside the `<li>` to infer these fields. DOM text mixes labels, formatting, and hidden content, loses the original types, and can expose information the page never intended to publish. The declaration is the disclosure boundary for row data.

## Give each row action a stable identity

The two row actions encode both the operation and the record:

```tsx{1-5,9-10}
const toggleRef = usePlingTool<HTMLButtonElement>({
  id: `toggle@${task.id}`,
  desc: copy.toggleDesc(task.text, task.done),
});

const removeRef = usePlingTool<HTMLButtonElement>({
  id: `remove@${task.id}`,
  desc: copy.removeDesc(task.text),
  kind: "danger",
});
```

The ids are `toggle@t1`, `toggle@t2`, `remove@t1`, and so on. The text before the final `@` is the action template; the text after it is the record id. The two halves must refer to the same row that the declaration registered.

Stable ids matter more than short ids. A record based on an array index would move when the list is sorted or a row is deleted. The next action could then affect a different task while still using a syntactically valid id. The id used by the React `key`, the record, and the row actions should all come from the same durable business identifier.

The delete declaration uses `kind: "danger"`. This is a risk classification, not a style attribute. With the default approval policy, a destructive action asks for confirmation on every call and does not offer “always allow”. That gate is useful, but it is not a complete security boundary: the server must still authorize the deletion, and the application must decide whether the operation is allowed for the current user. The next chapters cover approval and sensitive data in more depth.

## Fold repeated actions into one model tool

Every element-level action remains registered as `toggle@t1`, `remove@t2`, and so on. Exact ids are needed for execution, permissions, audit, and replaying a specific call.

The model-facing projection is smaller. When at least two actions share a template and their suffixes match declared record ids, the protocol layer emits one tool per template:

```text
toggle(record)
  Mark the selected task as open or completed.
  record: one of t1 / t2 / t3

remove(record)
  Delete the selected task. This cannot be undone.
  record: one of t1 / t2 / t3
```

The count now grows with the number of operation types, not with rows times operations. A hundred rows with the same two controls still produce two folded tools.

A call such as `{ "record": "t2" }` is mapped back to the exact action `toggle@t2`. The same permission check, availability check, target resolution, and event path run as for a direct call. Folding changes the interface presented to the model, not the implementation of the operation.

Folding has two deliberate limits. One row using a template is not folded, because a direct id is shorter. A template is also not folded without record ids, because `record` must refer to data the model has actually seen. An action id alone is not treated as a source of business identity.

The distinction is visible in an audit trail. The model chooses a business record; the framework executes a precise element-level action. Logs can retain `remove@t3`, while the user-facing explanation can say “Delete *Send the customer follow-up*”.

## Record what visibly changed

A successful execution result contains more than `{ ok: true }`. The executor takes a snapshot before the action, waits for the page to settle, takes another snapshot, and compares the exposed data.

Completing `t2` produces evidence like this:

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

Deleting `t3` reports both the missing row and the row actions that disappeared with it:

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

Adding a task reports its new id under `records.added`. A search or filter may primarily change `actions`, because a different set of rows can now be operated on.

The payload is intentionally narrow. `updated` lists changed field names rather than copying old and new values. Added, removed, and updated collections are capped at five entries, with an `omitted` count for the remainder. That is enough to confirm the intended row changed without turning every tool result into a second copy of the page.

Evidence is captured after the adapter's settle step. React state updates and DOM commits are not instantaneous, and a target component may update on a later tick. Reading the after-snapshot too early produces false evidence, usually “no change” after a successful operation.

## Keep three guarantees separate

Records, folded actions, and diffs make an operation easier to observe, but they do not merge three different safety questions:

| Mechanism | Question it answers | What it does not prove |
| --- | --- | --- |
| Policy and approval | May this caller attempt this action? | That the page changed. |
| `expect` | Did the declared business condition become true? | Everything else that changed around it. |
| `changed` | Which exposed records, actions, state, or feedback differ between two snapshots? | That the change was complete, correct, or visible to every consumer. |

For a write, `changed.observed: false` is a warning rather than a failed action. The handler may have run without a visible effect, or it may have changed data the page does not expose. Read-only actions do not raise that warning for an empty diff, because navigation and scrolling often change no records by design.

Evidence is also not a transaction. If a handler adds and removes a row before the after-snapshot, the intermediate state is invisible. If a network request completes after the settle window, its result is outside the evidence. If the page never declares a field, the diff cannot report that field. A business invariant spanning several resources belongs in the application or server, not in a DOM comparison.

Finally, evidence does not establish intent. A diff can prove that a row changed; it cannot prove that the change is what the user asked for. The model still has to combine the user's request, the action description, the record fields, and the observed result.

## Inspect the projection and the result

Open **Activity**, then **Diagnostics**, after one delete. Three views answer different questions:

- **Records** should show one entry per task with only `text`, `status`, and `priority`. Object properties that were not declared should not appear.
- **Actions** should show the exact ids, including `toggle@t3` and `remove@t3` before the delete and the row actions that disappeared afterward.
- **Model calls** should show the folded `toggle` and `remove` tools, each with a required `record` property, rather than one tool definition per row.

For a delete, the confirmation prompt is part of the risk path, not part of the evidence. Approving it permits the attempt. The tool result and the next page snapshot are what show whether the attempt changed the page.

## Test the declarations, projection, and evidence separately

The fixture test checks three layers independently. This keeps a broken record declaration from being hidden by a model answer that happens to sound correct.

First, the registry snapshot must contain the records in page order with only the declared fields. Second, the protocol projection is built directly from that snapshot with `buildProtocol`:

```tsx
const protocol = buildProtocol(pling.registry.snapshot());

expect(protocol.templates.get("remove")).toMatchObject({
  template: "remove@",
  records: ["t1", "t2", "t3"],
});
```

The test also checks that the folded tool requires `record` and that no `toggle_t1`-style tool was emitted. Third, execution is tested against exact ids: `toggle@t2` reports `status` as updated, `remove@t3` reports the removed row and disappeared actions, and `add_task` reports the added row. A replay model then calls `toggle` and `remove` with record ids and produces the expected page state.

That division also reflects the runtime layering. Declaration answers what the page exposes. Projection answers what the model can call. Evidence answers what the executor observed. A failure in one layer should not be diagnosed as a failure in another.

## Run and verify the example

From the repository root, start the English interface:

```bash
pnpm tutorial:dev r-07
```

Open `http://127.0.0.1:5247/`. The source is in `examples/tutorials/r-07-records-row-actions-and-change-evidence`. For Chinese, use `pnpm tutorial:dev r-07 --locale zh` and open `http://127.0.0.1:5247/?lang=zh`.

Check the following:

1. Ask the assistant to mark “Book the design review” as completed. The second row should change state and the result should report `status` updated on `t2`.
2. Ask it to delete “Send the customer follow-up”. Confirm the destructive operation. The third row should disappear, and the evidence should mention `t3` plus the row actions that disappeared with it.
3. Ask it to add “Draft the release note” with later priority. The new row should appear under `records.added`, and its record should contain the three declared fields.
4. Open **Activity** and inspect **Diagnostics**. Confirm that the record list does not include undeclared object properties and that the model saw `toggle` / `remove` rather than one tool per row.

The model may choose different wording or combine tool calls in a different order. The trace, not the prose, is the source of truth.

## Boundaries and next step

- The example has three visible rows. Record limits and off-screen rows are addressed with long lists later.
- Records are a selective view, not a security boundary. Sensitive values need explicit masking or exclusion.
- A diff compares exposed snapshots. It cannot see hidden data, server state, or work that finishes after the evidence window.
- Evidence is not transactional and does not guarantee ordering across several actions.
- Folded actions still need a faithful DOM target or a declared `run`; a record does not make an unsafe target safe.
- Stable record ids are mandatory. An index-based id can silently point at a different row after insertion, deletion, or sorting.
- `danger` starts a confirmation path; it does not replace server-side authorization or business validation.

The next chapter, [Function-level tools](/react/function-level-tools), covers operations that have no useful control to click. Records identify the object of an operation; a function-level tool is for an operation whose real contract is already a function.
