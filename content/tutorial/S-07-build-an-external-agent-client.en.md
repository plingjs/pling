---
id: S-07
title: "Build an external agent client"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Build an external agent client

An external client needs a loop, not a prompt trick. It must obtain a verified session, discover the current surface, choose a permitted operation, invoke it with a fresh request id, and interpret both protocol and business results. The model may propose the decision, but the client owns the protocol exchange and the human-approval boundary.

## A minimal state machine

```text
authenticate → describe → decide → invoke → inspect result
                    ↑                         │
                    └──── new page / retry ───┘
```

Do not keep an old description across a navigation, a large filter change, or a session scope change. Do not assume that a successful HTTP response means the business operation succeeded.

## Client skeleton

```ts
const surface = createSurfaceClient({ transport });

let description = await surface.describe({ limit: 8 });

const capability = chooseCapability(description, args);
if (!capability) throw new Error("No exposed capability matches this request");

const requestId = crypto.randomUUID();
const response = await surface.invoke(capability.id, inputFor(capability, args), { requestId });

if (!response.ok) {
  // Protocol/session/limit failure: do not claim the business operation ran.
  return reportProtocolFailure(response.error);
}

if (response.result && "error" in response.result) {
  // Business failure: inspect the stable code before re-describing.
  return reportBusinessFailure(response.result.error);
}

// Use response.after when present; otherwise re-describe before the next decision.
```

The exact client API is up to the transport. The important contract is the request envelope and the separation of `ok: false` from `result.error`.

## Authentication

The client must not accept an identity from the model's arguments. Authentication happens before the protocol loop: a browser session for a same-page bridge, or a delegated agent token for a gateway. The token should be scoped to capabilities, expires, and can be revoked. Never print it in model context, logs, or the page projection.

If a human approval is required, the client can receive `pending_approval` or a review URL from the page host. It may poll a status tool if the host provides one. It must not be given an approval function. The page renders the decision and resumes the same request.

## Tool descriptions

An MCP facade maps `describe` capabilities to tools. The mapping must preserve:

- stable ids and descriptions;
- input schemas;
- effect and approval metadata;
- record-target conventions;
- bounded record windows.

Do not expose a generic `click` or `eval` MCP tool to simplify the facade. Do not synthesize capabilities from UI text. If the page has not declared an operation, it is not part of the external surface.

## Handling failures

| Failure | Client behavior |
| --- | --- |
| `ACTION_NOT_FOUND` | Re-describe; the page may have changed |
| `ACTION_UNAVAILABLE` | Report the reason; do not retry until the precondition changes |
| `INVALID_PARAMS` | Correct the argument from the schema |
| `EXPECTATION_FAILED` | Re-observe the page, then decide |
| `PERMISSION_DENIED` | Stop; ask a human to act, not the agent |
| `SESSION_EXPIRED` / `SESSION_REVOKED` | Re-authenticate or request a new delegation |
| `RATE_LIMITED` | Honor `retryAfterMs`; do not spin |
| `REPLAY_DETECTED` | Use a new id only for a logically new request; otherwise inspect the prior outcome |

## Testing the client

Test against a deterministic page first. Cover a successful read, a write with schema input, an unavailable action, a denied confirmation, an expired session, and a repeated request id. Then test a real page with a real browser session and a human approving a destructive action.

Log the request id, protocol version, capability id, outcome, and duration. Do not log the full page projection or token. A client that cannot explain which capability it called and why is not ready for an autonomous workflow.

See [Surface basics](/surface/surface-basics-describe-and-invoke) and [Connect an external agent through MCP](/recipes/connect-an-external-agent-through-mcp).
