---
id: V2-06
title: "Mount the assistant UI"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Mount the assistant UI

The assistant entry is a separate concern from capability declarations. A page can expose a carefully defined set of actions while showing one shared assistant, or it can defer the entry until the application has finished initializing. This chapter covers the former choice: one Vue 2.7 page, one Pling runtime, and one dock with explicit lifecycle.

## Create the dock after the application mounts

`pling.dock()` returns a controller. Keep it on the component that owns the page lifetime:

```ts
data() {
  return { dock: null };
},
mounted() {
  this.dock = pling.dock({
    title: "Todo assistant",
    placeholder: "What needs doing?",
    emptyHint: "I can work with the task list on this page.",
    quick: ["Mark the first task as completed"],
    defaultOpen: true,
    onOpenChange: (open) => { this.assistantOpen = open; },
  });
},
beforeDestroy() {
  this.dock?.destroy();
  this.dock = null;
}
```

Creating the entry after `mounted` avoids mounting a second host while Vue is still constructing the page. Destroying it in `beforeDestroy` removes its observers and registered controls with the page.

## Configure the visible entry

The dock accepts presentation settings and an application-level agent setup:

| Option | Purpose |
| --- | --- |
| `title` | Heading shown in the assistant panel |
| `placeholder` | Prompt inside the message field |
| `emptyHint` | Text shown before the first turn |
| `quick` | Suggested prompts; clicking one sends it |
| `defaultOpen` | Whether the panel starts open |
| `config` | Per-entry model or runtime overrides |
| `gate` | Confirmation channel for actions that require approval |
| `onSessionEvent` | Receives session events for auditing or host telemetry |
| `onOpenChange` | Notifies the host when the panel opens or closes |
| `navigate` | Replaces the default post-task navigation |

The quick prompts are examples for the user. They do not grant permissions and do not bypass the registry, approval policy, or model turn limits.

## Control the dock explicitly

The returned controller exposes the operations a host normally needs:

```ts
dock.open();
dock.close();
dock.toggle();
dock.isOpen();
dock.destroy();
```

This is useful for a help button, a keyboard shortcut, or an application that wants to decide when the assistant is available. The page should still have one authoritative dock rather than rendering a fresh conversation every time a button is pressed.

## Run the example

```bash
pnpm tutorial:dev v2-06
```

Open `http://127.0.0.1:5267/`. The Chinese interface is available with `pnpm tutorial:dev v2-06 --locale zh` at `http://127.0.0.1:5267/?lang=zh`.

```bash
pnpm tutorial:check v2-06
```

The check confirms that the dock mounts once, starts in the configured state, and can be closed through its controller while the Vue page continues to work.

## Common failures

**Creating a dock inside every task row.** This produces several launchers and several conversations. Create one dock at the page entry and keep the controller with the page owner.

**Forgetting to destroy the controller.** A route change or micro-frontend teardown can leave the old assistant attached to `document.body`. Destroy both the dock and the Pling runtime when their owner disappears.

**Using `defaultOpen` as a substitute for user consent.** Opening the panel is not permission to execute an action. Confirmation, authorization, and server checks remain separate concerns.

**Putting provider secrets in dock options.** Options are browser code. Use a server gateway for production credentials even when the dock is created only after authentication.

Next: [Test and deploy a Vue 2 app](/vue2/test-and-deploy-a-vue-2-app).
