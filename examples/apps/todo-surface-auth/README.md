# Authenticated Todo with an external Agent Surface

This case is a complete authenticated Todo application. It demonstrates one page
with two clients: the assistant running inside the page, and an external Agent
runtime such as Codex, Claude, or Hermes.

The page, the application backend, and the Surface Gateway keep separate
responsibilities:

```text
Browser
  ├── Vue Todo page
  │     ├── in-page AgentDock
  │     └── Surface WebSocket ───────────────┐
  │                                           │
  └── same-origin /api/*                      │
        └── Todo BFF                          │
              ├── HttpOnly user session       │
              ├── per-user Todo data          │
              └── POST /v1/page-sessions ─────┤
                                              ▼
                                      Surface Gateway
                                              ▲
                                              │ MCP + Bearer Agent token
                                        External Agent
```

The external Agent never receives the user's cookie, the admin token, another
user's data, or a generic DOM operation. It receives a short-lived Agent token
whose scope is a subset of the page session's explicit capability allowlist.

## What it demonstrates

- registration and sign-in with scrypt password hashes and an HttpOnly cookie;
- per-user Todo isolation;
- a BFF-created page session; the admin token stays server-side;
- one-time pairing between an open page and one external Agent;
- `describe`, `invoke`, and `status` over MCP;
- external access limited to an explicit allowlist (four business capabilities by default);
- page-side human approval for deletion and clearing completed tasks;
- revocation without exposing an approval tool to the Agent.

The Todo data and accounts are in memory. Restarting the server clears them.
This is intentional for a demo; production must replace `AuthStore` and
`TodoStore` with the application's identity and database layers.

## Run locally

From the repository root:

```bash
cp examples/apps/todo-surface-auth/.env.example examples/apps/todo-surface-auth/.env.local
# Replace SURFACE_ADMIN_TOKEN with: openssl rand -hex 32
pnpm --filter @plingjs/example-todo-surface-auth dev
```

Open `http://127.0.0.1:5220/`, register an account, and sign in.

The in-page assistant can use the page's declared actions. It needs a model
through `VITE_AGENT_*`, an injected runtime, or the Activity panel's BYOK
settings. The Surface path does not require a model key.

## Connect an external Agent

1. In the right-hand **Agent Surface** panel, select **Enable external access**.
2. Wait until the page socket reports **Page connected**.
3. Select **Create pairing code**.
4. Claim the code from a terminal:

```bash
pnpm --filter @plingjs/example-todo-surface-auth surface:claim <CODE> --agent codex
```

The command prints an Agent bearer token and an MCP client fragment. Treat the
token as a password. Configure the MCP endpoint with that bearer token, then call:

```text
pling_surface_describe
pling_surface_invoke
pling_surface_approval_status
```

The page must remain open and connected. A pairing code is consumed once and
expires after two minutes.

## Capability boundary

By default, the page exposes these capabilities to external clients. A deployment
can narrow the list through `TODO_SURFACE_SCOPES`; the page projects only the
scope returned by the BFF, and an Agent can narrow it further.

| Capability | Effect | Approval |
| --- | --- | --- |
| `add_task` | Creates one Todo owned by the signed-in user | none |
| `toggle@` | Toggles one Todo record by id | none |
| `delete@` | Deletes one Todo record by id | page-side human approval |
| `clear_completed` | Deletes all completed Todos for this user | page-side human approval |

Navigation, account settings, the login form, cookies, the provider key, and
other users' records are outside the projection. There is no MCP tool that can
approve a pending request.

## Verify

```bash
pnpm --filter @plingjs/example-todo-surface-auth test
pnpm --filter @plingjs/example-todo-surface-auth typecheck
pnpm --filter @plingjs/example-todo-surface-auth build
```

For the manual external-Agent loop, call `delete` for a known record. The MCP
request must return `pending_approval`; the Todo row remains until a person
approves it in the page. Approving resumes the same request. Poll
`pling_surface_approval_status` for the final result.

## Configuration

| Variable | Used by | Purpose |
| --- | --- | --- |
| `TODO_BFF_PORT` | BFF | HTTP port, default `5221` |
| `TODO_BFF_HOST` | BFF | Bind address, default `127.0.0.1` |
| `TODO_DIST` | BFF | Built frontend directory, default `dist` in this example |
| `TODO_ALLOWED_ORIGINS` | BFF | Comma-separated origins allowed to call the API |
| `SURFACE_GATEWAY_URL` | BFF and claim script | Gateway origin or private service URL |
| `SURFACE_ADMIN_TOKEN` | BFF only | Creates page sessions; never sent to the browser |
| `SURFACE_TENANT_ID` | BFF only | Gateway tenant used for this application |
| `TODO_SURFACE_SCOPES` | BFF only | Comma-separated subset of `add_task,toggle@,delete@,clear_completed`; invalid values stop startup |

See [docs/TUTORIAL.md](./docs/TUTORIAL.md) for the full workflow, deployment
boundary, and failure cases.
