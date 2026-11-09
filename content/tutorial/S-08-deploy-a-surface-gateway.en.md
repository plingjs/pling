---
id: S-08
title: "Deploy a Surface gateway"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Deploy a Surface gateway

A Surface gateway sits between an external agent and an open page. It carries protocol envelopes, binds a page to a user and tenant, issues a delegated agent session, and forwards requests. It does not become a second copy of the page's business state.

The repository's authenticated Todo example is a reference topology, not a hosted service. In particular, `surface.plingjs.com` is a demo endpoint, not a shared customer proxy. A production enterprise should run the same boundary at its own origin and connect it to its own identity and data systems.

## A workable topology

```text
external agent
  │ MCP or HTTPS + agent bearer token
  ▼
surface gateway
  │ page session + one-time pairing
  ▼
open business page
  │ describe / invoke through the page bridge
  ▼
existing executor and business backend
```

The page remains open because it is the source of the capability projection and the human approval surface. The gateway is not allowed to invent context or execute business logic when the page is absent.

## Run the reference package

`@plingjs/surface-gateway` is the reference Node implementation. It ships the HTTP and WebSocket transport, the MCP facade, session and pairing storage, scope checks, revocation, and audit callbacks. It is a library and a small CLI, not a hosted multi-tenant service.

```bash
npm install @plingjs/surface-gateway
SURFACE_ADMIN_TOKEN="$(openssl rand -hex 32)" npx pling-surface-gateway
```

The CLI listens on `127.0.0.1:5219` and uses the bundled `config.example.json`. For a real deployment, provide your own tenant and Origin allowlist:

```bash
SURFACE_CONFIG=/etc/pling/surface.json \
SURFACE_ADMIN_TOKEN=<server-side-secret> \
SURFACE_PUBLIC_BASE_URL=https://surface.example.com \
SURFACE_HOST=127.0.0.1 \
SURFACE_PORT=5219 \
npx pling-surface-gateway
```

Set `SURFACE_TRUST_PROXY=1` only behind a reverse proxy that overwrites `X-Forwarded-For`. The repository's `services/surface-gateway` directory is only the compatible deployment wrapper; the implementation and public API live in the package.

## Credential separation

| Credential | Holder | Purpose |
| --- | --- | --- |
| Application session cookie | Browser and BFF | Prove the signed-in user |
| Surface admin token | BFF only | Create a page session server-to-server |
| Page token | Open page and gateway | Bind one page socket to a tenant/user session |
| Agent bearer token | External agent and gateway | Authorize one delegated agent session |
| Approval receipt | Page approval backend | Prove a specific human decision |

Never send the application's admin token to the browser, the page token to the agent, or the agent token to the model. The page and the agent must not share one credential merely because the gateway can route between them.

## Pairing

External access starts only after the user enables it. The BFF authenticates the request, creates a short-lived page session, and returns only the page token. The page opens a socket and waits for an acknowledgement. Only then can it create a one-time pairing code. The code expires quickly, is consumed once, and is exchanged server-side for an agent session whose scope is a subset of the page allowlist.

Pairing is not consent to every capability forever. It creates a bounded session. The page, BFF, or gateway must be able to revoke that session, and each request must re-check its state.

## Gateway behavior

The gateway should:

1. authenticate the agent request;
2. verify the page session and tenant;
3. check that the requested scope is within the issued scope;
4. forward the envelope without rewriting capability semantics;
5. reject unknown or oversized messages;
6. serialize `invoke` while allowing `describe` during a pending approval;
7. preserve request ids and audit metadata;
8. fail closed when the page disconnects or a session expires.

It should not parse the DOM, choose a business action, render the approval UI, or store business records. If it stores anything, store the minimum session metadata and audit data with a clear retention policy.

## What is still yours

The reference memory stores and local socket are not production infrastructure. Replace them with durable session storage, a real identity provider, a distributed rate limiter, a replay guard, an audit sink, and a revocation event path. The gateway needs a tenant isolation model and a deployment story for restarts, network partitions, and clock skew.

Test the ugly paths: page closed during `invoke`, gateway restart during approval, expired pairing code, duplicate claim, agent token revoked, page session for another user, and a request attempting a wider scope. A successful happy-path demo does not establish a production gateway.

See [Identity, consent, and delegation](/surface/identity-consent-and-delegation), [Revoke access and audit actions](/surface/revoke-access-and-audit-actions), and [Reference: Node gateway](/reference/node-gateway).
