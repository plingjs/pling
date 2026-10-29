import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { RESUME_FLOW_ACTION_ID, createExecutor, createPolicy, type ExecResult } from "@plingjs/core";
import { createReplayLlm, defaultSettle } from "@plingjs/agent";
import { createPling } from "@plingjs/vue";
import OrderFlowPanel from "../src/components/OrderFlowPanel.vue";

const cleanup: Array<() => void> = [];

afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

async function mountPanel(locale: "en" | "zh" = "en") {
  const pling = createPling({
    diagnostics: false,
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: { llm: createReplayLlm([]) },
  });
  const wrapper = mount(OrderFlowPanel, {
    attachTo: document.body,
    props: { locale },
    global: { plugins: [pling.plugin] },
  });
  cleanup.push(() => {
    wrapper.unmount();
    pling.destroy();
  });
  await nextTick();
  return { pling, wrapper };
}

function executorFor(pling: ReturnType<typeof createPling>) {
  return createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => true),
    settle: defaultSettle,
  });
}

function noteOf(wrapper: ReturnType<typeof mount>, id: string): string | undefined {
  return wrapper.find(`[data-order="${id}"] .orders__note`).text();
}

function outOf(result: ExecResult): Extract<ExecResult, { result: unknown }> {
  if ("error" in result) throw new Error(result.error.message);
  return result;
}

describe("V3-18 · sensitive data", () => {
  it("registers one flow and four ordinary row actions", async () => {
    const { pling } = await mountPanel();
    const snapshot = pling.registry.snapshot();
    const flow = snapshot.actions.find((action) => action.id === "update_order_note");

    expect(flow).toMatchObject({ primitive: "flow", flowSteps: 4, kind: "write" });
    expect(snapshot.records).toHaveLength(4);
    expect(snapshot.actions.filter((action) => action.id.startsWith("open_order@"))).toHaveLength(4);
  });

  it("runs the fixed sequence as one tool call and waits for the delayed save", async () => {
    const { pling, wrapper } = await mountPanel();
    const executor = executorFor(pling);

    const result = outOf(
      await executor.execute(
        "update_order_note",
        JSON.stringify({ orderId: "SO-1002", note: "Call back Friday" }),
      ),
    );
    await nextTick();

    expect(result.result).toMatchObject({ ok: true, flow: { completed: 4, total: 4 } });
    expect(noteOf(wrapper, "SO-1002")).toBe("Call back Friday");
    expect(wrapper.find(".overlay").exists()).toBe(false);
  });

  it("resumes at the failed step instead of replaying completed steps", async () => {
    const { pling, wrapper } = await mountPanel();
    const executor = executorFor(pling);

    await wrapper.find(".orders__tools .warning").trigger("click");
    const failed = await executor.execute(
      "update_order_note",
      JSON.stringify({ orderId: "SO-1004", note: "Call after lunch" }),
    );

    expect("error" in failed).toBe(true);
    if (!("error" in failed)) return;
    expect(failed.error.code).toBe("STEP_FAILED");
    expect(failed.error.message).toContain("failed at step 4/4");
    expect(failed.error.message).toContain("3/4 steps");
    expect(failed.error.message).toContain("already taken effect");
    expect(failed.error.resume).toMatchObject({ flowId: "update_order_note", from: 4, failedAt: 4 });
    expect(noteOf(wrapper, "SO-1004")).toBe("Waiting for PO number");
    expect(wrapper.find(".overlay").exists()).toBe(true);

    await wrapper.find(".orders__tools .warning").trigger("click");
    const resumed = outOf(
      await executor.execute(RESUME_FLOW_ACTION_ID, JSON.stringify({ runId: failed.error.resume!.runId })),
    );
    await nextTick();

    expect(resumed.result).toMatchObject({ ok: true, flow: { completed: 4, total: 4 } });
    expect(noteOf(wrapper, "SO-1004")).toBe("Call after lunch");
    expect(wrapper.find(".overlay").exists()).toBe(false);
    expect(pling.registry.snapshot().actions.some((action) => action.id === RESUME_FLOW_ACTION_ID)).toBe(false);
  });

  it("rejects an order id that is no longer an available choice", async () => {
    const { pling } = await mountPanel();
    const executor = executorFor(pling);
    const result = await executor.execute(
      "update_order_note",
      JSON.stringify({ orderId: "SO-9999", note: "No such record" }),
    );

    expect("error" in result && result.error.code).toBe("INVALID_PARAMS");
    expect("error" in result && result.error.message).toContain("SO-9999");
  });

  it("localizes the visible operation and the declared descriptions", async () => {
    const { pling, wrapper } = await mountPanel("zh");
    await wrapper.find('[data-order="SO-1001"] .orders__actions button:last-child').trigger("click");
    await nextTick();
    const snapshot = pling.registry.snapshot();

    expect(wrapper.text()).toContain("订单备注");
    expect(snapshot.actions.find((action) => action.id === "update_order_note")?.description).toContain("备注");
    expect(snapshot.actions.find((action) => action.id === "save_note")?.description).toContain("保存");
  });
});
