# @plingjs/vue2

The Vue 2.7 adapter for Pling. It connects Vue directives and lifecycle hooks to
the framework-neutral core through the shared DOM adapter; it does not carry a
second execution engine.

```bash
npm install @plingjs/vue2
```

```ts
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  agent: { config: { baseUrl: "/api/llm/v1", model: "your-model" } },
});

Vue.use(pling.plugin);
```

Supported declarations include `v-tool` for actions, `v-scope` for regions and
visibility, `v-record` for row data, `useAgentState` and `useAgentStoreState` for
read-only views, and `pling.dock()` for the shared assistant surface.

Vue 2.7 is required. Vue 2.6 and earlier lack the Composition API used by the
state helpers. Projects that cannot upgrade can use `@plingjs/vanilla` and call
`pling.tool()`, `pling.scope()`, `pling.record()`, and `pling.state()` after
mount. That manual path does not provide directives or automatic cleanup.

## Documentation

- [Vue 2 adapter reference](https://plingjs.dev/reference/vue-2-adapter)
- [Vue 2.7 API](https://plingjs.dev/reference/api/vue-2)
- [Vue 2 support statement](https://plingjs.dev/vue2/)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
