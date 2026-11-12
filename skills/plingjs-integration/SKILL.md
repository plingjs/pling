---
name: plingjs-integration
description: Integrate, upgrade, or troubleshoot Pling in an existing Vue, React, Vue 2, or vanilla JavaScript application. Use when choosing an adapter, declaring page capabilities, connecting a model gateway, or exposing selected capabilities to an external Agent.
---

# Pling integration guide

Use this skill to help a developer add Pling to an application while keeping
the application's existing UI, business services, authorization, and data as
the source of truth. It is written for coding Agents that can read the target
repository; it does not assume a particular Agent product or MCP client.

Pling is a declared capability layer, not a browser automation engine or a
replacement for business APIs. The page declares bounded actions, records,
regions, and read-only state. The Agent proposes a declared operation; Pling
applies runtime policy and the application executes its existing handler.
Backend authorization remains authoritative.

## Working rules

1. Read the target app's `AGENTS.md`, package scripts, lockfile, auth model, and
   current working-tree state before editing.
2. Resolve the installed Pling version and framework version first. Alpha
   package APIs can change; never assume GitHub `main`, a tutorial, or a skill
   clone matches the package installed in the app. Use
   [version and source discovery](references/version-and-source-discovery.md).
3. Start with the smallest integration that satisfies the request. Preserve
   working UI and business logic; prefer declarations on existing controls or
   narrow function actions that call existing business services.
4. Keep read exposure allowlisted. Do not expose a whole Pinia/Vuex/Redux store,
   component instance, raw API response, secret, or unnecessary personal data.
   State helpers are read-only; mutations go through declared actions.
5. Never add generic `click(selector)`, `eval`, arbitrary script execution, or
   a tool that forwards unrestricted DOM events. Do not make an Agent its own
   approver.
6. Keep model-provider keys on the server. A `VITE_*` value is public after
   build. Do not put a provider key in browser code, local storage, a prompt, or
   a Surface session.
7. Treat model access and external-Agent access as separate integrations:
   model requests use a **model gateway**; remote MCP Agents use a **Surface
   gateway**. Read the relevant reference before wiring either one.
8. For a retrofit, establish and record the no-Pling baseline first. Work in
   the user's requested branch or worktree; do not overwrite a baseline or
   change unrelated failures silently.
9. Do not deploy, change credentials or authorization, run database migrations,
   or widen public/external access unless the user has authorized that specific
   action.

## Choose the integration path

| Existing application | Adapter | Notes |
| --- | --- | --- |
| Vue 3 | `@plingjs/vue` | Directives, composables, and shared assistant UI. |
| React 16.8+ | `@plingjs/react` | Hooks entry and shared assistant UI. |
| React 16.3–16.7 | `@plingjs/react/legacy` | Class/render-prop entry; do not use Hooks. |
| Vue 2.7 | `@plingjs/vue2` | Vue 2 plugin/directives over the DOM runtime. |
| Vue 2.6 or earlier | `@plingjs/vanilla` | Manual DOM declarations after mount; no Vue 2 adapter or automatic directive cleanup. |
| Plain JavaScript or jQuery | `@plingjs/vanilla` | DOM-first API; no framework dependency. |

This matrix describes the currently documented adapter shape. Verify the exact
peer dependencies and exports for the version the app will install. See
[framework adapters](references/framework-adapters.md).

## Integration sequence

1. **Understand the app.** Find routes, forms, dialogs, list/detail screens,
   business services, validation, roles, sensitive fields, and existing tests.
   Separate observed facts from assumptions.
2. **Prove the baseline.** Run the app's existing typecheck, tests, and build;
   smoke-test the main user workflow. Record pre-existing failures.
3. **Map capabilities.** For each user goal, identify the existing operation,
   required inputs and lookups, business preconditions, risk, confirmation,
   minimal returned data, and observable success evidence. Review the proposed
   surface with the user before adding sensitive or destructive operations.
4. **Mount one runtime.** Create one Pling instance at the app boundary and
   mount the adapter's assistant UI. Add only the styles documented for that
   adapter.
5. **Declare in small slices.** Add regions for meaningful page areas, records
   for rows/entities, and bounded read-only state for the current view. Declare
   existing controls with the adapter's action API. Use a function action when
   one business operation spans several UI steps or needs an application API.
6. **Connect model requests when needed.** Configure the browser with an
   application-owned endpoint and use `@plingjs/server` or an existing backend
   to keep provider credentials and access policy server-side. Read
   [model gateway setup](references/model-gateway.md).
7. **Add task guidance when useful.** Use task definitions/cards for named
   workflows with structured progress, references, or handoff. Do not create a
   task panel just to duplicate a simple chat turn. Follow the adapter's current
   task API reference rather than copying a demo's implementation wholesale.
8. **Add external Agent access only when requested.** Declare a narrow Surface,
   then add the required page session, authenticated BFF, gateway, and MCP
   client. Read [Surface and external Agents](references/surface-and-external-agents.md).
9. **Verify evidence.** Run focused tests, typecheck, and build. Test successful
   and rejected operations, ambiguous lookups, stale records, confirmation
   refusal, and the visible business result. Inspect the debug trace. Re-run the
   baseline workflow without Pling.
10. **Report the boundary.** List changed files, the exact Pling and framework
    versions, commands and outcomes, actions exposed, data sent to the model,
    unresolved assumptions, and rollback point.

## Find the exact API

Load only the reference needed for the current job:

- Framework setup and syntax: [framework adapters](references/framework-adapters.md)
- Provider credentials, browser config, and Node gateway: [model gateway](references/model-gateway.md)
- Third-party MCP Agent access: [Surface integration](references/surface-and-external-agents.md)
- Package versions, source checkout, tests, and repository map:
  [version and source discovery](references/version-and-source-discovery.md)

For full signatures and parameter tables, use the version-matched API reference:

- [Vue 3 API](https://plingjs.dev/reference/api/vue-3)
- [React API](https://plingjs.dev/reference/api/react)
- [Vanilla JavaScript API](https://plingjs.dev/reference/api/vanilla)
- [Vue 2.7 API](https://plingjs.dev/reference/api/vue-2)
- [Shared API](https://plingjs.dev/reference/api/shared)
- [Guided task API](https://plingjs.dev/reference/guided-task-api)
- [Release and compatibility notes](https://plingjs.dev/releases/)

For agent-oriented indexing, the docs site also publishes [llms.txt](https://plingjs.dev/llms.txt)
and [llms-full.txt](https://plingjs.dev/llms-full.txt). These help locate
material; they do not override the app's installed package types or matching
release docs.

If the installed package, its type declarations, its matching source tag, and
the documentation disagree, do not guess. Report the discrepancy and base the
change on the installed version's exported types and tested behavior.
