const FRAMEWORKS = {
  v3: { path: "vue3", label: "Vue 3" },
  r: { path: "react", label: "React" },
  j: { path: "vanilla", label: "Vanilla JS" },
  v2: { path: "vue2", label: "Vue 2.7" },
};

export const PUBLIC_PREVIEW_AGENT = {
  baseUrl: "/api/agent/v1",
  model: "server-model",
};

export function tutorialFramework(id) {
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(id)) {
    throw new Error(`Invalid tutorial id: ${String(id)}`);
  }
  const key = id.slice(0, id.indexOf("-"));
  const framework = FRAMEWORKS[key];
  if (!framework) throw new Error(`Tutorial ${id} does not map to a framework preview`);
  return { key, ...framework };
}

export function tutorialPreviewPath(id) {
  const framework = tutorialFramework(id);
  return `/demos/tutorials/${framework.path}/${id}/`;
}

export function tutorialPreviewUrl(id, locale = "en") {
  const lang = locale === "zh" ? "zh" : "en";
  return `${tutorialPreviewPath(id)}?lang=${lang}`;
}

export function tutorialLocalCommand(id, locale = "en") {
  const lang = locale === "zh" ? "zh" : "en";
  return `pnpm tutorial:dev ${id} --locale ${lang}`;
}

export function tutorialRunnerMarkdown(id, locale = "en", dir = "") {
  const framework = tutorialFramework(id);
  const zh = locale === "zh";
  const href = tutorialPreviewUrl(id, locale);
  const command = tutorialLocalCommand(id, locale);
  const title = zh ? "在浏览器中运行本章示例" : "Open this chapter in the browser";
  const note = zh
    ? `这里运行与本地夹具相同的 ${framework.label} 源码。模型请求由服务端网关转发，供应商密钥不会进入浏览器。`
    : `This page runs the same ${framework.label} source as the local fixture. Model requests go through a server-side gateway; provider keys stay out of the browser.`;
  const localLabel = zh ? "本地运行" : "Run locally";
  const sourceLabel = zh ? "源码" : "Source";
  const eyebrow = zh ? "可运行示例" : "Runnable example";
  const source = dir ? `examples/tutorials/${dir}/` : "";

  return [
    '<div class="tutorial-runner">',
    `  <div class="tutorial-runner__main"><span class="tutorial-runner__eyebrow">${eyebrow}</span>`,
    `    <a class="tutorial-runner__launch" href="${href}" target="_blank" rel="noopener noreferrer">${title}<span aria-hidden="true">↗</span></a>`,
    `    <p>${note}</p>`,
    "  </div>",
    `  <div class="tutorial-runner__local"><span>${localLabel}</span><code>${command}</code>${source ? `<span>${sourceLabel}</span><code>${source}</code>` : ""}</div>`,
    "</div>",
  ].join("\n");
}
