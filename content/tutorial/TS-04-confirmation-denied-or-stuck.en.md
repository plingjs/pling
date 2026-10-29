---
id: TS-04
title: "Confirmation denied or stuck"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Confirmation denied or stuck

When approval breaks, an agent often says “still waiting,” “the action did not complete,” or polls repeatedly. First establish whether the request is genuinely pending, rather than conflating network timeout, unmounted UI, and business rejection.

## Identify the state

| Observation | Meaning | Action |
| --- | --- | --- |
| No approval UI | Request not created, or UI not mounted | Check host and region |
| UI exists but user cannot see it | Hidden window, overlay, or another tab | Provide a discoverable pending-action entry |
| User rejected | Explicit business decision | Return rejection and stop the intent |
| User approved but no result | Receipt not consumed, execution failed, or expectation failed | Check backend and result |
| Agent polls forever | No terminal state or polling bound | Return structured pending / failed / timeout |

## Common failures

**Treating `approval: ask` as auto-approval.** It declares a requirement. The agent has no approval action and must not see an approval token.

**The pending item is bound to the wrong request.** A challenge must bind request id, capability, record, argument digest, user, agent, and session. Otherwise the human sees one action and another executes.

**Approval remains after the page unloads.** Cancel or transfer the request and return a diagnosable state. Do not leave the agent polling forever.

**Approval is recorded only in the frontend.** A high-risk action should be verified by a backend with a one-time receipt before the business transaction.

**Timeout is treated as rejection.** Their meanings differ. A timeout means unconfirmed or unknown; do not auto-retry a write.

## Recovery

1. Query approval and execution state by request id.
2. If still pending, show a clear summary and expiry.
3. If rejected, stop; do not try a similar action to bypass.
4. If a receipt was consumed but business failed, read business state and check for partial success.
5. After refresh, describe again; do not reuse the old request.

## Acceptance

- Rejection, timeout, page close, and receipt reuse have stable errors.
- The business handler did not run before approval.
- The agent sees no approval secret and has no approval capability.
- Audit links to a public approval id.
- Polling is bounded and obeys rate limits.

## Related

[Approval and human handoff](/concepts/approval-and-human-handoff), [Approval, audit, and revocation for agent actions](/recipes/approval-audit-and-revocation-for-agent-actions).
