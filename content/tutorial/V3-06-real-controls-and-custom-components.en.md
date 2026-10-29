---
id: V3-06
title: "Real controls and custom components"
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# Real controls and custom components

The previous chapter established how to declare one business operation with arguments. Once an action is declared, the runtime must answer a second question: which DOM element should receive the click, text input, selection, or key press? A declaration may sit on a button, an input, a component root, or a container. If the target is ambiguous, an action can appear to run while the application handler is never reached.

This chapter addresses target resolution. The underlying concept is the **separation between an interaction primitive and its target element**: `click`, `fill`, `press`, and `select` describe the browser interaction; target resolution decides which element receives it. The framework cannot infer the business meaning of “delete” or “search” from markup. It can only make an explainable choice from the declaration scope, native controls, and explicit targets.

Target resolution also needs evidence. A native control can receive an event directly; a custom component may require entering its DOM subtree; and several candidate controls require an explicit target from the developer. `fidelity` records the framework's confidence in the target, not proof that the business operation succeeded.

This chapter follows the same Todo application through three structures:

- native controls that receive primitives directly;
- custom components with one primitive-compatible element inside;
- custom components with several controls, where the developer must choose a target.

It also covers the boundaries of `press`, `hover`, and `run`: keyboard events, pointer events, and the path used when an interaction cannot be faithfully reproduced through DOM events.

## Problem and goal

The chapter addresses a class of failure in which the action description is correct but the event does not reach the intended element. The problem is uncommon on a simple button and much more likely with encapsulated components, several candidate controls, and content revealed by hover.

The reader must distinguish two facts: what interaction the browser performed, and which element received it. Native controls provide a direct path; custom components can be resolved through their DOM subtree; ambiguity requires an explicit target rather than a guess. By the end, the reader should be able to explain why an action hit or missed, and when to stop simulating UI behavior and use `run` instead.

## Control structure and scope of change

The base application is unchanged in its essential structure. It still owns the task array, the add operation, filters, and destructive actions. The example page contains a priority selector, a search field, a filter component, and a hover-opened menu. This chapter explains how those existing controls are declared and targeted; it does not introduce them as new business behavior.

The task region, task records, and row completion action from the previous chapter remain in place. Their semantics do not change here. This chapter only applies target resolution to the new and newly exposed controls.

The page now has these declarations:

| Action id | Primitive | Target in the page | Fidelity |
| --- | --- | --- | --- |
| `add_task` | `click` with `run` | the composer form | `high` (`injected`) |
| `select_priority` | `select` | native `<select>` | `high` (`native`) |
| `search_text` | `type` | input inside `SearchBox` | `auto` |
| `search_enter` | `press` | the same input | `auto` |
| `show_all_tasks` | `click` | button inside `TaskFilters` | `high` (`declared` target) |
| `show_open_tasks` | `click` | button inside `TaskFilters` | `high` (`declared` target) |
| `show_completed_tasks` | `click` | button inside `TaskFilters` | `high` (`declared` target) |
| `open_bulk_menu` | `hover` | `BulkMenu` root | `high` (explicit declaration) |
| `clear_completed` | `click` | native button inside the open menu | `high` (`native`) |

The table separates two questions that are often conflated:

1. **What browser interaction should be performed?** That is the primitive.
2. **Which element should receive it?** That is the target.

A high fidelity value means the framework has a defined reason to believe the primitive reaches the intended element. It does not mean the business operation succeeded. That is still the job of `expect`, a server response, or another application-level check.

## Target resolution on native controls

The priority selector is a native `<select>`:

```vue
<select
  id="task-priority"
  v-model="priority"
  v-tool="{
    id: 'select_priority',
    desc: 'Select the priority that will be used by the next task added with add_task.',
    kind: 'write',
    action: 'select',
    params: [{
      name: 'value',
      label: 'Priority for the next added task: today, soon, or later',
      values: ['today', 'soon', 'later'],
    }],
  }"
>
  <option value="today">Today</option>
  <option value="soon">Soon</option>
  <option value="later">Later</option>
</select>
```

The `select` primitive sets the native value and dispatches a `change` event. Vue's `v-model` receives that event through the existing binding. The action does not contain a second priority state, and it does not call a special Pling API to update the component.

The `params` declaration is still useful. It tells the model that `value` is required and constrains it to the three options the page can actually consume. A call with `someday` fails validation before the native element changes. The model sees `INVALID_PARAMS`, not a silent no-op.

This is the ordinary rule: if the declaration element is itself a native interactive control, the primitive is applied directly and the fidelity is `high` without a target lookup.

## Primitive boundaries for typing and pressing

The search field is a separate step from the navigation filter. Typing a phrase does not apply the search. Pressing Enter does. The page models that explicitly:

```vue
<SearchBox
  v-model="searchDraft"
  v-tool="[
    {
      id: 'search_text',
      desc: 'Enter a phrase in the task search field. This does not apply the search yet.',
      kind: 'write',
      action: 'fill',
    },
    {
      id: 'search_enter',
      desc: 'Press Enter in the task search field to apply the phrase already typed there.',
      kind: 'read',
      action: 'press',
      key: 'Enter',
    },
  ]"
  @search="applySearch"
/>
```

`action: 'fill'` maps to the `type` primitive. The primitive focuses the input, writes through the native value setter, and dispatches `input` and `change`. `action: 'press'` dispatches `keydown` and `keyup` on the target in the page's key name.

The page's `SearchBox` listens to `@keydown.enter` and emits `search`. That is why the second action has a visible effect. The framework does not invent a form submission or replay a complete human typing session. If a component listens only to a framework-specific synthetic event that is not part of the browser event flow, `press` will not reach it.

There is also no implicit "clear search" step. The action descriptions and the page behavior say exactly what each step does. A model that wants to search must call `search_text` and then `search_enter`; a flow that combines them belongs to a later chapter.

## Target resolution inside custom components

`SearchBox` has a root `<div>` and one `<input>`. The `v-tool` directive is written on the component, but Vue applies it to the component's single root element. The framework then resolves the primitive inside that root.

For a fill action, the candidates are input, textarea, and content-editable elements. `SearchBox` has exactly one input, so both `search_text` and `search_enter` resolve to that input. Their fidelity is `auto`.

`auto` has a narrow meaning:

```text
The primitive-specific candidate set inside the declaration element contains exactly one element.
```

It does not mean that the framework understands the word "search", that the input belongs to the intended business flow, or that the resulting search is useful. It means that there is no ambiguity about which element would receive the event. The developer still owns the component's semantics.

The reverse rules matter just as much:

| What is inside the declaration element | Result |
| --- | --- |
| No primitive-compatible element | `low`, reason `unresolved`; the action probably does nothing |
| Exactly one primitive-compatible element | `auto`; the action goes to that element |
| More than one candidate | `low`, reason `ambiguous`; the framework does not guess |
| An explicit `target` selector that matches | `high`, reason `declared` |
| An explicit `target` selector that matches nothing | `low`, reason `target-missing` |
| `autoTarget: false` | no inner lookup; `low` unless fidelity is declared |

Candidates are selected per primitive. A click looks for buttons, links, summaries, checkboxes, radios, button roles, and focusable elements. A fill or press looks for text inputs. A select looks for `<select>`. This prevents a nearby button from becoming a candidate when the action is clearly a text operation.

## Explicit targets and ambiguity

The filter control is a custom component named `TaskFilters`. Its root contains three native buttons. Without more information, a click action declared on that root has three possible targets, so the framework records `low` and does not guess.

The application can remove the ambiguity in the declaration:

```vue
<TaskFilters
  v-model="filter"
  v-tool="[
    {
      id: 'show_all_tasks',
      desc: 'Show every task, including completed tasks.',
      kind: 'read',
      target: 'button[data-filter="all"]',
    },
    {
      id: 'show_open_tasks',
      desc: 'Show only tasks that are not completed.',
      kind: 'read',
      target: 'button[data-filter="active"]',
    },
    {
      id: 'show_completed_tasks',
      desc: 'Show only completed tasks.',
      kind: 'read',
      target: 'button[data-filter="completed"]',
    },
  ]"
/>
```

`target` is a CSS selector evaluated inside the declaration element. It is not a global document query. The intent is to keep the action scoped to the component that owns it.

Use a selector that names the intended element clearly. The selector should survive ordinary style changes; a class added only for visual decoration is a poor target. A data attribute tied to the control's role is usually more stable.

After a target is supplied, the action is `high` with reason `declared`. The primitive still runs on a real DOM element, so the component's own click handler runs normally. Pling does not call a private component method or emit a custom event on the component's behalf.

## Event semantics of `hover`

The bulk menu is closed by default. Its clear-completed action is not in the registry until the menu opens. The component opens the menu when its root receives a `mouseover` event:

```vue
<template>
  <div class="bulk" @mouseover="open = true" @mouseleave="open = false">
    <button class="bulk__trigger" type="button" @click="open = !open">More</button>
    <div v-if="open" class="bulk__menu"><slot /></div>
  </div>
</template>
```

The declaration is:

```vue
<BulkMenu
  v-tool="{
    id: 'open_bulk_menu',
    desc: 'Move the pointer over More to reveal the bulk actions. Clear completed only exists while this menu is open.',
    kind: 'read',
    action: 'hover',
    fidelity: 'high',
  }"
>
  <button v-tool="clearCompletedAction">Clear completed</button>
</BulkMenu>
```

The `hover` primitive dispatches `pointerover`, `pointerenter`, `mouseover`, and `mouseenter`. That reaches the root's `@mouseover` listener. The menu renders, Vue mounts the button, and only then does `clear_completed` enter the action list.

Two boundaries are deliberate:

1. A synthetic mouse event does not put the browser into the CSS `:hover` state. A menu that is implemented only with a `:hover` selector will not necessarily open.
2. `hover` has no automatic candidate set. The framework cannot identify "the thing a human would move the pointer over" from a subtree without making a guess. Bind the event to the element that owns the behavior, use `target`, or make an explicit `fidelity` claim when the declaration element itself is the correct receiver.

The example uses an explicit `fidelity: 'high'` because the root really does listen for the event. That declaration is a statement about the mechanism, not a promise that the menu is useful or that the following business action will succeed.

The bulk action is also still `kind: 'danger'`. Opening a menu reveals a capability; it does not approve it. The existing confirmation policy still applies to `clear_completed`.

## `run` when a faithful path is unavailable

A primitive is a good fit when the page already has a meaningful DOM event. A custom component may not have one. It may render to a canvas, use a framework-specific event sequence, or expose an imperative method that is safer than manipulating its internal nodes.

In those cases, attach a small `run` to the action and call the component's existing operation:

```ts
const submit = {
  id: 'submit_order',
  desc: 'Submit the current order.',
  kind: 'write',
  run: () => orderForm.submit(),
};
```

The framework records an injected action as `high`, because it is not claiming that a DOM simulation is faithful. This has a consequence: `high` now describes the execution path, not the business result. Use `expect`, an HTTP response, or another page check to verify that the operation actually happened.

Use `run` when the DOM path is not the contract the component offers. Do not use it merely to hide an incorrect target. A clear `target` plus an existing native event is easier to review and preserves the page's own behavior.

`autoTarget: false` is a narrower control. It stops the framework from looking inside a declaration element. It does not make the declaration element interactive. If that element owns the event, pair it with an explicit fidelity claim; if it does not, use `run` or declare the correct target.

## What fidelity means

`fidelity` appears in three places:

- in the action list given to the model, where non-`high` values are tagged;
- in an execution result, where a non-`high` value is included;
- in development warnings when automatic targeting is unresolved or ambiguous.

The values answer a bounded question:

| Value | What it says | What it does not say |
| --- | --- | --- |
| `high` | The declaration element is native, an injected path is used, or the developer supplied an explicit target. | The business operation succeeded. |
| `auto` | Exactly one primitive-compatible element was found inside the declaration element. | The component semantics are correct. |
| `low` | The framework has no defensible target or the developer opted out of automatic lookup. | The browser event is guaranteed to fail; it may still reach a handler on the declaration element. |

A `low` action is not silently repaired. It remains callable unless page availability or the filter removes it, and an execution result includes a warning that the effect was not verified. That is more honest than pretending the event reached the intended control.

The developer's explicit `fidelity` value is a declaration, not a runtime proof. Setting it to `high` suppresses the target warning and changes the model-visible tag. It should be used when the developer can explain why that exact element receives the primitive. A team review should be able to check that explanation against the component code.

## Verifying target resolution

The fixture has deterministic tests for the paths that are easy to get wrong:

1. The manual composer still adds a task with the selected priority.
2. A native `<select>` accepts only the declared priority values and updates the existing `v-model`.
3. Filling the search field does not apply the filter; pressing Enter does.
4. A multi-button component is filtered through explicit targets.
5. Hovering the menu makes `clear_completed` appear.
6. `autoTarget: false` remains `low` when the wrapper has no explicit fidelity claim.
7. A wrapper that handles its own click can declare `high` and execute the handler.
8. The replay model can run the select, add, search, and press sequence end to end.

The test file also checks the registry's `fidelity` values. This is not redundant with a DOM assertion. A click that happens to work because the test attached it to the first button would not prove that automatic resolution is safe for a page with several controls.

## Verify the chapter example

From the repository root, start the packaged example:

```bash
pnpm tutorial:dev v3-06
```

The source lives in `examples/tutorials/v3-06-real-controls-and-custom-components`. The script packs the framework packages into local tarballs, copies the fixture, installs those tarballs, and starts Vite on port `5216`.

Check these paths by hand:

1. Choose `Later`, enter `Prepare tomorrow's agenda`, and submit the form. The new row should show the `Later` badge.
2. Type `customer` in the search field. The list should not change yet. Press Enter. Only the customer follow-up should remain.
3. Click `Open` and then `Done` in the custom filter component. The manual buttons should behave normally.
4. Move the pointer over `More`. The menu should open and show `Clear completed (1)`.
5. Ask the assistant: `Add "Draft the release note" with later priority, then search for release.` The replay test follows the same sequence; a real model should call `select_priority`, `add_task`, `search_text`, and `search_enter`.
6. Open the execution record and compare the recorded action ids with the table under “Control structure and scope of change”. Non-`high` results would be labelled explicitly.

## Scope and next step

The built-in target lookup is intentionally limited:

- it searches descendants of the declaration element, not the whole document;
- it does not cross a shadow root;
- it does not understand a canvas, a virtualized list, or a component's internal state machine;
- it does not turn a sequence of interactions into one business action;
- it does not decide whether an operation is safe, authorized, or reversible.

Those are separate mechanisms. A component with no faithful DOM path should expose a small application operation through `run`, preferably with an expectation. A sequence that must stay one tool belongs to the flow layer. A dangerous operation needs its own confirmation and authorization policy.

The next chapter, [Records, row actions, and change evidence](/vue/records-row-actions-and-change-evidence), moves from individual controls to rows. It explains how repeated row actions are folded, how a row is identified, and what evidence remains after an operation changes data.
