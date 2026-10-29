---
id: V3-01
title: "Vue 3 learning path"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Vue 3: declaring capabilities on an existing page

Pling's Vue 3 adapter connects an existing application to the page capability runtime. It does not take over component state, routing, form submission, or rendering. The adapter registers a set of directives and components that describe existing regions, records, and controls to the agent. Business logic stays in its original components.

That boundary determines where integration code belongs. A Todo list still lives in `ref`, `reactive`, or a Pinia store, and add or completion operations still call their existing functions. Pling adds the capability declarations and an assistant entry. The agent ultimately reaches the same controls and business paths as a person.

## How this tutorial is organized

The tutorial is split into separate lanes for Vue 3, React, vanilla JavaScript / jQuery, and Vue 2.7. Read the lane that matches your application; you do not need to learn the other framework variants first.

Each lane begins with a complete Todo page that demonstrates the smallest working loop, then adds action inputs, records, regions, flows, state, and confirmations one chapter at a time. The business page stays as stable as possible; changes stay in the declaration layer. Highlighted lines in code blocks mark what a chapter adds or changes, and each chapter's example runs independently.

Concerns shared across frameworks live in Concepts and Operations. Reference documents exact options and signatures, Recipes covers concrete tasks such as tables, bulk actions, and uploads, and Troubleshooting starts from a symptom. The main chapters are best read in order; the other sections are reference material, not a required read-through.

## How this lane is organized

1. [Installation and model configuration](/vue/installation-and-model-configuration) establishes one runtime and one assistant entry. The page exposes no actions yet.
2. [Quick start: a complete Todo agent](/vue/quick-start-add-pling-to-a-vue-app) adds the task region, records, input, submit, and completion controls.
3. Later chapters cover action parameters, real controls, records and change evidence, regions, flows, state, model gateways, testing, and production controls.

The business example remains a Todo application for the early chapters. Keeping the page stable makes the integration itself visible: each chapter changes what the page declares, not what the page fundamentally is.

## What the Vue adapter adds

| Need | Vue 3 form |
| --- | --- |
| Share one page runtime | `createPling()`, then register it with `use(pling.plugin)` |
| Describe a page region | `v-scope` |
| Expose one control | `v-tool` |
| Describe a row or other record | `v-record` |
| Expose a read-only view | `useAgentState()` |
| Mount the assistant | `<AgentDock>` |

Declarations attach to elements and business functions that already exist; the page does not need to become another component tree. Buttons without declarations remain outside the agent's capability surface.

## Requirements and scope

This lane targets client-rendered Vue 3 applications and supports both the Composition API and Options API. Vue 2.7 uses a separate adapter and learning lane, so the two are not presented as interchangeable. Nuxt and server rendering require explicit attention to mount timing and belong to a later chapter.

The examples use Vite, but Pling itself does not depend on Vite. On another build system, installation and directive usage remain the same; model configuration must be passed explicitly to `createPling()` rather than relying on the `VITE_AGENT_*` shortcut.

Continue with [Installation and model configuration](/vue/installation-and-model-configuration).
