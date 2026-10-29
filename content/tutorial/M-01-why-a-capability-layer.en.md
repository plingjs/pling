---
id: M-01
title: Why a capability layer
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# Why a capability layer

An agent can see a button without knowing what business operation it performs, whether the current user may perform it, or what changed afterwards. The common failure in real systems is not that the model cannot click. It is that the page never states, in a machine-readable form, what it permits an agent to do.

A capability layer supplies that missing information.

## A real business operation

Consider an order administration page with a filter panel on the left, an order table in the middle, and an edit dialog on the right. A user asks:

> Change the delivery note on SO-1002 to "deliver by Friday", then save it.

For a person, the task is clear: find SO-1002, open the editor, fill in the note, save, and check that the row reflects the change.

For an agent, the page starts as a set of DOM nodes. From `button`, `input`, and `div` elements alone, it cannot establish:

- which row is SO-1002, or whether the target moves when the list changes;
- which field is the delivery note and which is an internal comment;
- whether Save commits the order or only closes the dialog;
- whether the current user may edit this order, or whether approval is required;
- whether a failed save means validation, permission, network, or stale business state;
- whether a successful response actually changed the order.

If the agent infers from a screenshot and the DOM, it is guessing intent. If it calls an internal API directly, it may bypass validation and approval implemented by the page. If every application writes a private automation script, each integration becomes a one-off project.

## The DOM describes an interface, not a business capability

Consider this button:

```html
<button class="btn btn-danger">Delete</button>
```

The markup does not say which record will be deleted, whether deletion can be undone, whether confirmation is required, whether the current user is allowed to perform it, or what should be observed afterwards. People fill those gaps with domain knowledge, layout, and context. An agent does not have the same reliable priors.

The question is therefore not:

> "How do we make an agent better at clicking buttons?"

It is:

> **"How does a page state which business operations exist, when an agent may execute them, and how the result can be verified?"**

That is what a capability layer answers.

## What a capability layer contains

A capability layer is neither a backend API document nor a chat window. It contains at least four kinds of information.

### Declaration

The page declares the available actions beside its business code: name and meaning, inputs, target record, risk level, and confirmation requirement. A declaration belongs to the application, not to a model prompt. The model may read it; it may not invent it.

### Context

The agent needs facts about the current page: route, visible regions, record window, selection, available actions, reasons an action is unavailable, and which fields must be masked or referenced indirectly. Context should be a bounded business view, not the entire DOM or frontend store.

### Control

"The page declares this action" and "this execution is allowed" are different statements. Control also involves user identity, agent identity, application and tenant, session scope, consent, human approval, and amount or rate limits. The page cannot replace final authorization by the business backend.

### Result

After execution, the agent needs to know whether the action was accepted, which record it affected, what the page observed, and where it failed. Without a result that can be checked, "done" is only a sentence.

## How it relates to other approaches

### Direct backend access

Backend APIs are appropriate for stable service-to-service integration, but they are not a complete expression of page capabilities. An agent must understand internal APIs and may bypass page-level validation, approval, and business constraints. The backend should remain the final authority for authorization and execution; the capability layer gives it an accurate description of the action the user intended.

### Browser automation and vision

CDP, Playwright, and visual agents address how to operate a pixel interface. They are useful for third-party sites that cannot integrate. Inside a controlled application, they still suffer from unstable targeting and results that are difficult to explain. A capability layer does not reject automation; it provides a more precise path where the page can declare one.

### A private in-page assistant

A chat window backed by private APIs can ship quickly, but its capabilities remain locked inside one client. If the same actions must also be available to a user's own agent or a third-party client, the capability model must be separated from that client implementation.

## What changes after adoption

| Role | DOM or private APIs only | An explicit capability layer |
| --- | --- | --- |
| Frontend developer | Every agent integration explains the page again | Declare once beside business code; reuse across clients |
| Application team | Hard to state what an agent may do | An explicit capability scope, risk levels, and failure boundary |
| Agent | Infers from DOM, screenshots, and labels | Reads business declarations and submits arguments |
| User | Sees only the final reply | Sees the target, confirmation, result, and failure reason |
| Security and audit | Inspects API logs only | Correlates session, action, record, and approval |

## The execution loop

```text
Business page
  │ declares actions, records, regions, and read-only state
  ▼
Capability layer
  │ produces bounded agent context
  ▼
Model or agent runtime
  │ selects an action and submits arguments
  ▼
Page executor
  │ availability, confirmation, validation, business handler
  ▼
Result and observable change
```

The important point is not that an agent manipulates the DOM. It operates on business capabilities declared by the page. The DOM is still present; it is no longer the primary source of business meaning.

## What a capability layer does not guarantee

- It does not make an application secure by itself. Backend authorization, tenant isolation, secret management, and database rules are still required.
- It does not prevent an agent with browser-level access from bypassing the contract. It improves the declared path.
- It does not choose the application's risk policy. The business still decides where confirmation, approval, or dual review is required.
- It does not eliminate model errors. It makes those errors easier to bound, observe, and correct.

## When it is worth adopting

A capability layer is usually appropriate when:

- operations have clear business meaning and change real state;
- the same operations must serve an in-page assistant, an external agent, or several clients;
- the team must explain who initiated an operation, which record it affected, and whether it was approved;
- DOM automation is too brittle, while direct backend access would bypass the interface.

For a one-off demonstration, an uncontrollable third-party page, or operations without stable business semantics, browser automation or a human workflow may be the better choice.

## Common misconceptions

**"A capability layer is just another backend API."** No. It describes business actions performed through the interface. A backend API is one implementation.

**"If an action is declared, it can always execute."** No. Availability, session scope, user confirmation, and backend authorization still apply.

**"A capability layer replaces Playwright."** No. Pages that cannot integrate may still require browser automation.

**"A confirmation dialog makes the operation safe."** Not by itself. Confirmation expresses present intent; it does not replace backend checks for authority and high-risk business rules.

## Continue reading

[What Pling is, and is not](/about/mission/what-pling-is-and-is-not) separates the SDK, page runtime, agent, Surface, and specification, and explains which part owns each responsibility.
