import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPlingSurface } from "@plingjs/surface-browser";
import { SURFACE_PROTOCOL } from "@plingjs/surface";
import { createPling } from "@plingjs/vue";
import App from "../src/integrated/App.vue";
import { EXTERNAL_SCOPE } from "../src/shared/external-scope";

const cleanup: Array<() => void> = [];

afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

function setup(locale: "en" | "zh" = "en") {
  const pling = createPling({
    namespace: "northstar",
    diagnostics: false,
    presence: false,
    onWarn: () => {},
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  });
  const wrapper = mount(App, {
    attachTo: document.body,
    props: { locale },
    global: { plugins: [pling.plugin] },
  });
  cleanup.push(() => {
    wrapper.unmount();
    pling.destroy();
  });
  return { pling, wrapper };
}

function executorFor(pling: ReturnType<typeof setup>["pling"], allow: boolean) {
  return createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => allow),
    settle: async () => {
      await nextTick();
    },
  });
}

describe("Northstar retrofit contract", () => {
  it("publishes stable order ids, risk labels, records, and bounded queue state", async () => {
    const { pling } = setup("zh");
    await nextTick();

    const snapshot = pling.registry.snapshot();
    const byId = Object.fromEntries(snapshot.actions.map((action) => [action.id, action]));

    expect(byId["northstar/open_order@northstar/SO-2042"]?.kind).toBe("write");
    expect(byId["northstar/approve@northstar/SO-2042"]?.kind).toBe("write");
    expect(byId["northstar/delete@northstar/SO-2042"]?.kind).toBe("danger");
    expect(byId["northstar/delete@northstar/SO-2042"]?.description).toContain("永久删除");
    expect(byId["northstar/orders.set_note"]).toMatchObject({ kind: "write", fidelity: "high" });
    expect(snapshot.records.find((record) => record.id === "northstar/SO-2042")).toMatchObject({
      label: "SO-2042 · Globex",
      fields: { customer: "Globex", status: "待处理", risk: "中" },
    });
    expect(snapshot.state["northstar/order_queue_view"]).toMatchObject({
      filter: "all",
      shown: 5,
      total: 5,
      pending: 4,
      approved: 1,
      highRisk: 2,
    });
  });

  it("executes the note workflow as one business tool and preserves the visible page", async () => {
    const { pling, wrapper } = setup("zh");

    const result = await executorFor(pling, true).execute(
      "northstar/orders.set_note",
      JSON.stringify({ record: "SO-2042", note: "客户确认周五回电" }),
    );

    expect(result).toMatchObject({ result: { ok: true, data: { changed: true, order: "SO-2042" } } });
    expect(result).toMatchObject({
      result: {
        changed: {
          observed: true,
          records: {
            updated: [{ id: "northstar/SO-2042", fields: ["note"] }],
          },
        },
      },
    });
    expect(wrapper.find(".order-row").exists()).toBe(true);
    expect(wrapper.findAll(".order-row").find((row) => row.text().includes("SO-2042"))?.text()).toContain(
      "客户确认周五回电",
    );
    expect(
      pling.registry.snapshot().actions.filter((action) => action.id === "northstar/orders.set_note"),
    ).toHaveLength(1);
  });

  it("fails closed for deletion and exposes a narrower external capability set", async () => {
    const { pling, wrapper } = setup("en");

    const denied = await executorFor(pling, false).execute("northstar/delete@northstar/SO-2041", "{}");
    expect(denied).toMatchObject({ error: { code: "PERMISSION_DENIED" } });
    expect(wrapper.text()).toContain("SO-2041");

    const secondRow = wrapper.findAll(".order-row")[1]!;
    await secondRow.findAll(".actions button")[0]!.trigger("click");
    await nextTick();

    const { surface } = createPlingSurface(pling.registry, {
      app: "retrofit-orders-test",
      expose: EXTERNAL_SCOPE,
      confirm: async () => false,
      session: {
        agentId: "codex",
        sessionId: "test-session",
        userId: "test-user",
        expiresAt: Date.now() + 60_000,
        scope: [...EXTERNAL_SCOPE],
      },
    });

    const ids = surface.describe().capabilities.map((capability) => capability.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "northstar/orders.set_note",
        "northstar/close_order",
        "northstar/order_search",
      ]),
    );
    expect(ids).toContain("northstar/open_order");
    expect(ids.some((id) => id.includes("approve@"))).toBe(false);
    expect(ids.some((id) => id.includes("reopen@"))).toBe(false);
    expect(ids.some((id) => id.includes("delete@"))).toBe(false);

    const refused = await surface.handle({
      protocol: SURFACE_PROTOCOL,
      id: "approval-check",
      method: "invoke",
      capability: "northstar/delete@northstar/SO-2041",
    });
    expect(refused).toMatchObject({ ok: false, error: { code: "CAPABILITY_NOT_EXPOSED" } });
  });
});
