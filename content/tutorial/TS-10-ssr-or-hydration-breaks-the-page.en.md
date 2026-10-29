---
id: TS-10
title: "SSR or hydration breaks the page"
locale: en
source_locale: en
translation_status: source
status: drafted
---

# SSR or hydration breaks the page

The server has no `window`, `document`, `MutationObserver`, or real event loop. Browser-only initialization at module top level fails during SSR; placing it in first render can also cause hydration mismatch.

## Symptoms

| Symptom | Likely cause |
| --- | --- |
| `window is not defined` | Browser code runs during module import |
| Hydration mismatch | Server and client render different initial DOM |
| Actions unavailable on first paint | Plugin installs after mount |
| Double registration | Server render and client initialize twice |
| Crash after route change | Singleton reused across requests |
| Leaked listeners | Plugin teardown does not clean up |

## Vue / Nuxt

- create `createPling()` inside a plugin or after `onMounted`;
- do not share a module singleton across requests;
- use a `.client` plugin or an explicit client condition;
- keep server and client initial markup identical before hydration;
- recreate page declarations on route change, or ensure scope cleanup is correct.

See [Nuxt and SSR](/vue/nuxt-and-ssr).

## React / Next.js

- use the provider in a client component and check the `"use client"` boundary;
- never touch browser globals at module top level;
- avoid rendering different DOM on the first render based on `window`;
- create the runtime in an effect or after client mount;
- do not pass non-serializable instances or functions from server components.

See [Next.js and SSR](/react/next-js-and-ssr).

## Diagnostic order

1. Find the first `window` / `document` access in server logs.
2. Inspect hydration warnings and component boundaries in the browser.
3. Disable Pling initialization and confirm base SSR works.
4. Move runtime creation into a client lifecycle.
5. Check duplicate plugin installation and singleton reuse across requests.
6. Test a real production build, not only a dev server.

## Security and consistency

An SSR page can return signed-out or placeholder markup first. Do not write protected data into server HTML and then let the client surface assume login. Revalidate identity per request; do not cache request sessions in a global module.

## Acceptance

- Server rendering accesses no browser API.
- Hydration emits no structural mismatch warning.
- Actions appear at a documented point after first paint.
- Two concurrent requests do not share user state.
- Route changes and unmount clean up listeners and registrations.
- SSR and client behavior are tested in a production build.

## Related

[Nuxt and SSR](/vue/nuxt-and-ssr), [Next.js and SSR](/react/next-js-and-ssr), [Projection: Shadow DOM and iframes](/concepts/projection-shadow-dom-and-iframes).
