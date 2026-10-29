---
id: R-01
title: "React learning path"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# React: declaring capabilities on an existing page

Pling's React adapter connects an existing application to the page capability runtime. It does not take over React state, routing, forms, or rendering. The adapter supplies a provider and a small set of hooks that attach declarations to elements you already render.

That boundary determines where integration code belongs. A Todo list still owns its tasks in `useState` or a store, and a form still submits through its existing handler. Pling adds the capability declarations and an assistant entry; the agent ultimately reaches the same controls and business paths as a person.

## How this tutorial is organized

The tutorial is split into separate lanes for Vue 3, React, vanilla JavaScript / jQuery, and Vue 2.7. Read the lane that matches your application; you do not need to learn the other framework variants first.

Each lane begins with a complete Todo page that demonstrates the smallest working loop, then adds action inputs, records, regions, flows, state, and confirmations one chapter at a time. The business page stays as stable as possible; changes stay in the declaration layer. Highlighted lines in code blocks mark what a chapter adds or changes, and each chapter's example runs independently.

Concerns shared across frameworks live in Concepts and Operations. Reference documents exact options and signatures, Recipes covers concrete tasks such as tables, bulk actions, and uploads, and Troubleshooting starts from a symptom. The main chapters are best read in order; the other sections are reference material, not a required read-through.

## How this lane is organized

1. [Install, provider, and first mount](/react/install-provider-and-mount) establishes one page runtime and one assistant entry. The page exposes no actions yet.
2. [Quick start: a complete Todo agent](/react/quick-start-add-pling-to-a-react-app) adds the task region, records, input, submit, and row-level completion controls.
3. Later chapters cover explicit actions, records and row actions, regions, flows, state, model gateways, testing, and production controls.

The business example remains a Todo application for the early chapters. Keeping the page stable makes the integration itself visible: each chapter changes what the page declares, not what the page fundamentally is.

## What the React adapter adds

| Need | React form |
| --- | --- |
| Share one page runtime | `<PlingProvider pling={pling}>` |
| Describe a page region | `usePlingScope()` |
| Expose one control | `usePlingTool()` |
| Describe a row or other record | `usePlingRecord()` |
| Expose a read-only view | `usePlingState()` |
| Mount the assistant | `<AgentDock>` |

The hooks return React refs. Attach the ref to the element that already performs the work; no wrapper component needs to own the business control, and there is no second click implementation.

## Requirements and scope

The adapter supports React 18 and newer and is intended for client-rendered React applications. Next.js and server rendering require explicit attention to where refs and browser APIs run; that belongs to a later chapter, not the installation path.

The examples use Vite. Pling itself does not require Vite. On another build system, pass model configuration explicitly instead of relying on the `VITE_AGENT_*` shortcut.

Continue with [Install, provider, and first mount](/react/install-provider-and-mount).
