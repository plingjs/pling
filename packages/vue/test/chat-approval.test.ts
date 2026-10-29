import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { PendingApproval } from "@plingjs/agent";
import type { Approval } from "@plingjs/core";
import AgentChat from "../src/components/AgentChat.vue";

function pending(approval: Approval, kind: PendingApproval["request"]["kind"] = "write"): PendingApproval {
  return {
    request: {
      id: "update_note@order:SO-1002",
      kind,
      approval,
      description: "Update the order note",
      args: { record: "SO-1002" },
    },
    createdAt: 0,
  };
}

describe("AgentChat approval choices", () => {
  it("offers the session shortcut only for ask", () => {
    const ask = mount(AgentChat, { props: { pending: pending("ask") } });
    expect(ask.find(".confirm").text()).toContain("Allow for this session");
    ask.unmount();

    const everyTime = mount(AgentChat, { props: { pending: pending("ask-always", "danger") } });
    expect(everyTime.find(".confirm").text()).not.toContain("Allow for this session");
    everyTime.unmount();
  });
});
