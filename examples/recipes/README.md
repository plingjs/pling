# Four-adapter recipe lab

This directory contains the same order-desk scenario implemented four times:

- `vue3/` — Vue 3 SFC and composables;
- `react/` — React hooks;
- `vanilla/` — plain DOM and explicit bindings;
- `vue2/` — Vue 2.7 directives and the shared vanilla dock.

The four apps deliberately share the same business rules and visible states, not
the same framework code. They are the runnable counterparts to these pages:

| Page | What to inspect in each app |
| --- | --- |
| `RCP-03` | customer form validation, parameter checks, and post-submit result |
| `RCP-05` | row deletion marked `danger` with an explicit confirmation policy |
| `RCP-07` | applied search, status filter, bounded list, row records, and state view |
| `RCP-08` | `?order=SO-1001` performs a full document navigation; every adapter starts the same continuity checkpoint |
| `RCP-13` | Vue 3 uses the built-in model settings; the other three provide an explicit host-owned connection form |
| `REF-02` | explicit `maxTurns` for the demo and a bounded debug trace in Vue 3 |
| `REF-03` | English default, in-place language switch, shared theme tokens in the assistant |

| Adapter | Port | Open in Chinese |
| --- | --- | --- |
| Vue 3 | `5230` | `http://localhost:5230/?lang=zh` |
| React | `5231` | `http://localhost:5231/?lang=zh` |
| Vanilla JS | `5232` | `http://localhost:5232/?lang=zh` |
| Vue 2.7 | `5233` | `http://localhost:5233/?lang=zh` |

Run one adapter from the repository root:

```bash
pnpm --filter @plingjs/recipe-vue3 dev
pnpm --filter @plingjs/recipe-react dev
pnpm --filter @plingjs/recipe-vanilla dev
pnpm --filter @plingjs/recipe-vue2 dev
```

Each app reads the usual `VITE_AGENT_*` variables from `.env.local`. None of the
examples contains a key. The demo limit is explicitly 100 turns; the framework's
production default remains 10.

To run all four at once, use `pnpm dev:recipes`. The Vue 3 app exposes the
built-in model settings in **Activity**. React, vanilla, and Vue 2.7 use a
host-owned connection form in the page and recreate the assistant surface after
the form is saved.

The apps are public teaching fixtures. Production integrations still need
authentication, server-side authorization, rate limits, and audit logging.
