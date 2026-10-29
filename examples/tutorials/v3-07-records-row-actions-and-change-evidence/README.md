# V3-07 · Records, row actions, and change evidence fixture

This is the runnable source for **Records, row actions, and change evidence**. The Todo business stays recognizable; this chapter exposes each task as a record, gives its checkbox and delete button stable row action ids, and uses the framework's before/after snapshots as change evidence.

From the repository root:

```bash
pnpm tutorial:dev v3-07
```

The script packs the framework packages, copies this directory to `.tmp/tutorials/v3-07/app`, installs those local tarballs, and starts Vite on port `5217`. It therefore exercises the same package entry points and style export that a reader will consume.

For a real model, create `.env.local` in this directory:

```dotenv
VITE_AGENT_BASE_URL=https://api.example.com/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
```

If the browser is blocked by CORS, use the development proxy:

```dotenv
VITE_AGENT_BASE_URL=/llm/v1
VITE_AGENT_PROXY_TARGET=https://api.example.com
```

Run the deterministic checks with:

```bash
pnpm tutorial:check v3-07
```

Those checks cover record fields and order, folding repeated row actions into `record` templates, updated/removed/added row evidence, and an end-to-end replay that selects rows through the folded tools.
