# Pling · Page Intelligence

[简体中文](./README.zh-CN.md)

Pling is an open capability layer for web applications. A page declares what an
agent may inspect and do; the agent executes those operations through the same
controls and business logic people use. Validation, authorization, state, and
final authority remain in the application.

Pling is not a browser agent, a replacement for backend APIs, or a generic click
layer. It provides a bounded, auditable interface between a web application and
an agent runtime. An action being visible never means it is authorized.

> Status: `0.1.0-alpha.2`. Package APIs and the Surface protocol may still change.
> Check [releases](https://plingjs.dev/releases/) before relying on a production deployment.

## What it provides

- **Declared capabilities.** Actions, records, regions, and read-only state are
  named by the application instead of guessed from selectors.
- **Page-native execution.** An agent runs the same handlers, validation, and
  confirmation gates as a person using the interface.
- **Bounded context.** The model receives only the records, fields, regions, and
  view state needed for the current task.
- **Human authority.** Confirmation, handoff, delegated access, and audit remain
  explicit boundaries rather than model decisions.
- **An external-agent contract.** `pling.surface/0.1` defines `describe` and
  `invoke` for controlled access from an agent outside the page.

## Packages

| Package | Responsibility |
| --- | --- |
| `@plingjs/core` | Framework-neutral registry, policy, execution, and evidence primitives |
| `@plingjs/ui` | Shared locale, message, theme, and class-name contracts |
| `@plingjs/dom` | DOM targeting, visibility, scrolling, and browser primitives |
| `@plingjs/agent` | Agent loop, context assembly, confirmation, continuity, and telemetry |
| `@plingjs/surface` | Agent Surface projection and the `describe` / `invoke` protocol |
| `@plingjs/delegation` | Delegation contracts and web-standard handlers |
| `@plingjs/continuity-http` | HTTP integration for cross-device task continuity |
| `@plingjs/server` | Node model gateway for credentials, authentication, limits, and audit |
| `@plingjs/vue` | Vue 3 adapter and assistant UI |
| `@plingjs/react` | React provider, hooks, and assistant UI |
| `@plingjs/vanilla` | DOM adapter for plain JavaScript and jQuery pages |
| `@plingjs/vue2` | Vue 2.7 adapter with a documented subset |

## Documentation

English is served from the root, Chinese from `/zh`:

- [Documentation](https://plingjs.dev/start/)
- [Vue quick start](https://plingjs.dev/vue/quick-start-add-pling-to-a-vue-app)
- [React quick start](https://plingjs.dev/react/quick-start-add-pling-to-a-react-app)
- [Vanilla JavaScript and jQuery](https://plingjs.dev/vanilla/)
- [Agent Surface](https://plingjs.dev/surface/)
- [Specification 0.1](https://plingjs.dev/spec/0.1/)

## Development

```bash
pnpm install
pnpm tutorial:build
pnpm dev:docs
```

Open `http://localhost:5190/`. Tutorial previews are generated assets, so run
`pnpm tutorial:build` once on a fresh checkout. The introductory examples use a
deterministic scripted model and do not require a provider key.

To build one tutorial fixture against locally packed packages:

```bash
pnpm tutorial:dev v3-03
pnpm tutorial:check v3-03
```

## Repository layout

```text
packages/   framework packages; the only implementation source
examples/   public examples, including the authenticated Todo Surface app
content/    bilingual tutorial sources and the locked outline
website/    VitePress documentation site
services/   independently runnable reference services
deploy/     Cloudflare, Docker, and host deployment references
skills/     reusable agent integration guides
scripts/    repository and release checks
```

## Verify a change

```bash
pnpm check
pnpm release:check
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
pnpm --filter @plingjs/website build
```

Individual packages and examples expose their own `test`, `typecheck`, and `dev`
scripts. Tutorial fixtures are checked against tarballs produced from the current
workspace, not unpublished source aliases.

## Security

Provider keys belong on the server. Do not put a model key in frontend
environment variables or a public build. Report vulnerabilities through the
private process in [SECURITY.md](SECURITY.md); do not open a public issue
containing secrets or customer data.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
