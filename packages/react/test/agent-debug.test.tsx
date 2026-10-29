import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm, type AgentTraceOptions } from "@plingjs/agent";
import { createRegistry } from "@plingjs/core";
import {
  AgentDock,
  PlingProvider,
  createPling,
  usePlingTool,
  type PlingOptions,
} from "../src";

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

async function setTab(index: 0 | 1): Promise<void> {
  await click(document.querySelectorAll<HTMLButtonElement>(".pling-dock__tabs button")[index] ?? null);
}

function createPlingForTest(options: {
  debug?: boolean | AgentTraceOptions;
  traceInSetup?: boolean;
  registry?: ReturnType<typeof createRegistry>;
  content?: string;
  locale?: "en-US" | "zh-CN";
} = {}) {
  const pling = createPling({
    onWarn: () => {},
    ui: { locale: options.locale ?? "en-US" },
    ...(options.registry ? { registry: options.registry } : {}),
    agent: {
      config: { baseUrl: "/llm/v1", model: "test-model" },
      llm: createReplayLlm([{ content: options.content ?? "I saved it." }]),
      ...(options.traceInSetup ? { trace: true } : {}),
    },
  } satisfies PlingOptions);
  return pling;
}

function Host({
  debug,
  onRun = () => {},
  registry,
}: {
  debug?: boolean | AgentTraceOptions;
  onRun?: () => void;
  registry?: ReturnType<typeof createRegistry>;
}) {
  const save = usePlingTool<HTMLButtonElement>({
    id: "save",
    desc: "Save the current draft",
    run: onRun,
  });
  return (
    <>
      <button ref={save}>Save</button>
      <AgentDock defaultOpen debug={debug} registry={registry} quick={["Do one thing"]} />
    </>
  );
}

describe("<AgentDock> · React read-only inspector", () => {
  it("is absent unless tracing is explicitly enabled", async () => {
    const pling = createPlingForTest();
    await render(<PlingProvider pling={pling}><Host /></PlingProvider>);

    await setTab(1);
    expect(document.querySelector('[data-testid="pling-debug-toggle"]')).toBeNull();
  });

  it("inherits tracing configured on the application runtime", async () => {
    const pling = createPlingForTest({ traceInSetup: true });
    await render(<PlingProvider pling={pling}><Host /></PlingProvider>);

    await setTab(1);
    expect(document.querySelector('[data-testid="pling-debug-toggle"]')).not.toBeNull();
  });

  it("keeps quick tasks in Chat and diagnostics in Activity", async () => {
    const pling = createPlingForTest({ debug: { maxCalls: 8 } });
    await render(<PlingProvider pling={pling}><Host debug={{ maxCalls: 8 }} /></PlingProvider>);

    expect(document.querySelector(".pling-dock__quick")).not.toBeNull();
    expect(document.querySelector('[data-testid="pling-debug-toggle"]')).toBeNull();

    await setTab(1);
    expect(document.querySelector(".pling-dock__quick")).toBeNull();
    expect(document.querySelector('[data-testid="pling-debug-toggle"]')).not.toBeNull();
  });

  it("shows the page projection and the exact request without execution controls", async () => {
    const pling = createPlingForTest({ debug: { maxCalls: 8 } });
    await render(<PlingProvider pling={pling}><Host debug={{ maxCalls: 8 }} /></PlingProvider>);

    await say("Inspect this run");
    await waitFor(() => document.querySelector(".pling-chat")?.textContent?.includes("I saved it.") ?? false);
    await setTab(1);
    await click(document.querySelector('[data-testid="pling-debug-toggle"]'));

    const debug = document.querySelector<HTMLElement>('[data-testid="pling-debug"]');
    expect(debug).not.toBeNull();
    expect(debug!.textContent).toContain("Read-only inspector");
    expect(debug!.textContent).toContain("save");
    expect(debug!.textContent).toContain("Request messages");
    expect(debug!.textContent).toContain("Inspect this run");
    expect(debug!.textContent).toContain("I saved it.");
    expect(debug!.querySelectorAll(".pling-debug__schema")).toHaveLength(1);
    expect([...debug!.querySelectorAll("button")].map((button) => button.textContent?.trim()))
      .toEqual(["Refresh"]);
  });

  it("clears the request trace with the conversation", async () => {
    const pling = createPlingForTest({ debug: true });
    await render(<PlingProvider pling={pling}><Host debug /></PlingProvider>);

    await say("Inspect this run");
    await waitFor(() => document.querySelector(".pling-chat")?.textContent?.includes("I saved it.") ?? false);
    await setTab(1);
    await click(document.querySelector('[data-testid="pling-debug-toggle"]'));
    expect(document.querySelector('[data-testid="pling-debug"]')!.textContent).toContain("Inspect this run");

    const clear = [...document.querySelectorAll<HTMLButtonElement>(".pling-dock__ghost")]
      .find((button) => button.textContent?.trim() === "Clear");
    await click(clear ?? null);

    expect(document.querySelector('[data-testid="pling-debug"]')!.textContent).toContain("No model calls yet");
  });

  it("inspects the registry used by this conversation", async () => {
    const custom = createRegistry();
    custom.setPage({ title: "Custom runtime page", path: "/custom" });
    const pling = createPlingForTest({ debug: true });
    await render(
      <PlingProvider pling={pling}>
        <Host debug registry={custom} />
      </PlingProvider>,
    );

    await setTab(1);
    await click(document.querySelector('[data-testid="pling-debug-toggle"]'));
    const debug = document.querySelector('[data-testid="pling-debug"]');
    expect(debug!.textContent).toContain("Custom runtime page");
    expect(debug!.textContent).toContain("/custom");
  });

  it("uses the active UI locale for diagnostics", async () => {
    const pling = createPlingForTest({ debug: true, locale: "zh-CN", content: "已经保存好了。" });
    await render(<PlingProvider pling={pling}><Host debug /></PlingProvider>);

    const save = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Save");
    await act(async () => {
      save!.disabled = true;
    });

    await say("检查这次运行");
    await waitFor(() => document.querySelector(".pling-chat")?.textContent?.includes("已经保存好了。") ?? false);
    await setTab(1);
    await click(document.querySelector('[data-testid="pling-debug-toggle"]'));

    const debug = document.querySelector('[data-testid="pling-debug"]');
    expect(debug!.textContent).toContain("只读检查器");
    expect(debug!.textContent).toContain("请求消息");
    expect(debug!.textContent).toContain("检查这次运行");
    const projection = debug!.querySelector(".pling-debug__section");
    expect(projection!.textContent).toContain("元素处于禁用状态");
    expect(projection!.textContent).not.toContain("Element is disabled");
  });
});
