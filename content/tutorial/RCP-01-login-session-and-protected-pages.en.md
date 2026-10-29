---
id: RCP-01
title: "Login, session, and protected pages"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Login, session, and protected pages

When a page contains orders, courses, patient data, or an enterprise console, an agent must not log in for the user or bypass login. Pling's job is to make an authenticated page more operable while leaving “who is here, what may they see, and when does it expire” in the application's existing identity system.

## Runnable page

The page below uses a real local HTTP session. Sign-in, expiry, and logout change what the page projects, rather than only swapping a status message.

<DemoPlayground id="recipe-login-session" />

From the repository root:

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-login-session/`. The page source is in `examples/demos/recipe-login-session/`; the backend is in `examples/recipe-backends/access-service/`, with routes and limits documented in its `README.md`. Use `demo@example.com` / `pling-demo`.

## When to use this recipe

- The page requires login before business data appears.
- An external agent accesses a limited surface through delegation.
- Expiry or logout must immediately remove page capabilities.
- One page serves multiple tenants or roles.

## Control design

Separate three states:

| State | Page behavior |
| --- | --- |
| Signed out | Expose login guidance or a human path only; no business records or write actions |
| Signed in, no delegation | In-page assistant may work; external surface is closed by default |
| Signed in, delegated | Surface is available within the intersection of site exposure and session scope |

An external session is not a copy of the user's cookie. The host validates the browser session, then issues a short-lived delegation for a specific agent. The page assistant keeps its own login state. Logout, tenant switch, or revocation must invalidate the relevant capabilities immediately.

## Acceptance criteria

1. Signed-out `describe` exposes no protected records or write capabilities.
2. An agent cannot submit a username, password, Cookie, or token as an action argument.
3. After expiry, the next `invoke` returns `SESSION_EXPIRED` and the business handler is not called.
4. After revocation it returns `SESSION_REVOKED`; browser SSE is only a hint and the server revalidates.
5. A tenant switch uses a new `sessionId`; an old description cannot continue to authorize calls.
6. After logout neither the in-page assistant nor the external surface sees protected data.

## Implementation path

See [Vue model gateway and authentication](/vue/model-gateway-and-authentication) and [React model gateway and authentication](/react/model-gateway-and-authentication) for adapter-specific steps. The shared delegation contract is in [Identity, consent, and delegation](/surface/identity-consent-and-delegation).

A server can use the identity/store/event-bus ports in `@plingjs/delegation`. Reference cases:

- the delegation-credential reference: issue, introspect, and scope intersection;
- the revocation reference: fail closed after revocation;
- the multi-instance reference: cross-instance invalidation semantics;
- the package reference: file store and conformance helpers;
- the authenticated Todo reference: login, bearer token, and MCP.

These are references, not a production identity service.

## Failure paths

**The agent asks for the password.** Refuse. Login belongs to the user and identity provider, not the capability surface.

**The button is hidden only in the frontend.** Insufficient. `invoke` still needs the capability intersection and backend authorization.

**Calls still work after revocation.** Check that `sessionId` changes with permission changes and that every call revalidates the session. A long-lived cached connection can preserve stale authority.

**The JWT is placed in model context.** Do not pass credentials even when the model only “needs to know” the user is signed in. Expose a boolean or business identity, not the token.

## Release checks

- Tests cover login, logout, tenant switch, expiry, and revocation.
- Protected capabilities are absent from signed-out descriptions.
- Audit records user, agent, session, and outcome without credentials.
- Reverse proxies do not cache protected responses.
- Error text does not disclose whether an account exists.
- A rollback can close the external surface immediately without breaking the in-page assistant.

## Local verification

Sign in and ask the assistant to add an invoice note. Then expire the session or sign out and repeat the request. The protected records disappear and the note tool is unavailable; a direct backend request still fails the session check.

This backend is a local fixture: users, sessions, and delegations live in memory and reset on restart. Production must replace it with the application's identity, database, CSRF, TLS, and audit implementation rather than deploying the fixture directly.
