---
id: OPS-05
title: "Test and debug page capabilities"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Test and debug page capabilities

When an agent clicks the wrong control, does nothing after a successful call, or cannot find an action that is plainly visible to a person, the chat transcript alone rarely explains why. The useful question is narrower: **what did the model receive for that call, and what did the page expose at that moment?**

Pling separates that question from ordinary business testing. Deterministic tests check declarations, execution and state transitions. The built-in inspector shows the exact request sent by the running conversation, without creating a second agent loop or a separate page model.

## Enable the inspector

The inspector is off by default. Turn it on for the assistant surface you already use:

```vue
<AgentDock debug />
```

Keep a smaller in-memory history when many calls are expected:

```vue
<AgentDock :debug="{ maxCalls: 8 }" />
```

`<AgentInline>` accepts the same `debug` prop. The default retention is 20 calls. Records disappear when the page is refreshed or the conversation is cleared.

An application can enable tracing once for every assistant surface:

```ts
createPling({ agent: { trace: true } });
```

Surfaces that inherit this setting also receive the inspector entry. Set `:debug="false"` on one surface to opt it out.

Enabling the inspector makes request messages, the system prompt, the tool list and page data visible to anyone who can open that chat. Use a build-time flag or a role check before enabling it in production. It is a developer tool by default, not an operator console.

## What the view contains

The inspector has three levels.

### Runtime

The runtime block shows the selected model, model readiness, current context usage, turns used and retained call count. These values come from the live runtime that is answering in the chat.

### Current page projection

This is the page as the capability registry currently sees it:

- available actions, their primitive, risk level, region path and description;
- actions that exist but are unavailable, with the reason;
- active scopes, records, exposed state and page feedback;
- developer coverage for interactive controls.

The coverage scan is diagnostic only. It does not register actions, and an undeclared control remains unavailable to the agent.

### Model calls

Each retained call contains:

- turn number, completion status, duration and context tokens;
- the request messages exactly as the loop sent them;
- the function tools sent with that request;
- the response text and tool calls;
- the page snapshot attached to that call;
- the error code and message when the call failed.

The page projection can change after the call. The snapshot under **Page at this call** preserves what the model actually saw, which is usually the deciding piece of evidence.

## Read a trace

A normal sequence has three requests: the user instruction, the tool result, and the final answer. When investigating a failure, compare them in order.

1. Find the instruction in the first request.
2. Check whether the intended action appears in the tool list and in the page snapshot attached to that request.
3. Read the tool call and its result in the next request.
4. Check the final snapshot for the state the model believed it left behind.

This order separates three different failures that otherwise look alike:

- the action was never exposed;
- the action was exposed, but the model chose the wrong one;
- the model chose the right action, but execution did not produce the expected state.

## Sensitive values

The inspector displays outbound content, not a decoded convenience view. Sensitive values that the page tokenized remain tokens such as <code v-pre>{{p:…}}</code>. Opening the inspector does not restore their real values.

If a value must not be visible to a developer using the chat, keep it out of the model context through Pling's sensitive-data declarations. A debug switch is not a privacy boundary.

## Deterministic tests beside the inspector

Use replay or scripted model output for tests that must be stable and offline:

```ts
const llm = createReplayLlm([
  { toolCalls: [{ id: "call_1", name: "toggle", arguments: { record: "t2" } }] },
  { content: "Marked as done." },
]);
```

Assert the resulting page state, the execution result and the next request's tool list. Keep a small number of real-model checks for behavior that depends on model judgment; do not make the main suite depend on a remote provider.

The inspector is for the questions tests cannot answer in advance, especially the exact request that led to an unexpected decision.

## Common failures

### The action is visible to a person but absent from the tool list

Check the current page projection and coverage. If the control is undeclared, it is intentionally unavailable. If it is inside a closed dialog or inactive region, satisfy that condition first. The inspector should not be used to add an escape hatch around the declaration model.

### The model calls the wrong action

Compare action descriptions, region paths and record folding in the request snapshot. Two controls with similar names need descriptions that distinguish their effect, and a broad region description is often more useful than another synonym in the action label.

### The call succeeds but the page does not change

Read the action receipt before looking at the model's final sentence. `changed` reports what the framework observed; an expectation failure means the action was sent but the declared postcondition was not met. The request snapshot shows whether the page actually exposed that postcondition.

### The request is larger than expected

Inspect records, action folding and the page data section first. The trace reports context tokens per call, making growth visible after navigation, filtering, or repeated tool results.

## Boundaries

The inspector is deliberately limited:

- it reads the existing runtime and registry, and never creates another one;
- it provides no execution controls;
- it keeps only the most recent calls in memory;
- it records main-loop model calls, not history-compaction calls;
- it covers the Vue entry point today; the underlying trace lives in `@plingjs/agent` and can be surfaced by other adapters.

For audit, billing or long-term diagnosis, use the runtime telemetry and server-side audit records. The inspector answers a development-time question: **what did this conversation see and send?**

## Check it locally

The Vue 3 example enables the built-in inspector with a bounded call history:

```bash
pnpm --filter @plingjs/recipe-vue3 dev
```

Send a task, open **Activity**, and choose the debug icon. Clear the conversation and confirm that the retained calls disappear with it.
