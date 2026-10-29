---
id: SPEC-10
title: "Versioning and governance"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Versioning and governance

A version number is a compatibility promise, not release decoration. Governance determines who may change that promise, how security boundaries are reviewed, and how implementers know whether a version is still supported.

## Protocol versions

The current value is `pling.surface/0.1`. It appears in every request and response, and clients MUST match it exactly.

- **Patch revisions** clarify text, tests, or documentation without changing wire behavior.
- **Minor versions** may add backward-compatible optional fields or methods.
- **Major versions** remove fields, change semantics or default authorization, or introduce incompatible errors.

Before 1.0 the protocol may still change. Every incompatible change MUST increment the version and cause old clients to receive `PROTOCOL_VERSION_UNSUPPORTED` or a clear method error. It MUST NOT execute silently under the old meaning.

## Extensions

An extension MUST:

1. be safely ignorable by an old client;
2. preserve the meaning of existing fields;
3. not move a security decision into the client;
4. have a distinct error code or capability marker;
5. have test vectors and a rollback path.

A deployment may use a private extension, but MUST NOT call it part of the 0.1 standard. Extensions affecting authorization, audit, or approval need public documentation especially.

## Deprecation

Removing a capability or field SHOULD follow:

```text
public proposal → impact and security review → compatibility path
→ deprecation and migration guide → at least one stable period
→ removal in a major version
```

The notice MUST state old behavior, replacement, last supported version, and migration failure modes. A code comment is not a deprecation process.

## Governance

Until stable adoption exists, governance should remain small and transparent:

- publish change proposals and discussion records;
- identify maintainers, decision process, and conflicts of interest;
- review security changes with relevant expertise;
- version protocol text, reference implementation, and conformance tests separately;
- never describe certification, trademarks, or commercial support as requirements of the protocol itself.

There is currently no independent foundation, technical steering committee, or certification body. Any future structure should be established through public documentation. It cannot retroactively turn this draft into an approved standard.

## Compatibility matrix

Each release SHOULD state:

| Area | Record |
| --- | --- |
| Protocol | Supported versions and unknown-version behavior |
| Packages | Versions, runtime and framework requirements |
| Transport | Reference implementations and unsupported features |
| Security | Rate-limit, replay, audit, and revocation status |
| Evidence | Commands, fixture, date, and known gaps |

A compatibility claim MUST match the evidence. Passing on one browser or an in-memory adapter is not a cross-environment guarantee.

## Licensing

Code uses Apache-2.0. Protocol text is intended to use CC-BY-4.0, while reference implementations and conformance tests use Apache-2.0. This separation allows broad implementation while preserving attribution for the text. A license is not security certification and does not grant rights to the Pling trademark.
