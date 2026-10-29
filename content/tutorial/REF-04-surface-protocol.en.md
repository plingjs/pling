---
id: REF-04
title: "Surface protocol"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Surface protocol

`@plingjs/surface` implements the transport-independent boundary for `pling.surface/0.1`. It projects the existing action registry into capabilities and routes an external invocation back through the application's executor. It does not authenticate callers, choose a transport, execute DOM clicks, or maintain a second permission system.

The normative semantics are in [Scope and terminology](/spec/0.1/scope-and-terminology) through [Messages and envelopes](/spec/0.1/messages-and-envelopes). This page records the exact exported API and defaults of the reference implementation.

## Public entry points

```ts
import {
  SURFACE_PROTOCOL,
  SurfaceSessionError,
  createSurface,
  type AgentSurface,
  type SurfaceOptions,
} from "@plingjs/surface";
```

| Export | Kind | Meaning |
| --- | --- | --- |
| `SURFACE_PROTOCOL` | constant | `"pling.surface/0.1"` |
| `createSurface(options)` | function | Creates the protocol projection |
| `AgentSurface` | interface | `describe(input?)` and `handle(request)` |
| `SurfaceSessionError` | class | Session failure from direct `describe()` calls |
| `DEFAULT_SURFACE_RECORD_LIMIT` | constant | `8` records per description by default |
| `MAX_SURFACE_RECORD_LIMIT` | constant | `100` records per description at most |

`SurfaceMethod` contains only `"describe"` and `"invoke"`. `attach`, `observe`, `handoff`, and `detach` are not part of 0.1 and must not be inferred from this package.

## `createSurface(options)`

`registry` and `execute` are required. Everything else narrows exposure, binds identity, or adds operational evidence.

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `registry` | `Registry` | required | The same registry used by the in-page agent |
| `execute` | `(id, argsJson?, context?) => Promise<ExecResult>` | required | Must call the existing executor; Surface does not reimplement confirmation, availability, or expectations |
| `app` | `string` | omitted | Application identifier copied into descriptions |
| `expose` | `readonly string[] \| (id) => boolean` | all current capabilities | Site-level allowlist; array entries may contain folded templates such as `approve@order` |
| `session` | `SurfaceSession \| () => SurfaceSession \| null` | open mode | Use a getter to re-read expiry and revocation; open mode is for local debugging only |
| `recordLimit` | `number` | `8` | Record window for `describe` |
| `maxRecordLimit` | `number` | `100` | Upper bound for a caller-supplied `limit` |
| `rateLimit` | `{ maxRequests, windowMs, limiter? }` | disabled | Applies to `handle()` and is isolated by verified session |
| `replay` | `boolean \| { windowMs?, guard? }` | disabled | Applies to `invoke`; the default guard window is five minutes when enabled |
| `onAudit` | `(event) => void \| Promise<void>` | omitted | Metadata only; no input arguments, response body, cookie, or token |
| `onAuditError` | `(error, event) => void \| Promise<void>` | omitted | Receives a failed audit write; production should attach alerting here |

### Session boundary

`SurfaceSession` contains `agentId`, `sessionId`, `userId`, `expiresAt`, an explicit `scope`, an optional `delegationId`, and an optional `revokedAt`. The transport or backend must verify all of it before constructing the session. A browser request body cannot be treated as a session.

Exposure is the intersection of `expose` and `session.scope`. Omission of `session.scope` is invalid. A session getter is evaluated for each `describe` or `handle`, so expiry and revocation take effect without restarting the page.

When a session is configured, direct `surface.describe()` throws `SurfaceSessionError`; `surface.handle()` converts the same condition into a protocol failure. Production transports should call `handle()` and return the structured response.

### Limits and replay

The built-in rate limiter is an in-process sliding window. For multiple replicas, provide a shared `SurfaceRateLimiter`. An adapter error or malformed decision fails closed with `RATE_LIMIT_UNAVAILABLE`; it must never be interpreted as permission.

Replay protection reserves `(session, request.id)` before execution. A repeated `invoke` within the window returns `REPLAY_DETECTED` and does not call the executor. The guard does not cache the earlier response. A transport-level retry therefore needs a new request id only after it has established that the previous attempt did not commit a business effect.

## `describe(input?)`

The input is optional. Accepted fields are mutually constrained:

| Field | Constraint | Effect |
| --- | --- | --- |
| `record` | one id or `1–20` ids | Return fields for those records only |
| `offset` | non-negative integer | Start of the returned record page |
| `limit` | non-negative integer | Page size; clamped to `maxRecordLimit` |
| `capabilities` | `"full"` or `"changed"` | `"changed"` may return an empty list when the capability signature is unchanged |

`record` cannot be combined with `offset` or `limit`. Unknown fields make the request invalid. The capability list can remain complete while record fields are windowed; `context.recordIds` still contains all records that can be referenced in the active regions.

The result is a `SurfaceDescription`:

```json
{
  "protocol": "pling.surface/0.1",
  "app": "orders",
  "capabilities": [],
  "context": {
    "regions": [],
    "records": [],
    "recordIds": [],
    "recordIdsTotal": 0,
    "state": {},
    "feedback": [],
    "unavailable": [],
    "recordsTotal": 0,
    "feedbackTotal": 0,
    "unavailableTotal": 0
  }
}
```

Capabilities are stable wire objects, not raw internal action views. Each capability can include `id`, `description`, `inputSchema`, `effect`, `approval`, `fidelity`, `source`, `scopePath`, `handoff`, `flowSteps`, `offscreen`, and record-template metadata.

## `handle(request)`

`handle()` accepts `unknown` and does not throw for malformed input. It returns one of three shapes:

```ts
type SurfaceResponse =
  | { ok: true; id: string; protocol: "pling.surface/0.1"; result: SurfaceDescription }
  | { ok: true; id: string; protocol: "pling.surface/0.1"; result: ExecResult; after?: SurfaceObservation }
  | { ok: false; id: string; protocol: "pling.surface/0.1"; error: { code; message; retryAfterMs? } };
```

An `invoke` request has `protocol`, `id`, `method: "invoke"`, `capability`, and an optional object-valued `input`. The id must be unique for an intended side effect and stable for retries of the same request.

A business rejection is still an `ok: true` protocol response whose `result` contains the executor's structured error. `ok: false` means the protocol could not safely reach a business result.

### Protocol failures

| Code | Typical cause |
| --- | --- |
| `INVALID_REQUEST` | Missing fields, wrong JSON shape, unknown describe fields, or invalid limits |
| `PROTOCOL_VERSION_UNSUPPORTED` | A version other than `pling.surface/0.1` |
| `METHOD_NOT_SUPPORTED` | A method other than `describe` or `invoke` |
| `CAPABILITY_NOT_EXPOSED` | The id is absent from the site allowlist or session scope |
| `RATE_LIMITED` | The session exceeded its window; inspect `retryAfterMs` |
| `RATE_LIMIT_UNAVAILABLE` | The shared limiter failed or returned an invalid decision |
| `REPLAY_DETECTED` | The same session reused an invoke id inside the replay window |
| `REPLAY_GUARD_UNAVAILABLE` | The shared replay guard failed or returned an invalid decision |
| `SESSION_REQUIRED`, `SESSION_INVALID`, `SESSION_EXPIRED`, `SESSION_REVOKED` | The verified session is missing or no longer usable |
| `INTERNAL_ERROR` | An unexpected failure outside the business result path |

## Minimal server-side composition

```ts
import { createExecutor, createPolicy } from "@plingjs/core";
import { createSurface, SURFACE_PROTOCOL } from "@plingjs/surface";

const executor = createExecutor({ registry, policy: createPolicy(confirm) });

const surface = createSurface({
  registry,
  execute: (id, args) => executor.execute(id, args),
  app: "orders",
  expose: ["orders.search", "orders.update_note@order"],
  session: () => verifiedSession,
  rateLimit: { maxRequests: 60, windowMs: 60_000 },
  replay: { windowMs: 5 * 60_000 },
  onAudit: (event) => audit.write(event),
  onAuditError: (error, event) => logger.error({ error, event }, "surface audit failed"),
});

const response = await surface.handle({
  protocol: SURFACE_PROTOCOL,
  id: "req-01",
  method: "invoke",
  capability: "orders.update_note@order",
  input: { record: "SO-1002", note: "Customer asked for a callback" },
});
```

The adapter around this call still owns authentication, HTTP, SSE, CORS, body limits, and response redaction. `surface.plingjs.dev` is a demonstration endpoint, not a shared proxy for customer applications.

## Deliberate omissions

- No generic selector click, script evaluation, raw DOM read, or arbitrary HTTP primitive.
- No browser credential parsing inside Surface.
- No business authorization replacement.
- No transport-mandated envelope framing beyond the JSON objects shown here.
- No public third-party Surface certification suite. The conformance helpers that do exist are listed in [Surface conformance and interoperability](/reference/surface-conformance-and-interoperability).

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/surface` `0.1.0-alpha.2` |
| Protocol | `pling.surface/0.1` (Draft) |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Browsers with ES2022 modules; Node.js 20 or later for Node-side use |
| Peer dependencies | None |
| Stability | Pre-1.0 alpha; package and protocol versions move independently |

The package version and the protocol version are separate. A `0.1.x` package release does not by itself make `pling.surface/0.1` a stable standard, and this reference does not promise compatibility with an unlisted protocol version.
