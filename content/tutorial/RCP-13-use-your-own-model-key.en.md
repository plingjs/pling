---
id: RCP-13
title: "Use your own model key"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Use your own model key

Bring-your-own-key (BYOK) means the person using the page supplies an OpenAI-compatible endpoint, model name, and API key. It solves a narrow problem: a local tool or trusted internal page needs a model connection without placing a key in the build.

It is not a substitute for a server-side model gateway. A key entered in a browser is available to the page's JavaScript, browser extensions, error reporting, and anyone with access to the session. Pling can avoid writing the key to persistent storage. It cannot hide the key from code running on the same origin.

## Runnable page

The page below connects to a compatible model through the built-in Activity settings. It shows the endpoint, model, persistence policy, and request status; the key is held by the runtime and never enters records or page state.

<DemoPlayground id="recipe-model-key" />

From the repository root:

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-model-key/` and enter your compatible endpoint, model, and key in Activity. The source is in `examples/demos/recipe-model-key/`; the fixture contains no provider key.

## Choose the connection model first

| Situation | Recommended path | Why |
| --- | --- | --- |
| Public demo or SaaS | Same-origin gateway; key stays on the server | Visitors should not hold provider credentials |
| Enterprise-managed model | Server-side alias or gateway | Central rotation, budget, and audit |
| Local tool or trusted intranet page | BYOK form with `memory` persistence | No build-time secret and a short lifetime |
| User wants to operate the site with their own agent | Pling Surface | The problem is authorization, not key collection |

If the request is “let my Codex or Claude agent use this site”, the correct integration is Surface. A provider-key field in the page does not grant an external agent scoped access, and it turns the application into a credential collector.

## Contract

The Vue 3 adapter provides a built-in settings surface. React, Vanilla / jQuery, and Vue 2.7 share the same model configuration but do not render that surface; their host applications must provide the form and lifecycle.

| Setting | Meaning | Default |
| --- | --- | --- |
| `mode: "off"` | No model-settings entry | Yes |
| `mode: "readonly"` | Show the application-managed endpoint and model; never show the key | No |
| `mode: "byok"` | Allow an OpenAI-compatible endpoint, model, and key | No |
| `persist: "memory"` | Keep the key in the current runtime only | Yes |
| `persist: "session"` | Keep the key in `sessionStorage` until the tab closes | No |
| `localStorage` | Persistent browser storage | Not supported |

`readonly` still requires a configured endpoint and model. It reports what the application provides; it does not let the user switch to another connection.

`byok` is not an enterprise secret store. It is an explicit opt-in for a user-owned connection. If the application injected its own `llm`, the Vue 3 `byok` entry is hidden, because a form cannot replace the application's transport.

## Vue 3

Enable the built-in entry on the mounted surface:

```vue
<AgentDock :model-settings="{ mode: 'byok', persist: 'memory' }" />
```

It can also be enabled for every surface created by the same Pling instance:

```ts
import { createPling } from "@plingjs/vue";

const pling = createPling({
  agent: {
    modelSettings: { mode: "byok", persist: "session" },
  },
});
```

A component prop overrides the application-level setting. To expose an application-managed connection without a key field:

```vue
<AgentDock model-settings="readonly" />
```

Saving a connection performs local validation first. A direct `http(s)` endpoint requires a key; a relative endpoint such as `/api/llm/v1` may rely on the same-origin gateway. The runtime is then replaced: the old session is cancelled, pending approvals and handoffs are cleared, the conversation and trace are reset, and a new runtime starts under the same entry. This prevents a tool call from the previous model from being replayed into the new one.

The built-in form is available in `AgentDock` and `AgentInline`. It is not part of `AgentChat`.

## React

React has no built-in model-settings panel. The host application owns the form, validation, and persistence. `AgentDock` resolves `config` when it mounts, so a changed connection needs a new runtime rather than a mutated configuration in place.

Use a connection revision as the React key; do not put the API key itself in the key.

```tsx
import { useState } from "react";
import { AgentDock, PlingProvider, createPling } from "@plingjs/react";
import type { AgentConfigOverrides } from "@plingjs/agent";

const pling = createPling();

export function App() {
  // Open this form only while no agent run is active.
  const [connection, setConnection] = useState({
    revision: 0,
    config: {
      baseUrl: "/api/llm/v1",
      model: "app-chat",
      apiKey: "",
    } as AgentConfigOverrides,
  });
  const [draft, setDraft] = useState({ baseUrl: "", model: "", apiKey: "" });

  function saveConnection() {
    setConnection((current) => ({
      revision: current.revision + 1,
      config: { ...draft },
    }));
  }

  return (
    <PlingProvider pling={pling}>
      <form onSubmit={(event) => { event.preventDefault(); saveConnection(); }}>
        <input
          value={draft.baseUrl}
          onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
          placeholder="https://provider.example.com/v1"
        />
        <input
          value={draft.model}
          onChange={(event) => setDraft({ ...draft, model: event.target.value })}
          placeholder="model-name"
        />
        <input
          type="password"
          value={draft.apiKey}
          onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
          placeholder="sk-…"
        />
        <button type="submit">Save and start a new chat</button>
      </form>
      <AgentDock
        key={connection.revision}
        config={connection.config}
      />
    </PlingProvider>
  );
}
```

The form must not submit while a run is active. Saving while a request is in flight would leave the old runtime's tool result with no matching conversation. The public `AgentDock` events do not expose a reliable `isRunning` flag, so do not derive one by guessing from `notice` events. Either show this form only from an idle settings screen, or create the runtime yourself and await `session.send()` before allowing a replacement. If the host persists the key, use `sessionStorage` only when the product explicitly accepts that risk; never move it to `localStorage`.

## Vanilla / jQuery

The vanilla adapter has no settings panel either. A dock can be rebuilt with a new `config` without discarding the page declarations held by the Pling instance.

```ts
import { createPling, type VanillaDock } from "@plingjs/vanilla";
import type { AgentConfigOverrides } from "@plingjs/agent";

const pling = createPling();

pling.action({
  id: "add_todo",
  desc: "Add a todo",
  kind: "write",
  params: [{ name: "text", label: "Todo text", minLength: 1 }],
  run: (args) => addTodo(String(args.text)),
});

let dock: VanillaDock = pling.dock({
  config: { baseUrl: "/api/llm/v1", model: "app-chat", apiKey: "" },
});

function useConnection(config: AgentConfigOverrides) {
  if (dock.runtime.session.status() === "running") return;
  dock.destroy();
  dock = pling.dock({ config });
}
```

`dock.destroy()` removes the old runtime, its conversation, and its pending decisions. The action declaration remains on `pling`, so the new dock sees the same page capabilities. If the host persists the draft, clear it when the tab closes; do not add a `localStorage` fallback.

## Vue 2.7

Vue 2.7 uses the shared vanilla dock, so the lifecycle is the same. There is no built-in settings form.

```ts
import Vue from "vue";
import { createPling, type Vue2Pling } from "@plingjs/vue2";
import type { AgentConfigOverrides } from "@plingjs/agent";

const pling: Vue2Pling = createPling();
Vue.use(pling.plugin);

let dock = pling.dock({
  config: { baseUrl: "/api/llm/v1", model: "app-chat", apiKey: "" },
});

function useConnection(config: AgentConfigOverrides) {
  if (dock.runtime.session.status() === "running") return;
  dock.destroy();
  dock = pling.dock({ config });
}
```

A new dock creates a new session. Vue 2.7 does not provide a built-in model-settings or debug panel, and it does not collect a key on the user's behalf. If the application needs a settings page, render it in the Vue 2 application and pass the resulting object to `pling.dock({ config })`.

## Storage and exposure

| Storage | Lifetime | What it does not solve |
| --- | --- | --- |
| Runtime memory | Until reload or runtime replacement | Page scripts, extensions, and developer tools can still read the key |
| `sessionStorage` | Until the tab closes; survives reload in that tab | XSS and same-origin scripts; storage is not an authorization boundary |
| `localStorage` | Across tabs and restarts | Not supported by Pling; do not implement it by copying the key |
| Server gateway | Key never enters the browser | Still requires authentication, tenant limits, and audit |

The key is used to build the request's `Authorization` header. It is not appended to the system prompt, the chat transcript, or page state. That narrows accidental disclosure; it does not protect against code that can read the page's memory or the provider request itself.

Do not put the key in a URL, analytics event, error message, screenshot, or support transcript. Error reporting and telemetry should redact `Authorization`, request headers, and any host-side settings object.

## Failure modes

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| The settings icon is missing in Vue 3 | `modelSettings` is `off`, or the prop was passed to a surface that is not mounted | Enable it on `AgentDock` / `AgentInline` or in `createPling({ agent })` |
| The `byok` form is hidden | The application injected its own `llm` | Keep the injected transport, or remove it when the user-owned connection is intentional |
| The key disappears on reload | `persist` is `memory` | Use `session` only if the product accepts the added exposure |
| The key survives after closing the tab | The host wrote it to `localStorage` | Remove that code; Pling does not provide persistent key storage |
| The first request still uses the old model | The host mutated `config` without recreating the React runtime or vanilla dock | Remount the React surface or call `dock.destroy()` before creating the new one |
| Saving is allowed during a run | The host form has no app-level guard | Show the form only while idle, or use a self-created runtime and await `session.send()`; a runtime swap is not an in-flight update |
| A key-free relative endpoint is rejected | The host requires a key for every endpoint | Treat `/api/llm/v1` as gateway-managed; require a key only for direct `http(s)` endpoints |
| The provider rejects the request | Wrong endpoint, model id, or upstream policy | Check the exact API root, model identifier, and provider CORS/security settings |

## Verification

Run this standalone example:

```bash
pnpm dev:examples
```

Open model settings in **Activity**. The page offers both `memory` and `session` persistence so the difference after a reload is directly observable.

Check the following behavior:

1. With `off`, Activity has no model-settings entry.
2. With `readonly`, the endpoint and model are visible and no key input exists.
3. With `memory`, reloading the page clears the entered key.
4. With `session`, reloading the same tab restores the connection; closing the tab clears it.
5. Saving during a run is disabled.
6. Saving clears the old conversation and creates a new runtime.
7. Request traces and system prompts contain no API key.

Evidence:

- Settings types and storage rules: `packages/vue/src/model-settings.ts`.
- Vue 3 form and runtime replacement: `packages/vue/src/components/AgentModelSettings.vue`, `packages/vue/src/components/AgentInline.vue`.
- Runnable source for this recipe: `examples/demos/recipe-model-key/`.
- Gateway deployment: [Connect a model gateway](/operations/connect-a-model-gateway).

## Local verification

Save a model with `memory`, reload, and confirm that the key is gone. Save with `session`, reload the same tab, and confirm that the connection returns. Finally inspect the system prompt and real request messages; the key must not appear in either.
