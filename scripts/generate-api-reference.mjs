#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { API_ENTRY_DETAILS } from "../content/api-details.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_FILE = join(ROOT, "content", "api-surface.json");
const WEBSITE = join(ROOT, "website");

const PACKAGE_ROOTS = {
  "@plingjs/core": { directory: "packages/core", entry: "src/index.ts" },
  "@plingjs/dom": { directory: "packages/dom", entry: "src/index.ts" },
  "@plingjs/agent": { directory: "packages/agent", entry: "src/index.ts" },
  "@plingjs/ui": { directory: "packages/ui", entry: "src/index.ts" },
  "@plingjs/vanilla": { directory: "packages/vanilla", entry: "src/index.ts" },
  "@plingjs/react": { directory: "packages/react", entry: "src/index.ts" },
  "@plingjs/vue": { directory: "packages/vue", entry: "src/index.ts" },
  "@plingjs/vue2": { directory: "packages/vue2", entry: "src/index.ts" },
};

const ADAPTER_PACKAGES = new Set(["@plingjs/vue", "@plingjs/react", "@plingjs/vue2", "@plingjs/vanilla"]);
const SHARED_PACKAGES = new Set(["@plingjs/core", "@plingjs/agent", "@plingjs/dom", "@plingjs/ui"]);

const ADAPTER_IDS = {
  vue3: { en: "Vue 3", zh: "Vue 3", commentZh: "Vue 3" },
  react: { en: "React", zh: "React", commentZh: "React" },
  vue2: { en: "Vue 2.7", zh: "Vue 2.7", commentZh: "Vue 2.7" },
  vanilla: { en: "Vanilla JS", zh: "原生 JS", commentZh: "原生 JS" },
};

const ADAPTER_REFERENCE_ROUTE = {
  vue3: "/reference/vue-3-adapter",
  react: "/reference/react-adapter",
  vue2: "/reference/vue-2-adapter",
  vanilla: "/reference/vanilla-jquery-adapter",
};

const ADAPTER_PAGES = [
  {
    id: "vue3",
    slug: "vue-3",
    package: "@plingjs/vue",
    title: "Vue 3 API",
    titleZh: "Vue 3 API",
    intro:
      "The complete Vue 3 surface: application setup, directives, composables, components, and the shared option types they use. Every signature below is the Vue 3 form.",
    introZh:
      "Vue 3 的完整 API：应用初始化、指令、组合式函数、组件，以及它们使用的共享选项类型。下面出现的签名都按 Vue 3 的写法给出。",
    peer: { vue: "^3" },
    example: `import { createPling, AgentDock } from "@plingjs/vue";\n\nconst pling = createPling({ namespace: "todo" });\napp.use(pling.plugin);`,
  },
  {
    id: "react",
    slug: "react",
    package: "@plingjs/react",
    title: "React API",
    titleZh: "React API",
    intro:
      "The complete React surface: provider setup, declaration hooks, components, and the shared option types they use. Every signature below is the React form.",
    introZh:
      "React 的完整 API：Provider、声明 Hook、组件，以及它们使用的共享选项类型。下面出现的签名都按 React 的写法给出。",
    peer: { react: ">=18" },
    example: `import { createPling, PlingProvider, AgentDock } from "@plingjs/react";\n\nconst pling = createPling({ namespace: "todo" });\n\n<PlingProvider pling={pling}>\n  <AgentDock />\n</PlingProvider>;`,
  },
  {
    id: "vue2",
    slug: "vue-2",
    package: "@plingjs/vue2",
    title: "Vue 2.7 API",
    titleZh: "Vue 2.7 API",
    intro:
      "The Vue 2.7 adapter keeps the DOM-first runtime and exposes directives plus the shared DOM dock. Every signature below is the Vue 2.7 form.",
    introZh:
      "Vue 2.7 适配器沿用 DOM 运行时，提供指令与共享的 DOM 问答入口。下面出现的签名都按 Vue 2.7 的写法给出。",
    peer: { vue: "^2.7.0" },
    example: `import Vue from "vue";\nimport { createPling } from "@plingjs/vue2";\n\nconst pling = createPling({ namespace: "todo" });\nVue.use(pling.plugin);\npling.dock();`,
  },
  {
    id: "vanilla",
    slug: "vanilla",
    package: "@plingjs/vanilla",
    title: "Vanilla JS API",
    titleZh: "原生 JS API",
    intro:
      "The DOM-first API for plain JavaScript and jQuery-era pages. Declarations take an element and return an unbind function; the dock is created with pling.dock().",
    introZh:
      "面向原生 JavaScript 与 jQuery 时代页面的 DOM API。声明方法接收元素并返回解绑函数；问答入口通过 pling.dock() 创建。",
    peer: {},
    example: `import { createPling } from "@plingjs/vanilla";\n\nconst pling = createPling({ namespace: "todo" });\npling.tool(document.querySelector("#add"), {\n  id: "add",\n  desc: "添加一条待办",\n});`,
  },
];

const SHARED_PAGE = {
  id: "shared",
  slug: "shared",
  package: "@plingjs/core",
  title: "Shared package API",
  titleZh: "共享包 API",
  intro:
    "Runtime, page-continuity, testing, and diagnostic APIs shared by the four adapters. Import these from their owning package; no adapter re-implementation is involved.",
  introZh:
    "四个适配器共用的运行时、页面连续性、测试与诊断 API。请从对应的共享包导入；这里没有第二套适配器实现。",
  peer: {},
  example: `import { createExecutor, createPolicy } from "@plingjs/core";\nimport { createReplayLlm } from "@plingjs/agent";`,
};

const PAGES = [...ADAPTER_PAGES, SHARED_PAGE];
const FRAMEWORK_CATEGORIES = new Set(["entry", "declarations", "types", "ui", "page"]);
const NO_PARAMETER_ENTRIES = new Set(["usePling", "usePlingUi", "plugin", "destroy", "defaultSettle"]);

const SUPPORT = {
  native: { en: "Native", zh: "原生" },
  alias: { en: "Alias", zh: "别名" },
  partial: { en: "Partial", zh: "部分" },
  core: { en: "Shared package", zh: "共享包" },
  none: { en: "—", zh: "—" },
};

const KIND = {
  function: { en: "Function", zh: "函数" },
  component: { en: "Component", zh: "组件" },
  interface: { en: "Interface", zh: "接口" },
  type: { en: "Type", zh: "类型" },
  declaration: { en: "Declaration", zh: "声明" },
  plugin: { en: "Plugin", zh: "插件" },
  method: { en: "Method", zh: "方法" },
  class: { en: "Class", zh: "类" },
};

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function readManifest() {
  return readJson(MANIFEST_FILE);
}

function anchorOf(entry) {
  return entry.anchor || entry.id.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function cell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function isAvailable(status) {
  return status && status !== "none";
}

function statusLabel(status, locale) {
  return (SUPPORT[status] ?? SUPPORT.none)[locale];
}

function kindLabel(kind, locale) {
  return (KIND[kind] ?? { en: kind, zh: kind })[locale];
}

function entryName(entry, locale) {
  return locale === "zh" ? entry.nameZh || entry.name : entry.name;
}

function pageName(page, locale) {
  return locale === "zh" ? page.titleZh : page.title;
}

function pageRoute(page, locale = "en") {
  return `${locale === "zh" ? "/zh" : ""}/reference/api/${page.slug}`;
}

function pageFile(page, locale = "en") {
  return join(WEBSITE, locale === "zh" ? "zh" : "", "reference", "api", `${page.slug}.md`);
}

function pageJsonRoute(page, locale = "en") {
  return `${locale === "zh" ? "/zh" : ""}/api-index/${page.slug}.json`;
}

function overviewJsonRoute(locale = "en") {
  return `${locale === "zh" ? "/zh" : ""}/api-index.json`;
}

function referenceForPage(entry, page) {
  if (!entry.ref) return null;
  const route = ADAPTER_REFERENCE_ROUTE[page.id];
  const pointsToAdapter = Object.values(ADAPTER_REFERENCE_ROUTE).includes(entry.ref);
  return route && pointsToAdapter ? route : entry.ref;
}

export function apiPageLinks(locale = "en") {
  const isZh = locale === "zh";
  return [
    {
      id: "overview",
      title: isZh ? "API 参考" : "API reference",
      route: isZh ? "/zh/reference/api/" : "/reference/api/",
      jsonRoute: overviewJsonRoute(locale),
      package: null,
    },
    ...PAGES.map((page) => ({
      id: page.id,
      title: pageName(page, locale),
      route: pageRoute(page, locale),
      jsonRoute: pageJsonRoute(page, locale),
      package: page.package,
    })),
  ];
}

function outputRoutes() {
  return [
    ...PAGES.flatMap((page) => [pageFile(page, "en"), pageFile(page, "zh")]),
    join(WEBSITE, "reference", "api", "index.md"),
    join(WEBSITE, "zh", "reference", "api", "index.md"),
    ...PAGES.flatMap((page) => [
      join(WEBSITE, "public", "api-index", `${page.slug}.json`),
      join(WEBSITE, "public", "zh", "api-index", `${page.slug}.json`),
    ]),
    join(WEBSITE, "public", "api-index.json"),
    join(WEBSITE, "public", "zh", "api-index.json"),
  ];
}

function versionInfo(manifest) {
  const packages = {};
  for (const [name, config] of Object.entries(PACKAGE_ROOTS)) {
    packages[name] = readJson(join(ROOT, config.directory, "package.json"));
  }

  const versions = new Set(ADAPTER_PAGES.map((page) => packages[page.package].version));
  if (versions.size !== 1) {
    throw new Error(`Adapter package versions differ: ${[...versions].join(", ")}`);
  }

  const version = [...versions][0];
  if (manifest.version !== version) {
    throw new Error(`content/api-surface.json declares ${manifest.version}, but adapter packages are ${version}`);
  }

  return {
    version,
    adapters: ADAPTER_PAGES.map((page) => ({
      name: page.package,
      version: packages[page.package].version,
      peer: packages[page.package].peerDependencies ?? {},
    })),
  };
}

function routeFile(route) {
  const path = route.replace(/^\//, "");
  const direct = join(WEBSITE, `${path}.md`);
  const index = join(WEBSITE, path, "index.md");
  if (existsSync(direct)) return direct;
  if (existsSync(index)) return index;
  return null;
}

function entryApplies(entry, page) {
  if (page.id === "shared") return Boolean(entry.signatures?.core);
  return isAvailable(entry.support?.[page.id]);
}

function categoriesForPage(manifest, page) {
  return manifest.categories
    .filter((category) => page.id === "shared" || FRAMEWORK_CATEGORIES.has(category.id))
    .map((category) => ({
      ...category,
      entries: category.entries.filter((entry) => entryApplies(entry, page)),
    }))
    .filter((category) => category.entries.length > 0);
}

function importsForPage(entry, page) {
  const imports = entry.imports ?? [];
  if (page.id === "shared") return imports.filter((name) => SHARED_PACKAGES.has(name));
  return imports.filter((name) => name === page.package || SHARED_PACKAGES.has(name));
}

function signatureForPage(entry, page) {
  return page.id === "shared" ? entry.signatures?.core : entry.signatures?.[page.id] || entry.signatures?.core;
}

function detailFor(entry, page) {
  return API_ENTRY_DETAILS[entry.id] ?? {};
}

function localizedList(detail, field, page) {
  if (!detail?.[field]) return [];
  return detail[field][page.id] ?? detail[field].all ?? detail[field].core ?? [];
}

function validateManifest(manifest) {
  const problems = [];
  const anchors = new Set();
  const ids = new Set();

  if (!Array.isArray(manifest.categories) || manifest.categories.length === 0) {
    problems.push("content/api-surface.json: categories must be a non-empty array");
    return problems;
  }

  for (const category of manifest.categories) {
    if (!category.id || !category.title || !category.titleZh) {
      problems.push(`API category ${category.id ?? "(missing id)"}: id, title, and titleZh are required`);
    }
    if (!Array.isArray(category.entries) || category.entries.length === 0) {
      problems.push(`API category ${category.id}: entries must be a non-empty array`);
      continue;
    }

    for (const entry of category.entries) {
      const label = entry.id || "(missing id)";
      if (!entry.id || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(entry.id)) {
        problems.push(`API entry ${label}: id must be camelCase or kebab-case`);
      }
      if (!entry.name || !entry.kind || !entry.summary || !entry.summaryZh) {
        problems.push(`API entry ${label}: name, kind, summary, and summaryZh are required`);
      }
      if (!KIND[entry.kind]) problems.push(`API entry ${label}: unknown kind ${entry.kind}`);
      if (entry.nameZh !== undefined && (typeof entry.nameZh !== "string" || !entry.nameZh.trim())) {
        problems.push(`API entry ${label}: nameZh must be a non-empty string when provided`);
      }
      if (ids.has(entry.id)) problems.push(`API entry ${label}: duplicate id`);
      ids.add(entry.id);

      const anchor = anchorOf(entry);
      if (!/^[a-z0-9][a-z0-9-]*$/.test(anchor)) problems.push(`API entry ${label}: invalid anchor ${anchor}`);
      if (anchors.has(anchor)) problems.push(`API entry ${label}: duplicate anchor ${anchor}`);
      anchors.add(anchor);

      if (!entry.support || typeof entry.support !== "object") {
        problems.push(`API entry ${label}: support matrix is required`);
      } else {
        for (const adapter of Object.keys(ADAPTER_IDS)) {
          const status = entry.support[adapter];
          if (!SUPPORT[status]) problems.push(`API entry ${label}: invalid ${adapter} support status ${status}`);
        }
      }

      if (!entry.imports?.length) problems.push(`API entry ${label}: at least one import path is required`);
      for (const name of entry.imports ?? []) {
        if (!PACKAGE_ROOTS[name]) problems.push(`API entry ${label}: unknown import package ${name}`);
      }

      if (!entry.signatures || typeof entry.signatures !== "object" || Object.keys(entry.signatures).length === 0) {
        problems.push(`API entry ${label}: at least one signature is required`);
      }
      for (const [name, signature] of Object.entries(entry.signatures ?? {})) {
        if (name !== "core" && !ADAPTER_IDS[name]) {
          problems.push(`API entry ${label}: unknown signature target ${name}`);
        }
        if (typeof signature !== "string" || !signature.trim()) problems.push(`API entry ${label}: empty ${name} signature`);
        if (String(signature).includes("...")) problems.push(`API entry ${label}: ${name} signature uses an ellipsis instead of a real shape`);
        if (/same shape/i.test(String(signature))) problems.push(`API entry ${label}: ${name} signature refers to an unstated "same shape"`);
      }

      if (!entry.ref || !entry.ref.startsWith("/reference/")) {
        problems.push(`API entry ${label}: ref must point into /reference/`);
      } else if (!routeFile(entry.ref)) {
        problems.push(`API entry ${label}: reference route does not exist: ${entry.ref}`);
      }

      for (const symbol of entry.symbols ?? []) {
        if (!PACKAGE_ROOTS[symbol.package]) problems.push(`API entry ${label}: unknown symbol package ${symbol.package}`);
        if (!symbol.name) problems.push(`API entry ${label}: symbol name is required`);
      }
    }
  }

  for (const page of PAGES) {
    const categories = categoriesForPage(manifest, page);
    if (categories.length === 0) problems.push(`API page ${page.id}: no entries were assigned`);
  }

  return problems;
}

function validateDetails(manifest) {
  const problems = [];
  const entries = new Map(
    manifest.categories.flatMap((category) => category.entries.map((entry) => [entry.id, entry])),
  );

  for (const entry of entries.values()) {
    if (!API_ENTRY_DETAILS[entry.id]) {
      problems.push(`API details ${entry.id}: missing; every public entry needs parameters and examples`);
    }
  }

  for (const [id, detail] of Object.entries(API_ENTRY_DETAILS)) {
    if (!entries.has(id)) {
      problems.push(`API details ${id}: entry does not exist in api-surface.json`);
      continue;
    }
    for (const field of ["parameters", "examples"]) {
      const groups = detail[field];
      if (!groups || typeof groups !== "object" || Array.isArray(groups)) {
        problems.push(`API details ${id}: ${field} must be an object keyed by page`);
        continue;
      }
      for (const [target, rows] of Object.entries(groups)) {
        if (!["all", "core", ...Object.keys(ADAPTER_IDS), "shared"].includes(target)) {
          problems.push(`API details ${id}: unknown ${field} target ${target}`);
        }
        if (!Array.isArray(rows)) {
          problems.push(`API details ${id}: ${field}.${target} must be an array`);
          continue;
        }
        const names = new Set();
        for (const [index, row] of rows.entries()) {
          const label = `${id}.${field}.${target}[${index}]`;
          if (field === "parameters") {
            if (!row.name || !row.type || !row.description || !row.descriptionZh) {
              problems.push(`${label}: name, type, description, and descriptionZh are required`);
            }
            if (![true, false, "conditional"].includes(row.required)) {
              problems.push(`${label}: required must be true, false, or "conditional"`);
            }
            if (names.has(row.name)) problems.push(`${label}: duplicate parameter name ${row.name}`);
            names.add(row.name);
          } else if (!row.title || !row.titleZh || !row.code) {
            problems.push(`${label}: title, titleZh, and code are required`);
          }
        }
      }
    }

    const entry = entries.get(id);
    for (const page of PAGES.filter((candidate) => entryApplies(entry, candidate))) {
      if (!localizedList(detail, "examples", page).length) {
        problems.push(`API details ${id}: no example resolves for ${page.id}`);
      }
      if (!localizedList(detail, "parameters", page).length && !NO_PARAMETER_ENTRIES.has(id)) {
        problems.push(`API details ${id}: no parameter rows resolve for ${page.id}; use the no-argument allowlist only for true zero-argument APIs`);
      }
    }
  }
  return problems;
}

function packageExports() {
  const requireFromVue = createRequire(join(ROOT, "packages", "vue", "package.json"));
  const ts = requireFromVue("typescript");
  const files = Object.values(PACKAGE_ROOTS).map((config) => join(ROOT, config.directory, config.entry));
  const options = {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    skipLibCheck: true,
    noEmit: true,
    strict: true,
    types: [],
  };
  const program = ts.createProgram(files, options);
  const checker = program.getTypeChecker();
  const exportsByPackage = new Map();

  for (const [name, config] of Object.entries(PACKAGE_ROOTS)) {
    const source = program.getSourceFile(join(ROOT, config.directory, config.entry));
    const symbol = source ? checker.getSymbolAtLocation(source) : undefined;
    const names = symbol ? checker.getExportsOfModule(symbol).map((item) => item.getName()) : [];
    exportsByPackage.set(name, new Set(names));
  }
  return exportsByPackage;
}

function validateSymbols(manifest) {
  const problems = [];
  let exportsByPackage;
  try {
    exportsByPackage = packageExports();
  } catch (error) {
    return [`API symbol check could not start: ${error instanceof Error ? error.message : String(error)}`];
  }

  for (const category of manifest.categories) {
    for (const entry of category.entries) {
      for (const symbol of entry.symbols ?? []) {
        const names = exportsByPackage.get(symbol.package);
        if (!names) continue;
        if (!names.has(symbol.name)) {
          problems.push(`API entry ${entry.id}: ${symbol.package} no longer exports ${symbol.name}`);
        }
      }
    }
  }
  return problems;
}

function signatureBlock(entry, page, locale) {
  const signature = signatureForPage(entry, page);
  if (!signature) return "";
  const target = page.id === "shared" ? (locale === "zh" ? "共享包" : "Shared package") : ADAPTER_IDS[page.id].en;
  return `\`\`\`ts\n// ${target}\n${signature}\n\`\`\`\n`;
}

function parameterTable(rows, locale) {
  if (!rows?.length) return "";
  const isZh = locale === "zh";
  const header = isZh
    ? "| 参数 | 类型 | 必填 | 默认值 | 说明 |\n| --- | --- | --- | --- | --- |"
    : "| Parameter | Type | Required | Default | Description |\n| --- | --- | --- | --- | --- |";
  const body = rows.map((row) => {
    const required =
      row.required === true
        ? isZh
          ? "是"
          : "Yes"
        : row.required === "conditional"
          ? isZh
            ? "条件必填"
            : "Conditional"
          : isZh
            ? "否"
            : "No";
    const hasDefault = row.defaultValue !== undefined && row.defaultValue !== null && row.defaultValue !== "";
    const defaultValue = hasDefault ? `\`${cell(row.defaultValue)}\`` : "—";
    const description = isZh ? row.descriptionZh : row.description;
    return `| \`${cell(row.name)}\` | \`${cell(row.type)}\` | ${required} | ${defaultValue} | ${cell(description)} |`;
  });
  return [header, ...body].join("\n");
}

function exampleBlocks(rows, locale) {
  if (!rows?.length) return "";
  const isZh = locale === "zh";
  return rows
    .map((row, index) => {
      const title = isZh ? row.titleZh : row.title;
      return `**${isZh ? `示例 ${index + 1}` : `Example ${index + 1}`} · ${title}**\n\n\`\`\`${row.lang || "ts"}\n${row.code}\n\`\`\`\n`;
    })
    .join("\n");
}

function entrySection(entry, page, locale) {
  const isZh = locale === "zh";
  const detail = detailFor(entry, page);
  const summary = isZh ? entry.summaryZh : entry.summary;
  const lines = [`<a id="api-${anchorOf(entry)}"></a>`, "", `### \`${entryName(entry, locale)}\``, "", summary, ""];
  const imports = importsForPage(entry, page);
  if (imports.length) {
    lines.push(`**${isZh ? "导入" : "Imports"}**`, "", imports.map((value) => `\`${value}\``).join(" · "), "");
  }

  const signatures = signatureBlock(entry, page, locale);
  if (signatures) lines.push(`**${isZh ? "调用方式" : "Signature"}**`, "", signatures);

  const parameters = localizedList(detail, "parameters", page);
  if (parameters.length) {
    lines.push(`**${isZh ? "参数与选项" : "Parameters and options"}**`, "", parameterTable(parameters, locale), "");
  } else if (NO_PARAMETER_ENTRIES.has(entry.id)) {
    lines.push(`**${isZh ? "参数" : "Parameters"}**`, "", isZh ? "无。" : "None.", "");
  }

  if (entry.definition) {
    lines.push(`**${isZh ? "类型结构" : "Type shape"}**`, "", `\`\`\`ts\n${entry.definition}\n\`\`\`\n`);
  }

  const returns = isZh ? entry.returnsZh : entry.returns;
  if (returns) lines.push(`**${isZh ? "返回值" : "Returns"}**`, "", returns, "");

  const defaults = isZh ? entry.defaultsZh : entry.defaults;
  if (defaults?.length) {
    lines.push(`**${isZh ? "默认行为" : "Defaults"}**`, "", ...defaults.map((value) => `- ${value}`), "");
  }

  const examples = exampleBlocks(localizedList(detail, "examples", page), locale);
  if (examples) lines.push(examples);

  const reference = referenceForPage(entry, page);
  if (reference) {
    lines.push(
      `**${isZh ? "精确契约" : "Canonical reference"}**`,
      "",
      `[${isZh ? "查看对应参考页" : "Open the corresponding reference"}](${isZh ? `/zh${reference}` : reference})`,
      "",
    );
  }
  return lines.join("\n");
}

function quickTable(category, page, locale) {
  const isZh = locale === "zh";
  const header = isZh
    ? "| API | 类型 | 参考 |\n| --- | --- | --- |"
    : "| API | Kind | Reference |\n| --- | --- | --- |";
  const rows = category.entries.map((entry) => {
    const name = `[${cell(entryName(entry, locale))}](#api-${anchorOf(entry)})`;
    const reference = referenceForPage(entry, page);
    const ref = reference ? `[${isZh ? "参考" : "Reference"}](${isZh ? `/zh${reference}` : reference})` : "—";
    return `| ${name} | ${kindLabel(entry.kind, locale)} | ${ref} |`;
  });
  return [header, ...rows].join("\n");
}

function versionTable(info, locale) {
  const isZh = locale === "zh";
  const peers = info.adapters.map((adapter) => {
    const labels = Object.entries(adapter.peer).map(([name, range]) => `${name} ${range}`);
    return `| \`${adapter.name}\` | \`${adapter.version}\` | ${labels.length ? labels.map((value) => `\`${value}\``).join(", ") : "—"} |`;
  });
  return [
    isZh
      ? "| 包 | 版本 | 对等依赖 |\n| --- | --- | --- |"
      : "| Package | Version | Peer dependencies |\n| --- | --- | --- |",
    ...peers,
  ].join("\n");
}

function stabilityBlock(manifest, locale) {
  return locale === "zh"
    ? `当前包版本为 \`${manifest.version}\`；稳定性为 **preview**。这是 pre-1.0 alpha，次要版本仍可能改变 API。`
    : `The current package version is \`${manifest.version}\`; stability is **preview**. This is a pre-1.0 alpha, so a minor release may still change the API.`;
}

function pageBody(manifest, info, page, locale, categories) {
  const isZh = locale === "zh";
  const title = pageName(page, locale);
  const intro = isZh ? page.introZh : page.intro;
  const packageLine = page.id === "shared"
    ? isZh
      ? "本页覆盖 `@plingjs/core`、`@plingjs/agent`、`@plingjs/dom` 与 `@plingjs/ui` 中的共享公开 API。"
      : "This page covers public APIs in `@plingjs/core`, `@plingjs/agent`, `@plingjs/dom`, and `@plingjs/ui`."
    : isZh
      ? `本页只列 \`${page.package}\` 的入口，以及与它一起使用的共享包类型。`
      : `This page lists only \`${page.package}\` entry points, plus the shared-package types used with them.`;
  const nav = isZh
    ? `[API 总览](/zh/reference/api/) · [共享包 API](/zh/reference/api/shared)`
    : `[API overview](/reference/api/) · [Shared package API](/reference/api/shared)`;
  const categorySections = categories
    .map((category) => {
      const heading = isZh ? category.titleZh : category.title;
      const summary = isZh ? category.summaryZh : category.summary;
      const entries = category.entries.map((entry) => entrySection(entry, page, locale)).join("\n\n");
      return `## ${heading}\n\n${summary}\n\n${quickTable(category, page, locale)}\n\n${entries}`;
    })
    .join("\n\n");
  const peer = Object.entries(page.peer).map(([name, range]) => `${name} ${range}`).join(", ") || "—";

  return `---\ntitle: ${JSON.stringify(title)}\nstatus: navigation\nrelease: 0.1\nlocale: ${locale}\n---\n<!-- generated:api-index -->\n\n# ${title}\n\n${intro}\n\n${packageLine}\n\n${nav}\n\n| ${isZh ? "包" : "Package"} | ${isZh ? "对等依赖" : "Peer dependencies"} | ${isZh ? "版本" : "Version"} |\n| --- | --- | --- |\n| \`${page.package}\` | ${peer} | \`${info.version}\` |\n\n${stabilityBlock(manifest, locale)}\n\n## ${isZh ? "最小示例" : "Minimal example"}\n\n\`\`\`ts\n${page.example}\n\`\`\`\n\n${categorySections}\n\n## ${isZh ? "版本与兼容性" : "Version and compatibility"}\n\n${versionTable(info, locale)}\n\n| ${isZh ? "项目" : "Item"} | ${isZh ? "值" : "Value"} |\n| --- | --- |\n| ${isZh ? "引入版本" : "Introduced"} | \`${manifest.since}\` |\n| ${isZh ? "稳定性" : "Stability"} | ${isZh ? "pre-1.0 alpha；次要版本可能改变 API" : "Pre-1.0 alpha; a minor release may change the API"} |\n\n## ${isZh ? "机器可读副本" : "Machine-readable copy"}\n\n- [${isZh ? "本页 JSON" : "JSON for this page"}](${pageJsonRoute(page, locale)})\n- [${isZh ? "API 总览 JSON" : "API overview JSON"}](${overviewJsonRoute(locale)})\n`;
}

function overviewPage(manifest, info, locale) {
  const isZh = locale === "zh";
  const title = isZh ? "API 参考" : "API reference";
  const rows = ADAPTER_PAGES.map((page) => {
    const count = categoriesForPage(manifest, page).reduce((total, category) => total + category.entries.length, 0);
    return `| **${pageName(page, locale)}** | \`${page.package}\` | ${count} | [${isZh ? "打开" : "Open"}](${pageRoute(page, locale)}) |`;
  }).join("\n");
  const sharedCount = categoriesForPage(manifest, SHARED_PAGE).reduce(
    (total, category) => total + category.entries.length,
    0,
  );
  const intro = isZh
    ? "先选择你正在使用的框架。每个框架页只展示该框架的入口、选项、默认值与示例，不再把四种写法混在同一张表里。共享的运行时与测试 API 单独成页。"
    : "Choose the framework you are integrating. Each page contains only that framework's entry points, options, defaults, and examples; the four adapters are no longer mixed into one table. Shared runtime and testing APIs have their own page.";
  const reading = isZh
    ? "参数表是这里的重点。遇到某个选项时，先查它在当前框架页中的类型、必填性、默认值与适用场景；需要字段级语义或错误码时，再进入对应参考页。"
    : "The parameter tables are the main contract here. Look up a field's type, required status, default, and applicable scenario on the current framework page; follow the linked reference only when you need field-level semantics or error codes.";
  const categoryCount = manifest.categories.length;
  return `---\ntitle: ${JSON.stringify(title)}\nstatus: navigation\nrelease: 0.1\nlocale: ${locale}\n---\n<!-- generated:api-index -->\n\n# ${title}\n\n${intro}\n\n${reading}\n\n${isZh ? `共 **${PAGES.length}** 个 API 页面，覆盖 **${categoryCount}** 类能力；当前版本 \`${info.version}\`，稳定性为 **preview**。` : `There are **${PAGES.length}** API pages covering **${categoryCount}** capability groups; the current version is \`${info.version}\` with **preview** stability.`}\n\n## ${isZh ? "按框架查阅" : "Choose by framework"}\n\n| ${isZh ? "框架" : "Framework"} | ${isZh ? "包" : "Package"} | ${isZh ? "条目" : "Entries"} | ${isZh ? "页面" : "Page"} |\n| --- | --- | --- | --- |\n${rows}\n\n## ${isZh ? "共享包 API" : "Shared package API"}\n\n${isZh ? `运行时、页面连续性、测试与诊断 API 共用一套实现，共 **${sharedCount}** 个条目。` : `Runtime, page continuity, testing, and diagnostic APIs share one implementation: **${sharedCount}** entries.`}\n\n[${isZh ? "打开共享包 API" : "Open the shared package API"}](${pageRoute(SHARED_PAGE, locale)})\n\n## ${isZh ? "版本与兼容性" : "Version and compatibility"}\n\n${versionTable(info, locale)}\n\n| ${isZh ? "项目" : "Item"} | ${isZh ? "值" : "Value"} |\n| --- | --- |\n| ${isZh ? "引入版本" : "Introduced"} | \`${manifest.since}\` |\n| ${isZh ? "运行时" : "Runtime"} | ${isZh ? "ES 模块；Vue 3、React 18+、Vue 2.7 或原生浏览器环境" : "ES modules for Vue 3, React 18+, Vue 2.7, or a browser"} |\n| ${isZh ? "稳定性" : "Stability"} | ${isZh ? "pre-1.0 alpha；次要版本可能改变 API" : "Pre-1.0 alpha; a minor release may change the API"} |\n\n## ${isZh ? "机器可读副本" : "Machine-readable copies"}\n\n- [${isZh ? "API 总览 JSON" : "API overview JSON"}](${overviewJsonRoute(locale)})\n${PAGES.map((page) => `- [${pageName(page, locale)} JSON](${pageJsonRoute(page, locale)})`).join("\n")}\n\n## ${isZh ? "不在本页范围内" : "Out of scope"}\n\n${isZh ? "- Surface 协议、委托、Node 网关与协议 Schema 分别见各自专题参考。\n- 适配器的支持矩阵不代表四个框架的行为完全相同。\n- 包内工具函数、组件内部接口与未导出类型不在这里承诺兼容。" : "- Surface, delegation, the Node gateway, and protocol schemas have their own references.\n- Adapter support does not imply that all four frameworks behave identically.\n- Internal helpers, component internals, and non-exported types are not compatibility promises here."}\n`;
}

function pageJson(manifest, info, page, locale) {
  const categories = categoriesForPage(manifest, page).map((category) => ({
    id: category.id,
    title: locale === "zh" ? category.titleZh : category.title,
    summary: locale === "zh" ? category.summaryZh : category.summary,
    entries: category.entries.map((entry) => {
      const detail = detailFor(entry, page);
      return {
        id: entry.id,
        anchor: `api-${anchorOf(entry)}`,
        name: entryName(entry, locale),
        kind: entry.kind,
        summary: locale === "zh" ? entry.summaryZh : entry.summary,
        imports: importsForPage(entry, page),
        signature: signatureForPage(entry, page) ?? null,
        parameters: localizedList(detail, "parameters", page),
        definition: entry.definition ?? null,
        returns: (locale === "zh" ? entry.returnsZh : entry.returns) ?? null,
        defaults: (locale === "zh" ? entry.defaultsZh : entry.defaults) ?? [],
        examples: localizedList(detail, "examples", page),
        support: entry.support ?? {},
        symbols: entry.symbols ?? [],
        reference: referenceForPage(entry, page),
      };
    }),
  }));
  return `${JSON.stringify(
    {
      title: pageName(page, locale),
      locale,
      page: page.id,
      route: pageRoute(page, locale),
      package: page.package,
      version: info.version,
      since: manifest.since,
      stability: manifest.stability,
      categories,
    },
    null,
    2,
  )}\n`;
}

function overviewJson(manifest, info, locale) {
  return `${JSON.stringify(
    {
      title: locale === "zh" ? "Pling API 参考" : "Pling API reference",
      locale,
      version: info.version,
      since: manifest.since,
      stability: manifest.stability,
      pages: PAGES.map((page) => ({
        id: page.id,
        title: pageName(page, locale),
        route: pageRoute(page, locale),
        json: pageJsonRoute(page, locale),
        package: page.package,
        entries: categoriesForPage(manifest, page).reduce((total, category) => total + category.entries.length, 0),
      })),
    },
    null,
    2,
  )}\n`;
}

function render(manifest = readManifest()) {
  const info = versionInfo(manifest);
  const files = new Map();
  files.set(join(WEBSITE, "reference", "api", "index.md"), overviewPage(manifest, info, "en"));
  files.set(join(WEBSITE, "zh", "reference", "api", "index.md"), overviewPage(manifest, info, "zh"));
  files.set(join(WEBSITE, "public", "api-index.json"), overviewJson(manifest, info, "en"));
  files.set(join(WEBSITE, "public", "zh", "api-index.json"), overviewJson(manifest, info, "zh"));
  for (const page of PAGES) {
    const categories = categoriesForPage(manifest, page);
    files.set(pageFile(page, "en"), pageBody(manifest, info, page, "en", categories));
    files.set(pageFile(page, "zh"), pageBody(manifest, info, page, "zh", categories));
    files.set(join(WEBSITE, "public", "api-index", `${page.slug}.json`), pageJson(manifest, info, page, "en"));
    files.set(join(WEBSITE, "public", "zh", "api-index", `${page.slug}.json`), pageJson(manifest, info, page, "zh"));
  }
  return { manifest, info, files };
}

export function apiJsonRoutes() {
  return [
    overviewJsonRoute("en"),
    overviewJsonRoute("zh"),
    ...PAGES.flatMap((page) => [pageJsonRoute(page, "en"), pageJsonRoute(page, "zh")]),
  ];
}

export function checkApiReference() {
  const manifest = readManifest();
  const problems = [...validateManifest(manifest), ...validateDetails(manifest), ...validateSymbols(manifest)];
  let rendered;
  try {
    rendered = render(manifest);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
    return problems;
  }

  const expectedRoutes = new Set(outputRoutes());
  for (const [file, expected] of rendered.files) {
    if (!existsSync(file)) {
      problems.push(`${relative(ROOT, file)}: generated API page is missing; run pnpm --filter @plingjs/website docs:generate`);
      continue;
    }
    if (readFileSync(file, "utf8") !== expected) {
      problems.push(`${relative(ROOT, file)}: generated API page is stale; run pnpm --filter @plingjs/website docs:generate`);
    }
  }
  for (const file of expectedRoutes) {
    if (!rendered.files.has(file)) problems.push(`${relative(ROOT, file)}: unexpected API output`);
  }
  return problems;
}

function main() {
  const check = process.argv.includes("--check");
  const manifest = readManifest();
  const problems = [...validateManifest(manifest), ...validateDetails(manifest)];
  if (check) problems.push(...validateSymbols(manifest));
  if (problems.length) {
    console.error(`✗ API reference ${check ? "check" : "generation"} failed (${problems.length}):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  const rendered = render(manifest);
  if (check) {
    for (const [file, expected] of rendered.files) {
      if (!existsSync(file) || readFileSync(file, "utf8") !== expected) {
        console.error(`${relative(ROOT, file)}: generated API output is stale`);
        process.exitCode = 1;
      }
    }
    if (!process.exitCode) console.log("✓ API reference is current.");
    return;
  }

  for (const [file, content] of rendered.files) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, "utf8");
  }
  const count = PAGES.reduce(
    (total, page) => total + categoriesForPage(manifest, page).reduce((sum, category) => sum + category.entries.length, 0),
    0,
  );
  console.log(`✓ API reference: ${PAGES.length} pages, ${count} page entries, EN + ZH pages and JSON exports.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
