---
id: EV-03
title: "Conformance and interoperability matrix"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Conformance and interoperability matrix

This page records what the repository currently tests and what remains unverified. It is an engineering matrix, not a certification register.

| Area | Evidence in repository | Status |
| --- | --- | --- |
| `describe` allowlist and bounded context | `packages/surface/test/surface.test.ts` | Implemented and tested |
| `invoke` through executor | Surface tests plus the external-agent fixtures | Implemented and tested |
| Session expiry, revocation, and scope intersection | Surface tests plus the delegation lifecycle fixtures | Implemented; reference adapters tested |
| Rate limit and replay guards | Surface tests plus the production-port fixtures | Implemented; in-memory and reference adapters |
| Audit metadata and approval linkage | The audit and approval fixtures | Reference implementation tested; production sink is host-owned |
| Delegation lifecycle ports | `@plingjs/delegation` tests and conformance helpers | Implemented; memory and reference file stores tested |
| Vue / React / vanilla adapters | Adapter tests and tutorial examples | Implemented for documented features |
| Cross-adapter declaration parity | The mixed-adapter fixtures and tutorial checks | Tested on fixtures, not universal |
| Surface vs DOM benchmark | The two benchmark reports | Frozen-fixture evidence, not generalization |
| Public cross-implementation conformance suite | Not present | Not yet available |
| Certified third-party implementations | None claimed | Not yet established |
| Production identity provider / SSO | No shared implementation | Host responsibility |
| Production transport at `surface.plingjs.dev` | Demo only | Not a customer gateway |

## How to read “implemented”

“Implemented and tested” means the named package has code and a focused test in this repository. It does not mean every deployment that imports the package is secure, or that all adapters behave identically in every browser. “Reference” means a case demonstrates one design; it is not a productized service.

The absence of a public conformance suite matters. A test in this repository can be copied, but it is not a stable external contract until its cases, versions, and governance are published. Until then, an interoperability claim should name the exact fixture and commands used.

## Missing evidence

- a second independent Surface implementation;
- a second transport that passes the same conformance cases;
- real enterprise SSO and multi-tenant isolation;
- production-scale rate limiting, replay, and audit retention;
- browser automation against closed shadow roots and cross-origin frames;
- a human-factors study of approval interfaces;
- a security audit by an independent party;
- adoption by an unaffiliated production site.

These gaps do not make the implemented tests useless. They bound the claim. The project should add rows when evidence exists, not turn a planned capability into a check mark.

## Reproduce locally

Use the package tests first, then the tutorial checks, then the fixture-specific benchmark commands. Record package versions, browser, Node version, and git state. A result produced from an uncommitted worktree must say so; it cannot be compared silently with a clean commit.

For the protocol-level expectations, see [Conformance and interoperability](/surface/conformance-and-interoperability). For raw benchmark evidence, see [Benchmark methodology](/evidence/benchmark-methodology-and-reproducibility).
