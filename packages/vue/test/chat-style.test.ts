import { describe, expect, it } from "vitest";
import { PLING_UI_STYLES } from "@plingjs/dom";
import { mount } from "@vue/test-utils";
import AgentChat from "../src/components/AgentChat.vue";

describe("AgentChat style isolation", () => {
  it("owns the composer visuals in the shared canonical stylesheet", () => {
    expect(PLING_UI_STYLES).toContain(".pling-chat__composer-box {");
    expect(PLING_UI_STYLES).toContain(".pling-chat__send {");
    expect(PLING_UI_STYLES).toContain("background: var(--pling-color-primary, #2e9df7);");
    expect(PLING_UI_STYLES).toContain(".pling-chat__send:disabled {");
  });

  it("keeps a two-line composer by default and sends from the in-field icon", async () => {
    const wrapper = mount(AgentChat, { props: { events: [] } });
    const textarea = wrapper.find(".composer textarea");

    expect(textarea.exists()).toBe(true);
    expect(textarea.attributes("rows")).toBe("2");
    expect(wrapper.find(".pling-chat__send svg").exists()).toBe(true);
    await textarea.setValue("hello");
    await wrapper.find(".composer").trigger("submit");
    expect(wrapper.emitted("send")).toEqual([["hello"]]);
    wrapper.unmount();
  });
});
