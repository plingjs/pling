---
id: J-11
title: "MPA and task continuity"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# MPA and task continuity

In a single-page application, a route change usually leaves the document in memory. The page runtime, conversation, and registry survive. A multi-page application is different: following a link unloads the document, and the next page starts with an empty runtime.

Task continuity addresses that difference without pretending the old page still exists. The next document restores a bounded description of the task, then declares its own controls and observes its own page.

## Define what survives navigation

The same continuity setting is used on both documents:

```ts
export const agentSetup: AgentSetup = {
  continuity: {
    resume: "auto",
    returnOnDone: true,
  },
  config: { limits: { maxTurns: 100 } },
};
```

The checkpoint contains the original goal, a bounded page description, recent messages and events, a summary, the task status, and the page where it started. It does not contain DOM nodes, element references, pending approvals, screenshots, cookies, or raw sensitive values.

The next page rebuilds the system prompt from its own declarations. The model sees the old conversation and the new page snapshot together. It cannot invoke an action merely because the action existed on the previous page.

## Create one runtime per document

Each document creates its own runtime and one dock. The list page declares its rows and links; the detail page declares its form and actions:

```ts
const pling = createPling({ agent: agentSetup });
pling.registry.setPage({ path: "/demo/index.html", title: "Customer follow-up" });

pling.dock({ title: "Customer assistant" });
```

```ts
const pling = createPling({ agent: agentSetup });
pling.registry.setPage({ path: "/demo/detail.html", title: `${customer.name} · Customer detail` });

pling.dock({ title: "Customer assistant" });
```

Continuity works when the documents share the same origin, the same tab, and the same storage key. The default key is `pling:continuity`; use a distinct key when one tab intentionally hosts independent tasks.

One tab should have one surface writing a continuity checkpoint. Two docks that enable continuity in the same tab will overwrite each other.

## Choose how the next page resumes

`resume` has three useful settings:

| Value | Behavior |
| --- | --- |
| `"ask"` (default) | Show a “continue previous task” entry; send nothing until the person chooses it |
| `"auto"` | Send one controlled continuation message after the new page is ready |
| `"off"` | Restore context but do not offer or send a continuation |

`"auto"` does not bypass the agent loop. The model still observes the new page, chooses a declared action, and passes the normal approval and availability checks. It only removes the second request for the original goal.

`returnOnDone` is optional. When it is enabled, the dock returns to the page where the task started after the loop produces a final answer. The destination must be same-origin, and the return action is consumed once.

## Treat an interrupted step as unknown

If the document unloads while an action is running, the conversation may contain an assistant tool call without a matching tool result. Sending that history directly to a model is invalid, and guessing a successful result would be worse.

The restored conversation therefore inserts a synthetic result saying that the document navigated during the step and the outcome is unknown. The model must observe the new page before continuing. This is deliberately conservative: a retry after a real side effect is more dangerous than asking the page what happened.

## Keep business data separate

Continuity carries the task, not the application's data. The example stores its customer data under a business-owned key. The Pling checkpoint is a separate entry.

Do not store authorization tokens, provider keys, or unredacted personal data in either place. A restored conversation is still untrusted input, and a cached page snapshot is not a statement of present business state.

## Run the example

```bash
pnpm tutorial:dev j-11
```

Open `http://127.0.0.1:5276/demo/index.html?lang=en`, or use `--locale zh` for the Chinese copy. Ask the assistant to set Globex's follow-up note to “Friday dinner”. The list page navigates as a normal document, the detail page continues the task, and the finished task returns to the list once.

```bash
pnpm tutorial:check j-11
```

The checks cover real link navigation, the detail page's ordinary actions, restoration of the goal and conversation, an interrupted tool call, one-time automatic continuation, and isolation in a new tab.

## Common failures

**Expecting the DOM to be restored.** Continuity restores task context, not elements. Each document must declare its own capabilities.

**Using continuity for a client-side route change.** A route that does not unload the document should expose its page identity instead; adding continuity duplicates state for no benefit.

**Assuming a restored task is authorized.** The next page still needs an authenticated session, a valid scope, and confirmation for dangerous actions.

**Returning to an arbitrary URL.** Keep the return target same-origin and validate it as part of the task's starting context.

**Storing raw values in the checkpoint.** Checkpoints are long-lived browser storage. Declare sensitive fields as tokens and keep raw values out of conversation and business storage.

Next: [Test and debug vanilla capabilities](/vanilla/test-and-debug-vanilla-capabilities).
