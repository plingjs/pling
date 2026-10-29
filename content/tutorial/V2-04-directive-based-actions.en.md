---
id: V2-04
title: "Directive-based actions"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Directive-based actions

Vue 2 already knows which element a click belongs to. Pling should use that fact rather than receive a second description of the page. The `v-tool` directive attaches a capability to the element Vue renders, and the browser keeps executing the same click and input handlers it had before.

Install the adapter once in the page entry:

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  agent: { config: { limits: { maxTurns: 100 } } },
});

Vue.use(pling.plugin);
```

The plugin registers `v-tool`, `v-scope`, and `v-record`. It does not replace Vue's renderer, event system, or component lifecycle.

## Attach an action to a real control

The add button is an ordinary button whose form handler already exists. The directive supplies the name, description, and preconditions that a person can infer from the interface but a model cannot:

```ts
h("button", {
  attrs: { type: "submit", disabled: !this.draft.trim() },
  directives: [{
    name: "tool",
    value: {
      id: "composer_submit",
      desc: copy.composerSubmitDesc,
      available: () => this.draft.trim() ? true : copy.submitReason,
    },
  }],
}, copy.addTask)
```

The `id` is stable. The description states what the action does. `available` reports why the action cannot run while the field is empty, without changing the visual disabled state that the user already sees.

For a text field, the same directive can describe the primitive:

```ts
directives: [{
  name: "tool",
  value: {
    id: "composer_text",
    desc: copy.composerTextDesc,
    action: "fill",
    params: [{ name: "text", label: copy.textParamLabel }],
  },
}]
```

When the executor runs `composer_text`, it fills the element through its input path. When it runs `composer_submit`, it clicks the button. The Vue handler then adds the task exactly as it does for a person.

Risk is part of the declaration. A row delete is not the same kind of operation as opening an edit form:

```ts
directives: [{ name: "tool", value: {
  id: `remove@${task.id}`,
  desc: copy.removeDesc(task.text),
  kind: "danger",
} }]
```

This does not make the deletion safe by itself. It gives the executor and the model the correct effect category, so confirmation policy can treat it differently from a read or a normal write.

## Give the surrounding page a shape

A `v-scope` names the region that contains the form and rows. Child actions inherit that scope unless they declare another one:

```vue
<section v-scope="{ id: 'todo', label: 'Tasks', role: 'main' }">
  <ul v-scope="{ id: 'todo_list', role: 'list', parent: 'todo' }">
    <li v-for="task in tasks" :key="task.id">...</li>
  </ul>
</section>
```

The region is useful for two reasons. It helps the model understand where an action lives, and it lets visibility rules remove actions in an inactive or covered part of the page. A stable row id in `v-record` and a stable action id in `v-tool` also let the registry remove only the rows that actually changed.

## Run the example

```bash
pnpm tutorial:dev v2-04
```

Open `http://127.0.0.1:5265/`. The Chinese copy is available with:

```bash
pnpm tutorial:dev v2-04 --locale zh
```

Open `http://127.0.0.1:5265/?lang=zh`. The deterministic check is:

```bash
pnpm tutorial:check v2-04
```

It checks the directive registrations, execution through the original click handler, filling and submitting the form, and removal of a row's record and actions.

## Common failures

**Putting `v-tool` on a wrapper that never receives the event.** Declare the element that owns the behavior, or provide `target` when the operation is implemented on an inner native control.

**Using a changing id for a row.** `remove@0` or an array index makes the same id refer to a different task after sorting or deletion. Derive the id from the record's stable key.

**Declaring an action without `desc`.** The model cannot infer the business meaning from a class name or an icon. Write the description as an instruction to a competent new teammate.

**Believing the directive is a permission system.** It only projects a capability. Authorization, destructive-action confirmation, and server-side validation remain separate.
