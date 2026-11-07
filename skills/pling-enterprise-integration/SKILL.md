---
name: pling-enterprise-integration
description: Plan, implement, review, or operate a production Pling integration for an existing application, including adapter integration, capability declarations, Surface exposure, authenticated BFF page sessions, and a self-hosted Surface Gateway. Use for enterprise retrofits, MCP Agent access, gateway hardening, or deployment decisions. Use retrofit-pling for a narrow code-retrofit plan and pling-local-mcp-facade for a local-only bridge.
---

# Pling Enterprise Integration

Use this skill when an application must become operable by an in-page assistant
or by an external MCP-capable Agent, especially when the work crosses
authentication, deployment, tenancy, or audit boundaries.

This is an implementation and review skill. It does not imply permission to
connect to production, spend model credits, widen access, deploy, or change
authorization. The successful outcome is a small capability contract, a runnable
integration, an explicit external allowlist, and evidence that every layer
enforces the same boundary.

## Integration levels

| Level | Use when | Add | Do not add |
| --- | --- | --- | --- |
| In-page assistant | A signed-in user needs help operating the page | Adapter, declarations, model proxy, assistant UI | Surface Gateway |
| Local external Agent | Agent and browser are on one machine | `@plingjs/surface` + local MCP facade | Public gateway |
| Hosted external Agent | Agent and page are on different machines | `@plingjs/surface-browser`, authenticated BFF, Surface Gateway, MCP | Admin token in browser |
| Enterprise control plane | Multi-tenant, durable audit, SSO, shared limits | Gateway/control-plane adapter, persistent stores, operational controls | Default in-memory gateway as production storage |

For a local-only MCP bridge, follow
`skills/pling-local-mcp-facade/SKILL.md`. For a narrow retrofit without external
Surface access, follow `skills/retrofit-pling/SKILL.md`; this skill covers the
larger architecture around it.

## Non-negotiable invariants

1. **The application remains the execution and authorization authority.** Pling
   projects declared capability; it does not move business logic, user
   permission, or final approval into the Agent.
2. **Only explicitly declared capabilities exist.** Never add a generic
   `click(selector)`, `eval`, raw DOM script, or synthetic event escape hatch.
3. **One business operation, one capability.** A multi-step UI flow may be one
   function tool, but it must not become several unrelated Agent steps when the
   operator thinks in one operation.
4. **Ids are contracts.** Use stable, namespaced ids. The same fully qualified
   id must appear in the page declaration, capability manifest, Surface
   allowlist, tests, and audit; any deployment config that narrows scope (for
   example public-demo config) must use the same id.
5. **Records and state are allowlists.** Expose the minimum fields that explain
   identity, choice, and verification. Never dump a store, component instance,
   API response, token, or entire form model into the Agent context.
6. **Risk labels must be truthful.** `danger` needs a human confirmation path;
   an action whose effect cannot be observed needs an explicit `expect` or a
   truthful unavailable/unknown result.
7. **Every Surface layer intersects scope.** Page `expose`, verified page
   session scope, and Agent session scope must all allow the capability; a
   deployment/public-demo policy may seed the page scope. Adding a broader
   upstream scope never widens a narrower one, and the business backend still
   performs final authorization.
8. **The Agent cannot approve its own action.** Expose approval status, never an
   approval/confirm tool. The trusted page UI or business backend approves.
9. **Secrets do not cross trust zones.** Provider keys, cookies, admin tokens,
   page tokens, and Agent tokens are different credentials. None belongs in a
   model message, tool argument, audit payload, URL shown to another user, or
   committed config.
10. **The reference Gateway is not a production control plane.** Its default
    stores are in memory. Durable sessions, audit, shared limits, SSO, and
    tenant isolation require an enterprise adapter and deployment review.

## Read before editing

Read the target repository's own `AGENTS.md`, package scripts, auth setup, and
working-tree state first. In this repository, also read `AGENTS.md` and the
following sources according to the task:

| Need | Read first | Then |
| --- | --- | --- |
| Repository map and package responsibilities | `references/source-map.md` | `packages/core/README.md`, `website/concepts/how-pling-works.md` |
| Adapter and declaration work | `references/integration-playbook.md` | `website/operations/add-the-assistant-ui.md`, the adapter reference, real examples |
| External Surface and BFF | `references/surface-gateway.md` | `packages/surface/README.md`, `packages/surface-browser/README.md` |
| Gateway development and operations | `references/surface-gateway.md` | `services/surface-gateway/README.md`, `website/surface/deploy-a-surface-gateway.md` |
| Production hardening and acceptance | `references/production-and-verification.md` | `website/operations/deploy-to-production.md`, `website/surface/threat-model-and-legal-boundaries.md`, `website/concepts/sensitive-data-and-trust-boundaries.md` |
| Retrofit examples | `examples/demos/quickstart/README.md`, `examples/tutorials/v3-22-migrating-an-existing-vue-app/README.md` | corresponding `src/`, manifests, and tests |
| Authenticated BFF evidence | `examples/apps/todo-surface-auth/README.md` | `server/`, `src/`, and tests |
| External MCP evidence | `examples/demos/external-agent-surface/README.md` | `src/surface.ts`, Gateway guide, smoke tests |

Source and tests define exact current behavior. Examples demonstrate a working
composition. Design documents explain intent and production boundaries. If they
disagree, report the drift and verify against code before changing anything.

## Workflow

### 0. Establish scope and authority

Identify:

- the application, frameworks, build tool, router, auth model, and deployment;
- the operator, the business operation, and the business decision being
  assisted;
- whether the Agent runs in-page, locally, or remotely;
- which data is sensitive, regulated, irreversible, or externally visible;
- what the user has explicitly authorized now versus what needs a later approval.

For production access, deployments, database changes, secret changes, public
exposure, or scope expansion, stop before the mutating step and obtain a clear
go-ahead. A general request to "integrate Pling" is not approval to publish a
Gateway or create external sessions.

### 1. Prove the baseline

Run the existing typecheck, tests, build, and one browser smoke test **before**
adding Pling. Record unrelated failures instead of silently fixing them. Keep a
baseline entry point or git rollback point. The first deliverable is proof that
the application still works without Pling.

### 2. Inventory capabilities without changing behavior

Map the application into:

- regions and dialogs that explain page structure;
- actions and the business operation behind each;
- records that identify rows or entities;
- read-only state that explains the current view;
- sensitive data and operations that must remain unavailable.

Produce a human-reviewable capability manifest before editing templates. Use
`references/integration-playbook.md` for the schema and review questions. A
scanner may propose entries; it must not silently rewrite the application.

### 3. Integrate in slices

Choose the smallest adapter that preserves the application architecture:

- Vue 3: `@plingjs/vue`;
- React: `@plingjs/react`;
- Vanilla / jQuery / Vue 2.6 or earlier: `@plingjs/vanilla`;
- Vue 2.7: `@plingjs/vue2`.

Add one slice at a time: runtime/namespace, regions, records and bounded state,
low-risk actions, business actions, danger confirmation, assistant, then Surface.
After each slice, run the focused tests and a real browser smoke test.

Prefer function tools for business operations that have no single button. Use
element tools only when the original element is the real action. Preserve manual
UI behavior; Pling should not become a second application implementation.

### 4. Expose a narrowed Surface

Start with one useful read capability and one low-risk write capability. Use
fully qualified ids and document the intersection:

```text
page expose  ∩  verified SurfaceSession.scope  ∩  Agent session scope
```

Do not expose approval, deletion, permission changes, bulk destructive actions,
or sensitive records merely because they exist. Add a test that compares the
page allowlist, deployment config, and manifest. An Agent guessing an excluded
id must receive a scope/not-found style failure without executing it.

### 5. Add BFF authentication and Gateway transport for hosted access

The production path is:

```text
Agent runtime
  → HTTPS MCP with Agent bearer token
  → Surface Gateway
  → WebSocket with page token
  → business page and existing Pling executor
  → application backend and existing authorization
```

The application backend authenticates the user, narrows the page scope, and
calls `POST /v1/page-sessions` with the Gateway admin token **server-side**. The
page receives only its short-lived page session. The Agent receives a separate
Agent token after pairing. Never return the admin token to the browser.

Use `references/surface-gateway.md` for request payloads, configuration,
revocation, MCP registration, and failure handling.

### 6. Harden and verify

At minimum, prove:

- the baseline still works with Pling absent;
- undeclared controls are absent from `describe`;
- ids, records, state, and unavailable reasons are stable;
- business writes produce observable change evidence;
- danger actions cannot proceed without trusted human approval;
- excluded ids fail closed after a guessed invocation;
- BFF routes require the application session;
- page, Agent, and admin tokens are not confusable or leaked;
- scope intersection holds at page, page-session, and Agent layers, with any
  public-demo/deployment policy folded into the page-session scope;
- expiry, revocation, reconnect, and disconnect fail safely;
- the Gateway is not relying on its in-memory stores for production;
- audit and logs contain metadata, not secrets or raw sensitive values.

Use `references/production-and-verification.md` for the complete matrix.

### 7. Leave an operable handoff

Deliver:

- baseline and integrated runnable states;
- capability manifest with owners and review decisions;
- environment/config example with placeholders, never real secrets;
- BFF and page-session contract;
- Gateway deployment and rollback notes;
- tests for declarations, authorization, scope, approval, and secrets;
- a change map explaining where to add the next capability;
- known limits and explicit non-goals.

## Stop conditions

Stop and request review before:

- adding or widening external access;
- exposing deletion, approval, refund, transfer, permission, identity, payment,
  health, financial, or other high-impact operations;
- changing authentication, authorization, tenancy, or session lifetime;
- adding a database migration, persistent store, queue, or shared cache;
- putting a secret into code, browser configuration, logs, or an Agent tool;
- deploying, rotating credentials, or connecting to a live customer system;
- changing the business semantics of an operation only to make the Agent work;
- continuing after tests fail for an unrelated reason and independence cannot be
  demonstrated.

## Using this skill from another Agent

Codex, Claude, WorkBuddy, Hermes, and other coding Agents should:

1. load this file and only the references needed for the current phase;
2. inspect the target repository rather than assuming the examples apply;
3. state the chosen integration level and trust boundary before editing;
4. present the capability contract and risky diffs for human review;
5. keep edits surgical and run the repository's own verification commands.

Do not copy framework implementation into the target application. Integrate the
published packages. Do not invent another Agent's MCP configuration format;
locate that product's actual configuration and preserve existing entries.

## Copy-ready handoff

When handing this work to another coding Agent, start with a brief like this:

> Work on `<target repository>`. Use `pling-enterprise-integration`. First read
> the target repository's `AGENTS.md`, then read `SKILL.md` and only the
> reference for the current phase (`source-map.md`, `integration-playbook.md`,
> `surface-gateway.md`, or `production-and-verification.md`). State the chosen
> integration level and trust boundary before editing. Inspect the current
> `packages/` source and tests; use `website/` and `examples/` as teaching
> references, not as a substitute for current source. Produce a capability
> manifest for review before changing templates. Do
> not add a generic `click(selector)`, `eval`, approval tool, whole-store state
> dump, or external scope wider than the reviewed allowlist. Run the target
> repository's baseline checks first, then focused tests after each slice, and
> report files changed, commands run, unresolved risks, and rollback notes.

For a read-only architecture review, replace the editing instruction with:
“Do not modify files; produce a source map, trust-boundary diagram, capability
gaps, and a prioritized implementation plan.” This keeps source inspection
separate from a production-changing retrofit.

