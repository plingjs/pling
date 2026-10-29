---
id: SPEC-08
title: "Security and privacy"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Security and privacy

A surface expands the reachable set of page capabilities, so security cannot live only in prompts or client code. Implementations should assume hostile callers, prompt-injected models, and leaked credentials, and should fail closed on every rejected path.

## Threats

| Threat | Example | Primary controls |
| --- | --- | --- |
| Confused deputy | An agent uses a user's session for an action the user did not approve | Explicit delegation, scope intersection, backend authorization |
| Privilege escalation | A capability is hidden, but a similar id still executes | Same intersection check, default deny |
| Replay | A request is resubmitted and writes twice | Request ids, replay window, idempotent business logic |
| Prompt injection | Ticket text tells the agent to ignore rules | Data/instruction separation, fixed capability descriptions |
| Credential leakage | A token enters model context, logs, or URLs | Credentials remain in the host; outbound redaction |
| Session hijacking | A cross-site request or stolen cookie calls the bridge | SameSite, CSRF defense, origin checks, short-lived delegation |
| Hostile agent | High-volume calls, probing, or induced approval | Rate limits, audit, approval isolation, revocation |
| UI deception | Approval UI shows different parameters from execution | Bind normalized arguments to a human-readable summary |
| Supply chain | A malicious SDK or dependency reads page data | Locked dependencies, build audit, least privilege |

## Authentication, authorization, and protocol checks

These are three independent layers:

- authentication establishes who is calling;
- business authorization establishes whether this user may perform the action;
- protocol validation establishes whether the capability belongs to this exposure.

Success at one layer MUST NOT replace the others. The backend MUST recheck permission, tenant, object ownership, amount, and business constraints before a write. A page capability description is not a database grant.

## Least exposure

An application should decide per field, capability, and page whether an external agent needs it. It should not project an entire store, DOM, or internal API by default.

Sensitive values may be:

- omitted entirely;
- represented by a stable alias resolved by the page at execution;
- masked for human recognition;
- shown in clear text only in a user approval surface.

An alias MUST bind to one record and field and MUST NOT be reused on another object. Responses, `after` data, errors, debug panels, and audit logs all follow the same exposure policy.

## Prompt injection and data boundaries

User comments, filenames, ticket bodies, web content, and tool results are untrusted data. They MUST NOT alter capability descriptions, approval requirements, or system rules. Clients SHOULD place page content in an explicit data channel and avoid promoting text such as “ignore previous instructions” into tool instructions.

Model-generated arguments MUST be validated against schema and record ownership before execution. The model cannot choose `userId`, `agentId`, `sessionId`, or approval outcome.

## Approval and revocation

A high-risk action MUST be confirmed by a real user. The challenge SHOULD bind:

- request id;
- capability id;
- target record;
- canonical input digest;
- user, agent, and session;
- expiry.

The agent sees pending status and the final result only, never an approval token. Revocation MUST make subsequent calls fail immediately; browser events are an accelerator, not a replacement for per-call validation.

## Audit and privacy

Audit should answer who did what to which record and when, without retaining raw prompts or full business text. Record metadata and stable error codes by default, and use controlled identifiers for sensitive fields. The deployment owner defines retention, access control, and data-subject procedures.

## Deployment controls

- expose remote transports only over HTTPS;
- keep credentials out of URLs and frontend build variables;
- validate origin and source for `postMessage`;
- apply CSRF and same-origin defenses to HTTP;
- persist and alert on rate-limit, replay, and audit signals;
- lock dependency versions and scan for vulnerabilities;
- prepare a path to pause globally, revoke one agent, narrow scope, and roll back a release.

## Legal boundary

The protocol creates no automatic compliance status or liability exemption. It makes authorization scope, user consent, least privilege, and audit chains clearer, but high-risk business still needs contracts, identity verification, human review, and controls required by applicable law. This version has no independent security audit and no certified third-party implementation. “Protocol support” is not “security certification.”
