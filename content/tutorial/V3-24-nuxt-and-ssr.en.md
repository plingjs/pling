---
id: V3-24
title: "Nuxt and SSR"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Nuxt and SSR

Server-side rendering changes when each part of the page can run. The server must return useful HTML before a browser exists. Pling's runtime, DOM resolution, and model loop belong to the browser, after that HTML arrives.

This chapter uses a small Vite example with `@vue/server-renderer`, not a complete Nuxt project. The boundary is the same, and a smaller example makes it easier to see which code runs on each side. The final section shows where the same pieces go in Nuxt.

## Render the page before the assistant

The business list does not import Pling. It receives a locale, renders the initial tasks, and exposes only the handlers that the client-side assistant will later call:

```vue
<script setup lang="ts">
const tasks = ref<Task[]>(createSeedTasks(props.locale));

function add(text: string): void {
  const value = text.trim();
  if (!value) return;
  tasks.value = [{ id: `t${++sequence}`, text: value, done: false }, ...tasks.value];
}

defineExpose({
  add,
  toggle,
  clearCompleted,
  snapshot: () => ({ ...counts.value, records: tasks.value }),
});
</script>
```

The shared `App` adds a client-only slot without making the assistant part of the first paint:

```vue
<script setup lang="ts">
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
</script>

<template>
  <main>
    <TodoList ref="list" :locale="locale" @change="counts = $event" />
    <ClientAssistant v-if="mounted" :list="list" :counts="counts" :locale="locale" />
  </main>
</template>
```

`onMounted` does not make the component server-safe. It only delays this conditional branch until hydration has completed. The business list is rendered on both sides from the same props and seed data.

The server creates the same application tree and serialises it:

```ts
export function renderTodoSsr(locale: DemoLocale): Promise<string> {
  return renderToString(createSSRApp(App, { locale }));
}
```

The development server then places that HTML inside the page template. A request for `/?lang=zh` produces Chinese task rows on the first byte; it does not return an empty `<div id="app">` and leave the page blank until JavaScript runs.

The example also links its stylesheet from `index.html`, so the first HTML response already has the basic page layout. The assistant script is an enhancement, not the thing that fills in the business page.

## Let the browser take over by hydration

The browser entry mounts the same `App` with `createSSRApp`, not a second client-only tree:

```ts
const locale: DemoLocale = new URLSearchParams(location.search).get("lang") === "zh" ? "zh" : "en";

const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  agent: {
    config: { limits: { maxTurns: 100, contextTokens: 8_192 } },
  },
});

createSSRApp(App, { locale }).use(pling.plugin).mount("#app");
```

There are two requirements here. The browser must mount the same tree that the server rendered, and both sides must start with the same locale. In this example the server reads `?lang=` from the request URL and the browser reads the same query parameter. One side must not read a request header while the other reads `window`.

`createPling` belongs in the browser entry. Do not create a module-level runtime in a shared server module: one process serves many requests, and the runtime expects browser APIs.

## Attach capabilities after hydration

The assistant lives in `ClientAssistant.vue`. By the time it is created, `TodoList` is mounted and its methods are available through the component ref:

```ts
useAgentTool({
  id: "todo.add",
  desc: copy.addDescription,
  kind: "write",
  params: [{ name: "text", label: copy.taskLabel, minLength: 1, maxLength: 80 }],
  run: ({ text }: Record<string, unknown>) => props.list?.add(String(text)),
});

useAgentState("todo_ssr", () => ({ ...props.counts }), {
  description: copy.overview,
});
```

The same component also declares the read tool and destructive clear action, then renders `AgentDock`. All of these registrations are scoped to the client component and disappear when it unmounts.

On a client-rendered page, `v-tool` is usually the shortest way to connect an existing control. Here the business list is already server-rendered and the assistant is attached later, so function-level tools keep that boundary explicit. Both forms enter the same registry and executor.

## The same boundary in Nuxt

In Nuxt, put the runtime in a client-only plugin so it is never evaluated by the server:

```ts
// plugins/pling.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  const pling = createPling({
    ui: { locale: useCookie("locale").value ?? "en-US" },
    agent: { config: { limits: { maxTurns: 100 } } },
  });

  nuxtApp.vueApp.use(pling.plugin);
});
```

Put the component that calls `useAgentTool`, `useAgentState`, or `usePling` on the client side of the tree:

```vue
<ClientOnly>
  <TodoAssistant />
</ClientOnly>
```

The `.client.ts` plugin and `<ClientOnly>` solve different parts of the problem. The plugin decides where the runtime is created; `<ClientOnly>` keeps assistant setup and rendering out of the server pass. The business page can still be server-rendered normally.

This Nuxt snippet shows placement. The runnable example in this chapter is the Vite SSR fixture, which exercises the same lifecycle without adding a Nuxt build.

## Verify both sides

Run the English example:

```bash
pnpm tutorial:dev v3-24
```

Open `http://127.0.0.1:5237/`. For the Chinese page, run:

```bash
pnpm tutorial:dev v3-24 --locale zh
```

Open `http://127.0.0.1:5237/?lang=zh`.

The first response is the ordinary Todo page. The assistant appears only after the client runtime hydrates. Disable JavaScript and the task list remains readable; the assistant is an enhancement, not the condition for the page to exist.

Run the deterministic check:

```bash
pnpm tutorial:check v3-24
```

It renders server HTML, confirms that the business rows are present without the assistant, hydrates the same tree with `createSSRApp`, and then executes `todo.add` against the mounted component.

## Failure modes

**Creating Pling in a shared server module.** A module-level runtime can be reused across requests and may access browser globals during rendering. Create it in the client entry or a client-only plugin.

**Rendering a different locale on each side.** Hydration compares the server and client trees. Derive the initial locale from the same value on both sides.

**Putting assistant state into the server tree.** `AgentDock`, tools, and model sessions depend on a live browser page. Keep them behind the client-only boundary.

**Declaring a DOM action before the DOM exists.** Register function-level tools after the component has mounted, or let `v-tool` register with the element itself. Resolve targets at execution time.

**Assuming SSR secures the model boundary.** Server rendering does not provide a model gateway, session authentication, spend limits, or audit. Those remain separate deployment work.
