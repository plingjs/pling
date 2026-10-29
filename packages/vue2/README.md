# @plingjs/vue2

Pling's Vue 2.7 adapter. It connects Vue 2 directives and lifecycle to the
framework-neutral `@plingjs/core` and `@plingjs/dom` runtime through the existing
DOM adapter; it does not carry a second execution engine.

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({ agent: { config: { baseUrl: "/llm/v1", model: "..." } } });
Vue.use(pling.plugin);
```

Supported declarations:

- `v-tool` for element actions;
- `v-scope` for regions and visibility;
- `v-record` for row data;
- `useAgentState` and `useAgentStoreState` for read-only state views;
- `pling.dock()` for the shared vanilla assistant surface.

Vue 2.7 is required. Vue 2.6 and earlier do not provide the composition API used
by `useAgentState`, so this adapter does not support them. Projects that cannot
upgrade can use `@plingjs/vanilla` and call `pling.tool()`, `pling.scope()`,
`pling.record()`, and `pling.state()` after mount. That manual path does not
provide directives or automatic lifecycle cleanup.
