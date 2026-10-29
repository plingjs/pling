# @plingjs/react

The React adapter for Pling: a provider, typed declaration hooks, read-only state
views, records, regions, and the shared assistant UI.

```bash
npm install @plingjs/react
```

```tsx
import {
  AgentDock,
  PlingProvider,
  createPling,
  usePlingTool,
} from "@plingjs/react";

const pling = createPling();

function App() {
  const addAction = usePlingTool<HTMLButtonElement>({
    id: "add_task",
    desc: "Add a task",
  });

  return <button ref={addAction} onClick={addTask}>Add</button>;
}

createRoot(document.getElementById("root")!).render(
  <PlingProvider pling={pling}>
    <App />
    <AgentDock />
  </PlingProvider>,
);
```

The React and Vue adapters share core, DOM, and agent execution. React does not
depend on Vue, and it does not carry a second implementation of page semantics.

## Documentation

- [React quick start](https://plingjs.dev/react/quick-start-add-pling-to-a-react-app)
- [React adapter reference](https://plingjs.dev/reference/react-adapter)
- [React API](https://plingjs.dev/reference/api/react)
- [Inspect one agent run](https://plingjs.dev/react/inspect-one-agent-run)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
