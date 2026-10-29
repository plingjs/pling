import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { AgentDock, createPling } from "@plingjs/vue";
import App from "../src/App.vue";
import {
  DEMO_LOCALES,
  copyFor,
  normalizeDemoLocale,
  plingLocale,
  resolveDemoLocale,
  type DemoLocale,
} from "../src/copy";

const cleanup: Array<() => void> = [];

const requestedLocale = normalizeDemoLocale(import.meta.env.VITE_DEMO_LOCALE);
const locales: readonly DemoLocale[] = requestedLocale ? [requestedLocale] : DEMO_LOCALES;

afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

function mountApp(locale: DemoLocale) {
  const reply = locale === "zh"
    ? "页面已连接，但尚未声明任何动作。"
    : "The page is connected. No actions are declared yet.";
  const llm = createReplayLlm([{ content: reply }]);
  const warnings: string[] = [];
  const pling = createPling({
    diagnostics: false,
    presence: false,
    onWarn: (message) => warnings.push(message),
    ui: { locale: plingLocale(locale) },
    agent: { llm },
  });
  const wrapper = mount(App, {
    props: { locale },
    attachTo: document.body,
    global: { plugins: [pling.plugin] },
  });
  cleanup.push(() => {
    wrapper.unmount();
    pling.destroy();
  });
  return { llm, pling, reply, warnings, wrapper };
}

describe.each(locales)("V3-02 · install and first render (%s)", (locale) => {
  const copy = copyFor(locale);

  it("mounts the page and assistant without exposing any actions", () => {
    const { pling, warnings, wrapper } = mountApp(locale);

    expect(wrapper.get("h1").text()).toBe(copy.heading);
    expect(wrapper.get("main").attributes("data-locale")).toBe(locale);
    expect(wrapper.findComponent(AgentDock).exists()).toBe(true);
    expect(wrapper.findComponent(AgentDock).props("title")).toBe(copy.dockTitle);
    expect(pling.registry.snapshot().actions).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("has a ready model connection when an LLM is injected", () => {
    const { wrapper } = mountApp(locale);
    const dock = wrapper.findComponent(AgentDock);

    expect(dock.vm.runtime?.readiness).toMatchObject({ ready: true });
    expect(dock.vm.runtime?.limits.maxTurns).toBe(10);
  });

  it("can open a conversation before any page capability exists", async () => {
    const { llm, reply, wrapper } = mountApp(locale);
    const dock = wrapper.findComponent(AgentDock);

    await dock.vm.send("Is the assistant connected?");

    expect(llm.turn).toBe(1);
    expect(llm.toolsSeen[0]).toEqual([]);
    expect(wrapper.text()).toContain(reply);
  });
});

describe("V3-02 · demo locale resolution", () => {
  it("prefers an explicit query parameter", () => {
    expect(resolveDemoLocale("?lang=zh", "en")).toBe("zh");
    expect(resolveDemoLocale("?lang=en-US", "zh")).toBe("en");
  });

  it("falls back to the build-time demo locale and then English", () => {
    expect(resolveDemoLocale("", "zh")).toBe("zh");
    expect(resolveDemoLocale("", "")).toBe("en");
    expect(resolveDemoLocale("?lang=unknown", "zh")).toBe("zh");
  });
});
