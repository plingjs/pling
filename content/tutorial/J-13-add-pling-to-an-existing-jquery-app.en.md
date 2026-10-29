---
id: J-13
title: "Add Pling to an existing jQuery app"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Add Pling to an existing jQuery app

Many production pages still use jQuery for rendering and event handling. Replacing that code is usually a larger change than the capability work itself. Pling does not require the page to become a component application first. The vanilla adapter attaches to the DOM elements and business objects the page already owns.

This example keeps the queue state in a normal array, renders rows with jQuery, and handles user events with jQuery. Pling declares the region, the input, the submit button, and the row controls. There is no second store and no parallel rendering path.

## Attach at the element boundary

Register the region before its children. The declaration writes the scope marker to the element, so child actions can resolve the same region without repeating its name.

```ts
pling.scope(todo[0], {
  id: "todo",
  label: copy.regionLabel,
  description: copy.regionDescription,
  role: "main",
});
```

The input already exists and jQuery already listens for its `input` event. The capability declaration only says how the agent may fill it:

```ts
pling.tool(input[0], {
  id: "composer_text",
  desc: copy.composerTextDesc,
  action: "fill",
  params: [{ name: "text", label: copy.textParamLabel }],
});
```

The submit action does not call `addTask` directly because the existing form submission already owns that path. Pling performs the same visible operation and lets the existing handler mutate the page.

```ts
pling.tool(submit[0], {
  id: "composer_submit",
  desc: copy.composerSubmitDesc,
  available: () => input.val()?.toString().trim() ? true : copy.submitReason,
});
```

Keeping the existing handler is important. If the agent path called a second `addTask` implementation, human and agent actions could drift in validation, rendering, or side effects.

## Bind records to the live object

Each row is created as a jQuery element, but the record points at the same task object that the click handler mutates:

```ts
const task = { id: "t4", text: "Check the renewal", done: false };
const row = $("<li>").addClass("task");

pling.record(row[0], {
  data: task,
  label: copy.recordLabel(task.text),
});
```

Do not copy task fields into a separate agent-only object. A copied record becomes stale as soon as the page toggles a checkbox. The record should read the same state that the operator sees.

Row actions use stable ids derived from the business id:

```ts
pling.tool(check[0], {
  id: `toggle@${task.id}`,
  desc: copy.toggleDesc(task.text, task.done),
});
```

The index in the jQuery collection is not an identity. Sorting, filtering, or inserting a row changes it. `t4` remains valid until that task is actually removed.

## Remove declarations with the DOM

When a row is removed, unbind its Pling declarations and its jQuery handlers together. The example keeps both in the same lifecycle so the next render cannot leave a registered action pointing at a detached element.

The same rule applies when a page fragment is replaced through `.html()` or a template refresh. Removing DOM nodes does not automatically remove their registry entries. Keep the cleanup function returned by every `pling.tool`, `pling.record`, and `pling.scope` call.

## Migrate in one narrow slice

A safe adoption sequence for an existing page is:

1. Choose one business task with a stable object and a visible result.
2. Keep the current jQuery handlers and state.
3. Declare the region and only the controls needed for that task.
4. Add records for the rows or values the agent must distinguish.
5. Put a deterministic test around the existing handler.
6. Expand only after the first slice is reliable.

This order avoids a rewrite whose only purpose is to satisfy the Agent integration. It also makes rollback simple: remove the declarations and the page remains the same jQuery application.

## Run the example

```bash
pnpm tutorial:dev j-13
```

Open `http://127.0.0.1:5278/?lang=en`, or pass `--locale zh` and open `http://127.0.0.1:5278/?lang=zh`.

```bash
pnpm tutorial:check j-13
```

The check installs the release-equivalent packages, compiles the jQuery and TypeScript surface, runs the end-to-end tests, and builds the page.

## Common mistakes

**Creating a second task array for Pling.** The agent would modify a copy while the table renders the original. Bind records to the active object.

**Relying on jQuery selectors as action ids.** A selector can match a different row after a sort. Use a stable business id and keep the selector only as an implementation detail.

**Forgetting `.off()` and the Pling cleanup.** Replacing a row without removing either lifecycle leaves duplicate handlers or stale capabilities.

**Reimplementing submit inside `run`.** Reuse the existing business function or DOM event path so both users and agents receive the same validation and side effects.

Next: [Expose selected capabilities to external agents](/vanilla/expose-selected-capabilities-to-external-agents).
