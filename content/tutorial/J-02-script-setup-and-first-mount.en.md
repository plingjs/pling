---
id: J-02
title: "Script setup and first mount"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Script setup and first mount

This chapter adds Pling to a page that already has HTML and JavaScript. The page keeps its own markup and event handlers. The integration creates one runtime and mounts the assistant; it deliberately declares no page actions.

The empty action list matters. Before a page owner exposes a control, the agent should not be able to guess one from the DOM.

## Install the adapter

Install the Vanilla package:

| Package manager | Command |
| --- | --- |
| pnpm | `pnpm add @plingjs/vanilla` |
| npm | `npm install @plingjs/vanilla` |
| Yarn | `yarn add @plingjs/vanilla` |

The package brings in the framework-neutral runtime, DOM execution layer, agent loop, and dock UI. The dock injects its own styles. If the application already ships a large global stylesheet, check for fixed-position overlap rather than trying to merge all component styles.

## Create the runtime once

Create the runtime near the application's boot code:

```ts{1,6}
import { createPling } from "@plingjs/vanilla";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app mount point");

const pling = createPling();

pling.dock({ title: "Page assistant" });
```

The runtime owns the registry for this page. `pling.dock()` mounts the launcher and conversation panel. Calling either repeatedly creates extra registries or extra assistant entries, so keep this at a single page-level entry point.

If a page is a multi-page application and the script is re-executed per navigation, destroy the previous runtime before creating another. That is a later continuity topic; for this chapter, use one document and one runtime.

## Keep the page as it was

The fixture starts with ordinary HTML:

```html
<main class="page">
  <section class="setup">
    <h1>Connected. Nothing exposed yet.</h1>
    <ol class="checks">...</ol>
  </section>
</main>
```

The JavaScript fills the existing mount point and attaches any existing event listeners. Pling does not need to create the page tree or own the state. That remains true when the page is server-rendered or built by another tool.

## Configure the model

In a Vite project, use the shared development variables:

```bash
VITE_AGENT_BASE_URL=https://api.example.com/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
```

Restart the development server after changing `.env.local`. For a page built without Vite, pass the same values explicitly:

```ts{1,6}
const pling = createPling({
  agent: {
    config: {
      baseUrl: "https://api.example.com/v1",
      model: "chat-model",
      apiKey: "replace-with-a-development-key",
    },
  },
});
```

These values are visible in the browser. Development direct access is not a production secret model. For production, use a same-origin gateway and keep credentials on the server.

If the model provider blocks browser access, configure a Vite proxy and point the browser at the local path:

```bash
VITE_AGENT_BASE_URL=/llm/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
VITE_AGENT_PROXY_TARGET=https://api.example.com
```

## Run the example

The source is in `examples/tutorials/j-02-script-setup/`. From a repository checkout:

```bash
git clone https://github.com/plingjs/pling.git
cd pling
pnpm install
pnpm tutorial:dev j-02
```

Open `http://127.0.0.1:5240/`. For Chinese, run `pnpm tutorial:dev j-02 --locale zh` and open `http://127.0.0.1:5240/?lang=zh`.

Check:

1. The original page and its four checks render.
2. The assistant launcher appears.
3. A configured model can answer a question.
4. The registry still has zero actions and zero records.
5. There is no DOM mutation caused merely by mounting Pling, other than the assistant host.

## Common failures

| Symptom | Likely cause | Check |
| --- | --- | --- |
| `createPling is not defined` | The module was not imported or the script failed earlier | Inspect the module import and browser console |
| The launcher is absent | `pling.dock()` was not called or the script threw before it | Check the mount order and the console |
| Two launchers appear | The boot script ran twice | Keep one runtime per document; destroy it on teardown |
| The model cannot answer | No base URL/model/key | Use `.env.local` or explicit `agent.config` |
| The assistant sees no actions | Nothing has been declared | Expected in this chapter |
| Styles conflict with the host page | The page has broad global CSS or fixed controls | Scope host styles and check the lower-right viewport |

## Next step

The next chapter adds the first business declarations. It will attach a scope to the task module, records to rows, a fill action to the input, a submit action to the form button, and a completion action to each row. The existing DOM and event handlers stay intact.

Continue with [Quick start: add Pling to a vanilla page](/vanilla/quick-start-add-pling-to-a-vanilla-page).
