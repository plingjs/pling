---
id: R-04
title: "Inspect one agent run"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Inspect one agent run

The Todo assistant from the previous chapter can already read the page and use its controls. When it works, the result looks simple: a task appears, a row changes, or the assistant says it could not finish.

The result does not explain how the agent reached that point. A missing action may be undeclared, unavailable, covered, or outside the active region. A wrong action may come from an ambiguous description. A successful tool call may still leave the page unchanged. To fix any of these, you need to see what the model actually received.

This chapter adds a read-only inspector to the existing React demo. It does not add a page action or change the Todo workflow. It exposes the page projection, tool schemas, conversation messages, and model response used by the current run.

## Why the final answer is not enough

Consider three failures that can produce the same sentence from the assistant:

| What the user sees | What may have happened |
| --- | --- |
| “I could not find a way to add the task.” | The submit action was not declared, was disabled, or was outside the active region. |
| The assistant uses the wrong row action. | The record fields or action descriptions did not distinguish the rows. |
| The assistant says it added the task, but the list does not change. | The model chose the wrong control, or the page did not render the requested change. |

The assistant's wording is not evidence for any of those causes. The inspector is.

It answers three narrower questions:

1. What page facts were available at the moment of the request?
2. Which messages and tool schemas were actually sent?
3. What did the model return, and how did that result enter the next request?

Those questions are useful because they separate the page from the model. If an action is absent from the request, no prompt change can select it. If an action is present with a weak description, the page integration needs work. If the tool result is correct but the next request is built from stale data, the problem is in the runtime or the page update.

## Enable the inspector in the React demo

The quick-start page already renders `<AgentDock>`. Add one prop:

```tsx{4}
<AgentDock
  title={copy.dockTitle}
  quick={copy.quick}
  debug={{ maxCalls: 8 }}
/>
```

`debug` is off by default. Passing `true` enables it with the default bound of the latest 20 model calls. Passing an object also enables it and sets the bound explicitly; `maxCalls: 8` is enough for this tutorial and keeps memory use predictable.

The inspector shows outbound conversation content and the page projection exactly as the runtime used them. Enabling it in a public build would let anyone who can open the assistant inspect that data. Gate it by environment, build flag, or role. It is a development surface, not a privacy boundary.

No other React component or declaration changes.

## Find the two views in Activity

Open the assistant, send one task, then switch from **Chat** to **Activity**. Select **Diagnostics** at the top of the execution log.

The inspector contains two time perspectives:

- **Page projection** reflects the registry when you open the inspector. It shows the current page identity, actions, unavailable actions, regions, records, state, and feedback.
- **Model calls** contain a snapshot captured immediately before each request. This is the page the model saw at that moment.

The distinction matters after an action. The current page may already contain a newly enabled submit button, while the first request could not see it. When diagnosing a decision, read the request-time snapshot first.

The inspector has no Run button and no action controls. It uses the runtime already driving the conversation; it does not create a second agent session. Its only button refreshes read-only projection data.

## What one request contains

Model APIs are stateless. Every call must carry the full instruction set and conversation state the model needs. Pling assembles four layers:

| Layer | Where it comes from | What it answers |
| --- | --- | --- |
| `system` | Stable operating rules, the application's role prompt, the current page projection, and the response-language rule | How should the model behave, and what does the page look like now? |
| `tools` | The action schemas projected from the same snapshot | Which operations can be called in this request? |
| `messages` | The user request, earlier assistant messages, assistant tool calls, and tool results | What has happened in this conversation? |
| `response` | The model's content and tool calls for this request | What did the model choose? |

The application prompt from `createPling` appears inside the system message under `## This application`. The framework's operating rules remain above it. When the interface is Chinese, the runtime also adds an instruction to answer in the user's most recent language; the application prompt does not need to duplicate that policy.

The page section is rebuilt for each request. Conversation history is stored separately, and the current system message is assembled at request time. Pling therefore does not accumulate one copy of the page for every turn. The stable instructions stay at the front of the system message and the changing page facts follow them. Some model providers can reuse that unchanged prefix for prompt caching; the inspector does not assume or report such a cache.

For each call, the inspector groups the outgoing conversation under **Request messages**. This is the exact message array sent to the model, not a reconstructed summary.

Page content is data, not instructions. Text from records, feedback, or tool results must not be able to rewrite the operating rules merely by appearing in the context.

## Read a real multi-call run

Use this request in the English demo:

> Add “Reply to the customer” to my tasks.

The page in this chapter still uses two native controls: a text input and a submit button. The submit button is disabled while the field is empty, so the agent usually needs more than one model call.

A typical run looks like this:

| Call | What the request adds | What the model chooses |
| --- | --- | --- |
| 1 | The user request, the Tasks region, records `t1`–`t3`, `composer_text`, and the folded row action `toggle` | `composer_text` with the new task text |
| 2 | The earlier assistant tool call, its tool result, and a new page projection where the input now has text | `composer_submit` |
| 3 | The submit result and the updated records | A short final answer |

The first request does not advertise `composer_submit`, because the button is disabled before text is entered. The second request does. This is not a changing API: it is the same snapshot rule applied at two different moments.

The row action is folded. Rather than sending `toggle@t1`, `toggle@t2`, and `toggle@t3` as three schemas, the tool list contains one `toggle` operation with a `record` argument. The records section supplies the valid ids. Open **Tools sent** to see the schema; open **Page at this call** to see the records that make the id meaningful.

Do not treat three calls as a contract. A model may answer differently, perform more than one tool call in a response, or stop when it cannot proceed. Follow the actual trace instead of comparing the count to a fixed number.

Completing an existing task is usually shorter. The model reads the records, calls `toggle` with a known record id, and then answers from the updated page.

## Ask three diagnostic questions

### The action never appears

Start with the page projection at that call. Was the action declared? Is it under **Unavailable** with a reason? Is its region active? Is the target covered or outside the viewport? An action that is available now may not have been available during the earlier request.

### The model chooses the wrong action

Compare the system message with the tool list. Look at the action id, description, region path, and record fields together. Two controls with similar names need distinguishable outcomes or locations. The tool schema alone often does not carry enough business context.

### The action runs but the page does not change

Read the tool result first, then any change evidence in the execution log, then the next request's page projection. The cause may be the target element, the business handler, an asynchronous update, or data the page never exposes. The assistant's final sentence is the weakest source of evidence.

## Boundaries

The inspector is intentionally narrow:

- **Read-only.** It does not execute actions or provide an alternate execution path.
- **Bounded.** It keeps the latest model calls up to `maxCalls` and drops older entries first.
- **Conversation-scoped.** Clearing the conversation also clears the trace.
- **Development-oriented.** It is not server audit, billing, long-term observability, or a replacement for your browser debugger.
- **Not a redaction layer.** Tokenized values stay tokenized, but other page data and messages may still contain sensitive context. Decide per environment whether the inspector may be opened.

These limits are part of the design. A diagnostic surface that quietly executes, stores indefinitely, or bypasses the normal runtime is no longer merely an inspector.

## Run and verify

From the repository root:

```bash
pnpm tutorial:dev r-04
```

Open `http://127.0.0.1:5244/`. The fixture lives at `examples/tutorials/r-04-inspect-one-agent-run`.

Check the following:

1. Send `Add “Reply to the customer” to my tasks.`
2. Open **Activity**, then **Diagnostics**.
3. Expand the first call. Confirm that the system message contains the Tasks region and the three task records, and that **Tools sent** contains `composer_text` but not `composer_submit`.
4. Expand the second call. Confirm that the messages include the first tool result and that `composer_submit` now appears in the tools.
5. Expand the final call. Confirm that the answer follows the updated records.
6. Send `Mark the first task as completed.` and inspect the folded `toggle` tool plus its `record` argument.
7. Clear the conversation and confirm that the trace disappears with it.

For the Chinese interface, run `pnpm tutorial:dev r-04 --locale zh` and open `http://127.0.0.1:5244/?lang=zh`. The UI labels and demo data change with the locale; API names, ids, and tool schemas do not.

## Common problems

| Symptom | Likely cause | Correction |
| --- | --- | --- |
| Activity has no Diagnostics button | `debug` was not passed to `<AgentDock>` | Pass `debug`, or pass a trace options object such as `{ maxCalls: 8 }` |
| Page projection is present but there are no model calls | No request has run, or the conversation was cleared | Complete one task before opening the call list |
| `composer_submit` is missing from the first call | The input was empty and the button was disabled | Compare the tool list with the next call |
| The tool list has fewer row actions than the page | Row actions are folded into one schema with a `record` argument | Read the records section and the folded tool |
| Older calls disappear | The `maxCalls` bound was reached | Raise the bound or reproduce the run with fewer calls |
| Sensitive text is visible in the inspector | The inspector displays outbound content | Keep it disabled in untrusted environments |

## Next step

You can now see what the model received and what it chose. The next integration problem is more concrete than adding diagnostics: the Todo demo still asks the agent to fill a field and press a separate button.

The next chapter replaces that pair with one business-level action, `add_task`, with a declared input, an availability rule, and a verifiable result. The inspector will make the difference visible: one tool call instead of two, and an explicit success condition instead of an inferred one.
