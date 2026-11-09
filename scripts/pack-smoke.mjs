import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ALL_PACKAGES, buildAndPackPackages, run } from "./lib/pack-packages.mjs";

const repo = resolve(import.meta.dirname, "..");
const temp = await mkdtemp(join(tmpdir(), "pling-pack-smoke-"));
const tarballs = await buildAndPackPackages({ root: repo, temp });

const app = join(temp, "app");
await mkdir(join(app, "src"), { recursive: true });
await writeFile(
  join(app, "package.json"),
  `${JSON.stringify(
    {
      name: "pling-pack-smoke-app",
      private: true,
      type: "module",
      dependencies: {
        "@plingjs/core": `file:${tarballs["@plingjs/core"]}`,
        "@plingjs/ui": `file:${tarballs["@plingjs/ui"]}`,
        "@plingjs/dom": `file:${tarballs["@plingjs/dom"]}`,
        "@plingjs/surface": `file:${tarballs["@plingjs/surface"]}`,
        "@plingjs/delegation": `file:${tarballs["@plingjs/delegation"]}`,
        "@plingjs/agent": `file:${tarballs["@plingjs/agent"]}`,
        "@plingjs/surface-browser": `file:${tarballs["@plingjs/surface-browser"]}`,
        "@plingjs/continuity-http": `file:${tarballs["@plingjs/continuity-http"]}`,
        "@plingjs/server": `file:${tarballs["@plingjs/server"]}`,
        "@plingjs/surface-gateway": `file:${tarballs["@plingjs/surface-gateway"]}`,
        "@plingjs/vanilla": `file:${tarballs["@plingjs/vanilla"]}`,
        "@plingjs/react": `file:${tarballs["@plingjs/react"]}`,
        "@plingjs/vue": `file:${tarballs["@plingjs/vue"]}`,
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        vue: "^3.5.0",
      },
      devDependencies: {
        "@vitejs/plugin-vue": "^5",
        "@types/react": "^19",
        "@types/react-dom": "^19",
        typescript: "^5",
        vite: "^6",
        "vue-tsc": "^3.3.13",
      },
    },
    null,
    2,
  )}\n`,
);
// pnpm 11+ 不再读 package.json 的 pnpm 字段，覆盖要写在 pnpm-workspace.yaml。
await writeFile(
  join(app, "pnpm-workspace.yaml"),
  `overrides:\n  "@plingjs/core": "file:${tarballs["@plingjs/core"]}"\n  "@plingjs/ui": "file:${tarballs["@plingjs/ui"]}"\n  "@plingjs/dom": "file:${tarballs["@plingjs/dom"]}"\n  "@plingjs/surface": "file:${tarballs["@plingjs/surface"]}"\n  "@plingjs/delegation": "file:${tarballs["@plingjs/delegation"]}"\n  "@plingjs/agent": "file:${tarballs["@plingjs/agent"]}"\n  "@plingjs/surface-browser": "file:${tarballs["@plingjs/surface-browser"]}"\n  "@plingjs/continuity-http": "file:${tarballs["@plingjs/continuity-http"]}"\n  "@plingjs/vanilla": "file:${tarballs["@plingjs/vanilla"]}"\n`,
);
await writeFile(
  join(app, "vite.config.mjs"),
  `import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  resolve: { dedupe: ["vue"] },
  build: { outDir: "dist", emptyOutDir: true },
});
`,
);
await writeFile(
  join(app, "index.html"),
  '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>\n',
);
await writeFile(join(app, ".env"), "VITE_AGENT_BASE_URL=https://env.example/v1\nVITE_AGENT_MODEL=pack-smoke-model\n");
await writeFile(
  join(app, "src/App.vue"),
  `<script setup lang="ts">
import { ref } from "vue";
import { AgentDock } from "@plingjs/vue";

const count = ref(0);
</script>

<template>
  <button v-tool="{ id: 'increment', desc: '把计数加一' }" @click="count += 1">{{ count }}</button>
  <AgentDock />
</template>
`,
);
await writeFile(
  join(app, "src/main.ts"),
  `import { createApp } from "vue";
import { createPling } from "@plingjs/vue";
import "@plingjs/vue/style.css";
import App from "./App.vue";

const pling = createPling({ onWarn: () => {} });
createApp(App).use(pling.plugin).mount("#app");
`,
);
await writeFile(join(app, "src/env.d.ts"), 'declare module "*.vue";\ndeclare module "*.css";\n');
await writeFile(
  join(app, "tsconfig.json"),
  `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      },
      include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.d.ts", "src/**/*.vue"],
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  join(app, "src/react-smoke.tsx"),
  `import { createPling, PlingProvider, usePlingTool, type PlingToolOptions } from "@plingjs/react";

const pling = createPling({ onWarn: () => {} });
const options: PlingToolOptions = { id: "react_smoke", desc: "React 发布包冒烟" };

export function Smoke() {
  const ref = usePlingTool<HTMLButtonElement>(options);
  return <PlingProvider pling={pling}><button ref={ref}>smoke</button></PlingProvider>;
}
`,
);
await writeFile(
  join(app, "src/surface-gateway-smoke.ts"),
  `import {
  createSurfaceGateway,
  normalizeConfig,
  type SurfaceGatewayOptions,
} from "@plingjs/surface-gateway";

const config = normalizeConfig({
  tenants: [{ id: "smoke", origins: ["https://smoke.example"] }],
});
const options: SurfaceGatewayOptions = {
  config,
  publicBaseUrl: "https://surface.smoke.example",
};

void createSurfaceGateway;
void options;
`,
);
await writeFile(
  join(app, "smoke.mjs"),
  `import { createRegistry } from "@plingjs/core";
import { resolveLocale, resolveTheme, translate } from "@plingjs/ui";
import { createSurface } from "@plingjs/surface";
import { createPlingSurface } from "@plingjs/surface-browser";
import { createMemoryDelegationStore } from "@plingjs/delegation";
import { assertDelegationStoreConformance } from "@plingjs/delegation/testing";
import { HookRegistry } from "@plingjs/agent";
import { createContinuityHandler, createHttpContinuityAuthority } from "@plingjs/continuity-http";
import { assertContinuityBackendConformance, createMemoryContinuityBackend } from "@plingjs/continuity-http/testing";
import { createPlingGateway } from "@plingjs/server";
import { createSurfaceGateway, normalizeConfig, runSurfaceGatewayCli } from "@plingjs/surface-gateway";
import { createPling as createVanillaPling } from "@plingjs/vanilla";
import { createPling as createReactPling, PlingProvider } from "@plingjs/react";
import { AgentDock, createPling as createVuePling } from "@plingjs/vue";

if (typeof createRegistry !== "function") throw new Error("core 导出缺失");
if (typeof resolveLocale !== "function" || typeof resolveTheme !== "function" || typeof translate !== "function") {
  throw new Error("ui 导出缺失");
}
if (resolveLocale("zh-CN") !== "zh-CN" || translate("en-US", "dock.launcher.open") !== "Ask Pling") {
  throw new Error("ui locale / message 行为异常");
}
if (resolveTheme("dark").mode !== "dark") throw new Error("ui theme 行为异常");
if (typeof createSurface !== "function") throw new Error("surface 导出缺失");
if (typeof createPlingSurface !== "function") throw new Error("surface-browser 导出缺失");
if (typeof createMemoryDelegationStore !== "function") throw new Error("delegation 导出缺失");
if (typeof assertDelegationStoreConformance !== "function") throw new Error("delegation/testing 导出缺失");
if (typeof HookRegistry !== "function") throw new Error("agent 导出缺失");
if (typeof createHttpContinuityAuthority !== "function" || typeof createContinuityHandler !== "function") {
  throw new Error("continuity-http 导出缺失");
}
if (typeof createMemoryContinuityBackend !== "function") throw new Error("continuity-http/testing 导出缺失");
if (typeof assertContinuityBackendConformance !== "function") {
  throw new Error("continuity-http/testing conformance 导出缺失");
}
if (typeof createPlingGateway !== "function") throw new Error("server 导出缺失");
if (typeof createSurfaceGateway !== "function" || typeof normalizeConfig !== "function") {
  throw new Error("surface-gateway 导出缺失");
}
if (typeof runSurfaceGatewayCli !== "function") throw new Error("surface-gateway CLI 导出缺失");
if (typeof createVanillaPling !== "function") throw new Error("vanilla 导出缺失");
if (typeof createReactPling !== "function" || !PlingProvider) throw new Error("react 导出缺失");
if (typeof createVuePling !== "function" || !AgentDock) throw new Error("vue 导出缺失");
console.log("tarball imports ok");
`,
);

run("pnpm", ["install", "--ignore-scripts"], { cwd: app });
run("node", ["smoke.mjs"], { cwd: app });
const gatewayPort = await freePort();
await writeFile(
  join(app, "surface-gateway-cli-smoke.mjs"),
  `import { runSurfaceGatewayCli } from "@plingjs/surface-gateway";

let running;
try {
  running = await runSurfaceGatewayCli({
    env: {
      SURFACE_ADMIN_TOKEN: "pack-smoke-admin-token",
      SURFACE_HOST: "127.0.0.1",
      SURFACE_PORT: ${JSON.stringify(String(gatewayPort))},
    },
    stderr: { write: () => true },
  });
  const response = await fetch(new URL("/health", running.baseUrl));
  const health = await response.json();
  if (!response.ok || health.service !== "pling-surface-gateway" || health.version !== "0.1.0-alpha.9") {
    throw new Error("surface-gateway CLI health check failed: " + response.status + " " + JSON.stringify(health));
  }
} finally {
  await running?.stop("pack-smoke");
}
`,
);
run("node", ["surface-gateway-cli-smoke.mjs"], { cwd: app });
run("pnpm", ["exec", "vue-tsc", "--noEmit", "-p", "tsconfig.json"], { cwd: app });
run("pnpm", ["exec", "vite", "build"], { cwd: app });

const built = await readFile(join(app, "dist/index.html"), "utf8");
if (!built.includes('id="app"')) throw new Error("Vite 产物缺少挂载点");
const assets = await readdir(join(app, "dist/assets"));
let bundleText = "";
for (const file of assets.filter((entry) => entry.endsWith(".js"))) {
  bundleText += await readFile(join(app, "dist/assets", file), "utf8");
}
if (!bundleText.includes("https://env.example/v1") || !bundleText.includes("pack-smoke-model")) {
  throw new Error("发布包没有读取消费方的 Vite 环境变量");
}

console.log(`✓ 发布包冒烟通过：${ALL_PACKAGES.join(" / ")}`);

// Vue 2.7 cannot share the same `vue` dependency slot as Vue 3. Give the legacy
// adapter its own consumer project instead of weakening either peer range.
const vue2App = join(temp, "vue2-app");
await mkdir(join(vue2App, "src"), { recursive: true });
await writeFile(
  join(vue2App, "package.json"),
  `${JSON.stringify(
    {
      name: "pling-vue2-pack-smoke-app",
      private: true,
      type: "module",
      dependencies: {
        "@plingjs/core": `file:${tarballs["@plingjs/core"]}`,
        "@plingjs/ui": `file:${tarballs["@plingjs/ui"]}`,
        "@plingjs/dom": `file:${tarballs["@plingjs/dom"]}`,
        "@plingjs/agent": `file:${tarballs["@plingjs/agent"]}`,
        "@plingjs/vanilla": `file:${tarballs["@plingjs/vanilla"]}`,
        "@plingjs/vue2": `file:${tarballs["@plingjs/vue2"]}`,
        vue: "2.7.16",
      },
      devDependencies: {
        typescript: "^5",
        vite: "^6",
      },
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  join(vue2App, "pnpm-workspace.yaml"),
  `overrides:\n  "@plingjs/core": "file:${tarballs["@plingjs/core"]}"\n  "@plingjs/ui": "file:${tarballs["@plingjs/ui"]}"\n  "@plingjs/dom": "file:${tarballs["@plingjs/dom"]}"\n  "@plingjs/surface": "file:${tarballs["@plingjs/surface"]}"\n  "@plingjs/surface-browser": "file:${tarballs["@plingjs/surface-browser"]}"\n  "@plingjs/agent": "file:${tarballs["@plingjs/agent"]}"\n  "@plingjs/vanilla": "file:${tarballs["@plingjs/vanilla"]}"\n`,
);
await writeFile(
  join(vue2App, "vite.config.mjs"),
  `import { defineConfig } from "vite";

export default defineConfig({
  build: { outDir: "dist", emptyOutDir: true },
});
`,
);
await writeFile(
  join(vue2App, "index.html"),
  '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>\n',
);
await writeFile(
  join(vue2App, "src/main.ts"),
  `import Vue from "vue";
import type { VNode } from "vue";
import { createPling, useAgentState } from "@plingjs/vue2";

const pling = createPling({ onWarn: () => {} });
Vue.use(pling.plugin);

const App = Vue.extend({
  render(h: (tag: string, data: Record<string, unknown>, children: string) => VNode): VNode {
    return h("button", {
      directives: [{ name: "tool", value: { id: "vue2_smoke", desc: "Vue 2 smoke action" } }],
    }, "smoke");
  },
  mounted() {
    useAgentState("vue2_smoke", () => ({ ready: true }), { description: "Vue 2 smoke state" });
  },
});

new App({ el: "#app" });
`,
);
await writeFile(
  join(vue2App, "tsconfig.json"),
  `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
      },
      include: ["src/**/*.ts", "src/**/*.d.ts"],
    },
    null,
    2,
  )}\n`,
);
run("pnpm", ["install", "--ignore-scripts"], { cwd: vue2App });
run("pnpm", ["exec", "tsc", "--noEmit", "-p", "tsconfig.json"], { cwd: vue2App });
run("pnpm", ["exec", "vite", "build"], { cwd: vue2App });

const vue2Built = await readFile(join(vue2App, "dist/index.html"), "utf8");
if (!vue2Built.includes('id="app"')) throw new Error("Vue 2 Vite 产物缺少挂载点");
console.log("✓ Vue 2.7 发布包冒烟通过：install / typecheck / Vite build");

// React 16.3 has context and refs but no Hooks. The legacy entry must stay on
// React.createElement and must not pull in react/jsx-runtime or React 18 APIs.
const react16App = join(temp, "react16-app");
await mkdir(join(react16App, "src"), { recursive: true });
await writeFile(
  join(react16App, "package.json"),
  `${JSON.stringify(
    {
      name: "pling-react16-pack-smoke-app",
      private: true,
      type: "module",
      dependencies: {
        "@plingjs/core": `file:${tarballs["@plingjs/core"]}`,
        "@plingjs/ui": `file:${tarballs["@plingjs/ui"]}`,
        "@plingjs/dom": `file:${tarballs["@plingjs/dom"]}`,
        "@plingjs/surface": `file:${tarballs["@plingjs/surface"]}`,
        "@plingjs/surface-browser": `file:${tarballs["@plingjs/surface-browser"]}`,
        "@plingjs/agent": `file:${tarballs["@plingjs/agent"]}`,
        "@plingjs/vanilla": `file:${tarballs["@plingjs/vanilla"]}`,
        "@plingjs/react": `file:${tarballs["@plingjs/react"]}`,
        react: "16.3.0",
        "react-dom": "16.3.0",
      },
      devDependencies: {
        "@types/react": "^16.14.70",
        "@types/react-dom": "^16.9.25",
        jsdom: "^25",
        typescript: "^5",
        vite: "^6",
      },
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  join(react16App, "pnpm-workspace.yaml"),
  `overrides:\n  "@plingjs/core": "file:${tarballs["@plingjs/core"]}"\n  "@plingjs/ui": "file:${tarballs["@plingjs/ui"]}"\n  "@plingjs/dom": "file:${tarballs["@plingjs/dom"]}"\n  "@plingjs/surface": "file:${tarballs["@plingjs/surface"]}"\n  "@plingjs/surface-browser": "file:${tarballs["@plingjs/surface-browser"]}"\n  "@plingjs/agent": "file:${tarballs["@plingjs/agent"]}"\n  "@plingjs/vanilla": "file:${tarballs["@plingjs/vanilla"]}"\n`,
);
await writeFile(
  join(react16App, "vite.config.mjs"),
  `import { defineConfig } from "vite";

export default defineConfig({
  esbuild: {
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  },
  build: { outDir: "dist", emptyOutDir: true },
});
`,
);
await writeFile(
  join(react16App, "index.html"),
  '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.tsx"></script></body></html>\n',
);
await writeFile(
  join(react16App, "src/main.tsx"),
  `import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  AgentDock,
  createPling,
  PlingAction,
  PlingProvider,
  PlingRecord,
  PlingScope,
  PlingState,
  PlingTool,
} from "@plingjs/react/legacy";

const pling = createPling({ onWarn: () => {} });
const smoke = globalThis as typeof globalThis & {
  __pling?: typeof pling;
  __clicked?: number;
  __unmount?: () => void;
};
smoke.__pling = pling;
smoke.__clicked = 0;

class App extends React.Component<{}, { count: number }> {
  state = { count: 0 };

  render() {
    return (
      <PlingProvider pling={pling}>
        <PlingState name="counter" source={() => ({ count: this.state.count })} description="Counter state" />
        <PlingAction options={{ id: "legacy_smoke_action", desc: "Legacy smoke action", run: () => ({ ok: true }) }} />
        <PlingScope options={{ id: "legacy_smoke", label: "Legacy smoke" }}>
          {(scopeRef) => (
            <section ref={scopeRef}>
              <PlingTool options={{ id: "legacy_smoke_increment", desc: "Increment the counter" }}>
                {(toolRef) => (
                  <button
                    ref={toolRef}
                    onClick={() => {
                      this.setState({ count: this.state.count + 1 });
                      smoke.__clicked = (smoke.__clicked ?? 0) + 1;
                    }}
                  >
                    Count: {this.state.count}
                  </button>
                )}
              </PlingTool>
              <PlingRecord value={{ id: "row-1", fields: { title: "Row" } }}>
                {(rowRef) => <article ref={rowRef}>Row</article>}
              </PlingRecord>
            </section>
          )}
        </PlingScope>
        <AgentDock layout="inline" />
      </PlingProvider>
    );
  }
}

const host = document.getElementById("app")!;
ReactDOM.render(<App />, host);
smoke.__unmount = () => ReactDOM.unmountComponentAtNode(host);
`,
);
await writeFile(
  join(react16App, "tsconfig.json"),
  `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        jsx: "react",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
      },
      include: ["src/**/*.ts", "src/**/*.tsx"],
    },
    null,
    2,
  )}\n`,
);
run("pnpm", ["install", "--ignore-scripts"], { cwd: react16App });
run("pnpm", ["exec", "tsc", "--noEmit", "-p", "tsconfig.json"], { cwd: react16App });
run("pnpm", ["exec", "vite", "build"], { cwd: react16App });

const react16Built = await readFile(join(react16App, "dist/index.html"), "utf8");
if (!react16Built.includes('id="app"')) throw new Error("React 16.3 Vite 产物缺少挂载点");
let react16Bundle = "";
const react16Assets = (await readdir(join(react16App, "dist/assets"))).filter((entry) => entry.endsWith(".js"));
const react16Asset = react16Assets[0];
if (!react16Asset) throw new Error("React 16.3 Vite 产物缺少 JavaScript 入口");
for (const file of react16Assets) {
  react16Bundle += await readFile(join(react16App, "dist/assets", file), "utf8");
}
if (react16Bundle.includes("react/jsx-runtime")) {
  throw new Error("React 16.3 发布包仍引用了 react/jsx-runtime");
}
await writeFile(
  join(react16App, "runtime-smoke.mjs"),
  `import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: "http://localhost/",
});

Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  MutationObserver: dom.window.MutationObserver,
  getComputedStyle: dom.window.getComputedStyle,
  requestAnimationFrame: (callback) => setTimeout(callback, 0),
  cancelAnimationFrame: (handle) => clearTimeout(handle),
});
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
for (const name of [
  "HTMLButtonElement",
  "HTMLDivElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "HTMLAnchorElement",
  "HTMLDialogElement",
  "SVGElement",
  "ShadowRoot",
  "CustomEvent",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "FocusEvent",
  "NodeFilter",
  "DocumentFragment",
]) {
  if (dom.window[name]) Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.window.requestAnimationFrame = globalThis.requestAnimationFrame;
globalThis.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.IntersectionObserver = globalThis.ResizeObserver;
dom.window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

await import(new URL("./dist/assets/${react16Asset}", import.meta.url).href);

const pling = globalThis.__pling;
if (!pling) throw new Error("React 16.3 bundle did not expose the Pling runtime");
const snapshot = pling.registry.snapshot();
if (!snapshot.actions.some((action) => action.id === "legacy_smoke_increment")) {
  throw new Error("React 16.3 legacy PlingTool did not register an action");
}
if (!snapshot.actions.some((action) => action.id === "legacy_smoke_action")) {
  throw new Error("React 16.3 legacy PlingAction did not register an action");
}
if (snapshot.state?.counter?.count !== 0) {
  throw new Error("React 16.3 legacy PlingState did not expose state");
}
if (snapshot.records.length !== 1) {
  throw new Error("React 16.3 legacy PlingRecord did not register a record");
}

document.querySelector("section button")?.click();
if (globalThis.__clicked !== 1) throw new Error("React 16.3 legacy click action did not run");

const { createExecutor, createPolicy } = await import("@plingjs/core");
const executor = createExecutor({ registry: pling.registry, policy: createPolicy(async () => true) });
const call = await executor.execute("legacy_smoke_action", "{}");
if (call.result?.ok !== true) throw new Error("React 16.3 legacy function action did not run");

globalThis.__unmount?.();
if (pling.registry.snapshot().actions.length !== 0 || pling.registry.snapshot().records.length !== 0) {
  throw new Error("React 16.3 legacy declarations were not cleaned up on unmount");
}
console.log("✓ React 16.3 legacy runtime smoke passed");
`,
);
run("node", ["runtime-smoke.mjs"], { cwd: react16App });
console.log("✓ React 16.3 legacy 发布包冒烟通过：install / typecheck / Vite build / runtime");
await rm(temp, { recursive: true, force: true });

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  if (!port) throw new Error("Could not allocate a free port for the Surface Gateway smoke test");
  return port;
}
