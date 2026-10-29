---
id: SPEC-04
title: "Control model"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Control model

The control model answers who may do what, under which conditions. It is separate from the capability model: capabilities describe business operations, while control decides whether a particular call may execute. The protocol carries verified control decisions; it does not replace login, authorization, or business approval.

## Principals

An external call involves at least four principals:

1. the user who owns the business account;
2. the agent, identified by vendor, version, instance, or client;
3. the application, identified by origin, tenant, and page session;
4. the business backend that ultimately authorizes and commits writes.

User identity and agent identity MUST remain distinct. Audit MUST be able to answer both who authorized and who executed.

## Session

The host MUST verify the caller before supplying a session to the surface:

```ts
interface SurfaceSession {
  agentId: string;
  sessionId: string;
  userId: string;
  expiresAt: number;
  scope: readonly string[] | ((id: string) => boolean);
  delegationId?: string;
  revokedAt?: number;
}
```

`scope` is the capability ceiling for this delegation. Site-level `expose` and `scope` MUST be intersected. `sessionId` MUST bind one authorization state; a changed scope requires a new id so cached observations cannot cross the change.

A missing, malformed, expired, or revoked session MUST fail closed before execution. Credential parsing belongs to the transport or identity service. Cookies, JWTs, and raw delegation tokens MUST NOT appear in the protocol object.

## Authorization order

An `invoke` SHOULD follow this order:

```text
verify transport identity → validate version and envelope → validate session
→ intersect site exposure and session scope → validate capability and record
→ apply rate limit and replay guard → call existing executor
→ record audit outcome
```

Failure at any step MUST NOT call the business handler. An implementation MUST NOT execute first and check afterward.

## Approval and handoff

`approval` describes a page confirmation requirement; it is not an option the agent may grant itself. When confirmation is needed, the page presents a challenge bound to the request to a real user. The agent sees pending status or a final result only.

A high-risk action may execute in the page or backend, or require a human. A `handoff` reason SHOULD be readable and bound to the request. Approval tokens, receipt secrets, and internal hashes MUST NOT enter agent responses, audit descriptions, or logs. Only a public approval association id may be audited.

## Limits and replay

An implementation MAY enforce a per-session sliding-window rate limit. Exceeding it MUST return `RATE_LIMITED` with a retry hint and MUST NOT execute the business action. A failing limiter MUST fail closed.

When replay protection is enabled for `invoke`, reusing one `request.id` in the same session MUST return `REPLAY_DETECTED`. A new logical call MUST use a new id. A failing replay store MUST also fail closed.

## Audit

An audit event SHOULD record:

- time, protocol version, and request id;
- user, agent, session, and optional delegation id;
- method, capability id, and target record;
- outcome class, stable error code, and duration;
- an approval association id that is safe to publish.

Audit MUST NOT record raw input, full responses, credentials, or sensitive fields. An audit write failure SHOULD NOT change the business result, but it MUST be observable through an independent alert. Production systems should monitor high-risk actions with `approval_id = null`.

## Revocation and expiry

Revocation and expiry MUST take effect before the next request. A browser-side early warning is a hint, not the source of truth. Critical calls should revalidate the session or use short-lived credentials.

## What is not guaranteed

The protocol cannot prevent an agent with browser control from clicking the page directly, and it cannot guarantee that a backend authorizes correctly. It provides explicit exposure, session binding, structured results, and an auditable call chain. Backend authorization, risk controls, and human review remain independent controls.
