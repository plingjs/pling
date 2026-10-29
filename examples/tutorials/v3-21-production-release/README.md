# V3-21 · Production release

The page pairs a small Todo assistant with an executable release gate. The gate
checks TLS, browser-side credentials, model policy, turn budget, system origin,
telemetry, and a kill switch. Release configuration is visible to a person and
not exposed as an agent action.

Run it with `pnpm tutorial:dev v3-21`; the page is served at
`http://127.0.0.1:5234/`. For Chinese, use
`pnpm tutorial:dev v3-21 --locale zh` and open
`http://127.0.0.1:5234/?lang=zh`.

The `.env.local` route is for a restricted local preview only. Browser-side
`VITE_*` values are public after the bundle is built; production credentials
must stay behind the model gateway. The release panel also leaves its
configuration unwired to the model client on purpose, so a page visitor cannot
change production policy from the demo.
