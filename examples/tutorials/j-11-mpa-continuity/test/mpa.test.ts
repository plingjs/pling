import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CONTINUITY_VERSION,
  createMemoryContinuityStore,
  createReplayLlm,
  type ContinuitySnapshot,
} from "@plingjs/agent";
import type { Llm, LlmMessage } from "@plingjs/core";
import { createDetailPage, type DetailPage } from "../src/DetailPage";
import { createListPage, type ListPage } from "../src/ListPage";

let host: HTMLDivElement;
let page: ListPage | DetailPage | null = null;

function mount(): void {
  host = document.createElement("div");
  document.body.append(host);
}

function unmount(): void {
  page?.destroy();
  page = null;
  host.remove();
  document.body.innerHTML = "";
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
}

function setLocation(path: string): void {
  window.history.replaceState({}, "", path);
}

async function waitFor(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (!read()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("等待超时");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function clickByText(text: string): void {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (item) => item.textContent?.trim() === text,
  );
  if (!button) throw new Error(`找不到按钮：${text}`);
  button.click();
}

const SNAPSHOT: ContinuitySnapshot = {
  version: CONTINUITY_VERSION,
  updatedAt: 1_000,
  status: "active",
  goal: "Globex的备注为：周五约吃饭",
  page: { path: "/demo/index.html", title: "客户回访" },
  summary: "",
  messages: [
    {
      role: "user",
      content: "Globex的备注为：周五约吃饭",
    },
    { role: "assistant", content: "好的，我先打开 Globex 的详情页。" },
  ],
  events: [
    { type: "user", text: "Globex的备注为：周五约吃饭" },
    { type: "assistant", text: "好的，我先打开 Globex 的详情页。" },
  ],
};

beforeEach(() => {
  sessionStorage.clear();
  mount();
});

afterEach(unmount);

describe("J-11 · MPA task continuity", () => {
  it("在嵌套部署路径下记录真实页面身份，而不是写死的站点根目录", () => {
    setLocation("/demos/tutorials/vanilla/j-11/demo/index.html?lang=zh");
    page = createListPage(host, { presence: false, dock: false });

    expect(page.pling.registry.snapshot().page).toMatchObject({
      path: "/demos/tutorials/vanilla/j-11/demo/index.html",
      query: { lang: "zh" },
    });
  });

  it("列表页的查看详情是真实 href：整页导航而不是路由内跳转", async () => {
    const navigations: string[] = [];
    page = createListPage(host, {
      navigate: (href) => navigations.push(href),
      presence: false,
      dock: false,
    });

    await expect(page.executor.execute("open@c1", "{}")).resolves.toMatchObject({
      result: { ok: true },
    });
    await expect(page.executor.execute("open@c2", "{}")).resolves.toMatchObject({
      result: { ok: true },
    });

    expect(navigations).toEqual(["./detail.html?id=c1", "./detail.html?id=c2"]);
  });

  it("列表页进入详情时保留教程语言参数", async () => {
    setLocation("/demos/tutorials/vanilla/j-11/demo/index.html?lang=zh");
    const navigations: string[] = [];
    page = createListPage(host, {
      navigate: (href) => navigations.push(href),
      presence: false,
      dock: false,
    });

    await page.executor.execute("open@c1", "{}");
    expect(navigations).toEqual(["./detail.html?id=c1&lang=zh"]);
  });

  it("详情页的动作走真实 DOM：填写、保存、归档都会落到业务对象", async () => {
    page = createDetailPage(host, { id: "c1", presence: false, dock: false });

    await expect(
      page.executor.execute("detail_note", JSON.stringify({ text: "周五约吃饭" })),
    ).resolves.toMatchObject({ result: { ok: true } });
    expect(host.querySelector<HTMLTextAreaElement>("[data-note]")?.value).toBe("周五约吃饭");

    await page.executor.execute("detail_save", "{}");
    expect(page.customer.note).toBe("周五约吃饭");
    expect(page.customer.status).toBe("已回访");
    expect(host.querySelector("[data-status]")?.textContent).toBe("已回访");

    await page.executor.execute("detail_archive", "{}");
    expect(page.customer.status).toBe("已归档");
    expect(host.querySelector("[data-status]")?.textContent).toBe("已归档");
  });

  it("详情页返回列表时保留嵌套部署目录与语言参数", async () => {
    setLocation("/demos/tutorials/vanilla/j-11/demo/detail.html?id=c1&lang=zh");
    const navigations: string[] = [];
    page = createDetailPage(host, {
      id: "c1",
      presence: false,
      dock: false,
      navigate: (href) => navigations.push(href),
    });
    const back = host.querySelector<HTMLAnchorElement>("[data-back]");
    expect(back?.getAttribute("href")).toBe("/demos/tutorials/vanilla/j-11/demo/index.html?lang=zh");

    await page.executor.execute("detail_back", "{}");
    expect(navigations).toEqual(["/demos/tutorials/vanilla/j-11/demo/index.html?lang=zh"]);
  });

  it("同一标签页跳到新 document 后，浮窗提示继续任务，并保留原目标与对话", async () => {
    const store = createMemoryContinuityStore(SNAPSHOT);
    page = createDetailPage(host, {
      id: "c2",
      presence: false,
      agent: {
        continuity: { store, now: () => 2_000 },
        llm: async () => ({ content: "已在新页面继续" }),
        config: { limits: { maxTurns: 100 } },
      },
    });
    const dock = page.dock!;

    expect(dock.runtime.continuity.restored).toBe(true);
    expect(dock.runtime.continuity.checkpoint?.goal).toContain("Globex");

    dock.open();
    await waitFor(() => Boolean(document.querySelector(".pling-chat__resume")));
    const resume = document.querySelector(".pling-chat__resume")!;
    expect(resume.textContent).toContain("上次任务");
    expect(resume.textContent).toContain("不会自动执行任何动作");
    expect(document.querySelector(".pling-chat__transcript")?.textContent).toContain("我先打开 Globex");

    clickByText("继续上次任务");
    await waitFor(() => dock.runtime.session.status() === "idle" && document.querySelector(".pling-chat__resume") === null);
    await waitFor(() => document.querySelector(".pling-chat__transcript")?.textContent?.includes("已在新页面继续") === true);

    // 「继续」是一条受控用户消息，不覆盖原来的目标。
    expect(store.load()?.goal).toContain("Globex的备注为");
    const user = dock.runtime.session.events().filter((event) => event.type === "user");
    expect(user.at(-1)).toMatchObject({ text: expect.stringContaining("Continue the previous task") });
  });

  it("页面跳转截断的 tool call 在恢复后补成「结果未知」，下一轮请求仍然合法", async () => {
    const interrupted: ContinuitySnapshot = {
      ...SNAPSHOT,
      messages: [
        { role: "user", content: "打开 Globex 的详情页" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "call_1", name: "open@c2", arguments: "{}" }],
        },
      ],
      events: [
        { type: "user", text: "打开 Globex 的详情页" },
        { type: "tool_call", id: "open@c2", tool: "open@c2", args: {} },
      ],
    };
    const store = createMemoryContinuityStore(interrupted);
    let seen: LlmMessage[] = [];
    const llm: Llm = async (messages) => {
      seen = messages;
      return { content: "先观察新页面，再继续。" };
    };

    page = createDetailPage(host, {
      id: "c2",
      presence: false,
      agent: { continuity: { store, now: () => 2_000 }, llm, config: { limits: { maxTurns: 100 } } },
    });
    const dock = page.dock!;

    expect(dock.runtime.continuity.checkpoint?.interrupted).toBe(true);
    await dock.runtime.session.send("继续");

    const tool = seen.find((message) => message.role === "tool");
    expect(tool?.toolCallId).toBe("call_1");
    expect(tool?.content).toContain("the result of this step is unknown");
  });

  it("自动续跑完成详情页操作后，自动返回任务开始页且只返回一次", async () => {
    setLocation("/demos/tutorials/vanilla/j-11/demo/detail.html?id=c2&lang=zh");
    const navigations: string[] = [];
    const startPage = {
      path: "/demos/tutorials/vanilla/j-11/demo/index.html",
      title: "客户回访",
      query: { lang: "zh" },
    };
    const store = createMemoryContinuityStore({ ...SNAPSHOT, startPage });
    const llm = createReplayLlm([
      { calls: [{ tool: "detail_note", args: { text: "周五约吃饭" } }] },
      { calls: [{ tool: "detail_save" }] },
      { content: "备注已保存，正在返回列表。" },
    ]);

    page = createDetailPage(host, {
      id: "c2",
      presence: false,
      dockNavigate: (href) => navigations.push(href),
      agent: {
        continuity: {
          store,
          now: () => 2_000,
          resume: "auto",
          returnOnDone: { delayMs: 0 },
        },
        llm,
        config: { limits: { maxTurns: 100 } },
      },
    });

    await waitFor(() => navigations.length === 1);
    expect(navigations[0]).toBe(new URL("/demos/tutorials/vanilla/j-11/demo/index.html?lang=zh", location.href).href);
    expect(page.customer.note).toBe("周五约吃饭");
    expect(page.customer.status).toBe("已回访");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(navigations).toHaveLength(1);
  });

  it("新标签页（新 store）不会继承别的标签页的任务", () => {
    const store = createMemoryContinuityStore();
    page = createDetailPage(host, {
      id: "c1",
      presence: false,
      agent: {
        continuity: { store },
        llm: async () => ({ content: "好" }),
        config: { limits: { maxTurns: 100 } },
      },
    });

    expect(page.dock?.runtime.continuity.restored).toBe(false);
    expect(document.querySelector(".pling-chat__resume")).toBeNull();
  });
});
