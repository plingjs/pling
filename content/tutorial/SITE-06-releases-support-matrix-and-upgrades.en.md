---
id: SITE-06
title: "Releases, support matrix, and upgrades"
locale: en
source_locale: en
translation_status: source
status: reviewed
---

# Releases, support matrix, and upgrades

Pling packages use semantic versioning. The Surface capability protocol uses its own version string. A package release can contain fixes without changing `pling.surface/0.1`; a protocol change can affect independent implementations even when no npm dependency changes.

An upgrade starts by separating those two version lines and then deciding what has to change.

## Current release line

All public packages are at `0.1.0-alpha.2`. This is an alpha line: APIs may change, and security fixes are provided only for the latest published alpha. A package being published or a demo running does not mean it is production-ready.

| Package | Responsibility | Current line |
| --- | --- | --- |
| `@plingjs/core` | Registry, execution, policy, and result primitives | `0.1.0-alpha.2` |
| `@plingjs/dom` | DOM targeting, projection, scrolling, and browser primitives | `0.1.0-alpha.2` |
| `@plingjs/agent` | Loop, context, tools, and continuity contracts | `0.1.0-alpha.2` |
| `@plingjs/surface` | Agent Surface projection and `describe` / `invoke` | `0.1.0-alpha.2` |
| `@plingjs/delegation` | Optional delegation credential lifecycle | `0.1.0-alpha.2` |
| `@plingjs/continuity-http` | Optional remote continuity over HTTP | `0.1.0-alpha.2` |
| `@plingjs/server` | OpenAI-compatible model gateway | `0.1.0-alpha.2` |
| `@plingjs/ui` | Shared interface components and styles for adapters | `0.1.0-alpha.2` |
| `@plingjs/vue` | Vue 3 adapter | `0.1.0-alpha.2` |
| `@plingjs/react` | React adapter | `0.1.0-alpha.2` |
| `@plingjs/vanilla` | Framework-free DOM adapter | `0.1.0-alpha.2` |
| `@plingjs/vue2` | Vue 2.7 adapter | `0.1.0-alpha.2` |

The protocol documented here is `pling.surface/0.1`, still a public draft. Version 0.1 defines only `describe` and `invoke`. It does not promise `attach`, `observe`, `handoff`, `detach`, or a mandatory transport.

## Support matrix

| Environment | Supported range | Practical boundary |
| --- | --- | --- |
| Vue 3 | peer dependency `^3`; documentation targets 3.4+ | Examples use object-form `v-bind` and the Composition API |
| React | peer dependency `>=18` | Examples use React 19; older major versions are not claimed |
| Vue 2 | `@plingjs/vue2` supports only `^2.7.0`; 2.6 and earlier can integrate manually through `@plingjs/vanilla` | 2.6 and earlier lack the Composition API needed by state helpers, directives, and automatic cleanup |
| Vanilla JavaScript | No framework peer dependency | DOM and modern browser APIs are still required |
| Node | Repository development and gateway examples require 20+ | This is not a restriction on unrelated application servers |

Browser support is not a certification list. Repository tests run in `jsdom`; examples target current evergreen browsers. Capabilities that depend on Shadow DOM, iframe access, Web Crypto, `EventSource`, or Web Locks inherit platform limits. Test the real browser matrix before launch, especially embedded webviews and older enterprise clients.

## Version and compatibility policy

- Patch releases should preserve documented API and protocol behaviour.
- Minor releases may add capabilities, options, or fields.
- During `0.x`, a minor release may contain a documented breaking change when a known security or correctness defect requires it.
- A breaking protocol change must use a new protocol version and include migration guidance. It cannot be hidden in patch notes.
- A deprecated API remains for at least one minor release unless it is causing active risk.
- Security fixes may be backported only to the latest alpha. Version 0.1 has no long-term support commitment.

## Upgrade procedure

1. Read the changelog and compare the package version and protocol version separately.
2. Update the lockfile and upgrade all `@plingjs/*` packages together so adapters and core do not run at incompatible versions.
3. Run `pnpm check`, `pnpm typecheck`, and the relevant package tests.
4. Run the framework example and your own capability regression tests.
5. Exercise an expired session, a revoked credential, and an action on a stale record.
6. After a transport change, inspect gateway request shapes, timeouts, and retry budgets.
7. Release behind a feature flag. Compare audit results before widening exposure.

For a gradual release, run the new build under the old capability scope with read-only actions first. Do not combine a wider write surface or a dangerous capability with the upgrade itself.

## Known incompatibilities and limits

- `@plingjs/vue2` does not support Vue 2.6 or earlier. Those projects can integrate manually through `@plingjs/vanilla`.
- The 0.1 protocol has no generic DOM selector or JavaScript execution escape hatch.
- Cross-origin iframe runtimes do not share in-memory objects; they require an explicit transport.
- The reference delegation and continuity packages do not provide a production database, Redis, SSO, or complete audit archive.
- In-memory adapters under `*/testing` are for tests and local reference only.
- `surface.plingjs.dev` is an official demonstration endpoint, not a multi-tenant customer gateway.
- There is currently no public third-party Surface conformance suite or certification mark.

## Release records

Every release note should state package versions, protocol version, commit or artefact identifier, test commands, migration impact, and known limits. Benchmark or evaluation claims must point to a frozen task set and recorded model; they do not generalize to every site or provider.

See the [Documentation map](/roadmap) and [Upgrade Pling safely](/operations/upgrade-pling-safely) for the rest of the site and the operational procedure.
