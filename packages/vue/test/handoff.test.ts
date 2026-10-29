import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { createPolicy, createExecutor, createRegistry } from "@plingjs/core";
import { createReplayLlm } from "@plingjs/agent";
import { createPling } from "../src/directive";
import AgentDock from "../src/components/AgentDock.vue";

/**
 * 人工接力（S5）在 Vue 适配器里的两件事：
 *   1. `v-tool` 的 handoff 声明进 binding，但不进 `run`；
 *   2. `<AgentDock>` 把请求渲染成「请你接管」，用户点「我已完成」后循环继续。
 */

describe("v-tool：handoff", () => {
  it("handoff 简写 → binding 有 reason / expect；descriptor 只带 reason", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const done = ref(false);
    const Host = defineComponent({
      template: `<button v-tool="tool">提交</button>`,
      setup: () => ({
        tool: {
          id: "submit",
          desc: "提交注册",
          handoff: {
            reason: "请填写图形验证码后提交",
            expect: { desc: "注册成功页出现", check: () => done.value },
          },
        },
      }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    expect(pi.registry.get("submit")?.handoff?.reason).toBe("请填写图形验证码后提交");
    expect(pi.registry.get("submit")?.handoff?.expect?.desc).toBe("注册成功页出现");
    expect(pi.registry.snapshot().actions[0]).toMatchObject({
      handoff: { reason: "请填写图形验证码后提交" },
    });
    expect(pi.registry.snapshot().actions[0]).not.toHaveProperty("handoff.expect");

    wrapper.unmount();
  });

  it("handoff 分步指引：字符串步骤会归一化，目标留在运行时规格里", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Host = defineComponent({
      template: `<button v-tool="tool">提交</button>`,
      setup: () => ({
        tool: {
          id: "submit",
          desc: "提交注册",
          handoff: {
            reason: "请本人完成",
            steps: ["输入验证码", { text: "点击提交", highlight: "submit" }],
          },
        },
      }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    expect(pi.registry.get("submit")?.handoff?.steps).toEqual([
      { text: "输入验证码" },
      { text: "点击提交", highlight: "submit" },
    ]);
    expect(pi.registry.snapshot().actions[0]?.handoff).toEqual({ reason: "请本人完成" });

    wrapper.unmount();
  });

  it("v-guide-target：只登记高亮目标，不产生动作", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Host = defineComponent({
      template: `<div><input v-guide-target="'captcha_input'" /><button v-tool="'提交'">提交</button></div>`,
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    expect(pi.registry.snapshot().actions).toHaveLength(1);
    expect(pi.registry.markGuideTarget("captcha_input", "waiting")).toBe(true);
    expect(pi.registry.markGuideTarget("captcha_input", "idle")).toBe(true);

    wrapper.unmount();
  });

  it("namespace：v-guide-target 与 markGuideTarget 使用本岛完整 id", () => {
    const base = createRegistry();
    const pi = createPling({ registry: base, namespace: "left", onWarn: () => {} });
    const Host = defineComponent({
      template: `<input v-guide-target="'captcha_input'" />`,
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    expect(pi.registry.markGuideTarget("captcha_input", "waiting")).toBe(true);
    expect(base.markGuideTarget("left/captcha_input", "idle")).toBe(true);
    expect(base.markGuideTarget("captcha_input", "idle")).toBe(false);

    wrapper.unmount();
  });

  it("执行器拿 handoff 通道时，不执行声明里的 run", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const run = vi.fn();
    const Host = defineComponent({
      template: `<button v-tool="tool">提交</button>`,
      setup: () => ({ tool: { id: "submit", desc: "提交注册", handoff: "请本人复核", run } }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    const executor = createExecutor({
      registry: pi.registry,
      policy: createPolicy(async () => true),
      handoff: async () => "done",
    });

    const out = await executor.execute("submit", "{}");
    expect(out).toMatchObject({ result: { ok: true, handoff: { actor: "user" } } });
    expect(run).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});

describe("<AgentDock>：人工接力", () => {
  it("模型调用 handoff 动作 → 面板请用户接管 → 用户完成 → 循环继续", async () => {
    const onRun = vi.fn();
    const humanDone = ref(false);
    const Host = defineComponent({
      template: `
        <div>
          <button
            id="submit"
            v-tool="tool"
            @click="humanDone = true"
          >提交</button>
          <AgentDock />
        </div>
      `,
      components: { AgentDock },
      setup: () => ({
        humanDone,
        tool: {
          id: "submit",
          desc: "提交注册（需要验证码）",
          handoff: {
            reason: "请填写图形验证码后提交",
            expect: { desc: "注册成功", check: () => humanDone.value, timeout: 200 },
          },
          run: onRun,
        },
      }),
    });
    const pi = createPling({
      onWarn: () => {},
      ui: { locale: "zh-CN" },
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm: createReplayLlm([
          { calls: [{ tool: "submit" }] },
          { content: "注册完成。" },
        ]),
      },
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await wrapper.find(".dock__launcher").trigger("click");
    const input = wrapper.find(".dock__chat .composer input");
    await input.setValue("帮我注册");
    await wrapper.find(".dock__chat form").trigger("submit");

    // 等面板出现「请你接管」
    await waitFor(() => wrapper.find(".handoff").exists());
    expect(wrapper.find(".handoff").text()).toContain("请填写图形验证码后提交");
    expect(onRun).not.toHaveBeenCalled();

    // 用户亲自在页面上完成（这里只模拟业务按钮的点击）
    humanDone.value = true;
    await nextTick();
    await wrapper.find(".handoff .answers button").trigger("click");

    await waitFor(() => wrapper.find(".dock__chat").text().includes("注册完成。"));
    expect(onRun).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("分步指引：显示进度、下一步，最后一步才完成交接", async () => {
    const humanDone = ref(false);
    const Host = defineComponent({
      template: `
        <div>
          <input v-guide-target="'captcha'" />
          <button
            id="submit"
            v-tool="tool"
            @click="humanDone = true"
          >提交</button>
          <AgentDock />
        </div>
      `,
      components: { AgentDock },
      setup: () => ({
        humanDone,
        tool: {
          id: "submit",
          desc: "提交注册",
          handoff: {
            reason: "请本人完成两步",
            steps: [
              { text: "输入图形验证码", highlight: "captcha" },
              { text: "点击「提交」", highlight: "submit" },
            ],
            expect: { desc: "注册成功", check: () => humanDone.value, timeout: 200 },
          },
        },
      }),
    });
    const pi = createPling({
      onWarn: () => {},
      ui: { locale: "zh-CN" },
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm: createReplayLlm([{ calls: [{ tool: "submit" }] }, { content: "注册完成。" }]),
      },
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await wrapper.find(".dock__launcher").trigger("click");
    await wrapper.find(".dock__chat .composer input").setValue("帮我注册");
    await wrapper.find(".dock__chat form").trigger("submit");

    await waitFor(() => wrapper.find(".handoff").exists());
    expect(wrapper.find(".handoff").text()).toContain("第 1 / 2 步");
    expect(wrapper.find(".handoff").text()).toContain("输入图形验证码");

    const next = wrapper.findAll(".handoff .answers button").find((button) => button.text() === "下一步")!;
    await next.trigger("click");
    expect(wrapper.find(".handoff").text()).toContain("第 2 / 2 步");
    expect(wrapper.find(".handoff").text()).toContain("点击「提交」");

    humanDone.value = true;
    await nextTick();
    const done = wrapper.findAll(".handoff .answers button").find((button) => button.text() === "我已完成")!;
    await done.trigger("click");

    await waitFor(() => wrapper.find(".dock__chat").text().includes("注册完成。"));
    expect(wrapper.find(".handoff").exists()).toBe(false);

    wrapper.unmount();
  });
});

async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("等待超时");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
