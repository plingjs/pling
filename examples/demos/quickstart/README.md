# Example 01: Todo

This is the smallest complete Pling integration used by the public examples.
The page is an ordinary Vue application with filters, inline editing,
completion, removal, and cleanup. Pling adds scoped records, explicit controls,
and the `AgentDock` entry; the todo state and business handlers stay in Vue.

## Run

From the repository root:

```bash
pnpm dev:examples
```

Open one of these pages:

- `http://127.0.0.1:5191/demos/quickstart/?lang=zh`
- `http://127.0.0.1:5191/demos/quickstart/`

`pnpm dev:examples` starts the Vite site, the local model gateway, and the
recipe access service. The browser talks to `/api/agent/v1`; provider
credentials remain in `examples/.env.local`. See
[`examples/GATEWAY.md`](../../GATEWAY.md) for the gateway boundary and
configuration.

## What to try

Use the suggested task **Add “Send the project update”**, or ask:

> Mark the first unfinished item complete, then add two follow-up tasks.

The assistant reads the visible records, chooses declared controls, and the page
updates through its normal Vue functions. Expand Activity to see the model call,
the tool arguments, and the resulting page evidence.

## Source map

- `src/TodoQuickstart.vue` — business page, `v-scope`, `v-record`, `v-tool`, and
  the assistant entry;
- `src/main.ts` — `createPling`, locale, interaction pace, and the demo turn
  limit;
- `src/copy.ts` — bilingual UI and capability descriptions;
- `src/quick.ts` — suggested prompts supplied to `AgentDock`;
- `index.html` — standalone Vite entry.

This example has no business backend. Todos live in the page; only model
requests cross the local gateway.
