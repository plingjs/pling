---
id: V2-08
title: "Migrating from Vue 2 to Vue 3"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Migrating from Vue 2 to Vue 3

Vue 2.7 and Vue 3 use different Pling packages. The capability model stays the same, but the installation point, component lifecycle, and assistant entry do. A migration that changes only the package name may build successfully while losing actions at runtime.

This chapter compares the two complete examples rather than presenting a third copy of the page. The Vue 2.7 example establishes the existing behavior; the Vue 3 example shows the target integration. Keeping the comparison anchored to maintained examples makes the differences visible without letting a copied migration fixture drift from both.

## Keep the business contract fixed

Before moving the application shell, record what must not change:

| Contract | What to record |
| --- | --- |
| Action ids | The exact ids the model and tests already use, including row ids such as `edit@t2` |
| Record ids | The business identity of each row, not its DOM position |
| Region ids | The names and parent relationships that describe the page |
| Business handlers | The existing functions reached by the button, input, or form |
| Visibility rules | Dialogs, overlays, disabled states, and preconditions |
| Trust boundaries | Confirmation, handoff, gateway authentication, and audit |

These are behavioral contracts. An import change, a new component wrapper, or a different render function does not justify renaming an action or moving a business mutation into the capability layer.

## Compare the two endpoints

The Vue 2.7 endpoint uses a global plugin and the shared DOM dock:

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  agent: { config: { limits: { maxTurns: 100 } } },
});

Vue.use(pling.plugin);
pling.dock({ title: "Todo assistant" });
```

The Vue 3 endpoint installs the plugin on the application and mounts the dock as a component:

```ts
import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import App from "./App.vue";

const pling = createPling({
  agent: { config: { limits: { maxTurns: 100 } } },
});

createApp(App).use(pling.plugin).mount("#app");
```

```vue
<AgentDock title="Todo assistant" />
```

The declaration names remain recognizable: `v-tool`, `v-scope`, and `v-record` exist in both adapters. The expressions around them still need review. Vue 2 render functions use `this` and directive descriptors; Vue 3 uses setup state, template bindings, or `withDirectives`. The same business intention can therefore produce different declaration code.

## Run the comparison

Start the Vue 2.7 example:

```bash
pnpm tutorial:dev v2-05
```

Open `http://127.0.0.1:5266/?lang=en`. The example exposes task rows, an edit dialog, and the shared dock. Run its deterministic checks:

```bash
pnpm tutorial:check v2-05
```

Start the Vue 3 example:

```bash
pnpm tutorial:dev v3-09
```

Open `http://127.0.0.1:5222/?lang=en`. It demonstrates the same record-and-dialog behavior with the Vue 3 adapter, plus an explicit region tree and overlay availability. Run the checks:

```bash
pnpm tutorial:check v3-09
```

The two applications do not share a business codebase. Compare the capability contract, not the exact markup:

- an `edit@<record-id>` action opens the editor for that record;
- dialog actions appear only while the dialog exists;
- the background actions become unavailable while the dialog is open;
- saving reaches the page's existing mutation;
- closing the dialog removes its actions;
- the next snapshot reflects the changed record.

## Move the integration in a controlled order

1. Move the application to Vue 2.7 first if it is still on an earlier Vue 2 release.
2. Inventory every Pling declaration and the business handler it reaches.
3. Keep the Vue 2 capability tests as the behavioral baseline.
4. Migrate the application shell to Vue 3 without expanding the capability set.
5. Replace `@plingjs/vue2` with `@plingjs/vue`.
6. Install the plugin where the Vue 3 application is created.
7. Replace the DOM dock with the Vue 3 assistant component.
8. Re-run the same executor and accessibility tests against the Vue 3 page.
9. Add new capabilities only after the migrated surface is stable.

Do not change the model gateway, confirmation policy, and audit path during the same step unless the migration requires it. Keeping those boundaries fixed makes a failure easier to attribute.

## Migration review

Check these points before declaring the migration complete:

- Every action id still points to the intended business record.
- A dialog still appears and disappears with its controls.
- A scope still describes the correct active region.
- The assistant cannot see capabilities that were not intentionally migrated.
- The server gateway, approval policy, and audit trail still apply.
- The same deterministic business path passes in both versions.
- The Vue 3 entry owns plugin installation and model configuration exactly once.

The goal is not to preserve an implementation detail. It is to preserve the meaning of each capability while the framework beneath it changes.

See [Records and dialogs](/vue2/records-and-dialogs) for the Vue 2.7 endpoint and [Regions, visibility, and overlays](/vue/regions-visibility-and-overlays) for the Vue 3 endpoint.
