# Icegrass merchant workflows (Vue 3)

This runnable example models a yoga-studio merchant admin. It is a local
simulation, not a connection to the real Icegrass service. Its business API
uses `setTimeout` and `localStorage` so the baseline and Pling-integrated modes
show the same records and visible outcomes.

## Run locally

From the repository root:

```bash
pnpm dev:examples
```

Open <http://127.0.0.1:5191/demos/bingcao-merchant-workflows-vue3/?lang=en>.
Add `?lang=zh` for the Chinese UI. The public preview is
<https://demo.plingjs.com/demos/bingcao-merchant-workflows-vue3/?lang=en>.

The example gateway serves model requests. Provider credentials stay on the
server; they are not included in this app or its browser bundle.

## What is in the page already

The merchant workspace has separate course list, detail, create, and edit
screens. Teacher creation, group scheduling, private availability and booking,
membership-card creation, and card issuance use the page's existing dialogs and
business handlers. The baseline toggle runs the same application without
Pling.

## What Pling adds

- A natural-language entry to the existing narrow business actions.
- Student lookup by name or phone suffix; duplicate names stay ambiguous until
  the user identifies the right person. Internal student IDs are not requested.
- A read-only schedule preview that calculates dates in the shop timezone and
  checks every teacher and room conflict before a confirmed write.
- A locate-only declaration for **Add teacher**. The assistant highlights the
  button but cannot click it through that declaration.
- Visible results: created or edited records appear in their normal detail,
  list, or student-card view.

Pling does not add a second form or replace the business API. The UI and
assistant use the same handlers and validation.

## Source map

- `demo/App.vue` — the merchant page and its existing UI flows.
- `demo/main.ts` — Vue app and Pling setup, including the shop timezone.
- `src/components/IntegratedAgent.vue` — narrow actions, read-only lookups,
  task context, confirmation, and result navigation.
- `src/domain/mock-api.ts` — simulated business rules, persistence, conflict
  checks, and read-after-write behavior.
- `src/domain/calendar.ts` — local calendar calculations for the shop timezone.
- `demo/style.css` — merchant workspace styling.

See the [English integration walkthrough](https://plingjs.dev/examples/bingcao-merchant-workflows-vue3)
or its [Chinese version](https://plingjs.dev/zh/examples/bingcao-merchant-workflows-vue3).
