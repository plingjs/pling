# Pling examples

These are the curated examples used by the public documentation and playground
on [plingjs.dev](https://plingjs.dev). Each example owns its business UI, the
minimal Pling integration, and the local model connection used at runtime.

`examples/apps/todo-surface-auth/` is the complete authenticated Todo
application: page assistant, BFF-owned sessions, Surface pairing, external-agent
access, and page-side approval. It is also the deployment reference for the
public `todo.plingjs.dev` service.

Each folder under `demos/` is a standalone HTML entry. It owns its business UI,
the minimal Pling integration, and the local model connection used by the live
example. The documentation site reads these same source files into its code
panel, so the shown code and the running page cannot drift apart.

The fourteen `demos/recipe-*` folders are the runnable counterparts of the task
recipes. Each has its own `README.md` with the page URL, what to try, the source
location, and any server dependency. Recipes that need a real request boundary
share `recipe-backends/access-service/`; the remaining recipes keep their state
inside the page.

```bash
pnpm dev:examples
pnpm --filter @plingjs/examples build
```

`pnpm dev:examples` starts the example site, model gateway, and recipe access
service. When running the documentation playground with live embedded pages,
start both the examples and documentation servers with:

```bash
pnpm dev:docs
```
