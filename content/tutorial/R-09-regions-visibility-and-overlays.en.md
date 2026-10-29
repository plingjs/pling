---
id: R-09
title: "Regions, visibility, and overlays"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Regions, visibility, and overlays

The previous chapters gave actions stable identities and descriptions, and gave repeated row operations a record argument. The model no longer has to infer an operation from element order alone.

That is still not enough when several parts of a page contain similar controls, or when a dialog temporarily makes the rest of the page unusable. A flat action list cannot say which **Save** belongs to the task editor and which belongs to a settings form. It also cannot explain why an operation that existed a moment ago is absent from the current list.

This chapter adds two kinds of context:

- **regions** describe where an action belongs in the page structure;
- **availability** says that an action still exists but cannot be used right now, and why.

The example is a real task editor in the Todo application. It changes the task, and it makes the background page inert while it is open. Neither mechanism grants permission or replaces business validation.

## Why a flat action list is ambiguous

Consider two operations with similar purposes in different parts of an application:

```text
save              Save the current record.
save              Save the account settings.
```

Better names and descriptions help, but they do not solve the underlying problem: the model does not know which part of the page each operation belongs to. A person reads the page spatially. The model receives a list.

The Todo page shows the same problem on a smaller scale. It has an add form, a task list, filters, and bulk controls. The add action belongs to the composer, row actions belong to records, and filters belong to the view toolbar. Names are usually enough on a page this small, but structure becomes necessary as controls repeat.

An overlay adds a second problem. While the editor is open, the task list is covered and should not accept interaction. If those actions simply disappear from the snapshot, the model can reasonably conclude that the page no longer has an add form or row actions. It needs the weaker and more accurate statement: the actions still exist, but the open editor prevents their use.

The goal is therefore not to expose more controls. It is to make the existing page model more faithful:

1. actions carry a readable region path;
2. a dialog belongs to the page tree even when React renders it outside that tree with a portal;
3. covered controls remain present as unavailable, with a reason;
4. actions without a target element declare their availability explicitly.

The business functions and data model remain unchanged. This chapter adds region declarations, dialog semantics, and one availability condition.

## Describe the page as a small tree

The Todo workspace already has one region. This chapter makes its internal structure explicit:

```tsx{1-24,27-30}
const todoScope = usePlingScope<HTMLElement>({
  id: "todo",
  label: "Tasks",
  description: "The task workspace: adding, editing, filtering, and reviewing tasks.",
  role: "main",
});
const composerScope = usePlingScope<HTMLFormElement>({
  id: "composer",
  label: "Task composer",
  description: "Create a task and choose its priority.",
  role: "form",
});
const taskListScope = usePlingScope<HTMLUListElement>({
  id: "task_list",
  label: "Task list",
  description: "Visible tasks with completion, edit, and delete actions.",
  role: "list",
});
const viewControlsScope = usePlingScope<HTMLElement>({
  id: "view_controls",
  label: "View controls",
  description: "Filtering and bulk operations for the task list.",
  role: "toolbar",
});

return (
  <section ref={todoScope}>
    <form ref={composerScope}>{/* Composer controls */}</form>
    <ul ref={taskListScope}>{/* Task rows */}</ul>
    <footer ref={viewControlsScope}>{/* Filters and bulk actions */}</footer>
  </section>
);
```

`usePlingScope` returns a callback ref. Mounting the corresponding element adds the region to the page model; unmounting it removes the region. A child region normally inherits the nearest ancestor region from the DOM.

The model receives a tree similar to:

```text
## Page structure (regions)
- main "Tasks" (todo): ...
  - form "Task composer" (composer): ...
  - list "Task list" (task_list): ...
  - toolbar "View controls" (view_controls): ...
```

Actions inherit the path of the region in which they are declared. The add action therefore carries `region:Tasks / Task composer`; an edit or delete action carries `region:Tasks / Task list`; a filter action carries `region:Tasks / View controls`.

This path helps even when descriptions are similar. It gives the model a stable way to distinguish operations without inspecting CSS or guessing from DOM order.

`role` is a structural hint. The supported values are `page`, `header`, `nav`, `main`, `aside`, `section`, `form`, `dialog`, `toolbar`, `list`, and `footer`. It affects the page description and reading order, but it does not expose controls, grant access, or validate an operation.

## Put the dialog back into the page tree

The editor is rendered to `document.body` with `createPortal`, so it is not a DOM descendant of the Todo workspace:

```tsx{1-8,13-20}
const editDialogScope = usePlingScope<HTMLDivElement>({
  id: "edit_dialog",
  label: "Edit task",
  description: "Rename one task. The rest of the task page is inactive while this dialog is open.",
  role: "dialog",
  parent: "todo",
});

return (
  <section ref={todoScope}>
    {/* Task workspace */}
  </section>
  {editingTask ? createPortal(
    <div className="overlay" ref={editDialogScope}>
      <section role="dialog" aria-modal="true" aria-labelledby="edit-task-title">
        {/* Editor fields and actions */}
      </section>
    </div>,
    document.body,
  ) : null}
);
```

The fixed overlay covers the page visually, but its DOM ancestry does not make it a child of the task workspace. `parent: "todo"` supplies the missing page relationship. In the model's region tree, the dialog appears under the task workspace while remaining outside that element in the browser.

The native `role="dialog"` and `aria-modal="true"` attributes describe the widget to assistive technology. They do not create a framework-level modal boundary. The dialog enters the page model because it has a scope declaration. The background becomes unavailable because its interaction state changes, not because the DOM contains the word `dialog`.

The editor exposes only the operations needed to rename one task. Because portal content has no DOM ancestor with a scope, each action names its scope explicitly:

```tsx{1-7,9-15,17-22}
const editTextRef = usePlingTool<HTMLInputElement>({
  id: "edit_note",
  desc: "Replace the text of the task currently being edited.",
  kind: "write",
  action: "fill",
  scope: "edit_dialog",
});

const editSaveRef = usePlingTool<HTMLButtonElement>({
  id: "edit_save",
  desc: "Save the task text and close the editor.",
  kind: "write",
  scope: "edit_dialog",
  run: saveEdit,
});

const editCancelRef = usePlingTool<HTMLButtonElement>({
  id: "edit_cancel",
  desc: "Close the editor without changing the task.",
  kind: "read",
  scope: "edit_dialog",
});
```

`edit_note` and `edit_save` are separate operations because they represent two distinct user decisions. Entering text does not save it. This separation also makes a failed call understandable: the model can report that it filled the field but that saving did not complete.

`edit_save` still has a target button, so the normal element checks apply. When the input is empty, the native Save button is disabled and the operation is reported as unavailable. No extra `available` predicate is needed for that condition.

## Make the background unavailable, not absent

An overlay may cover a page visually while leaving its controls reachable by keyboard or assistive technology. The Todo workspace therefore becomes inert for as long as the editor exists:

```tsx{3-4}
<section
  className="todo"
  ref={todoScope}
  inert={editingTask ? true : undefined}
  aria-hidden={editingTask ? "true" : undefined}
>
  {/* Task workspace */}
</section>
```

`inert` is the primary interaction boundary. In a supporting browser, content inside an inert subtree cannot be focused, clicked, or reached through sequential keyboard navigation. `aria-hidden="true"` removes the same background from the accessibility tree. The two attributes are complementary; neither replaces the other.

Before reporting an element-bound action as usable, the framework checks inert ancestors as well as native `disabled`, `hidden`, `display: none`, and `visibility: hidden`. It also performs geometry checks for clipping and obstruction in a browser. The exact combination depends on the page. The important rule is that hiding a control must not be implemented by deleting its declaration.

With the editor open, the dialog actions remain available. Background actions move to a separate section:

```text
## Actions that exist but are unavailable right now
- add_task: Element is inside an inert subtree: <form class="composer"> ... | region: Tasks / Task composer
- toggle@t1: Element is inside an inert subtree: <section class="todo"> ... | region: Tasks / Task list
- show_all_tasks: Element is inside an inert subtree: <section class="todo"> ... | region: Tasks / View controls
```

Repeated row actions are deduplicated by kind, so the model does not receive one identical reason for every task. It receives the more useful fact that this class of action exists and is currently blocked.

The unavailable section is not an invitation to retry. If the model invokes `add_task` by its exact id while the dialog is open, the executor rejects the call with `ACTION_UNAVAILABLE`. Page event handlers cannot run around the page's current interaction state.

This distinction helps the model recover. It can say that the composer is unavailable while the editor is open, then save or cancel the editor before trying again. It does not need to invent a missing feature or reload the page.

## Function-level tools need an explicit guard

The bulk operation from the previous chapter has no element target. `inert` on the Todo section therefore cannot disable it. If it remained available during editing, the model could modify the whole list while the user was editing one row.

The function-level declaration must carry the page-state condition itself:

```tsx{5-12}
useAgentTool({
  id: "complete_open_tasks",
  desc: copy.completeOpenDesc,
  kind: "write",
  available: () =>
    editingIdRef.current !== null
      ? copy.editOpenBlocked
      : tasksRef.current.some((task) => !task.done)
        ? true
        : copy.completeOpenNone,
  run: () => ({ completed: completeOpenTasks() }),
});
```

The first branch is not a copy of the `inert` check. It is the missing business fact for an operation that has no DOM target. The later branches handle an empty list. Each failure returns a condition the model can act on.

The guard reads refs so that an execution step observes the latest task and dialog state, including immediately after opening or closing the editor. This is a correctness detail, not an alternative to React state.

This is the general rule for function-level tools: a tool without an element does not inherit visibility, obstruction, native disabled state, or an inert ancestor. The developer must decide which page conditions make the operation meaningful and express them through `available`. A function that can still be invoked in an invalid state also needs a runtime guard.

`available` remains a statement about the page, not authorization. It can say that the editor is open, a selection is empty, or a list is full. It cannot establish that the caller may mutate the record, that the tenant owns the data, or that a server-side rule permits the operation.

## What the model receives

The page context now has three useful layers. The region section describes the workspace and the open dialog:

```text
## Page structure (regions)
- main "Tasks" (todo): ...
  - form "Task composer" (composer): ...
  - list "Task list" (task_list): ...
  - toolbar "View controls" (view_controls): ...
  - dialog "Edit task" (edit_dialog): ...
```

The available action list contains the dialog operations and omits the blocked background actions. The next section, headed `## Actions that exist but are unavailable right now`, gives the relevant reasons. Task records remain readable, so the model can identify which task is being edited and what its current text is.

The folded `edit` row-action template disappears while the dialog is open, because every element that would implement it is unavailable. It returns when the dialog closes. This is a property of the current action projection, not a deletion of the declarations or a change to the stored records.

After `edit_save`, the next turn receives a fresh snapshot. The dialog is gone, the task record contains the new text, and the background actions are available again. The model does not need to remember that the dialog was open; the snapshot is the current source of truth.

## What visibility does not mean

Regions and availability make the page model more faithful, but they do not make the application secure by themselves:

| Fact | What it establishes | What it does not establish |
| --- | --- | --- |
| Region membership | Which part of the declared page contains the action. | Who may invoke it. |
| `inert` or a covered target | The browser cannot use that control through the normal path at this moment. | That the business operation is valid or authorized. |
| `available` | The developer says the page state permits an attempt. | That the caller has permission, or that a server will accept the result. |
| A successful UI action | The declared implementation ran and the page settled. | That a remote write succeeded or that policy was enforced. |

A region label is not a validation rule. Renaming a region, nesting it under a dialog, or marking it active does not alter the executor's permission model. The action still passes through policy, argument validation, confirmation, and whatever authorization the application implements.

Geometry checks are local and temporary. They answer whether a control appears reachable to this browser at this moment. They cannot prove that the control matches the user's intent, and a malicious page or extension can always change the DOM. Server-side authorization and business validation remain necessary wherever the operation is consequential.

Finally, `aria-hidden` is not a universal way to make a control safe. Hiding a focusable subtree from assistive technology without making it inert can leave keyboard users in an invisible interaction state. In a modal, use the platform's interaction boundary and keep the background's semantics consistent with its actual behavior.

## Failures worth designing for

| Symptom | Cause | Better response |
| --- | --- | --- |
| A dialog is labelled `dialog`, but background actions remain available | The role was mistaken for a modal boundary | Make the background truly unavailable and verify it in the snapshot. |
| The dialog appears as a second root region | It is rendered through a portal and has no explicit parent | Declare the intended parent id. |
| The model says the composer disappeared while a dialog is open | Unavailable actions were removed from both the available and unavailable lists | Keep the action present with a readable reason. |
| The bulk function still runs while a dialog is open | A function-level tool cannot inherit `inert` from a target | Add the page-state condition to `available` and keep a runtime guard. |
| Similar controls are still chosen incorrectly | Regions exist, but actions have no readable path | Give regions stable ids, labels, and descriptions that reflect their role. |
| The action is blocked, but the user sees no next step | The reason describes an implementation detail | State the condition in user-facing terms, such as “Finish or cancel the open task editor.” |

These are page-model errors. Find them in tests and by inspecting the runtime snapshot rather than leaving the interpretation to a model's prose.

## Verify the chapter example

From the repository root:

```bash
pnpm tutorial:dev r-09
```

Open `http://127.0.0.1:5249/`. For the Chinese interface, use `pnpm tutorial:dev r-09 --locale zh` and `http://127.0.0.1:5249/?lang=zh`.

Check these paths:

1. Ask the assistant to rename the second task to “Book the design review with Mina”. The editor should open, the dialog should join the page structure, and the task text should change after `edit_save`.
2. Inspect the page structure before and after opening the editor. The Todo region should contain `composer`, `task_list`, and `view_controls`; the dialog should appear under `todo` after it opens.
3. While the editor is open, inspect unavailable actions. The composer, row actions, filters, and `complete_open_tasks` should remain visible with reasons rather than appearing to vanish.
4. Invoke a blocked background action by its exact id in a test or through the debug surface. The result should be `ACTION_UNAVAILABLE`, not a successful event dispatch.
5. Save or cancel the editor. Background actions should return, and a fresh snapshot should contain the new task text if it was saved.
6. Run `pnpm tutorial:check r-09`. The deterministic checks cover the region tree, explicit dialog parent, inert reasons, the function-level guard, replay flow, and Chinese copy. They use the example in `examples/tutorials/r-09-regions-visibility-and-overlays` and do not depend on live model wording.

## Scope and next step

This chapter covers structural regions, explicit parentage for overlays, and the difference between an action being absent and temporarily unavailable. It does not yet address long lists, scrolling, offscreen record actions, or the discovery actions generated for content outside the viewport. Those are the subject of the next chapter.

Nor does this chapter turn page state into authorization. A correct region tree tells the model where it is. A correct unavailable reason tells it what must change. Neither replaces policy, consent, or server-side validation.

Next: [Long lists, scrolling, and offscreen actions](/react/long-lists-scrolling-and-offscreen-actions).
