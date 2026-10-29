import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTINUITY_VERSION,
  createMemoryContinuityStore,
  createReplayLlm,
  type ContinuitySnapshot,
} from "@plingjs/agent";
import { createPling, AgentDock, PlingProvider, usePlingTool, type PlingOptions } from "../src";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = "";
});

async function render(node: ReactNode): Promise<void> {
  await act(async () => root!.render(node));
}

async function click(element: Element | null): Promise<void> {
  if (!element) throw new Error("要点击的元素不存在");
  await act(async () => {
    (element as HTMLElement).click();
  });
}

async function say(text: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(".pling-chat__composer input");
  const form = document.querySelector<HTMLFormElement>(".pling-chat__composer");
  if (!input || !form) throw new Error("聊天输入框不存在");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

async function setTab(index: 0 | 1): Promise<void> {
  const button = document.querySelectorAll<HTMLButtonElement>(".pling-dock__tabs button")[index];
  await click(button ?? null);
}

async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("等待超时");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function createZh(options: PlingOptions = {}) {
  return createPling({ ...options, ui: { ...options.ui, locale: "zh-CN" } });
}

function Host({ onRun, navigate }: { onRun: () => void; navigate?: (href: string) => void }) {
  const save = usePlingTool<HTMLButtonElement>({
    id: "save",
    desc: "保存当前草稿",
    run: onRun,
  });
  return (
    <>
      <button ref={save} onClick={onRun}>保存</button>
      <AgentDock navigate={navigate} />
    </>
  );
}

function ButtonOnly({ onRun }: { onRun: () => void }) {
  const save = usePlingTool<HTMLButtonElement>({
    id: "save",
    desc: "保存当前草稿",
    run: onRun,
  });
  return <button ref={save} onClick={onRun}>保存</button>;
}

function DangerHost({ onRun }: { onRun: () => void }) {
  const save = usePlingTool<HTMLButtonElement>({
    id: "save",
    desc: "保存当前草稿",
    kind: "danger",
    run: onRun,
  });
  return (
    <>
      <button ref={save} onClick={onRun}>保存</button>
      <AgentDock />
    </>
  );
}

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

describe("<AgentDock> · React", () => {
  it("默认英文界面：不配置 ui 也显示英文", async () => {
    const pling = createPling({ onWarn: () => {} });
    await render(<PlingProvider pling={pling}><Host onRun={() => {}} /></PlingProvider>);

    expect(document.querySelector(".pling-dock__launcher")!.textContent).toContain("Ask Pling");
    await click(document.querySelector(".pling-dock__launcher"));
    expect(document.body.textContent).toContain("Activity");
    expect(document.querySelector(".pling-dock__model")).toBeNull();
    expect(document.querySelector(".pling-dock__usage")).toBeNull();
    await setTab(1);
    expect(document.querySelector(".pling-dock__model")!.textContent).toBe("No model configured");
    expect(document.querySelector(".pling-dock__usage")!.textContent).toContain("Context");
  });

  it("locale / theme / classNames 原地更新，不需要重挂组件", async () => {
    const pling = createPling({
      onWarn: () => {},
      ui: {
        locale: "zh-CN",
        theme: { mode: "light", tokens: { colorPrimary: "#123456" } },
        classNames: {
          dock: "biz-dock",
          panel: "biz-panel",
          launcher: "biz-launcher",
          chat: "biz-chat",
        },
      },
    });
    await render(<PlingProvider pling={pling}><Host onRun={() => {}} /></PlingProvider>);

    const dock = document.querySelector<HTMLElement>(".pling-dock")!;
    expect(document.querySelector(".pling-dock__launcher")!.textContent).toContain("问助手");
    expect(dock.classList.contains("biz-dock")).toBe(true);
    expect(document.querySelector(".pling-dock__launcher")!.classList.contains("biz-launcher")).toBe(true);
    expect(dock.style.getPropertyValue("--pling-color-primary")).toBe("#123456");

    await click(document.querySelector(".pling-dock__launcher"));
    expect(document.querySelector(".pling-dock__panel")!.classList.contains("biz-panel")).toBe(true);
    expect(document.querySelector(".pling-chat")!.classList.contains("biz-chat")).toBe(true);
    expect(document.body.textContent).toContain("运行");

    await act(async () => {
      pling.ui.setLocale("en-US");
      pling.ui.setTheme({ mode: "dark", tokens: { colorPrimary: "#abcdef" } });
    });

    expect(document.querySelector(".pling-dock__launcher")!.textContent).toContain("Close assistant");
    expect(document.body.textContent).toContain("Activity");
    expect(dock.style.getPropertyValue("--pling-color-bg")).toBe("#0f172a");
    expect(dock.style.getPropertyValue("--pling-color-primary")).toBe("#abcdef");

    await act(async () => pling.ui.setLocale("en-US"));
    expect(document.querySelector(".pling-dock__launcher")!.textContent).toContain("Close assistant");
  });

  it("整页导航恢复后显示继续入口，并带出上次对话", async () => {
    const store = createMemoryContinuityStore(SNAPSHOT);
    const pling = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        continuity: { store, now: () => 2_000 },
        llm: createReplayLlm([{ content: "好" }]),
      },
    });

    await render(<PlingProvider pling={pling}><Host onRun={() => {}} /></PlingProvider>);
    expect(document.querySelector(".pling-dock__launcher")!.textContent).toContain("继续上次任务");

    await click(document.querySelector(".pling-dock__launcher"));
    expect(document.querySelector(".pling-chat__resume")!.textContent).toContain("上次任务");
    expect(document.querySelector(".pling-chat")!.textContent).toContain("上一页已经做完一半");
  });

  it("resume=auto 自动续跑一次，危险动作仍然先问人", async () => {
    const onRun = vi.fn();
    const llm = createReplayLlm([{ calls: [{ tool: "save" }] }, { content: "已经继续完成了。" }]);
    const pling = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        continuity: { store: createMemoryContinuityStore(SNAPSHOT), now: () => 2_000, resume: "auto" },
        llm,
      },
    });

    const tree = (
      <PlingProvider pling={pling}>
        <DangerHost onRun={onRun} />
      </PlingProvider>
    );
    await render(tree);
    await click(document.querySelector(".pling-dock__launcher"));

    await waitFor(() => Boolean(document.querySelector(".pling-chat__confirm")));
    expect(onRun).not.toHaveBeenCalled();
    expect(document.querySelector(".pling-chat__resume")).toBeNull();
    expect(document.querySelector(".pling-chat")!.textContent).toContain("上一页已经做完一半");
    expect(
      llm.received[0]?.some(
        (message) =>
          message.role === "user" &&
          message.content.includes("Continue the previous task") &&
          message.content.includes("do not assume it succeeded"),
      ),
    ).toBe(true);
    expect(llm.received[0]?.some((message) => message.content.includes("继续上次的任务"))).toBe(false);

    const approve = [...document.querySelectorAll<HTMLButtonElement>(".pling-chat__confirm button")]
      .find((button) => button.textContent?.includes("批准本次"));
    await click(approve ?? null);
    await waitFor(() => document.body.textContent?.includes("已经继续完成了。") ?? false);
    expect(onRun).toHaveBeenCalledOnce();
    expect(llm.turn).toBe(2);

    await render(tree);
    expect(llm.turn).toBe(2);
  });

  it("resume=auto + returnOnDone：完成后导航回开始页；卸载会取消延迟导航", async () => {
    const navigate = vi.fn();
    const pling = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        continuity: {
          store: createMemoryContinuityStore(SNAPSHOT),
          now: () => 2_000,
          resume: "auto",
          returnOnDone: { delayMs: 0 },
        },
        llm: createReplayLlm([{ content: "已经继续完成了。" }]),
      },
    });

    await render(<PlingProvider pling={pling}><Host onRun={() => {}} navigate={navigate} /></PlingProvider>);
    await waitFor(() => navigate.mock.calls.length === 1);
    expect(navigate).toHaveBeenCalledWith(new URL("/orders", location.href).href);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(navigate).toHaveBeenCalledOnce();

    await act(async () => root!.unmount());
    root = null;
    host!.remove();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    const late = vi.fn();
    const second = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        continuity: {
          store: createMemoryContinuityStore(SNAPSHOT),
          now: () => 2_000,
          resume: "auto",
          returnOnDone: { delayMs: 1_000 },
        },
        llm: createReplayLlm([{ content: "第二条任务完成。" }]),
      },
    });
    await render(<PlingProvider pling={second}><Host onRun={() => {}} navigate={late} /></PlingProvider>);
    await click(document.querySelector(".pling-dock__launcher"));
    await waitFor(() => document.body.textContent?.includes("第二条任务完成。") ?? false);
    await act(async () => root!.unmount());
    root = null;
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    expect(late).not.toHaveBeenCalled();
  });

  it("默认只有悬浮按钮；点开后出现对话与运行", async () => {
    const pling = createZh({ onWarn: () => {} });
    await render(<PlingProvider pling={pling}><Host onRun={() => {}} /></PlingProvider>);

    expect(document.querySelector(".pling-dock__panel")).toBeNull();
    await click(document.querySelector(".pling-dock__launcher"));
    expect(document.querySelector(".pling-dock__panel")).not.toBeNull();
    expect(document.body.textContent).toContain("运行");

    const close = [...document.querySelectorAll<HTMLButtonElement>(".pling-dock__ghost")]
      .find((button) => button.textContent?.includes("收起"));
    await click(close ?? null);
    expect(document.querySelector(".pling-dock__panel")).toBeNull();
  });

  it("一句话 → 模型调用页面动作 → 业务改变；参数进运行", async () => {
    const onRun = vi.fn();
    const pling = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm: createReplayLlm([
          { calls: [{ tool: "save" }] },
          { content: "已经保存好了。" },
        ]),
      },
    });

    await render(<PlingProvider pling={pling}><Host onRun={onRun} /></PlingProvider>);
    await click(document.querySelector(".pling-dock__launcher"));
    await say("帮我保存");
    await waitFor(() => document.body.textContent?.includes("已经保存好了。") ?? false);

    expect(onRun).toHaveBeenCalledOnce();
    expect(document.querySelector(".pling-chat")!.textContent).not.toContain("save");

    const activityTab = [...document.querySelectorAll<HTMLButtonElement>(".pling-dock__tabs button")]
      .find((button) => button.textContent?.includes("运行"));
    await click(activityTab ?? null);
    expect(document.querySelector(".pling-dock__activity")!.textContent).toContain("save");
    expect(document.querySelector(".pling-dock__activity")!.textContent).toContain("成功");
  });

  it("没配置模型时不静默失败：把缺什么贴成一条回复", async () => {
    const pling = createZh({ onWarn: () => {}, agent: { config: { baseUrl: "", model: "" } } });
    await render(<PlingProvider pling={pling}><Host onRun={() => {}} /></PlingProvider>);

    await click(document.querySelector(".pling-dock__launcher"));
    expect(document.querySelector(".pling-dock__model")).toBeNull();
    await setTab(1);
    expect(document.querySelector(".pling-dock__model")!.textContent).toBe("未配置模型");
    await setTab(0);
    await say("帮我保存");
    await waitFor(() => document.body.textContent?.includes("VITE_AGENT_BASE_URL") ?? false);
    expect(document.querySelector(".pling-dock__warn")!.textContent).toContain("VITE_AGENT_BASE_URL");
  });

  it("推荐指令点一下就等于发出去", async () => {
    const onRun = vi.fn();
    const pling = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm: createReplayLlm([{ calls: [{ tool: "save" }] }, { content: "好了" }]),
      },
    });
    await render(
      <PlingProvider pling={pling}>
        <ButtonOnly onRun={onRun} />
        <AgentDock quick={["帮我保存"]} />
      </PlingProvider>,
    );

    await click(document.querySelector(".pling-dock__launcher"));
    await click(document.querySelector(".pling-dock__quick button"));
    await waitFor(() => onRun.mock.calls.length > 0);
    expect(onRun).toHaveBeenCalledOnce();
  });
});
