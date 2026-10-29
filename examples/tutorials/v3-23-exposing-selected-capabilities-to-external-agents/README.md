# V3-23 · Exposing selected capabilities to external agents

The page keeps its in-page assistant and adds a second, protocol-only client. The
external client sees three allowlisted capabilities through `pling.surface/0.1`;
row deletion and toggling are absent. Clearing completed tasks passes through a
page-side human approval before the existing executor runs it.

Run it with `pnpm tutorial:dev v3-23`; the page is served at
`http://127.0.0.1:5236/`. For Chinese, use
`pnpm tutorial:dev v3-23 --locale zh` and open
`http://127.0.0.1:5236/?lang=zh`.
