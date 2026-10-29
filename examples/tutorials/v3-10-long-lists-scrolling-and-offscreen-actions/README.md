# V3-10 · Long lists, scrolling, and offscreen actions fixture

This is the runnable source for **Long lists, scrolling, and offscreen actions**. It continues the Todo example from V3-09 with 24 tasks in a fixed-height scroll panel. Row actions remain ordinary `v-tool` declarations; the runtime keeps offscreen records addressable, reveals a known target before execution, and exposes a generated scroll action when the list contains more content.

From the repository root:

```bash
pnpm tutorial:dev v3-10
```

The script packs the framework packages, copies this directory to `.tmp/tutorials/v3-10/app`, installs those local tarballs, and starts Vite on port `5223`. It therefore exercises the same package entry points and style export that a reader will consume.

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
pnpm tutorial:check v3-10
```

Those checks cover offscreen record retention, folded row actions, automatic reveal before execution, the generated `pling_scroll_task_list` action, a replay model that targets the last row, and bilingual copy.
