---
id: V3-04
title: "Inspect one agent run"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Inspect one agent run

The first Todo agent path works. The page shows that a task was added or a row was completed, but the visible result does not explain the process. Which tasks did the model see, which tools did it receive, why did it choose one, and why did it miss another?

This chapter opens Pling's read-only run inspector. It shows the system prompt, tool list, and messages received by each model call, together with the page snapshot at the time of the request.

No page capability changes in this chapter. The Todo business remains the same. The goal is to make agent behavior directly observable in the rest of the tutorial and during debugging, rather than inferred from the final reply.

## Why inspect the request

The same visible failure can have different causes. If the model cannot find an action, the control may never have been declared. If it chooses the wrong action, the description or region may be ambiguous. If an action runs without a visible effect, target resolution, a business precondition, or a result check may be responsible. Changing the system prompt cannot distinguish these cases.

Browser developer tools show network requests, but do not necessarily pair a request with the page state the runtime used. Pling's inspector reads the same data the run already assembled, so it can answer three questions directly:

1. What did the page expose when this call was made?
2. Which rules, tools, and conversation messages were actually sent?
3. What did the model return, and what did the next step receive?

The inspector is a development tool, not a replacement for a debugger. It does not execute actions, modify the page, or prove that a business operation succeeded.

## Enable the inspector

Enable `debug` explicitly on the assistant entry:

```vue{3}
<AgentDock
  title="Todo assistant"
  :debug="{ maxCalls: 8 }"
/>
```

`maxCalls` bounds how many model calls remain in memory. The default is the latest 20 calls; `maxCalls: 8` is useful for a tutorial or ordinary debugging.

To use the default bound, write the attribute without a leading colon:

```vue
<AgentDock debug />
```

This is equivalent to `:debug="true"`. Writing `:debug` without an expression is not valid Vue template syntax.

The option is off by default. It places the page projection, conversation content, and model requests inside the current chat surface, where anyone who can open that surface may see them. The inspector is not a privacy boundary. Do not enable it by default in production; gate it by build mode, role, or environment.

## Open the run record

Start this chapter's fixture, open the assistant, and send one real task first. Then:

1. Open **Activity** at the top of the assistant.
2. Choose **Diagnostics** next to the execution log heading.
3. Expand the latest model call.

The current page projection is available immediately. Model calls, messages, tools, and responses appear only after at least one request.

The inspector preserves two views of time:

- the current page projection: regions, actions, unavailable actions, records, and state at the moment the inspector is opened;
- the page snapshot for each call: what the model saw when that request was made.

The page continues to change after actions run. For diagnosis, the request-time snapshot is usually the more important view.

## What one request contains

The inspector separates a model call into parts that come from different places and have different lifetimes.

### system: stable rules and the current page

Every system message combines the stable agent rules with page context rebuilt from the current snapshot. That context may include page identity, the region tree, available actions, records, page feedback, hidden content, and explicitly exposed state.

### Application prompt and response language

The stable operating rules come from Pling. The application may add a short identity statement. The Todo fixture sets it beside `createPling`:

```ts{4}
const pling = createPling({
  agent: {
    config: {
      systemPrompt: "You are the assistant for a small Todo app. Keep answers short.",
    },
  },
});
```

Pling appends this statement after its operating rules under `## This application`; it does not replace them. If no application prompt is configured, the section is omitted.

The application prompt does not choose the response language. Pling already tells the model to use the language of the person's most recent message. When the interface is in Chinese, the runtime also adds a Chinese-language instruction for that request unless the person writes in another language. Keeping language policy in the framework prevents an application-specific prompt from contradicting the interface or the person.

For another application, replace this text with its identity and business constraints. Ownership, approval policy, and domain rules belong here; action ids and control-level procedures do not.

The following is a trimmed example, not the complete prompt:

```text
## This application
You are the assistant for a small Todo app. Keep answers short.

## Page structure (regions)
- main "Tasks" (todo): The task list and the form for adding a new task.; in viewport; actions 6/6

## Available actions on this page
- composer_text [type] (write, region: todo): Enter the text for a new task in this field.
- composer_submit [click] (write, region: todo): Add the text in the new-task field to the task list.
- toggle [record] (write, region: todo): Mark “{record}” as completed or open.

## Records on this page
- 1. t1: text Review the launch checklist; status open
- 2. t2: text Book the design review; status open
- 3. t3: text Send the customer follow-up; status completed
```

This shows where the earlier declarations went. `v-scope` appears in the region tree, `v-tool` in the action list, and `v-record` in the record section. They are not copied into every user message; they are assembled into the system message for the current turn.

The system message is rebuilt on every turn. After an action, the next request sees updated records, available actions, and page feedback. Stable rules are not duplicated, while changing page facts are not left in an old snapshot.

### tools: the functions the model may call

`tools` is a request field alongside `messages`. Each tool has a name, description, and parameter schema. The inspector's tool list comes from the current action projection, not from a second hand-written definition.

Repeated row actions are folded. Three actions named `toggle@t1`, `toggle@t2`, and `toggle@t3` project to one `toggle` tool with a required `record` argument. The model does not have to choose among nearly identical function names.

The text action list in the system message and the function schemas describe the same capabilities for different purposes. The text helps the model understand the page; the schemas constrain the actual call.

### messages: the assembled conversation

`messages` holds conversation history, usually including:

- the user's original request;
- the assistant's reply when it requests tools;
- each tool result linked to its call id;
- earlier assistant answers.

The user request is one `user` message. The full page snapshot is not appended to it. Page state comes through the current turn's system message, so the same conversation can continue as the page changes without repeatedly adding DOM text to user messages.

A typical intermediate call looks like this:

```json
[
  { "role": "user", "content": "Mark “Book the design review” as completed." },
  {
    "role": "assistant",
    "content": "",
    "toolCalls": [{ "id": "call_1", "name": "toggle", "arguments": { "record": "t2" } }]
  },
  {
    "role": "tool",
    "toolCallId": "call_1",
    "name": "toggle",
    "content": "The execution result and observable page changes"
  }
]
```

The real fields and tool result contain more information. The inspector shows what was sent to the model, not the interface summary.

### response: the model output for this turn

The response section shows returned text and tool calls. Without a tool call, the text is usually the final answer. With a tool call, the text may only introduce the action, while `tool_calls` contains the operation.

Read it in sequence: first what the response chose, then what the next request added as a tool result, and finally whether the page and the final answer agree.

## Follow a multi-call run

Adding one task usually takes more than one model request. The inspector shows a sequence like this:

| Call | What the request adds | Model choice |
| --- | --- | --- |
| 1 | The user request to add a task | `composer_text` |
| 2 | The tool result from the first step | `composer_submit` |
| 3 | The submit result and an updated snapshot | A final text answer |

Each call has its own request-time snapshot. The first call does not see the submit action because the native button is disabled while the input is empty. By the second call, the text has been entered and `composer_submit` is in the action list.

Completing an existing task is usually shorter: the model finds `t2` in the records, calls the folded `toggle` tool, and confirms the result. As action declarations and flows become more complex, the number of calls changes. Do not assume a fixed count; follow the actual trace.

## Read calls together, not only the last one

The inspector is most useful for three classes of question.

### The action never appears

Start with the request-time page projection. Was the action declared, and did it fail to enter the available list because it was disabled, invisible, covered, or blocked by a business precondition? An action available now may not have been available during an earlier request.

### The model chooses the wrong action

Compare the region path, action description, and record fields in the system message with the names and parameters in `tools`. Two similarly named buttons need distinguishable regions or outcomes; otherwise the model has to rely on weaker clues.

### The action runs but the page does not change

Read the execution result first, then any visible `changed` evidence, then the next request's page snapshot. The cause may be the target element, business logic, an asynchronous update, or data the page never exposes. Do not decide from the assistant's wording alone.

## Boundaries

The inspector currently has three important limits:

- read-only: it provides no execution controls and does not create a second runtime;
- bounded: it keeps only the latest model calls in memory and clears them with the conversation;
- development-oriented: it does not replace server audit, billing, limits, or long-term observability.

Model-call records consume memory. When a page handles sensitive data, the inspector also shows the actual outbound content. Tokenized values stay tokenized, but the page projection and conversation may still contain sensitive context. Decide per environment whether it may be opened.

## Run and verify

Start the chapter fixture from the repository root:

```bash
pnpm tutorial:dev v3-04
```

Open:

```text
http://127.0.0.1:5197/
```

Check the following:

1. Send: `Add “Reply to the customer” to my tasks.`
2. Open **Activity**, then **Diagnostics**.
3. Expand the first call. Confirm that the system message contains the Tasks region and task records, and that `tools` contains `composer_text`.
4. Expand the second call. Confirm that `messages` contains the first tool result and that `composer_submit` has appeared in `tools`.
5. Expand the final call. Confirm that the model answers from the updated page.
6. Send `Mark “Book the design review” as completed.` and confirm the folded `toggle` tool and its `record` argument.
7. Clear the conversation and confirm that the trace disappears with it.

For the Chinese interface, run `pnpm tutorial:dev v3-04 --locale zh` and open `http://127.0.0.1:5197/?lang=zh`.

## Common problems

| Symptom | Likely cause | Correction |
| --- | --- | --- |
| There is no Diagnostics entry in Activity | `debug` is not enabled | Pass `:debug="..."` to `<AgentDock>` |
| The page projection exists but there are no model calls | No request has run, or the conversation was cleared | Complete one task before expanding a call |
| The submit action is missing | The input was empty when the request was made and the button was disabled | Compare with the next call's page snapshot |
| `tools` has fewer entries than the action list | Row actions are folded | Inspect the folded tool's `record` argument and the record list |
| Sensitive values are not restored | The inspector shows outbound content | Expected; this is not a privacy boundary |
| Older calls disappear | The `maxCalls` bound was reached | Raise the bound or reproduce with a smaller run |

## Next step

You can now see the page, tools, and messages the model actually received. The next problem is not whether the agent works, but how closely a declared operation can match a person's intent.

The next chapter combines “fill the input” and “click submit” into one `add_task` action, with declared arguments, availability, and a success expectation.
