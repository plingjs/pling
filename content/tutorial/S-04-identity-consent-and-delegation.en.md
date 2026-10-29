---
id: S-04
title: "Identity, consent, and delegation"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Identity, consent, and delegation

Several identities meet when an external agent changes a business record: the person using the page, the agent software, the agent session, the application tenant, and the business backend that ultimately accepts or rejects the write. No single login event proves all of them.

A delegation credential connects those facts for a limited time. It should say which user granted access, to which agent, for which capabilities, under which session, and until when. It must be revocable, and its token must not become part of the page projection or the model conversation.

## Consent is an explicit grant

Consent is not “the user opened the assistant”. A useful consent screen shows the agent, the requested capabilities, the scope of records, the expiry, and what will be visible to the agent. The user should be able to grant a narrower scope than the site's maximum.

For a read-only orders agent, the grant might allow `orders.search` and `orders.open`. It should not include `orders.approve` merely because the same user can approve orders in the UI. For a write operation, the approved scope still does not replace the business backend's ownership and state checks.

## The reference flow

`@plingjs/delegation` defines the lifecycle ports and a Web-standard reference handler. The endpoint contract is:

```text
GET  /delegation/health
GET  /delegation/session
GET  /delegation/events          SSE
POST /delegation/issue
POST /delegation/introspect
POST /delegation/refresh
POST /delegation/revoke
```

The flow is intentionally small:

1. The browser establishes its application session.
2. The user grants an agent a bounded scope.
3. The server issues an opaque token once and stores only a hash.
4. The client introspects the token, converts the safe credential view into a Surface session, and sends Surface requests.
5. Revocation or rotation publishes an invalidation event.
6. Every request re-checks the credential before execution; SSE is an early warning, not the source of truth.

The identity, store, and event bus are ports. A real deployment implements them with its login system, database, and event infrastructure. The memory adapters are for tests and local examples, not production.

## Scope intersection

The effective capability set is the intersection of the site's `expose` and the delegated session's `scope`. A broad site allowlist does not make a narrow delegation broad. A broad delegation cannot reveal a capability the site never exposes.

Array scopes may include exact ids or folded templates such as `approve@order`; the latter grants a bounded family of row actions. A function scope is useful for dynamic ids but must apply the same rule to `describe` and `invoke`.

## Revocation and expiry

Revocation must be checked before each `describe` or `invoke`, not only when a connection opens. Expiry uses server time. A browser clock must not extend a session. A revoked token should produce a stable failure and call no executor or business function.

When a session's scope or expiry changes, use a new session id. Incremental capability caching must not survive an authorization change. The protocol core can reject invalid sessions, but the host owns their lifecycle and must not send an unverified object into `session`.

## What consent cannot do

Consent cannot make an unsafe capability safe. It cannot turn a free-form DOM click into a business operation, approve a payment on the user's behalf, or replace a required two-person review. It records authority; it does not erase consequence.

Nor does the protocol prove that a high-risk approval came from a real person. That is the page and backend's job. If the business needs an approval receipt, bind the challenge to the request, capability, record, user, agent, session, normalized arguments, and expiry. Keep the receipt token out of the Surface response and audit event; only a public approval id belongs in the audit trail.

## Implementation checklist

- Use the real application identity; never accept a user id from the request body.
- Store only a hash of the token and return the token only on issue or refresh.
- Normalize and deduplicate scope before persistence.
- Reject missing, expired, revoked, forged, or cross-user credentials.
- Re-check before each Surface request.
- Publish invalidation events, but treat them as acceleration.
- Test a failed event bus: the next introspection must still fail closed.

See [Delegation and trust boundaries](/reference/delegation-and-trust-boundaries), [Deploy a Surface gateway](/surface/deploy-a-surface-gateway), and [Revoke access and audit actions](/surface/revoke-access-and-audit-actions).
