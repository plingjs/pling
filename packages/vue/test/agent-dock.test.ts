import { mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import {
  CONTINUITY_VERSION,
  createMemoryContinuityStore,
  createReplayLlm,
  HookRegistry,
  type ContinuitySnapshot,
  type SessionEvent,
} from "@plingjs/agent";
import type { PlingUiOptions } from "@plingjs/ui";
import { createPling } from "../src/directive";
import AgentDock from "../src/components/AgentDock.vue";
import { PLING_PRESENCE_Z_INDEX, PLING_UI_Z_INDEX } from "../src/presence";
import inlineSource from "../src/components/AgentInline.vue?raw";

/**
 * `<AgentDock />`：一个标签接完。
 *
 * 这里验的就是「开发者什么都没接」那条路：注册表从 `usePling()` 拿、
 * 模型从应用级 setup 拿、会话/事件流/闸门/水位全在组件里。
 */

const config = { baseUrl: "/llm/v1", model: "test-model" } as const;

const SNAPSHOT: ContinuitySnapshot = {
  version: CONTINUITY_VERSION,
  updatedAt: 1_000,
  status: "active",
  goal: "在上一页完成任务",
  page: { path: "/orders", title: "订单列表" },
  summary: "",
  messages: [
    { role: "user", content: "在上一页完成任务" },
    { role: "assistant", content: "上一页已经做完一半。" },
  ],
  events: [
    { type: "user", text: "在上一页完成任务" },
    { type: "assistant", text: "上一页已经做完一半。" },
  ],
};

/** 宿组件：一个原生按钮 + 一个悬浮入口（真实项目里就是这个形状） */
function host(options: { onRun?: () => void; danger?: boolean; navigate?: (href: string) => void } = {}) {
  return defineComponent({
    template: `
      <div>
        <button
          id="save"
          :v-tool="null"
          v-tool="{ id: 'save', desc: '保存一下', ${options.danger ? "kind: 'danger'," : ""} run: onRun }"
          @click="onRun && onRun()"
        >保存</button>
        <AgentDock :navigate="navigate" />
      </div>
    `,
    components: { AgentDock },
    setup: () => ({ onRun: options.onRun, navigate: options.navigate }),
  });
}

function setup(options: { turns?: unknown[]; agent?: Record<string, unknown>; ui?: PlingUiOptions | null; host?: { onRun?: () => void; danger?: boolean; navigate?: (href: string) => void } } = {}) {
  const pi = createPling({
    onWarn: () => {},
    // 旧用例的断言是中文；语言默认值已经切到英文，所以这里显式 opt in，
    // 而不是为了让旧断言通过去改框架默认值。
    ui: options.ui === null ? undefined : (options.ui ?? { locale: "zh-CN" }),
    agent: {
      config,
      // 这些用例只关心「接线有没有接上」，不关心确认：把闸门关掉省掉一路点击。
      // 默认行为（写动作会停下来问）有专门的用例，别在这里测。
      gate: () => false,
      llm: createReplayLlm((options.turns ?? [{ content: "好" }]) as never),
      ...(options.agent ?? {}),
    },
  });
  const wrapper = mount(host(options.host), { attachTo: document.body, global: { plugins: [pi.plugin] } });
  return { pi, wrapper };
}

/** 不同宿组件挂出来的 wrapper 泛型不一样；测试里只用 find / findAll，按结构取类型 */
type AnyWrap = Pick<VueWrapper, "find" | "findAll">;

const launcher = (wrapper: AnyWrap) => wrapper.find(".dock__launcher");
const input = (wrapper: AnyWrap) => wrapper.find(".dock__chat .composer input");
const setTab = (wrapper: AnyWrap, index: 0 | 1) => wrapper.findAll(".dock__tabs button")[index]!.trigger("click");

async function say(wrapper: AnyWrap, text: string): Promise<void> {
  await input(wrapper).setValue(text);
  await wrapper.find(".dock__chat form").trigger("submit");
  await nextTick();
}

async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("等待超时");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("<AgentDock>：悬浮入口 + 自动接线", () => {
  it("没有配置 ui 时默认英文", async () => {
    const { wrapper } = setup({ ui: null });
    expect(launcher(wrapper).text()).toContain("Ask Pling");

    await launcher(wrapper).trigger("click");
    expect(wrapper.find(".dock__chat").text()).toContain("Page assistant");
    expect(wrapper.findAll(".dock__tabs button").map((button) => button.text())).toEqual([
      "Chat",
      "Activity",
    ]);
  });

  it("整页导航恢复后显示继续入口，并带出上次对话", async () => {
    const store = createMemoryContinuityStore(SNAPSHOT);
    const { wrapper } = setup({ agent: { continuity: { store, now: () => 2_000 } } });
    await nextTick();

    expect(launcher(wrapper).text()).toContain("继续上次任务");
    await launcher(wrapper).trigger("click");
    await nextTick();
    expect(wrapper.find(".dock__chat .resume").text()).toContain("上次任务");
    expect(wrapper.find(".dock__chat").text()).toContain("上一页已经做完一半");
  });

  it("resume=auto 自动续跑一次，危险动作仍然先问人", async () => {
    const onRun = vi.fn();
    const llm = createReplayLlm([
      { calls: [{ tool: "save" }] },
      { content: "已经继续完成了。" },
    ] as never);
    const { wrapper } = setup({
      agent: {
        continuity: { store: createMemoryContinuityStore(SNAPSHOT), now: () => 2_000, resume: "auto" },
        gate: () => true,
        llm,
      },
      host: { onRun, danger: true },
    });

    await launcher(wrapper).trigger("click");
    await waitFor(() => wrapper.find(".confirm").exists());
    expect(onRun).not.toHaveBeenCalled();
    expect(wrapper.find(".dock__chat .resume").exists()).toBe(false);
    expect(wrapper.find(".dock__chat").text()).toContain("上一页已经做完一半");

    const approve = wrapper.findAll(".confirm button").find((button) => button.text().includes("批准本次"))!;
    await approve.trigger("click");
    await waitFor(() => onRun.mock.calls.length > 0);
    await waitFor(() => wrapper.find(".dock__chat").text().includes("已经继续完成了。"));
    expect(onRun).toHaveBeenCalledOnce();
    expect(llm.turn).toBe(2);
  });

  it("resume=auto + returnOnDone：完成后导航回任务开始页；卸载会取消延迟导航", async () => {
    const navigate = vi.fn();
    const { wrapper } = setup({
      agent: {
        continuity: {
          store: createMemoryContinuityStore(SNAPSHOT),
          now: () => 2_000,
          resume: "auto",
          returnOnDone: { delayMs: 0 },
        },
        llm: createReplayLlm([{ content: "已经继续完成了。" }] as never),
      },
      host: { navigate },
    });

    await waitFor(() => navigate.mock.calls.length === 1);
    expect(navigate).toHaveBeenCalledWith(new URL("/orders", location.href).href);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(navigate).toHaveBeenCalledOnce();

    const late = vi.fn();
    const pending = setup({
      agent: {
        continuity: {
          store: createMemoryContinuityStore(SNAPSHOT),
          now: () => 2_000,
          resume: "auto",
          returnOnDone: { delayMs: 40 },
        },
        llm: createReplayLlm([{ content: "第二条任务完成。" }] as never),
      },
      host: { navigate: late },
    });
    await launcher(pending.wrapper).trigger("click");
    await waitFor(() => pending.wrapper.find(".dock__chat").text().includes("第二条任务完成。"));
    pending.wrapper.unmount();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(late).not.toHaveBeenCalled();
  });

  it("浮窗层级高于存在感高亮，光圈不会透出聊天面板", () => {
    const { wrapper } = setup();
    const dock = wrapper.find(".dock").element as HTMLElement;
    expect(Number(dock.style.zIndex)).toBe(PLING_UI_Z_INDEX);
    expect(PLING_UI_Z_INDEX).toBeGreaterThan(PLING_PRESENCE_Z_INDEX);
  });

  it("默认只是个悬浮按钮；点开才有面板", async () => {
    const { wrapper } = setup();
    expect(launcher(wrapper).text()).toContain("问助手");
    expect(wrapper.find(".dock__panel").exists()).toBe(false);

    await launcher(wrapper).trigger("click");
    expect(wrapper.find(".dock__panel").exists()).toBe(true);
    expect(wrapper.find(".dock__chat").text()).toContain("页面助手");

    await wrapper.find(".dock__ghost:last-child").trigger("click");
    expect(wrapper.find(".dock__panel").exists()).toBe(false);
  });

  it("UI locale, messages, theme, and class names are configurable without remounting", async () => {
    const { pi, wrapper } = setup({
      ui: {
        locale: "en-US",
        messages: { "en-US": { "dock.launcher.open": "Open Pling" } },
        theme: { mode: "light", tokens: { colorPrimary: "#123456" } },
        classNames: { dock: "custom-dock", launcher: "custom-launcher", chat: "custom-chat" },
      },
    });

    expect(launcher(wrapper).text()).toContain("Open Pling");
    expect(wrapper.find(".dock").classes()).toContain("custom-dock");
    expect(launcher(wrapper).classes()).toContain("custom-launcher");
    const dock = wrapper.find(".dock").element as HTMLElement;
    expect(dock.style.getPropertyValue("--pling-color-primary")).toBe("#123456");

    await launcher(wrapper).trigger("click");
    expect(wrapper.find(".dock__panel").attributes("aria-label")).toBe("Page assistant");
    expect(wrapper.find(".dock__chat").classes()).toContain("custom-chat");
    expect(wrapper.find(".dock__model").exists()).toBe(false);
    expect(wrapper.find(".dock__usage").exists()).toBe(false);

    await setTab(wrapper, 1);
    const modelHint = wrapper.find(".dock__model").attributes("title") ?? "";
    expect(modelHint).toContain("Model: test-model");
    expect(modelHint).toContain("Context 8192");
    expect(modelHint).not.toMatch(/模型|上下文|预留输出|起压缩/);
    expect(wrapper.findAll(".dock__tabs button").map((button) => button.text())).toEqual([
      "Chat",
      "Activity",
    ]);
    expect(wrapper.findAll(".dock__actions button").map((button) => button.attributes("aria-label"))).toEqual([
      "Clear",
      "Collapse",
    ]);
    expect(wrapper.findAll(".dock__actions svg")).toHaveLength(2);

    pi.ui.setLocale("zh-CN");
    await nextTick();
    expect(launcher(wrapper).text()).toContain("收起助手");
    expect(wrapper.findAll(".dock__tabs button").map((button) => button.text())).toEqual([
      "对话",
      "运行",
    ]);
    expect(wrapper.findAll(".dock__actions button").map((button) => button.attributes("aria-label"))).toEqual([
      "清空",
      "收起",
    ]);
    expect(wrapper.find(".dock__model").attributes("title")).toContain("模型：test-model");

    pi.ui.setTheme("dark");
    await nextTick();
    expect(pi.ui.resolvedTheme).toBe("dark");
    expect(dock.style.getPropertyValue("--pling-color-primary")).toBe("#56b4ff");
  });

  it("把当前 UI 语言带进系统提示，切换语言后下一条消息立即生效", async () => {
    const llm = createReplayLlm([{ content: "First answer" }, { content: "第二句回答" }]);
    const { pi, wrapper } = setup({ ui: { locale: "en-US" }, agent: { llm } });

    await launcher(wrapper).trigger("click");
    await say(wrapper, "first");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("First answer"));
    expect(llm.received[0]![0]!.content).not.toContain("application UI is currently in Chinese");

    pi.ui.setLocale("zh-CN");
    await nextTick();
    await say(wrapper, "第二条");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("第二句回答"));
    expect(llm.received[1]![0]!.content).toContain("The application UI is currently in Chinese.");
  });

  it("一句话 → 模型调用页面动作 → 业务真的变了（开发者一行接线都没写）", async () => {
    const onRun = vi.fn();
    const { wrapper } = setup({
      host: { onRun },
      turns: [{ calls: [{ tool: "save" }] }, { content: "已经保存好了。" }],
    });

    await launcher(wrapper).trigger("click");
    await say(wrapper, "帮我保存");
    // 等跑完（多轮循环是异步的：调用 → 回填 → 再问一次模型）
    await waitFor(() => wrapper.find(".dock__chat").text().includes("已经保存好了。"));

    expect(onRun).toHaveBeenCalledOnce();
    // 对话里**没有**动作流水（`save{"note":"x"}` / `save ok` 那种）——
    // 用户看到的是人话；「它点了什么、参数是什么」在「运行」里查（下面的用例）。
    expect(wrapper.find(".dock__chat").text()).not.toContain("save");
    expect(wrapper.find(".dock__chat .line.call").exists()).toBe(false);
    expect(wrapper.find(".dock__chat .line.result").exists()).toBe(false);
  });

  it("应用级 hooks 自动接进 <AgentDock>：拦截后业务不执行，原因进「运行」", async () => {
    const onRun = vi.fn();
    const hooks = new HookRegistry();
    hooks.addPreToolUse(() => ({ blocked: true, reason: "统一风控：演示中禁止保存" }));

    const { wrapper } = setup({
      host: { onRun },
      agent: { hooks },
      turns: [{ calls: [{ tool: "save" }] }, { content: "这一步被风控拦住了。" }],
    });

    await launcher(wrapper).trigger("click");
    await say(wrapper, "帮我保存");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("这一步被风控拦住了。"));

    expect(onRun).not.toHaveBeenCalled();

    await wrapper.findAll(".dock__tabs button").find((button) => button.text().includes("运行"))!.trigger("click");
    const activity = wrapper.find(".dock__activity").text();
    expect(activity).toContain("save");
    expect(activity).toContain("统一风控：演示中禁止保存");
  });

  it("推荐指令（quick）：点一下等于把那句话发出去", async () => {
    const onRun = vi.fn();
    const pi = createPling({
      onWarn: () => {},
      agent: {
        config,
        gate: () => false, // 这条只测 quick，不测确认
        llm: createReplayLlm([{ calls: [{ tool: "save" }] }, { content: "好了" }] as never),
      },
    });
    const Host = defineComponent({
      template: `<div><button v-tool="{ id: 'save', desc: '保存', run: onRun }">保存</button><AgentDock :quick="['帮我保存']" /></div>`,
      components: { AgentDock },
      setup: () => ({ onRun }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await launcher(wrapper).trigger("click");
    await wrapper.find(".dock__quick button").trigger("click");
    await waitFor(() => onRun.mock.calls.length > 0);
    expect(onRun).toHaveBeenCalledOnce();
    // Quick prompts are durable actions, not onboarding that vanishes after one use.
    expect(wrapper.find(".dock__quick").exists()).toBe(true);
    expect(wrapper.findAll(".dock__quick button").map((button) => button.text())).toEqual(["帮我保存"]);
  });

  it("没配置模型时不静默失败：把「缺什么、怎么补」当成一条回复贴出来", async () => {
    const pi = createPling({
      onWarn: () => {},
      ui: { locale: "zh-CN" },
      agent: { config: { baseUrl: "", model: "" } },
    });
    const Host = defineComponent({
      template: `<div><button v-tool="{ id: 'save', desc: '保存' }">保存</button><AgentDock /></div>`,
      components: { AgentDock },
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await launcher(wrapper).trigger("click");
    expect(wrapper.find(".dock__model").exists()).toBe(false);
    await setTab(wrapper, 1);
    expect(wrapper.find(".dock__model").text()).toBe("未配置模型");
    await setTab(wrapper, 0);

    await say(wrapper, "帮我保存");
    expect(wrapper.find(".dock__warn").text()).toContain("VITE_AGENT_BASE_URL");
    expect(wrapper.find(".dock__chat").text()).toContain("VITE_AGENT_BASE_URL");
  });

  it("闸门开着：危险动作停下来等你点「批准本次」，批了才执行", async () => {
    const onRun = vi.fn();
    const pi = createPling({
      onWarn: () => {},
      ui: { locale: "zh-CN" },
      agent: {
        config,
        gate: () => true, // 应用级开启闸门
        llm: createReplayLlm([{ calls: [{ tool: "save" }] }, { content: "删了" }] as never),
      },
    });
    const Host = defineComponent({
      template: `<div><button v-tool="{ id: 'save', kind: 'danger', desc: '删除', run: onRun }">删</button><AgentDock /></div>`,
      components: { AgentDock },
      setup: () => ({ onRun }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await launcher(wrapper).trigger("click");
    await say(wrapper, "删掉它");
    await waitFor(() => wrapper.find(".confirm").exists());

    expect(onRun).not.toHaveBeenCalled(); // 没批准之前什么都没做
    expect(wrapper.find(".confirm").text()).toContain("危险操作");

    const approve = wrapper.findAll(".confirm button").find((button) => button.text().includes("批准本次"))!;
    await approve.trigger("click");
    await waitFor(() => onRun.mock.calls.length > 0);
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("声明了要问的动作：停下来等「批准本次」，面板上没有确认开关", async () => {
    const onRun = vi.fn();
    const pi = createPling({
      onWarn: () => {},
      ui: { locale: "zh-CN" },
      agent: { config, llm: createReplayLlm([{ calls: [{ tool: "save" }] }, { content: "好了" }] as never) },
    });
    const Host = defineComponent({
      // confirm: true = 「这个写操作我要确认」（默认不问）
      template: `<div><button v-tool="{ id: 'save', desc: '保存', confirm: true, run: onRun }">保存</button><AgentDock /></div>`,
      components: { AgentDock },
      setup: () => ({ onRun }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await launcher(wrapper).trigger("click");
    await say(wrapper, "保存一下");
    await waitFor(() => wrapper.find(".confirm").exists());

    expect(onRun).not.toHaveBeenCalled(); // 没批之前什么都没做
    // 「要不要问」是动作声明的事，不需要用户自己去开一个开关
    expect(wrapper.find(".dock__gate input").exists()).toBe(false);

    const approve = wrapper.findAll(".confirm button").find((button) => button.text().includes("批准本次"))!;
    await approve.trigger("click");
    await waitFor(() => onRun.mock.calls.length > 0);
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("应用级关掉确认通道：直接执行，并在面板上如实标出来", async () => {
    const onRun = vi.fn();
    const pi = createPling({
      onWarn: () => {},
      ui: { locale: "zh-CN" },
      agent: {
        config,
        gate: () => false,
        llm: createReplayLlm([{ calls: [{ tool: "save" }] }, { content: "好了" }] as never),
      },
    });
    const Host = defineComponent({
      template: `<div><button v-tool="{ id: 'save', desc: '保存', run: onRun }">保存</button><AgentDock /></div>`,
      components: { AgentDock },
      setup: () => ({ onRun }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await launcher(wrapper).trigger("click");
    expect(wrapper.find(".dock__gate").text()).toBe("确认已关");
    expect(wrapper.find(".dock__model").exists()).toBe(false);
    expect(wrapper.find(".dock__usage").exists()).toBe(false);
    await say(wrapper, "保存一下");
    await waitFor(() => onRun.mock.calls.length > 0);

    expect(onRun).toHaveBeenCalledOnce();
    expect(wrapper.find(".confirm").exists()).toBe(false);
  });

  it("会话事件可以外接（业务要审计 / 自己记日志时不用改组件）", async () => {
    const events: SessionEvent[] = [];
    const pi = createPling({
      onWarn: () => {},
      ui: { locale: "zh-CN" },
      agent: {
        config,
        gate: () => false, // 这条只测事件外接，不测确认
        llm: createReplayLlm([{ calls: [{ tool: "save" }] }, { content: "好了" }] as never),
      },
    });
    const Host = defineComponent({
      template: `<div><button v-tool="{ id: 'save', desc: '保存' }">保存</button><AgentDock @event="push" /></div>`,
      components: { AgentDock },
      setup: () => ({ push: (event: SessionEvent) => events.push(event) }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await launcher(wrapper).trigger("click");
    await say(wrapper, "保存一下");
    await waitFor(() => events.some((event) => event.type === "final"));

    expect(events.filter((event) => event.type === "tool_result").map((event) => event.id)).toEqual(["save"]);
    expect(events.at(-1)).toMatchObject({ type: "final", text: "好了" });
  });

  it("「运行」页签：框架自己记每一步 —— 成功 / 失败都在，业务不用再接线", async () => {
    const onRun = vi.fn();
    const { wrapper } = setup({
      host: { onRun },
      // 一次成功（save）+ 一次模型猜错（ghost 不在动作清单里）：两种都要留痕
      turns: [{ calls: [{ tool: "save" }, { tool: "ghost" }] }, { content: "做完了。" }],
    });

    await launcher(wrapper).trigger("click");
    await say(wrapper, "保存一下");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("做完了。"));

    // 徽标：两次动作，其中一次失败 → 标红
    const badge = wrapper.find(".dock__tabs .dock__badge");
    expect(badge.text()).toBe("2");
    expect(badge.classes()).toContain("is-bad");

    // 切到「运行」：对话区让位，动作一条一行
    const activityTab = wrapper.findAll(".dock__tabs button").find((button) => button.text().includes("运行"))!;
    await activityTab.trigger("click");
    expect(wrapper.find(".dock__chat").exists()).toBe(false);

    const rows = wrapper.findAll(".dock__activity li");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.text()).toContain("save");
    expect(rows[0]!.text()).toContain("成功");
    expect(rows[1]!.text()).toContain("ghost");
    expect(rows[1]!.text()).toContain("失败");
    expect(rows[1]!.find(".dock__state").classes()).toContain("is-failed");
    expect(rows[1]!.find(".dock__state").text()).toBe("失败");

    // 切回来，聊天记录还在（页签只是换视图，不是另一条会话）
    await wrapper.findAll(".dock__tabs button").find((button) => button.text().includes("对话"))!.trigger("click");
    expect(wrapper.find(".dock__chat").text()).toContain("做完了。");
  });

  it("「运行」里能看到完整的一步：动作、人话说明、模型填的参数、结果", async () => {
    const onRun = vi.fn();
    const pi = createPling({
      onWarn: () => {},
      ui: { locale: "zh-CN" },
      agent: {
        config,
        gate: () => false,
        llm: createReplayLlm([
          { calls: [{ tool: "note", args: { text: "客户 A 要续约" } }] },
          { content: "记好了。" },
        ] as never),
      },
    });
    const Host = defineComponent({
      // `action: 'fill'` → 原语是 type，参数形状是 `{ text }`（跟真实输入框一致）
      template: `<div><input v-tool="{ id: 'note', desc: '记一条备注', action: 'fill', run: onRun }" /><AgentDock /></div>`,
      components: { AgentDock },
      setup: () => ({ onRun }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await launcher(wrapper).trigger("click");
    await say(wrapper, "记一条备注");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("记好了。"));

    await wrapper.findAll(".dock__tabs button").find((button) => button.text().includes("运行"))!.trigger("click");

    const row = wrapper.find(".dock__activity li");
    expect(row.find("code").text()).toBe("note"); // 页面上的原始 id
    expect(row.find(".dock__desc").text()).toBe("记一条备注"); // 开发者写的 desc
    expect(row.find(".dock__args").text()).toBe('{"text":"客户 A 要续约"}'); // 模型填的参数，原样
    expect(row.find(".dock__state").text()).toBe("成功");
  });

  /**
   * 布局稳态：两个页签共用同一块地方，切「运行」时面板不会缩一下。
   *
   * 这条只能盯源码：jsdom 没有排版引擎（vitest 也没开 `css: true`，样式根本不注入），
   * `getComputedStyle` 量不出像素。根因是面板高度 —— 必须是写死的 `height`；
   * 一旦退回 `max-height`（内容多高就多高），切页签时面板就会缩，看着像页面高度突然变了。
   */
  it("切「运行」面板高度不变：两个页签共用同一块地方", async () => {
    const { wrapper } = setup({ turns: [{ calls: [{ tool: "save" }] }, { content: "好了" }] });
    await launcher(wrapper).trigger("click");
    // 先取父节点：切页签时对话区会被卸载，那时 `parentElement` 已经是 null 了
    const chatParent = wrapper.find(".dock__chat").element.parentElement;

    await wrapper.findAll(".dock__tabs button").find((button) => button.text().includes("运行"))!.trigger("click");

    // 运行容器与对话区占用同一个 flex 项；执行记录在运行容器内部，
    // 因此展开设置或诊断不会换掉整块面板。
    expect(chatParent?.classList.contains("dock__panel")).toBe(true);
    expect(wrapper.find(".dock__run").element.parentElement).toBe(chatParent);
    expect(wrapper.find(".dock__activity").element.parentElement?.classList.contains("dock__run-section")).toBe(true);

    const panel = /\.dock__panel\s*\{[^}]*\}/.exec(inlineSource)?.[0] ?? "";
    expect(panel).toContain("height:");
    expect(panel).not.toContain("max-height:");
  });

  /**
   * Activity 读数曾经混用了两种口径：屏幕上是「20 次调用」（`telemetry` 的整段会话累计），
   * 而真正给这条指令用的预算 `maxTurns`（每次 send 默认 10）根本没露面 ——
   * 于是出现了「20 次调用 / 最多 10 轮」这种自相矛盾的读数。现在分开报。
   */
  it("Activity 读数分两种口径：轮数是这条指令的预算，调用次数是整段会话的累计", async () => {
    const { wrapper } = setup({ turns: [{ calls: [{ tool: "save" }] }, { content: "已经保存好了。" }] });
    await launcher(wrapper).trigger("click");
    await setTab(wrapper, 1);
    expect(wrapper.find(".dock__usage").text()).toContain("本轮 0 / 10 轮");

    await setTab(wrapper, 0);
    await say(wrapper, "帮我保存");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("已经保存好了。"));

    await setTab(wrapper, 1);
    const usage = wrapper.find(".dock__usage").text();
    expect(usage).toContain("本轮 2 / 10 轮");
    expect(usage).toContain("累计 2 次调用");
  });

  it("清空 = 开一段新会话：轮数回到 0，累计读数也跟着归零", async () => {
    const { wrapper } = setup({ turns: [{ calls: [{ tool: "save" }] }, { content: "已经保存好了。" }] });
    await launcher(wrapper).trigger("click");
    await say(wrapper, "帮我保存");
    await waitFor(() => wrapper.find(".dock__chat").text().includes("已经保存好了。"));

    await setTab(wrapper, 1);
    await wrapper.findAll(".dock__ghost")[0]!.trigger("click");

    const usage = wrapper.find(".dock__usage").text();
    expect(usage).toContain("本轮 0 / 10 轮");
    expect(usage).not.toContain("累计");

    await setTab(wrapper, 0);
    expect(wrapper.find(".dock__chat").text()).not.toContain("已经保存好了。");
  });

  it("「运行」页签：还没有动作时给出解释，而不是空白", async () => {
    const { wrapper } = setup();
    await launcher(wrapper).trigger("click");
    await wrapper.findAll(".dock__tabs button").find((button) => button.text().includes("运行"))!.trigger("click");

    expect(wrapper.findAll(".dock__tabs .dock__badge")).toHaveLength(0);
    expect(wrapper.find(".dock__diagnostics").exists()).toBe(true);
    expect(wrapper.find(".dock__model").exists()).toBe(true);
    expect(wrapper.find(".dock__activity").text()).toContain("还没有动作");
  });
});
