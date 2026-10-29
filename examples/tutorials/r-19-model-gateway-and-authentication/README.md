# R-19 · Model gateway and authentication

The browser calls `/api/llm/v1` on its own origin. `server.mjs` authenticates a
session cookie, adds the provider credential, pins the model, and emits metadata
audit events. The provider key never enters the page.

For the UI: `pnpm tutorial:dev r-19`. For a real model, copy
`.env.gateway.example` to `.env.gateway`, start `pnpm --dir <fixture> dev:gateway`
or `node examples/tutorials/r-19-model-gateway-and-authentication/server.mjs`, and
sign in with the configured demo password.
