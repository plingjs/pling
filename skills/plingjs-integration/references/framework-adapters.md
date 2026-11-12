# Framework adapters and version-specific setup

Use this file to choose the adapter and find its idiomatic entry point. These
snippets show the shape of setup, not the complete API. Copy exact options from
the version-matched API reference and the installed package's declarations.

## Install and align package versions

Install the adapter required by the app. If adding optional packages such as
`@plingjs/server`, `@plingjs/agent`, or `@plingjs/surface-browser`, align all
`@plingjs/*` packages to a mutually compatible release and update the lockfile.
Do not mix a stable adapter with a different alpha core unless that combination
is explicitly supported by its peer dependencies and release notes.

```bash
npm install @plingjs/vue
# or @plingjs/react, @plingjs/vanilla, or @plingjs/vue2
```

For exact commands and peer versions, check the app's package manager and run:

```bash
npm view @plingjs/vue version peerDependencies exports --json
npm view @plingjs/react version peerDependencies exports --json
npm view @plingjs/vue2 version peerDependencies exports --json
npm view @plingjs/vanilla version peerDependencies exports --json
```

## Vue 3

Create the runtime once at the application root and install its plugin.

```ts
import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";

const pling = createPling();
createApp(App).use(pling.plugin).mount("#app");
```

Declare a business action on an existing element with `v-tool`; use `v-scope`
for a meaningful region and `v-record` for a row's minimal, stable business
identity and fields. The existing Vue handler still performs the operation.

```vue
<section v-scope="{ id: 'courses', label: 'Courses', role: 'list' }">
  <button
    v-tool="{ id: 'course.create', desc: 'Create a course', kind: 'write' }"
    @click="openCourseForm"
  >
    Create course
  </button>
</section>
```

Read next:

- [Vue quick start](https://plingjs.dev/vue/quick-start-add-pling-to-a-vue-app)
- [Vue 3 adapter reference](https://plingjs.dev/reference/vue-3-adapter)
- [Vue 3 API index](https://plingjs.dev/reference/api/vue-3)

## React

### React 16.8 and newer

Use the Hooks entry. For React 16.8–17, `ReactDOM.render` is the compatible
mount API:

```tsx
import * as React from "react";
import * as ReactDOM from "react-dom";
import { AgentDock, PlingProvider, createPling } from "@plingjs/react";

const pling = createPling();

ReactDOM.render(
  <PlingProvider pling={pling}>
    <App />
    <AgentDock />
  </PlingProvider>,
  document.getElementById("root"),
);
```

Use the adapter's declaration hooks on existing elements. The default package
peer range may include older React; that does not mean every entry point uses
the same React APIs. React 18 applications may keep their existing
`createRoot` entry from `react-dom/client`; do not use `createRoot` in a React
16 or 17 application.

```tsx
import * as React from "react";
import { usePlingTool } from "@plingjs/react";

function SaveButton({ onSave }: { onSave: () => void }) {
  const saveRef = usePlingTool<HTMLButtonElement>({
    id: "course.save",
    desc: "Save the current course",
    kind: "write",
  });

  return <button ref={saveRef} onClick={onSave}>Save</button>;
}
```

### React 16.3–16.7

Hooks are unavailable. Import the legacy subpath and use its class/render-prop
declarations:

```tsx
import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  AgentDock,
  createPling,
  PlingProvider,
  PlingTool,
} from "@plingjs/react/legacy";

const pling = createPling();

class AppWithPling extends React.Component {
  render() {
    return (
      <PlingProvider pling={pling}>
        <PlingTool options={{ id: "save", desc: "Save the form" }}>
          {(ref) => <button ref={ref}>Save</button>}
        </PlingTool>
        <AgentDock />
      </PlingProvider>
    );
  }
}

ReactDOM.render(<AppWithPling />, document.getElementById("root"));
```

Do not import the Hooks entry in React 16.3–16.7. Confirm `react-dom`, JSX
transform, and type packages against the exact legacy application. Use the
[React 16.3–16.7 example](https://demo.plingjs.com/demos/react16-legacy-todo/?lang=en) and
[legacy adapter reference](https://plingjs.dev/reference/react-adapter#react-163-167-legacy-entry).

## Vue 2.7

The Vue 2 adapter is a separate package and requires Vue `^2.7.0`:

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling();
Vue.use(pling.plugin);
```

Use only the API subset documented for Vue 2.7; do not import the Vue 3
adapter. Read the [Vue 2.7 quick start](https://plingjs.dev/vue2/quick-start),
[adapter reference](https://plingjs.dev/reference/vue-2-adapter), and
[Vue 2.7 API](https://plingjs.dev/reference/api/vue-2).

The plugin registers `v-tool`, `v-scope`, and `v-record`; the existing handler
remains responsible for the business operation:

```vue
<button
  v-tool="{ id: 'course.save', desc: 'Save the current course', kind: 'write' }"
  @click="saveCourse"
>
  Save
</button>
```

## Vue 2.6 and earlier

`@plingjs/vue2` does not support Vue 2.6 or earlier. If upgrading to 2.7 is not
possible, use `@plingjs/vanilla` after the relevant DOM has mounted:

```ts
import { createPling } from "@plingjs/vanilla";

const pling = createPling();
const saveButton = document.querySelector<HTMLButtonElement>("#save");
if (saveButton) {
  pling.tool(saveButton, { id: "save", desc: "Save the form" });
}
pling.dock({ title: "Page assistant" });
```

Bind again when Vue replaces the element and call each returned disposer when
the relevant DOM is removed. Call `pling.destroy()` when the page is torn down.
This manual DOM route does not provide Vue directives, composables, or automatic
lifecycle cleanup.

## Vanilla JavaScript and jQuery

Use `@plingjs/vanilla` to bind existing DOM elements. It can also be used inside
framework islands when a framework adapter is unavailable, but the host must
manage mount/unmount cleanup.

```ts
import { createPling } from "@plingjs/vanilla";

const pling = createPling();
const dispose = pling.tool(document.querySelector("#add")!, {
  id: "add_task",
  desc: "Add a task using the existing form",
});
pling.dock({ title: "Page assistant" });

// On page teardown:
dispose();
pling.destroy();
```

For declaration signatures, records, scopes, state, tasks, and layout options,
use the [Vanilla API reference](https://plingjs.dev/reference/api/vanilla).

## Shared integration concepts

- **Action/tool:** a declared, bounded operation attached to an existing
  control or implemented as a narrow function action. Keep the existing
  validation and authorization path.
- **Action contract:** use a stable `id`; `desc` explains the operation to the
  Agent; `label` and `summary` provide human-facing wording; `kind` marks
  `read`, `write`, or `danger`; `params` defines bounded inputs. Add
  `available` for a business precondition, `expect` for observable success,
  `confirm` for an explicit approval policy, and `handoff` when a person must
  complete a step. The default action kind is `write`; confirm the installed
  version's defaults and parameter schema in its API reference.
- **Record:** the minimal stable identity and readable fields needed to resolve
  a row or entity. Avoid array-index IDs and sensitive fields.
- **Scope/region:** gives actions and records a meaningful page context;
  visibility and page changes can affect what is currently available.
- **State:** read-only, compact view of facts relevant to the current task. Do
  not expose mutable application stores.
- **Lookup:** search by human-readable attributes and return a small candidate
  set. Resolve ambiguity before a write; do not make the Agent invent database
  IDs.
- **Task:** an optional named workflow with entry conditions, references,
  progress, success criteria, and human handoff. Use the task API reference
  matching the adapter version.
- **Surface:** a separately scoped external-agent contract; in-page declarations
  do not automatically imply external exposure.

## More quick starts

- [React quick start](https://plingjs.dev/react/quick-start-add-pling-to-a-react-app)
- [Vanilla JavaScript quick start](https://plingjs.dev/vanilla/quick-start-add-pling-to-a-vanilla-page)
- [Vue 2.7 quick start](https://plingjs.dev/vue2/quick-start)
