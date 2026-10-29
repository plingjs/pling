---
id: SITE-04
title: "Examples and task recipes"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Examples and task recipes

Examples show complete applications; task recipes address reusable interface boundaries. Both are now grounded in runnable pages: every recipe has its own page, source, start path, and verification steps instead of sending several problems to one shared demo.

## Five classic examples

- [Example 01: Todo](/examples/quickstart) covers create, complete, edit, filter, and cleanup.
- [Example 02: Order workspace](/examples/orders) covers a business queue, records, row actions, and confirmation.
- [Example 03: Single-page route workspace](/examples/vue3-spa-routing) continues a task across client-side routes.
- [Example 04: Multi-page workspace](/examples/multi-page-continuity) continues a task across full document navigation.
- [Example 05: Expose capabilities](/examples/external-agent-surface) exposes named capabilities to an agent outside the page.

Every example page includes an operable preview, marked source, and integration notes. Model requests go through a server-side gateway; the browser does not hold a provider key.

## Run a recipe

From the repository root:

```bash
pnpm dev:examples
```

The command starts the example pages, model gateway, and local access service. A page is served at `http://localhost:5191/demos/<recipe>/`. Each recipe also embeds its current page near the top, with tabs for the preview, source, and integration notes. Recipes involving upload, sign-in, delegation, or approval use `examples/recipe-backends/access-service/`; its routes, demo account, and limits are documented in the directory README. The MCP recipe documents a separate stdio server command; it is not started by the shared command.

## Identity and protected data

- [Login, session, and protected pages](/recipes/login-session-and-protected-pages) — [preview](/demos/recipe-login-session/) · source `examples/demos/recipe-login-session/` · backend `examples/recipe-backends/access-service/`
- [Delegated access with user consent](/recipes/delegated-access-with-user-consent) — [preview](/demos/recipe-delegation/) · source `examples/demos/recipe-delegation/` · backend `examples/recipe-backends/access-service/`

## Forms and consequential actions

- [Form fill, validation, and submit](/recipes/form-fill-validation-and-submit) — [preview](/demos/recipe-form-validation/) · source `examples/demos/recipe-form-validation/` · no backend
- [Multi-step modal and wizard](/recipes/multi-step-modal-and-wizard) — [preview](/demos/recipe-wizard/) · source `examples/demos/recipe-wizard/` · no backend
- [Dangerous actions and confirmation](/recipes/dangerous-actions-and-confirmation) — [preview](/demos/recipe-danger-confirm/) · source `examples/demos/recipe-danger-confirm/` · no backend

## Tables, search, and asynchronous work

- [Table rows and batch actions](/recipes/table-rows-and-batch-actions) — [preview](/demos/recipe-table-batch/) · source `examples/demos/recipe-table-batch/` · no backend
- [Search, filters, and long lists](/recipes/search-filters-and-long-lists) — [preview](/demos/recipe-search-long-list/) · source `examples/demos/recipe-search-long-list/` · no backend
- [File upload and asynchronous work](/recipes/file-upload-and-asynchronous-work) — [preview](/demos/recipe-upload-async/) · source `examples/demos/recipe-upload-async/` · backend `examples/recipe-backends/access-service/`
- [Multi-page task continuity](/recipes/multi-page-task-continuity) — [preview](/demos/recipe-continuity/) · source `examples/demos/recipe-continuity/` · no backend

## External agents and operations

- [Expose three safe capabilities to an external agent](/recipes/expose-three-safe-capabilities-to-an-external-agent) — [preview](/demos/recipe-external-surface/) · source `examples/demos/recipe-external-surface/` · no backend
- [Connect an external agent through MCP](/recipes/connect-an-external-agent-through-mcp) — [preview](/demos/recipe-mcp/) · source `examples/demos/recipe-mcp/` · stdio server `examples/demos/external-agent-surface/mcp-server.mjs`
- [Approval, audit, and revocation for agent actions](/recipes/approval-audit-and-revocation-for-agent-actions) — [preview](/demos/recipe-approval-audit/) · source `examples/demos/recipe-approval-audit/` · backend `examples/recipe-backends/access-service/`
- [Pass Surface conformance with another implementation](/recipes/pass-surface-conformance-with-another-implementation) — [preview](/demos/recipe-conformance/) · source `examples/demos/recipe-conformance/` · no backend

## Model access

- [Use your own model key](/recipes/use-your-own-model-key) — [preview](/demos/recipe-model-key/) · source `examples/demos/recipe-model-key/` · local model gateway

## Follow a framework path

To modify your own application, continue with the tutorial for its framework:

- [Vue 3 quick start](/vue/quick-start-add-pling-to-a-vue-app)
- [React quick start](/react/quick-start-add-pling-to-a-react-app)
- [Vanilla JavaScript quick start](/vanilla/quick-start-add-pling-to-a-vanilla-page)
- [Vue 2.7 quick start](/vue2/quick-start)

## Source layout

Recipe pages live in `examples/demos/`; the shared shell and local API client live in `examples/recipe-shared/`; recipes that need a server share `examples/recipe-backends/access-service/`. Framework code remains in `packages/`, and examples do not copy execution logic.

If a recipe depends on a capability that your application does not have, adapt the business handler rather than adding a generic DOM escape hatch. Pling exposes operations the page already authorizes; it does not create a second automation channel around the page.
