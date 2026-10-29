---
id: REF-02
title: "Agent runtime, sessions, context, limits"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Agent runtime, sessions, context, and limits

Page declarations describe a surface. The agent runtime decides how a conversation uses that surface: which model it calls, how much history it keeps, when an action needs approval, and what evidence remains after a run.

This page separates terms that are often used interchangeably. A configuration mistake in one layer should not be diagnosed as a problem in another.

## The objects and what they count

| Object | What it represents | Important boundary |
| --- | --- | --- |
| `AgentRuntime` | One wired conversation environment: model client, policy, hooks, telemetry, session | Configuration is resolved once per mounted runtime |
| `AgentSession` | The dialogue goal, history, event stream, pending approvals, and pending handoffs | `send()` is serialized; a second send waits for the first |
| Turn | One model response and its tool calls inside a single `send()` | Bounded by `limits.maxTurns` |
| Model call | One request to the model provider, including retries | Counted by telemetry; may exceed the turn count |
| Context used for compaction | Base system prompt, compressed summary, and recent messages | Bounded by `limits.contextTokens`, not by the response length |

`maxTurns` is not a request limit. If the model performs five tool rounds and then answers, that is six turns. If a provider retries once after a network failure, the turn count does not change, but the model-call count does.

`maxTokens` is also a different setting. It is the provider's output limit for one response. `contextTokens` is the history budget used to decide when to compact. The per-turn page snapshot, tool schemas, and rebuilt system prompt are added after that decision, so the final provider request can exceed the nominal history budget.

## Configuration and precedence

The runtime resolves configuration in this order:

1. framework defaults;
2. environment values such as `VITE_AGENT_BASE_URL` and `VITE_AGENT_MODEL`;
3. explicit values passed through `createPling({ agent: { config } })`, a surface's `config` prop, or an injected model.

Explicit values win per field. Nested `limits` and `retry` values are merged instead of replacing the entire object.

| Field | Default | Meaning |
| --- | --- | --- |
| `baseUrl` | empty | OpenAI-compatible endpoint; a relative path uses the same-origin proxy |
| `model` | empty | Provider model identifier |
| `apiKey` | empty | Bearer token for a direct request |
| `temperature` | `0.3` | Generation randomness |
| `maxTokens` | `1024` | Output limit for one response |
| `systemPrompt` | empty | Application role appended to the framework rules |
| `stream` | `true` | Consume server-sent text deltas when supported |
| `defaultApproval` | `"danger"` | Default action policy when an action omits `confirm` |
| `minActionIntervalMs` | `0` | Minimum delay between actions in the same batch |
| `retry.maxRetries` | `3` | Retries after the first failed request; range 0 to 5 |
| `retry.baseDelayMs` | `500` | Initial exponential-backoff delay |
| `retry.maxDelayMs` | `4000` | Delay ceiling |
| `limits.maxTurns` | `10` | Model turns allowed inside one `send()` |
| `limits.contextTokens` | `8192` | History budget used for compaction; page context and tool schemas are additional |
| `limits.reserveForOutput` | `1024` | Context reserved for the next response |
| `limits.compactRatio` | `0.8` | Fraction of usable context that triggers compaction |
| `limits.keepRecent` | `6` | Recent messages kept verbatim during compaction |

An injected `llm` is sufficient for a deterministic test or a custom gateway client. In that case `baseUrl` and `apiKey` are not required for readiness. The runtime still checks limits and retry values.

## What compaction does

The history budget is not the same as the provider's full context window. Pling reserves space for the next response and compacts early:

```text
usable = contextTokens - reserveForOutput
compactAt = floor(usable × compactRatio)
```

With the defaults, `8192 - 1024 = 7168` tokens are usable and compaction starts at about `5734` tokens.

When the estimated history exceeds that line, the runtime summarizes older messages and keeps the latest `keepRecent` messages. It must not split an assistant tool-call message from its tool result; doing so produces an invalid message sequence. The system prompt is rebuilt for each request, so the model always sees the current page instead of a cached page snapshot.

Compaction preserves the task goal, decisions, constraints, and unfinished work. It is not a transcript archive. If the application needs an auditable conversation log, record session events outside the context window.

## Wiring the runtime

The same `agent` options reach the shared runtime in every adapter. Only the mount code differs.

```ts [Vue 3]
import { createPling } from "@plingjs/vue";

const pling = createPling({
  agent: {
    config: {
      limits: { maxTurns: 100, contextTokens: 16_384, keepRecent: 8 },
      retry: { maxRetries: 2 },
    },
    onEvent(event) {
      if (event.type === "error") console.warn(event.code, event.message);
    },
  },
});
```

```tsx [React]
import { createPling, PlingProvider, AgentDock } from "@plingjs/react";

const pling = createPling({
  agent: {
    config: { limits: { maxTurns: 100, contextTokens: 16_384, keepRecent: 8 } },
  },
});

export function App() {
  return (
    <PlingProvider pling={pling}>
      <TodoPage />
      <AgentDock />
    </PlingProvider>
  );
}
```

```ts [Vanilla / jQuery]
import { createPling } from "@plingjs/vanilla";

const pling = createPling({
  agent: {
    config: { limits: { maxTurns: 100, contextTokens: 16_384, keepRecent: 8 } },
    onEvent(event) {
      if (event.type === "error") console.warn(event.code, event.message);
    },
  },
});

pling.dock({ title: "Order assistant" });
```

```ts [Vue 2.7]
import Vue from "vue";
import { createPling } from "@plingjs/vue2";

const pling = createPling({
  agent: {
    config: { limits: { maxTurns: 100, contextTokens: 16_384, keepRecent: 8 } },
  },
});

Vue.use(pling.plugin);
pling.dock({ title: "Order assistant" });
```

`maxTurns: 100` is appropriate for a long tutorial or demo. Production defaults to 10. Raising the limit increases the possible cost of one user request and should be paired with a per-run or per-tenant budget.

## Tool lifecycle hooks

Tool hooks are an application-level policy seam, not another declaration mechanism. `PreToolUse` runs after the model has chosen an action but before the executor reaches the business control. It may block the call. A blocked call returns `HOOK_BLOCKED`, emits a `blocked` event, and does not run the business handler. `PostToolUse` runs after execution and may return a replacement result; later hooks and the final tool message see the replacement.

| Hook | Runs | May change | Still cannot |
| --- | --- | --- | --- |
| `PreToolUse` | After action selection, before execution | Block with a reason; inspect the action id, model tool name, arguments, and turn | Create an undeclared action, approve itself, or bypass the executor |
| `PostToolUse` | After execution | Replace the structured result returned to the model and event stream | Undo a business side effect or turn a failed result into an executed action |

```ts
import { HookRegistry } from "@plingjs/agent";
import { createPling } from "@plingjs/vue";

const hooks = new HookRegistry();

const removePre = hooks.addPreToolUse(({ id }) => {
  if (id.startsWith("delete")) {
    return { blocked: true, reason: "Deletion requires a separate approval policy" };
  }
});

const removePost = hooks.addPostToolUse(({ result }) => {
  if ("error" in result) return;
  return { result: { ...(result.result as Record<string, unknown>), email: "[redacted]" } };
});

const pling = createPling({
  agent: { config: { limits: { maxTurns: 100 } }, hooks },
});

// Call these when the owning plugin or policy module unloads.
removePre();
removePost();
```

Hooks run in registration order. A pre-hook stops the chain on the first block; a post-hook's non-`undefined` return becomes the input to the next hook. Keep both handlers deterministic and bounded. Do not use a post-hook as the only redaction boundary for page observations: `sensitive()` governs declared outbound values, while hooks operate on action results. Do not log raw arguments or results by default; they may contain business or personal data.

Because hooks sit in the runtime rather than in the page adapter, all four adapters share the same behaviour. They are suitable for tenant policy, a kill switch for one capability, result masking, metrics, or a review queue. They are not a durable audit log and they do not decide backend authorization.

## Session lifecycle

`AgentSession` exposes:

| Method or property | Behavior |
| --- | --- |
| `send(input)` | Adds the user message and runs the loop; concurrent calls are serialized |
| `cancel()` | Aborts the in-flight model request and stops at the next safe point |
| `reset()` | Clears messages, summary, continuity state, and current-run counters; approval and handoff queues must be cleared separately |
| `status()` | Reports `idle`, `running`, or `cancelled`; approval and handoff waits are exposed through their queues and events |
| `events()` | Returns the UI event stream used by the chat and activity views; the session itself does not enforce a length limit |
| `continuity` | Reports whether a cross-document checkpoint is active |

Clearing the visible transcript without calling `reset()` is not a new conversation. The old history may still be sent on the next request. The built-in clear control calls `session.reset()` and also clears the approval and handoff queues and resets telemetry. A host that calls `reset()` directly must perform those queue and telemetry steps itself.

## Observability

Three records answer different questions:

- session events describe what the user and interface saw: messages, actions, approvals, handoffs, errors;
- telemetry summarizes model calls, tool calls, tokens, estimated cost, duration, retries, and error rate;
- a trace stores the exact recent model requests, including messages and tool schemas, for debugging.

Traces are opt-in and bounded. They are diagnostic data, not an audit log, and they may contain page text or prompt content. Do not retain them by default in production.

| Adapter | Runtime diagnostics |
| --- | --- |
| Vue 3 | `<AgentDock :debug="{ maxCalls: 8 }">` includes the request trace in the activity view |
| React | `AgentDock.onSessionEvent`, `createPling({ agent: { onEvent } })`, and injected telemetry; no built-in inspector |
| Vanilla / jQuery | `onSessionEvent`, then render the events in the host application |
| Vue 2.7 | Shared vanilla dock events; no built-in inspector |

## Failure modes

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `NOT_CONFIGURED` before any request | `baseUrl`, `model`, or a direct endpoint's `apiKey` is missing | Fill `.env.local` or pass an explicit `config` |
| A run stops after a few turns without a final answer | `maxTurns` was reached; this ends with a notice rather than a structured error | Inspect the session events, then raise the limit deliberately |
| The answer forgets an earlier decision | Compaction replaced old messages with a summary | Reduce tool output, expose a smaller state view, or keep the relevant decision in application state |
| A long run becomes unexpectedly expensive | `maxTurns` or `maxTokens` is high, or retries are multiplying calls | Set budgets and inspect telemetry by request |
| Context never compacts | Estimated tokens stay below the threshold or the input is still small | Do not force compaction; inspect the actual context size |
| A reset does not hide old history | The UI was cleared without `session.reset()` | Reset the session and the queues together |
| A provider sends no streaming text | `stream` is enabled but the gateway does not support SSE | Disable streaming or fix the gateway |

## Evidence

- Runtime and limit defaults: `packages/agent/src/config.ts`.
- Context compaction: `packages/agent/src/history.ts`.
- Session behavior: `packages/agent/src/session.ts`.
- Bounded debug trace in Vue 3: `examples/recipes/vue3`.
- Model settings: `packages/vue/src/model-settings.ts`.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | `@plingjs/agent` `0.1.0-alpha.3` |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Browsers with ES2022 modules; Node.js 20 or later for Node-side use |
| Peer dependencies | None |
| Stability | Pre-1.0 alpha; a minor release may change the API |

The limits and defaults on this page come from `packages/agent/src/config.ts` at this version. Session, context, compaction, and limit fields are pre-1.0; after a minor upgrade, re-read this page instead of assuming the earlier defaults still apply.

