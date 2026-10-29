# Recipe 10: connect an external agent through MCP

Start the public examples with `pnpm dev:examples`, open
`http://localhost:5191/demos/recipe-mcp/?lang=zh`, then start the stdio MCP
server from another terminal:

```bash
PLING_SURFACE_APP_URL="http://localhost:5191/demos/recipe-mcp/?mcp=1" \
pnpm --filter @plingjs/examples surface:mcp
```

Register the same command in Codex, Claude Code, Hermes, or another stdio MCP
client. The bridge listens on loopback (`127.0.0.1:5283`) and exposes only three
MCP tools: describe, invoke, and approval status. The ticket page must remain
open. No page data is written to a file and no generic DOM tool is exposed.

For an HTTPS MCP endpoint, terminate the bridge at an authenticated server such
as `services/surface-gateway`; a hosted endpoint cannot rely on the loopback
token used by this local demo.
