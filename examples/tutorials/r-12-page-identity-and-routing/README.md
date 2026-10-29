# R-12 · Page identity and routing

This fixture starts from R-11. The Todo app gains a task list route and a task
detail route. React Router owns navigation; the app explicitly publishes the
current path, stable route name, route params, and one whitelisted query key to
Pling with `registry.setPage`. Navigation remains a declared action, so the next
model turn receives both the new location and the new action set.

```bash
pnpm tutorial:dev r-12
pnpm tutorial:dev r-12 --locale zh
pnpm tutorial:check r-12
```
