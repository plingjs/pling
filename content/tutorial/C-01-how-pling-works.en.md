---
id: C-01
title: How Pling works
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# How Pling works

Pling does not connect a model directly to the DOM, and it does not move business logic into a separate agent service. It adds a semantic layer to the existing page: the page states what it can do and which business objects currently exist; an agent uses those declarations to choose an operation, while execution returns to the page's existing event handlers and backend requests.

This is also the main property of Pling: developers do not rewrite the page. They add a small amount of declaration to the buttons, rows, and regions they choose to expose. This chapter describes the parts of Pling, how it understands a page, how it performs an operation, and why the integration remains local.

## The parts of Pling

From a runtime perspective, Pling has four parts. The first two are required for every integrated page; the last two are optional.

| Part | Required | Responsibility |
| --- | --- | --- |
| Page integration layer | Yes | Declares actions, records, regions, and read-only state from the existing page as one business capability model. This is where changes to business components are concentrated. |
| Page runtime | Yes | Maintains the current capability list, builds bounded context, resolves action targets and records, executes actions, and returns results. |
| In-page assistant | No | Runs a model loop and conversation UI inside the page, using the context and actions supplied by the page runtime. |
| Agent Surface | No | Lets an external agent use the same capabilities through `describe` and `invoke` without receiving DOM nodes, closures, cookies, or backend credentials. |

```text
existing page
  ├─ business state / event handlers / backend requests
  └─ Pling declarations
         │
         ▼
     page runtime
       ├─ in-page assistant (optional)
       └─ Agent Surface (optional) ◄── external agent
```

The page, the business backend, and the model are not parts of Pling. The page performs business behavior, the backend authorizes and commits, and the model decides the next step. Pling connects them without replacing any of them.

In the implementation, the page integration layer is provided by `@plingjs/vue`, `@plingjs/react`, or `@plingjs/vanilla`; the page runtime consists of `@plingjs/core` and `@plingjs/dom`; the in-page assistant uses `@plingjs/agent` and optional UI components; and Agent Surface lives in `@plingjs/surface`. A model gateway is a surrounding component; `@plingjs/server` provides one optional thin backend path.

## How Pling understands a page

“Understanding” here does not mean giving the model the full HTML document or asking it to infer buttons from a screenshot. Pling builds a business view from two sources:

- Business semantics declared by developers: what an action does, which input it accepts, which kind of record it targets, which region contains it, and which read-only state helps explain the current task;
- Facts observed by the runtime at the current moment: which records and fields exist, whether an action is available and why, how much content is visible in a region, and which page feedback is present.

For example, a Todo page may be represented as follows:

```text
page: Todo
actions: add_todo(text); toggle (record parameter)
records: t1 “Buy milk” open; t2 “Write the weekly report” done
region: Todo list (3 of 20 rows visible; more can be revealed by scrolling)
state: filter = open
```

Each kind of information answers a different question:

- An action gives the model a stable call entry, with a description for intent and an input shape for parameters;
- A record gives a business object a stable id. The model selects the object by id rather than by row index or CSS selector;
- A region says where an action or record belongs. Two buttons both labelled “Confirm” can carry different region paths instead of being distinguished by wording alone;
- State provides read-only context such as filters, pagination, and selection. Writing still goes through an action.

When content is collapsed or outside the viewport, the context says how much exists and how to continue looking. If the model references a record that is not currently visible, the runtime scrolls to it before checking availability.

Declarations state what the page is willing to expose; they do not grant permission. An operation absent from the capability view is not replaced at runtime by selector clicking or screenshot guessing.

## How Pling performs an operation

An operation starts when the model chooses an action. The page runtime then performs the checks and execution:

1. The model returns an action id and inputs, such as `toggle` with `record: "t1"`.
2. The runtime confirms that the action exists, the current session may use it, the arguments are valid, and the target is currently available.
3. The runtime resolves the record id to the current business object and target element, scrolling it into view when necessary.
4. If the action requires confirmation, execution stops here until the user allows it.
5. The executor follows the page's existing path, waits for asynchronous work, and reads the page after execution.
6. The runtime returns a success or a failure with its reason, and feeds the result into the next context.

“Following the existing path” describes an actual mechanism. An action bound to a button triggers that button's normal click handler by default; an input action writes the value and fires the events the page already listens for; and a developer may provide a `run` function that calls existing page logic directly. The framework does not keep a copied business handler, and it does not bypass the page to modify business data.

The page's own validation, state updates, and backend requests still happen. The backend still decides whether the operation is authorized and committed. Pling's responsibility is to route the agent call through that path and report the result accurately.

## Why the integration is small

The smallest integration adds one description to an existing element. Consider a save button:

```vue
<button @click="submit">Save</button>
```

After integration, it may gain one attribute:

```vue
<button v-tool="'Save the current form'" @click="submit">Save</button>
```

`@click="submit"` has not changed. Neither has the `submit` function, the form state, or the backend request. If the model must choose an object by row, the list row also receives `v-record`; if the module needs context, an optional `v-scope` names it; if filters or pagination matter, a read-only state view exposes them. An operation with no DOM element can be registered as a function-level tool and still uses the same execution and confirmation path.

The application entry usually installs the plugin once. If the page needs an in-page assistant, it mounts one entry component. Business code does not switch to a Pling state container, and existing CRUD APIs are not exposed to the model.

Small integration therefore means declarative, local, removable changes. Developers still add enough information for an agent to know what the page can do, but they do not move business logic. Removing the declarations leaves the original page working as before.

## One operation from start to finish

Suppose a Todo page contains three tasks and the user says: “Mark milk as done and add bread.”

1. The page runtime produces context containing the records `t1`, `t2`, and `t3`, the current filter, and the available actions.
2. The model chooses `toggle` and supplies `t1` as the record.
3. The runtime checks the action and arguments, resolves `t1`, confirms that the checkbox is available, and triggers the checkbox's existing click handler.
4. The page updates the task state. The runtime returns the changed record and the newly available actions.
5. On the next turn, the model chooses `add_todo` with the text “bread”.
6. The page updates again, and the agent reports the result to the user.

The responsibilities remain distinct:

| Role | Responsibility |
| --- | --- |
| Model | Choose the next step from the goal, business semantics, and current facts |
| Pling runtime | Expose capabilities, build context, validate calls, resolve targets, execute, and report |
| Page | Run existing validation, state changes, and interface behavior |
| Business backend | Make the final authorization and transaction decision |

## In-page assistants and external agents

A page can provide an in-page assistant, an Agent Surface, both, or neither.

An in-page assistant uses the page runtime directly: it reads the capability list and context, then calls the same executor. An external agent receives a serialized bounded view through Agent Surface and calls `invoke`. The entry points differ, but business actions, target resolution, availability checks, confirmation policy, and results come from the same implementation.

An external agent sees only the capabilities and context the page projects. It does not receive page closures, the DOM, or browser session credentials. Surface does not require an in-page assistant, and the in-page assistant does not depend on Surface.

## What is outside the runtime

| Component | Responsibility | Relationship to Pling |
| --- | --- | --- |
| Model | Decide the next step from context and action descriptions | Calls capabilities; does not define them |
| Model gateway | Hold provider credentials, authenticate requests, and proxy model calls | Optional backend path; not part of the page runtime |
| Surface transport | Carry `describe` and `invoke` over MCP, `postMessage`, HTTP, or another channel | A channel for the same contract; not a second executor |
| Business backend | Authorize the user and commit the transaction | Final authority; Pling cannot replace it |
| Browser automation | Operate a page without declared capabilities | A separate path with a different permission boundary |

Two mistakes cross these boundaries: treating a successful protocol response as proof that the business operation was authorized and committed, and treating the action list seen by a model as the page's complete business contract.

## Summary

Pling consists of a page integration layer, a page runtime, an optional in-page assistant, and an optional Agent Surface. Page understanding combines developer-declared business semantics with facts observed by the runtime. During an operation, the model chooses an action, the runtime resolves and executes it, the page follows its existing business path, and the backend retains final authority. Developers add declarations, but they do not rewrite business logic, duplicate state, or create a second backend API.
