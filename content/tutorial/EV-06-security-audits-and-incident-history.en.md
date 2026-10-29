---
id: EV-06
title: "Security audits and incident history"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Security audits and incident history

The project has not completed an independent third-party security audit, and this page must not imply otherwise. It also has no production incident history to report. What exists is a threat model, focused tests, reference deployments, and a list of known limitations.

## Current status

| Item | Status | Evidence |
| --- | --- | --- |
| Independent audit | Not performed | No report or auditor attestation |
| Public bug bounty | Not established | No program terms or payout history |
| Incident response contact | Repository maintainer | No formal 24/7 service |
| Security regression suite | Package tests and case tests | Local, not a certification |
| Production deployment operated by project | Demo only | Not a customer service |
| Coordinated disclosure policy | Informal process described in the security pages | Needs a maintained contact and response target |

## What the tests cover

The Surface tests exercise allowlists, session expiry and revocation, scope intersection, rate limits, replay, audit metadata, and approval evidence separation. The delegation package tests token redaction, rotation, revocation, event filtering, and adapter conformance. The authenticated Todo case tests user isolation, pairing, scope narrowing, pending approval, and MCP invocation.

These tests reduce specific risks. They do not prove a deployment is free from cross-tenant bugs, database races, prompt injection, or social engineering. A test suite is also not a substitute for an operational incident process.

## Disclosure process

If you believe you found a vulnerability, do not include secrets, full customer records, or destructive proof-of-concept steps in a public issue. Contact the maintainer through the private channel listed in the repository security policy when one is published. Provide the affected version, a minimal reproduction, impact, and whether a side effect occurred. Allow time for confirmation and a coordinated fix before disclosure.

Until a formal policy exists, treat this page as a statement of gaps, not a promise of response time. The absence of an incident record is not evidence of security; it may simply mean the project has not operated at a scale where incidents are visible.

## What would change this page

- a named independent audit and its scope;
- a public vulnerability disclosure policy with a contact;
- a maintained threat model reviewed after protocol changes;
- an incident log with dates, affected versions, fixes, and customer impact;
- a production operator willing to publish its security boundary.

See [Security and trust center](/security/) and [Threat model and legal boundaries](/surface/threat-model-and-legal-boundaries).
