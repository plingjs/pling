---
id: REF-13
title: "Surface conformance and interoperability"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Surface conformance and interoperability

Interoperability means an independent client and host agree on observable protocol behavior. It does not mean both products use Pling packages, share a database, or pass an undisclosed vendor checklist.

The 0.1 repository does **not** publish a third-party Surface certification program. There is no public conformance seal, no certified vendor list, and no claim that passing the repository tests makes an implementation standards-compliant. What exists is an executable reference implementation, package-level tests, adapter conformance helpers for delegation and continuity, and reproducible examples. Those are evidence, not certification.

## Required Surface behavior

An implementation that claims `pling.surface/0.1` should demonstrate the following observable contract.

### 1. Version and method handling

- Accept the exact protocol string `pling.surface/0.1`.
- Reject another version with `PROTOCOL_VERSION_UNSUPPORTED`.
- Implement `describe` and `invoke` only.
- Reject `attach`, `observe`, `handoff`, `detach`, or an unknown method with `METHOD_NOT_SUPPORTED` unless the implemented protocol revision explicitly includes it.
- Preserve the request `id` in every response when it can be parsed.

### 2. Capability projection

- Return stable capability ids, descriptions, effect, input schema, approval requirement, fidelity, and record-template metadata when applicable.
- Keep the site allowlist and the session scope intersected.
- Never expose a capability that the executor cannot actually route.
- Treat a forbidden id as absent rather than leaking a detailed internal reason.
- Distinguish `read`, `write`, and `destructive` effects.
- Preserve developer-declared versus derived provenance when the host supports derivation.

### 3. Bounded context

- Return only the record window requested by the caller, bounded by a host maximum.
- Report totals and window metadata when records are truncated.
- Keep `recordIds` sufficient to reference an offscreen record without treating it as visible.
- Exclude raw DOM, screenshots, cookies, tokens, and unrelated store state.
- Apply the same redaction rules used by the page's assistant.

### 4. Invocation

- Validate the capability and input before side effects.
- Use the existing executor for availability, confirmation, handoff, expectations, and evidence.
- Return a business rejection as a successful protocol envelope with `result.error`.
- Do not turn a business error into a protocol error or a protocol error into a retry instruction.
- Return incremental `after` observations only when they are real and bounded.
- Never execute a capability that was absent from the session's exposure.

### 5. Session and access control

- Accept identity only from a verified transport or backend.
- Fail closed for missing, invalid, expired, revoked, or cross-user sessions.
- Reset any capability cache when session scope or expiry changes.
- Keep token parsing outside the protocol kernel.
- Make revocation effective before the next side effect, not after a notification arrives.

### 6. Limits and replay

- Apply rate limits per verified session or per open-mode bucket.
- Emit `retryAfterMs` for a rate limit when available.
- Fail closed if a shared limiter or replay guard is unavailable.
- Reserve `(session, request.id)` before an invoke side effect.
- Reject a duplicate intent without executing it again.
- Do not claim replay protection caches a response; clients must reconcile business state.

### 7. Audit

- Record identity, capability, request id, outcome, stable code, duration, and approval correlation when available.
- Exclude arguments, response bodies, credentials, and provider secrets by default.
- Route audit sink failures to an observable error path.
- Never place receipt tokens or hashes in an Agent-visible response.

## Transport interoperability

The protocol does not mandate one transport. A valid adapter may use HTTP JSON, a browser `postMessage` bridge, an in-process function call, or an MCP facade. The adapter is still responsible for:

- authenticating the caller;
- enforcing origin and CSRF rules;
- validating body size and media type;
- mapping the protocol envelope without changing error semantics;
- not inventing capabilities during tool registration;
- returning the complete protocol response, including `ok: false`;
- preserving request ids and not silently retrying a side effect.

MCP clients should see one tool per projected capability, with the schema derived from `describe`. A generic `click(selector)`, `eval`, raw fetch, or “run arbitrary JavaScript” tool is outside the protocol even if the MCP server could implement it.

## Existing automated checks

| Area | Existing check | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Surface kernel | `packages/surface/test/surface.test.ts` | Reference behavior for projection, session checks, limits, replay, audit, and envelopes | Another implementation is conformant |
| Delegation store | `assertDelegationStoreConformance()` | Token redaction, scope normalization, rotation, binding, revocation, expiry | Enterprise SSO or database transaction correctness beyond the test namespace |
| Delegation events | `assertDelegationEventBusConformance()` | Per-user isolation and allowlisted event fields | Redis/NATS/outbox delivery in a real topology |
| Continuity backend | `assertContinuityBackendConformance()` | Lease, revision, ownership, takeover, expiry, and user isolation | A browser UI correctly interprets every failure |
| MCP adapter | the local MCP reference | A concrete external tool path over the existing executor | A general certification for all MCP clients |
| Benchmark harness | the order and onboarding benchmark fixtures | Repeatable task results for two frozen fixtures | Universal token or success advantage |

The benchmark reports are intentionally narrow. The order fixture reports 60/60 passing tasks for Surface/MCP and DOM/Playwright, a median step ratio of `0.4286`, and a token ratio of `0.5085`. The onboarding fixture is a second, independent task set with mixed results; it did not reproduce the token advantage across vendors. Neither result is a cross-site or statistical guarantee.

## A practical interoperability test

Run the same small application through two independent clients:

1. Start from a signed-out state and attempt `describe`; expect a session failure, not empty success.
2. Authorize two capabilities plus one record-scoped action.
3. Confirm that `describe` exposes exactly those ids and one bounded record page.
4. Invoke a read capability twice with distinct request ids; both may succeed.
5. Invoke a write capability with a stable id, then replay the identical envelope; expect no second side effect.
6. Request a hidden capability id; expect `CAPABILITY_NOT_EXPOSED` and verify the business store is unchanged.
7. Expire or revoke the session and retry; expect a session error before the executor runs.
8. Force the audit sink to fail; verify the business response remains defined and the failure is observable in operations.
9. Close the transport during a write; reconnect and reconcile business state before deciding whether a new request id is safe.

Record the implementation version, protocol version, transport, identity adapter, fixture, and exact build. A result without those fields is not reproducible evidence.

## Claim language

Use precise claims:

- “Implements the `describe` and `invoke` methods of `pling.surface/0.1` in the reference test suite.”
- “Passed the repository's delegation-store conformance checks against a disposable namespace.”
- “Reproduced on fixture 046 with the recorded model and build.”

Avoid:

- “Certified Pling Surface.”
- “Industry-standard compliant.”
- “Secure for all agents.”
- “Works with every MCP client.”
- “Faster than browser automation” without fixture, baseline, and measured metric.

A future public conformance kit may exist, but until it is versioned, published, and independently usable, no page or implementation should imply that it does.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/surface` `0.1.0-alpha.2` |
| Protocol | `pling.surface/0.1` (Draft) |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Browsers with ES2022 modules; Node.js 20 or later for Node-side use |
| Peer dependencies | None |
| Stability | Draft protocol; no public certification claim |

A passing repository fixture is evidence about that fixture, not a compatibility claim for every transport, identity provider, or MCP client. Record the package version, protocol version, transport, and fixture with every result.
