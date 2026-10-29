---
id: M-04
title: From a single-site integration to an open protocol
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# From a single-site integration to an open protocol

When one page serves one in-page assistant, a private bridge is often enough. The page registers an action for the assistant, the assistant invokes it by agreement, and the team can iterate quickly without defining a public standard.

The problem changes when another client must operate the same page. The new client has to relearn the page's actions, and the next page has to adapt to the existing client again. What is missing is not another RPC layer, but shared meaning for four things: what a capability is, what the caller may observe, who may invoke it, and what the result proves.

That is where a protocol earns its place. It exists not because a system is distributed, but because independent implementations must agree on the same facts.

## Where a private bridge stops working

Consider an order page already connected to an in-page assistant. The assistant calls `approve_order` through a private object and reads component state directly. This can work well inside one product, but it ties four concerns together:

- how the page describes an action;
- how the assistant discovers it;
- how both sides represent session and authority;
- how execution results return to the assistant.

When a second client appears, those agreements are either copied or replaced by a near-equivalent. After copying, the page maintains two semantics. After replacement, the same action may imply a different target, confirmation rule, or error behaviour in each client.

Browser automation addresses a different problem. CDP, Playwright, and visual agents can operate an interface without a page contract, which is appropriate when the page cannot or will not declare capabilities. They cannot reliably answer whether a button reads or irreversibly changes state, whether a second approver is required, which records an agent may reference, or whether a failed call already changed business state.

When several implementations must answer those questions in the same way, a protocol becomes necessary.

## What the protocol has to define

`pling.surface/0.1` reduces the problem to four kinds of object:

1. **Capability.** A business operation the page chooses to expose, including its inputs, effect, and confirmation requirement.
2. **Context.** A bounded, read-only view needed for the current decision.
3. **Session.** Which user an agent represents, in which application boundary, until when, and with which capability scope.
4. **Result.** Whether the request was understood, whether execution occurred, whether business state changed, and what can be observed next.

Transport, authentication, business authorization, storage, and model execution are outside the protocol. The contract can run over `postMessage`, MCP, HTTP, or another transport without changing the business meaning of a capability.

## Design goals

The protocol is deliberately small. These goals constrain both the data model and observable behaviour.

| Goal | Requirement |
| --- | --- |
| Discovery without the DOM | A caller obtains page identity and available capabilities from a structured response |
| Business semantics | Actions are named by business intent, not selectors or visual position |
| Bounded observation | Context is selective and bounded; it is not the whole DOM or application store |
| Explicit control | Session scope, expiry, revocation, confirmation, and backend authorization are represented separately |
| Actionable results | Responses distinguish protocol errors, execution errors, and business effects |
| Transport independence | The same contract can run over more than one transport |
| Fail closed | Unknown versions, unknown methods, out-of-scope capabilities, and unavailable guards are rejected |

The protocol provides no general browser API. It has no `click(selector)`, `eval(script)`, or equivalent escape hatch. It does not authenticate users, make business authorization decisions, store credentials, or replace MCP. These exclusions define the boundary; they are not temporary omissions.

## Core model

Let `C_page` be the capabilities declared by the page and `C_session` the capabilities allowed by a verified session. The effective set is:

```text
C_eff = C_page ∩ C_session
```

Both `describe` and `invoke` operate on `C_eff`. A capability outside that set cannot be discovered or invoked through the session, even if the page declared it globally.

Three decisions must remain distinct:

| Decision | Question | Owner |
| --- | --- | --- |
| Declaration | Does the page implement this capability? | Page application |
| Exposure | Is the capability inside this session's scope? | Host and session validation |
| Authorization | May this user perform this operation on this resource now? | Business backend |

The first two describe software boundaries. The third is a business decision that may depend on role, ownership, amount, time, and approval state. The protocol can enforce the second and carry evidence for the third; it cannot replace the third.

## Capability declaration

A capability is not a button or an arbitrary function. It is an operation with a stable id, business description, and execution semantics. Implementations need to distinguish these core fields:

| Field | Meaning | Constraint |
| --- | --- | --- |
| `id` | Stable capability identifier | A folded row action must not contain a row-specific name |
| `description` | Human-readable business description | Supplied by the page, not by user-generated content |
| `inputSchema` | JSON schema for arguments | Describes only arguments; never exposes selectors or credentials |
| `effect` | `read`, `write`, or `destructive` | Required |
| `approval` | `none`, `ask`, or `always` | Omitted values are resolved by application policy |
| `fidelity` | `high`, `auto`, or `low` | How the execution target was obtained |
| `record` | Record argument for a folded row action | Binds one template action to a concrete record |

Implementations may also provide `scopePath`, `handoff`, `flowSteps`, and `offscreen`. They help a caller understand regions, human handoff, and composite actions without changing the basic authorization model.

A repeated row action uses one stable template id, such as `approve@order`, with `record` selecting the target. This avoids returning one capability per row while preserving record-level references. Before execution, the implementation must resolve the target again, recheck availability, and use the same executor as the human interface.

`fidelity` is not an authorization property. It describes how directly the target is backed: developer-declared, automatically resolved, or simulated in the DOM. A low-fidelity action may still be valid, but its result must be reported with lower certainty.

## Bounded context

Context is a read-only view of the page, not a serialization of the DOM or frontend store. An implementation may include:

- `page`: route, title, and current business object;
- `regions`: declared regions and their hierarchy;
- `records`: a bounded record-field window currently visible to the agent;
- `recordIds`: records that can be referenced but whose full fields have not all been returned;
- `recordWindow`: offset, limit, returned count, total, and next position;
- `state`: explicitly exposed, read-only application state;
- `feedback`: validation messages, status messages, and other observable feedback;
- `unavailable`: unavailable capabilities or records with reasons;
- total counts that show whether a view was truncated.

Four constraints follow: the page chooses the content; sensitive values may be masked or referenced; truncation is reported; and later reads may be incremental. A successful `invoke` may return `after`, containing newly available capabilities, changed records, and changed state rather than another full snapshot.

Page content is data. Record fields, comments, product descriptions, and attachment text cannot become capability descriptions or agent instructions.

## Session and approval

A session binds the agent to a user and a scope:

```text
session = (
  agentId,
  sessionId,
  userId,
  expiresAt,
  scope,
  delegationId?,
  revokedAt?
)
```

The protocol receives an already verified session. Token parsing, login, and the identity provider belong to the transport or identity service. Cookies, JWTs, and raw delegation tokens must not appear in protocol objects.

Session scope is a capability ceiling, not business authorization. A backend may reject a call inside `C_eff` and may require an approval the page cannot manufacture.

Some high-risk operations need an approval bound to more specific facts: user, agent, session, capability, record, canonical argument hash, request id, and expiry. Approval tokens or signing material should stay between the trusted page flow and approval backend. The protocol may record a public `approvalId` in audit, but it must not return approval material to the agent.

## Wire operations

Every request carries a protocol version, request id, and method. A `describe` request may select a record window or capability delta; an `invoke` request carries a capability id and input object.

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_01",
  "method": "describe",
  "input": { "limit": 8 }
}
```

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_02",
  "method": "invoke",
  "capability": "approve@order",
  "input": { "record": "SO-1002" }
}
```

Every response carries the protocol version, the same request id, and either a result or a structured error. The request id also serves audit correlation and replay protection.

### `describe`

`describe` is read-only. It returns page identity, the current capability set, bounded context, and session limits. A caller may request specific records, a record window, or a capability delta. The capability list is not a DOM snapshot; it is the set of business actions the page has chosen to expose.

### `invoke`

`invoke` selects a capability from `C_eff`, validates arguments against its schema, and passes the action to the page executor. A successful response contains the execution result and, when the page can observe a change, a bounded `after` delta.

### Errors

Protocol errors and business execution errors are separate. `INVALID_REQUEST`, `PROTOCOL_VERSION_UNSUPPORTED`, `METHOD_NOT_SUPPORTED`, `CAPABILITY_NOT_EXPOSED`, `RATE_LIMITED`, `REPLAY_DETECTED`, and the session error family are protocol-level failures. A page action that fails because a record is unavailable, authority is missing, or a business precondition is unmet returns a structured execution error.

The distinction matters. A protocol error means the request cannot be interpreted or is outside the contract. An execution error means the request was understood, but the page or business refused or failed it. Retrying is safe only when the error says so.

## Execution order

An `invoke` request should be evaluated in this order. The order is part of the security model because it determines which failure is reported and whether side effects are possible.

1. Validate the envelope, protocol version, request id, and method.
2. Resolve the verified session; reject missing, expired, or revoked sessions.
3. Compute `C_eff = C_page ∩ C_session`; reject a capability outside it.
4. Apply the session rate limit; fail closed if the limiter is unavailable.
5. Atomically reserve the request id in the replay guard; reject a duplicate, and fail closed if the guard is unavailable.
6. Resolve the capability and validate its input.
7. Execute through the page executor, preserving the same validation, confirmation, and business path as the human interface.
8. Remove approval material from the agent-visible result and write the audit event.
9. Return the execution result and any bounded `after` observation.

`describe` performs the same session and scope checks but does not reserve a replay id because it does not mutate business state. Rate limits still apply.

Audit failure must not change the business result, but it must not be silent. The implementation reports it through a separate error handler or metric.

## Security invariants

These properties define the protocol boundary. A conforming implementation must preserve them or explicitly document a deviation.

| Invariant | Requirement |
| --- | --- |
| No generic DOM control | No selector-based click, script evaluation, or arbitrary browser step |
| Credential isolation | Cookies, JWTs, OAuth tokens, and delegation secrets do not enter protocol or model context |
| Declaration is not authority | A capability in `C_page` is not automatically authorized |
| Scope is an intersection | Effective scope is `C_page ∩ C_session`; no path may silently widen it |
| Fail closed | Unknown versions, unknown methods, out-of-scope capabilities, and unavailable guards are rejected |
| Approval material is not agent-visible | Approval tokens and signing material do not enter the agent response; only an audit association remains |
| Context is bounded | Context is selective and reports omission; it is not the DOM or entire store |
| Audit is metadata-only by default | Arguments and response bodies are not recorded without a separate written host policy |
| Page content is data | User-generated content cannot become a capability description or instruction channel |
| Browser-level bypass is acknowledged | An agent with CDP or equivalent access can bypass the contract; the protocol improves the declared path without claiming to prevent all automation |

The last invariant matters. The protocol cannot guarantee that an agent with lower-level browser access will use the declared path. It can make that path more precise, auditable, and less dependent on visual inference. It cannot turn an untrusted client into a trusted one.

## Relationship to adjacent layers

| Layer | What it decides | Relationship to this protocol |
| --- | --- | --- |
| CDP | How to control a browser instance | A lower-level execution mechanism, not a business contract |
| Playwright and similar automation | How to locate and operate an element | An execution layer for pages without declared capabilities |
| Vision model | What an interface appears to be | A fallback when semantics are unavailable, not an authorization or audit model |
| MCP | How tools are exposed to an agent runtime | A possible transport and tool-calling convention |
| This protocol | What a page offers, what context is visible, and what a result means | A page capability contract that can run over MCP or another transport |
| Business backend | Whether a specific operation is allowed and committed | The final authority for authorization and transaction state |

These layers are not competitors. A page may expose a capability through this contract and still execute it with ordinary HTTP, a database transaction, or an internal workflow. MCP can carry the contract, but MCP alone does not explain what `approve_order` means or prove that an approval is valid.

## What the current draft establishes

The reference implementation supports a capability projection from the page registry; `describe` and `invoke`; session scope, expiry, and revocation; injectable rate limiting and replay protection; bounded context and incremental `after`; folded row actions; audit metadata; and approval stripping from agent-visible responses. The repository includes tests for scope intersection, invalid records, replay, rate limits, audit shape, and approval stripping.

`pling.surface/0.1` remains a public draft. It has not established a complete stable wire schema, independent page-side and client-side implementations, a cross-implementation conformance suite, or `attach`, `observe`, `handoff`, and `detach` as completed protocol methods. Production identity, distributed rate limiting, durable replay protection, and a general audit service are also outside the protocol.

An implementation can therefore be evaluated on narrower questions:

- Can a page expose a declared action without exposing its DOM?
- Can a client invoke it without site-specific selectors?
- Is the effective scope enforced before execution?
- Does the result distinguish "request accepted", "action executed", and "business state changed"?

These questions are testable. Whether the design achieves broad adoption, interoperability across independent implementations, or better outcomes than existing automation still requires deployment and comparative evaluation.

## When a protocol is warranted

When there is one page, one client, and one team, a private bridge may be simpler. A shared contract starts to pay off when the page must serve a user's own agent, several clients, or independent vendors.

Adoption does not require implementing everything at once. A team can start with read-only actions and one low-risk write path, validate discovery, scope, execution, and result semantics, then add approval, delegation, and more transports.

## Continue reading

For the page-side Surface model and its current boundary, read [What is Agent Surface](/surface/). To add the first declared action to a Vue page, continue with the [Vue quick start](/vue/quick-start-add-pling-to-a-vue-app).
