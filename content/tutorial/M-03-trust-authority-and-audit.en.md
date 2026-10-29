---
id: M-03
title: Trust, authority, and audit
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# Trust, authority, and audit

Alice works in an order operations team. She asks an external agent to approve order SO-1002 for ¥48,000. The order page contains an **Approve** button, and Alice is signed in.

Those facts still do not establish that this approval should happen. The system also needs to know which user is represented, which agent is acting, which application session the request belongs to, what that session may use, whether this amount requires another approver, and what record remains afterwards.

An agent can find a button without acquiring the authority to use it. Trust begins when those questions have explicit answers.

## The parties behind an external operation

An external write involves at least four parties. Combining them into a single "signed-in user" obscures who is responsible for what.

| Party | Question | Evidence the host may rely on |
| --- | --- | --- |
| User | Whose business identity and authority are being used? | SSO or application session |
| Agent | Which program is acting? | Agent identifier, client identity, or delegation record |
| Application session | Where and for how long may this agent act? | Origin, tenant, session id, scope, expiry |
| Business backend | Is this operation allowed on this resource now? | Role, ownership, limits, approval, transaction rules |

A delegation is not a fifth identity. It records a relationship: user U allowed agent G to use capability set C in application A until time T. The user still owns the authority; the agent is still the actor. Audit must retain both.

## Declaration, exposure, and authority

Three distinct statements are often compressed into "the agent can approve orders":

1. **The page declares the action.** `approve_order` exists and has a business description, inputs, target, and effect.
2. **This session exposes the action.** The site's exposure policy and the session's scope both allow it.
3. **The backend permits this specific execution.** The signed-in user may approve this order, for this amount, at this time.

The first statement describes software structure. The second describes the boundary of one agent session. The third is a business decision.

Pling can establish the first two and hand the result to the page executor. It cannot replace the third. A page declaration is not a permission grant, and a session scope does not overrule the backend.

In the current Surface implementation, the host supplies an already verified session. The callable set is the intersection of the site-level exposure policy and that session's scope. Expiry and revocation are checked at the session boundary; rate limits and replay protection are separate guards. None of these checks turns the page into the final authorization authority.

## Consent, confirmation, and approval

These mechanisms answer different questions and have different lifetimes.

| Mechanism | Question | Typical lifetime |
| --- | --- | --- |
| Delegation consent | May this agent use this set of capabilities for this period? | A session or a longer bounded grant |
| Operation confirmation | Does the user want to execute this action now? | One action, or a deliberately chosen short-lived allowance |
| Backend approval | Has an authorized approver approved this exact high-risk operation in a form the backend can verify? | One business operation |

A confirmation dialog can express intent. It is not, by itself, a backend-verifiable approval. If the operation needs a second approver, an amount limit, or an auditable receipt, that decision belongs to the business backend. The page may collect the response through a trusted host flow; an agent's claim that approval happened is not evidence.

The reverse is also true. A valid long-lived delegation does not mean every exposed action may run without confirmation. A high-risk action may require a fresh human decision even while the delegation is valid.

The `confirm` field in an action declaration is combined with the risk level to produce a confirmation policy. When `confirm` is omitted, risk level decides by default: a dangerous action asks for confirmation instead of being silently allowed by a configuration gap. The application still decides whether page confirmation is sufficient or a backend approval is required.

## Approval material must not enter agent context

When a backend approves a specific operation, the approval should be bound to facts that cannot be silently swapped:

- the user and agent;
- the application session;
- the capability and target record;
- a canonical hash of the execution arguments;
- the request id and an expiry time.

The receipt token or verification secret stays between the trusted page flow and the approval backend. It must not be returned to the agent, placed in model context, written to ordinary logs, or reused for another request.

The Surface protocol can carry a public approval association id for audit purposes. The executor reports that id; the protocol records it in the audit event and removes it from the agent-visible response. This preserves the link between approval and execution without turning the agent into a courier for approval material.

## What an audit event must answer

Audit should make the authorization and execution chain reconstructable without copying the business payload. A practical minimum is:

| Field group | Purpose |
| --- | --- |
| User, agent, session, delegation | Establish who acted under which relationship |
| Request id, capability, record | Identify the attempted operation |
| Outcome, error code, duration | Distinguish success, business rejection, denial, and failure |
| Approval association id | Link a high-risk execution to the enterprise's approval record |

Raw arguments, response bodies, cookies, JWTs, and approval tokens do not belong in the default audit stream. They may contain personal data or secrets, and retention requirements differ by jurisdiction and business domain. If an application needs argument-level evidence, its backend should define, encrypt, and restrict that record.

The current Surface implementation exposes an audit sink that receives metadata only. `@plingjs/server` follows the same principle for model requests: it records request metadata and outcomes without storing prompts or response bodies by default. Persistence, retention, and access remain host responsibilities.

## Failure must refuse, not widen access

Trust is tested when information is missing or inconsistent. The safe response is to refuse execution, not to infer a nearby permission.

| Condition | Required behaviour |
| --- | --- |
| No verified session | Reject the request |
| Expired or revoked session | Reject immediately and require a new grant |
| Capability outside the exposed scope | Reject without widening the allowlist |
| Target record disappeared | Report the missing target; do not choose a similar record |
| User declines confirmation | Stop; do not retry with a different prompt |
| Backend rejects the operation | Preserve the business error and its actionable context |
| Audit delivery fails | Keep the business result unchanged, but raise an operational alert |

This is fail-closed behaviour: unknown, expired, unverifiable, or conflicting facts produce a refusal. A successful response means every required check passed.

## Five questions to answer before deployment

1. Which actions change business state, and which only read data?
2. How is each target record identified stably?
3. Which actions require confirmation, and which also require backend approval or human handoff?
4. Which user, agent, tenant, and capability scope does the session bind, and when does it expire?
5. Which audit metadata must be retained, and which raw data must be excluded?

Answer these first in a low-risk workflow, then extend the same rules to refunds, approvals, publishing, and other irreversible operations. A simple workflow should not be slowed by an enterprise approval stack. A high-risk workflow should not be made to look solved by a popup.

## Limits of the current implementation

The current Surface implementation accepts only an already verified session, intersects site exposure with session scope, rejects expired or revoked sessions, supports request rate limits and replay protection, emits metadata-only audit events, and removes approval material from the agent-visible response.

`@plingjs/delegation` is an optional reference package for short-lived, scoped agent credentials. It supports issuing, introspecting, rotating, and revoking credentials. A token is returned only when issued or refreshed, and the reference store keeps only a hash. Identity providers, durable storage, event delivery, SSO, tenant policy, and audit retention remain application responsibilities.

Pling does not define an enterprise RBAC or ABAC model, provide a production approval service, store audit records for you, or certify a deployment. It provides a shared page boundary: which capabilities were exposed, which execution occurred, and which checkable information accompanied the result.

## Continue reading

If a page must exchange capabilities with independent clients, [From a single-site integration to an open protocol](/about/mission/from-single-site-bridge-to-open-protocol) explains when a private bridge needs to become a protocol.

For the deployment threat list and operational checks, read the [Security and trust center](/security/). For the boundary between page capabilities and external clients, read [What is Agent Surface](/surface/).
