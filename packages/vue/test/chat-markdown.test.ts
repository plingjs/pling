import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { SessionEvent } from "@plingjs/agent";
import AgentChat from "../src/components/AgentChat.vue";

describe("AgentChat Markdown 渲染", () => {
  it("uses English framework copy when used without a Pling app", () => {
    const wrapper = mount(AgentChat, { props: { events: [], running: true } });

    expect(wrapper.find("header strong").text()).toBe("Chat");
    expect(wrapper.find(".running").text()).toBe("Working…");
    expect(wrapper.find(".pling-chat__send").attributes("aria-label")).toBe("Send");
    expect(wrapper.find(".composer textarea, .composer input").attributes("aria-label")).toBe("Message");
    wrapper.unmount();
  });

  it("multiline composer keeps Shift+Enter for a new line and sends on Enter", async () => {
    const wrapper = mount(AgentChat, { props: { multiline: true } });
    const composer = wrapper.find(".composer textarea");

    expect(composer.exists()).toBe(true);
    await composer.setValue("First line");
    await composer.trigger("keydown", { key: "Enter", shiftKey: true });
    expect(wrapper.emitted("send")).toBeUndefined();

    await composer.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("send")).toEqual([["First line"]]);
    expect((wrapper.find(".composer textarea").element as HTMLTextAreaElement).value).toBe("");
    wrapper.unmount();
  });

  it("渲染助手和最终回复的常用 Markdown", () => {
    const events: SessionEvent[] = [
      { type: "user", text: "**用户输入仍是纯文本**" },
      { type: "assistant", text: "## 处理中\n\n已找到 **两条**记录，状态是 `待发货`。" },
      {
        type: "final",
        text: "- 第一条\n- 第二条\n\n| 订单号 | 金额 |\n| --- | ---: |\n| SO-1002 | 8800 |\n\n[查看文档](https://example.com)",
      },
    ];
    const wrapper = mount(AgentChat, { props: { events } });

    expect(wrapper.find(".line.assistant h2").text()).toBe("处理中");
    expect(wrapper.find(".line.assistant .markdown strong").text()).toBe("两条");
    expect(wrapper.find(".line.assistant code").text()).toBe("待发货");
    expect(wrapper.findAll(".line.final li")).toHaveLength(2);
    expect(wrapper.findAll(".line.final table tbody tr")).toHaveLength(1);
    expect(wrapper.find(".line.final a").attributes()).toMatchObject({
      href: "https://example.com",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(wrapper.find(".line.user strong").exists()).toBe(false);
    expect(wrapper.find(".line.user .line-body").text()).toBe("**用户输入仍是纯文本**");
    wrapper.unmount();
  });

  it("不执行模型文本中的原始 HTML，也不生成 javascript 链接", () => {
    const wrapper = mount(AgentChat, {
      props: {
        events: [{ type: "final", text: '<img src=x onerror="alert(1)">\n\n[危险链接](javascript:alert(1))' }],
      },
    });
    const message = wrapper.find(".line.final");

    expect(message.find("img").exists()).toBe(false);
    expect(message.find("a").exists()).toBe(false);
    expect(message.text()).toContain('<img src=x onerror="alert(1)">');
    wrapper.unmount();
  });

  it("reveal：代号只在这一层还原，事件流仍是代号", () => {
    const events = [
      { type: "user", text: "打给 13810005754" },
      { type: "final", text: "已拨通：{{p:1w9el7a}}" },
    ] satisfies SessionEvent[];
    const wrapper = mount(AgentChat, {
      props: { events, reveal: (text: string) => text.replaceAll("{{p:1w9el7a}}", "13810005754") },
    });

    expect(wrapper.find(".line.final").text()).toContain("13810005754");
    expect(wrapper.find(".line.final").text()).not.toContain("{{p:");
    // 事件（= 会话历史与下一次请求的来源）没被改写
    expect(events[1]!.text).toContain("{{p:1w9el7a}}");
    wrapper.unmount();
  });

  it("不给 reveal 就原样显示代号（默认不猜）", () => {
    const wrapper = mount(AgentChat, {
      props: { events: [{ type: "final", text: "已拨通：{{p:1w9el7a}}" }] },
    });

    expect(wrapper.find(".line.final").text()).toContain("{{p:1w9el7a}}");
    wrapper.unmount();
  });

  it("speakers 在消息上方渲染说话人与时间", () => {
    const events: SessionEvent[] = [
      { type: "user", text: "帮我建课程" },
      { type: "final", text: "已经建好" },
    ];
    const wrapper = mount(AgentChat, { props: { events, speakers: true } });

    expect(wrapper.findAll(".line-head")).toHaveLength(2);
    expect(wrapper.find(".line.user .line-head span").text()).toMatch(/^(我|Me)$/);
    expect(wrapper.find(".line.final .line-head strong").text()).toBe("Pling");
    expect(wrapper.find(".line.final .line-head time").text()).toMatch(/^\d{2}:\d{2}$/);
    wrapper.unmount();
  });

  it("guide 插槽渲染在对话上方，并替代空状态提示", () => {
    const wrapper = mount(AgentChat, {
      props: { events: [], emptyHint: "fallback" },
      slots: { guide: '<section class="custom-guide">Next field</section>' },
    });

    expect(wrapper.find(".chat-guide .custom-guide").text()).toBe("Next field");
    expect(wrapper.find(".empty").exists()).toBe(false);
    wrapper.unmount();
  });

  it("guidePlacement=end 把引导作为最新一条消息渲染在对话之后", () => {
    const events: SessionEvent[] = [{ type: "final", text: "上一轮回答" }];
    const wrapper = mount(AgentChat, {
      props: { events, guidePlacement: "end" },
      slots: { guide: '<section class="custom-guide">Next field</section>' },
    });

    const transcript = wrapper.find(".transcript");
    const children = Array.from(transcript.element.children);
    expect(children.at(-1)?.classList.contains("chat-guide--end")).toBe(true);
    expect(transcript.find(".line.final .markdown").text()).toBe("上一轮回答");
    expect(transcript.find(".chat-guide--end .custom-guide").text()).toBe("Next field");
    wrapper.unmount();
  });
});
