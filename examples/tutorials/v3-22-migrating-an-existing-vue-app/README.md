# V3-22 · Migrating an existing Vue app

This fixture starts with an ordinary Todo page and adds a small Pling
integration at its boundary. The application functions, form handlers, and row
rendering remain in place. The integration adds one application plugin, one
named region, two form controls, a record plus checkbox for each row, and one
read-only state view.

Run it with `pnpm tutorial:dev v3-22`; the page is served at
`http://127.0.0.1:5235/`. For Chinese, use
`pnpm tutorial:dev v3-22 --locale zh` and open
`http://127.0.0.1:5235/?lang=zh`.
