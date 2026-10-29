import { mount } from "@vue/test-utils";
import { createSSRApp, nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling } from "@plingjs/vue";
import App from "../src/App.vue";
import { renderTodoSsr } from "../src/ssr";

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

async function setup(locale: "en" | "zh" = "en") {
  const pling = createPling({
    diagnostics: false,
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: { llm: createReplayLlm([]) },
  });
  const wrapper = mount(App, {
    attachTo: document.body,
    props: { locale },
    global: { plugins: [pling.plugin] },
  });
  cleanup = () => { wrapper.unmount(); pling.destroy(); };
  await nextTick();
  return { pling, wrapper };
}

describe("V3-24 · Nuxt and SSR boundary", () => {
  it("renders the business page on the server without creating the runtime", async () => {
    const html = await renderTodoSsr("en");

    expect(html).toContain("Review the release checklist");
    expect(html).toContain("Server-rendered first paint");
    expect(html).not.toContain("AgentDock");
    expect(html).not.toContain("data-pling");
  });

  it("renders the Chinese first paint with the server-side locale", async () => {
    const html = await renderTodoSsr("zh");

    expect(html).toContain("检查发布清单");
    expect(html).toContain("服务端首屏");
    expect(html).toContain("1 条已完成");
    expect(html).not.toContain("1 completed");
  });

  it("hydrates the server HTML before attaching the client assistant", async () => {
    const html = await renderTodoSsr("en");
    document.body.innerHTML = `<div id="ssr-root">${html}</div>`;
    const pling = createPling({
      diagnostics: false,
      ui: { locale: "en-US" },
      agent: { llm: createReplayLlm([]) },
    });
    const app = createSSRApp(App, { locale: "en" });
    app.use(pling.plugin);
    app.mount("#ssr-root");
    await nextTick();
    await nextTick();
    cleanup = () => {
      app.unmount();
      pling.destroy();
      document.body.innerHTML = "";
    };

    expect(document.querySelector(".tasks")?.textContent).toContain("Review the release checklist");
    expect(document.querySelector(".dock")).not.toBeNull();
    expect(pling.registry.snapshot().actions.map((action) => action.id)).toContain("todo.add");
  });

  it("attaches the capability layer after the client mounts", async () => {
    const { pling, wrapper } = await setup();
    const snapshot = pling.registry.snapshot();

    expect(snapshot.state.todo_ssr).toEqual({ total: 3, open: 2, completed: 1 });
    expect(snapshot.actions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["todo.overview", "todo.add", "todo.clear_completed"]),
    );
    expect(wrapper.text()).toContain("The assistant is created only on the client");
  });

  it("executes a tool against the mounted client component", async () => {
    const { pling, wrapper } = await setup();
    const executor = createExecutor({
      registry: pling.registry,
      policy: createPolicy(async () => true),
      settle: async () => { await nextTick(); },
    });

    await executor.execute("todo.add", JSON.stringify({ text: "Hydration check" }));
    await nextTick();

    expect(wrapper.findAll(".tasks li")[0]?.text()).toContain("Hydration check");
    expect(pling.registry.snapshot().state.todo_ssr).toMatchObject({ total: 4, open: 3, completed: 1 });
  });
});
