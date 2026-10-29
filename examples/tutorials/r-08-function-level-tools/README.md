# R-08 · Function-level tools

This fixture starts from R-07. The Todo page keeps its records, row actions,
filters, and change evidence. It then adds one operation that has no visible
control: marking every open task as completed. The operation is declared with
`useAgentTool`, shares the normal executor and policy path, and verifies its
outcome against the latest task state.

```bash
pnpm tutorial:dev r-08
pnpm tutorial:dev r-08 --locale zh
pnpm tutorial:check r-08
```
