# React 16.3 legacy Todo

This is a complete Todo page running on the real `react@16.3.0` and
`react-dom@16.3.0` packages. It exists to prove the compatibility claim with a
runnable application, not only a type-level promise.

The page uses class components and render props from `@plingjs/react/legacy`.
React 16.3 has context and refs but no Hooks, so the default `@plingjs/react`
entry is not used. The assistant, action registry, records, state projection,
and model gateway are the same ones used by the modern React adapter.

## Run

From the repository root:

```bash
pnpm dev:examples
```

Open:

- `http://127.0.0.1:5191/demos/react16-legacy-todo/?lang=zh`
- `http://127.0.0.1:5191/demos/react16-legacy-todo/`

The model gateway is shared with the other public examples. Browser requests go
to `/api/agent/v1`; provider credentials stay in `examples/.env.local`. See
[`examples/GATEWAY.md`](../../GATEWAY.md).

## What to try

Use a suggested task or ask:

> Complete the first open todo, then add “Reply to the customer by Friday”.

Switch to **Activity** to inspect the model call, tool arguments, page snapshot,
and the resulting evidence. The same panel also shows the model setting as
read-only because this page uses the application-owned gateway.

## Source map

- `src/main.tsx` — classic JSX entry, `createPling`, `PlingProvider`, and
  `ReactDOM.render`;
- `src/App.tsx` — class state, Todo handlers, render-prop declarations, and the
  shared `AgentDock`;
- `src/copy.ts` — bilingual UI copy, initial data, and suggested prompts;
- `src/styles.css` — the page layout and responsive sidebar;
- `index.html` — standalone Vite entry.

The Todo list is local state. Only model requests leave the browser.
