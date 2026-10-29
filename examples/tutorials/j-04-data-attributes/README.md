# J-04 · Declarative actions with data attributes

Stable tool metadata lives in `data-agent-*` attributes. A page-owned binder
passes those values to `pling.tool`; records and availability functions remain
in JavaScript because they are not serializable configuration.

```bash
pnpm tutorial:dev j-04
pnpm tutorial:dev j-04 --locale zh
pnpm tutorial:check j-04
```
