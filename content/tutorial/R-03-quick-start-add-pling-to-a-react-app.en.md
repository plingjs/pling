---
id: R-03
title: "Quick start: a complete Todo agent in React"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Quick start: a complete Todo agent in React

A React page can render a perfect Todo list and still leave an agent unable to use it. The model may understand “mark the first task as completed”, but it does not know which element is first, what the row contains, or which of the page's many buttons is the intended one.

This chapter attaches Pling to an ordinary React Todo component. The task array, state setters, form handler, and rendering stay in React. The integration describes the task region, each row, and the small set of controls the agent may use.

## The request we are designing for

Consider:

> Mark the first task as completed, then add “Prepare tomorrow's agenda” to my tasks.

The agent needs three kinds of facts:

| Fact | What it looks like here | React API |
| --- | --- | --- |
| Which part of the page owns the task form and list | `todo` region | `usePlingScope()` |
| What each row is and whether it is open | `t1`: “Review the launch checklist”, open | `usePlingRecord()` |
| Which controls may be used | new-task input, submit button, row completion button | `usePlingTool()` |

Without records, the model sees controls but cannot reason about “the first task”. Without a region, related controls have no shared context. Without explicit tools, the page's undeclared buttons remain outside the agent's surface.

## Keep the Todo state in React

The business component still starts with normal React state:

```tsx
interface Task {
  id: string;
  text: string;
  done: boolean;
}

const [tasks, setTasks] = useState<Task[]>(seedTasks);
const [draft, setDraft] = useState("");

function addTask(): void {
  const text = draft.trim();
  if (!text) return;
  setTasks((current) => [{ id: nextId(), text, done: false }, ...current]);
  setDraft("");
}

function toggleTask(id: string): void {
  setTasks((current) => current.map((task) =>
    task.id === id ? { ...task, done: !task.done } : task,
  ));
}
```

The declarations below do not call `setTasks` directly for the agent. They point to the existing input, submit path, and completion buttons. A person and the agent therefore reach the same handlers.

## Declare the task region

Create a ref for the section that owns the form and list:

```tsx{1,6-11,15}
import { usePlingScope } from "@plingjs/react";

export function App() {
  const todoScope = usePlingScope<HTMLElement>({
    id: "todo",
    label: copy.regionLabel,
    description: copy.regionDescription,
    role: "main",
  });

  return (
    <main className="page">
      <section className="todo" ref={todoScope}>
        {/* header, form, and task list */}
      </section>
    </main>
  );
}
```

The region gives the model a stable name for “the Todo module”. It also provides a scope for row actions rendered inside the section. It does not hide the rest of the page from a person; it only describes which page facts belong together for the agent.

## Declare the input and submit button

The input already controls `draft`; the form already calls `addTask`. Attach refs to those elements:

```tsx{1,6-11,17-21,31-33}
import { usePlingScope, usePlingTool } from "@plingjs/react";

export function App() {
  const [draft, setDraft] = useState("");

  const composerRef = usePlingTool<HTMLInputElement>({
    id: "composer_text",
    desc: copy.composerTextDesc,
    action: "fill",
    params: [{ name: "text", label: copy.textParamLabel }],
  });

  const submitRef = usePlingTool<HTMLButtonElement>({
    id: "composer_submit",
    desc: copy.composerSubmitDesc,
    available: () => draft.trim() ? true : copy.submitReason,
  });

  return (
    <form onSubmit={(event) => { event.preventDefault(); addTask(); }}>
      <input
        id="new-task"
        ref={composerRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button ref={submitRef} type="submit" disabled={!draft.trim()}>
        {copy.addTask}
      </button>
    </form>
  );
}
```

`action: "fill"` tells Pling this is not a button to click but a field to populate. The parameter name and label become part of the tool contract the model sees.

The submit action is unavailable while the input is empty. The disabled state and the `available` callback express the same business rule; the callback gives the model a useful reason instead of silently removing the action. Filling the input re-renders the component and makes the submit action available.

The example also caps the list at eight tasks. When the list is full, submit remains unavailable even if the input contains text, and the callback returns a clear reason rather than advertising an action that cannot run.

These are still two steps. The agent fills the page's own field, then invokes the page's own submit path. A later chapter can replace that pair with one business-level action when the application has a better command for it.

## Give each row a record and an action

React has an additional constraint here: hooks must run in a stable order. Do not call `usePlingTool()` or `usePlingRecord()` from a `.map()` callback inside `App`; adding or removing a row would change the number and order of hooks in that component.

Create a child component for the row:

```tsx{1,10-15,20-24,31-38}
import { usePlingRecord, usePlingTool } from "@plingjs/react";

function TaskRow({ task, copy, onToggle }: TaskRowProps) {
  const rowRef = usePlingRecord<HTMLLIElement>({
    data: task,
    fields: {
      text: task.text,
      status: task.done ? copy.completedLabel : copy.openLabel,
    },
  });

  const toggleRef = usePlingTool<HTMLButtonElement>({
    id: `toggle@${task.id}`,
    desc: copy.toggleDesc(task.text, task.done),
  });

  return (
    <li ref={rowRef} className={task.done ? "task is-done" : "task"}>
      <button
        ref={toggleRef}
        type="button"
        className="task__check"
        onClick={() => onToggle(task.id)}
      >
        {task.done ? "✓" : ""}
      </button>
      <span className="task__text">{task.text}</span>
    </li>
  );
}

{tasks.map((task) => (
  <TaskRow key={task.id} task={task} copy={copy} onToggle={toggleTask} />
))}
```

`usePlingRecord` makes `t1`, `t2`, and `t3` readable records. The data is not copied into a second store; the record reads the current object, so completion changes are visible without re-registering the row.

The action id contains the row identity. Because the row is also a record, the framework can relate the control to that business record rather than asking the model to guess an internal element id.

## Mount the assistant

The dock stays in the page shell, outside the Todo business state:

```tsx{1,8}
import { AgentDock } from "@plingjs/react";

export function App() {
  return (
    <main className="page">
      <section className="todo" ref={todoScope}>{/* Todo UI */}</section>
      <AgentDock title={copy.dockTitle} quick={copy.quick} />
    </main>
  );
}
```

The quick prompts are conveniences for people. They send text; they do not create capabilities or bypass the execution path.

## What changed, and what did not

| Place | Change |
| --- | --- |
| Application entry | Create one `createPling()` and wrap the app in `PlingProvider` |
| Task section | Attach `usePlingScope()` |
| Task row component | Attach `usePlingRecord()` and one completion tool |
| New-task input | Attach a fill tool |
| Submit button | Attach a submit tool with availability |
| Page shell | Render `<AgentDock>` |

Unchanged: React state, `addTask`, `toggleTask`, form submission, filtering, deletion, layout, and every control without a declaration. The agent currently sees no delete or filter action.

## Run and verify

From the repository root:

```bash
pnpm tutorial:dev r-03
```

Open `http://127.0.0.1:5239/`. For Chinese, run `pnpm tutorial:dev r-03 --locale zh` and open `http://127.0.0.1:5239/?lang=zh`.

Check:

1. Ask: `Add “Reply to the customer” to my tasks.` The task appears once.
2. Open **Activity**. The run shows a fill step and a submit step, both using the page's original controls.
3. Click the quick prompt that marks the first task complete. Only that row changes.
4. Open the activity details. The record's `status` moves from `open` to `completed`.
5. Ask the agent to delete a task or apply a filter. Those actions are not declared yet.

The deterministic test for this chapter also verifies the intended surface directly: one region, three records, the input and completion actions, and no submit action before text is entered.

## Common failures

| Symptom | Likely cause | Correction |
| --- | --- | --- |
| React warns about changing hook order | A Pling hook is called conditionally or from a dynamic `.map()` in one component | Move row hooks into a child component and keep hooks at the top level |
| A ref is attached to a wrapper instead of the real control | The element that receives the ref is not the input or button | Inspect the DOM and attach the ref to the actionable element |
| Filling the input does not reveal submit | The button remains disabled, or `available` still returns a reason | Check the controlled input state and the disabled expression |
| Submit stays unavailable when the list is full | The example caps the list at eight tasks | Delete or complete a task before adding another |
| A row action affects the wrong task | The action id does not use the stable task id | Build the id from the same id used in `key` and the record |
| The assistant cannot see a delete button | It was not declared | Expected; expose it only when the business wants that capability |
| The record shows stale fields | The record reads a copied snapshot instead of the current row object | Keep the record tied to current React data |

Continue with the next React chapter when it becomes available: explicit action metadata and verified results.
