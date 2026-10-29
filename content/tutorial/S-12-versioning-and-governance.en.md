---
id: S-12
title: "Versioning and governance"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Versioning and governance

A protocol becomes useful when independent implementers can tell whether they will still work together next month. That requires more than a version string. It requires a compatibility rule, a deprecation window, an evidence trail, and a process that does not silently change meaning.

## Protocol versions

The current protocol is `pling.surface/0.1`. It implements `describe` and `invoke`. The `0.1` label marks an early, deliberately narrow contract; it does not promise that every future experimental method is already present.

An additive change may remain in a minor revision when an old client can ignore it safely: an optional field, a new capability, a new information-only result field. A breaking change needs a new revision: required input, envelope shape, method semantics, error meaning, or security rule. A client must never interpret an unknown failure as success.

## What governance must decide

- who can propose a protocol change;
- what evidence is required before accepting it;
- how security and privacy reviews are recorded;
- how a revision is tested across at least two implementations;
- how deprecation dates and migration paths are published;
- how a capability becomes “stable” rather than merely implemented;
- how disputes and backward-compatibility exceptions are handled.

The project is still building that process. It has a specification draft, reference code, focused tests, and benchmark evidence, but it does not yet have a certified multi-vendor ecosystem. Documentation should say that plainly.

## Versioning capability ids

Changing a capability's meaning is a breaking change even when its transport remains valid. If “approve” starts applying a different limit or approves a different object, use a new id or a versioned application namespace. Keep old ids working through a declared migration window when external agents may depend on them.

Do not version everything mechanically. A typo in a description is not a new capability. Decide whether the consumer sees a changed contract: input, effect, approval, result, or target semantics.

## Governance artifacts

A credible release includes:

- the protocol text and schemas;
- a changelog with compatibility classification;
- conformance cases and observed results;
- security notes and known limitations;
- a migration guide for clients and hosts;
- a named owner and review record.

For a young project, the smallest honest governance is a public RFC issue, two independent reviewers for security-sensitive changes, a compatibility label, and a test artifact. Do not create a committee before there are decisions to make; do not call a closed design meeting a standard.

## Relationship to licenses and standards bodies

Code is licensed under Apache-2.0. Protocol text is intended to use CC-BY-4.0, with reference implementations and conformance tests under Apache-2.0. A license grants permission to use text or code; it does not certify an implementation or grant use of project trademarks. Any certification program needs its own published criteria and trademark policy.

The project should seek adoption before formal standardization. A protocol with two real clients, a reproducible benchmark, and an open failure record has more standing than a logo with no implementers.

See [License and trademark](/license/), [Governance and community](/governance/), and [Versioning and compatibility](/concepts/versioning-and-compatibility).
