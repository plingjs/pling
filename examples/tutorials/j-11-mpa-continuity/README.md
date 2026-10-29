# J-11 · MPA task continuity

Two ordinary HTML documents, a customer list and a detail page, share one task
through `sessionStorage`. Navigation still unloads the document; the next page
re-declares its own controls and restores only the bounded conversation state.
The business records and handlers remain in the application.

## Run the source fixture

From the repository root:

```bash
pnpm tutorial:dev j-11 --locale zh
```

Open `http://127.0.0.1:5276/?lang=zh`. Without `--locale zh`, open
`http://127.0.0.1:5276/`. This command packages the local framework releases,
copies the fixture into a temporary workspace, installs the release-equivalent
dependencies, and starts Vite.

## Run the integrated public preview

```bash
pnpm tutorial:build --only=j-11
pnpm dev:examples
```

Open `http://127.0.0.1:5191/demos/multi-page-continuity/?lang=zh`. The first
command writes the built fixture to `examples/dist/tutorials/vanilla/j-11/`; the
second serves it beside the other public examples and the model gateway.

## What to try

Ask:

> Globex的备注为：周五约吃饭。

The assistant opens the Globex detail page, restores the task in the second
document, fills and saves the note, and returns to the list once. A new tab does
not inherit the task because `sessionStorage` is scoped to the tab.

```ts
continuity: {
  resume: "auto",
  returnOnDone: true,
}
```

Use `resume: "ask"` when the person should decide whether to continue.

## Source map

- `src/ListPage.ts` — list document, records, and ordinary navigation action;
- `src/DetailPage.ts` — detail document, resumed work, and save action;
- `src/data.ts` — business state shared across documents;
- `demo/setup.ts` — continuity settings and the demo turn limit;
- `demo/a.ts` and `demo/b.ts` — two document entry points;
- `demo/index.html` and `demo/detail.html` — the two real pages.

Only the agent checkpoint crosses documents. DOM, element references, pending
approvals, and sensitive values are not transferred by continuity.
