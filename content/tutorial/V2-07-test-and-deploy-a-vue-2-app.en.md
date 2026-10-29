---
id: V2-07
title: "Test and deploy a Vue 2 app"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Test and deploy a Vue 2 app

A Vue 2 integration is ready to deploy when the business paths still work without a model, the declared paths work deterministically, and the production build contains no provider credential. The assistant is not a substitute for those checks.

## Separate deterministic tests from model tests

Use `createReplayLlm([])` when a test exercises the registry, executor, and Vue handlers directly:

```ts
const app = mountRecordsApp(host, {
  agent: { llm: createReplayLlm([]) },
  presence: false,
  onWarn: () => {},
});

const executor = createExecutor({
  registry: app.pling.registry,
  policy: createPolicy(async () => true),
});
```

This test does not need network access. It answers questions such as:

- Does a row action resolve to the intended record?
- Does filling an input reach the original Vue handler?
- Does a dialog remove its actions when it closes?
- Does a failed precondition leave the page unchanged?

Keep a separate, explicitly configured test for a real model or gateway. Do not make the normal CI suite depend on model availability, prompt wording, or a provider account.

## Test the integration contract

The example includes a small deployment contract test. It checks that the browser source does not carry a provider key and that the package still has a production build and a deterministic test command. That kind of check is narrow, but it catches a dangerous release mistake.

A fuller release check should also cover:

| Check | What it protects |
| --- | --- |
| Typecheck | Directive values and adapter imports stay valid |
| Unit tests | Registry, records, scopes, and handlers still agree |
| Production build | The deployed bundle resolves every dependency |
| Access policy | Only intended capabilities are present |
| Gateway configuration | Credentials stay on the server |
| Browser smoke | The dock and page mount after deployment |

## Build and serve the artifact

Run the same build command the host will run:

```bash
pnpm build
```

For a static build served from a subdirectory, set Vite's `base` option to match that path. The example uses a relative base so the generated asset links do not assume the site root:

```ts
export default defineConfig({
  base: "./",
});
```

If the application uses client-side routing, the server must also return the application entry for the routes the application owns. That is a hosting decision, not a Pling declaration.

## Keep the model boundary on the server

The browser may contain the UI, the capability declarations, and a request into your gateway. It should not contain the production provider key. The gateway should apply authentication, rate limits, request limits, logging, and the provider credentials required for that deployment.

The same rule applies to a dock created after login. Authentication changes who can open the entry; it does not make a secret safe to ship in browser JavaScript.

## Run the example

```bash
pnpm tutorial:dev v2-07
```

Open `http://127.0.0.1:5268/`, or use `--locale zh` and `http://127.0.0.1:5268/?lang=zh`.

```bash
pnpm tutorial:check v2-07
```

The check typechecks the application, runs the deterministic record and dialog tests, runs the deployment contract test, and produces a production build.

## Common failures

**Testing only the happy path through a live model.** Model output varies. Test the registry and business path deterministically first, then test the model boundary separately.

**Shipping a key because the build succeeded.** A successful bundle can still contain a secret. Check the source and generated assets as part of release review.

**Forgetting the post-deploy smoke test.** Mount the deployed page, open the assistant, and confirm one harmless action before enabling a broader capability set.

Next: [Migrating from Vue 2 to Vue 3](/vue2/migrating-from-vue-2-to-vue-3).
