---
id: R-02
title: "Install, provider, and first mount"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Install, provider, and first mount

This chapter installs the React adapter, creates one page runtime, and mounts the assistant. The assistant can answer questions when the model is configured, but it has no business action to execute. That empty result is deliberate: the page surface should not widen merely because Pling was installed.

The adapter does not take over React state, routing, forms, or rendering. It adds a declaration layer that describes existing page regions, data, and controls to the agent; business state updates and event handlers remain in their original components.

## Install the adapter

Install `@plingjs/react` with the package manager already used by the application:

| Package manager | Command |
| --- | --- |
| pnpm | `pnpm add @plingjs/react` |
| npm | `npm install @plingjs/react` |
| Yarn | `yarn add @plingjs/react` |

`@plingjs/react` declares React 18 or newer as a peer dependency. The adapter, agent runtime, DOM execution layer, and UI styles needed by the dock are installed together. The React dock injects its own component styles; unlike the Vue 3 adapter, there is no separate `style.css` import to add.

The example uses Vite. The adapter does not depend on Vite; on another build tool, the installation and provider setup remain the same as long as the application renders in a browser. Model configuration no longer reads `VITE_AGENT_*` automatically, so pass it explicitly as shown in “Configure the model” below.

## Create one runtime

Create the runtime at application entry, outside React components:

```tsx{2,7}
import { createRoot } from "react-dom/client";
import { createPling, PlingProvider } from "@plingjs/react";
import App from "./App";
import "./styles.css";

const pling = createPling();

createRoot(document.getElementById("root")!).render(
  <PlingProvider pling={pling}>
    <App />
  </PlingProvider>,
);
```

`createPling()` owns the page capability registry. `PlingProvider` only makes that instance available to descendant hooks and assistant components.

Do not call `createPling()` during every render, inside an effect that can run repeatedly, or once per feature component. Those choices create competing registries and make the page, records, and assistant disagree about what exists. If the application mounts several independent React roots that must share one page, create the runtime once and pass that same instance to each provider.

## Mount the assistant entry

Render the dock in the page shell:

```tsx{1,7}
import { AgentDock } from "@plingjs/react";

export function App() {
  return (
    <main>
      {/* The application's own page remains here. */}
      <AgentDock title="Page assistant" />
    </main>
  );
}
```

`AgentDock` adds a launcher, conversation panel, execution activity, and the runtime's model state. It does not wrap or own business state. It renders as a fixed-position element, so check it against any existing floating controls or footers.

At this point the page has no `usePlingTool()`, `usePlingRecord()`, or scope declaration. The registry is expected to be empty.

## Configure the model

In a Vite application, the adapter reads the same `VITE_AGENT_*` variables as the other browser adapters. Put development values in `.env.local`:

```bash
VITE_AGENT_BASE_URL=https://api.example.com/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
```

Restart Vite after changing the file. The values are read when the development server starts.

For another build tool, pass the configuration to `createPling` explicitly:

```tsx{1,5}
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

Explicit values override the environment field by field. A key bundled into a browser application is readable by the user. This is a development path, not a production secret-storage strategy. Production pages should normally call a same-origin model gateway.

The three settings have separate jobs:

| Setting | What it controls | Common mistake |
| --- | --- | --- |
| `baseUrl` | OpenAI-compatible API root | Omitting `/v1`, or using the provider's website instead of its API |
| `model` | Model id sent in the request | Using the display label instead of the API model id |
| `apiKey` | Direct endpoint authentication | Committing a real key, or leaving it blank for an authenticated public endpoint |

If the model provider blocks browser requests, configure a Vite development proxy and point `VITE_AGENT_BASE_URL` at the same-origin path:

```bash
VITE_AGENT_BASE_URL=/llm/v1
VITE_AGENT_MODEL=chat-model
VITE_AGENT_API_KEY=replace-with-a-development-key
VITE_AGENT_PROXY_TARGET=https://api.example.com
```

The example's Vite config forwards `/llm/*` to the target before the browser sends the request across origins.

## Run the example

The runnable source is in `examples/tutorials/r-02-install-provider/`. From a repository checkout:

```bash
git clone https://github.com/plingjs/pling.git
cd pling
pnpm install
pnpm tutorial:dev r-02
```

Open `http://127.0.0.1:5238/`. For the Chinese interface, run `pnpm tutorial:dev r-02 --locale zh` and open `http://127.0.0.1:5238/?lang=zh`.

The command packs the chapter's `@plingjs/*` dependencies, copies the example into `.tmp/tutorials/r-02/app`, installs those tarballs in isolation, and starts Vite. This tests the same consumption path readers get from a published package rather than importing workspace source directly.

Check the following:

1. The page renders normally and still shows its own four setup checks.
2. The badge says **0 actions**.
3. The assistant launcher opens from the lower corner.
4. A configured model can answer a simple question.
5. The activity view records no business action execution.

## Why there is no `usePlingTool` yet

Installing a provider is an application-level concern. Exposing a button is a business-level decision. Combining them makes it too easy to expose every control by accident.

The next chapter starts from a complete Todo page and attaches hooks only to the task region, task rows, the new-task input, the submit button, and each completion control. Filters and deletion remain invisible to the agent until a later chapter deliberately declares them.

## Common failures

| Symptom | Likely cause | Check |
| --- | --- | --- |
| `pling: 请先用 <PlingProvider ...>` | A Pling hook is rendered outside the provider | Put the provider above every component that uses Pling |
| The launcher is missing | `AgentDock` is not in the mounted tree | Render it inside the root application shell |
| The model address is reported as missing | `.env.local` is absent, misspelled, or Vite was not restarted | Compare variable names and restart the server |
| `Failed to fetch` | The provider blocks browser requests or the endpoint is wrong | Use the development proxy and verify the target |
| Two assistant instances appear | `createPling` and `AgentDock` were mounted in multiple roots unintentionally | Keep one runtime per page and one entry per shell |
| The assistant sees no controls | No hooks have been attached | Expected in this chapter |

Continue with [Quick start: a complete Todo agent](/react/quick-start-add-pling-to-a-react-app).
