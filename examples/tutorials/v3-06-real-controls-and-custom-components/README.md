# V3-06 · Real controls and custom components fixture

This is the runnable source for **Real controls and custom components**. The Todo business stays recognizable; the task region, records, and row completion action from the previous chapter remain. This chapter adds a native priority selector, a search field that applies on Enter, a multi-button filter component, and a hover-opened bulk menu.

From the repository root:

```bash
pnpm tutorial:dev v3-06
```

The script packs the framework packages, copies this directory to `.tmp/tutorials/v3-06/app`, installs those local tarballs, and starts Vite on port `5216`. It therefore exercises the same package entry points and style export that a reader will consume.

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
pnpm tutorial:check v3-06
```

Those checks cover native `select`, `press`, automatic target resolution inside a wrapper component, explicit `target` disambiguation, `hover`, `autoTarget`, `fidelity`, and an end-to-end replay through the agent loop.
