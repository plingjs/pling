# @plingjs/react

The React adapter for Pling: a provider, typed declaration hooks, read-only state
views, records, regions, and the shared assistant UI.

The default entry uses Hooks and requires React 16.8+. React 16.3–16.7 can use
the class/render-prop entry at `@plingjs/react/legacy`.

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

Put guided tasks inside the conversation with `AgentTaskCard` and `AgentDock`'s
`task` prop (or `AgentChat`'s `task` prop). The React and Vue adapters share
core, DOM, and agent execution. React does not depend on Vue, and it does not
carry a second implementation of page semantics.

`AgentGuideActions` mounts the shared compact action row. A long recommendation
belongs in `preview`, not in the label, so the row keeps its width:

```tsx
<AgentGuideActions
  items={[{ id: "use", label: "Fill it in", preview: note, command: "apply-note", kind: "suggestion" }]}
  ariaLabel="Task actions"
  onCommand={runCourseCommand}
/>
```

For pre-Hooks React:

```tsx
import * as React from "react";
import * as ReactDOM from "react-dom";
import { AgentDock, createPling, PlingProvider, PlingTool } from "@plingjs/react/legacy";

const pling = createPling();

class App extends React.Component {
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

ReactDOM.render(<App />, document.getElementById("root"));
```

## Documentation

- [React quick start](https://plingjs.dev/react/quick-start-add-pling-to-a-react-app)
- [React 16.3–16.7 legacy entry](https://plingjs.dev/reference/react-adapter#react-163-167-legacy-entry)
- [React adapter reference](https://plingjs.dev/reference/react-adapter)
- [React API](https://plingjs.dev/reference/api/react)
- [Inspect one agent run](https://plingjs.dev/react/inspect-one-agent-run)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
