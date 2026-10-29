---
id: V3-09
title: "Regions, visibility, and overlays"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Regions, visibility, and overlays

The previous chapters made actions and records explicit. Each action had a stable identity, a description, and, for row operations, a record argument. The model could choose an operation without guessing from DOM structure.

That is not enough once several parts of a page contain similar controls, or when an open dialog temporarily makes the rest of the page unusable. A flat action list cannot tell the model that one Save button belongs to a record editor and another belongs to a settings form. Nor can it explain why an operation that existed a moment ago has disappeared from the list.

This chapter adds two pieces of page context:

- **regions** describe where an action lives in the page structure;
- **availability** reports whether an action exists but cannot be used right now, together with the condition that must change.

The example is a real edit dialog in the Todo application. The dialog is not a visual mock: it changes a task, and it makes the background page inert while it is open. The distinction between structure and temporary availability is the subject of the chapter. Neither mechanism grants permission or replaces business validation.

## Why a flat action list is ambiguous

Consider two operations with the same purpose in different parts of an application:

```text
save              Save the current record.
save              Save the account settings.
```

The labels and descriptions can be improved, but the underlying problem remains: the model does not know which part of the page each operation belongs to. A person reads the page spatially. The model receives a list.

The same problem appears in a simpler form in this Todo application. The page has an add form, a task list, filters, and bulk controls. The add action belongs to the composer. Row actions belong to records. The filters belong to the view toolbar. Their names are usually enough in this small page, but the structure becomes necessary as pages grow and controls repeat.

An overlay introduces a second problem. While the editor is open, the task list is visually covered and should not receive interaction. If those actions simply disappear from the snapshot, the model can reasonably conclude that the page no longer has an add form or row actions. It needs the weaker and more accurate statement: the actions still exist, but the open editor currently prevents their use.

The goal is therefore not to expose more controls. It is to make the existing page model more faithful:

1. actions carry a readable region path;
2. a dialog is part of the page tree even when it is rendered outside that tree in the DOM;
3. covered controls remain visible to the model as unavailable, with a reason;
4. actions without a target element receive an explicit availability guard.

The business functions and data model remain unchanged. The new integration consists of region declarations, dialog semantics, and one availability condition.

## Describe the page as a small tree

The Todo workspace is already wrapped in a region. This chapter makes its internal structure explicit:

```vue{2-13,20-29,35-44}
<section
  v-scope="{
    id: 'todo',
    label: 'Tasks',
    description: 'The task workspace: adding, editing, filtering, and reviewing tasks.',
    role: 'main',
  }"
>
  <form
    v-scope="{
      id: 'composer',
      label: 'Task composer',
      description: 'Create a task and choose its priority.',
      role: 'form',
    }"
    v-tool="addTaskAction"
  >
    <!-- Input, priority selector, and submit button -->
  </form>

  <ul
    v-scope="{
      id: 'task_list',
      label: 'Task list',
      description: 'The tasks currently in view, with completion, edit, and removal actions.',
      role: 'list',
    }"
  >
    <!-- Task rows -->
  </ul>

  <footer
    v-scope="{
      id: 'view_controls',
      label: 'View controls',
      description: 'Search, filtering, and bulk operations for the task list.',
      role: 'toolbar',
    }"
  >
    <!-- Search before the list; filters and bulk controls here -->
  </footer>
</section>
```

The tree is not inferred from visual styling. It is the structure the application declares. The model receives something like the following excerpt:

```text
## Page structure (regions)
- main "Tasks" (todo): ...
  - form "Task composer" (composer): ...
  - list "Task list" (task_list): ...
  - toolbar "View controls" (view_controls): ...
```

Actions inherit the path of the region in which they are declared. The add action is therefore labelled with `region:Tasks / Task composer`; an edit or delete action is labelled with `region:Tasks / Task list`; a filter action is labelled with `region:Tasks / View controls`.

This path is useful even when descriptions are similar. It gives the model a stable way to choose between operations without inspecting CSS or guessing from element order.

`role` is a structural hint. The supported values are `page`, `header`, `nav`, `main`, `aside`, `section`, `form`, `dialog`, `toolbar`, `list`, and `footer`. A role affects the page description and reading order; it does not expose controls, grant access, or validate an operation. A button inside a `form` region is not authorized merely because its region says `form`.

Child regions normally inherit their parent from the DOM. The snapshot resolves that relationship after mount, so a child may be registered before its parent without producing a broken tree. When a component is rendered through a portal, a teleport, or a fixed overlay outside its logical ancestor, the DOM relationship is no longer enough. The next section handles that case explicitly.

## Put the dialog back into the page tree

The editor is mounted beside the Todo workspace rather than inside it:

```vue{10-14}
<div
  v-if="editingTask"
  class="overlay"
  v-scope="{
    id: 'edit_dialog',
    label: 'Edit task',
    description: 'Change one task title. While this editor is open, the rest of the task page cannot be used.',
    role: 'dialog',
    parent: 'todo',
  }"
>
  <section
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-task-title"
  >
    <!-- Editor fields and actions -->
  </section>
</div>
```

The CSS overlay is a sibling of the Todo section. Its fixed position and `z-index` make it cover the page, but they do not change the DOM ancestry. `parent: 'todo'` supplies the missing page relationship. The dialog appears under the task workspace in the model's region tree while remaining outside that element in the browser.

The native `role="dialog"` and `aria-modal="true"` attributes describe the widget to assistive technology. They do not create a framework-level modal boundary. The dialog is part of the page model because it has a `v-scope` declaration; the background becomes unavailable because of its interaction state, not because the word `dialog` appears somewhere in the DOM.

The dialog exposes only the actions that belong to editing one task:

```vue{7-12,22-27,34-39}
<input
  id="edit-task-text"
  v-model="editText"
  v-tool="{
    id: 'edit_note',
    desc: 'Replace the text of the task currently being edited.',
    kind: 'write',
    action: 'fill',
  }"
/>

<button
  type="button"
  v-tool="{
    id: 'edit_cancel',
    desc: 'Close the editor without changing the task.',
    kind: 'read',
  }"
  @click="cancelEdit"
>
  Cancel
</button>

<button
  type="button"
  v-tool="{
    id: 'edit_save',
    desc: 'Save the task text and close the editor.',
    kind: 'write',
  }"
  @click="saveEdit"
>
  Save changes
</button>
```

`edit_note` and `edit_save` are separate operations because they correspond to two distinct user decisions. Filling the field does not save anything. This also makes a failed call understandable: the model can report that it entered a new title but that saving did not complete.

`edit_save` has a target button, so the normal element checks still apply. When the input is empty, the native Save button is disabled and the action is reported as unavailable. No additional `available` predicate is needed for that condition.

## Make the background unavailable, not absent

An overlay may cover the page visually while leaving its controls reachable by keyboard or assistive technology. The example therefore marks the Todo workspace inert for the lifetime of the dialog:

```vue{3-4}
<section
  class="todo"
  :inert="editingTask ? true : undefined"
  :aria-hidden="editingTask ? 'true' : undefined"
  v-scope="{ /* region declaration */ }"
>
  <!-- Task workspace -->
</section>
```

`inert` is the primary interaction boundary. In a supporting browser, content inside an inert subtree cannot be focused, clicked, or reached through sequential keyboard navigation. `aria-hidden="true"` keeps the same background out of the accessibility tree. The two attributes are complementary here; neither is a substitute for the other.

The framework reads these states before reporting an element-bound action as usable. It also recognises native `disabled`, `hidden`, `display: none`, and `visibility: hidden` states, and performs geometry checks for clipping and actual obstruction in a browser. The exact combination depends on the page. The important rule is that hiding a control is not implemented by deleting its declaration.

With the editor open, the model sees the dialog actions in the available list. The background actions move to a separate section:

```text
## Actions that exist but are unavailable right now
- add_task: Element is inside an inert subtree: <form class="composer"> ... (Add one task ... ) | region: Tasks / Task composer
- toggle@t1: Element is inside an inert subtree: <section class="todo"> ... (Mark ... ) | region: Tasks / Task list
- show_all_tasks: Element is inside an inert subtree: <section class="todo"> ... (Show every task ... ) | region: Tasks / View controls
```

Repeated row actions are deduplicated by kind, so the model does not receive one identical reason for every task. It receives the fact that this class of action exists and the condition that currently blocks it.

The unavailable section is not a suggestion to try harder. If the model calls `add_task` by its exact id while the dialog is open, the executor rejects the call with `ACTION_UNAVAILABLE`. The page's event handlers are not allowed to run around its own interaction state.

This distinction matters for both accuracy and recovery. The model can tell the user, “the task composer is unavailable while the editor is open,” then either cancel or save the editor before retrying. It does not need to invent a missing feature or reload the page.

## Function-level tools need an explicit guard

The bulk action from the previous chapter has no element target. `inert` on the Todo section therefore cannot disable it. If it remained available during editing, the model could change the whole list while the user was editing one row.

The function-level declaration must carry the same page-state condition explicitly:

```ts{7-14}
const completeOpenTasksAction = {
  id: 'complete_open_tasks',
  desc: 'Mark every open task as completed. This changes all open records in one operation.',
  kind: 'write',
  available: () =>
    editingTask.value
      ? 'Finish or cancel the open task editor before changing the task list.'
      : remaining.value > 0
        ? true
        : 'There are no open tasks. Every task is already completed.',
  run: () => ({ completed: completeOpenTasks() }),
  expect: {
    desc: 'No task remains open',
    check: () => remaining.value === 0,
  },
} satisfies AgentToolOptions;

useAgentTool(completeOpenTasksAction);
```

The first branch is not a copy of the `inert` check. It is the missing business fact for an operation that has no DOM target. The two later branches handle an empty list. Each failure returns a condition the model can act on.

This is the general rule for function-level tools. A tool without an element does not inherit visibility, obstruction, native disabled state, or an inert ancestor. The developer must decide which page conditions make the operation meaningful and express them through `available`. A function that can still run in an invalid state needs its own runtime guard as well.

`available` remains a statement about the page, not authorization. It can say that the editor is open, that a selection is empty, or that a list is full. It cannot establish that the caller may mutate the record, that the tenant owns the data, or that a server-side rule permits the operation. Those checks remain outside the UI layer.

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

The available action list contains the dialog operations and omits the blocked background actions. The subsequent section begins with the exact heading `## Actions that exist but are unavailable right now`, followed by the relevant reasons. Records from the task list are still readable, so the model can identify which task is being edited and what its current text is.

The `edit` row-action template disappears while the dialog is open, because every element that would implement it is unavailable. It reappears when the dialog closes. This is a property of the current action projection, not a deletion of the declaration or a change to the stored record.

On the next turn after `edit_save`, the model receives a fresh snapshot. The dialog is gone, the task record contains the new text, and the background actions are available again. The model does not need to remember that the dialog was open; the page snapshot is the current source of truth.

## What visibility does not mean

Regions and availability make the page model more faithful, but they do not make the application secure by themselves:

| Fact | What it establishes | What it does not establish |
| --- | --- | --- |
| Region membership | Which part of the declared page contains the action. | Who may invoke it. |
| `inert` or a covered target | The browser cannot use that control through the normal path at this moment. | That the business operation is valid or authorized. |
| `available` | The developer says the page state permits an attempt. | That the caller has permission, or that a server will accept the result. |
| A successful UI action | The declared implementation ran and the page settled. | That a remote write succeeded or a policy was enforced. |

A region label is also not a validation rule. Renaming a region, nesting it under a dialog, or marking it active does not alter the executor's permission model. The action still passes through policy, argument validation, confirmation, and whatever authorization the application implements.

The geometry checks are similarly local and temporal. They answer whether a control appears reachable to this browser at this moment. They cannot prove that the control is correct for the user's intent, and a malicious page or extension can always change the DOM. Server-side authorization and business validation remain necessary wherever the operation is consequential.

Finally, `aria-hidden` is not a universal way to make a control safe. Hiding a focusable subtree from assistive technology without making it inert can leave keyboard users in an invisible interaction state. In a modal, use the platform's interaction boundary and keep the background's semantics consistent with its actual behavior.

## Failures worth designing for

| Symptom | Cause | Better response |
| --- | --- | --- |
| A dialog is labelled `dialog`, but background actions remain available | The role was mistaken for a modal boundary | Mark the background inert or otherwise make it truly unavailable, and verify with the snapshot. |
| The dialog appears as a second root region | It is rendered outside its logical ancestor and has no explicit `parent` | Declare the intended parent id. |
| The model claims the add form disappeared while a dialog is open | Unavailable actions were removed from both the available list and the unavailable section | Keep the action visible with a readable reason. |
| The bulk function still runs while a dialog is open | A function-level tool cannot inherit `inert` from a target | Add the page-state condition to `available` and validate again at execution time. |
| Similar controls are chosen incorrectly | Regions were declared but actions still have no readable path | Give regions stable ids, labels, and descriptions that reflect their role in the page. |
| The action is blocked but the user sees no explanation | The reason describes an implementation detail instead of the next step | State the condition in user-facing terms, such as “Finish or cancel the open task editor.” |

These are page-model errors. They should be found in tests and by inspecting the runtime snapshot before they are left to a model's interpretation.

## Verify the chapter example

From the repository root, start the packaged example:

```bash
pnpm tutorial:dev v3-09
```

Open `http://127.0.0.1:5222/`. For the Chinese interface, use `pnpm tutorial:dev v3-09 --locale zh` and `http://127.0.0.1:5222/?lang=zh`.

Check these paths:

1. Ask the assistant to rename the second task to “Book the design review with Mina”. The editor should open, the dialog should become part of the page structure, and the task text should change after `edit_save`.
2. Inspect the page structure before and after opening the editor. The root Todo region should contain `composer`, `task_list`, and `view_controls`; the dialog should appear under `todo` after it opens.
3. While the editor is open, inspect the unavailable actions. The add form, row actions, filters, and `complete_open_tasks` should remain visible with reasons rather than appearing to have vanished.
4. Try to invoke a blocked background action by its exact id in a test or through the debug surface. The result should be `ACTION_UNAVAILABLE`, not a successful event dispatch.
5. Close or save the editor. The background actions should return, and a fresh snapshot should show the new task text if it was saved.
6. Run the deterministic checks with `pnpm tutorial:check v3-09`. They verify the region tree, explicit dialog parent, inert reasons, the function-level guard, replay flow, and Chinese copy independently of a live model.

## Scope and next step

This chapter covers structural regions, explicit parentage for overlays, and the difference between an action being absent and temporarily unavailable. It does not yet address long lists, scrolling, offscreen record actions, or the discovery actions generated for content outside the viewport. Those are the subject of the next chapter.

Nor does this chapter turn page state into authorization. A correct region tree tells the model where it is. A correct unavailable reason tells it what must change. Neither replaces policy, consent, or server-side validation.

Next: [Long lists, scrolling, and offscreen actions](/vue/long-lists-scrolling-and-offscreen-actions).
