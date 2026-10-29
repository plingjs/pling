---
id: V3-02
title: "Installation and model configuration"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Installation and model configuration

This chapter installs Pling in a Vue 3 application, connects a model, and mounts the assistant entry. When it is complete, the assistant can reply, but the page exposes no actions.

## Prerequisites

You need a client-side Vue 3 application. Pling does not depend on Vite. The Vue adapter requires Vue 3 and a build setup that can import ES modules and CSS; this repository uses Vite for its examples and commands.

The environment-variable shortcut in this chapter is Vite-specific. With another build tool, pass the same model settings explicitly to `createPling`, as shown below.

The examples assume Node.js 20 or newer. The commands use pnpm, but the published package also works with npm and Yarn.

## Install and initialize

Install the Vue adapter:

| Package manager | Command |
| --- | --- |
| pnpm | `pnpm add @plingjs/vue` |
| npm | `npm install @plingjs/vue` |
| Yarn | `yarn add @plingjs/vue` |

`@plingjs/vue` brings in the framework-independent runtime and agent packages it needs. No state library, router, or backend service is required for this step.

Import the published stylesheet once at the application entry:

```ts{1}
import "@plingjs/vue/style.css";
```

Create one Pling instance and install its Vue plugin where the application is created:

```ts{2,3,7,9}
import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";
import "./styles.css";

const pling = createPling();

createApp(App).use(pling.plugin).mount("#app");
```

The instance owns the page capability registry. `pling.plugin` registers the Vue directives and exposes the same instance to the assistant components. This is application-level wiring: it belongs beside `createApp`, not inside each business component.

The chapter demo raises the limit to 100 turns with `createPling({ agent: { config: { limits: { maxTurns: 100 } } } })`. This is a tutorial convention only; the production default remains 10.

## Mount the assistant interface

Place the assistant entry in the page shell:

```vue{2,10}
<script setup lang="ts">
import { AgentDock } from "@plingjs/vue";
</script>

<template>
  <main>
    <!-- The application's own content remains here. -->
  </main>

  <AgentDock title="Page assistant" />
</template>
```

`AgentDock` adds a floating launcher and the conversation panel. It does not take over the page, change the router, or wrap business state. If the application already has a footer or floating controls, treat the dock as one more fixed-position element and check for overlap.

At this point the page still has no `v-tool`, `v-record`, or state declaration. The assistant has nothing to operate.

## Configure the model connection

In a Vite project, Pling reads model settings from `VITE_AGENT_*` environment variables. For local development, put them in `.env.local` at the project root:

```bash
VITE_AGENT_BASE_URL=https://api.example.com/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
```

Restart the Vite development server after creating or changing the file. Environment variables are read when the development server starts.

For another build tool, this automatic lookup does not apply. Pass the values explicitly when creating the instance:

```ts{1,5}
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

Explicit configuration overrides environment variables field by field. It is not a place to put a production secret in front-end code: a value shipped to the browser is readable. Production credential handling arrives later, when the page is connected to a gateway.

If the model provider does not allow browser requests and the project uses Vite, route the request through the development proxy instead:

```bash
VITE_AGENT_BASE_URL=/llm/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
VITE_AGENT_PROXY_TARGET=https://api.example.com
```

The example Vite configuration rewrites `/llm/*` to the target origin. The browser request is same-origin, which avoids the provider's CORS policy during development.

The three values have separate jobs:

| Setting | What it controls | Common failure |
| --- | --- | --- |
| `baseUrl` | The OpenAI-compatible API root | Missing `/v1`; pointing at the provider's web page rather than its API |
| `model` | The model name sent in the request | Using a label from a UI instead of the API model id |
| `apiKey` | Authentication for a direct model endpoint | Leaving it empty for an `https://` base URL; pasting a key into committed source |

If any required setting is missing, the assistant reports which environment variable is absent instead of making a request that fails with an opaque 401. A relative `baseUrl`, such as `/llm/v1`, does not require a browser-side key; authentication belongs to the proxy or gateway that owns that path.

### Letting the user supply a model (opt-in)

Most applications should not expose a model form. The default is `off`. Two explicit modes exist for the cases where the connection genuinely belongs to the visitor:

| Mode | What Activity shows | Use it for |
| --- | --- | --- |
| `off` | Nothing | The default for production applications |
| `readonly` | Endpoint, model, and “managed by the application”; no key | A gateway that fixes the endpoint and model |
| `byok` | Endpoint, model, and API key inputs | Local tools, trusted internal pages, and demonstrations |

```vue
<AgentDock :model-settings="{ mode: 'byok', persist: 'session' }" />
```

Saving a connection cancels the current runtime, clears the conversation, and starts a new one with the selected endpoint and model. The key stays in memory by default. `persist: "session"` keeps it in `sessionStorage` until the tab closes; Pling never writes it to `localStorage`.

`byok` means **Bring Your Own Key**. The settings object currently has only two fields: `mode` and `persist`. `persist` has exactly two values: `"memory"` (the default; lost on reload) and `"session"` (kept until the tab closes). `readonly` has no user key, so `persist` is ignored.

`byok` is not a public-SaaS credential model. A key held by the page can be read by page scripts, browser extensions, error reporting, and developer tools. Public demonstrations should use a same-origin gateway and `readonly`. If the application already injects an `llm`, the `byok` form is hidden because a form cannot replace an application-owned model transport.

This built-in form belongs to the Vue 3 adapter. React, Vanilla / jQuery, and Vue 2.7 need a host-owned settings page or a server gateway. See [Use your own model key](/recipes/use-your-own-model-key) for all four adapters, storage rules, and failure handling.

## Verify the installation

The runnable example for this chapter is in `examples/tutorials/v3-02-install-first-render/`. If you do not have a checkout yet, clone the repository and install its dependencies:

```bash
git clone https://github.com/plingjs/pling.git
cd pling
pnpm install
```

Start the chapter from the repository root:

```bash
pnpm tutorial:dev v3-02
```

The command builds and packs the `@plingjs/*` packages used by this chapter, copies the example to `.tmp/tutorials/v3-02/app`, installs those packages in isolation, and starts Vite. Open:

```text
http://127.0.0.1:5199/
```

Check the following:

1. The page shows **Connected. Nothing exposed yet.**
2. The status badge still says **0 actions**.
3. The **Ask Pling** launcher opens the assistant.
4. Sending a simple question produces a reply.
5. The activity tab contains no executed page operation.

All tutorial examples live under `examples/tutorials/`, one directory per chapter. Every `@plingjs/*` dependency comes from the shared `packages/` tree. `pnpm tutorial:dev` packs those packages and installs the resulting tarballs into an isolated copy, so the example exercises the published package path rather than workspace source. You do not need to clone this repository to use Pling; the clone is for reading the example, running a pinned version, or working on the framework itself.

## Common failures

| Symptom | Likely cause | What to check |
| --- | --- | --- |
| The assistant panel has no styling | The published stylesheet was not imported | Add `import "@plingjs/vue/style.css"` at the application entry |
| `Failed to resolve directive: tool` appears later | The Vue plugin was not installed | Use `.use(pling.plugin)` before mounting the application |
| The launcher is absent | `AgentDock` is not rendered in the active component tree | Put it in the page shell that is actually mounted |
| The assistant says the model address is missing | `.env.local` is absent, the name is misspelled, or the server was not restarted | Compare the variable name in the message and restart Vite |
| Requests fail with `Failed to fetch` | The provider blocks browser requests or the endpoint is wrong | Use the development proxy and verify the target origin |
| The model returns 404 | The base URL or model id is wrong | Check the API root suffix and the provider's model id |
| The assistant cannot click anything | No action has been declared | Expected in this chapter; continue to the quick start |

The last row is not a fault. The empty action list proves the integration has not silently widened the page's surface.

## Scope and next step

This chapter exposes no business controls and provides no records, regions, or page state to the model. The empty action list is the expected result, not a defect to repair.

The next chapter starts from a complete Todo page and declares its existing task input and submit button. Only then does the assistant first complete a real operation through the page's original form path.

Continue with [Quick start: add Pling to a Vue app](/vue/quick-start-add-pling-to-a-vue-app).
