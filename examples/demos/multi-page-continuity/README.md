# Example 04: Multi-page workspace

This example uses two ordinary HTML documents rather than a client-side router.
Opening a customer performs a full navigation, so the document, action registry,
and DOM are replaced. The pending task is checkpointed in `sessionStorage`, then
resumed on the detail document. When the task finishes, the configured return
policy sends the tab back to the list.

The shared source lives in
`examples/tutorials/j-11-mpa-continuity/`; this folder contains the public demo
manifest and redirect entry.

## Run the integrated preview

From the repository root:

```bash
pnpm tutorial:build --only=j-11
pnpm dev:examples
```

Open:

- `http://127.0.0.1:5191/demos/multi-page-continuity/?lang=zh`
- `http://127.0.0.1:5191/demos/multi-page-continuity/`

The first command builds the MPA fixture into `examples/dist/tutorials/vanilla/j-11/`;
the second serves it beside the other examples. The public preview uses the
examples gateway described in [`examples/GATEWAY.md`](../../GATEWAY.md).

## Run the source fixture directly

```bash
pnpm tutorial:dev j-11 --locale zh
```

Open `http://127.0.0.1:5276/?lang=zh`. This path runs the source fixture in a
temporary release-equivalent workspace and reads the fixture's own environment
configuration.

## What to try

Ask:

> Globex的备注为：周五约吃饭。

The assistant opens the Globex detail document, restores the bounded task
context, fills and saves the note, then returns to the list once. Check that the
detail page declares its own controls: the old document's DOM and registry are
not reused.

## Source map

- `src/ListPage.ts` — list document, records, and ordinary navigation action;
- `src/DetailPage.ts` — detail document, resumed work, and save action;
- `src/data.ts` — business state shared across documents;
- `demo/setup.ts` — `resume: "auto"`, `returnOnDone: true`, and the demo limit;
- `demo/a.ts` and `demo/b.ts` — two document entry points;
- `demo/index.html` and `demo/detail.html` — the two real pages.

Only the agent checkpoint crosses documents. Business data and page controls
remain application concerns, and a new tab does not inherit the task.
