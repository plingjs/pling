---
id: REF-14
title: "Protocol schemas and registries"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Protocol schemas and registries

There are several different “schemas” around Pling. Keeping them separate prevents a familiar word from hiding incompatible contracts.

| Layer | Authority | Used for |
| --- | --- | --- |
| Capability input schema | `JsonSchema` on an action or capability | Telling an Agent what input fields are valid |
| Surface wire types | `@plingjs/surface` TypeScript types | Exact `describe` / `invoke` envelopes |
| Action registry | `@plingjs/core` `Registry` at runtime | The capabilities the current page can actually route |
| Error registries | Type unions and frozen maps in each package | Stable codes and HTTP mapping |
| Storage schemas | Application backend | Delegation, continuity, audit, and business data |

The 0.1 repository does not publish a standalone JSON Schema bundle for the Surface envelope and does not expose a public schema-registry URL. The TypeScript declarations in the packages and the normative specification are the current source of truth. A JSON Schema package should not be inferred from the presence of per-capability `inputSchema` values.

## Capability input schema

Capabilities use the `JsonSchema` type from `@plingjs/core`. It is intentionally small and oriented toward model tool declarations:

```ts
interface JsonSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
}
```

The runtime derives this schema from declared parameters. It is not a full JSON Schema document or validator. The executor still validates values, availability, and business rules. Do not send a schema and assume that satisfying its surface shape grants permission.

### Record-scoped schemas

A folded capability such as `approve@order` omits `record` from the visible properties and exposes record-template metadata instead. The caller supplies `input.record`, and the host reconstructs the concrete executor id. A schema validator that ignores `record.total`, `record.offscreen`, or the template id can accept a structurally valid call that the host correctly rejects.

## Surface wire types

The principal exports from `@plingjs/surface` are:

| Type | Purpose |
| --- | --- |
| `SURFACE_PROTOCOL` | `"pling.surface/0.1"` |
| `SurfaceMethod` | `"describe" \| "invoke"` |
| `SurfaceDescribeRequest` | Describe request envelope |
| `SurfaceInvokeRequest` | Invoke request envelope |
| `SurfaceResponse` | Success or protocol failure |
| `SurfaceDescription` | Capabilities and bounded context |
| `SurfaceCapability` | One projected capability |
| `SurfaceContext` | Page, regions, records, state, feedback, unavailable items |
| `SurfaceObservation` | Bounded post-invoke change |
| `SurfaceFailure` | `ok: false` protocol error |
| `SurfaceSession` | Verified identity, expiry, scope, revocation |
| `SurfaceAuditEvent` | Metadata-only audit record |
| `SurfaceApprovalBinding` | Immutable fields an external approval backend binds |
| `SurfaceApprovalChallenge` | Human-facing challenge; token is not part of it |

JSON examples in the specification are normative for field names and meaning. TypeScript declarations add compile-time constraints but do not replace runtime validation.

## Runtime action registry

The registry is not a static protocol document. It is built by the page and changes with the current UI. A capability can disappear because:

- a region is no longer active;
- an action becomes unavailable;
- the site allowlist changes;
- the session scope changes;
- a modal or route replaces the relevant declarations.

`describe` returns a snapshot. `invoke` re-checks exposure and delegates to the executor, which re-checks availability. Caching a description forever is therefore unsafe.

## Error registries

### Surface

`SurfaceErrorCode` contains:

```text
INVALID_REQUEST
PROTOCOL_VERSION_UNSUPPORTED
METHOD_NOT_SUPPORTED
CAPABILITY_NOT_EXPOSED
RATE_LIMITED
RATE_LIMIT_UNAVAILABLE
REPLAY_DETECTED
REPLAY_GUARD_UNAVAILABLE
INTERNAL_ERROR
SESSION_REQUIRED
SESSION_INVALID
SESSION_EXPIRED
SESSION_REVOKED
```

Business execution codes are a separate `ActionErrorCode` union from `@plingjs/core`. Examples include `ACTION_NOT_FOUND`, `ACTION_UNAVAILABLE`, `INVALID_PARAMS`, `PERMISSION_DENIED`, `EXPECTATION_FAILED`, `STEP_FAILED`, and the handoff codes. They appear inside a successful Surface response because the protocol reached the executor.

### Delegation

`DELEGATION_ERRORS` is a frozen map from code to HTTP status and default message. It covers invalid request, invalid credential, binding mismatch, not found, revoked, expired, and internal error. This registry belongs to the optional delegation package, not the Surface wire contract.

### Continuity

`ContinuityAuthorityErrorCode` covers task existence, not found, revision conflict, held or expired or revoked leases, owner mismatch, unauthorized, store unavailable, and invalid state. `@plingjs/continuity-http` maps those codes to HTTP responses.

### Gateway

The server gateway returns OpenAI-compatible error bodies but uses its own stable codes, including `INVALID_JSON`, `MODEL_REQUIRED`, `MODEL_NOT_ALLOWED`, `UNAUTHORIZED`, `PAYLOAD_TOO_LARGE`, `UPSTREAM_TIMEOUT`, `UPSTREAM_RATE_LIMITED`, and `GATEWAY_MISCONFIGURED`. Do not reuse Surface codes for gateway failures.

## Compatibility rules

- Treat `pling.surface/0.1` as the negotiated protocol version, not the npm package version.
- Package versions use semver; protocol versions use explicit strings.
- Additive fields are allowed for tolerant readers, but a writer must not assume an older reader understands them.
- Removing a field, changing its meaning, changing an error code's category, or requiring a new method is a breaking protocol change.
- Unknown response fields should be ignored; unknown required request fields should be rejected.
- Business error codes and protocol error codes must remain separate namespaces.
- Registry state is a runtime snapshot, not a durable configuration artifact.

## Artifacts not published

The following are not published by this repository:

- a root `surface.schema.json`;
- a public schema registry service;
- generated OpenAPI or MCP server definitions for every capability;
- a machine-readable catalog of all possible business capabilities.

If these artifacts are added later, they must be generated from the same types and tested against the same fixtures. A hand-written second schema would create exactly the drift this reference is intended to prevent.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/surface` `0.1.0-alpha.3` |
| Protocol | `pling.surface/0.1` (Draft) |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Browsers with ES2022 modules; Node.js 20 or later for Node-side use |
| Peer dependencies | None |
| Stability | Draft protocol; package and protocol versions are independent |

The wire types and registries are versioned with `pling.surface/0.1`; the npm package version is separate. No schema artifact is published at this version, so the types and conformance fixtures remain the reference.
