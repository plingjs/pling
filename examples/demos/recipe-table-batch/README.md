# Recipe 02: table rows and batch actions

Open `http://localhost:5191/demos/recipe-table-batch/?lang=zh` after
`pnpm dev:examples`. Select several orders, ask the assistant to approve the
selection, then change the filter and try to reuse an old selection. Stale ids
are ignored, and the selection is cleared after a batch.

The page exposes records, row ids, the selected set, and two bounded batch
tools. It does not create one hidden button per possible combination. All state
is local to this page.
