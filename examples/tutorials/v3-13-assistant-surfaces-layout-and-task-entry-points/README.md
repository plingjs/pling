# V3-13 · Assistant surfaces and task entry points

This fixture continues the Todo example with a selectable floating dock or page sidebar. It also adds two human task entrances: a declarative `v-task` button and a `pling.ask()` call from page code. Both open the same assistant and enter the same conversation; neither is registered as an agent action.

From the repository root:

```bash
pnpm tutorial:dev v3-13
```

The script packs the framework packages, copies this directory to `.tmp/tutorials/v3-13/app`, installs local tarballs, and starts Vite on port `5226`.

For a real model, create `.env.local` from `.env.example`. If the browser is blocked by CORS, use the Vite development proxy described in that file.

Run the deterministic checks with:

```bash
pnpm tutorial:check v3-13
```
