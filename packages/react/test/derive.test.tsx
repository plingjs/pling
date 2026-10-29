import { StrictMode, act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPling, PlingProvider, usePlingRecord, usePlingTool } from "../src";

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

/** 等 MutationObserver 的微任务批次落地；测试里不靠 rAF，避免 jsdom 时序不确定。 */
async function flushDerive(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

interface Item {
  id: string;
  text: string;
  done: boolean;
}

const INITIAL: Item[] = [
  { id: "t1", text: "买牛奶", done: false },
  { id: "t2", text: "预约牙医", done: false },
];

function Row({ item, onToggle, onRemove }: {
  item: Item;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const record = usePlingRecord(item);
  return (
    <li ref={record}>
      <span>{item.text}</span>
      <button onClick={() => onToggle(item.id)}>标记完成</button>
      <button onClick={() => onRemove(item.id)}>删除</button>
    </li>
  );
}

function DerivedTodo() {
  const [items, setItems] = useState(INITIAL);
  return (
    <section>
      <ul>
        {items.map((item) => (
          <Row
            key={item.id}
            item={item}
            onToggle={(id) => setItems((current) => current.map((row) => row.id === id ? { ...row, done: !row.done } : row))}
            onRemove={(id) => setItems((current) => current.filter((row) => row.id !== id))}
          />
        ))}
      </ul>
      <button onClick={() => setItems([])}>清空列表</button>
      <div data-pling-ignore><button>演示控制台</button></div>
    </section>
  );
}

describe("React L1 自动派生", () => {
  it("原生按钮被派生：行身份进 id、来源可辨、危险文案标 danger", async () => {
    const pling = createPling({ derive: true, onWarn: () => {} });
    await render(<PlingProvider pling={pling}><DerivedTodo /></PlingProvider>);
    await flushDerive();

    expect(pling.derived()!.ids()).toEqual([
      "complete@t1", "remove@t1",
      "complete@t2", "remove@t2",
      "clear",
    ]);
    expect(pling.registry.snapshot().actions.find((action) => action.id === "remove@t1")).toMatchObject({
      primitive: "click",
      description: 'Click "删除"',
      source: "derived",
      kind: "danger",
      fidelity: "high",
    });
    expect(pling.registry.snapshot().actions.find((action) => action.id === "complete@t1")).toMatchObject({
      source: "derived",
      kind: "write",
    });

    const ignored = Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "演示控制台")!;
    expect(ignored.getAttribute("data-pling-derived")).toBeNull();
  });

  it("执行派生动作和用户点按钮走同一条路径，React 状态真的变化", async () => {
    const pling = createPling({ derive: true, onWarn: () => {} });
    await render(<PlingProvider pling={pling}><DerivedTodo /></PlingProvider>);
    await flushDerive();

    await act(async () => {
      await pling.registry.get("remove@t1")!.run!({});
    });
    await flushDerive();
    expect(document.body.textContent).not.toContain("买牛奶");
    expect(document.querySelectorAll("li")).toHaveLength(1);

    await act(async () => {
      await pling.registry.get("complete@t2")!.run!({});
    });
    expect((pling.registry.snapshot().records.find((record) => record.id === "t2")?.fields as { done: boolean }).done).toBe(true);
  });

  it("显式 usePlingTool 永远覆盖派生：同一按钮只留开发者声明", async () => {
    const pling = createPling({ derive: true, onWarn: () => {} });
    function App() {
      const remove = usePlingTool<HTMLButtonElement>({ id: "declared_remove", desc: "删除当前记录", kind: "danger" });
      return <button ref={remove}>删除</button>;
    }
    await render(<PlingProvider pling={pling}><App /></PlingProvider>);
    await flushDerive();

    expect(pling.derived()!.ids()).toEqual([]);
    expect(pling.registry.snapshot().actions).toMatchObject([
      { id: "declared_remove", source: "declared", kind: "danger" },
    ]);
    expect(document.querySelector("button")!.getAttribute("data-pling-derived")).toBeNull();
  });

  it("动态出现的按钮会被后续扫描接住：编辑 → 保存", async () => {
    const pling = createPling({ derive: true, onWarn: () => {} });
    function App() {
      const [editing, setEditing] = useState(false);
      const [saved, setSaved] = useState(false);
      return (
        <div>
          <button onClick={() => setEditing(true)}>编辑</button>
          {editing && <button onClick={() => setSaved(true)}>保存</button>}
          {saved && <span>已保存</span>}
        </div>
      );
    }
    await render(<PlingProvider pling={pling}><App /></PlingProvider>);
    await flushDerive();
    expect(pling.derived()!.ids()).toEqual(["edit"]);

    await act(async () => {
      await pling.registry.get("edit")!.run!({});
    });
    await flushDerive();
    expect(pling.derived()!.ids()).toEqual(["edit", "save"]);

    await act(async () => {
      await pling.registry.get("save")!.run!({});
    });
    expect(document.body.textContent).toContain("已保存");
  });

  it("StrictMode 的重复挂载不会留下重复派生动作；destroy 会清掉记号", async () => {
    const pling = createPling({ derive: true, onWarn: () => {} });
    function App() {
      return <button>保存</button>;
    }
    await render(
      <StrictMode>
        <PlingProvider pling={pling}><App /></PlingProvider>
      </StrictMode>,
    );
    await flushDerive();

    expect(pling.registry.snapshot().actions.filter((action) => action.id === "save")).toHaveLength(1);
    const button = document.querySelector("button")!;
    expect(button.getAttribute("data-pling-derived")).toBe("save");

    pling.destroy();
    expect(pling.registry.snapshot().actions).toHaveLength(0);
    expect(button.getAttribute("data-pling-derived")).toBeNull();
  });
});
