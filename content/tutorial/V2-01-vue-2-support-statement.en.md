---
id: V2-01
title: "Vue 2.7 support"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Vue 2.7 support

`@plingjs/vue2` connects an existing Vue 2.7 application to Pling. It is an adapter, not a fork of the Vue 3 integration. The application keeps its components, state, event handlers, and rendering model. Pling adds a capability registry, a set of directives, and a DOM-based assistant entry.

`@plingjs/vue2` supports Vue 2.7. Vue 2.6 and earlier do not provide the Composition API this adapter uses, so they cannot use it; those projects can still declare page capabilities manually through `@plingjs/vanilla`. The two integration paths have different boundaries. Vue 3 uses `@plingjs/vue`, which has different installation code and a separate learning path.

## Choosing a version

| Project version | Integration | What it provides |
| --- | --- | --- |
| Vue 2.7 | `@plingjs/vue2` | `v-tool`, `v-scope`, `v-record`, state helpers, and lifecycle cleanup |
| Vue 2.6 and earlier | `@plingjs/vanilla` | Manual `pling.tool()`, `pling.scope()`, `pling.record()`, `pling.state()`, and `pling.dock()` calls after the component mounts |

If the project can be upgraded, move to Vue 2.7 first and use `@plingjs/vue2`. When that is not possible, the Vanilla path can still connect an existing page to Pling. The cost is that declarations and cleanup remain explicit application code.

## What the adapter provides

| Need | Vue 2.7 form |
| --- | --- |
| Create and install the runtime | `createPling()`, then `Vue.use(pling.plugin)` |
| Describe a page region | `v-scope` |
| Describe a control | `v-tool` |
| Describe a row or other business record | `v-record` |
| Read a selected state view | `useAgentState()` or `useAgentStoreState()` |
| Mount the assistant | `pling.dock()` |

`pling.dock()` is the shared DOM assistant. The Vue 2 adapter does not ship a second chat renderer that behaves differently from the Vue 3 and vanilla adapters.

## What it does not provide

- It does not give a Vue 2.6 application `v-tool`, `v-scope`, `v-record`, or `useAgentState()`. Those projects should use `@plingjs/vanilla` instead.
- It does not take over routing, state management, form submission, or server persistence.
- It does not replace accessibility attributes or server-side authorization.
- It does not make a Vue 2 application equivalent to a Vue 3 application. The supported APIs and the recommended migration path remain distinct.

The adapter is suitable when an application is already on Vue 2.7 and needs a controlled way to expose selected controls to an agent. A new application should generally start on Vue 3. For an older application, begin with the smallest useful declaration and expand only where the business operation is understood.

The Vanilla path for Vue 2.6 and earlier has no adapter managing declarations. Unbind each declaration when the component is destroyed, and register records and row actions again after the list renders. See [Install and first mount](/vue2/install-and-first-mount) for the concrete pattern.

## Integration boundary

Integration code belongs in the page entry and in the templates or render functions that already own the business controls. The agent executes a declared control through the same browser event path a person uses:

1. The adapter registers the element or region.
2. The executor resolves the declared action.
3. The browser dispatches the click, input, or form event.
4. The existing Vue handler updates the application.
5. The next registry snapshot reflects the resulting page state.

This order matters. A declaration is not a second business implementation, and a successful click is not by itself proof that a remote server accepted the change.

Continue with [Install and first mount](/vue2/install-and-first-mount).
