---
id: S-06
title: "Transports and adapters"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Transports and adapters

The Surface protocol is transport-independent. A transport carries the request envelope, proves who sent it, returns the response, and handles connection failures. It must not duplicate capability filtering, confirmation, or business authorization.

There is no production transport inside `@plingjs/surface`. The package is deliberately small: no HTTP server, session database, WebSocket bridge, MCP server, or OAuth implementation. Reference cases show those pieces, but they are examples to adapt, not a universal service.

## Responsibilities

| Layer | Owns | Does not own |
| --- | --- | --- |
| Surface | Envelope validation, exposure intersection, limits, replay guard, audit metadata | Cookie / token parsing, network routing, business rules |
| Transport adapter | Authentication, origin checks, message framing, request id, rate-limit and replay ports | Tool semantics, confirmation UI, business state |
| Gateway / host | Session lifecycle, revocation, tenant policy, audit storage | Replacing the page executor |
| External client | Discover, decide, invoke, render progress | Approving its own high-risk request |

## Common bindings

**WebSocket or HTTP.** A same-origin WebSocket can connect an open page to a trusted bridge. The bridge should verify the page's authenticated session, bind one socket to one user and tenant, and reject cross-user messages. A plain HTTP endpoint needs equivalent session and origin checks.

**MCP.** MCP is a useful client-facing binding for agent runtimes. A local stdio facade can translate MCP tools into `describe` and `invoke`, but it still needs a page connection and a trustworthy identity path. Do not create an MCP tool that approves a pending action; approval belongs to the page's human interface.

**Browser extension or postMessage.** A postMessage bridge must validate `event.origin`, a channel nonce, and the target window. A wildcard target origin is not a production default. The bridge should expose only the Surface methods, not an arbitrary script executor.

## Session and ownership

A transport must decide which page session a request belongs to. For an interactive page, one connection can be bound to one open page and one user session. For a server-side gateway, a page session is created after the user explicitly enables external access and paired with an agent token. Pairing codes should be short-lived, one-time, and exchanged server-side.

Store only what the next request needs. Do not place the user's Cookie, the page's admin secret, or the agent token in the other side's context. A gateway that can call every tenant without a user-bound session has removed the distinction between authorization and connectivity.

## Failure behavior

Fail closed on unauthenticated sockets, unknown message shapes, unsupported protocol versions, expired pairing codes, duplicate pairing claims, and lost page connections. Preserve structured errors so the client can distinguish “page disconnected” from “capability denied” and “business operation failed”.

`describe` may remain available while an `invoke` waits for human approval. If the transport serializes all messages, the agent cannot inspect the page during a long confirmation. If it serializes none, two approvals may be confused. A reference bridge commonly serializes `invoke` calls while allowing `describe` to proceed.

## Adapter review

Before adopting a transport, verify:

1. It validates origin and session before calling `surface.handle`.
2. It binds a connection to one user, tenant, and session.
3. It forwards only protocol messages and sizes them.
4. It preserves `request.id` and does not reuse it on retries.
5. It exposes `describe` while `invoke` waits, without allowing concurrent mutations.
6. It fails closed when the page disconnects or the session is revoked.
7. It has a test for a second user trying to use the first user's connection.

The protocol core's small API is a constraint on adapters, not an absence of design. The adapter is where network reality enters; therefore it deserves the same review as the page executor.

The repository contains a local MCP bridge and an authenticated page-to-gateway reference. They are not production identity services. A deployed transport must be reviewed against its own threat model.
