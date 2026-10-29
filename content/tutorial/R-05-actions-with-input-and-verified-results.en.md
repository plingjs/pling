---
id: R-05
title: "Actions with input and verified results"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Actions with input and verified results

The inspector from the previous chapter made an important fact visible. When the user asked to add a task, the first request contained `composer_text` but not `composer_submit`. Only after the input had text did the second request contain the submit button. The model was being asked to reconstruct a form workflow: find the field, fill it, wait for the button to become enabled, then press it.

That integration is accurate to the page, but it is not the operation the user requested. The user asked for one task to be added. This chapter keeps the visible form unchanged and changes what the agent can call: one business action, `add_task`, replaces the two control-level actions.

## Why a form is not yet a business action

A form is a useful interface for a person. It gives the input a place on the page, keeps the submit button close to it, and lets the browser handle focus and keyboard submission. Those details do not have to become the agent's working model.

When the agent is given only the input and the button, it has to infer all of the following:

- which field belongs to the requested operation;
- whether the field must be filled before the button can run;
- whether the button is currently present and available;
- whether pressing it completed the operation.

That inference has three practical costs. One business operation can consume several tool calls. A layout change can make the declarations stale even when the business operation has not changed. And there is no single place to state the argument rules or the result the page should observe.

Moving the declaration to the form does not remove the form. It gives the agent the same entry point the page already uses: the function that adds a task.

| From the user's side | Before this chapter | After this chapter |
| --- | --- | --- |
| “Add a task called Reply to the customer.” | Fill the input, then press submit | Call `add_task` with the task text |
| Input rules | The input length and disabled state | A declared `text` parameter |
| “Can I add another?” | The button becomes disabled | `available` returns the reason |
| “Did it work?” | Infer from the changed list | An explicit `expect` result |

## Declare the operation on the form

The React change is local. The input and submit button remain ordinary React elements, and the form still handles manual submission. The two primitive declarations from the previous chapter are replaced by one declaration on the form:

```tsx{6,8-18,20-44}
const [tasks, setTasks] = useState<Task[]>(() =>
  copy.seedTasks.map((task, index) => ({ id: `t${index + 1}`, ...task })),
);
const [draft, setDraft] = useState("");
const sequence = useRef(copy.seedTasks.length);
const lastAddedId = useRef<string | null>(null);

function addTask(value: string): Task | null {
  const text = value.trim();
  if (!text || tasks.length >= MAX_TASKS) return null;
  const task = { id: `t${++sequence.current}`, text, done: false };
  setTasks((current) => [task, ...current]);
  return task;
}

function submitDraft(): void {
  if (addTask(draft)) setDraft("");
}

const addTaskRef = usePlingTool<HTMLFormElement>({
  id: "add_task",
  desc: copy.addTaskDesc,
  kind: "write",
  params: [{
    name: "text",
    label: copy.addTaskParamLabel,
    minLength: 1,
    maxLength: 80,
    pattern: /\S/,
  }],
  available: () =>
    tasks.length < MAX_TASKS ? true : copy.addTaskFullReason,
  run: (args: Record<string, unknown>) => {
    lastAddedId.current = addTask(String(args.text))?.id ?? null;
  },
  expect: {
    desc: copy.addTaskExpect,
    check: () =>
      lastAddedId.current !== null &&
      Boolean(document.querySelector(
        `[data-task-id="${lastAddedId.current}"]`,
      )),
  },
});
```

The form keeps its existing fields. Only the ref moves from the input and button to the form:

```tsx{3,5-8}
<form
  className="composer"
  ref={addTaskRef}
  onSubmit={(event) => {
    event.preventDefault();
    submitDraft();
  }}
>
  <label className="composer__label" htmlFor="new-task">{copy.newTaskLabel}</label>
  <div className="composer__row">
    <input
      id="new-task"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      autoComplete="off"
      maxLength={80}
      placeholder={copy.placeholder}
    />
    <button
      type="submit"
      disabled={!draft.trim() || tasks.length >= MAX_TASKS}
    >
      {copy.addTask}
    </button>
  </div>
</form>
```

Remove the previous chapter's `composerRef` and `submitRef`; the input and button no longer need separate Pling declarations.

Because the declaration has a `run` function, invoking `add_task` calls that function with the supplied arguments. The framework does not simulate a click on the form. A person can still type and submit normally; both paths enter the same `addTask` function.

`lastAddedId` is a ref because `run` writes it and `expect` reads it later; both callbacks need the same mutable slot. The task list itself remains ordinary React state. `usePlingTool` reads the latest `available` and `run` callbacks from the current render, so neither needs a second copy of the list.

## Describe the input before execution

`params` is the contract for the action's arguments:

```ts
params: [{
  name: "text",
  label: "Task text, 1–80 characters; it cannot contain only spaces",
  minLength: 1,
  maxLength: 80,
  pattern: /\S/,
}]
```

Those field rules are projected into a JSON Schema sent with the tool:

```json
{
  "type": "object",
  "properties": {
    "text": {
      "type": "string",
      "description": "Task text, 1–80 characters; it cannot contain only spaces",
      "minLength": 1,
      "maxLength": 80,
      "pattern": "\\S"
    }
  },
  "required": ["text"]
}
```

Parameters are required unless the declaration says `optional: true`. Validation runs before the approval decision and before `run`, so a missing `text`, an empty string, or whitespace-only text returns `INVALID_PARAMS` without opening a confirmation prompt or changing the list.

This contract is about the shape and validity of the operation's input. It is not authorization. A valid task text does not prove that this user may add a task, and a parameter rule must not be used in place of a server-side permission check.

## Connect the action to the existing business function

The declaration does not carry a second implementation of adding tasks:

```ts
run: (args: Record<string, unknown>) => {
  lastAddedId.current = addTask(String(args.text))?.id ?? null;
},
```

The manual form calls `addTask(draft)`. The agent path calls `addTask(text)` through `run`. Task id generation and insertion order stay in one place; `available` and the disabled button communicate the same precondition earlier.

`run` may be asynchronous; the framework waits for its promise before checking the result. Its return value is still not evidence that the page reached the desired state. React may not have committed the row yet, or the application may still be waiting for a request. The next sections supply the missing evidence.

## Report page preconditions

The form is still visible when the list is full, but the business operation cannot add another task. `available` makes that state explicit:

```ts
available: () =>
  tasks.length < MAX_TASKS ? true : copy.addTaskFullReason,
```

The string appears under **Unavailable** in the page snapshot. If a stale action id is executed anyway, the same reason is returned with `ACTION_UNAVAILABLE`. The model can therefore distinguish “this page has no add action” from “this action exists, but the list is full”.

`available` is a page and business precondition, not an authorization decision. At execution time, the framework also checks whether the target is disabled, hidden, covered, or outside the visible area. Region filtering is a separate exposure rule: an action outside the active region is omitted from the snapshot the model receives, but that omission is not a permission check for an already known action id. Server-side authorization remains necessary.

## Make success observable

`add_task` declares what the page should contain after the operation:

```ts
expect: {
  desc: "The new task is present in the list",
  check: () =>
    lastAddedId.current !== null &&
    Boolean(document.querySelector(
      `[data-task-id="${lastAddedId.current}"]`,
    )),
}
```

The check looks for the rendered task row, not only for the id returned by `addTask`. In React, updating state and committing the new row are different moments. After `run`, the framework polls the check for up to two seconds by default; `expect.timeout` can change the bound. If the check succeeds, the execution result includes the description above. If it never succeeds, the result is `EXPECTATION_FAILED`: the operation ran, but the page did not show the declared result.

This prevents two opposite mistakes. Treating an unverified render as success can hide a broken update. Treating it as a failed click can invite a duplicate submission. `expect` records page evidence, but it is not a server acknowledgement, an audit record, or proof that the business result is correct beyond the stated condition.

## The result also carries change evidence

Because the list rows are records, the framework can compare the page before and after the action. A successful add looks like this:

```json
{
  "changed": {
    "observed": true,
    "records": {
      "added": ["t4"],
      "removed": [],
      "updated": [],
      "reordered": false,
      "omitted": { "added": 0, "removed": 0, "updated": 0 },
      "total": { "from": 3, "to": 4 }
    },
    "actions": {
      "added": ["toggle@t4"],
      "removed": [],
      "omitted": { "added": 0, "removed": 0 }
    }
  }
}
```

`expect` answers “did the declared page condition become true?” `changed` answers the narrower question “which exposed records and actions differ between the two snapshots?” Neither replaces the other, and neither is a complete proof of business correctness. A change can match the recorded fields while still being the wrong business outcome.

## Compare the declarations in Activity

The inspector from the previous chapter remains enabled, so this change can be checked without guessing. Send a request to add one task, open **Activity**, and select **Diagnostics**.

In the model call for that request:

1. `Tools sent` contains `add_task`, with a `text` parameter and its validation rules.
2. It does not contain `composer_text` or `composer_submit`; those declarations no longer exist on the page.
3. The response contains one `add_task` call with the supplied text.
4. The next request's **Request messages** contain the tool result, including the expectation description and the record change above.

The number of model calls is not fixed. A model may answer in one step, call the action after reading the page, or stop to ask for a missing detail. What is fixed is the shape of the operation: the agent has one business action to choose, not a form sequence to reconstruct.

## Read failure results correctly

| Result | Meaning | What already happened |
| --- | --- | --- |
| `INVALID_PARAMS` | The argument is missing or violates the declared rules | Neither confirmation nor the business function ran |
| `ACTION_UNAVAILABLE` | A page or business precondition is not met | The business function did not run; the result includes the reason |
| `EXPECTATION_FAILED` | The function ran, but the declared page result was not observed | The page may have changed; retrying without checking can duplicate the operation |

This is why the declaration separates input validation, availability, execution, and observation. Collapsing them into one boolean makes it impossible to explain which part failed.

## Run and verify

From the repository root:

```bash
pnpm tutorial:dev r-05
```

Open `http://127.0.0.1:5245/`. The runnable example is in `examples/tutorials/r-05-actions-with-input-and-verified-results`; the Chinese interface uses `pnpm tutorial:dev r-05 --locale zh` and `http://127.0.0.1:5245/?lang=zh`.

Check the following:

1. Type `Reply to the customer` into the form and submit it. The task should appear at the top and the input should clear.
2. Ask the assistant: `Add “Prepare tomorrow’s agenda” to my tasks.` The result should use `add_task`, not the form controls.
3. Open **Activity**, then **Diagnostics**. In the request that performed the add, `Tools sent` should contain `add_task` and no `composer_*` action.
4. Expand **Tools sent** and confirm that `add_task` has a `text` parameter with the declared length and whitespace rules.
5. Open the next request and check its tool message for the expectation description and the new record. The list should contain the requested task.
6. Fill the list to eight tasks, then inspect the next request. `add_task` should be absent from **Tools sent** and listed under **Unavailable** with the full-list reason. An unavailable action is filtered out before the model can choose it; calling a stale action id directly would return `ACTION_UNAVAILABLE`.
7. Mark one existing task complete. The row action should still update only that record.

The manual form and the agent path now share one business operation, while the page still works as an ordinary Todo list.

## Next step

The add operation now has a stable identity, validated input, a stated availability rule, and an observable result. The next question is where the declared interaction lands in the DOM. A native input, a component wrapper, and a component with several internal controls can all expose the wrong element unless the target is chosen deliberately.

The next chapter examines real controls and custom components, including when automatic target resolution is trustworthy and when the declaration needs a more precise target.
