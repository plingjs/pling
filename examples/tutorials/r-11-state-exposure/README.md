# R-11 · State exposure

This fixture starts from R-10. The page keeps its regions, long list, row
actions, history, and function-level tool. It adds one read-only `task_view`
state group so the model can distinguish the full task set, the applied filter
and search, and the current match count without copying every task into the
prompt.

```bash
pnpm tutorial:dev r-11
pnpm tutorial:dev r-11 --locale zh
pnpm tutorial:check r-11
```
