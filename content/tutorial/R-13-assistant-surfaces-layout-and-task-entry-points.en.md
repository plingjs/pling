---
id: R-13
title: "Assistant surfaces, layout, and task entry points"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Assistant surfaces, layout, and task entry points

The task list now supports creation, filtering, a detail route, and multi-step work. Through all of that, the assistant has remained a single floating button. To ask “what is still open on this page?”, a person must first find the button and then phrase the request from scratch.

That is tolerable on a content page. It is not enough for a workbench. A settings page may need a permanent right-hand column. A dashboard may work better with a compact overlay. A specific business operation should have its own entrance, such as “Summarize open tasks.” These entrances belong to one assistant; they differ in placement and trigger.

This chapter addresses the relationship between the assistant and the page. It does not add a new page action or change the permission boundary. It solves three product questions:

- Where does the conversation appear?
- How does a person find it?
- Can the page hand it a task in business language?

## Several entrances are not several assistants

The easiest implementation is to mount an assistant beside the list, another in the detail view, and a fresh conversation behind every business button. Each choice looks locally reasonable. Together they create avoidable complexity.

| One conversation per entrance | One conversation, several entrances |
| --- | --- |
| History disappears when a local shell unmounts | History follows the application, not the shell |
| Every copy configures its own model, limits, and telemetry | There is one model and one set of limits |
| Users repeat context in different windows | Later entrances can read earlier turns |
| Approvals and audit records scatter | Actions still pass through one policy boundary |

Think of a desktop application with one document and several windows. Windows can float, dock, or hide; there is still one document. `AgentDock` is the window. `AgentInline` carries the conversation. A task entrance only delivers a request into it.

## Separate the shell from the conversation

The React adapter gives these responsibilities to two components.

`AgentDock` is a placement shell. It handles floating or edge placement, open and closed states, the launcher, and task registration. The default setup remains unchanged:

```tsx{3}
<main>
  <TaskList />
  <AgentDock title={copy.dockTitle} />
</main>
```

`AgentInline` is the conversation with no fixed positioning, launcher, collapse control, or overlay. Use it when a workbench should reserve a column for the assistant.

The important shared property is that changing the shell does not recreate the runtime. Collapsing `AgentDock` stops rendering the panel; the component remains mounted, so its history, approval state, and current model configuration remain intact.

## Floating dock and sidebar

The example keeps the floating entrance and also allows an edge sidebar:

```tsx{4-8}
<AgentDock
  title={copy.dockTitle}
  debug={{ maxCalls: 8 }}
  layout={layout}
  side={side}
  launcherPlacement={launcherPlacement}
  launcherLabel={copy.launcherText}
  surfaceId="dock"
/>
```

The placement props are:

| Prop | Values | Effect |
| --- | --- | --- |
| `layout` | `"dock"` / `"sidebar"` | A floating corner or a viewport-edge work surface |
| `side` | `"right"` / `"left"` | Which viewport edge the sidebar uses |
| `launcherPlacement` | `"bottom"` / `"center"` | A bottom-corner launcher or a centered edge tab while collapsed |
| `launcherLabel` | string | Copy for the collapsed launcher; defaults to the localized “Ask Pling” |
| `surfaceId` | string | Stable task-routing identifier; defaults to `"dock"` |

`side`, `launcherPlacement`, and `launcherLabel` only apply to the sidebar layout. The default dock ignores those placement details. Layout can follow a user preference or viewport change without unmounting and remounting the assistant.

On narrow screens the sidebar degrades to a floating panel. A full-height sidebar would leave no usable work area on a phone. Keeping the entrance and changing its form is more useful than preserving a desktop layout at all costs. The component owns that fallback; application code does not need a separate mobile branch.

## Place the assistant in the page grid

When the assistant belongs to the page layout rather than behaving like a tool that can be dismissed, use `AgentInline`:

```tsx{3-7}
<section className="workspace">
  <OrderTable />
  <AgentInline
    className="workspace__copilot"
    title="Order copilot"
    surfaceId="order-copilot"
  />
</section>
```

Width, height, scrolling, and responsive behavior now belong to the outer layout. `AgentInline` only renders the conversation. `className` is applied to its shell and can participate directly in a grid or flex layout.

Choose between the two by asking whether the assistant should permanently occupy page space:

- Occasional help, reading, or form completion: a floating entrance is lighter;
- Long editing sessions, review queues, and operational workbenches: a fixed column is steadier;
- The assistant is the main work object: the page layout should reserve space for it.

## Task entrances are for people

A general launcher answers “I want to ask something.” A concrete business operation still benefits from a concrete entrance. The example places two buttons on the page:

```tsx{4-5,12-13}
<div className="surface-settings__tasks">
  <button
    type="button"
    data-task-entry="summarize"
    onClick={() => void pling.ask(copy.openTasksPrompt).catch(() => undefined)}
  >
    {copy.openTasksTask}
  </button>

  <button
    type="button"
    data-task-entry="ask"
    onClick={() => void pling.ask(copy.pageQuestion)}
  >
    {copy.pageQuestionTask}
  </button>
</div>
```

React has no `v-task` directive. The equivalent is an ordinary button that calls `pling.ask()`. If the trigger element is useful for diagnostics, pass it explicitly:

```ts
pling.ask("Explain the risk in this order.", { source: event.currentTarget });
```

`pling.ask()` returns a Promise. The example catches errors where it does not need the result, avoiding an unhandled rejection. A caller that needs to inform the user should still handle failures.

The entrance can use the page's business vocabulary, such as “Summarize open tasks,” without making the user understand an action list or a model interface. Once the request reaches the assistant, the same session loop reads the current page snapshot, selects actions, and executes them.

## Why task entrances are not actions

Task entrances and actions point in opposite directions:

- An action says the agent may operate this element;
- A task entrance says a person may ask the agent to handle something.

If `pling.ask()` were registered as an action, the model would see a tool whose only effect is to send another prompt to itself. The result would be a noisier action list, possible recursive turns, and an approval decision with no business meaning.

Task entrances therefore stay outside the registry and outside the model's action list. When the model needs a business operation, it should call the real action. When a person needs to start a task, the entrance calls the assistant.

This is not a permission shortcut. A task entrance changes where a request comes from; it does not bypass action declarations, availability checks, confirmation, or a model gateway. What the assistant can do still comes from the current page's actions and policy.

## Collapse, expansion, and one history

The example starts with the floating dock collapsed. Clicking “Summarize open tasks” expands the dock and sends the request. The user does not have to find the launcher first.

Clicking “Ask from page code” sends a second request into the same conversation. The second model call can see the first user message and reply instead of starting with a fresh history. The test checks this directly: the second request contains both the first task and the second task.

Applications with several named surfaces can route explicitly:

```ts
await pling.ask("Summarize the current order risk.", { surface: "order-copilot" });
```

Routing failures are explicit:

- No assistant is mounted: `PLING_TASK_SURFACE_MISSING`;
- A name was supplied but no surface matches: `PLING_TASK_SURFACE_UNKNOWN`;
- The prompt is empty: `PLING_TASK_EMPTY`.

Explicit errors are easier to diagnose than silently dropped requests. Task entrances are usually part of application code, so the caller can decide whether to notify the user or record a diagnostic.

## Layout is not authority

`layout="sidebar"`, `side="left"`, and custom launcher copy only change presentation. They cannot restrict or expand what the assistant is allowed to do.

Authority still comes from:

- the actions declared on the current page;
- each action's availability and risk level;
- application policy, confirmation, and the model gateway.

A task entrance only starts a request. It is neither a higher-privilege shortcut nor a tool for the model to call.

## Choose an entrance from the workflow

| Scenario | Reasonable default |
| --- | --- |
| Occasional help on a content page | Floating dock |
| Long editing or an information-dense workspace | Edge sidebar |
| The assistant is the main work column | `AgentInline` in the page grid |
| One record or one business operation | A task entrance on the page |
| An existing toolbar or command palette | Call `pling.ask()` from application code |

Do not mount one `AgentDock` for every region. Moving one shell or pointing several task entrances at one surface is usually better. Multiple runtimes are justified only when the product genuinely needs different permissions, different histories, or different audiences.

## Verify

Start the example:

```bash
pnpm tutorial:dev r-13 --locale en
```

The source is in `examples/tutorials/r-13-assistant-surfaces-layout-and-task-entry-points`. It consumes the local workspace packages and does not copy any framework implementation.

Open `http://127.0.0.1:5253/?lang=en` and check:

1. Switch between the floating entrance and the page sidebar. Existing replies remain.
2. In sidebar mode, change the edge and the collapsed launcher position.
3. Collapse the assistant, then click “Summarize open tasks.” The assistant should expand and start the request.
4. Click “Ask from page code.” The second request should appear in the same conversation.
5. Inspect the model tools. The two task buttons should not appear.

The deterministic check covers placement props, automatic expansion, shared history, both locales, and the “never an action” rule:

```bash
pnpm tutorial:check r-13
```

## Common mistakes

**Give every entrance its own conversation.** Two small windows can look like one product while holding unrelated context. The user has to repeat background, and approvals no longer form one traceable path.

**Declare a task button as an action too.** If a button is for people, keep it away from the model. If the model needs to perform a business operation, declare that operation directly instead of exposing a tool that sends a prompt.

**Treat placement as a capability switch.** Moving or resizing the assistant affects usability, not the security boundary. Put authority in actions, policy, and confirmation.
