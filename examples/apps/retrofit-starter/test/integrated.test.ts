import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling } from "@plingjs/vue";
import App from "../src/integrated/App.vue";

const cleanup: Array<() => void> = [];

afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

function setup(locale: "en" | "zh" = "en") {
  const pling = createPling({
    namespace: "daylist",
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

describe("Daylist retrofit contract", () => {
  it("publishes stable actions, records, regions, and a bounded read model", async () => {
    const { pling, wrapper } = setup("zh");
    await wrapper.get("#new-task").setValue("准备发布");
    await nextTick();

    const snapshot = pling.registry.snapshot();
    const byId = Object.fromEntries(snapshot.actions.map((action) => [action.id, action]));

    expect(snapshot.scopes.find((scope) => scope.id === "daylist/daylist")).toMatchObject({ role: "main" });
    expect(snapshot.records.find((record) => record.id === "daylist/t1")).toMatchObject({
      fields: { text: "整理周五演示的讲稿", done: false },
    });
    expect(snapshot.state["daylist/daylist_view"]).toMatchObject({
      filter: "all",
      total: 4,
      open: 3,
      completed: 1,
      capacity: 8,
    });
    expect(byId["daylist/filter_all"]?.kind).toBe("write");
    expect(byId["daylist/toggle@daylist/t1"]?.kind).toBe("write");
    expect(byId["daylist/remove@daylist/t1"]?.kind).toBe("danger");
    expect(byId["daylist/remove@daylist/t1"]?.description).toContain("永久移除");
    expect(byId["daylist/add_todo"]?.description).toContain("加入清单");
    expect(wrapper.find(".dock--sidebar").exists()).toBe(true);
  });

  it("reports the business reason when the list reaches capacity", async () => {
    const { pling, wrapper } = setup("en");

    for (let index = 0; index < 4; index += 1) {
      await wrapper.get("#new-task").setValue(`Task ${index + 5}`);
      await wrapper.get("form").trigger("submit");
      await nextTick();
    }

    expect(wrapper.findAll(".task-row")).toHaveLength(8);
    const unavailable = pling.registry.snapshot().unavailable.find((action) => action.id === "daylist/add_todo");
    expect(unavailable?.reason).toContain("The list is full. Complete or remove a task first.");
  });

  it("keeps destructive actions behind the human confirmation policy", async () => {
    const { pling, wrapper } = setup("en");

    const result = await executorFor(pling, false).execute("daylist/remove@daylist/t1", "{}");
    expect(result).toMatchObject({ error: { code: "PERMISSION_DENIED" } });
    expect(wrapper.text()).toContain("Shape Friday's demo narrative");
  });
});
