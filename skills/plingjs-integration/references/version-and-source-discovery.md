# Version, API, and source discovery

Pling has multiple packages and adapters, and alpha APIs can evolve. A coding
Agent must inspect the target app's installed release rather than assume the
latest website or GitHub branch matches it.

## Resolve the app's version first

Inspect the package manager lockfile, manifest, and installed tree:

```bash
npm ls @plingjs/core @plingjs/agent @plingjs/vue @plingjs/react @plingjs/vanilla @plingjs/vue2 @plingjs/server
```

With pnpm, also use:

```bash
pnpm why @plingjs/vue
pnpm why @plingjs/agent
```

For the current registry metadata and adapter compatibility, query the exact
package rather than relying on memory:

```bash
npm view @plingjs/core dist-tags versions --json
npm view @plingjs/vue version peerDependencies exports --json
npm view @plingjs/react version peerDependencies exports --json
npm view @plingjs/vanilla version peerDependencies exports --json
npm view @plingjs/vue2 version peerDependencies exports --json
npm view @plingjs/server version exports --json
npm view @plingjs/vue@VERSION_FROM_LOCKFILE peerDependencies exports --json
npm view @plingjs/react@VERSION_FROM_LOCKFILE peerDependencies exports --json
npm view @plingjs/vue@VERSION_FROM_LOCKFILE readme
```

Replace `VERSION_FROM_LOCKFILE` with the exact version used by the app. For
prerelease applications, query all installed `@plingjs/*`
packages and align the intended set. Do not upgrade unrelated packages just to
make Pling install.

The public website's [release page](https://plingjs.dev/releases/) is the
human-readable migration starting point. Compare it with npm metadata, the
lockfile, and exact package declarations. If they disagree, note the drift and
avoid silently upgrading or copying an API from a different release.

## Inspect the installed package

For the API an application actually compiles against, inspect the package's
`package.json` exports, `.d.ts` files, README, and implementation in
`node_modules/@plingjs/<package>`. If declarations are bundled or omitted, get
the exact published archive without installing it:

```bash
mkdir -p .tmp/pling-pack
npm pack @plingjs/vue@VERSION_FROM_LOCKFILE --pack-destination .tmp/pling-pack
```

Do not commit temporary tarballs. If `.tmp` is not ignored by the app, use a
temporary directory outside the repository.

## Clone Pling source for deeper investigation

Cloning the public framework is optional. Do it only when package types and
version-matched docs do not answer the question, or when an implementation bug
needs a source-level trace. A side-by-side clone keeps Pling internals separate
from the customer's application code.

Before cloning, inspect the target repository's `.gitignore` and any existing
`.tmp/pling-source` path. Never delete or overwrite an existing directory. If
`.tmp` is ignored and the path is free:

```bash
mkdir -p .tmp
git clone https://github.com/plingjs/pling.git .tmp/pling-source
```

If the path is already a clone, verify `git -C .tmp/pling-source remote -v`,
working-tree state, and current commit before fetching. If it is not a clean
Pling checkout, leave it untouched and use a fresh directory outside the app.
Do not edit the source clone while retrofitting the customer app.

The GitHub `main` branch is development source and can be ahead of or behind the
published npm line. Match source to the installed release using the release's
tag or commit when available. If no matching source tag is available, treat
the published package archive and declarations as the executable contract;
do not claim that `main` proves the installed version's behavior.

## Read only the files that answer the question

The Pling repository is <https://github.com/plingjs/pling>. Useful areas:

| Need | Start here |
| --- | --- |
| Framework-neutral contracts and execution | `packages/core/` |
| Shared locale and theme contracts | `packages/ui/` |
| DOM targeting and browser primitives | `packages/dom/` |
| Agent loop, context, tasks, confirmation, and trace | `packages/agent/` |
| Framework adapters | `packages/vue/`, `packages/react/`, `packages/vanilla/`, `packages/vue2/` |
| Model gateway | `packages/server/` |
| External capability protocol | `packages/surface/` |
| Page-side Surface sessions and transport | `packages/surface-browser/` |
| Optional remote continuity and delegation ports | `packages/continuity-http/`, `packages/delegation/` |
| Reference gateway and MCP endpoint | `services/surface-gateway/` |
| Public API and compatibility | `website/reference/api/`, `website/reference/*-adapter.md`, `website/releases/`, corresponding `content/tutorial/` source |
| Vue 3 declarations and lifecycle | `packages/vue/src/`, then the relevant `packages/vue/test/` |
| React hooks and legacy entry | `packages/react/src/`, especially `legacy.tsx`, then relevant `packages/react/test/` |
| Vanilla DOM declarations | `packages/vanilla/src/`, then `packages/vanilla/test/` |
| Shared registry, policy, and execution | `packages/core/src/types.ts`, `registry.ts`, `executor.ts`, `policy.ts`, then matching tests |
| Agent loop, context, tasks, and confirmation | `packages/agent/src/` and matching tests |
| Model gateway | `packages/server/README.md`, `packages/server/src/`, and `packages/server/test/` |
| Surface protocol | `packages/surface/README.md`, `packages/surface/src/`, and tests |
| Browser Surface session/transport | `packages/surface-browser/src/` and tests |
| Reference MCP gateway | `services/surface-gateway/README.md`, `src/`, and `test/` |
| End-to-end patterns | `examples/demos/`, `examples/tutorials/`, and `examples/apps/`; examples demonstrate composition, not normative contracts |

Use these commands for targeted searches after cloning:

```bash
rg -n "export (function|type|interface)|createPling|v-tool|usePlingTool" packages
rg -n "params|available|confirm|expect|handoff|steps" packages/core/src packages/vue/src packages/react/src
rg -n "TaskDefinition|TaskRun|TaskCatalog" packages/agent/src website/reference
rg -n "baseUrl|createPlingGateway|toNodeHandler" packages/server/src website/reference/node-gateway.md
```

Start with the target package README, package exports, and the exact type or
function. Read its tests to learn lifecycle, rejection, and edge behavior. Avoid
loading the full monorepo when one exported API is in question.

## Verify a version-specific integration

1. Record exact `@plingjs/*`, framework, Node, and bundler versions.
2. Read the matching peer dependencies and package exports.
3. Use the adapter entry point for that framework version; do not import a
   newer framework's APIs into a legacy app.
4. Typecheck and build against the lockfile, not workspace aliases or a global
   package.
5. Test one declared read and write, their failure/confirmation paths, and
   cleanup after a component or route unmounts.
6. If the package surface differs from website docs, report it with exact
   package version and file/signature evidence.
