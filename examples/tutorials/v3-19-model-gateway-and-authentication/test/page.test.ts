import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createPling } from "@plingjs/vue";
import App from "../src/App.vue";

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

describe("V3-19 · browser page", () => {
  it("declares ordinary page capabilities and shows no provider key", async () => {
    const pling = createPling({ diagnostics: false, agent: { llm: createReplayLlm([]) } });
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [pling.plugin] } });
    cleanup = () => { wrapper.unmount(); pling.destroy(); };
    await nextTick();

    expect(pling.registry.snapshot().actions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["add_task", "toggle@t1", "sign_in_status"]),
    );
    expect(pling.registry.snapshot().records).toHaveLength(3);
    expect(wrapper.text()).toContain("API key: none in the browser");
    expect(wrapper.text()).not.toContain("server-provider-key");
  });
});
