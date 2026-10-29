# J-10 · Connect a vanilla page to the model gateway

The browser calls a same-origin gateway, not the model provider. The
`server.mjs` gateway authenticates the session, adds the provider key, pins the
model, and emits an audit event without recording the prompt.

```bash
pnpm tutorial:dev j-10
pnpm tutorial:dev j-10 --locale zh
pnpm tutorial:check j-10
```

Start the gateway in another terminal after copying `.env.gateway.example` to
`.env.gateway` and filling the provider settings:

```bash
pnpm --dir examples/tutorials/j-10-model-gateway dev:gateway
```
