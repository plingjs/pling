# V3-12 · Page identity and routing fixture

This is the runnable source for **Page identity and routing**. It continues the Todo example with two Vue Router routes: the task list and one task's detail page. Pling reads the current route name, path, params, and the explicitly allowed `from` query key from the active route. Navigation remains a declared action, so the next model turn receives the new page identity and the new action set.

From the repository root:

```bash
pnpm tutorial:dev v3-12
```

The script packs the framework packages, copies this directory to `.tmp/tutorials/v3-12/app`, installs those local tarballs, and starts Vite on port `5225`.

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
pnpm tutorial:check v3-12
```

Those checks cover list and detail route identities, navigation through a declared action, the page-identity prompt block, query-key filtering, state replacement across routes, missing tasks, and Chinese copy.
