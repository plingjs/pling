import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTINUITY_VERSION,
  createMemoryContinuityStore,
  createReplayLlm,
  type ContinuitySnapshot,
} from "@plingjs/agent";
import type { ConfirmRequest } from "@plingjs/core";
import { createPling, type VanillaPlingOptions } from "../src";

const RESUME_SNAPSHOT: ContinuitySnapshot = {
  version: CONTINUITY_VERSION,
  updatedAt: 1_000,
  status: "active",
  goal: "在上一页完成任务",
  page: { path: "/orders/SO-1001", query: { tab: "detail" } },
  startPage: { path: "/orders" },
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

afterEach(() => {
  document.body.innerHTML = "";
});

function mountButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = label;
  document.body.append(button);
  return button;
}

function click(element: Element | null): void {
  if (!element) throw new Error("要点击的元素不存在");
  (element as HTMLElement).click();
}

function say(text: string): void {
  const input = document.querySelector<HTMLInputElement>(".pling-chat__composer input");
  const form = document.querySelector<HTMLFormElement>(".pling-chat__composer");
  if (!input || !form) throw new Error("聊天输入框不存在");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

function setTab(index: 0 | 1): void {
  click(document.querySelectorAll<HTMLButtonElement>(".pling-dock__tabs button")[index] ?? null);
}

async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("等待超时");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function createZh(options: VanillaPlingOptions = {}) {
  return createPling({ ...options, ui: { ...options.ui, locale: "zh-CN" } });
}

describe("pling.dock() · 原生 JS", () => {
  it("默认英文界面：不配置 ui 也显示英文", () => {
    const pling = createPling({ onWarn: () => {} });
    pling.dock();

    expect(document.querySelector(".pling-dock__launcher")!.textContent).toContain("Ask Pling");
    click(document.querySelector(".pling-dock__launcher"));
    expect(document.body.textContent).toContain("Activity");
    expect(document.querySelector<HTMLElement>(".pling-dock__activity-view")!.hidden).toBe(true);
    setTab(1);
    expect(document.querySelector<HTMLElement>(".pling-dock__activity-view")!.hidden).toBe(false);
    expect(document.querySelector(".pling-dock__model")!.textContent).toBe("No model configured");
    expect(document.querySelector(".pling-dock__usage")!.textContent).toContain("Context");
    pling.destroy();
  });

  it("locale / theme / classNames 原地更新，不需要重建 dock", () => {
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
    const dock = pling.dock();
    const root = dock.element;

    expect(document.querySelector(".pling-dock__launcher")!.textContent).toContain("问助手");
    expect(root.classList.contains("biz-dock")).toBe(true);
    expect(document.querySelector(".pling-dock__launcher")!.classList.contains("biz-launcher")).toBe(true);
    expect(root.style.getPropertyValue("--pling-color-primary")).toBe("#123456");

    click(document.querySelector(".pling-dock__launcher"));
    expect(document.querySelector(".pling-dock__panel")!.classList.contains("biz-panel")).toBe(true);
    expect(document.querySelector(".pling-chat")!.classList.contains("biz-chat")).toBe(true);
    expect(document.body.textContent).toContain("运行");

    pling.ui.setLocale("en-US");
    pling.ui.setTheme({ mode: "dark", tokens: { colorPrimary: "#abcdef" } });

    expect(document.querySelector(".pling-dock__launcher")!.textContent).toContain("Close assistant");
    expect(document.body.textContent).toContain("Activity");
    expect(root.style.getPropertyValue("--pling-color-bg")).toBe("#0f172a");
    expect(root.style.getPropertyValue("--pling-color-primary")).toBe("#abcdef");

    pling.ui.setLocale("en-US");
    expect(document.querySelector(".pling-dock__launcher")!.textContent).toContain("Close assistant");
    pling.destroy();
  });

  it("默认只有悬浮按钮；打开后出现对话 / 运行，关闭后移除面板", () => {
    const pling = createZh({ onWarn: () => {} });
    const dock = pling.dock({ title: "Todo 助手" });

    expect(dock.element.hasAttribute("data-pling-ui")).toBe(true);
    expect(document.querySelector(".pling-dock__panel")).toBeNull();
    click(document.querySelector(".pling-dock__launcher"));
    expect(document.querySelector(".pling-dock__panel")).not.toBeNull();
    expect(document.body.textContent).toContain("Todo 助手");
    expect(document.body.textContent).toContain("运行");

    const close = [...document.querySelectorAll<HTMLButtonElement>(".pling-dock__ghost")]
      .find((item) => item.textContent?.includes("收起"));
    click(close ?? null);
    expect(document.querySelector(".pling-dock__panel")).toBeNull();
    pling.destroy();
  });

  it("一句话 → 调用已声明动作 → 对话不显示工具流水，参数进运行", async () => {
    const button = mountButton("保存");
    const onSave = vi.fn();
    button.addEventListener("click", onSave);
    const pling = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm: createReplayLlm([
          { calls: [{ tool: "save", args: { draft: "周报" } }] },
          { content: "已经保存好了。" },
        ]),
      },
    });
    pling.tool(button, { id: "save", desc: "保存当前草稿" });
    pling.dock();

    click(document.querySelector(".pling-dock__launcher"));
    say("帮我保存");
    await waitFor(() => document.body.textContent?.includes("已经保存好了。") ?? false);

    expect(onSave).toHaveBeenCalledOnce();
    expect(document.querySelector(".pling-chat")!.textContent).not.toContain("save");

    const activityTab = [...document.querySelectorAll<HTMLButtonElement>(".pling-dock__tabs button")]
      .find((item) => item.textContent?.includes("运行"));
    click(activityTab ?? null);
    const activity = document.querySelector(".pling-dock__activity")!;
    expect(activity.textContent).toContain("save");
    expect(activity.textContent).toContain("保存当前草稿");
    expect(activity.textContent).toContain("周报");
    expect(activity.textContent).toContain("成功");
    pling.destroy();
  });

  it("没配置模型时不静默失败：给出与 Vue / React 相同的 readiness 提示", async () => {
    const pling = createZh({
      onWarn: () => {},
      agent: { config: { baseUrl: "", model: "" } },
    });
    pling.dock();
    click(document.querySelector(".pling-dock__launcher"));
    expect(document.querySelector<HTMLElement>(".pling-dock__activity-view")!.hidden).toBe(true);
    setTab(1);
    expect(document.querySelector<HTMLElement>(".pling-dock__activity-view")!.hidden).toBe(false);
    expect(document.querySelector(".pling-dock__model")!.textContent).toBe("未配置模型");
    setTab(0);

    say("帮我保存");
    await waitFor(() => document.querySelector(".pling-dock__warn")!.textContent!.includes("VITE_AGENT_BASE_URL"));
    expect(document.querySelector(".pling-chat")!.textContent).toContain("VITE_AGENT_BASE_URL");
    pling.destroy();
  });

  it("推荐指令点一下就等于发出去", async () => {
    const button = mountButton("保存");
    const onSave = vi.fn();
    button.addEventListener("click", onSave);
    const pling = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm: createReplayLlm([{ calls: [{ tool: "save" }] }, { content: "好了" }]),
      },
    });
    pling.tool(button, { id: "save", desc: "保存当前草稿" });
    pling.dock({ quick: ["帮我保存"] });

    click(document.querySelector(".pling-dock__launcher"));
    click(document.querySelector(".pling-dock__quick button"));
    await waitFor(() => onSave.mock.calls.length > 0);
    expect(onSave).toHaveBeenCalledOnce();
    pling.destroy();
  });

  it("resume=auto 自动续跑一次，危险动作仍然先问人", async () => {
    const button = mountButton("保存");
    const onSave = vi.fn();
    button.addEventListener("click", onSave);
    const store = createMemoryContinuityStore(RESUME_SNAPSHOT);
    const pling = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        continuity: { store, now: () => 2_000, resume: "auto" },
        llm: createReplayLlm([{ calls: [{ tool: "save" }] }, { content: "已经继续完成了。" }]),
      },
    });
    pling.tool(button, { id: "save", desc: "保存当前草稿", kind: "danger" });
    const dock = pling.dock({ defaultOpen: true });

    expect(dock.runtime.continuity.restored).toBe(true);
    expect(dock.runtime.continuity.resume).toBe("auto");

    await waitFor(
      () =>
        dock.runtime.session
          .events()
          .some((event) => event.type === "user" && event.text.includes("Continue the previous task")),
    );
    await waitFor(() => Boolean(document.querySelector(".pling-chat__confirm")));
    expect(onSave).not.toHaveBeenCalled();
    expect(document.querySelector(".pling-chat__resume")).toBeNull();
    expect(document.querySelector(".pling-chat")!.textContent).toContain("上一页已经做完一半");

    const approve = [...document.querySelectorAll<HTMLButtonElement>(".pling-chat__confirm button")]
      .find((item) => item.textContent?.includes("批准本次"));
    click(approve ?? null);
    await waitFor(() => document.body.textContent?.includes("已经继续完成了。") ?? false);
    expect(onSave).toHaveBeenCalledOnce();
    pling.destroy();
  });

  it("resume=auto + returnOnDone：完成后只导航回开始页一次", async () => {
    const navigate = vi.fn();
    const pling = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        continuity: {
          store: createMemoryContinuityStore(RESUME_SNAPSHOT),
          now: () => 2_000,
          resume: "auto",
          returnOnDone: { delayMs: 0 },
        },
        llm: createReplayLlm([{ content: "已经继续完成了。" }]),
      },
    });
    const dock = pling.dock({ defaultOpen: true, navigate });

    await waitFor(() => navigate.mock.calls.length === 1);
    expect(navigate).toHaveBeenCalledWith(new URL("/orders", location.href).href);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(navigate).toHaveBeenCalledOnce();
    expect(dock.runtime.continuity.claimReturn()).toBeNull();
    pling.destroy();
  });

  it("destroy 会取消尚未触发的返回导航", async () => {
    const navigate = vi.fn();
    const pling = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        continuity: {
          store: createMemoryContinuityStore(RESUME_SNAPSHOT),
          now: () => 2_000,
          resume: "auto",
          returnOnDone: { delayMs: 40 },
        },
        llm: createReplayLlm([{ content: "已经继续完成了。" }]),
      },
    });
    const dock = pling.dock({ navigate });
    await waitFor(() => dock.runtime.session.events().some((event) => event.type === "final"));
    dock.destroy();

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("returnOnDone 即使被配置成跨源地址，也不会把用户带出站", async () => {
    const navigate = vi.fn();
    const pling = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        continuity: {
          store: createMemoryContinuityStore(RESUME_SNAPSHOT),
          now: () => 2_000,
          resume: "auto",
          returnOnDone: { to: "https://evil.example/steal", delayMs: 0 },
        },
        llm: createReplayLlm([{ content: "已经继续完成了。" }]),
      },
    });
    const dock = pling.dock({ navigate });
    await waitFor(() => dock.runtime.session.events().some((event) => event.type === "final"));

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(navigate).not.toHaveBeenCalled();
    pling.destroy();
  });

  it("危险动作弹确认条，批准后继续执行；清空会复位会话与两页内容", async () => {
    const button = mountButton("删除");
    const onDelete = vi.fn();
    button.addEventListener("click", onDelete);
    const pling = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        llm: createReplayLlm([{ calls: [{ tool: "remove" }] }, { content: "已删除。" }]),
      },
    });
    pling.tool(button, { id: "remove", desc: "删除当前记录", kind: "danger" });
    pling.dock();

    click(document.querySelector(".pling-dock__launcher"));
    say("删掉它");
    await waitFor(() => Boolean(document.querySelector(".pling-chat__confirm")));
    expect(onDelete).not.toHaveBeenCalled();
    const approve = [...document.querySelectorAll<HTMLButtonElement>(".pling-chat__confirm button")]
      .find((item) => item.textContent?.includes("批准本次"));
    click(approve ?? null);
    await waitFor(() => document.body.textContent?.includes("已删除。") ?? false);
    expect(onDelete).toHaveBeenCalledOnce();

    const clear = [...document.querySelectorAll<HTMLButtonElement>(".pling-dock__ghost")]
      .find((item) => item.textContent === "清空");
    click(clear ?? null);
    expect(document.querySelector(".pling-chat__transcript")!.textContent).not.toContain("已删除");
    click([...document.querySelectorAll<HTMLButtonElement>(".pling-dock__tabs button")]
      .find((item) => item.textContent?.includes("运行")) ?? null);
    expect(document.querySelector(".pling-dock__activity")!.textContent).toContain("还没有动作");
    pling.destroy();
  });

  it("人工接力由同一个队列驱动，完成后循环继续", async () => {
    const button = mountButton("上传");
    const onUpload = vi.fn();
    button.addEventListener("click", onUpload);
    const pling = createZh({
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        llm: createReplayLlm([{ calls: [{ tool: "upload" }] }, { content: "上传完成。" }]),
      },
    });
    pling.tool(button, {
      id: "upload",
      desc: "让用户亲自选择并上传文件",
      handoff: { reason: "文件只能由用户从本机选择", steps: ["点上传", "选择文件"] },
    });
    pling.dock();

    click(document.querySelector(".pling-dock__launcher"));
    say("上传附件");
    await waitFor(() => Boolean(document.querySelector(".pling-chat__handoff")));
    expect(onUpload).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("点上传");
    click([...document.querySelectorAll<HTMLButtonElement>(".pling-chat__handoff button")]
      .find((item) => item.textContent === "下一步") ?? null);
    click([...document.querySelectorAll<HTMLButtonElement>(".pling-chat__handoff button")]
      .find((item) => item.textContent === "我已完成") ?? null);
    await waitFor(() => document.body.textContent?.includes("上传完成。") ?? false);
    expect(onUpload).not.toHaveBeenCalled();
    pling.destroy();
  });

  it("只在 ask 策略下显示「始终允许」", async () => {
    const pling = createZh({ onWarn: () => {} });
    const dock = pling.dock({ defaultOpen: true });
    const request = (approval: ConfirmRequest["approval"]): ConfirmRequest => ({
      id: "update_note@order:SO-1002",
      kind: "write",
      approval,
      description: "修改订单备注",
      args: { record: "SO-1002" },
    });

    void dock.runtime.approvals.channel(request("ask-always"));
    await waitFor(() => Boolean(document.querySelector(".pling-chat__confirm")));
    expect(document.querySelector(".pling-chat__confirm")!.textContent).not.toContain("始终允许");
    dock.runtime.approvals.reply(true);
    await waitFor(() => !document.querySelector(".pling-chat__confirm"));

    void dock.runtime.approvals.channel(request("ask"));
    await waitFor(() => Boolean(document.querySelector(".pling-chat__confirm")));
    expect(document.querySelector(".pling-chat__confirm")!.textContent).toContain("始终允许");
    dock.runtime.approvals.reply(false);
    pling.destroy();
  });

  it("destroy 清掉浮窗；pling.destroy 也顺手销毁 dock", () => {
    const pling = createZh({ onWarn: () => {} });
    const dock = pling.dock();
    expect(document.querySelector(".pling-dock")).not.toBeNull();
    dock.destroy();
    expect(document.querySelector(".pling-dock")).toBeNull();

    pling.dock();
    expect(document.querySelector(".pling-dock")).not.toBeNull();
    pling.destroy();
    expect(document.querySelector(".pling-dock")).toBeNull();
  });

  it("L1 派生跳过整个浮窗，不会把启动器或聊天按钮收成业务动作", () => {
    const button = mountButton("保存");
    const pling = createZh({ derive: { root: document.body, observe: false }, onWarn: () => {} });
    pling.dock();
    pling.derived()!.sync();
    const ids = pling.derived()!.ids();
    expect(ids).toContain("save");
    expect(ids.join(" ")).not.toContain("问助手");
    expect(ids.join(" ")).not.toContain("收起助手");
    pling.destroy();
  });
});
