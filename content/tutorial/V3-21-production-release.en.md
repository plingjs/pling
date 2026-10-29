---
id: V3-21
title: "Production release"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Production release

An assistant can work in a preview and still be unsafe to release. The difference is rarely the chat panel. It is the set of conditions that were convenient to relax during development: a provider key in the client, a wildcard model, an unlimited loop, an open origin, no telemetry delivery, and no way to turn the feature off.

This chapter adds an executable preflight to the Todo example. The preflight checks deployment configuration before traffic is switched. It does not replace a gateway, an audit system, or a live health check.

## Make the release conditions executable

The example keeps release configuration separate from the page actions:

```ts
export interface ReleaseConfig {
  environment: "preview" | "production";
  gatewayUrl: string;
  browserApiKey: string;
  modelPolicy: { mode: "pinned" | "allowlist"; models: string[] };
  appOrigin: string;
  allowedOrigins: string[];
  maxTurns: number;
  contextTokens: number;
  telemetryEndpoint: string;
  killSwitchUrl: string;
}

const review = evaluateRelease(config, locale);
```

The `config` in the example is a built-in preview value. Its model and gateway
settings only drive the displayed checks; they do not switch real model traffic.
A real project should inject this configuration at build or deployment time,
not keep production policy in editable client state.

`evaluateRelease` returns checks with `pass`, `warn`, or `fail`. Any failed check makes `ready` false. The deployment pipeline should exit non-zero when that happens; a panel alone cannot stop a release.

The example keeps the checks in `src/release.ts`; the page only renders the result. The pipeline still has to read `ready` and choose its exit code, for example:

```ts
const review = evaluateRelease(config, locale);
if (!review.ready) {
  for (const check of review.checks.filter((item) => item.status === "fail")) {
    console.error(`${check.id}: ${check.detail}`);
  }
  process.exit(1);
}
```

This is a static preflight. It can prove that a URL is HTTPS, that the browser key field is empty, and that a model allowlist is non-empty. It cannot prove that the remote gateway, telemetry collector, or kill-switch endpoint is reachable. Those need real requests and health probes.

## Check evidence, not assertions

The example checks eight conditions:

| Check id | Evidence it requires |
| --- | --- |
| `gateway_tls` | An HTTPS gateway, with loopback HTTP allowed only in preview |
| `browser_key` | `browserApiKey` is empty |
| `model_policy` | A single pinned model, or a non-wildcard allowlist |
| `turn_budget` | A positive `maxTurns`; at most 20 for production and 100 for preview |
| `context_budget` | A declared context window between 2,048 and 128,000 tokens |
| `telemetry` | A valid HTTP(S) telemetry endpoint |
| `origin_allowlist` | The application origin is present and `*` is absent |
| `kill_switch` | An HTTP(S) address for disabling the assistant without a client build; reachability still needs a separate probe |

These checks are deliberately narrow. They catch configuration mistakes that are easy to make and easy to review. They do not replace the gateway's own model policy, rate limits, authentication, or audit.

`previewConfig` uses `maxTurns: 100` because tutorial demos are allowed to take more turns. `productionConfig` uses `10`. Do not copy the demo budget into production because it makes the example look smoother.

## Keep release controls outside the action surface

The release panel is rendered with `data-pling-ignore`, so the coverage scanner does not treat its controls as undeclared page capabilities. More importantly, the panel contains no release actions at all.

The action list contains Todo controls and a read-only `release_status` tool. It does not contain “change model”, “open origin”, or “disable kill switch”. A person can ask the assistant why a release is blocked, and the assistant can report failing check ids. It cannot approve or alter the release.

Release controls belong in a deployment pipeline, an admin application, or an internal API with its own authorization. Putting them behind a browser action merely because the page can render them is an authorization mistake.

`.env.local` is only for a restricted development model on your machine. `VITE_*` values are compiled into the browser bundle, so a production provider key must stay behind the gateway. The chapter's `previewConfig` is likewise a static fixture; the page does not use it to replace the real model client.

## Observe the system after the preflight

Before switching traffic, test the real path:

```text
request → gateway auth → model allowlist → upstream timeout → response
                 │              │                 │
                 └─ audit user  └─ audit model    └─ retry exhausted / request id
```

Record at least:

- request and failure rates by status;
- model latency and token usage;
- tool error codes, especially `ACTION_NOT_FOUND`, `INVALID_ARGS`, and `STEP_FAILED`;
- turns per session and exhausted retries;
- the release version and prompt version in use.

The browser should show a stable error code and request id. Operations should be able to locate the corresponding audit record without reading the conversation.

## Roll out in stages

A reasonable first release is not “every user, every page”. Start with:

1. one page and one capability group;
2. a named user group or internal traffic;
3. a budget and turn limit below the expected steady state;
4. a kill switch that disables the assistant while leaving the business page intact;
5. a rollback path that does not depend on the model provider.

Measure completion rate, abandonment, tool errors, and cost per successful task. A page that looks impressive but has a high tool-error rate is not ready.

## Run the example

Run the English example:

```bash
pnpm tutorial:dev v3-21
```

Open `http://127.0.0.1:5234/`. For Chinese, run:

```bash
pnpm tutorial:dev v3-21 --locale zh
```

Open `http://127.0.0.1:5234/?lang=zh`.

The Todo list behaves normally. The release panel shows each check, its evidence, and its reason. The release controls are intentionally absent from the agent's action list.

Run the deterministic check:

```bash
pnpm tutorial:check v3-21
```

It verifies that the production configuration passes, an unsafe configuration fails for the expected reasons, and the only `release_*` action exposed to the agent is the read-only `release_status`.

## Failure modes

**Turning off limits to make the demo smoother.** A production loop needs a budget. The tutorial's `maxTurns: 100` is explicitly a demo value, not a production default.

**Letting the agent control the release gate.** If the assistant can change its own limits, model, or kill switch, the gate is decorative. Keep those controls outside agent actions.

**Shipping without a rollback.** A kill switch that requires a new frontend deployment is not a rollback. Decide in advance how the feature is disabled and how the business page behaves without it.

**Watching only HTTP 200s.** A model request can succeed while every tool call fails. Monitor actions and business outcomes, not only transport status.

**Treating the preflight as proof of runtime health.** Configuration can pass while the gateway or telemetry endpoint is down. Run real probes and keep the preflight in the deployment pipeline.

**Treating the release checklist as documentation.** Run it in tests and in the deployment pipeline. A document cannot block a release; a failed check can.
