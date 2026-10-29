---
id: S-02
title: Designing safe capabilities
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# Designing safe capabilities

In this chapter, a capability is a business operation that a page declares to external agents. An agent client often presents that capability as a tool, but the tool description is only the entry point; the page still performs the operation.

Publishing a capability is therefore an external promise: what the operation does, which target and inputs it accepts, and which checks precede execution. A tool description cannot repair an operation that is ambiguous, unbounded, or authorized only in the browser.

Consider an order management page with four actions: view an order, edit its note, approve it, and delete it. They look similar in the interface, but their consequences differ. This chapter uses them to show how to decide what to expose and how to describe it.

Safety is not a property of a capability in isolation. The same action may be acceptable for a support agent handling one ticket and unacceptable for an anonymous client or a bulk export. The decision has to account for the user, target, scope, and consequence.

## Start from a business operation

A capability should correspond to an operation the application already understands and can execute. “Update the note on order SO-1002” is an operation. “Click the save button in row 42” is a rendering instruction. The first can survive sorting, scrolling, and component re-renders; the second cannot.

If the only accurate description of an action contains a selector, a visual position, or a sequence of DOM events, the action is not ready to become a capability. Either the page should expose the underlying function, or the task should remain with DOM automation. Wrapping an uncertain click in a tool schema does not make its result reliable.

The same test applies to compound operations. “Save and publish” combines two outcomes with different consequences. An agent that only needs to save should not be required to acquire publication rights. When targets, effects, or approval requirements differ, split the operation.

## Define three boundaries

Every capability needs an explicit target, input surface, and consequence.

| Boundary | Question | Design requirement |
| --- | --- | --- |
| Target | Which record or page object is affected? | A stable business id, validated against the current session and context |
| Input | What values may the caller supply? | A schema with types, allowed values, and limits |
| Consequence | What can change, and who must approve it? | An honest effect, confirmation policy, and human-step declaration |

The target should be a business object the page can resolve again, not a coordinate or a transient element. For example, `SO-1002` remains the same order when the list is sorted, filtered, or re-rendered; a table row index does not.

A capability without a stable target is usually a bulk operation in disguise. `delete_rows` with an arbitrary list of ids is materially different from `delete@order` with one record, even if both eventually call the same backend endpoint. The one-record version can be scoped, previewed, and audited; the arbitrary list needs additional constraints.

The input surface is described by the capability's `inputSchema`: the fields a caller may supply and which of them are required. It should express the business contract, not accept a generic command object. A free-form `payload: object` accepts values the page has never designed for. A typed `note: string`, `status: "pending" | "approved"`, or `delivery_date: date` keeps the operation within business rules. The page and backend still validate the values; the schema only makes the accepted shape visible.

The consequence is the part that happens after the page accepts the call. It is not the same as the HTTP method or the widget that triggered it. The section “Express the consequence with effect, approval, and handoff” describes how the current capability descriptor expresses consequences through those fields.

## Name and scope the operation

Use a stable identifier that names the business intent. Keep it independent of labels, row positions, and component names.

```text
read_order               read one order
update_note@order        update one order note
approve@order            approve one order
delete@order             delete one order
```

The `@order` suffix marks a family of row actions. The capability list contains one template for that family, not one entry per row. The concrete target comes from the record ids in the current context (`context.recordIds`) and is passed when the capability is invoked. This is what keeps a hundred visible rows from producing a hundred tools.

Do not put user-generated text, email addresses, DOM ids, or random render keys into capability ids. Those values change, leak information, and make audit records unstable. If two rows have different business semantics, they need different operations; if they have the same semantics, one template is enough.

Scope should follow business structure. A support page can expose order lookup and note editing without exposing refunds or account deletion. A session can be narrower still: one agent may read a customer's orders but not export them. Here, a session is the verified relationship between a user, an agent, a set of allowed capabilities, and an expiry time. The page-level declaration is the upper bound; the session scope is an additional limit. Neither is a substitute for authorization over the specific record.

## Make the input narrow

The current capability schema uses an object-shaped `inputSchema` with `properties` and `required` fields. It should reject values the business cannot support, not merely describe them after the fact.

A useful input has these properties:

- required fields that identify the operation and target;
- types and enumerations for values with a closed set of choices;
- length or range limits for free text;
- no credentials, tokens, or secrets;
- no selectors, scripts, SQL, or arbitrary URLs;
- no client-controlled flags that bypass a server check.

For example, a note update should accept a record id and a note. It should not accept `force: true`, `skip_approval: true`, or an HTML fragment whose meaning depends on the page's rendering. A status transition should accept a named status such as `approved` or `rejected`, not a numeric database value whose meaning can change.

The client does not become trusted because it supplied a valid schema. The page validates the target and input, and the backend rechecks permission, state, ownership, and any business invariants. Schema validation narrows the request; it does not authorize it.

## Express the consequence with effect, approval, and handoff

The consequence is represented by three related but distinct fields:

| Field | Values | What it means |
| --- | --- | --- |
| `effect` | `read`, `write`, `destructive` | The kind of business change the operation may produce |
| `approval` | omitted, `ask`, `always` | Whether the caller must obtain confirmation before execution |
| `handoff` | `{ reason }` when present | A step that a human must complete; the agent cannot do it |

`effect` describes the intended business change. `read` means the operation is intended not to change business state; it does not mean the data is harmless. An export can disclose customer records without modifying a row. `write` covers ordinary state changes. `destructive` covers operations whose effects are irreversible or unusually costly to undo.

`approval: "ask"` asks the user before execution and may allow a session to remember permission for the same action shape. `approval: "always"` asks on every invocation and does not offer “always allow”. Omitting `approval` means the descriptor does not require an additional confirmation; it does not mean the backend has authorized the call.

`handoff` is not a stronger form of approval. Approval answers “may the agent do this?”; handoff answers “the user must do this part”. Entering a one-time code, choosing a local file, signing a document, or completing a payment confirmation are human steps. An agent waiting for a handoff cannot substitute its own value for the human action.

The appropriate combination follows the consequence. A note edit may be a `write` with `ask`. Approving a high-value order may still be a `write`, but with `always`. Deleting an order is `destructive`; a second approver or a human confirmation may be required in addition to the confirmation shown by the protocol.

The same page can therefore produce several classifications without changing its visual structure:

| Capability | `effect` | `approval` | Reason |
| --- | --- | --- | --- |
| `read_order` | `read` | omitted | Returns a bounded field set for one scoped order |
| `update_note@order` | `write` | `ask` | Changes a visible note with ordinary business impact |
| `approve@order` | `write` | `always` | Commits a high-consequence state transition |
| `export_orders` | `read` | `always` | Discloses a data set without changing its rows |
| `delete@order` | `destructive` | `always` | Hard to recover and requires an explicit target |

Reading is not automatically low risk. An operation that returns an entire customer record, a full export, or another user's data needs a narrow session scope and bounded context even though it does not write. If a read cannot be limited to the fields the agent needs, it should not be exposed as a general capability.

## Treat destructive operations as exceptional

Destructive design starts with the target and blast radius. A single-record operation is easier to review than a bulk operation because the page can resolve one object, verify its current state, and produce an unambiguous result. Bulk operations need explicit counts, a preview, a hard upper bound, and a separate human decision.

Do not rely on the protocol's `request.id` as business idempotency. Business idempotency means that repeating the same business operation produces one effect, not several. Replay protection only rejects the same request id within a configured window; it does not make a financial or inventory operation safe to retry after the window, after a transport failure, or under a new request id. The business backend must enforce its own idempotency, transaction boundaries, and state checks.

Where the domain allows it, prefer two steps: prepare an operation and then commit it against a specific prepared object. The protocol can carry approval and structured results for each step, but the page and backend must define what “prepared” means and when it expires. A generic “delete everything selected” tool should not exist.

## Actions that should not become tools

Some operations cannot be made safe by adding a confirmation prompt. They remove the boundary that makes capability review meaningful.

Do not expose:

- general DOM selection, clicking, script evaluation, or browser control;
- arbitrary HTTP, SQL, shell, filesystem, or code-execution operations;
- raw credentials, session tokens, API keys, or delegation secrets;
- operations that grant, revoke, or escalate permissions for the calling agent;
- client-controlled flags that bypass server authorization or approval;
- unrestricted bulk deletion, bulk export, or navigation to arbitrary destinations;
- hidden side effects that the capability description does not state;
- write operations inferred from button text or DOM shape without the page author declaring their meaning.

The last case deserves emphasis. A framework may derive an action from a button label and offer it to an in-page assistant. That inference can be useful for observation, but it is not an authored contract. The `source` and `fidelity` fields show whether an action was declared or inferred and how reliable its target is; they do not upgrade an inferred write into a safe one.

Some business operations in the prohibited categories can still have a legitimate human workflow. An administrator may grant a role, and a user may authorize a payment. Those workflows should be designed as explicit page and backend processes, not as generic tools handed to an autonomous agent.

## Review checklist

Before declaring a capability, answer these questions. A “no” is a stop sign, not a prompt to improve the tool description.

1. Can the operation be described in one sentence without referring to a selector or screen position?
2. Is the target a stable business id that the page can resolve and revalidate?
3. Is the input schema narrow enough to reject values the business does not support?
4. Is `effect` classified by the real consequence, including data disclosure from reads?
5. Does the approval policy match the consequence, and can the agent approve itself? It must not.
6. Is a required human step represented as `handoff` rather than simulated by the agent?
7. Does the backend independently enforce authorization, ownership, state, and idempotency?
8. Is the operation safe under repetition, retry, and concurrent sessions?
9. Are returned fields and records limited to what the task needs?
10. Does failure close the operation rather than returning a plausible but unverified success?

## Summary

A safe capability is a narrow business operation with an explicit target, bounded input, honest consequence, and a clear decision path for approval and human work. The protocol fields make these decisions visible to clients; they do not enforce them by themselves. Page validation, backend authorization, and business idempotency remain part of the design.
