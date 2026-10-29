# Loopback MCP bridge

This directory contains the transport used by the external-agent examples. It
does not own page state or business logic. The browser exposes a Pling Surface;
the stdio server turns `describe` and `invoke` into MCP tools and forwards them
over a loopback WebSocket to the page that is already open.

Use it with the standalone example:

```bash
pnpm dev:examples
PLING_SURFACE_APP_URL="http://localhost:5191/demos/external-agent-surface/?mcp=1" \
pnpm --filter @plingjs/examples surface:mcp
```

For the smaller ticket recipe, change only the page URL:

```bash
PLING_SURFACE_APP_URL="http://localhost:5191/demos/recipe-mcp/?mcp=1" \
pnpm --filter @plingjs/examples surface:mcp
```

The process listens on `127.0.0.1:5283` by default. Set
`PLING_SURFACE_BRIDGE_PORT` to choose another loopback port. The page must stay
open; the bridge holds no page data on disk and has no fallback cache. Opening a
newer page connection replaces the previous one and fails in-flight calls with
`PAGE_REPLACED`.

The server exposes three tools:

- `pling_surface_describe` reads the currently exposed capabilities, input
  schemas, records, and bounded state;
- `pling_surface_invoke` invokes one returned capability;
- `pling_surface_approval_status` reads the result of a pending confirmation.

There is deliberately no approval tool, generic DOM click, or script evaluator.
When an invocation needs confirmation, the person must decide on the open page.
The bridge has no model credentials and is intended for local development only;
a hosted deployment needs an authenticated gateway rather than a public version
of this loopback service.

The smoke test sends `initialize`, `tools/list`, `describe`, and `invoke` through
the real stdio server, using a simulated page on the WebSocket side so it does
not require a browser:

```bash
pnpm --filter @plingjs/examples surface:smoke
```
