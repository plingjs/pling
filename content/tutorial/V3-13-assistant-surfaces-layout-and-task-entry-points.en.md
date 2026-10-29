---
id: V3-13
title: "Assistant surfaces, layout, and task entry points"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Assistant surfaces, layout, and task entry points

An assistant that only exists as a floating bubble can feel detached from the page it operates. A settings screen may want a persistent side panel; a dashboard may prefer a compact dock; a specific table row may need a one-click “explain this” action. These are different ways for a person to reach the same assistant, not different assistants.

Pling separates the assistant's placement from its runtime. The shell decides where the conversation appears and how it opens. The runtime keeps the messages, actions, approvals, and page context. Changing the shell must not create a second history or a second set of permissions.

This chapter adds two ideas to the Todo page:

- `<AgentDock>` can stay in its floating corner or become a page-edge sidebar.
- A human can start a task from a normal button with `v-task`, or from application code with `pling.ask()`.

Both task entry points deliver a request to the mounted conversation. Neither becomes a tool for the model.

## The problem with treating every entrance as a separate chat

It is tempting to mount one assistant beside the task list, another in a detail drawer, and a third behind a row-level button. Each copy looks convenient in isolation. Together they introduce avoidable problems:

| Separate assistants | One assistant with several entrances |
| --- | --- |
| A conversation disappears when its local shell unmounts | The conversation survives layout and route changes |
| Every copy needs its own model connection and limits | One runtime owns the model, limits, and telemetry |
| The user may need to repeat context | Every entrance sees the same conversation |
| Audit and approvals are split across copies | Actions are checked by one policy boundary |

The distinction is similar to a desktop application with several windows onto one document. The windows may move, collapse, or change shape; the document does not fork.

`<AgentDock>` is a placement shell around `<AgentInline>`. The dock owns the floating button, sidebar edge, open state, and task routing. The inline component owns the actual conversation. For most applications, use the dock. Use `AgentInline` directly only when the assistant should occupy a dedicated column or panel that the business layout controls.

## Keep the default dock

The shortest setup remains:

```vue{3}
<template>
  <main>
    <TaskList />
    <AgentDock layout="dock" title="Todo assistant" />
  </main>
</template>
```

`layout="dock"` places a floating launcher in the page. Opening it shows the chat. Closing it keeps the runtime and history alive because the inline conversation remains mounted underneath the shell.

The shell exposes only presentation choices. It does not change what the agent can do. The actions still come from `v-tool` declarations in the current page, and confirmation still comes from `kind` and `confirm`.

## Use a sidebar when the page has a natural work column

For a dense workspace, a side panel can make the assistant feel like part of the application rather than an overlay:

```vue{4-8}
<AgentDock
  layout="sidebar"
  side="right"
  launcher-placement="bottom"
  launcher-label="Ask Pling"
  title="Todo assistant"
/>
```

The supported presentation props are:

| Prop | Values | Effect |
| --- | --- | --- |
| `layout` | `"dock"` or `"sidebar"` | Floating corner or viewport edge |
| `side` | `"right"` or `"left"` | Edge used by the sidebar layout |
| `launcher-placement` | `"bottom"` or `"center"` | Position of the collapsed launcher |
| `launcher-label` | string | Visible text on the collapsed launcher |
| `default-open` | boolean | Whether the shell begins open |

`side`, `launcher-placement`, and `launcher-label` do not apply to the floating dock. Keeping the surface variants in one component means an application can remember a user's preference and switch shells at runtime without rebuilding the conversation.

An application that needs its own grid can mount `AgentInline` in a column:

```vue
<section class="workspace">
  <OrderTable />
  <AgentInline class="copilot-column" title="Order copilot" />
</section>
```

In that case the surrounding layout controls width, scrolling, and responsive behavior. The developer still does not build a second message loop.

## Add human task entry points

An assistant launcher is a generic entrance. Business pages often need a more specific one: “summarize open tasks”, “explain this order”, or “review the queue”. These buttons belong to the person using the page, not to the agent.

Use `v-task` for a declarative entrance:

```vue{6-8}
<button
  type="button"
  class="smart-action"
  v-task="copy.openTasksPrompt"
>
  Summarize open tasks
</button>
```

The value may also be an object:

```ts
v-task="{ prompt: 'Explain the risk in order SO-2041.', surface: 'dock' }"
```

`surface` is optional. With one mounted assistant, omit it. With more than one named surface, it routes the task explicitly.

Use `pling.ask()` when the entrance is already inside application logic:

```ts{3}
function askFromPage(): void {
  void pling.ask("What is still open on this page?").catch(() => undefined);
}
```

`pling.ask()` accepts the same optional `surface` and `source` fields. The `source` element helps custom surfaces and diagnostics identify which control initiated the task.

`v-task` and `pling.ask()` are deliberately absent from the model's action list. If they were registered as tools, the model would see a tool whose only effect is to send another prompt to itself. That creates noisy menus, recursive turns, and approval prompts with no business meaning.

## Share one conversation across entrances

The page in this chapter has a layout selector, a “Summarize open tasks” task button, and an “Ask from the page” button. All three use the same `<AgentDock>`.

The important wiring is not the number of buttons. It is the absence of per-button runtimes:

```text
page button ─┐
page code  ─┼─> mounted task target ─> one AgentInline runtime
launcher   ─┘
```

The dock registers the task target once. `v-task` and `pling.ask()` resolve that target and call its `send()` method. The shell opens, the prompt enters the existing history, and subsequent approvals and results appear in the same conversation.

This also means a task entry may be used while the dock is closed. Sending the task opens the shell; it does not require the user to find the launcher first.

## Choose the shell from product constraints

The right layout is usually determined by the surrounding application:

| Situation | Reasonable default |
| --- | --- |
| Occasional help on a content page | Floating dock |
| Long editing session with a dense workspace | Sidebar |
| Assistant is the primary work column | `AgentInline` in the page grid |
| One action attached to a record | `v-task` on the record |
| Existing custom toolbar or command palette | `pling.ask()` from code |

Avoid mounting several `AgentDock` instances because “the page has several areas”. A single shell can be moved by application state, and several task entries can target it. Multiple runtimes are appropriate only when the product deliberately separates assistants with different permissions, histories, or audiences.

## Verify the behavior

Start the example:

```bash
pnpm tutorial:dev v3-13
```

Then check:

1. Switch between **Floating dock** and **Page sidebar**. The assistant shell changes, but an existing reply remains.
2. With the sidebar selected, change the edge and the collapsed launcher position.
3. Close the shell, then select **Summarize open tasks**. The shell opens and sends the request.
4. Ask a question from the page, then open the launcher. Both messages are in one history.
5. Inspect the page actions. The two task buttons do not appear as model tools.

Run the deterministic checks with:

```bash
pnpm tutorial:check v3-13
```

The tests cover shell switching, sidebar props, task-entry registration, shared conversation history, and Chinese copy.

## Common failure modes

**Mounting one assistant per section.** Two docks look like one product until the user asks the same question in both and receives two unrelated histories. Move the shell or route task entries to one surface instead.

**Using a task button as a disguised tool.** Do not give a `v-task` button a `v-tool` declaration so the model can “ask itself”. If the model needs to perform the business operation, declare that operation directly. If the button is for a person, keep it out of the action list.

**Treating layout props as permissions.** `side="left"` or `launcher-label` changes presentation only. Restricting what the assistant may do belongs in action declarations, policies, approvals, and the gateway.
