---
id: RCP-08
title: "Multi-page task continuity"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Multi-page task continuity

A task often crosses documents: search on a list page, edit on a detail page, verify on a result page, then return to the original list. A single-page application keeps its runtime in memory across route changes. A document-based application does not. Pling's continuity layer handles the second case without trying to restore the old DOM.

This recipe keeps one goal, one bounded checkpoint, and one execution owner across a same-origin, same-tab navigation.

## Runnable page

The page below completes a task across two full document navigations: open Globex from the list, write a note on the detail document, and return after success. It is not an in-page fake route.

<DemoPlayground id="recipe-continuity" />

From the repository root:

```bash
pnpm dev:examples
```

Open `http://localhost:5191/demos/recipe-continuity/`. The source is in `examples/demos/recipe-continuity/`; the fixture uses same-tab `sessionStorage` and needs no backend.

## Choose the right mechanism

| Application shape | Mechanism | What survives |
| --- | --- | --- |
| SPA route change | In-memory runtime plus page identity | Session and history; declarations from components still mounted on the current route |
| Full document navigation | `continuity: "tab"` or an object with scope `tab` | Bounded snapshot, summary, recent messages, goal, start page |
| New tab or device | `continuity: { scope: "browser" \| "remote" }` with an authority | Shared task and lease, not the old document |

Start with the full-document case. If navigation does not unload the document, do not add continuity merely for appearance; expose the current route instead.

## MPA configuration

Both pages must use the same Pling version, the same origin, the same browser tab, and the same continuity key.

### Vue 3

```ts
import { createPling } from "@plingjs/vue";

const pling = createPling({
  agent: {
    continuity: {
      key: "order-review",
      resume: "auto",
      returnOnDone: true,
    },
  },
});

pling.registry.setPage({ path: location.pathname, title: document.title });
```

Create the Vue app on each document and use the same `agent.continuity` object. Page identity is set explicitly; router integration belongs to the SPA case below.

### React

```tsx
import { createPling } from "@plingjs/react";

const pling = createPling({
  agent: {
    continuity: { key: "order-review", resume: "auto", returnOnDone: true },
  },
});

pling.registry.setPage({ path: location.pathname, title: document.title });
```

Mount a new Provider and `<AgentDock>` in each document. They recover the checkpoint from session storage.

### Vanilla / jQuery

```ts
const pling = createPling({
  agent: {
    continuity: { key: "order-review", resume: "auto", returnOnDone: true },
  },
});

pling.registry.setPage({ path: location.pathname, title: document.title });
pling.dock({ title: "Order assistant" });
```

### Vue 2.7

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  agent: {
    continuity: { key: "order-review", resume: "auto", returnOnDone: true },
  },
});

Vue.use(pling.plugin);
pling.registry.setPage({ path: location.pathname, title: document.title });
pling.dock({ title: "Order assistant" });
```

The Vue 2.7 adapter reuses the shared vanilla dock, including continuity. It has no automatic router identity integration; set the page explicitly when the host needs it.

## What the checkpoint contains

| Field | Purpose | Default bound |
| --- | --- | --- |
| `goal` | Original user objective | First `send()` input |
| `page` | Last page view | Bounded path / title / selected params |
| `startPage` | Where the task started | Used by `returnOnDone` |
| `messages` | Recent complete messages, without system prompt | 20 messages, 4000 characters each |
| `events` | Recent UI events | 60 events |
| `summary` | Compressed history | Bounded |
| `status` | `active` or `done` | Persisted |
| `updatedAt` | Expiry | 2 hours by default |

It does not contain the DOM, registrations, pending approvals, pending handoffs, or unmasked sensitive values. The next page declares its own actions and records. The system prompt is rebuilt from that page, then combined with the restored history.

## Resume modes

`resume` accepts:

- `"ask"` (default): show “Continue the previous task” and wait for the user;
- `"auto"`: send one controlled continuation message after the new page mounts;
- `"off"`: restore history without an automatic entrance.

`auto` does not replay the previous action. It sends a prompt that tells the model to inspect the current page and not assume an interrupted result succeeded. Dangerous actions still pass through the confirmation gate.

`returnOnDone: true` returns to `startPage` only when a restored task completes. It does not reload the page when the current location is already the start page. Use `{ to, delayMs }` when the destination must be explicit.

## SPA page identity

For an SPA, keep one runtime and update page identity when the route changes. Vue 3 can read Vue Router automatically or explicitly:

```ts
const pling = createPling({
  page: {
    router,
    queryKeys: ["status"],
    hash: true,
  },
});
```

Only listed query keys are exposed. A URL containing an access token, signed download link, or return URL must not be copied into model context. For React, Vanilla, and Vue 2.7, call `pling.registry.setPage()` after navigation with a bounded object. Do not pass the entire route object.

## A complete sequence

1. On the list page, the user asks to update order SO-1042.
2. The model opens the record or calls a navigation action.
3. The browser unloads the list document and loads the detail document.
4. The runtime restores the goal, summary, recent messages, and start page.
5. The new page declares its own form, record, and actions.
6. With `resume: "auto"`, one controlled continuation message arrives. With `"ask"`, the user decides.
7. The model reads the new page before acting.
8. After the restored task completes, `returnOnDone` returns to the list page.

The return is a navigation, not a rollback. If the user changed the data on the detail page, the list must reload from its source.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| The new page starts with an empty conversation | Different origin, tab, storage key, or continuity disabled | Use one key and verify `sessionStorage` is available |
| Two docks overwrite each other | More than one continuity-enabled surface writes the same key | Enable continuity on one surface per tab |
| The model assumes an interrupted action succeeded | The checkpoint recorded an in-flight tool call without a result | The continuation prompt must inspect the page; show the unknown-result state |
| The task returns to the wrong page | `startPage` was manually overwritten, or `returnOnDone.to` is wrong | Capture the start page on the first send; use an explicit same-origin destination |
| A token appears in the page context | The entire URL or route object was exposed | Whitelist query keys; set page identity from bounded fields |
| A pending approval disappears after navigation | Pending approvals are intentionally not restored | Ask the user to repeat the action after reviewing the new page |
| A virtual list loses the target row | The row was never in the DOM | Provide a server-side find or load action |

## Security boundary

The checkpoint is session data, not an authorization grant. A restored conversation must still authenticate, scope the new page, and confirm sensitive actions. Never store API keys, full access tokens, or unmasked sensitive values in continuity storage.

## Evidence

The runnable source for this recipe is `examples/demos/recipe-continuity/`. The list and detail documents share one continuity key, so the exercise covers a real document unload and restore rather than component-local state.

## Local verification

Enter “Open Globex, set the note to Dinner on Friday, and save it.” Watch the address move from the list to the detail document, the task resume there, the note save once, and the browser return to the list. The list should reload the saved business state after returning.

