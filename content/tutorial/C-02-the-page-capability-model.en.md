---
id: C-02
title: The page capability model
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# The page capability model

A Pling-enabled page does not hand an agent its DOM tree or its backend API. It exposes a smaller business model: the operations the page can perform, the objects those operations may affect, the regions that give those objects meaning, and the state that explains the current situation.

This model determines what an agent can understand and call. The execution lifecycle, the projection rules, and the protocol that carries the model to an external client are separate concerns. This chapter defines the model itself.

## Four kinds of information

The page capability model has four parts. They describe the same page from different angles rather than creating four copies of the application.

| Part | What it describes | Can it change business state? |
| --- | --- | --- |
| Action | A business operation the page is prepared to perform | Yes, through the page's existing execution path |
| Record | A business object that an action may target and an agent may read | No |
| Region | A meaningful area of the page that groups actions and records | No |
| State | A read-only view of information needed to interpret the current task | No |

Only an action can cause a business change. Records identify what may be acted on, regions explain where it belongs, and state provides current context. Keeping those responsibilities separate prevents an agent from treating visible data as an executable operation.

## Actions

An action answers one question: what can this page do? Its identity comes from business intent, not from the control that happens to trigger it. “Add a task”, “mark a task complete”, and “delete a task” are actions. “Click the third button” is not.

An action definition needs enough information for an agent to choose it and call it correctly:

- a stable id that does not depend on a row position, label, or DOM node;
- a description of the business intent and consequence;
- the inputs the caller may supply, with their types and limits;
- the kind of target it operates on, if it acts on a business object;
- whether it is currently available, and why it is unavailable when it is not;
- the risk and approval policy associated with the operation.

The action may be implemented by a button, an input control, a menu item, or a page function with no dedicated DOM element. Its meaning remains the same; only the execution mechanism differs.

An action family can cover repeated operations on records. For example, a page with one hundred tasks does not need one hundred separate “toggle” actions. It exposes one operation shape and a record parameter, while the one hundred stable record ids identify the possible targets. This keeps the capability list proportional to the number of business operations rather than the number of rendered rows.

Availability is not permission. An action can be declared, visible, and still unavailable because a prerequisite is missing. It can also be available on the page while the current session is not authorized to invoke it. The first condition explains what the user can do next; the second remains an authorization decision.

## Records

A record is a business object, not a table row. An order remains the same order after the table is sorted, filtered, or re-rendered. A task remains the same task after its position changes. The record id carries that identity, so the model can refer to the object without depending on where it appears on screen.

A record may provide:

- a stable business id;
- a short label for human and model orientation;
- a bounded set of fields relevant to the current decision;
- the region it belongs to.

A record is read-only. Seeing a record does not create an operation to edit it. If the page has not declared a write action, the agent can read the object but cannot change it.

The field view is deliberately smaller than the underlying object. A page may expose the status, amount, and due date of an order without exposing its internal database row, audit history, or credentials. Values can also be masked or replaced by references when the task only requires comparison rather than disclosure.

Record identity and record detail have different limits. A long list may carry ids for the active set while returning fields for only a subset. This allows an agent to target an object outside the viewport without loading every field of every row into the model context. The runtime resolves the id again before execution.

## Regions

A region gives a business boundary to a group of actions and records. A toolbar, a list, a form, a detail panel, and a dialog are different regions because they answer different user questions. A region is not a CSS box, a coordinate range, or a visual style.

Each region can provide an id, a human-readable label, a description of its purpose, its structural role, and its parent region. Those values form a page map. The map is useful when two controls use the same label: “Confirm” in a payment dialog and “Confirm” in an address form can carry the same words but different region paths.

Regions also define the scope of visibility. A region can report how many actions are currently available, how many are visible, and whether more content can be revealed. A collapsed list or a modal dialog can therefore tell the agent that something is missing from view without pretending that it does not exist.

Region membership does not grant authority. It affects how the page is described and which content is active for the current observation; it does not replace a permission check.

## State

State is a read-only view of the information needed to interpret the page. Useful examples include the current filter, the selected record, the active page number, the total number of matching records, or whether an edit form is open.

State is not the application store. Exposing the whole store would add internal keys, transient values, and unrelated data to the model context. A page should expose views with names and descriptions that make sense in the business task: `filter: "open"` is useful; a raw object containing every reactive field is not.

State is bounded and sanitized in the same way as record fields. Long strings, deep objects, and large arrays are limited or summarized. Sensitive values can be masked or represented by references. A state view may be omitted when the task does not need it.

State cannot be written directly. A selection, filter, or form value changes when the agent invokes an action that performs the corresponding business operation. This preserves validation, confirmation, and audit on the same path as human interaction.

## How the four parts fit together

The following page map describes a Todo page:

```text
Page
├─ Toolbar region
│    └─ action: add_todo(text)
├─ List region
│    ├─ records: t1, t2, t3
│    └─ actions: toggle(record), remove(record)
└─ State: filter = open, shown = 3, total = 12
```

The relationships are directional:

- An action may target a record by id. “Mark milk as done” selects `t1` and invokes `toggle` with that record.
- A record does not imply an action. The page may expose records for reading while offering no operation to modify them.
- A region groups actions and records that belong to the same business area. It can also provide the scope used to decide which of them are currently active.
- State describes the page as a whole or the current task. It does not replace record fields and does not target an object.

Suppose the user says, “Delete the second task.” The agent reads the visible records, identifies the second object as `t2`, and calls the delete action with `record: "t2"`. It does not send “row 2” or a selector. If the list is sorted again before execution, the runtime still resolves `t2` as the same task.

Suppose the user says, “Show only open tasks.” The agent invokes the filter action. The filter value then appears in state on the next observation. The agent does not directly assign the filter variable.

These distinctions also explain why a page with many rows remains usable. Records provide enough data to choose an object; one action family accepts the chosen record; the region reports that more rows exist; and state explains the current list conditions.

## Invariants

The model remains reliable only if the page preserves a small set of rules.

1. **Identity is business identity.** Record ids and action ids come from stable business concepts, not DOM ids, row indexes, or random render keys.
2. **Read and write are separate.** Records, regions, and state describe; only actions change state.
3. **Declaration is not permission.** Exposure says what the page is willing to show or call, not who is allowed to call it.
4. **Unavailable is not absent.** An operation that exists but cannot run now should carry a reason. An operation that was never exposed is outside the model.
5. **Every view is bounded.** Actions, records, regions, and state expose only what the current task needs. Omission must be stated when it affects the agent's next decision.
6. **No undeclared fallback.** If no action exists for a task, the framework does not turn the record, region, or state into an implicit write operation.

## Summary

The page capability model separates four concerns: actions describe what can be done, records identify the business objects involved, regions give those objects business context, and state explains the current situation. Only actions can change state. All four views are bounded, stable, and read-only where they describe rather than execute. This separation keeps an agent's decisions tied to declared business operations instead of DOM details or internal application structure.
