---
id: RCP-12
title: "Approval, audit, and revocation for agent actions"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Approval, audit, and revocation for agent actions

A dangerous action needs three independently verifiable facts: what the person saw, what the backend approved, and what actually executed. A free-text log line cannot connect them.

## Runnable page

The invoice page below separates requesting a deletion from approving it. An agent can create a pending request; only a person can approve or reject it. The audit panel shows the request, decision, and the fail-closed path after revocation.

<DemoPlayground id="recipe-approval-audit" />

From the repository root:

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-approval-audit/` and sign in with `demo@example.com` / `pling-demo`. The page source is in `examples/demos/recipe-approval-audit/`; approval, audit, and revocation live in `examples/recipe-backends/access-service/`, with limits documented in its `README.md`.

## Approval boundary

An agent may request an action but must not approve it. A recommended flow:

```text
invoke a high-risk capability
→ executor determines confirmation is required and returns pending
→ page displays a challenge bound to request / capability / record / argument digest
→ person rejects or approves
→ backend consumes a one-time receipt and executes
→ agent receives the final result; audit stores a public association id
```

The challenge and receipt must bind user, agent, session, capability, target record, argument digest, and expiry. The receipt token moves only between the page and approval backend. It must not enter protocol responses, model context, or logs.

## Audit content

A useful `SurfaceAuditEvent` contains:

```json
{
  "protocol": "pling.surface/0.1",
  "at": "2026-10-28T12:00:00.000Z",
  "requestId": "req_02",
  "method": "invoke",
  "agentId": "codex",
  "sessionId": "ses_01",
  "userId": "user_42",
  "capability": "orders.cancel@order",
  "record": "SO-1002",
  "approvalId": "apr_public_7",
  "outcome": "completed",
  "durationMs": 183
}
```

Audit must not contain raw arguments, full responses, Cookies, JWTs, or approval tokens. `approvalId` is a public association id; it must not reconstruct or replay approval.

## Revocation

Revocation should cover:

- the current agent session;
- all delegations for one user;
- external access for one application;
- all external transport in an emergency.

The browser should stop on a revocation event, but the server still validates every request. An event is a hint, not the source of truth.

## Acceptance criteria

1. A high-risk action has no business side effect before approval.
2. The agent cannot see approval tokens or invoke an approval tool.
3. Rejection, timeout, and page close produce stable errors without a half-written result.
4. A receipt cannot be consumed twice; a replayed request is rejected.
5. Audit links request, user, agent, session, and public approval id.
6. Revocation fails the next call before the executor.
7. Backend authorization still applies; approval is not a substitute for permission.
8. An audit-sink failure does not turn a completed action into failure, but it alerts.

## Reference implementations

The backend for this recipe stores pending approvals, decisions, and audit events; the page exposes only the request tool and a bounded state view. It covers the full path from agent request through human decision to execution. In-memory storage and the demo account are not a production approval service, real identity, or a cross-instance transaction guarantee.

## Common mistakes

**Treating `approval: always` as proof of approval.** It declares a requirement, not that it happened.

**Putting approval tokens in audit.** A leak enables replay. Store only a public association id, with access control and retention.

**Exposing an `approve` MCP tool.** The agent approves its own request. Approval belongs to a person.

**Recording only success.** Rejections, unavailable actions, expectation failures, and internal errors also need audit, or misuse is invisible.

## Pre-release checks

- The challenge binds one real request.
- Receipts are consumed once.
- The business transaction and audit association can be reconciled.
- Revocation and expiry work across instances.
- Empty `approvalId` on high-risk audit triggers an alert.
- Logs and debug panels contain no token, full arguments, or sensitive body text.

## Local verification

Request deletion of `INV-2042`, reject it once, and confirm the invoice remains. Request it again and approve it, then check that the audit contains the matching decision. Finally use **Test revoked external call**; the request should fail before the business handler. The agent's tool list must contain no approval tool throughout.
