# Recipe access service

Local HTTP service for the recipes that need a server boundary: sign-in and
session expiry, delegated credentials, human approval with an audit trail, and
asynchronous upload jobs.

## What it is

The service is a teaching fixture. It is deliberately dependency-free and keeps
all state in memory. It is not an identity provider, production database, file
store, job queue, or approval system. Restarting it clears users, sessions,
delegations, approvals, audit events, and uploaded file metadata.

It listens on `127.0.0.1:5193` and exposes `/api/recipe/*` through the examples
site's Vite proxy.

## Run

From the repository root:

```bash
pnpm dev:examples
```

That command starts this service, the model gateway, and the Vite examples
site. The MCP recipe starts its stdio bridge separately; use the command shown
in that recipe. To run only this backend:

```bash
node examples/recipe-backends/access-service/server.mjs
```

Health check:

```bash
curl http://127.0.0.1:5193/health
```

The browser uses the examples origin at `http://localhost:5191/api/recipe/*`.
When calling the service directly, keep the `/api/recipe` prefix so the
HttpOnly session cookie is sent on later requests:

```bash
curl -c /tmp/pling-cookie.txt \
  -H 'content-type: application/json' \
  -d '{"email":"demo@example.com","password":"pling-demo"}' \
  http://127.0.0.1:5193/api/recipe/session/login

curl -b /tmp/pling-cookie.txt \
  http://127.0.0.1:5193/api/recipe/session/me
```

Demo account:

```text
demo@example.com
pling-demo
```

## Routes

| Route | Purpose |
| --- | --- |
| `POST /api/recipe/session/login` | Create an HttpOnly demo session |
| `GET /api/recipe/session/me` | Read the signed-in user and protected invoices |
| `POST /api/recipe/session/expire` | Force the current session past its expiry |
| `POST /api/recipe/session/logout` | Delete the session and clear the cookie |
| `POST /api/recipe/session/note` | Update a note on a protected invoice |
| `POST /api/recipe/delegations` | Issue a short-lived, scoped delegation |
| `GET /api/recipe/delegations` | List delegations without their secret token |
| `POST /api/recipe/delegations/invoke` | Invoke an allowlisted capability with `Authorization: Bearer …` |
| `DELETE /api/recipe/delegations/:id` | Revoke a delegation |
| `POST /api/recipe/approvals` | Create a pending approval request |
| `GET /api/recipe/approvals` | List approval requests |
| `POST /api/recipe/approvals/:id/decision` | Approve or reject, then write an audit event |
| `POST /api/recipe/external/request` | Show the fail-closed path after revocation |
| `GET /api/recipe/audit` | Read recent audit events |
| `POST /api/recipe/uploads` | Upload raw file bytes with `x-file-name` |
| `GET /api/recipe/uploads` | Read upload job state and progress |
| `DELETE /api/recipe/uploads/:id` | Cancel a running job |
| `POST /api/recipe/uploads/:id/retry` | Retry a failed job |

## Security boundary

Passwords are hashed with SHA-256 only because this is a local fixture. A real
deployment must use a password KDF, a database-backed identity system, CSRF
protection, TLS, rate limits, durable audit storage, malware scanning, and a
real object store. Delegation secrets are returned once and only a hash is kept
in memory; the demo exposes the secret to the page solely to make revoke and
scope failures observable.

Files are not persisted. The upload route reads bytes, records metadata, and
simulates processing. Use a reviewed object-store upload flow in production.
