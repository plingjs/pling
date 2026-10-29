import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "../src/App";

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

async function mount(locale: "en" | "zh" = "en") {
  const pling = createPling({
    presence: false,
    onWarn: () => {},
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: {
      config: {
        baseUrl: "/llm/v1",
        model: "test-model",
        limits: { maxTurns: 100 },
      },
      llm: createReplayLlm([{ content: locale === "zh" ? "已经检查完了。" : "Inspection complete." }]),
    },
  });

  await act(async () => {
    root!.render(
      <PlingProvider pling={pling}>
        <App locale={locale} />
      </PlingProvider>,
    );
  });
  return pling;
}

async function click(element: Element | null): Promise<void> {
  if (!element) throw new Error("要点击的元素不存在");
  await act(async () => {
    (element as HTMLElement).click();
  });
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

async function openDebug(): Promise<void> {
  await click(document.querySelector(".pling-dock__launcher"));
  await click(document.querySelectorAll<HTMLButtonElement>(".pling-dock__tabs button")[1] ?? null);
  await click(document.querySelector('[data-testid="pling-debug-toggle"]'));
}

describe("R-04 · inspect one React agent run", () => {
  it("keeps the R-03 page surface unchanged", async () => {
    const pling = await mount();
    const snapshot = pling.registry.snapshot();

    expect(snapshot.scopes.map((scope) => scope.id)).toContain("todo");
    expect(snapshot.records.map((record) => record.id)).toEqual(["t1", "t2", "t3"]);
    expect(snapshot.actions.map((action) => action.id)).toEqual(expect.arrayContaining([
      "composer_text",
      "toggle@t1",
      "toggle@t2",
      "toggle@t3",
    ]));
  });

  it("shows the page projection and exact model request in Activity", async () => {
    await mount();
    await click(document.querySelector(".pling-dock__launcher"));
    await say("Inspect this run");
    await waitFor(() => document.querySelector(".pling-chat")?.textContent?.includes("Inspection complete.") ?? false);

    await click(document.querySelectorAll<HTMLButtonElement>(".pling-dock__tabs button")[1] ?? null);
    await click(document.querySelector('[data-testid="pling-debug-toggle"]'));

    const debug = document.querySelector<HTMLElement>('[data-testid="pling-debug"]');
    expect(debug).not.toBeNull();
    expect(debug!.textContent).toContain("Page projection");
    expect(debug!.textContent).toContain("Review the launch checklist");
    expect(debug!.textContent).toContain("Request messages");
    expect(debug!.textContent).toContain("Inspect this run");
    expect(debug!.textContent).toContain("Inspection complete.");
    expect(debug!.textContent).toContain("Tools sent");
    expect(debug!.textContent).toContain("Page at this call");
    expect([...debug!.querySelectorAll("button")].map((button) => button.textContent?.trim()))
      .toEqual(["Refresh"]);
  });

  it("clears traces with the conversation", async () => {
    await mount();
    await openDebug();
    await click(document.querySelectorAll<HTMLButtonElement>(".pling-dock__tabs button")[0] ?? null);
    await say("Inspect this run");
    await waitFor(() => document.querySelector(".pling-chat")?.textContent?.includes("Inspection complete.") ?? false);
    await click(document.querySelectorAll<HTMLButtonElement>(".pling-dock__tabs button")[1] ?? null);
    expect(document.querySelector('[data-testid="pling-debug"]')!.textContent).toContain("Inspect this run");

    const clear = [...document.querySelectorAll<HTMLButtonElement>(".pling-dock__ghost")]
      .find((button) => button.textContent?.trim() === "Clear");
    await click(clear ?? null);

    expect(document.querySelector('[data-testid="pling-debug"]')!.textContent).toContain("No model calls yet");
  });

  it("uses Chinese labels and operation text in the Chinese demo", async () => {
    await mount("zh");
    await openDebug();

    const debug = document.querySelector('[data-testid="pling-debug"]');
    expect(debug!.textContent).toContain("只读检查器");
    expect(debug!.textContent).toContain("页面投影");
    expect(debug!.textContent).toContain("检查发布清单");
    expect(debug!.textContent).toContain("还没有模型调用");
  });
});
