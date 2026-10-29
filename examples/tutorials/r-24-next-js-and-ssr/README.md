# R-24 · Next.js and SSR

This fixture shows the boundary that matters in a server-rendered React application:

- the server renders the Todo page before Pling exists;
- the browser hydrates the same component tree;
- the Pling runtime and assistant are created only on the client;
- capability registration happens after hydration.

The runnable fixture uses Vite SSR so the moving parts stay visible. The chapter
also shows where the same pieces belong in a Next.js App Router project.
`server.mjs` is the local SSR entry: it renders the first response, serves the
client bundle, and leaves Pling creation to the hydrated browser code.

```bash
pnpm tutorial:dev r-24
pnpm tutorial:dev r-24 --locale zh
pnpm tutorial:check r-24
```
