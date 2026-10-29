# Cloudflare deployment

This directory is the Cloudflare deployment for `plingjs.dev`. It does not
replace the Node/Docker reference deployment in `deploy/` while the remaining
services are migrated.

## Scope of this deployment

The first phase publishes one Worker with two responsibilities:

```text
plingjs.dev
  ├── /                 VitePress documentation
  ├── /demos/*          static live demos
  └── /api/agent/*      server-side model gateway
```

The browser uses only the same-origin path `/api/agent/v1`. The upstream model
URL, provider key, and model name remain in Worker secrets. There is no
`api.plingjs.dev` in this phase: a second public API host would add CORS and
abuse-control work without improving the demo.

Workers Static Assets is used instead of a separate Pages project because the
documentation, demos, and model endpoint then share one origin and one deploy.
The mapping for later phases is:

| Need | Cloudflare service | Status |
| --- | --- | --- |
| Documentation and demo files | Workers Static Assets | in this phase |
| Model gateway and public HTTP endpoints | Workers + Secrets | in this phase |
| Surfacing a live page to an external Agent | Durable Objects + WebSocket hibernation | phase two |
| Users, todos, approvals, and audit rows | D1 (or an external database) | phase three |
| Uploaded files | R2 | only when a feature needs it |

`surface.plingjs.dev` and `todo.plingjs.dev` are not moved by this Worker. Their
current Node gateways own WebSockets, sessions, file-backed data, and login
state. Moving them requires the designs described below, not a static-site
rewrite.

## Prerequisites

- `plingjs.dev` is an active zone in the same Cloudflare account.
- Workers is enabled for the account. Confirm Durable Objects and D1 quotas in
  the dashboard before starting phases two and three.
- Node.js 20+, pnpm 12+, and an authenticated Wrangler session.

```bash
pnpm install
pnpm exec wrangler login
```

## Publish phase one

The first deployment creates the Worker and attaches the two custom domains.
Public access is closed by default: every page and API request returns `503`
until `PLING_PUBLIC_ACCESS` is changed to `"true"` and the Worker is deployed
again. This keeps an unfinished documentation site and demo from being indexed
or shared. `workers.dev` and preview URLs are disabled so the Worker is
reachable only through the two production domains.

```bash
pnpm cloudflare:deploy
```

Set the server-side values. None of them belong in `wrangler.jsonc` or in a
`VITE_*` variable.

```bash
pnpm exec wrangler secret put PLING_UPSTREAM_BASE_URL --config deploy/cloudflare/wrangler.jsonc
pnpm exec wrangler secret put PLING_UPSTREAM_API_KEY --config deploy/cloudflare/wrangler.jsonc
pnpm exec wrangler secret put PLING_MODEL --config deploy/cloudflare/wrangler.jsonc
pnpm cloudflare:deploy
```

Verify:

```bash
curl https://plingjs.dev/api/agent/health
curl -I https://plingjs.dev/
curl -I https://www.plingjs.dev/
```

The health endpoint should return `{"ok":true,...,"configured":true}`. The
`www` host should return a `308` to the apex host. Test the live demos in a
browser at `https://plingjs.dev/demos/quickstart/` and
`https://plingjs.dev/demos/orders/`.

Before those checks, set `PLING_PUBLIC_ACCESS` to `"true"` in
`wrangler.jsonc`, deploy again, and verify the result. Do this only after the
documentation and demos are ready for public use.

## Local runtime

Build the documentation and demos first, then run Wrangler against the same
asset directory and Worker:

```bash
cp deploy/cloudflare/.dev.vars.example deploy/cloudflare/.dev.vars
# Fill in the three values, then:
pnpm cloudflare:dev
```

`wrangler dev` serves the static site and the model gateway at
`http://localhost:8787`. Set `PLING_PUBLIC_ACCESS=true` in `.dev.vars` to
preview locally while the deployed site remains closed. `.dev.vars` is ignored
by Git.

## Security controls

- Provider credentials exist only as Worker secrets.
- The model name is fixed server-side; a browser cannot choose another model.
- The gateway accepts browser requests only from configured origins. `Origin`
  and `Sec-Fetch-Site` are both checked.
- A Workers rate-limit binding caps each client at 20 model requests per minute.
  This is an abuse guard, not a billing limit. Add a Cloudflare WAF rate-limit
  rule and, before a large public launch, a Turnstile-backed challenge for the
  demo if traffic warrants it.
- Audit logs contain request metadata only: model, status, duration, and byte
  counts. Prompts, responses, cookies, and keys are not logged.

The public demo deliberately does not accept browser-supplied upstream URLs or
keys. Per-user BYOK belongs in a separate authenticated settings flow, with its
own storage and disclosure policy.

## Domain and TLS

`plingjs.dev` is on the HSTS preload list. All public access must use HTTPS.
In Cloudflare:

1. Set SSL/TLS mode to **Full (strict)**.
2. Enable **Always Use HTTPS** and HSTS after the apex host is healthy.
3. Keep the Wrangler-created custom-domain DNS records proxied.
4. Do not point `plingjs.dev` at an origin server that only serves HTTP.

Canonical URLs in the repository use `plingjs.dev`. Add a permanent redirect
from any old hostname before removing the old DNS record, and verify both the
documentation and demo origins after each migration.

## Phase two: Surface Gateway

The existing `services/surface-gateway` relies on `node:http`, `ws`, in-memory
maps, and timers. A Worker cannot share those assumptions across requests.

The Cloudflare version should keep the external protocol unchanged and replace
the state layer:

- route each page session to one Durable Object;
- store page sessions, one-time pairing codes, Agent sessions, pending
  approvals, and expiry in Durable Object storage;
- use WebSocket hibernation for the page connection;
- use Durable Object alarms for expiry and revocation;
- keep `SURFACE_ADMIN_TOKEN` as a Worker secret, and keep page tokens and Agent
  tokens out of model-visible parameters;
- retain the existing rule that only the page can approve a pending action.

Do not deploy a plain Worker that keeps a module-global `Map` as a substitute.
Different isolates would see different sessions, and a restart would invalidate
pairings without warning.

## Phase three: Todo application

The Todo BFF needs a real data and identity model before it moves:

- Cloudflare D1 (or an external database) for users, todos, approvals, and audit
  records;
- HttpOnly, Secure sessions with server-side expiry and revocation;
- per-user ownership checks in every query;
- a server-to-server call that creates a narrow Surface page session after login;
- migration and rollback tests against the current Node BFF.

Keep `todo.plingjs.dev` on the existing service until those checks pass end to
end. A static copy of the page without the BFF would lose login, data isolation,
and external-Agent approval semantics.

## Migration order

1. Publish and verify documentation, demos, and the model gateway on `.dev`.
2. Migrate the shared demo Surface Gateway to Worker + Durable Objects.
3. Migrate the authenticated Todo example to Worker + D1.
4. Replace canonical `.com` links in packages, documentation, and release
   checks.
5. Add a `301` from the old hosts and monitor it before removing the Node
   deployment.

Until step four, both suffixes may appear in the repository. That is deliberate:
an unverified global search-and-replace would create links to services that are
not live yet.
