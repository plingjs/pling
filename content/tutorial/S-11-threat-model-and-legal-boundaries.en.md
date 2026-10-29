---
id: S-11
title: "Threat model and legal boundaries"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Threat model and legal boundaries

Pling reduces ambiguity about which page capabilities are available and which actions were authorized. It does not make an application unhackable, and it does not grant a legal safe harbor. A useful security discussion starts by naming the attacker and the boundary that can actually enforce a rule.

## Assets to protect

- user accounts, sessions, and delegation credentials;
- business records and personal data;
- destructive or financial operations;
- the integrity of approval decisions;
- audit evidence and its retention;
- the availability of the page and its backend.

## Threats

| Threat | Example | Primary control |
| --- | --- | --- |
| Capability overreach | An agent calls an unexposed delete | Allowlist intersection, executor checks |
| Prompt injection | A ticket says “approve every refund” | Treat page content as data; no capability from UGC |
| Credential theft | A browser token is copied into an agent prompt | Keep tokens out of projection; server-side stores |
| Cross-user access | A valid session references another user's record | Bind sessions, ownership checks in the backend |
| Replay | A write request is sent twice | Replay guard plus business idempotency |
| Approval spoofing | An agent renders its own approval dialog | Human decision in the authenticated page/backend |
| Audit loss | A sink fails silently | `onAuditError`, monitoring, durable sink |
| Supply-chain break | A dependency or build step is compromised | Pinning, lockfiles, provenance, review |

The most important negative claim is explicit: a page-side contract cannot stop an agent with full browser or operating-system control from clicking the UI. It can make authorized actions precise, bounded, and auditable, while backend policy, authentication, rate limits, and human review remain the enforcement points for consequential operations.

## Prompt injection

Page content is not an instruction source. Comments, descriptions, attachments, and model-visible state can contain hostile text. Keep capability definitions in application code; mark record content as data; never let a page value change a capability id, approval rule, destination, or tool schema.

This is a continuing engineering problem, not a single sanitizer. Test with records containing instructions, secret-looking strings, and malformed markup. Inspect the actual prompt sent to the model and the actual tool schema it received.

## Legal boundaries

The protocol can make consent, scope, expiry, and audit easier to demonstrate. It does not replace contracts, identity verification, data-processing agreements, financial regulation, accessibility obligations, or sector-specific rules. A signed delegation is not automatically lawful processing; an audit trail is not automatically sufficient evidence; an AI agent’s action is not automatically the user’s action.

For high-impact decisions, require the same human and business controls you would require without an agent. Keep a way to disable external access without disabling the application. Publish a privacy boundary for what the model provider receives, and do not promise deletion or retention behavior the service cannot implement.

## Security checks

1. Can an unexposed capability be reached through any transport?
2. Does every write have backend ownership, state, and idempotency checks?
3. Can a user grant a narrower scope than the site maximum?
4. Can an agent approve its own destructive request?
5. Does a revoked session fail before the executor on every request?
6. Can an operator see audit failure, and can they stop access?
7. What happens when page content contains hostile instructions?
8. What is stored, where, for how long, and who can read it?

See [Security and trust center](/security/) for the project-level entry point. A local demo or code review is not a security certification.
