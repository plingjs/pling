# @plingjs/surface

The protocol kernel for exposing a bounded set of Pling page capabilities to an
Agent outside the page. It projects capability metadata and handles `describe`
and `invoke`; transport, authentication, and UI remain outside this package.

```bash
npm install @plingjs/surface
```

```ts
import { createSurface, SURFACE_PROTOCOL } from "@plingjs/surface";

const surface = createSurface({
  registry: pling.registry,
  app: "todo",
  expose: ["todo.overview", "todo.add"],
  session: () => verifiedAgentSession,
  execute: (id, args) => executor.execute(id, args),
});

const response = await surface.handle({
  protocol: SURFACE_PROTOCOL,
  id: "request-1",
  method: "describe",
});
```

The allowlist is explicit and is intersected with the verified Agent session
scope. The Surface never adds a click selector, script-execution escape hatch,
or second approval authority. Destructive actions still require the page's human
confirmation path.

`tasks` can describe business workflows made from exposed capabilities:

```ts
createSurface({
  registry: pling.registry,
  expose: ["search_students", "get_student_cards"],
  tasks: [{
    id: "student.cards",
    title: "Find a student's membership cards",
    steps: [
      { action: "search_students", label: "Find the student" },
      { action: "get_student_cards", label: "Read the cards" },
    ],
  }],
  execute: (id, args) => executor.execute(id, args),
});
```

Task metadata is descriptive. It does not grant access to an action that is
absent from `expose`, does not widen the verified session scope, and does not
bypass approval or audit. An external Agent must still call each capability
through the normal `invoke` path.

## Documentation

- [Agent Surface overview](https://plingjs.dev/surface/)
- [Surface protocol](https://plingjs.dev/reference/surface-protocol)
- [Protocol specification 0.1](https://plingjs.dev/spec/0.1/)
- [Expose capabilities to external agents](https://plingjs.dev/operations/expose-capabilities-to-external-agents)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
