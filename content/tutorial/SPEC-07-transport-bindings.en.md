---
id: SPEC-07
title: "Transport bindings"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Transport bindings

The semantics of `describe` and `invoke` are independent of transport. The transport delivers the request faithfully and authentically to the protocol implementation and returns the response. It MUST NOT alter capabilities, authorization, or error classification.

## Transport requirements

1. **Authentication**: establish caller, user, tenant, and session before constructing the protocol object.
2. **Integrity**: protect requests and responses from tampering; use TLS or equivalent protection cross-origin.
3. **Confidentiality**: credentials MUST NOT appear in URLs, logs, or protocol envelopes.
4. **Size limits**: bound request and response bytes to reduce memory and denial-of-service risk.
5. **Timeout and cancellation**: let callers stop waiting and hosts release resources.
6. **Correlation**: preserve the protocol `id`; a transport may add its own correlation id.
7. **Replay boundary**: a transport retry MUST NOT resubmit a logical call that already produced a side effect.
8. **Ordering**: implementations MUST NOT assume requests complete in send order; navigation or scope changes MUST invalidate old descriptions.

## Available shapes

| Shape | Suitable for | Main risks |
| --- | --- | --- |
| `postMessage` | Same-page, trusted extension, or controlled iframe | Origin, source, and message validation |
| Same-origin HTTP + SSE | Web service, MCP facade, event notification | CSRF, proxy buffering, session recovery |
| WebSocket | Low-latency bidirectional bridge | Connection authentication, message size, reconnect |
| MCP facade | Exposing capabilities as tools to an agent runtime | Incomplete tool metadata, escape hatches, transport authentication |
| Local process bridge | Development or controlled desktop | Endpoint discovery, privilege escalation, log leakage |

The transport does not affect conformance. One implementation may expose `describe` over HTTP and `invoke` over WebSocket, but both MUST use the same session and capability intersection.

## `postMessage`

The receiver MUST validate origin, source, and data shape:

```ts
window.addEventListener("message", async (event) => {
  if (event.origin !== allowedOrigin) return;
  if (event.source !== allowedWindow) return;
  const response = await surface.handle(event.data);
  allowedWindow.postMessage(response, allowedOrigin);
});
```

A response carrying sensitive data MUST NOT use `"*"` as its target origin. Checking only a message type is insufficient; capability and record ids remain bounded by session scope.

## HTTP and MCP

An HTTP route SHOULD authenticate before calling `surface.handle(request)`. HTTP status may describe transport outcome but MUST NOT replace `ok` and `error.code` in the envelope.

An MCP facade MUST:

- map each capability to a tool with an explicit schema;
- retain `effect`, `approval`, `handoff`, record templates, and `scopePath`;
- use `describe` for discovery instead of synthesizing tools from UI copy;
- revalidate the session before invocation;
- expose no generic `click`, `eval`, raw DOM, or arbitrary HTTP tool;
- return business failure as a business result rather than disguising it as transport failure.

## Browser and proxy constraints

Reverse proxies, CDNs, and logging systems may truncate large responses, buffer streams, or record bodies. Deployments MUST:

- avoid recording complete request/response bodies or Authorization headers;
- disable unnecessary buffering for SSE;
- set body limits that match protocol limits;
- preserve `x-pling-request-id` or an equivalent correlation header;
- return diagnosable transport errors for timeout, rate limiting, and outage.

## Implementation boundary

The repository provides the protocol kernel, a reference delegation HTTP handler, and local bridges in cases. `surface.plingjs.dev` is a demonstration endpoint, not a shared production gateway for all customers. A production transport owner is responsible for TLS, identity, tenant isolation, persistence, rate limiting, and audit.
