---
id: V2-02
title: "Install and first mount"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Install and first mount

This chapter connects a Vue 2.7 page to one Pling runtime and one assistant entry. The page still has no declared actions, so the assistant can explain what it sees but cannot operate a business control yet.

## Install the adapter

Install `@plingjs/vue2` with the package manager already used by the application:

| Package manager | Command |
| --- | --- |
| pnpm | `pnpm add @plingjs/vue2` |
| npm | `npm install @plingjs/vue2` |
| Yarn | `yarn add @plingjs/vue2` |

The adapter requires Vue 2.7. It uses the shared DOM execution layer; it does not replace Vue's renderer or event system.

## Create and install the runtime

Create the runtime once in the page entry and install its Vue plugin before mounting the application:

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  ui: { locale: "en-US" },
  agent: {
    config: {
      systemPrompt: "You are the assistant for this page. Keep answers short.",
      limits: { maxTurns: 100 },
    },
  },
});

Vue.use(pling.plugin);
```

`Vue.use(pling.plugin)` registers `v-tool`, `v-scope`, and `v-record`. It does not register actions by itself; a control becomes visible to the agent only after the page declares it.

In a real application, the model endpoint and credentials should normally be supplied by a server-side gateway. The browser must not receive a production provider secret merely to make the assistant appear.

## Mount the assistant entry

The shared DOM dock is mounted after the Vue instance exists:

```ts
new Vue({
  data() {
    return { dock: null };
  },
  mounted() {
    this.dock = pling.dock({
      title: "Page assistant",
      quick: ["What can you do on this page?"],
    });
  },
  beforeDestroy() {
    this.dock?.destroy();
  },
  render(h) {
    return h("main", "A normal Vue 2.7 page");
  },
}).$mount("#app");
```

Destroy the dock and the Pling runtime when the page or micro-frontend is torn down. Leaving a runtime attached after its application has gone away produces stale registrations and duplicate assistant entries.

## Check the first mount

Run the example:

```bash
pnpm tutorial:dev v2-02
```

Open `http://127.0.0.1:5242/`. For the Chinese interface, run `pnpm tutorial:dev v2-02 --locale zh` and open `http://127.0.0.1:5242/?lang=zh`.

The deterministic check is:

```bash
pnpm tutorial:check v2-02
```

It verifies the Vue 2.7 mount, plugin installation, assistant entry, and absence of page actions.

## Common failures

**Installing the plugin after mounting the application.** The directives must be registered before the templates that use them are compiled. Put `Vue.use(pling.plugin)` in the entry before `new Vue(...).$mount(...)`.

**Creating more than one runtime.** A page should have one Pling instance and one assistant entry. Create it in the application entry, not inside a row or a repeated component.

**Assuming the assistant has page authority.** The entry only provides a conversation surface. A control that never receives `v-tool` is not in the registry, even if it is visible to a person.

## Vue 2.6 and earlier: use the Vanilla adapter

Vue 2.6 and earlier cannot use `@plingjs/vue2`, because that adapter depends on the Vue 2.7 Composition API. The project does not have to remain outside Pling: `@plingjs/vanilla` has no Vue dependency, so it can bind the DOM elements a component has already rendered.

This path has no directives and no adapter-managed lifecycle. The application calls `pling.tool()`, `pling.scope()`, `pling.record()`, and `pling.state()` after the component mounts. Each call returns an unbind function, and row records and row actions must be registered again when the list renders.

### Install

Keep the existing Vue 2.6 installation and add only the Vanilla adapter:

| Package manager | Command |
| --- | --- |
| pnpm | `pnpm add @plingjs/vanilla` |
| npm | `npm install @plingjs/vanilla` |
| Yarn | `yarn add @plingjs/vanilla` |

Do not install `@plingjs/vue2`, and do not call `Vue.use()`. The existing bundler must be able to consume the package's ESM output; this is independent of the Vue version. The Pling runtime targets browsers with ES2022 modules, and using Vue 2.6 does not change that requirement. If the application still supports older browsers, evaluate transpilation and polyfills first.

### Create the runtime in the entry

Create one instance at the application entry and pass it to the root component with `provide`:

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vanilla";
import App from "./App.vue";

const pling = createPling({
  ui: { locale: "en-US" },
  agent: {
    config: {
      baseUrl: "/llm/v1",
      model: "your-model",
      limits: { maxTurns: 100 },
    },
  },
});

new Vue({
  provide: { pling },
  render: (h) => h(App),
}).$mount("#app");
```

The model endpoint should still point at a server-side gateway. The browser receives the gateway URL, not a production provider secret.

### Declare capabilities in an Options API component

The component below keeps ordinary Vue 2.6 data and event handlers. Pling reads those elements, invokes the same handlers, and exposes read-only counts through `pling.state()`:

```vue
<template>
  <main ref="app">
    <form @submit.prevent="addTodo">
      <label for="new-todo">New task</label>
      <input id="new-todo" ref="composer" v-model="draft" />
      <button ref="addButton" type="submit">Add</button>
    </form>

    <ul ref="list">
      <li v-for="todo in todos" :key="todo.id" :data-todo-id="todo.id">
        <input
          data-action="toggle"
          type="checkbox"
          :checked="todo.done"
          @change="toggleTodo(todo.id)"
        />
        <span>{{ todo.text }}</span>
        <button data-action="delete" type="button" @click="removeTodo(todo.id)">
          Delete
        </button>
      </li>
    </ul>
  </main>
</template>

<script>
export default {
  inject: ["pling"],

  data() {
    return {
      draft: "",
      seq: 3,
      todos: [
        { id: "t1", text: "Prepare the weekly meeting notes", done: false },
        { id: "t2", text: "Reply to the customer email", done: true },
      ],
    };
  },

  created() {
    this.rowUnbinds = [];
  },

  mounted() {
    this.pling.scope(this.$refs.app, {
      id: "todo_app",
      label: "Task application",
      role: "main",
    });

    this.pling.tool(this.$refs.composer, {
      id: "todo_text",
      desc: "Fill in the text for a new task",
      action: "fill",
      params: [{ name: "text", label: "Task text" }],
    });

    this.pling.tool(this.$refs.addButton, {
      id: "add_todo",
      desc: "Add the composer text as a task",
      kind: "write",
      available: () => (this.draft.trim() ? true : "The composer is empty"),
    });

    this.pling.state(
      "todo_view",
      () => ({
        total: this.todos.length,
        remaining: this.todos.filter((todo) => !todo.done).length,
      }),
      { description: "Task total and remaining count" },
    );

    this.pling.dock({
      title: "Task assistant",
      quick: ["Add a task called “Write the weekly report”", "Complete the first task"],
    });

    this.syncRows();
  },

  beforeDestroy() {
    this.releaseRows();
    this.pling.destroy();
  },

  methods: {
    async syncRows() {
      await this.$nextTick();
      this.releaseRows();

      for (const todo of this.todos) {
        const row = Array.from(this.$refs.list.children).find(
          (element) => element.dataset.todoId === todo.id,
        );
        if (!row) continue;

        this.rowUnbinds.push(
          this.pling.record(row, { data: todo, label: `Task: ${todo.text}` }),
          this.pling.tool(row.querySelector('[data-action="toggle"]'), {
            id: `toggle_todo:${todo.id}`,
            desc: `Toggle task completion: ${todo.text}`,
            kind: "write",
          }),
          this.pling.tool(row.querySelector('[data-action="delete"]'), {
            id: `delete_todo:${todo.id}`,
            desc: `Delete task: ${todo.text}`,
            kind: "danger",
          }),
        );
      }
    },

    releaseRows() {
      for (const unbind of this.rowUnbinds) unbind();
      this.rowUnbinds = [];
    },

    addTodo() {
      const text = this.draft.trim();
      if (!text) return;

      this.todos.push({ id: `t${this.seq++}`, text, done: false });
      this.draft = "";
      this.syncRows();
    },

    toggleTodo(id) {
      const todo = this.todos.find((item) => item.id === id);
      if (todo) todo.done = !todo.done;
      this.syncRows();
    },

    removeTodo(id) {
      this.todos = this.todos.filter((todo) => todo.id !== id);
      this.syncRows();
    },
  },
};
</script>
```

`v-model`, `@submit`, and `@click` remain Vue's responsibility. `pling.tool()` only connects the model-visible action to those elements. The composer's `fill` action writes the value and dispatches `input`; the submit button then follows the original form path.

`syncRows()` runs again after every list change because adding or removing a task replaces or removes DOM nodes. Unbind the old row declarations first, then register the current nodes; otherwise a declaration can keep pointing at an element that has left the document. Changing only a field on the same row, such as its completion state, does not replace the node Vue keeps, and each snapshot reads the latest value from the same object.

This manual path does not provide `v-tool`, `v-scope`, `v-record`, `useAgentState()`, or automatic lifecycle cleanup. It uses the same `core` / `dom` execution layer as the Vue 2.7 adapter, but the compatibility promise covers only the Vanilla APIs shown here.

Next: [Quick start: a complete Todo agent](/vue2/quick-start).
