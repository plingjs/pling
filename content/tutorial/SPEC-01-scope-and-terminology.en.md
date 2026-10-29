---
id: SPEC-01
title: "Scope and terminology"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Scope and terminology

This specification defines the observable behavior of Pling Agent Surface version `pling.surface/0.1`. It is written for implementers of page surfaces, external agent clients, and transport adapters. This version is a public draft, not a certified industry standard.

## Normative language

The terms **MUST**, **MUST NOT**, **SHOULD**, and **MAY** describe requirements of different strength:

- **MUST / MUST NOT** define behavior required for conformance with this version.
- **SHOULD** allows an exception only when it is explicit and auditable.
- **MAY** marks optional behavior.

Wire field names, method names, and error codes are case-sensitive. Business names in examples are illustrative and do not prescribe naming.

## Scope

This specification covers:

1. how a page describes the business capabilities visible to an external caller;
2. how a caller obtains bounded context and requests execution of one capability;
3. the protocol-boundary meaning of sessions, exposure, approval, rate limits, replay protection, and audit;
4. the distinction between success, business failure, and protocol failure;
5. a transport-neutral envelope and the minimum observable requirements for conformance.

Version 0.1 defines only `describe` and `invoke`. Connection setup, user login, credential issuance, transport discovery, and page teardown are outside the wire protocol.

## Non-goals

This specification does not define general browser automation. It provides no interface for clicking arbitrary selectors, evaluating scripts, reading the raw DOM, making arbitrary HTTP requests, or bypassing page authority.

It does not replace business authorization. A listed capability, or a successful protocol exchange, does not prove that the user may complete that business action. Final authorization remains with the application backend and its existing rules.

## Terminology

| Term | Meaning |
| --- | --- |
| Application | The web application or site that provides the surface |
| Page | The business interface currently being projected |
| Host | Trusted code that holds the page session, verifies callers, and carries the transport |
| Capability | A business operation with a stable id, description, effect, and optional input schema |
| Surface | The capabilities and context an application exposes in the current session |
| Description | The capability list and bounded context returned by `describe` |
| Executor | The application's existing execution path for validation, availability, approval, and result verification |
| Session | A verified binding of caller, user, scope, and expiry established by the transport or backend |
| Delegation | The process by which a user grants limited capabilities to a specific agent and session |
| Record | A stably referenceable view of a business object, not a DOM node |
| Region | A page area with business meaning |
| Evidence | Observable changes, results, or structured failures after execution, excluding credentials |
| Conformance | The degree to which an implementation meets the observable requirements of this version |

## Relationship to MCP

MCP defines how tools appear to an agent runtime and can carry this specification as a transport and tool-presentation layer. It does not define the business meaning of page capabilities, context boundaries, or the fact of approval. An MCP facade can forward `describe` and `invoke`, but it still has to obey this specification.

## Questions an implementer must answer

- Which protocol version is in use?
- Which capabilities are visible to this session?
- What input, effect, approval, and handoff requirements apply to each capability?
- Has the current context truncated its record window?
- Was a call a protocol failure, a business failure, or completed?
- Which user, agent, and session were bound to the call?
- Which values must never enter agent context or logs?

See [Capability model](/spec/0.1/capability-model) and [Messages and envelopes](/spec/0.1/messages-and-envelopes).
