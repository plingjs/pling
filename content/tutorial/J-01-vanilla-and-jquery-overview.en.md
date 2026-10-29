---
id: J-01
title: "Vanilla and jQuery overview"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Vanilla JavaScript and jQuery: declaring capabilities on the DOM you already have

Many web applications do not render through a component framework. They use server-rendered HTML, plain DOM APIs, jQuery, or a mixture that has accumulated over time. Replacing those pages to adopt an agent interface is neither realistic nor necessary.

The Vanilla adapter works from the other direction. The DOM remains the page. Pling attaches declarations to existing elements and uses the same runtime, assistant UI, and execution model as the framework adapters. jQuery pages use the same adapter: pass the underlying DOM element, not a jQuery collection.

## The shape of the API

| Need | Vanilla form |
| --- | --- |
| Create the page runtime | `createPling()` |
| Describe a region | `pling.scope(element, options)` |
| Expose a control | `pling.tool(element, options)` |
| Describe a row | `pling.record(element, value)` |
| Expose read-only state | `pling.state(key, read, options)` |
| Mount the assistant | `pling.dock(options)` |

Each declaration returns an unsubscribe function. That is the main difference from adapter hooks and directives: when your code removes or replaces a DOM node, it must also call the corresponding unsubscribe. This makes ownership explicit and works with rendering code that Pling does not control.

## How this lane is organized

The early chapters use a small Todo page and keep the DOM stable:

1. [Script setup and first mount](/vanilla/script-setup-and-first-mount) creates one runtime and the assistant entry, with no declared actions.
2. [Quick start: add Pling to a vanilla page](/vanilla/quick-start-add-pling-to-a-vanilla-page) adds a scope, record rows, an input, a submit button, and completion buttons.
3. Later chapters cover data attributes for declarative pages, dynamic DOM, tables, asynchronous updates, dialogs, MPA continuity, and testing.

The examples use Vite so the repository can serve them without a backend build step. The adapter itself has no Vite dependency; it can be loaded by any build system that can consume ES modules.

## One rule worth stating early

Do not let a declaration outlive the element it describes. If a row is removed, unsubscribe its record and row action. If a dialog closes and its DOM is discarded, unsubscribe the dialog's tools. Otherwise the page's capability registry can retain controls that no person can see or use.

Continue with [Script setup and first mount](/vanilla/script-setup-and-first-mount).
