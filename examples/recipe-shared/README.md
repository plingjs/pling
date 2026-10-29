# Shared recipe demo assets

This folder is not a standalone application. It contains the visual shell, API
client, and locale helper used by the fourteen runnable recipe pages under
`examples/demos/recipe-*`.

Each page keeps its own business state and Pling declarations. The shared files
contain no framework execution logic and do not call the model directly.

The authenticated, delegated, approval, audit, and upload examples use the
local service in `examples/recipe-backends/access-service`. Start the whole demo
suite from the repository root:

```bash
pnpm dev:examples
```

The service listens on `127.0.0.1:5193`; Vite proxies `/api/recipe` to it.
The example site then runs on `http://localhost:5191/demos/`.
