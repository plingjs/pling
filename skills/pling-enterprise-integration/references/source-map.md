# Pling Source Map

Use this map to find the smallest set of files that answers a concrete question.
Do not read the whole repository by default. Prefer current source and tests to
prose, and treat examples as compositions rather than protocol definitions.

## 1. Trust hierarchy

When sources disagree, use this order:

1. the target repository's `AGENTS.md` and explicit user instructions;
2. current source in `packages/`;
3. current tests in `packages/*/test/`;
4. published documentation in `website/` and package `README.md` files;
5. runnable examples in `examples/` and reference services in `services/`;
6. tutorial fixtures in `examples/tutorials/`, which are teaching compositions
   rather than normative API definitions.

The framework implementation is in `packages/`; `website/` is the public
documentation surface, `examples/` is the public teaching surface, and
`services/` contains runnable reference services. Never copy framework files
into an application.

## 2. Reading order by task

| Task | Read in this order |
| --- | --- |
| Understand the overall model | `website/concepts/how-pling-works.md` → `packages/core/README.md` → `packages/core/src/types.ts` |
| Add an in-page assistant | `website/operations/add-the-assistant-ui.md` → the adapter README → the matching recipe/tutorial → adapter tests |
| Design a capability manifest | `skills/retrofit-pling/SKILL.md` → `website/surface/designing-safe-capabilities.md` → `examples/demos/quickstart/README.md` → create the provisional manifest in the target repository |
| Expose external capabilities | `website/surface/surface-basics-describe-and-invoke.md` → `packages/surface/README.md` → `packages/surface/src/types.ts` → `packages/surface/test/surface.test.ts` |
| Add a hosted page connection | `packages/surface-browser/README.md` → `packages/surface-browser/src/{surface,transport,bridge,gateway}.ts` → `packages/vue/src/surface-gateway.ts` |
| Authenticate page sessions | `examples/apps/todo-surface-auth/README.md` → its `server/` files → its browser client |
| Develop or change a Gateway | `services/surface-gateway/README.md` → `src/gateway.mjs` → `src/server.mjs` → `src/mcp.mjs` → `test/` |
| Harden for production | `website/operations/deploy-to-production.md` → `website/surface/threat-model-and-legal-boundaries.md` → `website/concepts/sensitive-data-and-trust-boundaries.md` → `examples/apps/todo-surface-auth/` |
| Release packages | `CONTRIBUTING.md` → `scripts/check-release.mjs` → `scripts/pack-smoke.mjs` |

## 3. Package map

| Package | Responsibility | Start with | Important tests |
| --- | --- | --- | --- |
| `@plingjs/core` | Framework-neutral registry, policy, execution, evidence, records, state, flows | `src/types.ts`, `src/registry.ts`, `src/executor.ts`, `src/policy.ts` | `test/core.test.ts`, `evidence.test.ts`, `flow.test.ts`, `state.test.ts` |
| `@plingjs/ui` | Locale catalogs, translations, theme tokens | `packages/ui/README.md`, `src/index.ts` | `packages/ui/test/` |
| `@plingjs/dom` | Framework-neutral DOM targeting, scope visibility, projection, primitives | `src/index.ts`, scope/target modules | `packages/dom/test/` |
| `@plingjs/vue` | Vue 3 directives, composables, assistant UI, Surface lifecycle | `src/index.ts`, `directive.ts`, `tools.ts`, `surface-gateway.ts` | `test/tools.test.ts`, `surface-gateway.test.ts`, `records.test.ts`, `state.test.ts` |
| `@plingjs/react` | React provider, ref declarations, hooks, assistant UI | `src/index.ts`, `pling.ts`, `tools.ts`, `context.tsx` | `test/react-adapter.test.tsx`, `records-scopes.test.tsx`, `state.test.tsx` |
| `@plingjs/vanilla` | DOM-first declarations and dock | `src/pling.ts`, `src/tool.ts`, `src/record.ts`, `src/scope.ts` | `test/adapter.test.ts`, `dock.test.ts` |
| `@plingjs/vue2` | Vue 2.7 adapter over the shared DOM runtime | `src/index.ts`, `src/pling.ts`, `src/state.ts` | `packages/vue2/test/` |
| `@plingjs/agent` | Framework-neutral session loop, context, protocol, confirmation, hooks, trace | `packages/agent/README.md`, `src/loop.ts`, `src/protocol.ts` | `packages/agent/test/` |
| `@plingjs/surface` | Surface protocol kernel: projection, describe, invoke, session scope | `src/types.ts`, `src/surface.ts` | `test/surface.test.ts` |
| `@plingjs/surface-browser` | Browser session, transport, bridge, reconnect, approval forwarding | `src/surface.ts`, `src/transport.ts`, `src/bridge.ts` | `test/bridge.test.ts`, `transport.test.ts`, `gateway.test.ts` |
| `@plingjs/surface-gateway` | Reference multi-tenant transport/control plane and MCP endpoint | `services/surface-gateway/src/{gateway,server,mcp}.mjs` | `services/surface-gateway/test/` |
| `@plingjs/delegation` | Delegation credential ports and Web handlers | `packages/delegation/README.md`, `src/index.ts` | `packages/delegation/test/` |
| `@plingjs/continuity-http` | Cross-device continuity HTTP authority/handler | `packages/continuity-http/README.md` | `packages/continuity-http/test/` |
| `@plingjs/server` | Thin model proxy, auth hook, model allowlist, audit | `packages/server/README.md`, `src/index.ts` | `packages/server/test/` |

## 4. Core behavior map

Use these files when you need to know what the executor actually guarantees.

| File | What it decides |
| --- | --- |
| `packages/core/src/registry.ts` | Declaration lifecycle, duplicate ids, snapshot projection, namespaces |
| `packages/core/src/executor.ts` | Resolve → parse → policy → validate → availability → execute → observe |
| `packages/core/src/policy.ts` | Risk defaults, confirmation decision, fail-closed behavior |
| `packages/core/src/primitives.ts` | Fixed primitive vocabulary and kind floors |
| `packages/core/src/types.ts` | `Binding`, `ActionDescriptor`, params, handoff, expectations, public contracts |
| `packages/core/src/state.ts` | Bounded read-only serialization and sensitive-value handling |
| `packages/core/src/record.ts` | Record identity and minimal field projection |
| `packages/core/src/flow.ts` | Multi-step actions as one tool, risk aggregation, step reports |
| `packages/core/src/diff.ts` | Snapshot diffs used as change evidence |
| `packages/core/src/errors.ts` | Stable error codes and structured failures |

Two details are easy to miss:

- a primitive has a minimum `Kind`; for example, `click` is at least `write`, and
  an omitted `kind` remains fail-closed;
- declared state and records are read-only projections. Writing back to the
  application must go through an action so policy, confirmation, and evidence
  still apply.

## 5. Adapter map

### Vue 3

- `packages/vue/src/directive.ts`: runtime creation, options, and `usePling`.
- `packages/vue/src/directive.ts`: `v-tool`, `v-scope`, `v-record` wiring.
- `packages/vue/src/tools.ts`: `useAgentTool` function tools.
- `packages/vue/src/state.ts`: `useAgentState` and store allowlists.
- `packages/vue/src/surface-gateway.ts`: BFF/public-demo Surface lifecycle.
- `packages/vue/src/components/AgentDock.vue`: assistant entry and Activity view.
- Real composition: `examples/demos/quickstart/src/`, `examples/demos/orders/src/`,
  and `examples/apps/todo-surface-auth/src/`.

### React

- `packages/react/src/pling.ts`: runtime creation.
- `packages/react/src/context.tsx`: provider and context.
- `packages/react/src/tools.ts`: `usePlingTool` and `useAgentTool`.
- `packages/react/src/{scope,record,state}.ts`: ref-based declarations.
- `packages/react/src/AgentDock.tsx`: assistant entry.
- Real composition: `examples/recipes/react/src/`.

### Vanilla and legacy frameworks

- `packages/vanilla/src/pling.ts`: public surface.
- `packages/vanilla/src/{tool,record,scope,state}.ts`: explicit DOM declarations.
- `packages/vanilla/src/dock.ts`: dock lifecycle.
- Real composition: `examples/recipes/vanilla/src/` and
  `examples/tutorials/j-*`.
- Vue 2.7 adapter: `packages/vue2/README.md`; Vue 2.6 and earlier should use the
  vanilla manual path rather than a Vue 3 Composition API dependency.

## 6. Surface protocol map

| File | Read it for |
| --- | --- |
| `packages/surface/src/types.ts` | `SURFACE_PROTOCOL`, `SurfaceSession`, `SurfaceExpose`, capability/approval wire types, rate-limit ports |
| `packages/surface/src/surface.ts` | `describe` / `invoke`, scope intersection, approval flow, record windows, replay and audit hooks |
| `packages/surface/test/surface.test.ts` | Exact behavior for excluded ids, session expiry/revocation, scope matching, approval refusal |
| `website/surface/threat-model-and-legal-boundaries.md` | Security boundary, non-goals, and legal limits |
| `website/surface/deploy-a-surface-gateway.md` | Deployment topology, identity, audit, approval, replay, and rate limiting |

The protocol kernel has no transport, Cookie parser, login flow, or second
permission engine. Do not put any of those in `@plingjs/surface`.

## 7. Surface Gateway map

| File | Responsibility |
| --- | --- |
| `services/surface-gateway/src/gateway.mjs` | Tenant/session state machine, pairing, scope checks, request forwarding, expiry/revocation, audit callbacks |
| `services/surface-gateway/src/server.mjs` | HTTP routes, WebSocket upgrade, CORS/Origin checks, bearer extraction, MCP route |
| `services/surface-gateway/src/mcp.mjs` | MCP handshake and exactly three tools: describe, invoke, approval status |
| `services/surface-gateway/src/config.mjs` | Tenant/origin/TTL/public-demo validation |
| `services/surface-gateway/src/index.mjs` | Environment variables, startup, and shutdown |
| `services/surface-gateway/test/gateway.test.mjs` | Pairing, session limits, scope, revocation, expiry |
| `services/surface-gateway/test/transport.test.mjs` | HTTP/WS/CORS/rate-limit behavior |
| `services/surface-gateway/test/mcp.test.mjs` | Tool list, invoke, pending approval, no approval tool |
| `services/surface-gateway/README.md` | Supported deployment boundary, routes, MCP tools, and operational limits |

Read `gateway.mjs` before changing routes or scope behavior. Read `server.mjs`
before changing CORS, WebSocket, token extraction, or HTTP status mapping. Do
not duplicate protocol logic in a proxy or BFF; the Gateway forwards envelopes.

## 8. Example map

| Example | Use it to learn |
| --- | --- |
| `examples/demos/quickstart/` | Smallest complete Vue page: scope, records, actions, state, assistant dock |
| `examples/demos/orders/` | Business queue, dialog scope, dangerous-action confirmation, record-specific actions |
| `examples/tutorials/v3-22-migrating-an-existing-vue-app/` | Incremental retrofit of an ordinary Vue page with a baseline and a small integration boundary |
| `examples/apps/todo-surface-auth/` | Email login, protected todos, BFF-created page sessions, Gateway, pairing, session isolation |
| `examples/demos/external-agent-surface/` | External Agent inspector, local MCP facade, hosted Gateway path, Codex setup |
| `examples/demos/recipe-mcp/` | Local stdio MCP facade and loopback transport |
| `examples/tutorials/` | Framework-specific teaching fixtures with documented checkpoints |

Treat examples as evidence of composition, not as a second protocol
implementation. If an example and current source disagree, verify the contract
against `packages/` and its tests, then fix the example drift separately from
the application retrofit.

## 9. Fast inspection commands

Use text search to locate the true implementation before reading a full file:

```bash
rg -n "createSurface\(|useSurfaceGateway\(|expose:" packages examples services --glob '!**/dist/**'
rg -n "v1/page-sessions|v1/pairings|agent-sessions|/mcp|/surface" services/surface-gateway examples
rg -n "CAPABILITY_NOT_EXPOSED|SCOPE_NOT_ALLOWED|pending_approval|approval" packages/surface services/surface-gateway
rg -n "useAgentTool|usePlingTool|pling\\.tool|useAgentState|usePlingState" packages examples
```

Run focused tests before the whole workspace:

```bash
pnpm --filter @plingjs/surface test
pnpm --filter @plingjs/surface-browser test
pnpm --filter @plingjs/surface-gateway test
pnpm --filter @plingjs/vue test
pnpm --filter @plingjs/react test
```

## 10. Facts not to infer

- `namespace` changes the effective id. Surface allowlists and deployment configs
  must use the fully qualified id.
- `@plingjs/surface` does not add a generic DOM action or approve on behalf of a
  human.
- Page sessions and Agent sessions are different credentials with different
  scopes and lifetimes.
- The Gateway reference implementation allows one active Agent session per page
  session; open a separate page/session for concurrent Agents.
- Gateway pairing codes are single-use and short-lived by default.
- The reference Gateway stores sessions and pending requests in process memory.
  A restart loses them; it is not a production system of record.
- `public-demo` page-session creation is for hosted demos. Production uses an
  authenticated BFF with the admin token on the server.
- Existing application authorization still runs on the business operation; a
  declared Pling capability is not an authorization bypass.

