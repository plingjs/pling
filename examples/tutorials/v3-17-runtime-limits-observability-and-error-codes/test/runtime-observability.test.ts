import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createPolicy } from "@plingjs/core";
import {
  DEFAULT_LIMITS,
  Telemetry,
  checkAgentLimits,
  compactAt,
  createAgentLoop,
  createReplayLlm,
  defaultSettle,
} from "@plingjs/agent";
import { createPling } from "@plingjs/vue";
import OrderFlowPanel from "../src/components/OrderFlowPanel.vue";

const cleanup: Array<() => void> = [];

afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

async function setup() {
  const pling = createPling({
    diagnostics: false,
    ui: { locale: "en-US" },
    agent: { llm: createReplayLlm([]) },
  });
  const wrapper = mount(OrderFlowPanel, {
    attachTo: document.body,
    props: { locale: "en" },
    global: { plugins: [pling.plugin] },
  });
  cleanup.push(() => {
    wrapper.unmount();
    pling.destroy();
  });
  await nextTick();
  return { pling, wrapper };
}

describe("V3-17 · runtime limits and observability", () => {
  it("validates limits before they become mysterious runtime behavior", () => {
    expect(checkAgentLimits(DEFAULT_LIMITS)).toEqual([]);
    expect(checkAgentLimits({ ...DEFAULT_LIMITS, maxTurns: 0 })[0]).toContain("MAX_TURNS");
    expect(checkAgentLimits({ ...DEFAULT_LIMITS, compactRatio: 1.5 })[0]).toContain("COMPACT_RATIO");
    expect(compactAt({ ...DEFAULT_LIMITS, contextTokens: 4_096, reserveForOutput: 512, compactRatio: 0.5 })).toBe(1_792);
  });

  it("reports turns and tool calls with distinct meanings", async () => {
    const { pling } = await setup();
    const telemetry = new Telemetry();
    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(async () => true),
      llm: createReplayLlm([
        { calls: [{ tool: "update_order_note", args: { orderId: "SO-1002", note: "Call back Friday" } }] },
        { content: "The note is saved." },
      ]),
      telemetry,
      maxTurns: 4,
      settle: defaultSettle,
    });

    await loop.run("Change the note on SO-1002 to Call back Friday");

    expect(loop.turnsUsed).toBe(2);
    expect(telemetry.summary()).toMatchObject({ toolCalls: 1 });
    expect(telemetry.events.find((event) => event.type === "tool")).toMatchObject({
      type: "tool",
      tool: "update_order_note",
      status: "ok",
    });
  });

  it("returns a stable code instead of only a prose failure", async () => {
    const { pling, wrapper } = await setup();
    await wrapper.find(".orders__tools .warning").trigger("click");
    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(async () => true),
      llm: createReplayLlm([
        { calls: [{ tool: "update_order_note", args: { orderId: "SO-1004", note: "No save yet" } }] },
        { content: "It did not finish." },
      ]),
      settle: defaultSettle,
    });

    await loop.run("Change the note on SO-1004");
    const toolMessage = [...loop.history.recent].reverse().find((message) => message.role === "tool")!;
    const payload = JSON.parse(toolMessage.content) as { error: { code: string; resume?: { runId: string } } };

    expect(payload.error.code).toBe("STEP_FAILED");
    expect(payload.error.resume?.runId).toMatch(/^run-/);
  });
});
