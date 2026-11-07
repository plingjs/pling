import { mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { AgentInline, createPling } from "../src";

const mounted: Array<{ wrapper: ReturnType<typeof mount>; destroy: () => void }> = [];

function setup(handler: (text: string) => { handled: boolean; reply?: string } | undefined) {
  const pi = createPling({
    onWarn: () => {},
    agent: {
      config: { baseUrl: "/llm/v1", model: "test-model" },
      gate: () => false,
      llm: createReplayLlm([{ content: "model reply" }]),
    },
  });
  const Host = defineComponent({
    components: { AgentInline },
    setup: () => ({ handler }),
    template: `<AgentInline :before-send="handler" />`,
  });
  const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
  mounted.push({ wrapper, destroy: () => pi.destroy() });
  return wrapper;
}

async function send(wrapper: ReturnType<typeof mount>, text: string): Promise<void> {
  await wrapper.find(".dock__chat .composer input").setValue(text);
  await wrapper.find(".dock__chat form").trigger("submit");
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("wait timed out");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

afterEach(() => {
  while (mounted.length) {
    const item = mounted.pop();
    item?.wrapper.unmount();
    item?.destroy();
  }
});

describe("<AgentInline> local beforeSend", () => {
  it("answers a handled message without calling the model", async () => {
    const wrapper = setup((text) => ({ handled: true, reply: `local: ${text}` }));

    await send(wrapper, "难度改成 4 星");

    expect(wrapper.find(".dock__chat").text()).toContain("难度改成 4 星");
    expect(wrapper.find(".dock__chat").text()).toContain("local: 难度改成 4 星");
    expect(wrapper.find(".dock__chat").text()).not.toContain("model reply");
  });

  it("falls through to the model when the handler declines", async () => {
    const wrapper = setup(() => undefined);

    await send(wrapper, "普通问题");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("model reply"));

    expect(wrapper.find(".dock__chat").text()).toContain("普通问题");
    expect(wrapper.find(".dock__chat").text()).toContain("model reply");
  });
});
