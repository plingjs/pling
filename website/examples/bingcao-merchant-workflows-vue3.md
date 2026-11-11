---
id: SITE-03-bingcao-merchant-workflows-vue3
layout: page
pageClass: demo-page
title: "Case 08: A merchant workspace with visible outcomes (Vue 3)"
description: A simulated merchant admin that shows how Pling fits existing course, student, teacher, membership, and scheduling workflows.
status: draft
release: 0.1
locale: en
---

<DemoPlayground id="bingcao-merchant-workflows-vue3" />

## What the application already has

The page models an ordinary studio admin: course catalogue, course details and editing, teacher records, group and private scheduling, student lookup, bookings, and membership cards. These screens, forms, validation rules, and mock business API exist without Pling. Switch to **Baseline** to inspect that version.

This is a local simulation, not a connection to the real Icegrass service. The API uses `setTimeout` and `localStorage`.

## What Pling adds

Switch to **Pling** and try tasks in the assistant:

- Ask how many sessions a student has. The assistant searches by name or phone suffix, handles duplicate names as masked candidates, and reads the card data without navigating away.
- Ask where to add a teacher. Pling highlights the real **Add teacher** button. This is a locate-only target, so it does not click or submit the form.
- Ask to schedule the next three Tuesdays at 13:00. Pling uses the shop's `Asia/Shanghai` timezone, previews each date and any conflicts, and asks for confirmation before writing. The business service checks the full series again before saving.
- Create or edit a course and watch the ordinary page open the saved record. Pling invokes the same handlers and validation as the human interface.

The app remains in control of pages, state, permissions, and business rules. Pling provides bounded actions and readable task context; it does not create a second form or a parallel write path.

## Run locally

From the repository root:

```bash
pnpm dev:examples
```

Open `http://127.0.0.1:5191/demos/bingcao-merchant-workflows-vue3/?lang=en`.
Use `?lang=zh` for the Chinese UI. Model calls go through the server-side example gateway; the browser bundle contains no provider key.

## Source map

- `examples/demos/bingcao-merchant-workflows-vue3/demo/App.vue` — existing merchant screens and forms.
- `examples/demos/bingcao-merchant-workflows-vue3/src/components/IntegratedAgent.vue` — Pling actions, lookup, confirmation, and result navigation.
- `examples/demos/bingcao-merchant-workflows-vue3/src/domain/mock-api.ts` — mock business rules and persistence.
- `examples/demos/bingcao-merchant-workflows-vue3/src/domain/calendar.ts` — shop-timezone date calculations.
- `examples/demos/bingcao-merchant-workflows-vue3/demo/main.ts` — Pling initialization and the business timezone.

The preview above includes the complete source and highlights these integration points.
