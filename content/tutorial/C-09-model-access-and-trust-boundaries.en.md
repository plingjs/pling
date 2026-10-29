---
id: C-09
title: "Model access and trust boundaries"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Model access and trust boundaries

The model is not the authority for the page. It chooses an action and supplies arguments. The page decides whether the action is available, whether confirmation is required, whether the requested object belongs to the current user, and whether the business operation actually succeeded.

A model connection therefore crosses several trust boundaries at once. The browser holds the user's session; the model service receives a prompt; a gateway may hold the provider credential; the business backend holds the final authorization. Collapsing these into one “AI backend” makes failures and permissions impossible to reason about.

## Four boundaries

| Boundary | Question | Required control |
| --- | --- | --- |
| Page to model | Which context and tool definitions leave the browser? | Bounded snapshots, redaction, explicit declarations |
| Browser to gateway | Who may consume model capacity? | Same-origin route, user session, quotas |
| Gateway to provider | Which credential and model are used? | Server-side secret, fixed upstream, allowlist |
| Page to business backend | Is this operation authorized? | Server-side identity, ownership, state, idempotency |

The browser must not contain a provider secret in a production build. `VITE_*` variables are compiled into client assets. A gateway is not optional decoration; it is where a server-held credential can remain server-held.

## What the model may receive

The page sends a bounded projection: page identity, relevant regions, a limited record window, view state, and the schemas of currently available capabilities. It should not send the entire DOM, a whole Pinia or Redux store, cookies, access tokens, or unmasked sensitive fields.

This is not only a confidentiality rule. Excess context also increases cost and makes stale or irrelevant data more likely to influence the run. The smallest projection that lets the model choose the next valid action is also the most reliable one.

Prompt injection belongs to this boundary. Text in comments, tickets, product descriptions, or uploaded documents is data. It cannot redefine capabilities or approval policy. Tool descriptions must come from application code, and sensitive values should leave through masking or opaque tokens rather than literal values.

## External agents and user-chosen models

An external agent may use its own model and credentials. That is a property of the agent host, not a reason to weaken the page boundary. The page still exposes only declared capabilities, the transport still authenticates a delegated session, and the business backend still validates the operation.

Do not build an “API key for every visitor” form as the default production path. If a product intentionally supports bring-your-own-key, the key belongs in that product's secure credential store, with explicit disclosure, retention rules, and a way to revoke it. A browser field that stores a long-lived provider key in local storage is a separate security design, not a convenience toggle.

## Trust is not a Boolean

“The user is signed in” does not imply “this agent may approve this order”. Permission depends on the user, agent, tenant, session scope, target record, operation, and current business state. A capability can be visible but unavailable; a session can be valid but too narrow; a call can pass the protocol and still fail authorization in the backend.

Keep those checks independent. The Surface validates the envelope and the exposed scope. The page executor validates availability, confirmation, and result expectations. The backend validates the durable business rule. No layer should silently assume another has already approved the write.

## A reviewable question set

Before production, answer these with evidence rather than intent:

- Can the browser artifact be inspected without finding a provider secret?
- Does the gateway enforce a real application session rather than trusting a body field?
- Is the model pinned or allowlisted, with a per-user or per-tenant budget?
- Does the page send only the fields needed for this task?
- Does every write have a server-side authorization and idempotency story?
- Can an operator revoke an agent session without deploying a new frontend?

Model access is therefore a deployment and authorization question, not just an SDK configuration question. See [Connect a model gateway](/operations/connect-a-model-gateway) and [Sensitive data and trust boundaries](/concepts/sensitive-data-and-trust-boundaries).
