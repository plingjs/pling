---
id: V3-23
title: "Exposing selected capabilities to external agents"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Exposing selected capabilities to external agents

An in-page assistant and an external agent have different lifecycles. The page assistant belongs to the application and shares its session. An external agent may be another process, another browser, or a tool the user already trusts. It should not receive the page's DOM, component state, or internal event handlers.

Surface provides a narrower contract over the capability model the page already has. An external client can discover a selected set of actions and invoke them. Execution still goes through the page's registry, policy, and confirmation path.

The example runs the protocol client in the same page so the traffic is visible. That client is an inspector of the same protocol a separate process would use; it is not a network boundary. The transport and identity layers are discussed after the protocol path.

The full path has several layers. The example implements the middle three; the transport is added at deployment:

```text
external client
  │ describe / invoke
  ▼
transport: origin checks, identity, rate limits, replay protection
  ▼
Surface: site allowlist and session scope
  ▼
executor: availability, arguments, confirmation, expectations
  ▼
existing page actions
```

## Build one Surface from the existing capability registry

The allowlist contains three actions:

```ts
export const EXTERNAL_SCOPE = [
  "todo.overview",
  "todo.add",
  "todo.clear_completed",
] as const satisfies SurfaceExpose;
```

Those actions are already registered with the page. Surface does not copy their implementations. It receives the same registry, builds a second executor from the same policy, and confines every invocation to the allowlist:

```ts
export function createTodoSurface(
  registry: Registry,
  confirm: Confirm,
  sessionScope: SurfaceExpose = EXTERNAL_SCOPE,
) {
  const executor = createExecutor({
    registry,
    policy: createPolicy(confirm),
    settle: defaultSettle,
  });

  const surface = createSurface({
    registry,
    execute: (id, args) => executor.execute(id, args),
    app: "tutorial-todo-surface",
    expose: EXTERNAL_SCOPE,
    session: {
      agentId: "demo-external-agent",
      sessionId: "demo-session",
      userId: "demo-user",
      expiresAt: Date.now() + 60 * 60_000,
      scope: sessionScope,
    },
    recordLimit: 2,
  });

  return { executor, surface };
}
```

`expose` is the site-level ceiling. A session carries its own scope, and the effective set is their intersection. The fixed session here is only for the demo. In production it must come from a verified transport or backend boundary, never from a field the client can edit.

The page calls `createTodoSurface` from `setup` with `usePling().registry` and its confirmation function, then passes the returned `surface` to the external console:

```ts
const pling = usePling();
const approval = createApproval();
const { surface } = createTodoSurface(pling.registry, approval.confirm);
```

Here, `createApproval` belongs to the example fixture; it is not a general framework export. The console holds only `surface`; it does not receive the component's task array. The example uses this separate approval path to make the external flow visible. A product with an existing confirmation component can pass the same `Confirm` to both the page assistant and Surface. The essential rule is that confirmation stays on the page side and is never delegated to the external client.

The second executor matters for the same reason: Surface does not call a handler directly. It uses the same availability rules, argument validation, confirmation policy, expectation checks, and change evidence as the page assistant. It does not reuse the page assistant's in-memory executor object; it constructs an equivalent execution path from the same registry and policy.

## Read a projection with `describe`

The external client sends a protocol envelope:

```ts
const response = await surface.handle({
  protocol: SURFACE_PROTOCOL,
  id: "req_01",
  method: "describe",
  input: { limit: 2 },
});
```

With three Todo records and `recordLimit: 2`, the result separates identification from full field data:

- `context.records` contains two records with their fields;
- `context.recordIds` still lists all three record ids;
- `context.recordWindow` reports the current page, the total, and the next offset.

This is useful for long lists. A client can identify the current working set, then request fields for one record by id. The limit applies to field data, not to the client's ability to name a record.

`describe` also returns the protocol version, application name, and the allowlisted capabilities with their schemas, effects, and approval policy. Row deletion and toggling exist in the page, but they are absent from this projection. The external contract is a product decision, not a dump of the registry.

The description is read from the live registry on each call. Internal handlers, selectors, and unrelated state are not serialised.

## Invoke a capability through the policy path

An invocation names a capability from the description and supplies its input:

```ts
const result = await surface.handle({
  protocol: SURFACE_PROTOCOL,
  id: "req_02",
  method: "invoke",
  capability: "todo.add",
  input: { text: "Follow up with the external agent" },
});
```

Surface checks the request, the site allowlist, the session scope, and replay protection before execution. The executor then performs the same checks a page action would: availability, arguments, confirmation, expectation, and evidence. Surface itself never looks up a DOM element or writes business state.

There are two different failure shapes, and a client must handle both.

An unexposed capability is a protocol failure:

```ts
{
  protocol: "pling.surface/0.1",
  id: "req_03",
  ok: false,
  error: { code: "CAPABILITY_NOT_EXPOSED", message: "..." }
}
```

A valid invocation that the page refuses is a successful protocol exchange with a failed action result:

```ts
{
  protocol: "pling.surface/0.1",
  id: "req_04",
  ok: true,
  result: {
    error: { code: "PERMISSION_DENIED", message: "..." }
  }
}
```

The difference is deliberate. `CAPABILITY_NOT_EXPOSED` means the request never reached the business action. `PERMISSION_DENIED` means the action existed and was rejected by policy or a person. A client that checks only `response.ok` will report a denied write as success.

There is no `click(selector)`, `eval(script)`, or arbitrary JavaScript method. Adding one would turn the capability contract back into browser automation and make the allowlist unenforceable.

## Keep approval on the page

`todo.clear_completed` is destructive and declared with `confirm: "always"`. When the external client invokes it, the executor opens the page-side confirmation channel and waits.

The person using the page sees the pending request. If they reject it, the protocol call returns `ok: true` with `result.error.code === "PERMISSION_DENIED"` and the tasks stay unchanged. If they approve it, the same business handler runs and the response reports the execution result.

This keeps the important properties:

- the external agent cannot approve its own destructive action;
- approval is tied to the current page session and action;
- the page assistant and external client follow the same policy semantics, with page-side confirmation surfaces;
- the completion evidence comes from business state, not the model's final sentence.

Passwords, cookies, provider keys, and approval tokens do not belong in a Surface response. A real transport should keep those at its own boundary and pass only a verified session identity to the protocol kernel.

## Put transport and authentication outside Surface

The example calls `surface.handle()` in the same page, so there is no network trust boundary. A deployment still needs a transport: HTTP and SSE, a postMessage bridge, an MCP facade, or another host channel.

That layer is responsible for:

- origin checks and CORS policy;
- authenticating the user and the agent;
- creating, expiring, and revoking sessions;
- rate limits, replay protection, and request size limits;
- correlation ids and audit delivery.

Surface handles capability projection and the `describe` / `invoke` boundary. It does not listen on a port or invent a second permission system. Keeping that split lets the same page capabilities serve an in-page assistant, a coding agent, or a future system agent without duplicating business logic.

## Run the example

Run the English example:

```bash
pnpm tutorial:dev v3-23
```

Open `http://127.0.0.1:5236/`. For Chinese, run:

```bash
pnpm tutorial:dev v3-23 --locale zh
```

Open `http://127.0.0.1:5236/?lang=zh`.

The right-hand console is a local protocol client. It can describe the surface, add a task through `todo.add`, attempt an unexposed row deletion, and start the destructive clear flow. The approval dialog is rendered by the page, not by that console.

Run the deterministic check:

```bash
pnpm tutorial:check v3-23
```

It verifies the allowlist, protocol version, bounded record window, fail-closed handling for unexposed capabilities, session-scope intersection, and both denied and approved confirmation paths.

## Failure modes

**Publishing every registered action.** `expose` is a product decision. The external surface is usually narrower than the page assistant and can evolve separately.

**Treating a session object as identity verification.** A client can send any object. The transport must verify identity before Surface sees it.

**Exposing generic DOM operations.** If a method accepts an arbitrary selector or script, the allowlist protects nothing. Publish business capabilities.

**Putting approval in the external client.** If the client can approve its own high-risk request, the page-side gate is decorative. Keep the confirmation channel inside the trusted application boundary.

**Logging full inputs and responses.** Audit metadata should contain the session, capability, result, and request id, not a copy of sensitive page data.
