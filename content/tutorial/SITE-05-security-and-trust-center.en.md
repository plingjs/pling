---
id: SITE-05
title: "Security and trust center"
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# Security and trust center

Pling reduces the part of a page an agent can reach by making capabilities explicit. It does not make an application secure by itself. Security comes from the combination of a narrow capability surface, the application's existing authorization, human approval for consequential actions, and a backend that validates every privileged operation again.

This page states the current trust boundary and the work a deployment still has to do. It is not a compliance certificate, an independent audit, or a guarantee that any deployment is safe.

## What is not guaranteed

- Pling has not undergone an independent security audit.
- There is no public bug-bounty program or fixed response time.
- The project does not "certify" an application or deployment.
- Passing repository tests does not prove that an adapter, model, or customer application is secure.
- A confirmation dialog is not a backend authorization decision.
- A signed receipt does not make an irreversible business operation reversible.
- Surface projection does not replace CSP, CSRF protection, output encoding, database authorization, or secure secret storage.

These are deployment constraints, not boilerplate disclaimers.

## Boundaries crossed by one action

```text
declared control
  → capability projection
  → session and scope checks
  → executor availability check
  → confirmation or human handoff when required
  → business handler and backend authorization
  → structured result and bounded observation
```

Each boundary solves a different problem:

- **Declaration** limits the controls an agent can address. The protocol has no generic selector click or script-evaluation escape hatch.
- **Projection** filters by the site allowlist and verified session scope. Hiding an id is not authorization; invocation checks again.
- **Execution** reuses the application's existing executor. Availability, confirmation, input validation, success criteria, and result observation do not exist twice.
- **Business authorization** remains in the application backend. The frontend cannot prove that a signed-in user may approve an order, issue a refund, or read another tenant's data.
- **Delegation** replaces sharing a user's browser session with a short-lived, scoped credential. It does not replace login, tenant policy, or role checks.

## Threats and mitigations

| Threat | Current mitigation | Still owned by the application |
| --- | --- | --- |
| Prompt injection asks for an undeclared control | Unknown ids fail closed; no arbitrary DOM primitive | A declared capability can still be designed too broadly |
| Model chooses the wrong record | Stable record ids and executor-side target checks | Stale business state can still cause rejection or failure |
| Replay causes a second write | Optional per-session request-id replay guard | Multiple replicas need a shared atomic guard |
| Agent sees sensitive fields | Explicit masking, hiding, and bounded context | A developer can still declare a sensitive field as visible |
| Confirmation is bypassed | Confirmation is executor policy, not a model tool | Client confirmation is not proof against a compromised browser |
| Delegation token leaks | Opaque token, one-time return, hash-at-rest, revocation | A compromised client may use a token until revocation takes effect |
| Provider key reaches the browser | The key stays in the server gateway | Edge logs or a custom proxy can still expose it |
| Continuity crosses tenants | User identity comes only from the verified session; the backend isolates tasks | A faulty production adapter can violate the port contract |

## What the application still owns

1. **Identity and sessions.** Map an authenticated user to a session. Never let the client choose its own user, tenant, or scope.
2. **Business authorization.** Recheck role, ownership, amount, state, and approval conditions for every privileged action.
3. **Data boundaries.** Expose only fields needed for the task; mask or reference sensitive values.
4. **Execution environment.** Protect model keys, delegation endpoints, continuity storage, and audit archives. Use shared rate-limit and replay guards across replicas.
5. **Human workflow.** Define confirmation, dual approval, or human handoff for irreversible and high-risk work, and test the refusal paths.

## Pre-launch checks

| Area | Minimum check |
| --- | --- |
| Model gateway | HTTPS is required; provider keys do not appear in browser builds; allowed models and upstream origins are pinned |
| Capability surface | Only required actions are declared; dangerous actions have an explicit confirmation policy; invalid and stale targets are tested |
| Session | Missing, expired, revoked, cross-user, and stale-revision cases fail closed |
| Data | Logs are redacted; context contains no tokens, full identity numbers, or unrelated personal data |
| External agents | Exposure and session scope are intersected; a tested kill switch exists |
| Observability | Request id, capability, target, outcome, and duration are available; success is not inferred from the model's last sentence |
| Incident response | Sessions and credentials can be revoked, the external route closed, declarations rolled back, and required audit metadata preserved |

Before launch, rehearse at least an expired session, a revoked credential, a backend denial, a missing target record, and shutdown of the external-agent path.

## Data and logs

The core runtime contains no analytics, advertising identifiers, or remote telemetry endpoint. Data sent to a model gateway depends on the host application's agent configuration and context declarations.

Operators should tell users:

- which model provider receives prompts;
- which fields, records, state, and feedback enter model context;
- whether the provider retains prompts and completions;
- how credentials and customer data are redacted before leaving the origin;
- how long audit, delegation, continuity, and gateway logs are retained;
- which subprocessors or regions are involved.

Gateway audit events deliberately exclude prompts, completions, cookies, and provider keys. Surface audit events exclude input arguments and response bodies by default. An application may need additional business audit, but that data must follow its own access and retention rules.

## Pause and revoke

An incident plan should stop execution without deleting necessary records:

1. Disable the external transport or Surface route.
2. Revoke active delegation credentials and expire related sessions.
3. Disable or roll back affected capability declarations.
4. Preserve audit metadata, request ids, and deployment versions.
5. Require reauthorization for high-risk actions.
6. Verify backend state before replaying an interrupted write.

See [Revoke access and audit actions](/surface/revoke-access-and-audit-actions) and [Delegation and trust boundaries](/reference/delegation-and-trust-boundaries) for the operational procedure.

## Reporting a vulnerability

Use the repository's private **Security → Report a vulnerability** channel (GitHub Security Advisories). Do not open a public issue with exploit details, real credentials, or user data.

A useful report includes:

- affected package and version;
- the smallest reproducible case;
- the expected trust boundary and observed behaviour;
- whether action execution, confirmation, Surface, delegation, continuity, or the model gateway is involved;
- any data or tenant boundary crossed;
- a safe contact method.

Maintainers will establish scope and affected versions first, then coordinate a fix and disclosure. Not every report becomes a public advisory, but confirmed security fixes should appear in release notes without exposing users.

## Supply chain and release checks

The repository is a pnpm workspace with a frozen lockfile. Release checks verify package names, versions, Apache-2.0 metadata, internal `workspace:*` references, published-file boundaries, and a tarball installation smoke test. Boundary checks reject framework implementation inside cases and cross-layer reverse imports.

These checks reduce packaging mistakes. They do not prove that every transitive dependency is trustworthy, that an npm account is uncompromised, or that a published tarball matches a reproducible build. Teams with a higher assurance requirement should mirror, scan, sign, and reproduce artefacts in their own supply chain.
