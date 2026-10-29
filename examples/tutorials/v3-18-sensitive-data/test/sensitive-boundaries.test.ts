import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createReplayLlm, defaultSettle } from "@plingjs/agent";
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
  const executor = createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => true),
    settle: defaultSettle,
  });
  return { pling, wrapper, executor };
}

function fieldsOf(pling: ReturnType<typeof createPling>, id: string): Record<string, unknown> {
  return pling.registry.snapshot().records.find((record) => record.id === id)!.fields as Record<string, unknown>;
}

describe("V3-18 · sensitive data", () => {
  it("projects token, masked, and hidden values without leaking the originals", async () => {
    const { pling } = await setup();
    const fields = fieldsOf(pling, "SO-1002");
    const snapshot = JSON.stringify(pling.registry.snapshot());

    expect(fields.phone).toMatch(/^\{\{p:[0-9a-z]+\}\}$/);
    expect(fields.idCard).toBe("P-1****1198");
    expect(fields.grade).toBe("[hidden]");
    expect(snapshot).not.toContain("+1 415 555 0137");
    expect(snapshot).not.toContain("P-1002-1198");
  });

  it("restores a token before the business function runs", async () => {
    const { pling, wrapper, executor } = await setup();
    const token = String(fieldsOf(pling, "SO-1002").phone);

    const result = await executor.execute("call_customer@SO-1002", JSON.stringify({ phone: token }));
    await nextTick();

    expect("error" in result).toBe(false);
    expect((wrapper.vm as unknown as { lastDialed: string }).lastDialed).toBe("+1 415 555 0137");
    expect(wrapper.text()).toContain("0137");
    expect(wrapper.text()).not.toContain("+1 415 555 0137");
  });

  it("redacts a restored token from an outbound error message", async () => {
    const { pling, executor } = await setup();
    const token = String(fieldsOf(pling, "SO-1002").phone);

    const result = await executor.execute("verify_customer", JSON.stringify({ phone: token }));

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error.code).toBe("EXECUTION_FAILED");
    expect(result.error.message).toContain(token);
    expect(result.error.message).not.toContain("+1 415 555 0137");
  });

  it("rejects a made-up token instead of sending it to the business function", async () => {
    const { executor } = await setup();
    const result = await executor.execute(
      "call_customer@SO-1001",
      JSON.stringify({ phone: "{{p:madeup1}}" }),
    );

    expect("error" in result && result.error.code).toBe("INVALID_ARGS");
    expect("error" in result && result.error.message).toContain("unknown sensitive-value tokens");
  });
});
