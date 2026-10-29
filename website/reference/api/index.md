---
title: "API reference"
status: navigation
release: 0.1
locale: en
---
<!-- generated:api-index -->

# API reference

Choose the framework you are integrating. Each page contains only that framework's entry points, options, defaults, and examples; the four adapters are no longer mixed into one table. Shared runtime and testing APIs have their own page.

The parameter tables are the main contract here. Look up a field's type, required status, default, and applicable scenario on the current framework page; follow the linked reference only when you need field-level semantics or error codes.

There are **5** API pages covering **8** capability groups; the current version is `0.1.0-alpha.2` with **preview** stability.

## Choose by framework

| Framework | Package | Entries | Page |
| --- | --- | --- | --- |
| **Vue 3 API** | `@plingjs/vue` | 41 | [Open](/reference/api/vue-3) |
| **React API** | `@plingjs/react` | 39 | [Open](/reference/api/react) |
| **Vue 2.7 API** | `@plingjs/vue2` | 25 | [Open](/reference/api/vue-2) |
| **Vanilla JS API** | `@plingjs/vanilla` | 27 | [Open](/reference/api/vanilla) |

## Shared package API

Runtime, page continuity, testing, and diagnostic APIs share one implementation: **33** entries.

[Open the shared package API](/reference/api/shared)

## Version and compatibility

| Package | Version | Peer dependencies |
| --- | --- | --- |
| `@plingjs/vue` | `0.1.0-alpha.2` | `vue ^3` |
| `@plingjs/react` | `0.1.0-alpha.2` | `react >=18` |
| `@plingjs/vue2` | `0.1.0-alpha.2` | `vue ^2.7.0` |
| `@plingjs/vanilla` | `0.1.0-alpha.2` | — |

| Item | Value |
| --- | --- |
| Introduced | `0.1.0-alpha.2` |
| Runtime | ES modules for Vue 3, React 18+, Vue 2.7, or a browser |
| Stability | Pre-1.0 alpha; a minor release may change the API |

## Machine-readable copies

- [API overview JSON](/api-index.json)
- [Vue 3 API JSON](/api-index/vue-3.json)
- [React API JSON](/api-index/react.json)
- [Vue 2.7 API JSON](/api-index/vue-2.json)
- [Vanilla JS API JSON](/api-index/vanilla.json)
- [Shared package API JSON](/api-index/shared.json)

## Out of scope

- Surface, delegation, the Node gateway, and protocol schemas have their own references.
- Adapter support does not imply that all four frameworks behave identically.
- Internal helpers, component internals, and non-exported types are not compatibility promises here.
