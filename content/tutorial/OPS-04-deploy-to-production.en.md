---
id: OPS-04
title: "Deploy to production"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# Deploy to production

A preview that can chat is not a production deployment. Before traffic reaches the assistant, separate browser code from provider credentials, make the model gateway same-origin or explicitly allowed, remove development-only controls, and verify that a failed run can be observed and stopped.

## Build the production boundary

Use a thin server gateway in front of the model provider. The browser should call a relative path such as `/api/llm/v1`; the gateway should hold the provider key, validate the user session, pin or allowlist models, enforce request-size and rate limits, and attach a request id. A provider key embedded in a `VITE_*` variable is part of the browser bundle and cannot be treated as a secret.

If the page and gateway are on different origins, configure an exact allowlist and cookie policy. Do not start with `*` and narrow later. For Surface, keep the transport layer responsible for authentication, delegated session lifecycle, replay protection, and audit delivery; the kernel should receive only a verified session.

## Remove development surfaces

Request tracing, broad debug panels, test-only model settings, and local scripts must not be enabled by default. The trace contains system prompts and page snapshots. A debug control is not a privacy boundary, and an admin-looking toggle is not authorization.

Set a finite production turn budget. Tutorial fixtures may use `maxTurns: 100`, but production defaults are deliberately smaller. Add a kill switch that can disable the assistant without shipping new frontend code, and test that it actually reaches the running runtime.

## Make the release check executable

Keep a small `evaluateRelease`-style check in the deployment pipeline and let it fail the build:

```ts
const review = evaluateRelease(config);
if (!review.ready) {
  for (const check of review.checks.filter((item) => item.status === "fail")) {
    console.error(`${check.id}: ${check.detail}`);
  }
  process.exit(1);
}
```

Static checks can prove that the gateway URL is HTTPS, the browser key field is empty, the model policy is pinned, telemetry has an HTTP(S) endpoint, and the origin allowlist is exact. They cannot prove that those services are healthy. Make a real request after deploy and verify gateway auth, provider timeout, and error shape.

## Observe a run, not just a page

Record status codes, latency, token use, turn exhaustion, tool error codes, model and prompt version, and request ids. Alert on spikes in `ACTION_NOT_FOUND`, `INVALID_ARGS`, `STEP_FAILED`, `LLM_FAILED`, and denied confirmations. A dashboard that only counts page visits cannot explain whether the assistant is helping or failing.

Roll out to internal users first, then a small percentage, then the full audience. Keep a rollback path that disables the launcher or narrows the capability set without deploying a new bundle. Test with the operator who will be on call, not only with the developer who built the page.

For a release checklist in code, see [Production release](/vue/production-release). For gateway options, see [Node gateway](/reference/node-gateway).
