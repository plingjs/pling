---
id: J-08
title: "Mount the assistant UI"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Mount the assistant UI

The page can provide its own entry button without creating a second assistant. `pling.dock()` returns a controller for one shared conversation; a header button simply calls that controller.

The distinction is useful when an application already has a toolbar, help menu, or keyboard shortcut. The visual entry belongs to the host page. The conversation, registry, and execution runtime remain in one place.

## Create one dock after the page exists

Create the dock after the page DOM has been rendered, then connect any host controls:

```ts
const dock = pling.dock({
  title: "Todo assistant",
  placeholder: "What needs doing?",
  emptyHint: "I can work with the task table on this page.",
  quick: ["Mark the first task as completed"],
  onOpenChange: (open) => assistantButton.setAttribute("aria-expanded", String(open)),
});

assistantButton.addEventListener("click", () => dock.toggle());
```

The button is a human entry point. It is not registered as an agent action unless the page also declares it. The dock's own launcher remains available, so the page does not have to reimplement accessibility or focus handling.

## Choose the visible options deliberately

| Option | What it changes |
| --- | --- |
| `title` | Panel heading |
| `placeholder` | Message field prompt |
| `emptyHint` | Guidance before the first turn |
| `quick` | Suggested user messages |
| `defaultOpen` | Initial panel state |
| `config` | Model or runtime overrides for this entry |
| `gate` | Confirmation channel for actions that need approval |
| `onSessionEvent` | Host-side observation of the conversation |
| `onOpenChange` | Keeps page chrome in sync with the panel |

Quick prompts are not capabilities. They are text prefilled into the normal conversation path, and the model still has to resolve a declared action.

## Keep the runtime on the page owner

A single page, route, or micro-frontend should own one Pling runtime and one dock. When the owner is destroyed, destroy the dock and then the runtime:

```ts
dock.destroy();
pling.destroy();
```

Repeated calls to `pling.dock()` create multiple entries, not multiple connections to the same panel. If the page needs a second visual affordance, call `open`, `close`, or `toggle` on the existing controller.

## Model configuration is not UI configuration

The dock can accept `config`, but a production browser should still send model requests through an authenticated gateway. The page may choose a model alias or display name; it should not embed a provider secret. Treat the dock as a client of the runtime, not as a secure model proxy.

## Run the example

```bash
pnpm tutorial:dev j-08
```

Open `http://127.0.0.1:5273/`, or use `--locale zh` and `http://127.0.0.1:5273/?lang=zh`.

```bash
pnpm tutorial:check j-08
```

The test confirms that one dock exists, the page button toggles it, and `aria-expanded` follows the opening state while the task declarations remain unchanged.

## Common failures

**Creating a dock in every component or event handler.** This creates multiple assistants. Keep one page-level controller and reuse it.

**Building a second chat panel around `pling.runtime`.** The runtime is internal to the dock integration; the public entry is the dock controller. A second panel would duplicate conversation state and accessibility behavior.

**Treating `defaultOpen` as consent.** Opening a panel is not permission to execute. Approval and server authorization remain separate.

**Forgetting to update page chrome.** Use `onOpenChange` so a custom button's label or state does not drift from the actual panel.

Next: [Sensitive data and destructive actions](/vanilla/protect-sensitive-data-and-destructive-actions).
