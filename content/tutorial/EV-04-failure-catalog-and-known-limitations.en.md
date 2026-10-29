---
id: EV-04
title: "Failure catalog and known limitations"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Failure catalog and known limitations

The fastest way to lose trust is to document only successful demos. This catalog records classes of failure that are visible in the repository and limitations that the current implementation does not solve.

## Failure classes

| Class | Example | What it teaches |
| --- | --- | --- |
| Missing declaration | Model calls an id that was never registered | A selector guess is not a contract; re-describe and add the operation |
| Unavailable action | Record is locked or region is hidden | Visibility and preconditions are runtime facts |
| Parameter mismatch | A required field is missing or has the wrong type | The schema must be narrow and current |
| Expectation failure | Click happens but the record does not change | A synthetic success is not business evidence |
| Approval denial | A person rejects a destructive operation | Consent must stop execution, not just decorate it |
| Timeout / interrupted page | Navigation happens during a tool call | Outcome is unknown; re-observe before retry |
| Session expiry / revocation | Delegated token no longer valid | Fail before the executor, not after a write |
| Replay | Same invoke id arrives twice | A protocol guard is not business idempotency |
| Audit failure | Audit sink is unavailable | Business result and audit integrity need separate signals |
| Gateway / model failure | Upstream timeout or rate limit | Keep infrastructure failure distinct from page failure |

## Known limitations

- Closed shadow roots and cross-origin iframes are not projected.
- Rotated or 3D-transformed frame coordinates are not fully covered.
- The browser adapters do not turn every visual-only control into a capability.
- The Surface protocol currently implements only `describe` and `invoke`.
- There is no standard transport inside the package and no public conformance suite for third-party implementations.
- Reference delegation stores are not production databases, and SSE is not the source of truth.
- Rate limiting and replay guards default to process-local state; multi-instance deployments need shared adapters.
- Benchmark results cover a limited fixture and model; they do not prove universal efficiency or safety.
- Browser-side diagnostics can contain sensitive page context and must not be enabled indiscriminately in production.
- A page contract cannot stop an agent with full browser control from clicking the UI; backend controls remain necessary.

## Failure evidence in the benchmark

Early benchmark runs exposed real task and harness defects: a task that did not provide enough business data encouraged guessing; a filter state left from a previous action caused an approval to target a hidden record; a long-list task approached the turn ceiling. Those failures led to better task wording, explicit recovery hints, and a pre-registered turn budget. The later report retains the history rather than pretending the first version worked.

The confirmatory result has no failed formal samples, which is not evidence that failures cannot occur. The run covers one fixture, one model alias, and 200 formal cases. It does not exercise a network partition, a compromised tenant, or a hostile external agent.

## Reporting a new failure

Record the page fixture, capability id, request envelope, expected result, observed result, and whether any side effect occurred. Include package versions and whether diagnostics were enabled. Remove tokens, cookies, customer data, and provider secrets. If the failure involves a destructive action, preserve the business state and stop retrying until a person reviews it.

Do not silently convert a failed business result into a successful chat answer. A model saying “done” is not evidence; the declared expectation and the business state are.

See [Troubleshooting](/troubleshooting/) for actionable checks and [Security and trust center](/security/) for disclosure boundaries.
