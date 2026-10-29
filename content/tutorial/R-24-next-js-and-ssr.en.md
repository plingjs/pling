---
id: R-24
title: "Next.js and SSR"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Next.js and SSR

In a server-rendered React application, two timings must not be confused. The business page has to produce useful HTML before a browser exists. Pling has to wait until the browser has hydrated that HTML and the DOM targets exist.

This chapter uses a small Vite SSR fixture so those timings stay visible. It uses the same React APIs as a Next.js App Router project: server rendering, hydration, client components, and a client-only runtime. The last section maps the fixture onto `app/` without pretending that a smaller build is a complete Next.js application.

## Keep the first paint independent of the assistant

The Todo page receives a locale and starts from deterministic seed data. Its first render contains the header, form, tasks, and counts. Nothing in that path calls `createPling`, resolves a DOM target, or opens a model session.

The fixture keeps the page state in `App` and delays only the assistant subtree:

```tsx
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

return (
  <main>
    <TodoPage tasks={tasks} counts={counts} />
    {mounted ? <TodoAssistant ... /> : null}
  </main>
);
```

`mounted` is `false` during server rendering and during the first client render. That makes the server HTML and the hydration pass agree. The effect runs after hydration, when it is safe to create the Pling runtime and register capabilities against the live page.

Do not use `typeof window !== "undefined"` as the only gate around this subtree. The client's first render still has to match the server output. A state flag changed after hydration is explicit about that boundary.

The server entry renders the same component tree:

```tsx
export function renderTodoSsr(locale: DemoLocale): string {
  return renderToString(<App locale={locale} />);
}
```

The HTTP handler places that string into the document before sending it. A request for `/?lang=zh` already contains Chinese task text in the first response. The page is not an empty root waiting for JavaScript.

## Create the runtime on the client

The browser entry hydrates the existing HTML instead of replacing it:

```tsx
const pling = createPling({
  ui: { locale: plingLocale(locale) },
  agent: {
    config: { limits: { maxTurns: 100 } },
  },
});

hydrateRoot(
  document.getElementById("root")!,
  <PlingProvider pling={pling}>
    <App locale={locale} />
  </PlingProvider>,
);
```

There are three requirements in that entry:

- the server and browser must receive the same initial locale and seed data;
- the browser must hydrate the same element tree the server produced;
- `createPling` must run in the browser entry, never in a shared module that the server evaluates per request.

Pling's scope observers, target resolution, presence layer, and model loop all assume a browser document. A module-level singleton in a server bundle would either fail during import or be reused across unrelated requests.

## Register capabilities after hydration

The assistant is a child component that exists only after the page has hydrated. It receives the current records and the existing business handlers, then registers function-level tools:

```tsx
usePlingState("todo_ssr", () => ({ ...counts }), {
  description: copy.overview,
});

useAgentTool({
  id: "todo.add",
  desc: copy.addDescription,
  kind: "write",
  params: [{ name: "text", label: copy.taskLabel, minLength: 1, maxLength: 80 }],
  run: (args) => onAdd(String(args.text)),
});

useAgentTool({
  id: "todo.clear_completed",
  desc: copy.clearDescription,
  kind: "danger",
  confirm: "always",
  run: onClear,
});
```

These are ordinary page capabilities, not a second state model. Adding a task calls the same React setter that the form uses. Clearing completed tasks still passes through Pling's confirmation gate. When the assistant unmounts, its registrations are removed with it.

The read tool returns a current snapshot rather than a value captured during the first render:

```tsx
useAgentTool({
  id: "todo.overview",
  desc: copy.overview,
  kind: "read",
  run: () => ({
    ...counts,
    records: tasks.map(({ id, text, done }) => ({ id, text, done })),
  }),
});
```

The handlers and data live in the client component that owns the page state. That is why this fixture can hydrate the whole tree and still attach the assistant later. A server component cannot pass event handlers into a client boundary, so the stateful workspace itself has to be a client component when capabilities operate on local UI state.

## Place the same boundary in the Next.js App Router

In a Next.js App Router project, the route can remain a server component. It loads data and renders a client workspace with serialisable initial values:

```tsx
// app/page.tsx
import { TodoWorkspace } from "./todo-workspace";

export default function Page() {
  return <TodoWorkspace initialTasks={loadTasks()} locale="en" />;
}
```

The workspace is a client component because it owns interactive state and registers page capabilities:

```tsx
// app/todo-workspace.tsx
"use client";

import { useEffect, useState } from "react";
import { createPling, PlingProvider } from "@plingjs/react";

export function TodoWorkspace(props: Props) {
  const [mounted, setMounted] = useState(false);
  const [pling] = useState(() => createPling({
    agent: { config: { limits: { maxTurns: 100 } } },
  }));

  useEffect(() => {
    setMounted(true);
    return () => pling.destroy();
  }, [pling]);

  return (
    <PlingProvider pling={pling}>
      <TodoPage {...props} />
      {mounted ? <TodoAssistant {...props} /> : null}
    </PlingProvider>
  );
}
```

This component is still rendered by Next.js on the server to produce initial HTML, but its effects and DOM observers run only in the browser. `PlingProvider` adds context and no markup, so wrapping the tree does not change the server output.

The `mounted` condition controls when capabilities and `AgentDock` enter the client tree. It is not a substitute for checking whether the browser is present: client components can execute during server rendering. The runtime creation must remain in a browser-only lifecycle. For projects that need a singleton across client navigation, create it in a dedicated client provider and destroy it when that provider leaves the application root.

If the workspace is a server component and the assistant must act on server-held data, expose business operations through authenticated server endpoints and register tools that call those endpoints. Do not invent a DOM action for a control that does not exist in the browser.

## Run the fixture

Run the English example:

```bash
pnpm tutorial:dev r-24
```

Open `http://127.0.0.1:5264/`. Run the Chinese example:

```bash
pnpm tutorial:dev r-24 --locale zh
```

Open `http://127.0.0.1:5264/?lang=zh`. The first response contains the business page. The assistant appears after hydration. Disabling JavaScript leaves the Todo list readable.

Deterministic checks:

```bash
pnpm tutorial:check r-24
```

The tests render the page on the server, verify that the assistant shell is absent, hydrate the same markup, confirm that the four tools register, and execute `todo.add` against the hydrated page.

## Common failures

**Creating Pling while the module is imported on the server.** The runtime may touch `document`, and a module singleton can leak state across requests. Create it in the browser entry or a client-only lifecycle.

**Rendering the assistant before hydration.** The server markup and the first client render differ, and the capability layer may look for targets that do not exist yet. Gate the assistant subtree with state set after hydration.

**Using different data on the two sides.** Locale, seed records, and any server-provided initial state must match. Read them from serialisable props, not from a request-only value on one side and `window` on the other.

**Registering a tool that closes over stale state.** Read current values when the tool runs. The registry keeps the action alive, but it cannot repair a captured snapshot in your handler.

**Assuming SSR supplies model security.** Server rendering does not provide authentication, rate limits, key isolation, or audit. Those remain part of the model gateway and deployment boundary.
