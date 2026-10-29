# V3-24 · Nuxt and SSR

The server renders the shared Vue tree with the assistant branch inactive. The
browser hydrates the same tree, creates Pling after mount, then attaches
function-level tools and a read-only state view to the already rendered
component.

`server.mjs` is the local SSR entry. It renders the first response and serves
the client bundle; the Pling runtime is created only after hydration.

Run it with `pnpm tutorial:dev v3-24`; the page is served at
`http://127.0.0.1:5237/`. For Chinese, use
`pnpm tutorial:dev v3-24 --locale zh` and open
`http://127.0.0.1:5237/?lang=zh`.
