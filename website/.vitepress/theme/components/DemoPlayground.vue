<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useData } from "vitepress";
import { DEMO_EXAMPLES, type DemoFile, type DemoGuideStep } from "virtual:pling-demo-data";

const props = defineProps<{ id: string }>();
const { lang } = useData();
const isZh = computed(() => lang.value.startsWith("zh"));

type Mode = "preview" | "source" | "guide";

interface GuideStepView {
  step: DemoGuideStep;
  file: DemoFile;
  line: number;
  code: string;
}

interface DemoTreeFolder {
  kind: "folder";
  name: string;
  path: string;
  children: DemoTreeNode[];
}

interface DemoTreeFile {
  kind: "file";
  name: string;
  path: string;
  file: DemoFile;
}

type DemoTreeNode = DemoTreeFolder | DemoTreeFile;

interface DemoTreeRow {
  kind: DemoTreeNode["kind"];
  name: string;
  path: string;
  depth: number;
  file?: DemoFile;
  expanded?: boolean;
}

const example = computed(() => DEMO_EXAMPLES.find((item) => item.id === props.id));
const title = computed(() => (isZh.value ? example.value?.titleZh : undefined) ?? example.value?.title ?? "");
const eyebrow = computed(() => (isZh.value ? example.value?.eyebrowZh : undefined) ?? example.value?.eyebrow ?? "");
const summary = computed(() => (isZh.value ? example.value?.summaryZh : undefined) ?? example.value?.summary ?? "");
const guideTitle = computed(() => (isZh.value ? example.value?.guide.titleZh : undefined) ?? example.value?.guide.title ?? "");
const guideIntro = computed(() => (isZh.value ? example.value?.guide.introZh : undefined) ?? example.value?.guide.intro ?? "");
const guideNote = computed(() => (isZh.value ? example.value?.guide.noteZh : undefined) ?? example.value?.guide.note);
const demoOrigin = ref("");
const launchUrl = computed(() => `${demoOrigin.value}${example.value?.url ?? ""}${isZh.value ? "?lang=zh" : ""}`);
const sourcePath = computed(() => example.value?.source ?? `examples/demos/${props.id}/`);
const runCommand = computed(() => example.value?.run ?? "pnpm dev:examples");
const sourceRoot = computed(() => sourcePath.value.replace(/\/$/, "").split("/").pop() ?? props.id);
const workspacePaths = computed(() => {
  const paths = (example.value?.files ?? [])
    .filter((file) => file.scope === "workspace")
    .map((file) => file.path.split("/").slice(0, -1).join("/"))
    .filter(Boolean);
  return [...new Set(paths)]
    .filter((path) => !paths.some((other) => other !== path && path.startsWith(`${other}/`)))
    .map((path) => `examples/${path}/`);
});
const activePath = ref(example.value?.open ?? example.value?.files[0]?.path ?? "");
const mode = ref<Mode>("preview");
const previewKey = ref(0);
const collapsedFolders = ref<ReadonlySet<string>>(new Set());
const activeFile = computed(() => example.value?.files.find((file) => file.path === activePath.value));
const highlightedCount = computed(
  () => example.value?.files.reduce((total, file) => total + file.lines.filter((line) => line.kind).length, 0) ?? 0,
);
const fileTree = computed(() => buildFileTree(example.value?.files ?? []));
const treeRows = computed(() => flattenTree(fileTree.value, collapsedFolders.value));
const guideSteps = computed<readonly GuideStepView[]>(() => {
  const value = example.value;
  if (!value) return [];
  return value.guide.steps.flatMap((step) => {
    const file = value.files.find((candidate) => candidate.path === step.file);
    if (!file) return [];
    const lines = file.source.split("\n");
    const at = lines.findIndex((line) => line.includes(step.match));
    if (at < 0) return [];
    const start = Math.max(0, at - 1);
    const code = lines.slice(start, start + (step.lines ?? 8)).join("\n");
    return [{ step, file, line: at + 1, code }];
  });
});

watch(example, (value) => {
  activePath.value = value?.open ?? value?.files[0]?.path ?? "";
  mode.value = "preview";
  previewKey.value += 1;
  collapsedFolders.value = new Set();
});

onMounted(() => {
  if (["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.port !== "5191") {
    // Keep the hostname stable so HttpOnly SameSite cookies still work inside
    // the docs iframe. Ports do not split the browser's site boundary.
    demoOrigin.value = `${window.location.protocol}//${window.location.hostname}:5191`;
  }
});

function toggleFolder(path: string): void {
  const next = new Set(collapsedFolders.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  collapsedFolders.value = next;
}

function buildFileTree(files: readonly DemoFile[]): DemoTreeNode[] {
  const roots: DemoTreeNode[] = [];
  const folders = new Map<string, DemoTreeFolder>();

  for (const file of files) {
    const parts = file.path.split("/");
    let children = roots;
    let parentPath = "";

    for (const part of parts.slice(0, -1)) {
      const path = parentPath ? `${parentPath}/${part}` : part;
      let folder = folders.get(path);
      if (!folder) {
        folder = { kind: "folder", name: part, path, children: [] };
        folders.set(path, folder);
        children.push(folder);
      }
      children = folder.children;
      parentPath = path;
    }

    children.push({ kind: "file", name: file.label, path: file.path, file });
  }

  return roots;
}

function flattenTree(nodes: readonly DemoTreeNode[], collapsed: ReadonlySet<string>, depth = 0): DemoTreeRow[] {
  const rows: DemoTreeRow[] = [];
  for (const node of nodes) {
    if (node.kind === "folder") {
      const expanded = !collapsed.has(node.path);
      rows.push({ kind: "folder", name: node.name, path: node.path, depth, expanded });
      if (expanded) rows.push(...flattenTree(node.children, collapsed, depth + 1));
      continue;
    }
    rows.push({ kind: "file", name: node.name, path: node.path, depth, file: node.file });
  }
  return rows;
}

function paragraphs(value: string | readonly string[]): readonly string[] {
  return typeof value === "string" ? [value] : value;
}

function fileRole(file: DemoFile): string {
  return (isZh.value ? file.roleZh : undefined) ?? file.role;
}

function stepTitle(step: DemoGuideStep): string {
  return (isZh.value ? step.titleZh : undefined) ?? step.title;
}

function stepBody(step: DemoGuideStep): string | readonly string[] {
  return (isZh.value ? step.bodyZh : undefined) ?? step.body;
}

function openGuideStep(step: GuideStepView): void {
  activePath.value = step.file.path;
  mode.value = "source";
  void nextTick(() => {
    const line = document.querySelector<HTMLElement>(`.demo-code [data-line="${step.line}"]`);
    line?.scrollIntoView({ block: "center", behavior: "smooth" });
    line?.classList.add("demo-line--flash");
    window.setTimeout(() => line?.classList.remove("demo-line--flash"), 1400);
  });
}

function copySource(): void {
  if (!activeFile.value) return;
  void navigator.clipboard?.writeText(activeFile.value.source);
}
</script>

<template>
  <div v-if="example" class="demo-playground">
    <header class="demo-intro">
      <div class="demo-intro__copy">
        <p class="demo-eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <p class="demo-summary">{{ summary }}</p>
      </div>
      <div class="demo-intro__actions">
        <span class="demo-live"><span aria-hidden="true">●</span> {{ isZh ? "独立页面 · 可交互" : "Standalone page · interactive" }}</span>
        <a class="demo-launch" :href="launchUrl" target="_blank" rel="noopener noreferrer">
          {{ isZh ? "在新窗口打开" : "Open standalone" }} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>

    <div class="demo-local">
      <span>{{ isZh ? "运行" : "Run" }}</span>
      <code>{{ runCommand }}</code>
      <span class="demo-local__path">{{ isZh ? "源码" : "Source" }} <code>{{ sourcePath }}</code></span>
      <span v-for="path in workspacePaths" :key="path" class="demo-local__path">
        {{ isZh ? "后端/桥" : "Server/bridge" }} <code>{{ path }}</code>
      </span>
      <span class="demo-local__path">{{ isZh ? "页面" : "Page" }} <code>{{ launchUrl }}</code></span>
    </div>

    <section class="demo-shell" :aria-label="isZh ? '示例源码与接入说明' : 'Example source code and integration guide'">
      <div class="demo-panel-bar">
        <div class="demo-tabs" role="tablist" :aria-label="isZh ? '代码面板视图' : 'Code panel views'">
          <button type="button" role="tab" :aria-selected="mode === 'preview'" :class="{ active: mode === 'preview' }" @click="mode = 'preview'">
            {{ isZh ? "效果预览" : "Preview" }}
          </button>
          <button type="button" role="tab" :aria-selected="mode === 'source'" :class="{ active: mode === 'source' }" @click="mode = 'source'">
            {{ isZh ? "源码" : "Source" }}
          </button>
          <button type="button" role="tab" :aria-selected="mode === 'guide'" :class="{ active: mode === 'guide' }" @click="mode = 'guide'">
            {{ isZh ? "接入说明" : "Integration" }}
          </button>
        </div>
        <div v-if="mode === 'source'" class="demo-panel-actions">
          <span class="demo-active-file">{{ activeFile?.path }}</span>
          <button type="button" @click="copySource">{{ isZh ? "复制文件" : "Copy file" }}</button>
        </div>
      </div>

      <div v-if="mode === 'preview'" class="demo-preview">
        <div class="demo-preview__bar">
          <span>{{ isZh ? "以下页面直接连接同一套业务代码与本地服务。" : "The page below runs the same business code and local services." }}</span>
          <button type="button" @click="previewKey += 1">{{ isZh ? "重新载入" : "Reload" }}</button>
        </div>
        <iframe
          :key="previewKey"
          :src="launchUrl"
          :title="isZh ? `${title} 效果预览` : `${title} preview`"
          loading="eager"
          referrerpolicy="same-origin"
        />
      </div>

      <div v-else-if="mode === 'source'" class="demo-source">
        <nav class="demo-tree" :aria-label="isZh ? '示例文件' : 'Example files'">
          <p class="demo-tree__root">
            <span>{{ sourceRoot }}/</span>
            <span class="demo-tree__count">{{ isZh ? `${example.stats.files} 个文件` : `${example.stats.files} files` }}</span>
          </p>
          <button
            v-for="row in treeRows"
            :key="row.path"
            type="button"
            class="demo-tree__row"
            :class="{
              'demo-tree__row--folder': row.kind === 'folder',
              active: row.kind === 'file' && activePath === row.path,
            }"
            :style="{ '--tree-depth': row.depth }"
            :aria-expanded="row.kind === 'folder' ? row.expanded : undefined"
            @click="row.kind === 'folder' ? toggleFolder(row.path) : (activePath = row.path)"
          >
            <span class="demo-tree__glyph" aria-hidden="true">{{ row.kind === "folder" ? (row.expanded ? "▾" : "▸") : "◇" }}</span>
            <span class="demo-tree__name">{{ row.name }}{{ row.kind === "folder" ? "/" : "" }}</span>
            <span v-if="row.file" class="demo-tree__role">{{ fileRole(row.file) }}</span>
          </button>
        </nav>

        <div class="demo-code">
          <div class="demo-code-toolbar">
            <span>{{ isZh ? `${highlightedCount} 行已标记` : `${highlightedCount} marked lines` }}</span>
            <span>{{ isZh ? "将鼠标移到标记行，查看对应接入点" : "Hover highlighted lines to inspect the integration points" }}</span>
          </div>
          <div v-if="activeFile" class="demo-code__html" v-html="activeFile.html"></div>
        </div>
      </div>

      <article v-else class="demo-guide">
        <header class="demo-guide__head">
          <p>{{ isZh ? "接入说明" : "Integration guide" }}</p>
          <h2>{{ guideTitle }}</h2>
          <div v-for="(paragraph, index) in paragraphs(guideIntro)" :key="index" class="demo-guide__intro">
            {{ paragraph }}
          </div>
        </header>

        <section v-for="(step, index) in guideSteps" :key="`${step.file.path}:${step.line}`" class="demo-guide__step">
          <div class="demo-guide__number">{{ String(index + 1).padStart(2, "0") }}</div>
          <div class="demo-guide__body">
            <button type="button" class="demo-guide__title" @click="openGuideStep(step)">{{ stepTitle(step.step) }}</button>
            <p v-for="(paragraph, paragraphIndex) in paragraphs(stepBody(step.step))" :key="paragraphIndex">{{ paragraph }}</p>
            <pre class="demo-guide__code"><code>{{ step.code }}</code></pre>
            <div class="demo-guide__step-footer">
              <span>{{ step.file.label }}:{{ step.line }}</span>
              <button type="button" @click="openGuideStep(step)">{{ isZh ? "在源码中打开" : "Open in source" }}</button>
            </div>
          </div>
        </section>

        <p v-if="guideNote" class="demo-guide__note">{{ guideNote }}</p>
      </article>
    </section>
  </div>
</template>

<style scoped>
.demo-playground {
  box-sizing: border-box;
  width: min(1480px, 100%);
  margin: 0 auto;
  padding: 8px 24px 40px;
  color: var(--vp-c-text-1);
}
.demo-intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 12px 2px 20px;
}
.demo-intro__copy {
  min-width: 0;
}
.demo-eyebrow {
  margin: 0 0 9px;
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 750;
  line-height: 1.35;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.demo-intro h1 {
  margin: 0;
  border: 0;
  padding: 0;
  font-size: clamp(30px, 4vw, 44px);
  line-height: 1.16;
  letter-spacing: -0.04em;
}
.demo-summary {
  max-width: 760px;
  margin: 11px 0 0;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.65;
}
.demo-local {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 14px 0 12px;
  color: var(--vp-c-text-3);
  font-size: 11px;
}
.demo-local > span:first-child {
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.demo-local code {
  padding: 4px 7px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
  font-size: 11px;
}
.demo-local__path {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.demo-intro__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;
}
.demo-live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  color: var(--vp-c-text-2);
  font-size: 11px;
  white-space: nowrap;
}
.demo-live span {
  color: #22a06b;
  font-size: 8px;
}
.demo-launch {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 15px;
  border-radius: 10px;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 13px;
  font-weight: 650;
  text-decoration: none;
  box-shadow: 0 8px 20px rgb(46 157 247 / 20%);
  transition:
    background 140ms ease,
    transform 140ms ease;
}
.demo-launch:hover {
  background: var(--vp-c-brand-2);
  transform: translateY(-1px);
}
.demo-shell {
  display: flex;
  height: clamp(520px, calc(100dvh - 210px), 780px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  background: #0b1220;
  box-shadow: 0 20px 54px rgb(15 23 42 / 9%);
}
.demo-preview {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #fff;
}
.demo-preview__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 38px;
  padding: 7px 12px;
  border-bottom: 1px solid #e5e9f0;
  background: #f7f9fc;
  color: #62748b;
  font-size: 10px;
}
.demo-preview__bar button {
  padding: 5px 8px;
  border: 1px solid #d6dde8;
  border-radius: 6px;
  background: #fff;
  color: #40566f;
  font-size: 10px;
  cursor: pointer;
}
.demo-preview iframe {
  width: 100%;
  min-height: 0;
  flex: 1;
  border: 0;
  background: #fff;
}
.demo-panel-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 50px;
  padding: 8px 12px;
  border-bottom: 1px solid rgb(148 163 184 / 15%);
  background: #0d1626;
}
.demo-tabs,
.demo-panel-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.demo-tabs button,
.demo-panel-actions button {
  padding: 6px 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #8fa3bb;
  font-size: 11px;
  cursor: pointer;
}
.demo-tabs button.active,
.demo-panel-actions button.active {
  background: rgb(46 157 247 / 16%);
  color: #b9e0ff;
}
.demo-panel-actions button {
  border: 1px solid rgb(148 163 184 / 18%);
}
.demo-panel-actions button:hover {
  border-color: rgb(46 157 247 / 45%);
  color: #c8e7ff;
}
.demo-active-file {
  max-width: 280px;
  overflow: hidden;
  color: #69819d;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.demo-source {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  min-height: 0;
  flex: 1;
}
.demo-tree {
  height: 100%;
  padding: 8px;
  overflow: auto;
  border-right: 1px solid rgb(148 163 184 / 12%);
  background: #0a111e;
}
.demo-tree__root {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 5px;
  padding: 5px 8px 8px;
  color: #7f95ae;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
}
.demo-tree__count {
  color: #526c86;
  font-size: 9px;
  white-space: nowrap;
}
.demo-tree__row {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px 6px calc(8px + var(--tree-depth, 0) * 14px);
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #9db0c6;
  text-align: left;
  cursor: pointer;
}
.demo-tree__row:hover,
.demo-tree__row.active {
  background: rgb(148 163 184 / 10%);
  color: #e7eef8;
}
.demo-tree__row.active {
  box-shadow: inset 2px 0 #2e9df7;
}
.demo-tree__row--folder {
  color: #7f95ae;
}
.demo-tree__glyph {
  color: #53718f;
  font-size: 10px;
}
.demo-tree__name {
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.demo-tree__role {
  color: #607a96;
  font-size: 9px;
  white-space: nowrap;
}
.demo-code {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  counter-reset: demo-line;
}
.demo-code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 34px;
  padding: 7px 14px;
  border-bottom: 1px solid rgb(148 163 184 / 10%);
  color: #69819d;
  font-size: 10px;
}
.demo-code-toolbar span:last-child {
  text-align: right;
}
.demo-code__html {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 8px 0 24px;
}
.demo-code__html :deep(pre) {
  margin: 0;
  padding: 0;
  background: transparent !important;
}
.demo-code__html :deep(code) {
  display: block;
  min-width: max-content;
  padding: 0 20px 0 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  counter-reset: none;
}
.demo-code__html :deep(.line) {
  position: relative;
  display: block;
  min-height: 0;
  padding-left: 42px;
  line-height: 1.6;
  counter-increment: demo-line;
}
.demo-code__html :deep(.line)::before {
  position: absolute;
  left: 0;
  width: 28px;
  color: #40526a;
  content: counter(demo-line);
  text-align: right;
  user-select: none;
}
.demo-code__html :deep(.demo-line--import) {
  background: rgb(46 157 247 / 10%);
  box-shadow: inset 2px 0 #2e9df7;
}
.demo-code__html :deep(.demo-line--setup) {
  background: rgb(46 157 247 / 13%);
  box-shadow: inset 2px 0 #58b4ff;
}
.demo-code__html :deep(.demo-line--declare),
.demo-code__html :deep(.demo-line--entry) {
  background: rgb(46 157 247 / 17%);
  box-shadow: inset 2px 0 #2e9df7;
}
.demo-code__html :deep(.demo-line--linked:hover) {
  background: rgb(46 157 247 / 27%);
}
.demo-code__html :deep(.line.demo-line--flash) {
  background: rgb(46 157 247 / 38%);
}
.demo-guide {
  width: min(860px, calc(100% - 48px));
  min-height: 0;
  margin: 0 auto;
  padding: 30px 0 44px;
  overflow: auto;
  color: #cbd8e8;
}
.demo-guide__head > p {
  margin: 0 0 7px;
  color: #2e9df7;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.demo-guide__head h2 {
  margin: 0;
  color: #eef6ff;
  font-size: 24px;
  letter-spacing: -0.02em;
}
.demo-guide__intro,
.demo-guide__intro p {
  margin: 10px 0 0;
  color: #91a6bd;
  font-size: 13px;
  line-height: 1.7;
}
.demo-guide__step {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 12px;
  margin-top: 26px;
  padding-top: 24px;
  border-top: 1px solid rgb(148 163 184 / 14%);
}
.demo-guide__number {
  padding-top: 2px;
  color: #2e9df7;
  font-family: ui-monospace, monospace;
  font-size: 10px;
}
.demo-guide__title {
  padding: 0;
  border: 0;
  background: transparent;
  color: #eef6ff;
  font-size: 15px;
  font-weight: 650;
  text-align: left;
  cursor: pointer;
}
.demo-guide__title:hover {
  color: #b9e0ff;
}
.demo-guide__body p {
  margin: 8px 0 0;
  color: #91a6bd;
  font-size: 13px;
  line-height: 1.7;
}
.demo-guide__code {
  margin: 13px 0 0;
  padding: 12px 14px;
  overflow: auto;
  border: 1px solid rgb(148 163 184 / 14%);
  border-radius: 8px;
  background: #080f1b;
  color: #c7d6e8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.65;
  white-space: pre;
}
.demo-guide__step-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  color: #607a96;
  font-size: 10px;
}
.demo-guide__step-footer button {
  padding: 4px 7px;
  border: 1px solid rgb(148 163 184 / 20%);
  border-radius: 8px;
  background: transparent;
  color: #9fc6e8;
  font-size: 11px;
  cursor: pointer;
}
.demo-guide__note {
  margin: 28px 0 0;
  padding: 13px 14px;
  border-left: 2px solid #2e9df7;
  background: rgb(46 157 247 / 7%);
  color: #91a6bd;
  font-size: 12px;
  line-height: 1.7;
}
@media (max-width: 960px) {
  .demo-playground {
    width: 100%;
    padding-right: 16px;
    padding-left: 16px;
  }
  .demo-intro {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }
  .demo-intro__actions {
    flex-wrap: wrap;
  }
  .demo-shell {
    height: auto;
  }
  .demo-preview {
    flex: none;
    height: min(620px, 72dvh);
    min-height: 420px;
  }
  .demo-source {
    grid-template-columns: minmax(0, 1fr);
  }
  .demo-tree {
    height: auto;
    max-height: 230px;
    border-right: 0;
    border-bottom: 1px solid rgb(148 163 184 / 12%);
  }
  .demo-code {
    height: 520px;
  }
  .demo-guide {
    max-height: 640px;
  }
}
@media (max-width: 720px) {
  .demo-playground {
    width: 100%;
    padding-right: 10px;
    padding-left: 10px;
  }
  .demo-intro h1 {
    font-size: 30px;
  }
  .demo-preview {
    height: min(540px, 68dvh);
    min-height: 360px;
  }
  .demo-live {
    display: none;
  }
  .demo-active-file,
  .demo-code-toolbar span:last-child {
    display: none;
  }
  .demo-code {
    height: 460px;
  }
  .demo-guide {
    width: calc(100% - 28px);
    padding-top: 22px;
  }
  .demo-guide__step {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
}
</style>
