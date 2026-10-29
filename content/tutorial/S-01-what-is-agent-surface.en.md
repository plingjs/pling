---
id: S-01
title: What is Agent Surface
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# What is Agent Surface

Agent Surface is a protocol boundary through which a web page offers capabilities to external agents. The page projects existing business actions into discoverable declarations and accepts calls within a constrained session. Surface does not run an agent, parse the DOM, or define a transport. It defines what the page publishes, what an external client may observe, and which checks a call must pass.

The boundary addresses a difference between code inside and outside the page. Code running in the page can reach its runtime, state, and closures directly. A browser extension, desktop client, or remote agent cannot. An external client that depends only on the DOM, screenshots, or a separate backend API may perform a click, but it cannot reliably determine whether the control reads data or performs an irreversible write, which record it affects, whether confirmation is required, or whether business state actually changed.

## The shape of the problem

Consider an order management page. Each row shows an order number, customer, and note, with inline editing. `SO-1002` is a stable identifier in the business system. In the current DOM, the note field in that row may be rendered as `#note-42`, with a save button beside it. The page can declare the corresponding action as `update_note@order`, taking a record id and note text.

Suppose an operator needs to change the note on SO-1002 to “Customer requested a callback by Friday”. Inside the page, that logic is an existing function. Outside the page, it appears as a sequence of finding an input, entering text, and triggering save.

The two are not equivalent. `#note-42` belongs to the current rendering; reordering, pagination, or a component re-render can change it. `update_note@order` describes a business action, and a client can identify the target with `record: "SO-1002"` as long as the record remains within the session's visible scope. Agent Surface exchanges the latter: an action the page has declared and can execute again.

Surface is therefore not a general-purpose browser API. It provides no `click(selector)`, `eval(script)`, or arbitrary DOM step, and it does not infer operations the page has not declared. It exposes only capabilities the page owner is willing to publish and routes calls back through the page's existing execution path.

When a page cannot or will not declare capabilities, an external client can still use CDP, Playwright, or visual automation. Those approaches address how to operate an interface. Surface addresses what business semantics the page is willing to accept and which boundaries constrain those operations. The approaches can coexist, but they answer different questions.

## The three parts of the contract

Surface output and checks involve three groups of information. They are not three services or three processes; they are mutually constraining parts of one contract.

| Part | Question | Main content |
| --- | --- | --- |
| Capability | What may the page execute? | Stable id, description, input schema, effect, approval policy, scope |
| Context | What is true on the page now? | Route, regions, records, referenceable ids, state view, feedback, unavailable items |
| Control | Who is acting, and what happened? | Verified session, scope, expiry, revocation, confirmation, structured result, audit |

Capabilities are central, but a list of actions is not sufficient for safe execution. A client also needs to know which record an action affects, whether it is currently available, whether human confirmation is required, and whether business state changed after execution. Context supplies the facts needed to choose an action. Control limits what the session may do and gives the result a verifiable shape.

Capabilities use business names rather than selectors. A folded row action can be described as follows:

```text
update_note@order
  effect: write
  approval: ask
  inputSchema:
    note: string
  record:
    param: record
```

`update_note@order` is a stable template. `inputSchema` declares the business parameter `note`; `record` is metadata for the folded template, indicating that a call selects a concrete row through an input named `record`. The record id comes from `context.recordIds` and is passed with `note` in `input`. The page resolves that row and runs the same availability, confirmation, and permission checks. Filtering, sorting, or scrolling the list does not change the template.

The effective capability set is not everything the page declares. Let `C_page` be the set declared by the page and `C_session` the set permitted by a verified session. The set available to the session is:

```text
C_eff = C_page ∩ C_session
```

Both `describe` and `invoke` operate only on `C_eff`. A capability outside the intersection is neither discoverable by the external client nor callable through that session. A host or transport normally constructs `C_session` after verifying the user, agent, scope, and validity period. Surface does not read cookies, JWTs, OAuth tokens, or delegation secrets.

Context is also not a page snapshot. It contains only the information required to select and check actions, and reports what it omits. A page with one thousand orders should not send one thousand complete records to the client. It should return the current window, referenceable record ids, the total count, and a way to read a specific record by id. The client can then identify what it may reference without receiving the whole DOM or the whole application store.

## Relationship to page and external agents

Surface sits between page capabilities and external clients. It does not replace the page runtime:

```text
page business code
  ├─ capability registry
  │    ├─ page agent (direct access)
  │    └─ Agent Surface ── transport ── external agent
  └─ page executor (shared by the page agent and Surface)
```

A page agent is a client that runs inside the page. It can read the registry and state directly and call the executor. An external agent does not share the page closure, so it receives a serialized capability projection through Surface and sends calls over a transport. Both ultimately use the same capability declarations and the same executor.

This arrangement does not require a page to provide both kinds of client. A page may have only a page agent, expose only Surface, or provide both. Surface is not a remote copy of the page agent. It does not require a page agent to exist, and it does not prescribe how an external client plans its work.

Surface also does not introduce a second business implementation. It references the existing registry and executor, so availability, confirmation, human handoff, validation, and backend requests remain governed by the page's existing logic. If a page agent can execute an action and an external client cannot, the difference should come from session scope, confirmation policy, or backend authorization, not from two implementations that drift apart.

## The path of one call

An external client normally calls `describe` before `invoke`.

`describe` is a side-effect-free read. It validates the protocol version, request id, and session, then returns a scope-trimmed capability list and bounded context. The excerpt below is the response envelope returned through `handle()` or a transport, and keeps only the fields needed to explain selection. A direct call to `surface.describe()` returns the contents of `result`, without the outer `ok` wrapper:

```json
{
  "protocol": "pling.surface/0.1",
  "ok": true,
  "result": {
    "capabilities": [
      {
        "id": "update_note@order",
        "description": "Change an order note",
        "inputSchema": {
          "type": "object",
          "properties": {
            "note": { "type": "string" }
          },
          "required": ["note"]
        },
        "effect": "write",
        "approval": "ask",
        "record": { "param": "record", "total": 48 }
      }
    ],
    "context": {
      "recordIds": ["SO-1001", "SO-1002"],
      "recordIdsTotal": 48,
      "recordsTotal": 48
    }
  }
}
```

Here, `record` is capability-level metadata, not a business input. `param: "record"` names the input key used to select a target record; `total: 48` means the template currently covers 48 referenceable records. If some of them are outside the viewport, an `offscreen` count is also present.

The corresponding `invoke` therefore contains two parts: the business parameter `note` defined by `inputSchema`, and the record id `record` required by the folded action. Surface uses `record` to resolve the concrete action and removes this protocol parameter before calling the page executor; the executor receives only the business parameters.

The client selects a capability, record, and input, then calls `invoke`:

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req_01",
  "method": "invoke",
  "capability": "update_note@order",
  "input": { "record": "SO-1002", "note": "Customer requested a callback by Friday" }
}
```

On the page side, an `invoke` proceeds roughly as follows:

1. Validate the request envelope, protocol version, request id, and method.
2. Resolve the verified session and reject a missing, expired, or revoked one.
3. Compute the effective capability set and reject an out-of-scope capability.
4. Resolve the record and input, then check whether the action is currently available.
5. Execute through the page executor, preserving the validation, confirmation, and business path used by the human interface.
6. Return a structured result and, when observable, a bounded `after` change.
7. Write metadata-only audit events according to host configuration; rate limits and replay protection take effect before the executor is called.

A successful response means the request was understood and handled under the contract. It does not mean the business accepted the operation. The execution result must identify the action, target record, success or failure, and any observable change. When approval is required, the client can learn that the action is pending, but cannot approve it. Approval occurs in a trusted page flow or in the business backend.

## Relationship to adjacent concepts

| Concept | Responsibility | Relationship to Surface |
| --- | --- | --- |
| Page agent | Understand intent inside the page, choose actions, call the runtime | May use the same registry and executor; does not depend on Surface |
| External agent | Plan outside the page and invoke capabilities | Uses Surface over some transport; Codex is one example of such a client |
| MCP | Expose tools to an agent runtime | Can carry Surface capabilities, but does not define the business meaning of `update_note@order` |
| CDP, Playwright, or visual automation | Operate a browser, DOM, or interface | Does not require page declarations; an execution path for pages without a contract |
| Business backend | Decide whether a user may act on a resource and commit the transaction | Surface carries request and result evidence; it does not replace backend authorization |

MCP is often treated as a synonym for Surface. They solve different problems. MCP defines how tools appear in an agent's callable set. Surface defines which business capabilities a page provides, how context is bounded, how a session is constrained, and what a result means. An MCP server can forward Surface requests. MCP itself does not say whether `approve_order` requires a second approver, and it does not prove that approval occurred.

CDP and visual automation also occupy a different position. They can work when a page has no contract, at the cost of relying on the DOM, layout, or visual inference. Surface improves accuracy and auditability when the page participates. It cannot prevent a client with browser-level access from bypassing the contract.

## Guarantees and limits

Within the contract, Surface provides these properties:

1. A client sees and invokes only declared business capabilities and cannot obtain general DOM control through the protocol.
2. Context is selective and bounded, reports omissions, and does not return the whole DOM or application store.
3. Calls pass through the page executor and share the availability, confirmation, and business validation used by the human interface.
4. Cookies, JWTs, OAuth tokens, and delegation secrets do not enter the protocol context or model context.
5. Errors and results are structured; unknown versions, unknown methods, out-of-scope capabilities, and unavailable guards fail closed.

These properties do not imply the following:

- Surface does not guarantee that the business backend accepts a call. A valid session does not establish permission, a valid order state, or completed approval.
- Surface does not provide authentication, authorization, transport, persistence, or audit storage; the host implements them.
- Surface cannot stop an agent with CDP or equivalent access from operating outside the contract.
- `pling.surface/0.1` is a working draft with a reference implementation, not an established standard.

## When to use it

Surface is appropriate when the page already has business actions with stable meaning; the page owner is willing to expose a defined subset; external clients need to repeat those actions across sessions; and the exposed scope, approvals, and results need to be constrained and recorded.

It is not a replacement for all browser automation. When the page cannot be changed, the task requires arbitrary exploration, or the goal is scraping or an undeclared operation, CDP, Playwright, or visual automation remain the more direct tools. A high-risk operation should not be exposed merely because it can be declared. It still requires final backend authorization and trusted human confirmation.

## Current state

`@plingjs/surface` implements a transport-independent `describe` / `invoke` kernel, session scope, expiry and revocation checks, injectable rate limiting and replay protection, bounded context, incremental `after` observations, folded row actions, audit metadata, and removal of approval evidence. The repository includes reference page integrations and external clients.

`pling.surface/0.1` is the working draft implemented here. Whether a particular page can expose a set of capabilities safely and reliably still depends on that page's execution path and backend authorization.

## Summary

Agent Surface lets an external client use business actions the page has already declared, instead of reconstructing the page from the DOM or pixels. It places callable capabilities, constrained context, and execution control in one contract. How an action is implemented, whether it is authorized, and whether it changes business state remain the responsibility of the page executor and the business backend.
