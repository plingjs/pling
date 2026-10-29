---
id: J-14
title: "Expose selected capabilities to external agents"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Expose selected capabilities to external agents

The assistant inside a page and an external agent should not need two implementations of the same business operation. Both can use the page's existing action executor. What differs is discovery and transport: an external client needs a bounded description of what this site exposes and a protocol boundary through which it can invoke those operations.

Agent Surface is that boundary. It is not a second action system, and it is not a browser-automation escape hatch. It publishes a selected set of already declared actions and sends each invocation through the same availability, confirmation, expectation, and result path used by the page assistant.

## Start from the page, not the protocol

The example page has three useful business operations:

- `todo.overview` reads the queue counts.
- `todo.add` adds one task with bounded text input.
- `todo.clear_completed` removes completed tasks and requires confirmation.

The page also has row-level completion controls, but they are not part of the external allowlist. The external surface is deliberately smaller than the page. This is a product and security decision, not an omission.

```ts
export const EXTERNAL_SCOPE = [
  "todo.overview",
  "todo.add",
  "todo.clear_completed",
] as const;
```

Capability ids should describe business intent and stay stable across rendering changes. A selector, row position, or localized button label is not a stable capability name.

## Reuse the executor

The Surface kernel receives a projection of the registry and an execution function:

```ts
const executor = createExecutor({
  registry,
  policy: createPolicy(confirm),
  settle: defaultSettle,
});

const surface = createSurface({
  registry,
  execute: (id, args) => executor.execute(id, args),
  app: "tutorial-support-queue",
  expose: EXTERNAL_SCOPE,
  session,
  recordLimit: 2,
});
```

This arrangement keeps execution in one place. The external call does not click a DOM element, call a private handler, or bypass the confirmation policy. If the page action is unavailable, the same availability reason applies. If its result fails, the executor returns the same error.

## Describe must be narrow

An external client first calls `describe`. The response contains the protocol version, application name, allowed capabilities, and a bounded context window.

```ts
const response = await surface.handle({
  protocol: SURFACE_PROTOCOL,
  id: "req_01",
  method: "describe",
  input: { limit: 2 },
});
```

The example publishes only the three allowlisted capability ids and returns two records even though the page contains three. `recordLimit` and the requested limit keep context cost explicit. A larger list needs pagination or a search action; the protocol should not serialize an unbounded table merely because it exists in the page.

The description is generated from the live registry. It does not serialize internal handlers, DOM selectors, session cookies, or unrelated business state.

## Invoke returns two kinds of failure

An invocation can fail before reaching the action because the capability is not exposed:

```ts
{
  ok: false,
  error: { code: "CAPABILITY_NOT_EXPOSED", message: "..." }
}
```

Or the protocol exchange can succeed while the business action fails:

```ts
{
  ok: true,
  result: {
    error: { code: "PERMISSION_DENIED", message: "..." }
  }
}
```

Clients must handle both. Checking only `response.ok` would report a denied write as a successful protocol call.

The example tests an unexposed row action directly. It is rejected before the executor, and the task remains unchanged. That fail-closed boundary is what makes the allowlist meaningful.

## Keep confirmation in the page

`todo.clear_completed` is destructive and declared with `confirm: "always"`. When an external client invokes it, the executor opens the page-side confirmation channel and waits.

The external client cannot approve its own request. A person sees the pending action in the page and decides. If denied, the protocol exchange completes with `PERMISSION_DENIED`; if approved, the existing business handler runs once.

```ts
const pending = surface.handle({
  protocol: SURFACE_PROTOCOL,
  id: "req_02",
  method: "invoke",
  capability: "todo.clear_completed",
});

// The page renders the approval decision.
const result = await pending;
```

This is also why the approval UI belongs to the application, not to the external agent's console. The client may display progress, but the trusted decision surface remains with the signed-in page.

## Identity and transport sit outside the kernel

The `session` passed to Surface is already verified. It contains the agent id, session id, user id, expiry, and the session's capability scope. It does not contain a password, cookie, OAuth token, or provider key.

A deployment still needs a transport adapter to:

- authenticate the user and the external agent;
- validate origin and request size;
- create, expire, and revoke the delegated session;
- apply rate limits and replay protection;
- attach request ids and deliver audit records.

HTTP, an MCP facade, and a postMessage bridge can all carry the same `describe` and `invoke` envelope. They should not reimplement capability filtering or confirmation.

## Run the example

```bash
pnpm tutorial:dev j-14
```

Open `http://127.0.0.1:5279/?lang=en`, or use `--locale zh` and open `http://127.0.0.1:5279/?lang=zh`. The right-hand console calls only `surface.handle()`. It can describe the capability set, add a task, and request removal of completed tasks.

```bash
pnpm tutorial:check j-14
```

The check covers the capability allowlist, bounded records, a successful write, an unexposed action, denial, approval, and removal of the row's remaining declarations.

## Common mistakes

**Publishing every registered action.** The external surface should be a smaller, intentional product interface. A page may offer dozens of controls while exposing three operations.

**Treating a synchronous function as authenticated.** A session object is data. The transport must verify the caller before Surface receives it.

**Adding a generic click or script method.** That turns the surface back into browser automation and makes the allowlist ineffective.

**Showing approval in the external client.** A client that can approve its own destructive request has not added a meaningful human check.

**Returning the entire page snapshot.** Context should be bounded, deterministic, and limited to what the capability needs.

Return to the [Vanilla and jQuery overview](/vanilla/) or read the [Agent Surface introduction](/surface/).
