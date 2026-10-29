---
id: TS-05
title: "Model request fails"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Model request fails

A model request failure is not a page action failure. It may come from missing configuration, a wrong base URL, authentication rejection, CORS, gateway timeout, or provider rate limiting. Establish where the request went before inspecting the response.

## Quick diagnosis

| Symptom | Likely cause |
| --- | --- |
| `NOT_CONFIGURED` | Incomplete model configuration |
| Network error / CORS | Browser calls a cross-origin endpoint directly, or same-origin routing is missing |
| `401` / `403` | Gateway authentication or upstream credential failure |
| `429` | Provider limit or exhausted gateway retries |
| `502` / `504` | Upstream unavailable or timed out |
| Streaming interruption | Proxy buffering, connection timeout, cancellation |
| No response and no error | Request not mounted, session destroyed, UI not rendered |

## Configuration checks

Confirm:

- production uses a same-origin relative path such as `/api/llm/v1`;
- the model is a fixed alias allowed by the gateway;
- the browser holds no provider key;
- the gateway has `authorize` rather than anonymous access;
- the upstream URL comes only from the server;
- timeout and retry budgets do not multiply across layers.

Show `MODEL_BASE_URL_MISSING`, `MODEL_NAME_MISSING`, `MODEL_API_KEY_MISSING`, and `LIMITS_INVALID` as configuration diagnostics, not one vague model failure.

## Gateway checks

Use the request id to inspect:

- returned and upstream status;
- attempts, retryability, and exhaustion;
- model allowlist;
- body size and timeout;
- whether prompts or credentials entered logs.

Do not leave authentication disabled after debugging, and do not return raw upstream errors to the browser.

## Client handling

- 401/403: reauthenticate or fix configuration; do not retry automatically.
- 408/429/5xx: honor retryability and backoff.
- Failure after streaming starts: do not replay the whole request; present a recoverable state.
- `retryExhausted`: do not add another retry loop in the browser.
- Page action succeeded but model failed: retain the tool result and continue from current state after reconnect.

## Security boundary

Model keys live only on the server. `VITE_*` or equivalent frontend variables enter the build and are not secret storage. Logs must not contain Authorization, full prompts, or response bodies unless the application explicitly chooses and is permitted to retain them.

## Related

[Connect a model gateway](/operations/connect-a-model-gateway), [Model access and trust boundaries](/concepts/model-access-and-trust-boundaries), [Error codes and diagnostics](/reference/error-codes-and-diagnostics).
