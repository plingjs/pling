---
id: REF-11
title: "Error codes and diagnostics"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Error codes and diagnostics

Pling separates a machine-readable code from the localized sentence shown to a person. The code is stable across locales and adapters; the message comes from the shared UI catalog.

```ts
import { describePlingError, describePlingDiagnostic } from "@plingjs/ui";

const text = describePlingError(
  { code: "ACTION_UNAVAILABLE", message: "The button is covered by a dialog" },
  (key, params) => translate(locale, key, params),
);
```

Do not parse the localized text. Branch on `code`.

## Action errors

| Code | Meaning | Typical cause | What to change |
| --- | --- | --- | --- |
| `DUPLICATE_ACTION_ID` | Two actions use the same id | A loop reused a constant id | Add the row key or a namespace |
| `DUPLICATE_STATE_KEY` | Two state views use the same key | Two mounted components expose `task_view` | Give each view a unique key, or move it to one owner |
| `DUPLICATE_GUIDE_TARGET` | Two guide targets share an id | Copy-pasted handoff markup | Use unique target ids |
| `ACTION_NOT_FOUND` | The model called an id that is not registered | The declaration was removed, renamed, or never existed | Declare the action or refuse the task honestly |
| `INVALID_ARGS` | The tool-call arguments are not valid JSON or do not match the schema | The model emitted malformed arguments | Report the field and expected shape |
| `INVALID_PARAMS` | Declared parameters failed validation | Missing required value, wrong type, outside range, bad pattern | Return the validation reason; do not retry blindly |
| `PERMISSION_DENIED` | The action exists but policy rejected it | The current role may not perform it | Change the policy or the requested operation |
| `ACTION_UNAVAILABLE` | A precondition is false | Disabled control, covered element, inactive region, failed `available()` | Fix the precondition or explain it to the model |
| `EXECUTION_FAILED` | The action ran but threw | Business function rejected the operation, network failure | Surface the real reason; do not report success |
| `EXPECTATION_FAILED` | The action ran but `expect` never became true | The UI did not update, or the expectation was wrong | Check the expectation and the actual page state |
| `HANDOFF_CANCELLED` | The user declined the handoff | The operator chose not to complete the step | Stop the task, or ask for a different route |
| `HANDOFF_TIMEOUT` | The handoff exceeded its timeout | The user did not finish in time | Extend the timeout only if the business allows it |
| `HANDOFF_FAILED` | The handoff was marked done but its expectation failed | The user reported completion before the result existed | Re-check the page and ask again |
| `STEP_FAILED` | A step inside a compound action failed | One step in `steps` returned an error | Report the failing step, not the whole flow as a generic failure |
| `HOOK_BLOCKED` | A lifecycle hook blocked the action | Policy hook rejected the call | Inspect the hook result |
| `LOOP_DETECTED` | The agent repeated the same tool call too often | A missing result, wrong expectation, or a loop in the page | Fix the page or stop the run |

## Runtime errors

| Code | Meaning | Typical cause |
| --- | --- | --- |
| `NOT_CONFIGURED` | The runtime has no usable model connection | Missing base URL, model, or key |
| `LLM_FAILED` | The model request failed | Network, CORS, gateway, authentication, or provider error |
| `SEND_FAILED` | The message could not be delivered to the runtime | The session was disposed or the request was cancelled |

`NOT_CONFIGURED` is a readiness issue, not a model failure. The UI should point to the missing field instead of showing a generic request error.

## Configuration diagnostics

These codes come from `resolveAgentConfig` and are rendered through `describePlingDiagnostic`:

| Code | Missing or invalid |
| --- | --- |
| `MODEL_BASE_URL_MISSING` | OpenAI-compatible base URL |
| `MODEL_NAME_MISSING` | Model name |
| `MODEL_API_KEY_MISSING` | API key, when the endpoint requires one |
| `LIMITS_INVALID` | `maxTurns`, context budget, reserve, compaction ratio, or recent-history size |
| `RETRY_INVALID` | Retry count or delays |

A relative base URL (`/llm/v1`) is valid when the application provides a same-origin proxy. It is not a missing value.

## Limits

| Setting | Default | Valid range or interaction |
| --- | --- | --- |
| `maxTurns` | 10 | At least 1; demo fixtures may set 100 |
| `contextTokens` | 8192 | At least 1024 |
| `reserveForOutput` | 1024 | At least 0; `contextTokens - reserveForOutput` must leave at least 1024 |
| `compactRatio` | 0.8 | Greater than 0 and at most 1 |
| `keepRecent` | 6 | At least 0 |
| `maxTokens` | 1024 | Per-response output budget |
| `minActionIntervalMs` | 0 | Delay between actions in one batch |

Demo fixtures set `maxTurns: 100` explicitly. The production default remains 10.

## Reading an error correctly

1. Read `code` first.
2. Read the raw `message` only as a secondary detail.
3. Look at the current snapshot: is the action registered, available, and in an active region?
4. For `EXPECTATION_FAILED`, compare the expected result with the actual page state; do not simply retry.
5. For `ACTION_NOT_FOUND`, check whether the page changed between snapshot and call.
6. For `LLM_FAILED`, check the gateway, CORS, credentials, and provider status before changing page declarations.

## Adapter behavior

All four adapters use the same executor and the same error codes. The UI may render the message differently:

| Adapter | Error surface |
| --- | --- |
| Vue 3 | `<AgentDock>`, `<AgentInline>`, `<AgentChat>`, debug inspector |
| React | `<AgentDock>`, `<AgentChat>` |
| Vanilla / jQuery | `pling.dock()` and session events |
| Vue 2.7 | shared `pling.dock()` |

Do not map codes to adapter-specific strings in business code. Use `describePlingError` with the active UI locale.

## Related pages

- Configuration: [Install and model configuration](/vue/installation-and-model-configuration), [Connect a model gateway](/operations/connect-a-model-gateway).
- Availability and regions: [Regions, visibility, and overlays](/vue/regions-visibility-and-overlays).
- Expectations: [Actions with input and verified results](/vue/actions-with-input-and-verified-results).
- Handoff: [Confirmation and human handoff](/vue/confirmation-and-human-handoff).
- Debug inspector: [Vue 3 adapter](/reference/vue-3-adapter), `packages/vue/src/components/AgentDebug.vue`, `examples/recipes/vue3`.

## Version and compatibility

| Item | Value |
| --- | --- |
| Applies to | Runtime and adapter error surfaces in `@plingjs/*` `0.1.0-alpha.3` |
| Introduced | `0.1.0-alpha.2` (first published alpha) |
| Runtime | Browsers with ES2022 modules; Node.js 20 or later for Node-side use |
| Peer dependencies | Those of the adapter being used |
| Stability | Pre-1.0 alpha; codes may be added, and an existing code's meaning is not silently changed |

The code strings and diagnostic fields on this page are the public contract for this version. A new code is an additive change; changing an existing code's category or meaning requires a documented breaking change.
