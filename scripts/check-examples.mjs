#!/usr/bin/env node
// Guard the public examples against drift:
// - every manifest file exists;
// - every focus anchor still matches source;
// - every example has a VitePress page and a built HTML entry;
// - the shown source still contains the Pling setup, an assistant entry and declarations.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEMOS = join(ROOT, "examples", "demos");
const EXAMPLES = join(ROOT, "examples");
const DOCS = join(ROOT, "website", "examples");
const TUTORIAL_CONTENT = join(ROOT, "content", "tutorial");
const RECIPES = join(ROOT, "examples", "recipes");
const RECIPE_ADAPTERS = [
  { dir: "vue3", pkg: "@plingjs/recipe-vue3" },
  { dir: "react", pkg: "@plingjs/recipe-react" },
  { dir: "vanilla", pkg: "@plingjs/recipe-vanilla" },
  { dir: "vue2", pkg: "@plingjs/recipe-vue2" },
];
const problems = [];
const manifests = new Map();

function fail(file, message) {
  problems.push(`${relative(ROOT, file)}: ${message}`);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail(file, `invalid JSON (${error instanceof Error ? error.message : String(error)})`);
    return undefined;
  }
}

function inside(base, target) {
  const value = relative(base, target);
  return value !== "" && !value.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && value !== ".." && !isAbsolute(value);
}

function sourceOf(dir) {
  let source = "";
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === "node_modules") continue;
    const file = join(dir, entry.name);
    if (entry.isDirectory()) source += sourceOf(file);
    else if (/\.(?:ts|tsx|vue)$/.test(entry.name)) source += readFileSync(file, "utf8");
  }
  return source;
}

if (!existsSync(DEMOS)) {
  console.error("✗ examples/demos does not exist.");
  process.exit(1);
}

const names = readdirSync(DEMOS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (names.length === 0) fail(DEMOS, "no public examples found");

for (const name of names) {
  const dir = join(DEMOS, name);
  const manifestPath = join(dir, "demo.json");
  const pagePath = join(DOCS, `${name}.md`);
  const indexHtml = join(dir, "index.html");

  if (!existsSync(manifestPath)) {
    fail(dir, "missing demo.json");
    continue;
  }

  const manifest = readJson(manifestPath);
  if (!manifest) continue;
  manifests.set(name, manifest);

  if (manifest.id !== name) fail(manifestPath, `id must match its folder ("${name}")`);
  if (typeof manifest.title !== "string" || !manifest.title.trim()) fail(manifestPath, "title is required");
  if (typeof manifest.eyebrow !== "string" || !manifest.eyebrow.trim()) fail(manifestPath, "eyebrow is required");
  if (typeof manifest.summary !== "string" || !manifest.summary.trim()) fail(manifestPath, "summary is required");
  if (manifest.url !== `/demos/${name}/`) fail(manifestPath, `url must be "/demos/${name}/"`);
  if (!existsSync(indexHtml)) fail(dir, "missing index.html");

  let sourceDir = dir;
  if (manifest.source !== undefined) {
    if (typeof manifest.source !== "string" || !manifest.source.trim()) {
      fail(manifestPath, "source must be a non-empty repository-relative directory");
    } else {
      sourceDir = resolve(ROOT, manifest.source);
      if (isAbsolute(manifest.source) || !inside(EXAMPLES, sourceDir)) {
        fail(manifestPath, `source must stay inside examples/: "${manifest.source}"`);
        sourceDir = dir;
      } else if (!existsSync(sourceDir)) {
        fail(manifestPath, `source directory does not exist: "${manifest.source}"`);
        sourceDir = dir;
      }
    }
  }

  const run = manifest.run ?? "pnpm dev:examples";
  if (typeof run !== "string" || !run.trim() || /[\r\n]/.test(run)) {
    fail(manifestPath, "run must be a single non-empty command line");
  } else if (!run.includes("pnpm ")) {
    fail(manifestPath, "run must use a pnpm command from the repository root");
  }

  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    fail(manifestPath, "files must be a non-empty array");
    continue;
  }

  const paths = new Set();
  const sources = new Map();
  for (const file of manifest.files) {
    if (typeof file?.path !== "string" || !file.path.trim()) {
      fail(manifestPath, "every file needs a path");
      continue;
    }
    if (paths.has(file.path)) fail(manifestPath, `duplicate file "${file.path}"`);
    paths.add(file.path);
    if (file.scope !== undefined && file.scope !== "workspace") {
      fail(manifestPath, `unknown scope "${file.scope}" for ${file.path}`);
    }

    const base = file.scope === "workspace" ? EXAMPLES : sourceDir;
    const allowedRoot = file.scope === "workspace" ? EXAMPLES : sourceDir;
    const absolute = resolve(base, file.path);
    if (isAbsolute(file.path) || !inside(allowedRoot, absolute)) {
      fail(manifestPath, `file escapes its allowed folder: "${file.path}"`);
      continue;
    }
    if (!existsSync(absolute)) {
      fail(manifestPath, `listed file does not exist: "${file.path}"`);
      continue;
    }
    sources.set(file.path, readFileSync(absolute, "utf8"));
  }

  if (!paths.has(manifest.open)) fail(manifestPath, `open must name a listed file (got "${manifest.open}")`);
  if (!paths.has("README.md")) fail(manifestPath, "files must list the source README.md");

  if (!manifest.focus || typeof manifest.focus !== "object" || Array.isArray(manifest.focus)) {
    fail(manifestPath, "focus must be an object");
  } else {
    for (const [anchor, target] of Object.entries(manifest.focus)) {
      if (typeof target?.selector !== "string" || !target.selector.trim()) {
        fail(manifestPath, `focus.${anchor}.selector is required`);
      }
      if (typeof target?.match !== "string" || !target.match.trim()) {
        fail(manifestPath, `focus.${anchor}.match is required`);
        continue;
      }
      if (![...sources.values()].some((source) => source.includes(target.match))) {
        fail(manifestPath, `focus.${anchor}.match is not present in any source file: "${target.match}"`);
      }
    }
  }

  const source = [...sources.values()].join("\n");
  if (!source.includes("@plingjs/")) fail(manifestPath, "example must import at least one @plingjs package");
  const mainEntry = join(sourceDir, "src", "main.ts");
  if (existsSync(mainEntry) && readFileSync(mainEntry, "utf8").includes('from "@plingjs/vue"')) {
    const entrySource = readFileSync(mainEntry, "utf8");
    if (!entrySource.includes('import "@plingjs/vue/style.css"')) {
      fail(mainEntry, "Vue examples must import @plingjs/vue/style.css");
    }
  }
  if (manifest.pageAssistant !== undefined && typeof manifest.pageAssistant !== "boolean") {
    fail(manifestPath, "pageAssistant must be a boolean when present");
  }
  const hasPageAssistant = /(?:<AgentDock\b|<AgentInline\b|<PlingProvider\b|AgentDock\s*\(|\bpling\.dock\s*\()/.test(source);
  const externalOnly = manifest.pageAssistant === false && /createSurface\s*\(/.test(source);
  if (!hasPageAssistant && !externalOnly) {
    fail(manifestPath, "example must mount an assistant entry");
  }
  if (!/(?:v-tool\b|v-record\b|usePlingTool\b|usePlingRecord\b|\bpling\.(?:tool|record)\s*\()/.test(source)) {
    fail(manifestPath, "example must declare at least one tool or record");
  }

  const guide = manifest.guide;
  if (!guide || typeof guide !== "object" || Array.isArray(guide)) {
    fail(manifestPath, "guide must be an object");
  } else {
    if (typeof guide.title !== "string" || !guide.title.trim()) fail(manifestPath, "guide.title is required");
    if (!(typeof guide.intro === "string" || Array.isArray(guide.intro))) {
      fail(manifestPath, "guide.intro must be a string or an array of paragraphs");
    }
    if (!Array.isArray(guide.steps) || guide.steps.length === 0) {
      fail(manifestPath, "guide.steps must be a non-empty array");
    } else {
      for (const [index, step] of guide.steps.entries()) {
        const label = `guide.steps[${index}]`;
        if (typeof step?.title !== "string" || !step.title.trim()) fail(manifestPath, `${label}.title is required`);
        if (!(typeof step?.body === "string" || Array.isArray(step.body))) {
          fail(manifestPath, `${label}.body must be a string or an array of paragraphs`);
        }
        if (typeof step?.file !== "string" || !paths.has(step.file)) {
          fail(manifestPath, `${label}.file must name a listed file`);
          continue;
        }
        if (typeof step.match !== "string" || !step.match.trim()) {
          fail(manifestPath, `${label}.match is required`);
          continue;
        }
        if (!sources.get(step.file)?.includes(step.match)) {
          fail(manifestPath, `${label}.match is not present in ${step.file}: "${step.match}"`);
        }
        if (step.lines !== undefined && (!Number.isInteger(step.lines) || step.lines < 1 || step.lines > 80)) {
          fail(manifestPath, `${label}.lines must be an integer from 1 to 80`);
        }
      }
    }
  }

  if (!existsSync(pagePath)) {
    fail(pagePath, "missing VitePress page");
  } else {
    const page = readFileSync(pagePath, "utf8");
    const mounted = new RegExp(`<DemoPlayground\\s+id=["']${name}["']`).test(page);
    if (!mounted) fail(pagePath, `page must mount <DemoPlayground id="${name}" />`);
  }
}

if (existsSync(TUTORIAL_CONTENT)) {
  const recipeArticles = readdirSync(TUTORIAL_CONTENT)
    .filter((name) => /^RCP-\d+-.+\.(?:en|zh)\.md$/.test(name))
    .sort();
  const recipesById = new Map();

  for (const name of recipeArticles) {
    const file = join(TUTORIAL_CONTENT, name);
    const source = readFileSync(file, "utf8");
    const mounts = [...source.matchAll(/<DemoPlayground\s+id=["']([^"']+)["']/g)];
    if (mounts.length !== 1) {
      fail(file, `recipe article must mount exactly one DemoPlayground (found ${mounts.length})`);
      continue;
    }

    const id = mounts[0][1];
    const manifest = manifests.get(id);
    if (!id.startsWith("recipe-") || !manifest) {
      fail(file, `unknown recipe demo "${id}"`);
      continue;
    }
    if (!source.includes(`examples/demos/${id}/`)) {
      fail(file, `recipe article must name its source directory examples/demos/${id}/`);
    }
    if (!source.includes("pnpm dev:examples")) {
      fail(file, "recipe article must include the local run command pnpm dev:examples");
    }
    if (!manifest.files.some((entry) => entry.path === "README.md")) {
      fail(join(DEMOS, id, "demo.json"), "recipe manifest must list its README.md");
    }

    for (const directory of new Set(
      manifest.files
        .filter((entry) => entry.scope === "workspace")
        .map((entry) => entry.path.split("/").slice(0, -1).join("/"))
        .filter((entry) => entry === "recipe-backends/access-service" || entry === "demos/external-agent-surface"),
    )) {
      if (!manifest.files.some((entry) => entry.scope === "workspace" && entry.path === `${directory}/README.md`)) {
        fail(join(DEMOS, id, "demo.json"), `backend or bridge ${directory}/README.md must be listed in the source panel`);
      }
    }

    const key = name.replace(/\.(?:en|zh)\.md$/, "");
    const previous = recipesById.get(key);
    if (previous && previous.id !== id) {
      fail(file, `English and Chinese recipe articles mount different demos (${previous.id} vs ${id})`);
    }
    recipesById.set(key, { file, id });
  }

  if (recipeArticles.length === 0) fail(TUTORIAL_CONTENT, "no recipe articles found");
}

if (existsSync(DOCS)) {
  for (const name of readdirSync(DOCS)) {
    if (!name.endsWith(".md") || name === "index.md") continue;
    const page = readFileSync(join(DOCS, name), "utf8");
    for (const match of page.matchAll(/<DemoPlayground\s+id=["']([^"']+)["']/g)) {
      if (!names.includes(match[1])) fail(join(DOCS, name), `unknown example id "${match[1]}"`);
    }
  }
}

if (!existsSync(RECIPES)) {
  fail(RECIPES, "missing four-adapter recipe lab");
} else {
  const readme = join(RECIPES, "README.md");
  if (!existsSync(readme)) fail(readme, "missing recipe lab README");
  else if (readFileSync(readme, "utf8").includes("cases/")) {
    fail(readme, "public recipe lab must not reference internal cases/");
  }

  for (const { dir, pkg } of RECIPE_ADAPTERS) {
    const recipeDir = join(RECIPES, dir);
    const manifestPath = join(recipeDir, "package.json");
    if (!existsSync(manifestPath)) {
      fail(recipeDir, "missing package.json");
      continue;
    }
    const manifest = readJson(manifestPath);
    if (!manifest) continue;
    if (manifest.name !== pkg) fail(manifestPath, `name must be "${pkg}"`);
    for (const script of ["dev", "build", "typecheck"]) {
      if (typeof manifest.scripts?.[script] !== "string" || !manifest.scripts[script].trim()) {
        fail(manifestPath, `missing ${script} script`);
      }
    }

    const sourceDir = join(recipeDir, "src");
    if (!existsSync(sourceDir)) {
      fail(recipeDir, "missing src/");
      continue;
    }
    const source = sourceOf(sourceDir);
    if (!source.includes("@plingjs/")) fail(sourceDir, "recipe must import @plingjs packages");
    if (!source.includes("maxTurns: 100")) fail(sourceDir, "demo must explicitly set maxTurns: 100");
    if (!/get\(["']order["']\)/.test(source)) fail(sourceDir, "recipe must include the MPA detail route (?order=)");
    if (!/get\(["']lang["']\)/.test(source)) fail(sourceDir, "recipe must support ?lang=zh");
    if (!/confirm:\s*["']always["']/.test(source)) fail(sourceDir, "recipe must include a danger action with confirm: always");
    if (!/expect\s*:/.test(source)) fail(sourceDir, "recipe must include a verified result with expect");
    if (!/params\s*:/.test(source)) fail(sourceDir, "recipe must declare action parameters");
    if (!/(?:useAgentState|usePlingState|pling\.state)\s*\(/.test(source)) {
      fail(sourceDir, "recipe must expose a read-only state view");
    }
  }
}

if (problems.length) {
  console.error(`✗ Public example check failed (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `✓ Public examples are consistent: ${names.join(", ")}; recipes: ${RECIPE_ADAPTERS.map((item) => item.dir).join(", ")}.`,
);
