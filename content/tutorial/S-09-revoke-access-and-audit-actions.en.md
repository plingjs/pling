---
id: S-09
title: "Revoke access and audit actions"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Revoke access and audit actions

Revocation and audit answer different questions. Revocation stops future use of a credential. Audit records what already happened. A system needs both, and neither can be inferred from the other.

## Revocation path

A delegation credential should fail closed when it is missing, expired, revoked, forged, or bound to another user. The reference package issues an opaque token once, stores a hash, and exposes revoke and refresh operations. The page converts a safe credential view into a Surface session; the token itself never enters the session or response.

On revoke:

1. the store commits the revoked state;
2. an invalidation event may notify open clients;
3. the next `describe` or `invoke` re-checks the credential and fails before executing;
4. the page UI stops presenting the agent as connected.

The event bus is an accelerator. A dropped event must not keep a revoked token usable. The source of truth is the store's introspection, checked before the next request. A multi-instance deployment needs a shared store or an equivalent consistency mechanism; two independent memory stores are not a shared revocation system.

## Surface audit

Surface audit events are metadata, not a copy of the business request. The current event includes:

- request id and method;
- agent id, session id, user id, and tenant where available;
- capability id and folded record id;
- outcome: completed, business error, denied, or failed;
- protocol or business error code;
- duration;
- optional public approval id.

It excludes input parameters, response bodies, cookies, tokens, and approval secrets. That limit is intentional: audit should establish who did what and what happened, while business-specific evidence stays in the business backend under its own retention rules.

## Approval linkage

If a high-risk operation requires a human approval, the audit should be able to associate the executed request with the consumed approval challenge. Use a public approval id in the audit event. Do not return its token or hash to the agent. If the lookup fails, the business result need not change, but the missing approval id must be visible to operators as an audit integrity problem.

The binding should include the request id, capability, record, user, agent, session, normalized argument hash, and expiry. The page approval backend owns issuance and consumption; Surface only passes a public id into its audit sink and strips the evidence before returning to the agent.

## Runtime limits and replay

Rate limits are checked before execution and isolated by verified session. A configured limiter that throws or returns an invalid decision causes fail-closed behavior. Replay protection applies to `invoke`; a repeated request id within the window is rejected and does not execute again. Different sessions may reuse an id, and a retry after the window is not automatically idempotent from the business perspective.

## Operational exercises

- Revoke an agent while a request is pending; confirm the next call fails before the executor.
- Drop the event stream; confirm introspection still rejects the revoked token.
- Restart one gateway instance; confirm a live page reconnects or starts a new session.
- Approve a destructive request; verify the audit has a public approval id and the agent response does not.
- Force an audit-sink failure; verify the business outcome is unchanged and the error is observable.
- Reuse an invoke id; verify no second side effect.

The useful claim is not “the gateway logs everything”. It is “the system can prove which session made which declared call, whether it completed, and whether a human approved it, without putting the credential or business payload in the log”.

See [Delegation and trust boundaries](/reference/delegation-and-trust-boundaries) and the [Security and trust center](/security/).
