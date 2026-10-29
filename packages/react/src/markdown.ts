import MarkdownIt from "markdown-it";

/**
 * 聊天里的 Markdown 渲染。
 *
 * 与 Vue 适配器保持同一条安全边界：`html: false`（模型不能注入 HTML），
 * 外链只允许 http(s) / mailto，并补 `noopener noreferrer`。
 */
const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

markdown.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  const token = tokens[index]!;
  const href = String(token.attrGet("href") ?? "");
  if (/^(?:https?:|mailto:)/i.test(href)) {
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
  }
  return self.renderToken(tokens, index, options);
};

export function renderMarkdown(text: string): string {
  return markdown.render(text);
}
