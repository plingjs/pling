---
id: C-08
title: "Connecting external agents"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Connecting external agents

An external agent is a client of the page, not a second implementation of the page. It may run in a desktop application, another browser tab, an MCP host, or an enterprise orchestration service. What it receives is a bounded description of the current page and a list of capabilities the page is willing to execute.

The current protocol implements two methods: `describe` reads the capability surface and current context; `invoke` asks the page to execute one exposed capability. Attachment, continuous observation, and transport are host responsibilities. A connection can therefore be useful before a standard transport exists, but it is not complete merely because a JSON shape can be copied.

## The three participants

A production connection has three distinct roles.

| Role | Owns | Must not own |
| --- | --- | --- |
| Page | Declarations, current context, execution, business state | The agent's model, prompt, or reasoning loop |
| Surface boundary | Allowlist intersection, protocol validation, limits, audit metadata | A second permission or execution engine |
| Host transport | Authentication, delegated session, request delivery, revocation | Implicit permission to call every declared action |

The page remains the authority for what it can do. The host proves who is calling. The Surface intersects the site limit with the delegated scope and forwards accepted calls to the existing executor.

## Connecting an agent

The first request describes the page:

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req-1",
  "method": "describe",
  "input": { "limit": 8 }
}
```

The response contains page identity, regions, bounded records, state, feedback, unavailable capabilities, and the capabilities currently callable. Long lists are paged. Record identifiers may cover the whole active region while only a window of fields is returned.

The agent then invokes one capability by its stable id:

```json
{
  "protocol": "pling.surface/0.1",
  "id": "req-2",
  "method": "invoke",
  "capability": "todo.complete",
  "input": { "record": "task-42" }
}
```

The response distinguishes a protocol failure from a business result. An unexposed capability is rejected before execution. A valid call may still return an unavailable action, a denied approval, a validation error, or an expectation failure. Those are different facts and must remain different in the client.

## Authentication is outside the protocol core

The Surface does not read cookies, bearer tokens, OAuth grants, or delegation credentials. A transport verifies the request and supplies a session containing the agent id, user id, session id, expiry, revocation state, and allowed scope. The protocol core fails closed when a configured session is missing, expired, revoked, or outside its scope.

This separation matters because a browser cookie proves a browser session, not the identity of an autonomous agent. The audit trail must be able to record both who authorized the work and which agent performed it. A transport that collapses those identities into one string loses the distinction the protocol is designed to preserve.

## Not every transport is MCP

MCP is one possible binding, not the protocol itself. A browser extension can carry the same envelopes over its native message channel; an enterprise gateway can expose an HTTP endpoint; a desktop host can call a local bridge. Each binding must still define authentication, replay handling, rate limits, audit delivery, and revocation.

Do not publish a transport that accepts an unauthenticated `userId` from the request body. Do not place a provider API key in the external agent's page context. Do not describe a local demo bridge as a production gateway. The protocol's small surface is deliberate: it leaves those choices visible instead of hiding them behind an SDK call.

## Safe exposure

Explicit exposure is a site-level maximum, not a convenience list. A tenant may expose read-only order lookup while withholding approval; a single delegation may be narrower still. Capability names should identify business intent, and row actions should use bounded templates rather than one tool per rendered row.

Before opening a connection, test four cases:

1. A capability outside the allowlist is absent from `describe` and rejected by `invoke`.
2. A missing or expired session calls neither the executor nor the business function.
3. A destructive action reaches the page's real confirmation path.
4. A repeated request id cannot cause a second side effect within the configured replay window.

The next step is to define the capability surface itself. See [Designing safe capabilities](/surface/designing-safe-capabilities) and [Surface basics: describe and invoke](/surface/surface-basics-describe-and-invoke).
