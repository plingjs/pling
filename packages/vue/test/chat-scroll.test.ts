import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { SessionEvent } from "@plingjs/agent";
import AgentChat from "../src/components/AgentChat.vue";

function metrics(element: HTMLElement, scrollHeight: number, clientHeight: number): void {
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(element, "clientHeight", { configurable: true, value: clientHeight });
}

describe("AgentChat transcript scrolling", () => {
  it("does not pull the reader back to the bottom while reading older messages", async () => {
    const wrapper = mount(AgentChat, { attachTo: document.body, props: { events: [] } });
    const transcript = wrapper.find(".transcript").element as HTMLElement;
    metrics(transcript, 1000, 300);

    transcript.scrollTop = 100;
    transcript.dispatchEvent(new Event("scroll"));
    await wrapper.setProps({ events: [{ type: "user", text: "older message" }] });
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(transcript.scrollTop).toBe(100);
    wrapper.unmount();
  });

  it("keeps following new output when the reader is at the bottom", async () => {
    const wrapper = mount(AgentChat, { attachTo: document.body, props: { events: [] } });
    const transcript = wrapper.find(".transcript").element as HTMLElement;
    metrics(transcript, 1000, 300);

    transcript.scrollTop = 700;
    transcript.dispatchEvent(new Event("scroll"));
    await wrapper.setProps({ events: [{ type: "user", text: "new message" }] });
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(transcript.scrollTop).toBe(1000);
    wrapper.unmount();
  });

  it("re-engages following when the user sends a message", async () => {
    const events: SessionEvent[] = [];
    const wrapper = mount(AgentChat, { attachTo: document.body, props: { events } });
    const transcript = wrapper.find(".transcript").element as HTMLElement;
    metrics(transcript, 1000, 300);

    transcript.scrollTop = 100;
    transcript.dispatchEvent(new Event("scroll"));
    await wrapper.find(".composer textarea, .composer input").setValue("send this");
    await wrapper.find(".composer").trigger("submit");
    await wrapper.setProps({ events: [{ type: "user", text: "send this" }] });
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(transcript.scrollTop).toBe(1000);
    wrapper.unmount();
  });
});
