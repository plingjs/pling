# @plingjs/agent

The isomorphic agent layer for Pling. It turns declared page capabilities into a
real conversation while remaining independent of Vue, React, and browser UI.

```bash
npm install @plingjs/agent
```

Create a runtime from a Pling registry and a model configuration:

```ts
import { createAgentRuntime, resolveAgentConfig } from "@plingjs/agent";

const runtime = createAgentRuntime({
  registry: pling.registry,
  config: resolveAgentConfig({
    env: import.meta.env,
    baseUrl: "/api/llm/v1",
    model: "your-model",
  }),
  gate: () => true,
});
```

The package owns the agent loop, bounded context assembly, history compaction,
tool protocols, confirmation queues, handoff, hooks, continuity checkpoints,
retries, telemetry, deterministic replay, and evaluation helpers.

Provider credentials belong in a server-side gateway. `@plingjs/agent` can call
any OpenAI-compatible `/chat/completions` endpoint, including `@plingjs/server`.

## Documentation

- [How one agent run works](https://plingjs.dev/concepts/how-one-agent-run-works)
- [Agent runtime, sessions, context, and limits](https://plingjs.dev/reference/agent-runtime-sessions-context-limits)
- [Connect a model gateway](https://plingjs.dev/operations/connect-a-model-gateway)
- [Error codes and diagnostics](https://plingjs.dev/reference/error-codes-and-diagnostics)

Source and issues: [github.com/plingjs/pling](https://github.com/plingjs/pling).

## License

Apache-2.0.
