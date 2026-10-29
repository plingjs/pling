---
id: V3-10
title: "Long lists, scrolling, and offscreen actions"
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# Long lists, scrolling, and offscreen actions

The previous chapter explained how an action can exist but be temporarily unavailable, for example while a dialog is open. A second, more ordinary source of false absence is position. A list may contain more records than its panel can display. The rows below the fold are still part of the application, but a model that receives only the currently painted controls would conclude that they are gone.

This chapter uses a 24-task Todo list inside a fixed-height scroll panel. The business operations do not change. Completion, editing, and deletion remain row actions declared with stable ids and `v-record`. The new behavior comes from how the runtime preserves and reaches records that are outside the visible part of the list.

Three states need to remain distinct:

- a record may **exist** without its fields being visible;
- an action may **exist** without its target currently being visible;
- an action may be visible and still be unavailable for a business reason.

The long-list mechanism addresses the second state. It does not collapse these states into a single notion of “not shown”.

## Why a long list changes the problem

Suppose a user says: “Mark the last task as completed.” The last task is below the visible area of the list. There are several possible designs:

1. expose only the visible rows, forcing the model to scroll until the target appears;
2. require the user to describe the task well enough for a search;
3. keep every row addressable by id, even when the row is offscreen, and scroll to it when an action targets it.

The first design makes the page model depend on scroll position. The same request becomes easier or harder depending on how far the user happened to scroll. The second design adds a discovery step even when the target is already known. The third keeps the protocol stable: existence is independent of the current viewport, while visibility affects how an action is executed.

The fixture has 24 tasks and exposes six rows at a time. That is enough to reproduce the problem without becoming a performance demonstration. A snapshot may show eighteen visible row actions and fifty-four more actions that exist in the same list region. The model still receives the id of the last record, `t24`.

## Keep the scrolling container ordinary

The list is still an ordinary Vue list. The only structural change is that the list itself is the scroll container:

```css{2-6}
.tasks {
  max-height: 360px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
```

The region is declared on that same element:

```vue{2-11,14-22}
<ul
  class="tasks"
  tabindex="0"
  :aria-label="copy.listRegionLabel"
  v-scope="{
    id: 'task_list',
    label: copy.listRegionLabel,
    description: copy.listRegionDescription,
    role: 'list',
  }"
>
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
    <input
      type="checkbox"
      :checked="task.done"
      v-tool="{
        id: `toggle@${task.id}`,
        desc: copy.toggleTaskDesc(task.text, task.done),
        kind: 'write',
      }"
      @change="toggleTask(task.id)"
    />
    <!-- Task text, edit, and remove controls -->
  </li>
</ul>
```

No row contains a special “scroll for the agent” handler. The row action is the same one used by a person: a checkbox with a stable id, a record declaration, and a normal change handler. The runtime derives visibility from the list container and the element's actual position.

The scope must be placed on the element that really scrolls. If the scope wraps an outer card while an inner element owns `overflow-y: auto`, the generated scroll action will move the region into the page viewport but will not scroll the inner content. This is a page-structure error, not a model error.

## What the model receives

The records and actions remain readable even when some rows are below the fold. A context excerpt for this fixture looks like this:

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

The exact visible count depends on the browser's layout and scroll position. The important part is the relationship, not the number in a particular rendering: the region reports that there are more actions than are currently visible, and the folded row action reports how many of its records are offscreen.

The model also receives a bounded citation list:

```text
Citation record ids (24 in active regions; offscreen targets are scrolled into view automatically):
t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12,
t13, t14, t15, t16, t17, t18, t19, t20, t21, t22, t23, t24
```

This is deliberately not the full page dump. The registry has defaults for how many records carry fields and how many record ids remain addressable. Fields are more expensive than ids; the model can know that `t24` exists without receiving every field of every row. If it needs the content of an unseen row, it can scroll, search, or use another declared discovery path.

## The executor reveals before it acts

When a model calls the folded action below, the protocol resolves it to the concrete row action:

```json
{
  "name": "toggle",
  "arguments": { "record": "t24" }
}
```

The raw action id is `toggle@t24`. Its target is a checkbox in the last row, outside the list's visible window. The executor handles that in one action call:

1. resolve the record argument to the registered action id;
2. validate arguments and run the normal policy decision;
3. detect that the target is outside the visible area;
4. call the adapter's reveal handler, which scrolls the target into view;
5. settle the page after scrolling;
6. read visibility again from the new state;
7. execute the click only if the target is now reachable.

The model does not need to call `pling_scroll_task_list` first when it already knows that it wants `t24`. One call to `toggle` is sufficient. The extra scroll is an execution detail, not another tool decision. In the Vue adapter, the default reveal handler uses `scrollIntoView` with centered block alignment; applications with a custom viewport can provide their own adapter-level navigation without changing the model-facing action.

Re-reading visibility after scrolling is necessary. A scroll can trigger a lazy render, replace a row, close a sticky menu, or fail to move a nested container at all. The runtime must not click on the assumption that the previous geometry still holds. If the target remains outside the visible area, the call returns `ACTION_UNAVAILABLE` with the reason instead of reporting a successful click.

The reveal is not a search. It can only bring an existing target into view. It cannot invent a row that the application has not rendered.

## Discovery actions are generated from the region

A region with more content than it displays receives a generated exploration action. For this fixture, the list region produces:

```text
pling_scroll_task_list
```

The action is available only when the region is in the page viewport and the registry can see that the region contains more actions than are currently visible. Its `run` function scrolls the region container by roughly one viewport, using the normal browser scrolling model. When the region itself is outside the page viewport, a separate action such as `pling_reveal_task_list` may be available to bring the region into view first.

These actions have two different jobs:

| Action | Use it when |
| --- | --- |
| `toggle { record: "t24" }` | The model already knows which record it wants. The runtime will reveal that row. |
| `pling_scroll_task_list` | The model needs to inspect later rows, compare visible content, or discover a target whose id it does not know. |

The generated action disappears when there is nothing more to reveal. An absent scroll action therefore means “the region currently reports no hidden content”, not “scrolling is unsupported”.

## Scroll, settle, then observe again

Scrolling is asynchronous in real pages. Smooth scrolling, virtualized rendering, and lazy loading all take time. After a discovery action or an automatic reveal, the runtime waits for the page to settle before taking the next snapshot. The model's next turn sees the new visible set and the new action projection, not a snapshot taken during the scroll animation.

This is why a successful scroll is not itself proof that an operation succeeded. The two pieces of evidence are different:

- the scroll action proves that the container moved;
- a later snapshot proves which rows and actions became visible;
- the business action's own result and `expect` condition prove whether the intended change occurred.

For a write action, the normal confirmation, policy, and result checks still apply. Scrolling does not weaken any of them.

## Limits: truncated fields, very long lists, and virtual lists

The mechanism is designed for a list whose rows exist in the DOM. It does not make an arbitrarily large list free.

The registry limits how many records carry fields and how many record ids remain available for row actions. This keeps a long list from consuming the whole context window. The model may know that `t180` exists while only seeing fields for the first thirty records. A page that expects precise work on thousands of rows should provide search, filters, or a dedicated retrieval action rather than asking the model to infer from a truncated table.

A virtual list is a different case. Its offscreen rows may not have DOM nodes at all. There is no element to scroll into view and no row action to invoke by id until the application materializes that row. The framework cannot manufacture a target that the application has not rendered. A virtualized application should expose an explicit business action such as `find_task` or `show_task_at`, or materialize the row through search before declaring a row action for it.

The same boundary applies to collapsed sections, lazy tabs, and paginated data. A discovery action can move within content that exists; it cannot paginate a backend by itself. That is a business capability and should be declared as one.

## What can still go wrong

| Symptom | Likely cause | What to change |
| --- | --- | --- |
| The model can name `t24` but the action is never available | The row action was not declared, or the record is not in an active region. | Declare the row action and `v-record` on the rendered row; check region activity. |
| A scroll action appears but the list does not move | The `v-scope` is on a wrapper instead of the actual `overflow` container. | Put the scope on the scrolling element. |
| The target is revealed and immediately fails | The row is covered by a sticky header or another overlay, or the scroll target is stale. | Re-check the geometry and the application's interaction boundary. |
| A row is missing from the model's fields | The record field limit was reached. | Narrow the set with search or expose a retrievable state/detail view. |
| A virtualized row cannot be found | The row has no DOM node yet. | Add a business action that materializes or retrieves it. |
| The model scrolls repeatedly instead of acting | It has no stable target id or the region reports more content indefinitely. | Give the row a stable id and a bounded discovery action; avoid unbounded infinite scroll. |

These failures belong to the page integration. A longer wait or another model prompt usually cannot repair a missing target or a scope attached to the wrong element.

## Verify the chapter example

From the repository root, start the packaged fixture:

```bash
pnpm tutorial:dev v3-10
```

Open `http://127.0.0.1:5223/`. For the Chinese interface, run `pnpm tutorial:dev v3-10 --locale zh` and open `http://127.0.0.1:5223/?lang=zh`.

Then check the behavior rather than only the final answer:

1. Ask the assistant to mark the last task as completed without searching or scrolling first. The list should scroll to it and the checkbox should change without a separate manual scroll request.
2. Ask the assistant to scroll the task list up one screen and inspect the earlier tasks. The generated `pling_scroll_task_list` action should be used, and the visible set should change. This also reverses the automatic reveal from the first check, so the two checks can run in sequence.
3. Open the debug surface and compare the page structure before and after a manual scroll. The region's visible/total count should change while the record ids remain present.
4. Inspect the folded `toggle` tool. Its description should state how many rows are outside the viewport, and its `record` parameter should name a record id from the page data.
5. Run `pnpm tutorial:check v3-10`. The deterministic checks cover record retention, tool folding, automatic reveal, generated scrolling, a replay model path, and the Chinese copy.

## What carries forward

A long list does not require a second action model. The existing row action remains the entry point. The runtime keeps the rows addressable, reveals a known target before execution, waits for the page to settle, and observes again. When the model does not yet know the target, the region supplies a bounded discovery action.

The next chapter moves from what the page does to what it may expose as read-only state. The distinction is important: a long list is not a reason to pour every row into the prompt, and a state view is not a reason to expose the application's entire store.
