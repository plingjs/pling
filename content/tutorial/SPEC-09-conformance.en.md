---
id: SPEC-09
title: "Conformance"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Conformance

Conformance is observable behavior that another party can reproduce. It is not trust in a package name. An implementer should publish fixtures, requests, environment, and results, and state what was not tested.

## Roles

| Role | Minimum expectation |
| --- | --- |
| Surface implementation | `describe`, `invoke`, envelope validation, scope intersection, executor passthrough, stable errors |
| Client | Valid envelopes, protocol/business distinction, no reuse of business call ids |
| Transport adapter | Caller authentication, faithful delivery, size limits, correlation, revocation |
| Delegation adapter | Credential lifecycle, scope, revocation, safe-view invariants |

One deployment may fill several roles, but each role still needs its own tests. Passing client tests does not prove server authorization, and vice versa.

## Required cases

A conformance run MUST cover:

1. successful `describe` with capabilities and bounded context;
2. `PROTOCOL_VERSION_UNSUPPORTED` for an unknown version;
3. `METHOD_NOT_SUPPORTED` for an unknown method;
4. `INVALID_REQUEST` for missing `id`, `protocol`, or invalid `input`;
5. hidden capabilities absent from description and rejected by `invoke`;
6. folded actions accepting only currently referenceable record ids;
7. business errors preserved in `result.error` after protocol success;
8. missing, expired, revoked, or malformed sessions preventing executor calls;
9. rate-limit and replay hits producing no business side effect;
10. bounded `after` data without credentials or approval secrets;
11. audit events without raw arguments, response bodies, or tokens;
12. old descriptions no longer authorizing calls after navigation or scope change.

## Method

Use one fixture with:

- one read capability;
- one write capability with a schema;
- one folded record action;
- one destructive action requiring approval;
- one currently unavailable action;
- one action excluded by session scope.

Run fixed request vectors against client and server, recording responses and business state. Every denial MUST assert that the business handler was not called. Use a deterministic clock or injected rate/replay adapters for asynchronous behavior; do not rely on wall-clock sleeps.

## Claiming a result

An implementation may claim that it passed the 0.1 vectors in `packages/surface/test/surface.test.ts`. It MUST NOT claim “Pling certified” from that alone. There is currently no public certification program and no independently verified second implementation.

Deployment-specific behavior such as a custom limiter, SSO, or audit sink needs separate evidence. An in-memory local test does not represent production multi-instance behavior.

## Versions and extensions

When a future revision adds methods or optional fields, the suite should distinguish baseline requirements from extensions. An old implementation that lacks an extension MUST return a stable error rather than silently ignore it. A release should retain old-client tests and show that incompatible changes are rejected explicitly.
