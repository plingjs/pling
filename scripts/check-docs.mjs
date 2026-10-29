#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { apiJsonRoutes, checkApiReference } from "./generate-api-reference.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const OUTLINE = join(root, "content", "TUTORIAL-OUTLINE.md");
const CONTENT = join(root, "content", "tutorial");
const WEBSITE = join(root, "website");
const REGISTRY = join(root, "examples", "tutorials", "registry.json");
const SPECIAL_CONTENT_IDS = new Set(["SITE-01", "SITE-02", "SITE-03", "SITE-09"]);

function fail(message) {
  problems.push(message);
}

function read(path) {
  return readFileSync(path, "utf8");
}

function walk(path, predicate, skip = new Set()) {
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const file = join(path, entry.name);
    if (entry.isDirectory()) files.push(...walk(file, predicate, skip));
    else if (predicate(file)) files.push(file);
  }
  return files;
}

function parseOutline() {
  const rows = [];
  const pattern = /^\|\s*([A-Z0-9]+-\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(drafted|reviewed|planned|blocked|hidden)\s*\|\s*(0\.1|later|hidden)\s*\|$/gm;
  for (const match of read(OUTLINE).matchAll(pattern)) {
    rows.push({
      id: match[1],
      title: match[2].trim().replace(/`/g, ""),
      titleZh: match[3].trim().replace(/`/g, ""),
      status: match[5],
      release: match[6],
    });
  }
  return rows;
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return undefined;
  const values = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim();
    const raw = line.slice(colon + 1).trim();
    if (!key) continue;
    try {
      values[key] = raw.startsWith('"') || raw.startsWith("[") || raw.startsWith("{") ? JSON.parse(raw) : raw;
    } catch {
      values[key] = raw.replace(/^["']|["']$/g, "");
    }
  }
  return values;
}

function bodyAfterFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
}

function withoutCodeFences(markdown) {
  let fenced = false;
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return "";
      }
      return fenced ? "" : line;
    })
    .join("\n");
}

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function executableSource(file, source) {
  if (!file.endsWith(".vue")) return source;
  return [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).join("\n");
}

const PUBLIC_PROSE_RULES = [
  {
    name: "internal content id",
    pattern: /\b(?:M|C|OPS|V3|R|J|V2|S|EV|SPEC|RCP|REF|TS)-\d{2}\b/,
  },
  {
    name: "internal case path",
    pattern: /\bcases?\/\d{3}\b/,
  },
  {
    name: "internal case label",
    pattern: /(?:\bCase\s+\d{3}\b|\bcase\s+\d{3}\b|案例\s*\d{3})/i,
  },
  {
    name: "authoring banner",
    pattern: /(工作区中的草稿|英文与中文事实冲突|当前切片|尚未撰写|待补充|\bStatus:\s*(?:drafted|planned)\b|\bID:\s*(?:M|C|OPS|V3|R|J|V2|S|EV|SPEC|RCP|REF|TS)-\d{2}\b)/i,
  },
  {
    name: "legacy lowercase brand",
    pattern: /\bpi(?:\s+(?:Surface|agent|runtime|SDK)\b|[-_][a-z0-9])/,
  },
  {
    name: "legacy uppercase brand",
    pattern: /\bPI_[A-Z0-9_]+/,
  },
  {
    name: "unknown Surface tool",
    pattern: /\bpling_surface_(?!(?:describe|invoke|approval_status)\b)[a-z_]+/,
  },
];

const ACTIVE_TEXT_ROOTS = ["content", "website", "packages", "services", "cases", "examples", "scripts", "docs"];
const ACTIVE_TEXT_EXTENSIONS = /\.(?:md|mjs|cjs|js|jsx|ts|tsx|vue|json)$/;
const ACTIVE_TEXT_SKIP = new Set(["node_modules", "dist", ".git", ".tmp", ".vitepress", "results"]);
const LEGACY_SURFACE_STATUS = ["pling", "surface", "status"].join("_");

function checkSurfaceToolNames() {
  for (const directory of ACTIVE_TEXT_ROOTS) {
    const absolute = join(root, directory);
    if (!existsSync(absolute)) continue;
    for (const file of walk(absolute, (path) => ACTIVE_TEXT_EXTENSIONS.test(path), ACTIVE_TEXT_SKIP)) {
      const relativeFile = relative(root, file);
      if (relativeFile === "scripts/check-docs.mjs") continue;
      const text = read(file);
      if (text.includes(LEGACY_SURFACE_STATUS)) {
        fail(`${relativeFile}: legacy Surface tool pling_surface_status must be pling_surface_approval_status`);
      }
      if (/\b(?:PI|VITE_PI)_[A-Z0-9_]+/.test(text)) {
        fail(`${relativeFile}: legacy PI_* environment variable; use PLING_* or VITE_PLING_*`);
      }
      if (text.includes("pi-demo-local") || text.includes("data-pi-bench-ref")) {
        fail(`${relativeFile}: legacy pi-* identifier; use pling-*`);
      }
      if (relativeFile !== "docs/BRAND.md" && /\b(?:Pi|PI)\s+(?:Surface|agent|runtime|SDK)\b/.test(text)) {
        fail(`${relativeFile}: legacy capitalized brand; use Pling Surface, Pling agent, or Pling runtime`);
      }
    }
  }
}

function checkPublicProse(id, locale, body) {
  for (const [index, line] of body.split(/\r?\n/).entries()) {
    for (const rule of PUBLIC_PROSE_RULES) {
      if (!rule.pattern.test(line)) continue;
      fail(`${id} (${locale}): public prose contains ${rule.name} on line ${index + 1}: ${line.trim().slice(0, 160)}`);
    }
  }
}

function routeForFile(file) {
  const rel = relative(WEBSITE, file).replaceAll("\\", "/");
  if (rel === "index.md") return "/";
  if (rel.endsWith("/index.md")) return canonicalRoute(`/${rel.slice(0, -"index.md".length)}`);
  if (rel.endsWith(".md")) return canonicalRoute(`/${rel.slice(0, -3)}`);
  return undefined;
}

function canonicalRoute(value) {
  if (value === "/") return value;
  return value.replace(/\/+$/, "");
}

function normalizeInternalRoute(target) {
  let value = target.split("#", 1)[0].split("?", 1)[0].replace(/\/+$/, "");
  if (!value.startsWith("/")) return undefined;
  if (value === "/") return value;
  if (value.endsWith(".md")) value = `/${value.replace(/^\//, "").replace(/\.md$/, "")}`;
  return canonicalRoute(value);
}

function checkBilingualPairs(rows) {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const files = readdirSync(CONTENT).filter((name) => name.endsWith(".md"));
  const groups = new Map();

  for (const file of files) {
    const id = file.match(/^([A-Z0-9]+-\d+)/)?.[1];
    if (!id) {
      fail(`content/tutorial/${file}: filename does not start with an outline id`);
      continue;
    }
    if (!rowsById.has(id)) {
      fail(`content/tutorial/${file}: id ${id} is not in ${relative(root, OUTLINE)}`);
      continue;
    }
    if (!groups.has(id)) groups.set(id, {});
    const locale = file.endsWith(".en.md") ? "en" : file.endsWith(".zh.md") ? "zh" : undefined;
    if (!locale) {
      fail(`content/tutorial/${file}: filename must end in .en.md or .zh.md`);
      continue;
    }
    if (groups.get(id)[locale]) fail(`${id}: duplicate ${locale} source`);
    groups.get(id)[locale] = file;
  }

  for (const row of rows) {
    if (SPECIAL_CONTENT_IDS.has(row.id)) continue;
    const pair = groups.get(row.id);
    if (!pair?.en) fail(`${row.id}: missing English source`);
    if (!pair?.zh) fail(`${row.id}: missing Chinese source`);
    if (!pair?.en || !pair?.zh) continue;

    const parsed = {};
    for (const locale of ["en", "zh"]) {
      const path = join(CONTENT, pair[locale]);
      const text = read(path);
      const frontmatter = parseFrontmatter(text);
      const body = bodyAfterFrontmatter(text);
      parsed[locale] = { path, text, frontmatter, body };
      checkPublicProse(row.id, locale, body);

      if (!frontmatter) {
        fail(`${relative(root, path)}: missing frontmatter`);
        continue;
      }
      if (frontmatter.id !== row.id) fail(`${relative(root, path)}: frontmatter id must be ${row.id}`);
      if (frontmatter.locale !== locale) fail(`${relative(root, path)}: frontmatter locale must be ${locale}`);
      if (frontmatter.status !== row.status) {
        fail(`${relative(root, path)}: frontmatter status ${frontmatter.status ?? "missing"} does not match outline status ${row.status}`);
      }
      if (!frontmatter.title) fail(`${relative(root, path)}: frontmatter title is required`);
      if (frontmatter.source_locale !== "en") {
        fail(`${relative(root, path)}: frontmatter source_locale must be "en"`);
      }
      if (!frontmatter.translation_status) {
        fail(`${relative(root, path)}: frontmatter translation_status is required`);
      }
      if (locale === "en" && frontmatter.translation_status !== "source") {
        fail(`${relative(root, path)}: English source must declare translation_status: source`);
      }

      const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)];
      const first = headings.find((match) => match[1] === "#");
      const h1Count = headings.filter((match) => match[1] === "#").length;
      if (h1Count !== 1) fail(`${relative(root, path)}: expected exactly one H1, found ${h1Count}`);
      if (first && new RegExp(`^${row.id}(?:\\s|[·:—-])`).test(first[2].trim())) {
        fail(`${relative(root, path)}: H1 must not expose the internal chapter id ${row.id}`);
      }

      const prose = withoutCodeFences(body);
      for (const match of prose.matchAll(/\b([A-Z][A-Z0-9]{0,3}-\d{2})\b/g)) {
        if (rowsById.has(match[1])) {
          fail(`${relative(root, path)}: reader-facing text exposes internal chapter id ${match[1]}`);
        }
      }

      for (const marker of ["TODO", "FIXME", "TBD", "Lorem ipsum", "待补充", "尚未撰写"]) {
        if (prose.includes(marker)) fail(`${relative(root, path)}: contains unfinished marker "${marker}"`);
      }
    }

    if (!parsed.en || !parsed.zh) continue;
    const shape = (body) => ({
      headings: [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => `${match[1]}:${match[2].trim()}`),
      fences: (body.match(/^\s*```/gm) ?? []).length,
      tableLines: (body.match(/^\|/gm) ?? []).length,
    });
    const en = shape(parsed.en.body);
    const zh = shape(parsed.zh.body);
    if (en.headings.length !== zh.headings.length) {
      fail(`${row.id}: English/Chinese heading counts differ (${en.headings.length} vs ${zh.headings.length})`);
    }
    if (en.fences !== zh.fences) fail(`${row.id}: English/Chinese code-fence counts differ (${en.fences} vs ${zh.fences})`);
    if (en.tableLines !== zh.tableLines) fail(`${row.id}: English/Chinese table-line counts differ (${en.tableLines} vs ${zh.tableLines})`);

    if (row.id.startsWith("REF-")) {
      if (!/^## Version and compatibility$/m.test(parsed.en.body)) {
        fail(`${row.id}: reference pages must include a "Version and compatibility" section`);
      }
      if (!/^## 版本与兼容性$/m.test(parsed.zh.body)) {
        fail(`${row.id}: Chinese reference pages must include a "版本与兼容性" section`);
      }
      for (const label of ["Applies to", "Introduced", "Runtime", "Peer dependencies", "Stability"]) {
        if (!new RegExp(`^\\|\\s*${label}\\s*\\|`, "m").test(parsed.en.body)) {
          fail(`${row.id}: version table is missing the ${label} row`);
        }
      }
    }
  }

  return { rowsById, groups };
}

function checkLinks() {
  const pages = new Set();
  const websitePages = walk(WEBSITE, (path) => path.endsWith(".md"), new Set(["legacy", "node_modules", ".vitepress"]));
  for (const file of websitePages) {
    const route = routeForFile(file);
    if (route) pages.add(route);
  }
  pages.add("/llms.txt");
  pages.add("/zh/llms.txt");
  for (const route of apiJsonRoutes()) pages.add(route);

  const sources = [
    ...readdirSync(CONTENT).filter((name) => name.endsWith(".md")).map((name) => join(CONTENT, name)),
    ...websitePages,
  ];
  for (const path of sources) {
    const relativePath = relative(root, path).replaceAll("\\", "/");
    const isChineseSource = relativePath.endsWith(".zh.md") || relativePath.startsWith("website/zh/");
    const isEnglishSource =
      relativePath.endsWith(".en.md") || (relativePath.startsWith("website/") && !relativePath.startsWith("website/zh/"));
    const text = withoutCodeFences(read(path));
    for (const match of text.matchAll(/\]\((\/[^)\s]+)\)/g)) {
      const route = normalizeInternalRoute(match[1]);
      if (!route || route.startsWith("/demos/") || route.startsWith("/assets/")) continue;
      if (!pages.has(route)) fail(`${relative(root, path)}: internal link does not resolve: ${match[1]}`);
      const isChineseRoute = route === "/zh" || route.startsWith("/zh/");
      if (isChineseSource && !isChineseRoute) {
        fail(`${relativePath}: Chinese page links to an unlocalized route: ${match[1]}`);
      }
      if (isEnglishSource && isChineseRoute) {
        fail(`${relativePath}: English page links to a Chinese route: ${match[1]}`);
      }
    }
  }
}

function checkCaseTutorials() {
  const cases = join(root, "cases");
  if (!existsSync(cases)) return;
  const indexPath = join(root, "docs", "INDEX.md");
  if (!existsSync(indexPath)) {
    fail("docs/INDEX.md is required when cases/ exists");
    return;
  }
  const index = read(indexPath);
  const names = readdirSync(cases, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  for (const name of names) {
    const id = name.slice(0, 3);
    const base = join(cases, name);
    for (const required of ["README.md", "package.json", "docs/TUTORIAL.md", "test"]) {
      if (!existsSync(join(base, required))) fail(`cases/${name}: missing ${required}`);
    }
    if (!new RegExp(`^\\|\\s*${id}\\s*\\|`, "m").test(index)) {
      fail(`cases/${name}: missing entry in docs/INDEX.md`);
    }

    const tutorial = join(base, "docs", "TUTORIAL.md");
    if (!existsSync(tutorial)) continue;
    const body = withoutCodeFences(read(tutorial));
    const h1 = [...body.matchAll(/^#\s+(.+)$/gm)];
    if (h1.length !== 1) fail(`cases/${name}/docs/TUTORIAL.md: expected exactly one H1, found ${h1.length}`);
    const title = h1[0]?.[1]?.trim() ?? "";
    if (/^(?:案例\s*|Pling\s+)?\d{3}\b|^Case\s+\d{3}\b|^Pling\s+\d{3}\b/i.test(title)) {
      fail(`cases/${name}/docs/TUTORIAL.md: H1 must not expose the internal case number`);
    }
    if (/^案例\s*\d{3}\b|^(?:Pling\s+)?\d{3}\s*(?:教程)?\s*[·:：-]/i.test(title)) {
      fail(`cases/${name}/docs/TUTORIAL.md: H1 must be a reader-facing title, not an internal case label`);
    }
    if (/\b(?:S|M|L)\d+[a-z]?\b/.test(title)) {
      fail(`cases/${name}/docs/TUTORIAL.md: H1 must not expose an internal stage code`);
    }

    const headings = [...body.matchAll(/^##\s+(.+)$/gm)]
      .map((match) => match[1].trim().replace(/^\d+(?:\.\d+)*[.、]?\s*/, ""));
    const requiredSections = [
      ["introduction", /^(?:(?:介绍|这个案例|案例目标)|(?:introduction|what this case is for|this case)\b)/i],
      ["quick start", /^(?:(?:快速上手|快速开始|最小接入)(?:\s|$|[：:])|(?:quick start|run it|install)\b)/i],
      ["known limitations", /^(?:(?:已知限制|限制|安全边界)(?:\s|$|[：:（(])|(?:known limitations|limitations)\b)|\bboundary\b/i],
    ];
    for (const [label, pattern] of requiredSections) {
      if (!headings.some((heading) => pattern.test(heading))) {
        fail(`cases/${name}/docs/TUTORIAL.md: missing ${label} section`);
      }
    }

    for (const marker of [/\bTODO\b/, /\bFIXME\b/, /\bTBD\b/, /Lorem ipsum/i, /待补充/, /尚未撰写/]) {
      if (marker.test(body)) fail(`cases/${name}/docs/TUTORIAL.md: contains unfinished marker "${marker.source}"`);
    }

    const testFiles = walk(join(base, "test"), (path) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path), new Set(["node_modules", "dist"]));
    if (testFiles.length === 0) fail(`cases/${name}: test/ contains no test files`);

    const demo = join(base, "demo");
    if (existsSync(demo)) {
      const demoFiles = walk(demo, (path) => /\.(?:[cm]?[jt]sx?|vue)$/.test(path), new Set(["node_modules", "dist"]));
      for (const file of demoFiles) {
        const source = withoutComments(executableSource(file, read(file)));
        if (/\bcreatePling\s*\(/.test(source) && !/maxTurns\s*:\s*100\b/.test(source)) {
          fail(`cases/${name}/demo/${relative(demo, file)}: demo agent must set maxTurns: 100 explicitly`);
        }
      }
    }
  }
}

function checkTutorials() {
  let registry;
  try {
    registry = JSON.parse(read(REGISTRY));
  } catch (error) {
    fail(`examples/tutorials/registry.json: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }

  const entries = Object.entries(registry);
  const registeredDirs = new Set();
  for (const [id, entry] of entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail(`examples/tutorials/registry.json: invalid tutorial id ${id}`);
    const source = join(root, "examples", "tutorials", entry.dir ?? "");
    if (!entry.dir || !existsSync(source) || !statSync(source).isDirectory()) {
      fail(`${id}: tutorial directory does not exist`);
      continue;
    }
    registeredDirs.add(entry.dir);
    const readmePath = join(source, "README.md");
    if (!existsSync(readmePath)) {
      fail(`${id}: missing README.md with purpose and run instructions`);
    } else {
      const readme = read(readmePath);
      if (!readme.includes(`pnpm tutorial:dev ${id}`)) {
        fail(`${id}: README.md must include "pnpm tutorial:dev ${id}"`);
      }
      if (existsSync(join(source, "server.mjs")) && !readme.includes("server.mjs")) {
        fail(`${id}: README.md must explain the server.mjs entry point`);
      }
    }
    for (const key of ["title", "port"]) {
      if (entry[key] === undefined || entry[key] === "") fail(`${id}: ${key} is required`);
    }
    if (!Number.isInteger(entry.port) || entry.port < 1 || entry.port > 65535) fail(`${id}: port must be an integer from 1 to 65535`);
    if (!Array.isArray(entry.packages) || entry.packages.length === 0) fail(`${id}: packages must be a non-empty array`);
    if (!Array.isArray(entry.docs) || entry.docs.length !== 2) fail(`${id}: docs must contain one English and one Chinese source`);
    for (const doc of entry.docs ?? []) {
      const path = join(root, doc);
      if (!existsSync(path)) {
        fail(`${id}: referenced document does not exist: ${doc}`);
        continue;
      }
      const text = read(path);
      for (const marker of entry.docMarkers ?? []) {
        const candidates = typeof marker === "string" ? [marker] : marker.anyOf ?? [];
        if (!candidates.some((candidate) => text.includes(candidate))) {
          fail(`${id}: ${doc} is missing documentation marker: ${candidates.join(" / ")}`);
        }
      }
    }
    const manifestPath = join(source, "package.json");
    if (!existsSync(manifestPath)) {
      fail(`${id}: missing package.json`);
    } else {
      try {
        const manifest = JSON.parse(read(manifestPath));
        for (const script of ["typecheck", "test", "build"]) {
          if (!manifest.scripts?.[script]) fail(`${id}: package.json is missing the ${script} script`);
        }
      } catch (error) {
        fail(`${id}: invalid package.json (${error instanceof Error ? error.message : String(error)})`);
      }
    }
    if (!existsSync(join(source, "test"))) fail(`${id}: missing test/`);
    const sourceFiles = walk(source, (path) => /\.(?:ts|tsx|js|jsx|vue)$/.test(path), new Set(["node_modules", "dist"]));
    if (!sourceFiles.some((path) => /maxTurns\s*:\s*100/.test(read(path)))) {
      fail(`${id}: must explicitly set maxTurns: 100 for the demo session`);
    }
  }

  const tutorialRoot = join(root, "examples", "tutorials");
  for (const entry of readdirSync(tutorialRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!registeredDirs.has(entry.name)) fail(`examples/tutorials/${entry.name}: directory is not registered in registry.json`);
  }
  return entries.length;
}

const rows = parseOutline();
if (rows.length === 0) fail("no outline entries found");
const seenIds = new Set();
for (const row of rows) {
  if (seenIds.has(row.id)) fail(`duplicate outline id: ${row.id}`);
  seenIds.add(row.id);
}
checkBilingualPairs(rows);
checkLinks();
checkCaseTutorials();
checkSurfaceToolNames();
problems.push(...checkApiReference());
const tutorialCount = checkTutorials();

if (problems.length) {
  console.error(`✗ Documentation check failed (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const bilingualCount = [...seenIds].filter((id) => !SPECIAL_CONTENT_IDS.has(id)).length;
console.log(`✓ Documentation check passed: ${rows.length} outline entries, ${bilingualCount} bilingual source pairs, ${tutorialCount} tutorial fixtures.`);
