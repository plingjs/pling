# @plingjs/vue

The Vue 3 adapter for Pling. Declare page capabilities with `v-tool`, `v-scope`,
and `v-record`; expose bounded read-only state; and mount the shared assistant UI.

```bash
npm install @plingjs/vue
```

```ts
import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";

const pling = createPling();

createApp(App).use(pling.plugin).mount("#app");
```

```vue
<section v-scope="{ id: 'todos', label: 'Task list', role: 'list' }">
  <li v-for="task in tasks" :key="task.id" v-record="{ data: task }">
    {{ task.text }}
    <button
      v-tool="{ id: `delete@${task.id}`, desc: `Delete ${task.text}`, kind: 'danger' }"
      @click="remove(task)"
    >
      Delete
    </button>
  </li>
</section>
```

The adapter also provides `useAgentTool()`, `useAgentState()`,
`useAgentStoreState()`, `AgentDock`, `AgentInline`, `AgentChat`, and the
development inspector. `useSurfaceGateway()` owns the repeated external-Agent
page session, WebSocket, bridge, pairing, and reconnection lifecycle without
inferring capabilities.

## Documentation

- [Vue quick start](https://plingjs.dev/vue/quick-start-add-pling-to-a-vue-app)
- [Vue 3 adapter reference](https://plingjs.dev/reference/vue-3-adapter)
- [Vue 3 API](https://plingjs.dev/reference/api/vue-3)
- [Inspect one agent run](https://plingjs.dev/vue/inspect-one-agent-run)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
