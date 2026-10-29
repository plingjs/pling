# Example 03: Single-page route workspace

This Vue 3 workspace tests task continuity inside one document. The account
list, account detail, and activity history are three routes of the same
application. The store and Pling runtime survive route changes; page identity,
records, and available tools change with the active route.

## Run

From the repository root:

```bash
pnpm dev:examples
```

Open:

- `http://127.0.0.1:5191/demos/vue3-spa-routing/?lang=zh`
- `http://127.0.0.1:5191/demos/vue3-spa-routing/`

The page uses hash routing, so a detail URL looks like
`.../#/accounts/a1?lang=zh`. The local gateway is described in
[`examples/GATEWAY.md`](../../GATEWAY.md).

## What to try

Ask:

> 筛选高风险账户，打开 Northwind，标记为已复核，备注写成“周五前回访”。

Then ask it to open Activity and summarize the change. The assistant must read
the new route identity after each navigation instead of assuming that the list
is still active. The account list state view reports the active filter and match
count; the detail view reports the current account and whether it exists.

## Source map

- `src/router.ts` — route names and path parameters;
- `src/pages/AccountList.vue` — filters, records, and row navigation;
- `src/pages/AccountDetail.vue` — route-derived account, state view, and
  parameterized write tools;
- `src/pages/ActivityPage.vue` — shared activity history;
- `src/store.ts` — business data and activity log;
- `src/App.vue` — persistent shell and one `AgentDock`;
- `src/main.ts` — router, page identity, and runtime configuration.

The account data is local to the page. The model gateway is the only backend
dependency.
