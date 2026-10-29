---
id: S-10
title: "Conformance and interoperability"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Conformance and interoperability

Interoperability means two independently built implementations can exchange `describe` and `invoke` without sharing internal classes or agreeing on a particular transport. Conformance is the set of observable behaviors both must reproduce. It is not a logo, and a successful demo with one client is not enough.

## What a conforming implementation must preserve

At protocol version `pling.surface/0.1`, a basic conformance suite should check:

1. Unknown protocol versions are rejected with `PROTOCOL_VERSION_UNSUPPORTED`.
2. Unknown methods are rejected with `METHOD_NOT_SUPPORTED`.
3. Invalid envelopes produce `INVALID_REQUEST` and never call the executor.
4. `describe` and `invoke` apply the same site allowlist and session scope.
5. An unexposed capability is absent from `describe` and rejected by `invoke`.
6. A folded record action uses the declared target parameter and does not accept an arbitrary selector.
7. A business failure is returned inside a successful protocol response, not relabeled as a protocol failure.
8. Session missing, expired, revoked, or invalid fails closed before execution.
9. Rate and replay failures use their stable codes and do not execute the business function.
- A successful invoke returns bounded `after` evidence when the implementation provides it and does not leak credentials or hidden approval data.

## What is not standardized yet

The current protocol does not define `attach`, `observe`, `handoff`, or `detach`; it does not define a mandatory transport; and it does not ship a public cross-implementation conformance package. The repository has focused tests for the reference Surface kernel and adapter conformance tests for the delegation package. Those are evidence for those implementations, not a certification program.

Do not claim “Surface certified” unless a published suite and governance process exist. A local integration test is useful; it is not an interoperability mark.

## A practical interoperability harness

Run the same fixture against both implementations:

- one page with a read action, a folded record write, a destructive action with page confirmation, and an unavailable action;
- one agent client that never reads internal registry objects;
- a fixed set of request envelopes, including malformed versions and methods;
- a business-state assertion after each accepted call;
- an audit assertion that a denied call produced no side effect.

Capture request ids, protocol version, capability ids, result codes, and side effects. Compare outcomes, not internal call logs. An implementation that returns a different transport wrapper but the same protocol meaning can interoperate; one that silently executes an unexposed id cannot.

## Version negotiation

`0.1` clients should send the exact protocol value and fail clearly when the server does not support it. Future revisions may add a capability or negotiate optional fields, but they must not make an old client believe an irreversible write succeeded when it did not. Unknown result fields should be preserved or ignored safely, never treated as approval.

## Evidence to publish

For each interoperability claim, publish the fixture, the request shapes, the environment, the test command, and the observed outcomes. State what was not tested: other transports, other models, a hostile tenant, or a production identity provider. A narrow, reproducible result is more valuable than a broad assertion with no artifact.

See [Surface conformance and interoperability](/reference/surface-conformance-and-interoperability) for the tested boundary and [Protocol schemas and registries](/reference/protocol-schemas-and-registries) for the type surface.
