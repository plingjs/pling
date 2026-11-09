import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createReplayLlm } from "@plingjs/agent";
import { createPling } from "../src/directive";
import App from "../../../examples/demos/course-create-directives-vue3/src/App.vue";
import { COURSE_DEMO_COPY } from "../../../examples/shared/course-create/copy";

const mounted: Array<{ unmount: () => void; destroy: () => void }> = [];

afterEach(() => {
  while (mounted.length) {
    const item = mounted.pop();
    item?.unmount();
    item?.destroy();
  }
});

describe("directive-only course demo", () => {
  it("keeps quick prompts compact and allows explicitly delegated copy", () => {
    const copy = COURSE_DEMO_COPY.zh;
    expect(copy.quick.map((item) => item.label)).toEqual(["创建孕妇瑜伽", "还差什么", "定位封面上传"]);
    expect(copy.quick[0]?.prompt).toBe("创建课程：孕妇瑜伽，陈静，2 星，月卡，介绍自动填写");
    expect(copy.fieldDesc.intro).toContain("随便填");
    expect(copy.fieldDesc.intro).toContain("生成一段简洁介绍");
  });

  it("registers the form, draft record and save action, then creates a course", async () => {
    Element.prototype.scrollIntoView = () => {};
    const pi = createPling({
      onWarn: () => {},
      ui: { locale: "zh-CN" },
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm: createReplayLlm([{ content: "ok" }]),
      },
    });
    const wrapper = mount(App, {
      props: { locale: "zh" },
      attachTo: document.body,
      global: { plugins: [pi.plugin], stubs: { AgentInline: true } },
    });
    mounted.push({ unmount: () => wrapper.unmount(), destroy: () => pi.destroy() });
    await nextTick();

    const draftLabel = "正在填写的课程草稿（表单当前值）";
    const executor = createExecutor({
      registry: pi.registry,
      policy: createPolicy(async () => true),
      settle: async () => {
        await nextTick();
      },
    });

    // The page starts on the catalogue. The agent must discover and click the
    // real create button; page code does not open the dialog for it.
    const initial = pi.registry.snapshot();
    expect(initial.actions.map((action) => action.id)).toContain("new_course");
    expect(initial.actions.map((action) => action.id)).not.toContain("course_name");

    await executor.execute("new_course", "{}");
    await nextTick();

    const snapshot = pi.registry.snapshot();
    const ids = snapshot.actions.map((action) => action.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "course_name",
        "course_teacher",
        "course_cards",
        "course_difficulty_2",
        "course_cover",
        "save_course",
      ]),
    );
    expect(snapshot.records.find((record) => record.label === draftLabel)?.fields.missing).toEqual([
      "课程名称",
      "选择授课老师",
      "课程可用卡片",
      "课程封面",
    ]);

    await executor.execute("course_name", JSON.stringify({ text: "孕妇瑜伽" }));
    await executor.execute("course_teacher", JSON.stringify({ value: "陈静" }));
    await executor.execute("course_cards", JSON.stringify({ value: "月卡" }));
    await executor.execute("course_intro", JSON.stringify({ text: "面向孕中期的舒缓课程。" }));
    await nextTick();

    expect(pi.registry.snapshot().records.find((record) => record.label === draftLabel)?.fields.missing).toEqual([
      "课程封面",
    ]);

    const fileInput = wrapper.find('input[type="file"]');
    Object.defineProperty(fileInput.element, "files", {
      configurable: true,
      value: [new File(["cover"], "cover.png", { type: "image/png" })],
    });
    await fileInput.trigger("change");
    await nextTick();

    const result = await executor.execute("save_course", "{}");
    expect(result).toMatchObject({ result: { ok: true } });
    await nextTick();
    expect(pi.registry.snapshot().records.some((record) => record.label === "孕妇瑜伽")).toBe(true);
  });

  it("locates the cover upload target without opening the picker or uploading", async () => {
    Element.prototype.scrollIntoView = () => {};
    const pi = createPling({
      onWarn: () => {},
      ui: { locale: "zh-CN" },
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm: createReplayLlm([{ content: "ok" }]),
      },
    });
    const wrapper = mount(App, {
      props: { locale: "zh" },
      attachTo: document.body,
      global: { plugins: [pi.plugin], stubs: { AgentInline: true } },
    });
    mounted.push({ unmount: () => wrapper.unmount(), destroy: () => pi.destroy() });
    await nextTick();

    const executor = createExecutor({
      registry: pi.registry,
      policy: createPolicy(async () => true),
      locateDurationMs: 0,
      settle: async () => {
        await nextTick();
      },
    });
    await executor.execute("new_course", "{}");
    await nextTick();

    const fileInput = wrapper.find('input[type="file"]');
    const click = vi.spyOn(fileInput.element as HTMLInputElement, "click");

    expect(await executor.locate("course_cover")).toMatchObject({
      result: { ok: true, executed: false, located: { id: "course_cover" } },
    });
    await nextTick();

    const presence = document.querySelector<HTMLElement>("[data-pling-presence]");
    expect(presence?.classList.contains("is-locating")).toBe(true);
    expect(click).not.toHaveBeenCalled();
    expect(pi.registry.snapshot().records.find((record) => record.label === "正在填写的课程草稿（表单当前值）")?.fields.cover).toBe(false);
  });
});
