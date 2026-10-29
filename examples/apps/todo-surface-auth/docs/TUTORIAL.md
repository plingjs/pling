# Authenticated Todo with an external Agent Surface

## 1. What this case is for

Many applications already have a working assistant inside their own page. A
user may nevertheless prefer an Agent running on their computer: Codex, Claude,
Hermes, or another MCP-capable client. That Agent should be able to perform a
small, declared part of the application without learning the whole DOM or
receiving the application's credentials.

This case implements that path once, on a Todo application with real account
isolation:

```text
user signs in
  → BFF verifies its HttpOnly session
  → BFF asks the Surface Gateway for a short-lived page session
  → page opens the Surface WebSocket
  → user creates a one-time pairing code
  → external Agent claims the code and receives a separate token
  → Agent calls describe / invoke / status over MCP
  → destructive operations wait for a human in the page
```

The application remains responsible for authentication, data ownership, and
business rules. The Gateway is responsible for transport, pairing, session
binding, expiry, and forwarding. The page remains responsible for the capability
projection and human approval.

## 2. Run it

```bash
cp examples/apps/todo-surface-auth/.env.example examples/apps/todo-surface-auth/.env.local
openssl rand -hex 32
# Put the result in SURFACE_ADMIN_TOKEN.
pnpm --filter @plingjs/example-todo-surface-auth dev
```

The default local topology is:

| Process | Address |
| --- | --- |
| Vue page | `http://127.0.0.1:5220/` |
| Todo BFF | `http://127.0.0.1:5221` |
| Surface Gateway | `http://127.0.0.1:5219` |

Register an account with an email and a password of at least eight characters.
The demo stores passwords as scrypt hashes. The account, session, and Todo
records are in memory and disappear on restart.

The in-page assistant still needs a model. Supply one through `VITE_AGENT_*`, an
injected runtime, or the BYOK form in the assistant's Activity panel. External
Agent access does not depend on the page's model configuration.

## 3. Enable external access

The page does not connect to the Gateway on its own. Selecting **Enable external
access** calls `POST /api/surface/page-session` on the same origin.

The BFF:

1. reads the HttpOnly user session;
2. rejects a missing or expired session;
3. sends `tenantId`, `userId`, and an explicit allowlist to the Gateway;
4. attaches the admin bearer token only on that server-to-server request;
5. returns a short-lived page token to the page.

The browser never sees `SURFACE_ADMIN_TOKEN`. The Agent never sees the page
token. The two credentials have different holders and different lifetimes.

The page then opens a WebSocket to the Gateway. Pairing remains disabled until
the Gateway acknowledges the page socket, so a code cannot be created for a page
that is not actually present.

`TODO_SURFACE_SCOPES` is the deployment-level allowlist. It defaults to
`add_task,toggle@,delete@,clear_completed`; an application can remove any of
those capabilities without changing page code. Unknown entries stop the BFF at
startup rather than silently widening or narrowing access. The browser projects
exactly the scope returned by the BFF, and an Agent can only narrow it further.

## 4. Pair one external Agent

Select **Create pairing code**. The page calls the Gateway with its page token;
the Gateway returns a one-time code valid for two minutes.

Claim it in a separate terminal:

```bash
pnpm --filter @plingjs/example-todo-surface-auth surface:claim ABCD-EFGH --agent codex
```

Claiming exchanges the code for an Agent session. The output contains:

- an Agent session id;
- a bearer token;
- the effective capability scope;
- an MCP client configuration.

The code is deleted on first successful claim. The page must stay open, because
the page is the capability and approval authority; the Gateway is not a copy of
the application.

## 5. Call the page through MCP

Configure an MCP client with the printed endpoint and bearer token. The client
gets three operations:

```text
pling_surface_describe
pling_surface_invoke
pling_surface_approval_status
```

`describe` returns the page identity, allowed capabilities, bounded context,
records, region structure, exposed state, and current feedback. `invoke` calls
one capability through the application's existing executor. `status` retrieves
the final result of a request that previously returned `pending_approval`.

The capability ids are stable because they are the same ids the page declares:

```text
add_task
toggle@<record-id>
delete@<record-id>
clear_completed
```

The `@` suffix is a folded record action. An Agent invokes the family name and
passes the record separately:

```json
{
  "capability": "delete",
  "input": { "record": "t_1234abcd" }
}
```

The Gateway does not expose `click(selector)`, `eval`, cookies, or arbitrary
HTTP requests. The Agent cannot widen its own scope: the requested Agent scope
must be a subset of the page session's allowlist.

## 6. Approval and revocation

Deletion and clearing completed tasks cross the page's confirmation policy.
The request does not execute when the Agent first calls it. Instead it becomes
pending and the business page shows a human approval panel.

The Agent has no approval tool. It can only poll `status`. If the person denies
the request, the action does not run. If the person allows it, the same request
continues through the existing executor and returns the business result.

This distinction matters when the Agent is remote: an approval button rendered
inside a page that the user is not looking at is not a usable approval path. In
this case, the approval is rendered in the same signed-in business page the user
opened. For a production product, the same decision can also be forwarded to the
Agent's client as a notification, but the decision itself must still be made by
the authenticated human; the Agent must not be able to approve its own request.

Revoking an Agent invalidates its token and closes its live request path. It does
not delete the user's Todo data.

## 7. Data and trust boundaries

| Data | Page | BFF | Gateway | External Agent | Model |
| --- | --- | --- | --- | --- | --- |
| User password hash | no | yes | no | no | no |
| User session cookie | browser only | reads | no | no | no |
| Surface admin token | no | yes | verifies | no | no |
| Page token | yes | creates | verifies | no | no |
| Agent token | no | no | sees as bearer | holds | no |
| Todo records | signed-in page | per-user store | not stored | only projected records | only projected context |
| Page token in logs | never | never | redact | never | never |

The Gateway forwards opaque Surface envelopes. It does not need to understand
the page's DOM or business database. If a production design puts the Gateway and
the application in the same process, keep the same credential separation rather
than reusing the user's cookie as an Agent credential.

## 8. Failure cases to check

- Opening the pairing panel before the page socket is connected leaves the
  pairing action disabled.
- An expired pairing code is removed from the screen and replaced with a new-code
  action. The expired code cannot be claimed.
- Claiming the same code twice fails. A new code has to be created.
- Calling an unexposed capability fails at the protocol boundary; it does not
  fall back to a DOM click.
- Calling a record action with an unknown record returns a business error; it
  does not address another user's record.
- Requesting a wider scope than the page session allows fails.
- Restarting the BFF invalidates its in-memory user session; the page must sign in
  again before creating another page session.
- Restarting the Gateway invalidates live sessions; the page shows a closed or
  reconnecting state and the user starts a new page session.

## 9. Deployment boundary

For the official public demo, use dedicated hosts:

```text
https://todo.plingjs.dev     Todo page and BFF
https://surface.plingjs.dev  Shared demo Gateway
```

`surface.plingjs.dev` is a demonstration endpoint, not a shared customer proxy.
An enterprise should run the same Gateway at its own origin, for example
`https://surface.example.com`, and should let its own backend create page
sessions. The Todo BFF in this case is the reference for that backend boundary.

Do not deploy the demo with root-relative API paths under a subpath such as
`/todo/` without changing both Vite's base path and the BFF's route prefix. A
dedicated host is the smallest correct deployment.

## 10. Test commands

```bash
pnpm --filter @plingjs/example-todo-surface-auth test
pnpm --filter @plingjs/example-todo-surface-auth typecheck
pnpm --filter @plingjs/example-todo-surface-auth build
```

The tests cover account isolation, one-time page-session provisioning, pairing,
scope narrowing, MCP invocation, pending approval, and the page component's
projection. They do not replace a manual test with a real external MCP client.
