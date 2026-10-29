import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { createExecutor, createPolicy, type FlowStep } from "@plingjs/core";
import { createPling } from "../src/directive";
import { useAgentState } from "../src/state";

/**
 * 复合动作（S6a）在 Vue 适配器里：`v-tool` 的 `steps` 怎么写、注册成什么、跑起来什么效果。
 *
 * 这里用**真实 DOM**（jsdom + @vue/test-utils）而不是假的 registry：
 * 流程的价值就在于「它走的是和模型点按钮**完全一样**的那条路」——
 * 拿假 binding 测就等于把这条主张跳过了。
 */

const allowAll = createPolicy(async () => true);

describe("v-tool：steps（S6a）", () => {
  it("写了 steps 就是复合动作：primitive=flow、清单里带步数、fidelity 是 high", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Host = defineComponent({
      template: `<div><span v-tool="flow">流程挂载点</span></div>`,
      setup: () => ({
        flow: {
          id: "fill_note",
          desc: "把订单备注改成指定内容",
          params: [{ name: "orderId", label: "订单号" }],
          steps: [
            { action: "search_query", args: { text: "{{orderId}}" }, desc: "搜索这个订单" },
            { action: "dialog_save", desc: "保存" },
          ] satisfies FlowStep[],
        },
      }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    const view = pi.registry.snapshot().actions.find((action) => action.id === "fill_note")!;
    expect(view).toMatchObject({ primitive: "flow", flowSteps: 2, fidelity: "high", source: "declared" });
    // 步骤本身也挂在 binding 上（执行流水线要用）
    expect(pi.registry.get("fill_note")!.steps).toHaveLength(2);
    // 复合动作没有 run：编排就是它的实现
    expect(pi.registry.get("fill_note")!.run).toBeUndefined();

    wrapper.unmount();
    expect(pi.registry.snapshot().actions.map((action) => action.id)).not.toContain("fill_note");
  });

  it("端到端：一次 tool 调用走完「填关键词 → 点搜索」，效果和人工点一样", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const submitted = vi.fn();
    const keyword = ref("");
    const Host = defineComponent({
      template: `
        <div>
          <input id="q" v-tool="{ id: 'search_query', desc: '在搜索框里输入关键词', params: [{ name: 'text', label: '关键词' }] }" @input="keyword = $event.target.value" />
          <button id="go" v-tool="{ id: 'go_search', desc: '提交搜索' }" @click="submitted">搜索</button>
          <span id="flow" v-tool="flow">流程</span>
        </div>`,
      setup: () => ({
        submitted,
        keyword,
        flow: {
          id: "search_and_go",
          desc: "输入关键词并提交搜索",
          params: [{ name: "text", label: "关键词" }],
          steps: [
            { action: "search_query", args: { text: "{{text}}" }, desc: "填关键词" },
            { action: "go_search", desc: "点搜索" },
          ] satisfies FlowStep[],
        },
      }),
      // 状态暴露：让「搜索框里填了什么」这件事**可被观察到** —— 否则页面上什么都没变，
      // 框架会（正确地）报「没有观察到变化」。这段和业务无关，是给 agent 看的只读视图。
      mounted() {
        useAgentState("search", () => ({ keyword: keyword.value, submitted: submitted.mock.calls.length }), {
          description: "搜索状态：关键词与提交次数",
        });
      },
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    const executor = createExecutor({ registry: pi.registry, policy: allowAll });

    const out = await executor.execute("search_and_go", JSON.stringify({ text: "猫粮" }));

    expect(out).toMatchObject({ result: { ok: true, flow: { completed: 2, total: 2 } } });
    // 效果是**真的**：输入框被填了（DOM 模拟），按钮的点击处理器跑了
    expect((wrapper.element.querySelector("#q") as HTMLInputElement).value).toBe("猫粮");
    expect(submitted).toHaveBeenCalledTimes(1);
    // 一次业务操作一份证据：既没有「仅 DOM 模拟」的保真度告警，也观察到了变化
    expect((out as { result: { warning?: string } }).result.warning).toBeUndefined();
    expect((out as { result: { changed: { observed: boolean } } }).result.changed.observed).toBe(true);

    wrapper.unmount();
  });

  it("值变了就重新登记：改了 steps，模型看到的就是新流程", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Host = defineComponent({
      template: `<div><span v-tool="{ id: 'f', desc: '流程', steps: steps }">流程</span></div>`,
      setup: () => ({ steps: ref<FlowStep[]>([{ action: "search_query" }]) }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    expect(pi.registry.get("f")!.steps).toHaveLength(1);

    wrapper.vm.steps = [
      { action: "search_query" },
      { action: "go_search" },
      { action: "dialog_save" },
    ];
    await wrapper.vm.$nextTick();

    expect(pi.registry.get("f")!.steps).toHaveLength(3);
    expect(pi.registry.snapshot().actions.find((action) => action.id === "f")!.flowSteps).toBe(3);

    wrapper.unmount();
  });

  it("空 steps 与「steps 和 run 同时写」都在开发期说一声", () => {
    const warns: string[] = [];
    const pi = createPling(undefined, { onWarn: (message) => warns.push(message) });
    const Host = defineComponent({
      template: `
        <div>
          <span v-tool="{ id: 'empty', desc: '空流程', steps: [] }">空</span>
          <span v-tool="{ id: 'both', desc: '两套都写了', steps: [{ action: 'x' }], run: () => {} }">两套</span>
        </div>`,
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    expect(warns.some((message) => message.includes("empty") && message.includes("steps 是空的"))).toBe(true);
    expect(warns.some((message) => message.includes("both") && message.includes("同时写了 steps 和 run"))).toBe(true);

    wrapper.unmount();
  });

  it("空 steps 真跑起来也不假装成功：EXECUTION_FAILED", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const Host = defineComponent({
      template: `<div><span v-tool="{ id: 'empty', desc: '空流程', steps: [] }">空</span></div>`,
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    const executor = createExecutor({ registry: pi.registry, policy: allowAll });

    const out = await executor.execute("empty", "{}");

    expect(out).toMatchObject({ error: { code: "EXECUTION_FAILED" } });
    expect((out as { error: { message: string } }).error.message).toContain("empty steps array");

    wrapper.unmount();
  });

  it("流程里的步骤走的是同一条闸门：声明 kind 更严时就问（不做后门）", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const asked: string[] = [];
    const Host = defineComponent({
      template: `
        <div>
          <button id="rm" v-tool="{ id: 'remove_row', desc: '删掉这一行', kind: 'danger' }">删除</button>
          <span v-tool="{ id: 'cleanup', desc: '清掉这一行', steps: [{ action: 'remove_row' }] }">清理</span>
        </div>`,
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
    const executor = createExecutor({
      registry: pi.registry,
      policy: createPolicy(async (request) => {
        asked.push(request.kind);
        return true;
      }),
    });

    await executor.execute("cleanup", "{}");

    // 一次确认，档位是步骤里最严的那个（danger）—— 流程不是绕开闸门的后门
    expect(asked).toEqual(["danger"]);

    wrapper.unmount();
  });
});
