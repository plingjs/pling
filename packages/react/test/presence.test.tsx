import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling, PlingProvider, usePlingTool, type PlingOptions } from "../src";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const allowAll = createPolicy(async () => true);
let root: Root | null = null;

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.useRealTimers();
});

function overlay(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-pling-presence]");
}

async function mountApp(options: PlingOptions, node: React.ReactNode) {
  const pling = createPling({ onWarn: () => {}, ...options });
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<PlingProvider pling={pling}>{node}</PlingProvider>));
  return pling;
}

function SaveButton({ run }: { run?: () => void }) {
  const save = usePlingTool<HTMLButtonElement>({ id: "save", desc: "保存", run });
  return <button ref={save}>保存</button>;
}

describe("React 存在感", () => {
  it("执行动作 → 目标出现光圈，最短显示时间后消失", async () => {
    vi.useFakeTimers();
    const pling = await mountApp({}, <SaveButton />);
    await createExecutor({ registry: pling.registry, policy: allowAll }).execute("save", "{}");

    const ring = overlay();
    expect(ring).not.toBeNull();
    expect(ring!.hasAttribute("data-pling-ui")).toBe(true);
    expect(ring!.classList.contains("is-waiting")).toBe(false);

    vi.advanceTimersByTime(300);
    expect(overlay()).not.toBeNull();
    vi.advanceTimersByTime(500);
    expect(overlay()).toBeNull();
  });

  it("圈住的是真正被操作的内部按钮，而不是外层壳", async () => {
    vi.useFakeTimers();
    function Shell() {
      const save = usePlingTool<HTMLDivElement>({ id: "save", desc: "保存" });
      return <div ref={save}><button className="inner">保存</button></div>;
    }
    const pling = await mountApp({}, <Shell />);
    const inner = document.querySelector("button.inner") as HTMLElement;
    inner.getBoundingClientRect = () =>
      ({ left: 120, top: 80, width: 100, height: 40, right: 220, bottom: 120, x: 120, y: 80, toJSON: () => ({}) }) as DOMRect;

    await createExecutor({ registry: pling.registry, policy: allowAll }).execute("save", "{}");
    const ring = overlay()!;
    expect(ring.style.left).toBe("114px");
    expect(ring.style.top).toBe("74px");
    expect(ring.style.width).toBe("112px");
  });

  it("handoff 期间保持 waiting，直到用户完成", async () => {
    vi.useFakeTimers();
    function Upload() {
      const upload = usePlingTool<HTMLButtonElement>({ id: "upload", desc: "上传发票", handoff: "请选择发票文件" });
      return <button ref={upload}>上传发票</button>;
    }
    const pling = await mountApp({}, <Upload />);
    let duringGate: HTMLElement | null = null;
    let lingering: HTMLElement | null = null;
    const executor = createExecutor({
      registry: pling.registry,
      policy: allowAll,
      handoff: async () => {
        duringGate = overlay();
        vi.advanceTimersByTime(10_000);
        lingering = overlay();
        return "done";
      },
    });

    await executor.execute("upload", "{}");
    expect(duringGate).not.toBeNull();
    expect(duringGate!.classList.contains("is-waiting")).toBe(true);
    expect(lingering).toBe(duringGate);

    vi.advanceTimersByTime(1_000);
    expect(overlay()).toBeNull();
  });

  it("presence: false 一个开关全关掉，动作照常执行", async () => {
    const run = vi.fn();
    const pling = await mountApp({ presence: false }, <SaveButton run={run} />);
    await createExecutor({ registry: pling.registry, policy: allowAll }).execute("save", "{}");
    expect(run).toHaveBeenCalledOnce();
    expect(overlay()).toBeNull();
  });

  it("自定义画法：render 返回自己的节点", async () => {
    vi.useFakeTimers();
    const pling = await mountApp({
      presence: {
        render: (el) => {
          const star = document.createElement("span");
          star.className = "my-star";
          star.textContent = el.tagName.toLowerCase();
          return star;
        },
      },
    }, <SaveButton />);

    await createExecutor({ registry: pling.registry, policy: allowAll }).execute("save", "{}");
    expect(overlay()!.querySelector(".my-star")?.textContent).toBe("button");
  });
});
