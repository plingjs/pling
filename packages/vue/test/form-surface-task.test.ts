import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, reactive, ref } from "vue";
import { describe, expect, it } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createTaskController, defaultSettle } from "@plingjs/agent";
import { createFormSurface } from "@plingjs/dom";
import { createPling, usePling } from "../src/directive";
import { useAgentTool } from "../src/tools";

describe("form surface + goal-first task", () => {
  it("fills the real Vue form, rejects the page-only cover, and verifies the final write", async () => {
    const saved: Array<Record<string, unknown>> = [];
    const pi = createPling({ onWarn: () => {}, ui: { locale: "zh-CN" } });

    const Host = defineComponent({
      template: `
        <div ref="root">
          <label class="field" data-field="name" data-required="true">
            <span class="field-label">课程名称</span>
            <input v-model="draft.name" />
          </label>
          <label class="field" data-field="teacher" data-required="true">
            <span class="field-label">授课老师</span>
            <select v-model="draft.teacher">
              <option value="">请选择</option>
              <option value="tea_zhou">周敏</option>
              <option value="tea_chen">陈静</option>
            </select>
          </label>
          <div class="field" data-field="difficulty">
            <span class="field-label">难度</span>
            <input v-model.number="draft.difficulty" type="number" min="1" max="5" />
          </div>
          <div class="field" data-field="cover" data-required="true" data-human-only="true" :data-value="draft.cover ? 'true' : ''">
            <span class="field-label">课程封面</span>
            <button type="button" @click="draft.cover = true">上传</button>
          </div>
        </div>
      `,
      setup() {
        const appPling = usePling();
        const root = ref<HTMLElement | null>(null);
        const draft = reactive({ name: "", teacher: "", difficulty: 0, cover: false });
        const form = createFormSurface({ root: () => root.value, settle: () => nextTick() });

        useAgentTool({
          id: "save_course",
          desc: "Save the current form and read it back",
          kind: "write",
          modelVisible: false,
          run: () => {
            const view = form.view();
            if (view.missing.length) throw new Error(`missing: ${view.missing.join(", ")}`);
            saved.push({ ...draft });
            return { ok: true };
          },
          expect: { desc: "saved once", check: () => saved.length > 0 },
        });

        const executor = createExecutor({
          registry: appPling.registry,
          policy: createPolicy(async () => true),
          settle: defaultSettle,
        });
        const controller = createTaskController({
          invoke: (action, args) => executor.execute(action, JSON.stringify(args)),
        });
        appPling.task.define({
          definition: {
            id: "course.create",
            title: "创建课程",
            objective: "把真实表单填写完整并保存",
            steps: [{ id: "save", label: "保存并回读", action: "save_course" }],
          },
          controller,
          autoStart: true,
        });

        return { root, draft, form, controller };
      },
    });

    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    const vm = wrapper.vm as unknown as {
      form: ReturnType<typeof createFormSurface>;
      controller: ReturnType<typeof createTaskController>;
      draft: { name: string; teacher: string; difficulty: number; cover: boolean };
    };
    await nextTick();

    const view = vm.form.view();
    expect(view.fields.map((field) => field.name)).toEqual(["name", "teacher", "difficulty", "cover"]);
    expect(view.missing).toEqual(["name", "teacher", "cover"]);

    const filled = await vm.form.fill({ name: "孕妇瑜伽", teacher: "tea_chen", difficulty: 2, cover: true });
    expect(filled.applied).toEqual(["name", "teacher", "difficulty"]);
    expect(filled.skipped).toEqual([
      { field: "cover", reason: "This field must be completed by the person in the page." },
    ]);
    await nextTick();

    expect(vm.draft.name).toBe("孕妇瑜伽");
    expect(vm.draft.teacher).toBe("tea_chen");
    expect(vm.draft.difficulty).toBe(2);
    expect(vm.form.view().missing).toEqual(["cover"]);

    vm.draft.cover = true;
    await nextTick();
    const result = await vm.controller.run();
    expect(result.status, JSON.stringify(result.error)).toBe("done");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: "孕妇瑜伽", teacher: "tea_chen", difficulty: 2, cover: true });

    expect(await vm.form.focus("teacher")).toBe(true);
    expect(wrapper.find('[data-field="teacher"]').classes()).toContain("is-pointed");

    wrapper.unmount();
  });
});
