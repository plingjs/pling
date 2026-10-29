# R-09 · Regions, visibility, and overlays

This fixture starts from R-08. The Todo page keeps its records, row actions,
filters, change evidence, and function-level bulk action. It adds an explicit
region tree and a real task editor rendered through a portal. While the editor
is open, the background page is inert, covered actions remain in the snapshot
as unavailable, and the function-level bulk action checks the same state
itself.

```bash
pnpm tutorial:dev r-09
pnpm tutorial:dev r-09 --locale zh
pnpm tutorial:check r-09
```
