---
id: SITE-03
title: Examples
description: Runnable Pling examples with source, integration guides, and a model-backed live application.
status: draft
release: 0.1
locale: en
---

# Examples

These are working application pages, not recordings. Each one keeps its own components, state, and business handlers; Pling adds a small capability surface and connects it to a real model.

Open a live example first, then read its integration guide and source. The guide points to the exact lines that create the runtime, declare actions, expose records, or add a confirmation gate.

The public demos send model requests through a server-side gateway. The browser receives a same-origin endpoint and a model name; provider credentials stay on the server.

Every tutorial chapter also has a complete runnable page. To inspect the result before reading the code, open the <a href="/demos/tutorials/" target="_blank" rel="noopener noreferrer">chapter preview gallery</a>. Each tutorial page repeats its own live preview and local command at the top.

## Five classic examples

These five cover the product from different angles: the smallest working integration, a business workspace, a task that crosses client-side routes, a task that survives a full page navigation, and a capability surface for an agent outside the page.

<DemoGallery />

## Fourteen runnable recipes

Each recipe below has its own page, source tree, local command, and failure path. The model gateway and local access service start with the same command.

```bash
pnpm dev:examples
```

<DemoGallery group="recipes" />

## How to read an example

1. **Open the live page.** Try the same task through the human interface and through the assistant.
2. **Switch to Integration.** Follow the short sequence from configuration to the final assistant entry.
3. **Inspect the source.** Highlighted lines mark imports, runtime setup, declarations, and assistant entry points.

Each example has its own page, live application, full source, and integration notes. Example 05 connects the same Todo capabilities to a hosted Surface Gateway, so Codex, Claude, and other MCP clients can operate the live page with a short-lived access token. The page prepares a complete command for the user to copy; the source also keeps a loopback bridge for local development.

If you are ready to modify your own application, continue to the [Vue quick start](/vue/quick-start-add-pling-to-a-vue-app) or the [React quick start](/react/quick-start-add-pling-to-a-react-app).
