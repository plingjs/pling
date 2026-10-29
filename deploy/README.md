# Pling deployment reference

The Cloudflare deployment for `plingjs.dev` is documented in
[`cloudflare/README.md`](cloudflare/README.md). It currently covers the static
documentation, demos, and the model gateway. The Node topology below is retained
as a fallback and as the reference for Surface sessions, login, and the
authenticated Todo application.

The first release splits the public site from the mainland business hosts:
Cloudflare serves `plingjs.dev`, while the VPS serves Todo and Surface from
separate hostnames. The hostnames below are deployment examples, not fixed
product domains:

| Host | Origin | Purpose |
| --- | --- | --- |
| `plingjs.dev` | static | Documentation and the canonical public examples |
| `demo.plingjs.dev` | static + model proxy | Optional standalone demo host |
| `api.plingjs.dev` | Node | Optional standalone model gateway; upstream credentials stay server-side |
| `surface.example.com` | Node | Reference Surface Gateway for the official demo |
| `todo.example.com` | Node | Authenticated Todo demo with the in-page Agent and BFF |

`surface.example.com` is the official demonstration endpoint. It is **not** a
shared proxy for customer applications. A company should deploy the same gateway
at its own origin (for example `surface.example.com`) and issue page sessions
from its own backend. The Todo BFF in `examples/apps/todo-surface-auth` is the
reference for that backend boundary.

The host names are deployment data, not code. Override them in `deploy/.env`:

```dotenv
PLING_DOCS_HOST=plingjs.dev
PLING_WWW_HOST=www.plingjs.dev
PLING_DEMO_HOST=demo.plingjs.dev
PLING_API_HOST=api.plingjs.dev
PLING_SURFACE_HOST=surface.example.com
PLING_TODO_HOST=todo.example.com
PLING_CERT_NAME=example.com
PLING_HOSTS=surface.example.com,todo.example.com
SURFACE_PUBLIC_BASE_URL=https://surface.example.com
TODO_ALLOWED_ORIGINS=https://todo.example.com
```

`PLING_HOSTS` controls only the certificate request. It may omit a host such as
`www` while that name is intentionally unpublished. The Nginx templates still
contain the `www` redirect so it can be enabled later without editing code.

```text
Internet
  │
  ▼
Caddy (80/443, automatic TLS)
  ├── plingjs.dev       → /srv/pling/website
  ├── demo.plingjs.dev  → /srv/pling/demo + /api/agent/* → api:5192
  ├── api.plingjs.dev   → /v1/* and /health → api:5192
  ├── surface.example.com → surface:5219 (HTTP + WebSocket)
  └── todo.example.com  → todo:5221 (page, /api/*, BFF session)
```

When the public site and the business hosts use different registrable domains,
keep the browser on the business host for login and page sessions. Mixing an
unfiled `.dev` origin with a mainland VPS creates ICP, cookie, CORS, and
first-party-session problems for no product benefit. The public documentation
can still link to a fully qualified business URL.

## What stays on the server

- provider API key and upstream base URL (`PLING_UPSTREAM_*`);
- Surface admin token (`SURFACE_ADMIN_TOKEN`);
- any future login/session store, database, and approval backend.

The browser receives only:

- the same-origin model path `/api/agent/v1`;
- a model name if the gateway constrains one;
- a short-lived page-session token after its user has authenticated;
- a one-time pairing code after the page's WebSocket is connected.

The Todo BFF has its own HttpOnly user session. It creates the page session by
calling the Gateway over the private Compose network. No browser request ever
carries `SURFACE_ADMIN_TOKEN`.

Never send `SURFACE_ADMIN_TOKEN`, provider keys, cookies, or service credentials
to an Agent runtime or a model prompt.

## Docker Compose

Prerequisites: a Linux host with Docker, DNS records for the selected hosts
pointing at it, and inbound ports 80/443. The first-release VPS only needs
`surface.example.com` and `todo.example.com`.

```bash
cd deploy
cp .env.example .env
cp surface.config.example.json surface.config.json
# Edit .env and replace every placeholder.
docker compose build
docker compose up -d
docker compose logs -f
```

Caddy obtains and renews TLS certificates automatically. Keep only ports 80 and
443 public; `api` and `surface` are reachable only on the Compose network.

To update:

```bash
git pull --ff-only
cd deploy
docker compose build
docker compose up -d
```

## Existing Nginx host

When the target server already terminates HTTPS for other applications, do not
replace its Nginx instance with the bundled Caddy container. Use
`docker-compose.host.yml` to bind only the Node services to loopback, and add a
separate Nginx vhost for the hosts served by that machine.

```bash
# On the workstation
./deploy/build.sh
PLING_IMAGE=plingjs:amd64 PLING_IMAGE_TAR=/tmp/plingjs-amd64.tar.gz \
  ./deploy/build-image.sh
rsync -az --delete deploy/release/ plingjs@dd.xiedaimala.com:pling/release/
rsync -az --exclude release --exclude .env deploy/ plingjs@dd.xiedaimala.com:pling/deploy/

# On the server, after Docker access and DNS are ready
cd ~/pling/deploy
docker compose -f docker-compose.host.yml up -d

# One root operation installs the vhost and obtains the shared certificate
sudo PLING_RELEASE_DIR=/mnt/plingjs/pling/release ACME_EMAIL=you@example.com \
  /mnt/plingjs/pling/deploy/nginx/install.sh
```

The certificate request can be staged while the registrable domain is waiting
for ICP filing and has no public DNS record yet. Pass only the names that
already resolve:

```bash
sudo PLING_RELEASE_DIR=/mnt/plingjs/pling/release ACME_EMAIL=you@example.com \
  PLING_HOSTS=surface.example.com,todo.example.com \
  /mnt/plingjs/pling/deploy/nginx/install.sh
```

After the public and business hostnames resolve, rerun the same command with
the full host list (or without `PLING_HOSTS`). The installer detects that the
existing certificate does not cover every requested name and expands it instead
of issuing an unrelated certificate.

`PLING_HOSTS` only handles names that are intentionally not published yet. It
does not bypass a mainland ICP block: an unfiled domain can return a 403
`Non-compliance ICP Filing` response from the hosting provider before the HTTP-01
challenge reaches Nginx, including on already-resolving subdomains. In that
state, wait for the filing or use a DNS-01 challenge with a certificate
automation that can write the required TXT records.

If the host has an old Compose release that cannot parse required environment
variables, use the Docker CLI launcher instead. It applies the same container
commands and checks all three health endpoints:

```bash
cd ~/pling/deploy
PLING_IMAGE_TAR=/tmp/plingjs-amd64.tar.gz ./start-host.sh
```

The account running Docker must belong to the host's `docker` group. Adding the
group takes effect in a new SSH session.

`deploy/build-image.sh` builds the `runtime` target explicitly. Building the
Dockerfile without a target selects its final Caddy stage, which does not contain
Node and therefore cannot run the gateway or Todo services.

On a host that cannot reach Docker Hub, set `PLING_NODE_IMAGE` to an already
loaded Node 22 image while building. The Dockerfile still defaults to
`node:22-alpine`; the override is an offline bootstrap, not a separate runtime.

```bash
PLING_NODE_IMAGE=plingjs:amd64 \
PLING_IMAGE=plingjs:next \
./deploy/build-image.sh
```

The Nginx installer copies static files to `/srv/pling`, leaves unrelated virtual
hosts untouched, and issues one certificate for the requested host list. Every
name in `PLING_HOSTS` must resolve before its certificate request. If the server
is in mainland China, confirm that the domain has the required ICP registration
before exposing ports 80/443.

The service containers expose only:

| Service | Loopback port |
| --- | --- |
| Model gateway | `127.0.0.1:5192` |
| Surface Gateway | `127.0.0.1:5219` |
| Todo BFF | `127.0.0.1:5221` |

Do not expose those ports publicly. Nginx is the only public HTTP listener.

## Host build without Docker

```bash
./deploy/build.sh
```

This produces:

```text
deploy/release/website  → plingjs.dev root
deploy/release/demo     → demo.plingjs.dev root
deploy/release/todo     → Todo BFF static root
deploy/release/todo-server → Todo BFF Node entry
```

Copy them to `/srv/pling/website`, `/srv/pling/demo`, `/srv/pling/todo`, and
`/srv/pling/todo-server`. Run the model gateway on `127.0.0.1:5192`, the Surface
Gateway on `127.0.0.1:5219`, and the Todo BFF with:

```bash
NODE_ENV=production \
TODO_BFF_HOST=127.0.0.1 \
TODO_BFF_PORT=5221 \
TODO_DIST=/srv/pling/todo \
TODO_ALLOWED_ORIGINS=https://todo.example.com \
SURFACE_GATEWAY_URL=http://127.0.0.1:5219 \
SURFACE_ADMIN_TOKEN="$SURFACE_ADMIN_TOKEN" \
SURFACE_TENANT_ID=demo \
TODO_SURFACE_SCOPES=add_task,toggle@,delete@,clear_completed \
node /srv/pling/todo-server/index.mjs
```

Point the included `Caddyfile` at those local services. The Todo BFF routes all
page and `/api/*` requests, so deploy it on a dedicated host rather than a
subpath unless Vite's base and the BFF route prefix are changed together.

## Surface Gateway configuration

`surface.config.json` is an Origin allowlist, not an authentication system. It
answers one question: which browser origins may connect for each tenant.

```json
{
  "tenants": [
    {
      "id": "demo",
      "displayName": "Pling Todo Demo",
      "origins": ["https://todo.example.com"]
    }
  ]
}
```

The application backend is responsible for:

1. authenticating the user;
2. choosing the narrow page-session capability scope;
3. calling `POST /v1/page-sessions` with the admin token over a private path;
4. returning only the page token to that browser session.

In the authenticated Todo example, `TODO_SURFACE_SCOPES` supplies step 2. Its default is
`add_task,toggle@,delete@,clear_completed`. Unknown entries fail startup, so a
configuration typo cannot silently expose a different set of capabilities.

Do not create page sessions from browser code, and do not infer a user id from an
unverified request body. In the login/register Todo demo, a small BFF performs
these steps after checking its own HttpOnly session cookie.

### Official demo and enterprise deployment

These are three different deployment roles:

| Role | Who operates it | What it holds |
| --- | --- | --- |
| Official demo Gateway | the Pling project | the demo tenant, demo sessions, demo audit |
| Enterprise self-hosted Gateway | the application owner | its tenant config, authorization integration, audit store |
| Customer BFF | the application backend | user sessions, application data, short-lived page-session creation |

An enterprise does not send users through `surface.example.com` to reach its own
application. It deploys `services/surface-gateway` at an origin it controls and
keeps its admin credentials there. The Host allowlist in the tenant
configuration only decides which browser origins may open that tenant's page
socket; it is not authentication.

## DNS checklist

Before the first deployment, create:

```text
CNAME   plingjs.dev          → Cloudflare Worker
CNAME   www.plingjs.dev      → Cloudflare Worker
A/AAAA  surface.example.com  → server
A/AAAA  todo.example.com     → server
```

If the host is behind a CDN, preserve WebSocket upgrades for
`surface.example.com/surface` and avoid buffering `/mcp` or `/v1/*`.

## Security checklist

- Use a 32-byte random admin token and rotate it after any suspected exposure.
- Keep page-session and Agent-session TTLs short; default to explicit scope.
- Pair only after the page WebSocket is connected, never by polling a static URL.
- Keep `Access-Control-Allow-Origin` exact; never combine credentials with `*`.
- Add shared rate limiting at the edge for pairing attempts and model traffic.
- Persist audit events outside the gateway before production use.
- Include the Agent identity, session id, capability, record id, and outcome in
  audit records, but never include provider keys, cookies, or raw sensitive
  values.
- Treat CDP as an unavoidable bypass: business authorization and high-risk
  approval must still be enforced by the backend.

## Smoke test after deploy

```bash
curl -fsS https://plingjs.dev/api/agent/health
curl -fsS https://surface.example.com/health
curl -fsS https://plingjs.dev/ | head
curl -fsS https://plingjs.dev/demos/quickstart/ | head
curl -fsS https://todo.example.com/api/health
curl -fsS https://todo.example.com/ | head
```

For the Surface loop, open the demo page, create a pairing code, configure the
Agent runtime with `https://surface.example.com/mcp` and the returned Agent
token, then call `pling_surface_describe`. The page must be open and connected for
the call to succeed.

Use the authenticated Todo flow for the complete authorization path:

```text
register → sign in → Enable external access → Create pairing code
→ claim the code → call pling_surface_describe
→ invoke delete for one record
→ observe pending_approval
→ approve in the Todo page
→ poll pling_surface_status
```

The row must still exist before approval and disappear only after the person
approves it.
