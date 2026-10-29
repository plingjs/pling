import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHighlighter, type Highlighter } from "shiki";

export interface DemoFileManifest {
  path: string;
  label: string;
  role: string;
  roleZh?: string;
  lang: string;
  /** `workspace` files live at the examples root; used for shared config such as .env.example. */
  scope?: "workspace";
}

export interface DemoFocusManifest {
  selector: string;
  match: string;
}

export interface DemoGuideStep {
  title: string;
  titleZh?: string;
  body: string | readonly string[];
  bodyZh?: string | readonly string[];
  file: string;
  match: string;
  /** Number of source lines to show, starting one line above the match. */
  lines?: number;
}

export interface DemoGuide {
  title: string;
  titleZh?: string;
  intro: string | readonly string[];
  introZh?: string | readonly string[];
  steps: readonly DemoGuideStep[];
  note?: string;
  noteZh?: string;
}

export interface DemoManifest {
  id: string;
  title: string;
  titleZh?: string;
  eyebrow: string;
  eyebrowZh?: string;
  summary: string;
  summaryZh?: string;
  url: string;
  /** Extra query string for the live example, without the leading `?`. */
  liveQuery?: string;
  /** Repository-relative source root. Defaults to examples/demos/<id>/. */
  source?: string;
  /** Command that starts this demo from the repository root. */
  run?: string;
  open: string;
  files: DemoFileManifest[];
  focus?: Record<string, DemoFocusManifest>;
  guide: DemoGuide;
}

export interface DemoCodeLine {
  kind?: "import" | "setup" | "declare" | "entry";
  anchor?: string;
}

export interface DemoFile extends DemoFileManifest {
  source: string;
  html: string;
  lines: readonly DemoCodeLine[];
}

export interface DemoExample extends Omit<DemoManifest, "files" | "focus" | "source" | "run"> {
  source: string;
  run: string;
  files: readonly DemoFile[];
  stats: {
    files: number;
    declared: number;
    entrypoints: number;
  };
}

const ROOT = fileURLToPath(new URL("../../../examples/demos/", import.meta.url));
const WORKSPACE_ROOT = fileURLToPath(new URL("../../../examples/", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const VIRTUAL_ID = "virtual:pling-demo-data";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

let highlighterPromise: Promise<Highlighter> | undefined;
let dataPromise: Promise<readonly DemoExample[]> | undefined;

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: ["github-dark"],
    langs: ["vue", "ts", "js", "html", "css", "json", "ini", "markdown"],
  });
  return highlighterPromise;
}

function classify(line: string): DemoCodeLine["kind"] | undefined {
  const value = line.trim();
  if (!value) return undefined;
  if (/^import\b.*@plingjs\//.test(value) || /\bfrom\s+["']@plingjs\//.test(value)) return "import";
  if (/\bcreatePling\b|\.use\(pling\.plugin\)/.test(value)) return "setup";
  if (/\bv-(tool|record|scope|task)\b/.test(value)) return "declare";
  if (/<Agent(?:Dock|Inline)\b/.test(value)) return "entry";
  return undefined;
}

async function readExample(name: string): Promise<DemoExample> {
  const dir = join(ROOT, name);
  const manifest = JSON.parse(await readFile(join(dir, "demo.json"), "utf8")) as DemoManifest;
  const highlighter = await getHighlighter();
  const focus = Object.entries(manifest.focus ?? {});
  const source = manifest.source ?? `examples/demos/${name}/`;
  const sourceDir = resolve(REPO_ROOT, source);

  const files: DemoFile[] = [];
  for (const file of manifest.files) {
    const base = file.scope === "workspace" ? WORKSPACE_ROOT : sourceDir;
    const source = await readFile(join(base, file.path), "utf8");
    const sourceLines = source.split("\n");
    const lines: DemoCodeLine[] = sourceLines.map((line) => {
      const anchor = focus.find(([, value]) => line.includes(value.match))?.[0];
      const kind = classify(line);
      return {
        ...(kind ? { kind } : {}),
        ...(anchor ? { anchor } : {}),
      };
    });

    const html = highlighter.codeToHtml(source, {
      lang: file.lang,
      theme: "github-dark",
      transformers: [
        {
          name: "pling-demo-lines",
          line(node, lineNumber) {
            const meta = lines[lineNumber - 1];
            if (!meta) return;
            const classes = ["line"];
            if (meta.kind) classes.push(`demo-line--${meta.kind}`);
            if (meta.anchor) classes.push(`demo-line--linked`);
            node.properties.class = classes.join(" ");
            if (meta.kind) node.properties["data-kind"] = meta.kind;
            if (meta.anchor) node.properties["data-anchor"] = meta.anchor;
            node.properties["data-line"] = String(lineNumber);
          },
        },
      ],
    }).replace(/\n(?=<span class="line"[ >])/g, "");

    files.push({ ...file, source, html, lines });
  }

  return {
    id: manifest.id,
    title: manifest.title,
    titleZh: manifest.titleZh,
    eyebrow: manifest.eyebrow,
    eyebrowZh: manifest.eyebrowZh,
    summary: manifest.summary,
    summaryZh: manifest.summaryZh,
    url: manifest.url,
    source,
    run: manifest.run ?? "pnpm dev:examples",
    open: manifest.open,
    guide: manifest.guide,
    files,
    stats: {
      files: files.length,
      declared: files.reduce((total, file) => total + file.lines.filter((line) => line.kind === "declare").length, 0),
      entrypoints: files.reduce((total, file) => total + file.lines.filter((line) => line.kind === "entry").length, 0),
    },
  };
}

async function loadExamples(): Promise<readonly DemoExample[]> {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => (a === "quickstart" ? -1 : b === "quickstart" ? 1 : a.localeCompare(b)));
  // Oniguruma runs as a single WASM instance. Highlighting many files in
  // parallel can exhaust it and surface as "memory access out of bounds".
  const examples: DemoExample[] = [];
  for (const name of names) examples.push(await readExample(name));
  return examples;
}

function getData(): Promise<readonly DemoExample[]> {
  dataPromise ??= loadExamples();
  return dataPromise;
}

export function demoDataPlugin() {
  return {
    name: "pling-demo-data",
    resolveId(id: string) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id: string) {
      if (id !== RESOLVED_ID) return undefined;
      const examples = await getData();
      return `export const DEMO_EXAMPLES = ${JSON.stringify(examples).replace(/</g, "\\u003c")};`;
    },
    configureServer(server: { watcher: { add(path: string): void; on(event: string, cb: (event: string, file: string) => void): void }; moduleGraph: { getModuleById(id: string): unknown; invalidateModule(mod: unknown): void }; ws: { send(payload: { type: string }): void } }) {
      server.watcher.add(ROOT);
      server.watcher.add(WORKSPACE_ROOT);
      server.watcher.on("all", (_event, file) => {
        const normalized = file.replaceAll("\\", "/");
        if (!normalized.startsWith(ROOT.replaceAll("\\", "/")) && !normalized.startsWith(WORKSPACE_ROOT.replaceAll("\\", "/"))) return;
        if (/\/(?:node_modules|dist|\.tmp|\.vite)\//.test(normalized)) return;
        dataPromise = undefined;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}
