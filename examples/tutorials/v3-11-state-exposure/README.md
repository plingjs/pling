# V3-11 · State exposure fixture

This is the runnable source for **State exposure**. It continues the V3-10 Todo example and adds one read-only `useAgentState("task_view", ...)` declaration. The view exposes the active filter, applied search, matching row count, and task totals without exposing the task array or the application store.

From the repository root:

```bash
pnpm tutorial:dev v3-11
```

The script packs the framework packages, copies this directory to `.tmp/tutorials/v3-11/app`, installs those local tarballs, and starts Vite on port `5224`.

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
pnpm tutorial:check v3-11
```

Those checks cover the initial state view, filter and search updates, an update caused by a declared action, the `<page_data>` context, unmount cleanup, and Chinese copy.
