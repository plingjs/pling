# R-04 · Inspect one React agent run

This fixture starts from the working Todo agent in R-03. The business page is
unchanged; the dock enables the read-only inspector so the page projection,
model messages, tool schemas, responses, and request-time snapshot can be read
in Activity.

```bash
pnpm tutorial:dev r-04
pnpm tutorial:dev r-04 --locale zh
pnpm tutorial:check r-04
```

The inspector is a development surface. It is off by default and should not be
exposed unconditionally in production.
