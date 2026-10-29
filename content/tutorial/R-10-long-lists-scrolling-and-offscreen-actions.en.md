---
id: R-10
title: "Long lists, scrolling, and offscreen actions"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Long lists, scrolling, and offscreen actions

The previous chapter covered actions that still exist but become temporarily unavailable behind a dialog or another overlay. A more ordinary case is an action whose target is simply outside the visible part of a list.

When a user says “mark the last task as completed”, the last row may sit below the fold of a scroll container. It is still part of the application, but a model that receives only the currently painted controls can reasonably conclude that it is gone. If the page then makes the model scroll repeatedly and treat its own scroll position as the next premise, the same request becomes easier or harder depending on where the user happened to leave the list.

This chapter uses 24 tasks in a fixed-height scrolling list. Completion, editing, and deletion do not change. What changes is how the page reports the existence of records, how the model can refer to an offscreen target, and how the executor brings that target into view before invoking an action.

## Separate existence, visibility, and availability

A long list contains at least three distinct conditions:

- a record **exists**, but its fields are currently outside the visible area;
- an action **exists**, but its target is currently outside the visible area;
- an action is visible, but unavailable for a business reason.

The previous chapter dealt mainly with the third condition. This one deals with the second. Collapsing them into “not shown” removes the information a model needs to recover: it cannot tell whether the target was never declared, blocked by a rule, or merely outside the current viewport.

The mechanism is not intended to put every row into the prompt or to hand scrolling over to the model. It preserves two narrower properties: rendered records keep stable identities, and a known target can be brought into view by identity before execution.

## Put the region on the element that scrolls

The list remains an ordinary React list. The only structural change is that `.tasks` is itself the scroll container:

```css{2-6}
.tasks {
  max-height: 360px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
```

The region is declared on that same element:

```tsx{1-6,10-15,18-24}
const taskListScope = usePlingScope<HTMLUListElement>({
  id: "task_list",
  label: copy.listRegionLabel,
  description: copy.listRegionDescription,
  role: "list",
});

return (
  <ul
    className="tasks"
    ref={taskListScope}
    tabIndex={0}
    aria-label={copy.listRegionLabel}
  >
    {visibleTasks.map((task) => (
      <TaskRow key={task.id} task={task} />
    ))}
  </ul>
);
```

No row needs a special “scroll for the agent” button. The checkbox, edit control, and delete control remain the controls a person uses; `usePlingRecord` declares row data and `usePlingTool` gives each control a stable id. The runtime derives visibility from the element's actual position.

`usePlingScope` must sit on the element that owns the `overflow-y` behavior. If the scope wraps an outer card while a nested element performs the scrolling, the generated action will bring the outer region into the browser viewport without moving the inner content. That is a page-structure error, not something a longer prompt can repair.

`tabIndex={0}` makes the list itself keyboard-focusable and scrollable; `aria-label` gives the region a readable name. Both serve people, and they keep the declared structure consistent with the name the runtime reports.

## The model receives addressable records, not a screenshot

Visibility affects how actions enter the live list, not record identity. A snapshot from the fixture looks roughly like this:

```text
## Page structure (regions)
- main "Tasks" (todo): ...; in viewport
  - form "Task composer" (composer): ...; in viewport
  - list "Task list" (task_list): ...; in viewport; actions 18/72; 54 more actions not shown, callable: pling_scroll_task_list
  - toolbar "View controls" (view_controls): ...; in viewport

## Available actions on this page
- toggle (record) (click / write / region:Tasks / Task list)
  Mark “{record}” as completed | use record to select a row
  (24 rows: t1 / t2 / t3 / …; 18 rows outside the viewport, auto-scroll on call)
```

The visible count changes with window height, so the exact numbers need not match. The important point is that several accounts remain separate:

- `recordIds` retains addressable ids from the active list, so `t24` still exists;
- `records` carries fields, but is bounded and is not the whole table;
- actions currently visible enter `actions`;
- row actions outside the viewport enter `offscreenRecordActions` and remain callable by id;
- the region reports visible and total counts and supplies a bounded discovery action.

The last task therefore does not need to be proved visible before the model can work with it. The model knows which record `t24` is, the action template retains the target, and the executor handles its position when the call is actually made.

## Reveal first, then execute

When the model selects `t24` and invokes the completion action, the executor does not immediately click an invisible button. It follows a longer path:

1. resolve the action and target element by stable id;
2. detect that the target is outside the visible area and call `reveal()`, scrolling it near the center of the viewport;
3. wait for scrolling and page updates to settle;
4. recheck visibility, obstruction, and whether the target is inside an `inert` or disabled boundary;
5. run the original action and use its result and `expect` condition to judge the business change.

This is runtime behavior. The business component does not need to store “the row the agent currently wants”. The model calls by record id, and the executor reaches the target through the same checkbox and business handler exposed to a person.

Automatic reveal only addresses position. It does not grant permission. Confirmation, policy, business validation, and result checks still apply. If the target was deleted, or remains inside another non-interactive region, the call fails with a reason instead of bypassing the check and clicking an approximate element.

## Scrolling is a discovery capability, not a business action

When the model does not yet know the target, it still needs a bounded way to explore. Once the region is in the viewport and reports more content, `usePlingScope` supplies two generated actions:

- `pling_reveal_task_list` brings the region into the viewport when the region itself is outside it;
- `pling_scroll_task_list` scrolls inside the container when the region is already in the viewport.

The scroll action accepts an optional `direction`: `next` means forward or down, `prev` means backward or up, and the default is `next`. When all content is visible, or when the region itself is outside the browser viewport, the corresponding action becomes unavailable with a reason.

This solves a different problem from automatic reveal. Reveal handles “the record id is known, but its target is not currently visible”. A scroll action handles “the target is not known yet, and another part of the list must be inspected”. The first should not require an extra model-issued scroll call; the second should not become an unbounded guessing loop over page numbers.

A successful scroll is not evidence that a business operation succeeded. Keep three kinds of evidence separate:

- the scroll action proves the container moved;
- a later snapshot proves which records and actions entered the visible area;
- the business action's result and `expect` condition prove the intended state changed.

## Limits: truncated fields, very long lists, and virtual lists

The mechanism serves lists whose rows already exist in the DOM. It does not make an arbitrarily large list free.

By default, the registry lists at most 30 records with fields and retains at most 200 addressable ids. A model may know that `t180` exists while seeing no full fields for it. A page that expects precise work on thousands of rows should provide search, filters, or a dedicated retrieval action instead of asking the model to infer from a truncated table.

A virtual list is a different case. Its offscreen rows may have no DOM node at all. Until the application materializes a row, there is no element to scroll into view and no row action that can be invoked by id. The framework cannot manufacture a target the application has not rendered. A virtualized page should expose a business action such as `find_task` or `show_task_at`, or materialize the target through search before declaring a row action for it.

Collapsed sections, lazy tabs, and backend pagination follow the same boundary. A discovery action can move within content that already exists; it cannot perform a backend request by itself. Pagination and remote retrieval are business capabilities and should be declared as actions.

## What can still go wrong

| Symptom | Likely cause | What to change |
| --- | --- | --- |
| The model can name `t24`, but the action is never available | The row action was not declared, or the record is not in an active region. | Declare both the record and the action on the rendered row; check region activity. |
| A scroll action appears, but the inner list does not move | The region wraps an outer element while another element scrolls. | Put `usePlingScope` on the container that owns `overflow`. |
| The target is revealed and immediately fails | A sticky header or dialog covers it, or the element is replaced while waiting. | Recheck obstruction, the interaction boundary, and how the list re-renders. |
| A row is missing from the model's fields | The limit for records carrying fields has been reached. | Narrow the set with search or expose a retrievable state/detail view. |
| A virtualized row cannot be found | The row has no DOM node yet. | Add a business action that materializes or retrieves it. |
| The model scrolls repeatedly instead of acting | Rows lack stable ids, or the region reports more content indefinitely. | Give rows stable identities and keep discovery actions bounded. |

Most of these failures belong to page integration rather than model reasoning. A longer wait or another prompt usually cannot repair a missing target or a scope attached to the wrong element.

## Verify the chapter example

The example lives at `examples/tutorials/r-10-long-lists-scrolling-and-offscreen-actions`. From the repository root, start the English interface:

```bash
pnpm tutorial:dev r-10
```

Open `http://127.0.0.1:5250/`. The list begins with 24 tasks and shows only part of the collection at once.

Check the behavior rather than only the final answer:

1. Ask the assistant to mark the last task as completed without searching or scrolling first. The list should scroll to it and the checkbox should change, without a separate manual scroll request from the model.
2. Ask the assistant to scroll the task list up one screen and inspect earlier tasks. It should use the generated `pling_scroll_task_list` action, and the visible set should change.
3. Open the debug surface and compare the page structure before and after scrolling. The number of visible actions should change while record ids remain present.
4. Inspect the folded `toggle` action. Its description should state how many rows are outside the viewport, and its `record` parameter should refer to an id in the page data.
5. Run `pnpm tutorial:check r-10` from the repository root. The deterministic checks cover record retention, action folding, automatic reveal, generated scrolling, a replay model path, and the Chinese interface.

## What carries forward

A long list does not require a second action model. The existing row action remains the entry point. The runtime keeps record identity, reveals a known target before execution, waits for the page to settle, and observes again. When the model does not yet know the target, the region supplies a bounded discovery action.

The next chapter moves from what the page can do to what it may expose as read-only state. The distinction matters: a long list is not a reason to pour every row into the prompt, and a state view is not a reason to expose the application's entire store.
