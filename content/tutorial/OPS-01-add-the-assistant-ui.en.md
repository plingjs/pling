---
id: OPS-01
title: "Add the assistant UI"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Add the assistant UI

The assistant surface is the place where a person reads the run, starts a task, and answers confirmation or handoff requests. It is separate from capability declarations. Adding a chat window does not expose a button, and declaring an action does not automatically create a usable entry point.

## Choose one primary surface

Use one assistant surface per task context. A dock is suitable when the page should remain fully visible. A sidebar is useful for a persistent workspace. An inline surface fits a single task embedded in the page. A bare chat component is appropriate when the host owns the surrounding layout.

Do not mount two surfaces that share one session merely to offer two visual positions. They will compete over transcripts, pending approvals, and focus. If two surfaces must coexist, give each a distinct task or runtime and explain the boundary in the interface.

## Mount after the page exists

The surface reads the same registry and UI controller as the page. Mount it after the application root and cap the runtime once at the entry point:

```ts
const pling = createPling({
  agent: { config: { limits: { maxTurns: 10 } } },
});

pling.dock({ title: "Page assistant" });
```

Framework adapters wrap the same runtime in a provider or plugin. Keep model configuration, confirmation channels, and task navigation at the application entry, not inside each visual component. A second configuration path is hard to audit and easy to drift.

## Make the entry point explicit

The launcher should have an accessible name and a visible state. Opening the surface must not run an action or resend the previous prompt. Closing it should not destroy the session unless the product intentionally starts a new task.

For a destructive confirmation, place the decision in the application surface and keep it reachable from the page. If the assistant is closed, the action remains pending or is cancelled according to the host policy; it must not be silently approved.

## What the surface should show

At minimum, show the current conversation, a clear busy or idle state, tool failures, and the controls needed to cancel, retry, or answer a pending decision. A “recent operations” view may show action ids, targets, result codes, and evidence; it should not expose raw secrets or an unrestricted page dump.

Continue with [Theme, locale, and accessibility](/operations/theme-locale-and-accessibility) or inspect the adapter-specific mounting guide for your framework.
