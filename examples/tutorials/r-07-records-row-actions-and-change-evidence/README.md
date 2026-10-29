# R-07 · Records, row actions, and change evidence

This fixture starts from R-06. The Todo page keeps its real controls, then adds
declared row data and a delete action beside the existing completion toggle.
The repeated row actions project to `toggle` and `remove` tools with a required
`record` argument. Execution results include the records, actions, and fields
that changed between the before and after snapshots.

```bash
pnpm tutorial:dev r-07
pnpm tutorial:dev r-07 --locale zh
pnpm tutorial:check r-07
```
