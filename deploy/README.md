# Self-hosting the Pling reference stack

This directory is a general-purpose deployment template for the documentation,
public demos, model proxy, Surface Gateway, and the authenticated Todo example.
It is not the official demo infrastructure, and it is not a shared gateway for
customer applications. Deploy your own instance and keep your credentials on
your own server.

## Topology

| Host | Origin | Purpose |
| --- | --- | --- |
| `example.com` | static | Documentation and public demos |
| `demo.example.com` | static + model proxy | Optional standalone demo host |
| `api.example.com` | Node | Optional standalone model gateway |
| `surface.example.com` | Node | Surface Gateway (HTTP + WebSocket + MCP) |
| `todo.example.com` | Node | Authenticated Todo page and BFF |

The host names are examples. Every name can be replaced through `deploy/.env`
without changing application code.

## Configure

```bash
cd deploy
cp .env.example .env
cp surface.config.example.json surface.config.json
```

Edit both files before starting anything:

- `PLING_UPSTREAM_BASE_URL`, `PLING_UPSTREAM_API_KEY`, `PLING_MODEL`: the
  OpenAI-compatible upstream used by the server-side model proxy.
- `PLING_*_HOST`: the public hostnames served by Caddy.
- `SURFACE_PUBLIC_BASE_URL`: the public URL returned in page-session responses.
- `TODO_ALLOWED_ORIGINS`: the exact browser origin allowed to call the Todo BFF.
- `SURFACE_ADMIN_TOKEN`: a server-side secret used to create page sessions.

Generate the admin token with:

```bash
openssl rand -hex 32
```

Never commit `deploy/.env` or `deploy/surface.config.json`. The examples above
are templates only.

## Run with Caddy

```bash
docker compose build
docker compose up -d
docker compose logs -f
```

Caddy obtains and renews TLS certificates automatically. Point DNS at the host
before starting it, and keep only ports 80 and 443 public. The model, Surface,
and Todo containers remain on the private Compose network.

Health checks:

```bash
curl -fsS "https://example.com/api/agent/health"
curl -fsS "https://surface.example.com/health"
curl -fsS "https://todo.example.com/api/health"
```

## Use an existing reverse proxy

If the server already has Nginx, Caddy, or another ingress, start only the
application containers:

```bash
docker compose -f docker-compose.host.yml up -d
```

Expose these loopback ports through your own virtual hosts:

| Service | Loopback port |
| --- | --- |
| Model gateway | `127.0.0.1:5192` |
| Surface Gateway | `127.0.0.1:5219` |
| Todo BFF | `127.0.0.1:5221` |

Proxy WebSocket upgrades for `/surface`, and do not buffer `/mcp` or `/v1/*`.
Keep the application ports off the public interface.

To build static artifacts without Docker:

```bash
./deploy/build.sh
```

The output is written to `deploy/release/`:

```text
website/       documentation and public demos
demo/          standalone demo root
todo/          Todo BFF static files
todo-server/   Todo BFF Node entry
```

`build.sh` requires Node 22 and pnpm. Serve the output with any static server or
copy it into the paths used by your existing proxy.

## Surface configuration

`surface.config.json` is an Origin allowlist, not an authentication system. It
answers one question: which browser origins may connect for a tenant.

```json
{
  "tenants": [
    {
      "id": "demo",
      "displayName": "Todo Surface Demo",
      "origins": ["https://todo.example.com"]
    }
  ]
}
```

Your backend is responsible for:

1. authenticating the user;
2. selecting the narrowest page-session scope;
3. calling `POST /v1/page-sessions` with `SURFACE_ADMIN_TOKEN` over a private path;
4. returning only the page token to that browser session.

The authenticated Todo example performs these steps after checking its own
HttpOnly session cookie. `TODO_SURFACE_SCOPES` controls the capabilities it
exposes. Unknown entries fail startup instead of silently broadening access.

An enterprise should deploy `services/surface-gateway` at an origin it controls.
The gateway exposes the declared capabilities only; it does not expose the DOM,
component state, cookies, scripts, or model keys.

## Security checklist

- Keep provider keys and `SURFACE_ADMIN_TOKEN` on the server.
- Create page sessions only from a backend that has verified the user.
- Keep page-session and Agent-session TTLs short and scope explicit.
- Pair only while the page WebSocket is connected.
- Use an exact `Access-Control-Allow-Origin`; never combine credentials with `*`.
- Rate-limit model calls and pairing attempts at the edge.
- Persist audit events outside the gateway before production use.
- Keep high-risk approvals in the business page. The Agent must not approve its own request.

## Production notes

The bundled Todo example stores users and tasks in memory. Restarting it clears
the data. Add your own database, session store, account policy, backups, and
audit retention before using it for real business data.

The documentation site and demos can be hosted separately from the Node
services. If they use a different registrable domain, keep login and page
sessions on the business domain and configure the exact origins in both
`surface.config.json` and `TODO_ALLOWED_ORIGINS`.
