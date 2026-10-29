import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { SessionEvent } from "@plingjs/agent";
import AgentChat from "../src/components/AgentChat.vue";

describe("AgentChat Markdown 渲染", () => {
  it("uses English framework copy when used without a Pling app", () => {
    const wrapper = mount(AgentChat, { props: { events: [], running: true } });

    expect(wrapper.find("header strong").text()).toBe("Chat");
    expect(wrapper.find(".running").text()).toBe("Working…");
    expect(wrapper.find(".composer button").text()).toBe("Send");
    expect(wrapper.find(".composer input").attributes("aria-label")).toBe("Message");
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
    expect(wrapper.find(".line.assistant strong").text()).toBe("两条");
    expect(wrapper.find(".line.assistant code").text()).toBe("待发货");
    expect(wrapper.findAll(".line.final li")).toHaveLength(2);
    expect(wrapper.findAll(".line.final table tbody tr")).toHaveLength(1);
    expect(wrapper.find(".line.final a").attributes()).toMatchObject({
      href: "https://example.com",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(wrapper.find(".line.user strong").exists()).toBe(false);
    expect(wrapper.find(".line.user").text()).toBe("**用户输入仍是纯文本**");
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
});
