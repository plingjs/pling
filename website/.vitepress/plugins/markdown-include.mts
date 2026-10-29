import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tutorialRunnerMarkdown } from "../../../scripts/lib/tutorial-previews.mjs";

const tutorialRegistry = JSON.parse(
  readFileSync(new URL("../../../examples/tutorials/registry.json", import.meta.url), "utf8"),
) as Record<string, { title?: string; dir?: string }>;

// The migration chapter compares two maintained fixtures instead of owning a
// third copy. Its wrapper is generated, so the mapping lives here rather than
// in frontmatter that the documentation generator overwrites.
const tutorialPreviewAliases: Record<string, string> = {
  "v2-08": "v2-05",
};

function frontmatterValue(code: string, key: string): string | undefined {
  const frontmatter = code.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return undefined;
  const line = new RegExp(`^${key}:\\s*["']?([^"'\\r\\n]+)["']?\\s*$`, "m").exec(frontmatter[1]);
  return line?.[1]?.trim();
}

/**
 * Small, build-time include for review pages. The public Markdown source lives
 * in content/tutorial; website/ only renders it.
 */
export function markdownIncludePlugin() {
  return {
    name: "pling-markdown-include",
    enforce: "pre" as const,
    async transform(code: string, id: string) {
      if (!id.endsWith(".md") || !code.includes("@include:")) return;
      const pattern = /<!--\s*@include:\s*([^\s]+)\s*-->/g;
      let output = code;
      for (const match of code.matchAll(pattern)) {
        const file = resolve(dirname(id), match[1]);
        const raw = await readFile(file, "utf8");
        const included = raw
          .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n\s*/, "")
          .replace(/^#\s+[^\r\n]+\r?\n+/, "");
        output = output.replace(match[0], included);
      }
      return output;
    },
  };
}

/**
 * Every runnable chapter gets one stable browser entry and one local command.
 * Keeping this at the wrapper level means all 65 fixtures stay in sync without
 * duplicating links in the English and Chinese source Markdown.
 */
export function tutorialPreviewPlugin() {
  return {
    name: "pling-tutorial-preview",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!id.endsWith(".md")) return;
      if (code.includes('class="tutorial-runner"')) return;

      const tutorialId = frontmatterValue(code, "id")?.toLowerCase();
      const previewId = tutorialPreviewAliases[tutorialId ?? ""] ?? tutorialId;
      if (!previewId || !tutorialRegistry[previewId]) return;

      const heading = /^#\s+[^\r\n]+$/m.exec(code);
      if (!heading?.index && heading?.index !== 0) return;
      const afterHeading = heading.index + heading[0].length;
      const locale = frontmatterValue(code, "locale") === "zh" ? "zh" : "en";
      const runner = tutorialRunnerMarkdown(previewId, locale, tutorialRegistry[previewId]?.dir);
      return `${code.slice(0, afterHeading)}\n\n${runner}\n${code.slice(afterHeading)}`;
    },
  };
}
