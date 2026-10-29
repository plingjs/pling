# @plingjs/core

The framework-neutral runtime for Pling. It defines declared actions, records,
regions, read-only state, policy, execution, and change evidence without
depending on Vue, React, or the DOM.

Application code normally uses an adapter such as `@plingjs/vue`,
`@plingjs/react`, or `@plingjs/vanilla`. Build a custom adapter or test a page
contract directly with this package.

```bash
npm install @plingjs/core
```

```ts
import { createRegistry } from "@plingjs/core";

const registry = createRegistry();

registry.bind({
  descriptor: {
    id: "add_task",
    primitive: "call",
    description: "Add a task",
    kind: "write",
  },
  isAvailable: () => true,
  run: async () => ({ changed: true }),
});

registry.expose({
  key: "summary",
  description: "Current task counts",
  read: () => ({ open: 3, completed: 1 }),
});
```

The registry only contains capabilities the application declared. Pling does
not infer or fall back to arbitrary DOM clicks. Authorization, availability,
confirmation, and expected results stay in the execution path.

## Main areas

- actions, records, regions, feedback, and read-only state;
- parameter schemas and typed action kinds;
- policy and human-confirmation gates;
- execution results, expected-result checks, and snapshot diffs;
- bounded state serialization and sensitive-value handling;
- flows, retries, pending work, and diagnostic error codes.

## Documentation

- [Getting started](https://plingjs.dev/start/)
- [Core declarations](https://plingjs.dev/reference/core-declarations-actions-records-regions-state)
- [Execution lifecycle](https://plingjs.dev/concepts/execution-lifecycle)
- [Shared package API](https://plingjs.dev/reference/api/shared)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
