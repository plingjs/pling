---
id: OPS-06
title: "Expose capabilities to external agents"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Expose capabilities to external agents

An application can serve two kinds of Agent without duplicating its business
logic:

- an assistant running inside the page, which uses the page's declared actions
  directly;
- an Agent running on the user's computer, which reaches the same actions
  through the Agent Surface.

The second path introduces credentials, a network boundary, and a human
approval loop. This page describes the reference topology and the parts an
application must own.

## Start with the capability boundary

Do not start by exposing every action. Choose a small set of business operations
that make sense outside the page, for example:

```text
add_task
toggle@<record-id>
delete@<record-id>
clear_completed
```

These ids come from the page's existing declarations. The Surface projects them;
it does not create a second action model. Navigation, account settings, the
login form, and unrelated records should remain outside the allowlist.

Two rules apply at every transport:

- the page session declares an explicit capability allowlist;
- an Agent session may request a subset of that allowlist, never a superset.

There is no generic `click(selector)`, `eval`, or arbitrary HTTP operation in
the protocol. A browser Agent that already controls Chromium may still bypass
the Surface through CDP; the Surface does not claim to prevent that. Its value is
that approved business operations have an identity, a scope, a confirmation
path, and an observable result.

## Separate the three deployment roles

The word “gateway” can hide three different responsibilities. Keep them separate:

| Role | Operated by | Holds |
| --- | --- | --- |
| Official demo Gateway | the Pling project | demo tenants, demo sessions, demo audit |
| Enterprise Gateway | the application owner | tenant allowlists, identity integration, audit storage |
| Customer BFF | the application backend | user sessions, application data, page-session creation |

`surface.plingjs.dev` is the official demonstration endpoint. It is not a shared
proxy for customer applications. An enterprise deploys
`@plingjs/surface-gateway` at an origin it controls, such as
`surface.example.com`, and creates page sessions from its own backend.

The tenant Origin list in the Gateway configuration is not authentication. It
answers one narrower question: which browser origins may open a WebSocket for
this tenant.

## Create the page session on the server

The browser must not hold the administrative credential that creates page
sessions. The sequence is:

1. the user signs in to the application;
2. the BFF verifies its HttpOnly session cookie;
3. the BFF calls `POST /v1/page-sessions` over a private path;
4. the request carries `tenantId`, the authenticated `userId`, and the narrow
   scope;
5. the Gateway returns a short-lived page token;
6. the BFF returns only that page token and its WebSocket URL to the browser.

The request to the Gateway uses a server-only admin bearer token:

```http
POST /v1/page-sessions
Authorization: Bearer <SURFACE_ADMIN_TOKEN>
Content-Type: application/json

{
  "tenantId": "demo",
  "userId": "u_...",
  "scope": ["add_task", "toggle@", "delete@", "clear_completed"]
}
```

Never create a page session from browser code, and never derive `userId` from an
unverified request body. The authenticated application session is the source of
that identity.

## Pair one Agent with one page

After the page opens its WebSocket, it requests a one-time pairing code. Pairing
is refused when the page transport is not connected, because the page is the
capability and approval authority.

The user gives the code to the Agent runtime. The runtime claims it once and
receives:

- an Agent session id;
- a bearer token with a short lifetime;
- the effective scope;
- the MCP endpoint.

The page token and the Agent token have different holders:

| Credential | Holder | Purpose |
| --- | --- | --- |
| Admin token | application backend | create or inspect page sessions |
| Page token | the signed-in page | open the page WebSocket and create a pairing |
| Agent token | external Agent runtime | call `describe`, `invoke`, and `status` |

None of these should be placed in a model prompt, a public log, or an audit
record.

## Keep execution in the application

The Agent calls one of three MCP operations:

```text
pling_surface_describe
pling_surface_invoke
pling_surface_approval_status
```

`describe` returns the page identity, allowed capabilities, bounded records,
regions, exposed state, and feedback. `invoke` forwards one capability to the
page, where the existing executor validates the action, applies policy, and runs
the business implementation. The Gateway does not receive the application
database or a copy of its authorization logic.

For a folded record action, the Agent supplies the record separately:

```json
{
  "capability": "delete",
  "input": { "record": "t_1234abcd" }
}
```

The action id remains `delete@t_1234abcd` inside the page. Folding keeps a large
list from producing one model-visible tool per row without weakening the record
identity.

## Put human approval in the right place

A destructive request returns `pending_approval`; it does not execute first and
ask afterwards. The page renders the decision to the signed-in user. The Agent
can poll `status`, but there is no MCP approval tool and no token that lets it
approve its own request.

This matters especially for a remote Agent. An approval button rendered inside a
page the user is not looking at is not a usable decision surface. A product may
forward the pending request to the Agent's client as a notification, but the
decision must still be made by the authenticated human and enforced by the
application.

Approval evidence belongs in the application's audit trail. Challenge tokens,
receipt tokens, and their hashes are not part of the Surface response, audit
event, log line, or model context. Only a public approval id may be retained for
correlation.

## Deployment choices

For a public demonstration, use dedicated hosts:

```text
https://todo.plingjs.dev     application page and BFF
https://surface.plingjs.dev  official demo Gateway
```

For an enterprise, the corresponding shape is:

```text
https://app.example.com      application page and BFF
https://surface.example.com  enterprise Gateway
```

The application may serve the page and `/api/*` from one origin. The Gateway may
run as a separate service behind TLS. Keep the admin token on the BFF-to-Gateway
hop, not on the browser or Agent hop.

If the page must live under a subpath rather than a dedicated host, change the
frontend base path and the BFF route prefix together. A mismatch produces
requests that look correct in the browser but never reach the BFF.

## Failure cases to verify

- Creating a pairing before the page WebSocket connects must fail.
- Claiming the same pairing twice must fail.
- An expired page or Agent session must stop working.
- Requesting a scope outside the page session must fail.
- Invoking an unexposed capability must fail at the protocol boundary.
- Invoking a record action for an unknown record must return a business error,
  not another user's record.
- A deletion must remain pending until a person approves it in the application.
- Revoking an Agent must invalidate its token without deleting user data.

The authenticated Todo case in the public repository implements this reference
path with an in-memory identity and Todo store. A production application must
replace those stores with its own database, SSO, authorization rules, and audit
system.
