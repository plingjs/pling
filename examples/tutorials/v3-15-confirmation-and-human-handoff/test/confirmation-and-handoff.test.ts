import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm, defaultSettle } from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling, type PlingElement } from "@plingjs/vue";
import App from "../src/App.vue";
import type { DemoLocale } from "../src/copy";
import { routes } from "../src/router";

const cleanup: Array<() => void> = [];

afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

async function mountApp(locale: DemoLocale = "en") {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push("/tasks");
  await router.isReady();
  const pling = createPling({
    diagnostics: false,
    presence: { effect: "spotlight" },
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: { llm: createReplayLlm([]) },
  });
  const wrapper = mount(App, {
    attachTo: document.body,
    props: { locale },
    global: { plugins: [router, pling.plugin] },
  });
  cleanup.push(() => {
    wrapper.unmount();
    pling.destroy();
  });
  await nextTick();
  return { pling, wrapper };
}

function executorFor(pling: PlingElement, options: { allow?: boolean; handoff?: () => Promise<"done" | "cancelled" | "timeout"> } = {}) {
  return createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => options.allow ?? true),
    settle: defaultSettle,
    ...(options.handoff ? { handoff: options.handoff } : {}),
  });
}

describe("V3-15 · confirmation and human handoff", () => {
  it("maps declarations to the three approval policies", async () => {
    const { pling } = await mountApp();
    const actions = pling.registry.snapshot().actions;

    expect(actions.find((action) => action.id === "workspace_name")?.approval).toBe("none");
    expect(actions.find((action) => action.id === "save_workspace_name")?.approval).toBe("ask");
    expect(actions.find((action) => action.id === "archive_workspace")?.approval).toBe("ask-always");
    expect(actions.find((action) => action.id === "reset_workspace")?.approval).toBe("ask-always");
    expect(actions.find((action) => action.id === "publish_changes")?.handoff?.reason).toContain("verification code");
  });

  it("does not run a dangerous action when approval is denied", async () => {
    const { pling } = await mountApp();
    const result = await executorFor(pling, { allow: false }).execute("archive_workspace", "{}");

    expect("error" in result && result.error.code).toBe("PERMISSION_DENIED");
    expect(pling.registry.snapshot().actions.some((action) => action.id === "archive_workspace")).toBe(true);
  });

  it("does not simulate a handoff when the user cancels", async () => {
    const { pling } = await mountApp();
    const result = await executorFor(pling, { allow: true, handoff: async () => "cancelled" }).execute(
      "publish_changes",
      "{}",
    );

    expect("error" in result && result.error.code).toBe("HANDOFF_CANCELLED");
    expect("error" in result && result.error.message).toContain("verification code");
  });

  it("returns a successful receipt after the user completes the handoff", async () => {
    const { pling, wrapper } = await mountApp();
    const executor = executorFor(pling, {
      allow: true,
      handoff: async () => {
        await wrapper.find('input[data-pling-field="verification_code"]').setValue("246810");
        await wrapper.find("[data-publish]").trigger("click");
        return "done";
      },
    });

    const result = await executor.execute("publish_changes", "{}");

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error(result.error.message);
    expect(result.result).toMatchObject({
      handoff: { reason: "The user must confirm the verification code before publishing." },
    });
    expect(wrapper.find(".release__status").text()).toBe("Published");
  });

  it("supplies localized approval and handoff copy", async () => {
    const { pling, wrapper } = await mountApp("zh");
    const actions = pling.registry.snapshot().actions;

    expect(actions.find((action) => action.id === "archive_workspace")?.description).toContain("归档");
    expect(actions.find((action) => action.id === "publish_changes")?.handoff?.reason).toContain("验证码");
    expect(wrapper.text()).toContain("重置工作区");
  });
});
