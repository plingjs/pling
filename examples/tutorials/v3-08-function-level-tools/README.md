# V3-08 · Function-level tools fixture

This is the runnable source for **Function-level tools**. The Todo business and the region, records, row actions, and change evidence from the previous chapter remain. This chapter adds one operation that has no control in the page: marking every open task as completed.

From the repository root:

```bash
pnpm tutorial:dev v3-08
```

The script packs the framework packages, copies this directory to `.tmp/tutorials/v3-08/app`, installs those local tarballs, and starts Vite on port `5218`. It therefore exercises the same package entry points and style export that a reader will consume.

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
pnpm tutorial:check v3-08
```

Those checks cover the existing record projection and row-action folding, registration of a call primitive without a DOM target, availability, verified results, returned data, record changes, and an end-to-end replay through the function-level tool.
