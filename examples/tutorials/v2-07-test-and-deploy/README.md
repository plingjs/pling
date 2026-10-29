# V2-07 · Testing and deploying a Vue 2.7 app

This fixture keeps the record and dialog behavior from the Vue 2 lane and adds a
release contract: deterministic tests, a production build, and a check that no
provider credential is embedded in the browser source.

```bash
pnpm tutorial:dev v2-07
pnpm tutorial:dev v2-07 --locale zh
pnpm tutorial:check v2-07
```
