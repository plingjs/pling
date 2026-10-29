import { StrictMode, act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPling, exposePlingState, PlingProvider, usePlingState } from "../src";

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

describe("React 状态暴露（usePlingState）", () => {
  it("注册即可读，且每次快照都重新取值", async () => {
    const pling = createPling({ onWarn: () => {} });
    let setQuery: ((value: string) => void) | undefined;

    function Filters() {
      const [query, update] = useState("foo");
      setQuery = update;
      usePlingState("filters", () => ({ query }), { description: "当前的搜索词" });
      return null;
    }

    await render(<PlingProvider pling={pling}><Filters /></PlingProvider>);
    expect(pling.registry.snapshot().state).toEqual({ filters: { query: "foo" } });
    expect(pling.registry.snapshot().stateViews).toMatchObject([
      { key: "filters", description: "当前的搜索词" },
    ]);

    await act(async () => setQuery?.("bar"));
    expect(pling.registry.snapshot().state).toEqual({ filters: { query: "bar" } });
  });

  it("可以直接给当前值，重渲染后读到新值", async () => {
    const pling = createPling({ onWarn: () => {} });

    function Summary({ count }: { count: number }) {
      usePlingState("summary", { count }, "当前条数");
      return null;
    }

    await render(<PlingProvider pling={pling}><Summary count={3} /></PlingProvider>);
    expect(pling.registry.snapshot().state).toEqual({ summary: { count: 3 } });

    await render(<PlingProvider pling={pling}><Summary count={4} /></PlingProvider>);
    expect(pling.registry.snapshot().state).toEqual({ summary: { count: 4 } });
  });

  it("多组状态按 key 并列；卸载后自动注销", async () => {
    const pling = createPling({ onWarn: () => {} });

    function Panel() {
      usePlingState("a", () => 1);
      usePlingState("b", () => 2, "第二组");
      return <div>panel</div>;
    }

    await render(<PlingProvider pling={pling}><Panel /></PlingProvider>);
    expect(Object.keys(pling.registry.snapshot().state)).toEqual(["a", "b"]);

    await act(async () => root?.unmount());
    root = null;
    expect(pling.registry.snapshot().state).toEqual({});
  });

  it("数组仍走有界序列化，不会把整份数据塞进上下文", async () => {
    const pling = createPling({ onWarn: () => {} });
    const rows = Array.from({ length: 42 }, (_, index) => `SO-${index + 1}`);

    function List() {
      usePlingState("list", () => ({ rows }));
      return null;
    }

    await render(<PlingProvider pling={pling}><List /></PlingProvider>);
    const state = pling.registry.snapshot().state as { list: { rows: unknown[] } };
    expect(state.list.rows).toHaveLength(6);
    expect(state.list.rows[5]).toBe("… (42 items total; showing 5)");
  });

  it("StrictMode 的重复挂载不会留下重复 key", async () => {
    const pling = createPling({ onWarn: () => {} });

    function App() {
      usePlingState("strict", () => "ok");
      return null;
    }

    await render(
      <StrictMode>
        <PlingProvider pling={pling}><App /></PlingProvider>
      </StrictMode>,
    );
    expect(pling.registry.snapshot().state).toEqual({ strict: "ok" });
  });
});

describe("应用级状态（exposePlingState）", () => {
  it("在组件树之外登记，业务组件零改动", () => {
    const pling = createPling({ onWarn: () => {} });
    const store = { status: "all", items: [1, 2, 3] };

    const off = exposePlingState(pling, "list", () => ({
      status: store.status,
      count: store.items.length,
    }), { description: "列表当前的筛选与条数" });

    expect(pling.registry.snapshot().state).toEqual({ list: { status: "all", count: 3 } });
    store.status = "pending";
    store.items = [1];
    expect(pling.registry.snapshot().state).toEqual({ list: { status: "pending", count: 1 } });

    off();
    expect(pling.registry.snapshot().state).toEqual({});
  });

  it("同 key 重复登记会明确报错，而不是悄悄覆盖", () => {
    const pling = createPling({ onWarn: () => {} });
    exposePlingState(pling, "same", () => 1);
    expect(() => exposePlingState(pling, "same", () => 2)).toThrow(/state key 重复/);
  });
});
