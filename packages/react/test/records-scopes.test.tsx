import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createPortal } from "react-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderPageContext } from "@plingjs/agent";
import { createPling, PlingProvider, usePlingRecord, usePlingScope, usePlingTool } from "../src";

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

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

function Row({ todo }: { todo: Todo }) {
  const record = usePlingRecord(todo);
  const remove = usePlingTool<HTMLButtonElement>({
    id: `remove@${todo.id}`,
    desc: `删除待办：${todo.text}`,
    kind: "danger",
  });
  return (
    <li ref={record}>
      <span>{todo.text}</span>
      <button ref={remove}>删除</button>
    </li>
  );
}

function App({ todos }: { todos: Todo[] }) {
  const page = usePlingScope<HTMLElement>({
    id: "page",
    label: "待办页面",
    description: "今天要做的事",
    role: "main",
  });
  const list = usePlingScope<HTMLUListElement>({
    id: "todos",
    label: "待办列表",
    description: "每一行都是一条待办",
    role: "list",
  });
  return (
    <main ref={page}>
      <ul ref={list}>
        {todos.map((todo) => <Row key={todo.id} todo={todo} />)}
      </ul>
    </main>
  );
}

async function render(node: ReactNode): Promise<void> {
  await act(async () => root!.render(node));
}

describe("React 记录与区域", () => {
  it("区域树与记录进入快照；子动作自动继承最近作用域", async () => {
    const pling = createPling({ onWarn: () => {} });
    await render(
      <PlingProvider pling={pling}>
        <App todos={[{ id: "t1", text: "预约牙医", done: false }]} />
      </PlingProvider>,
    );

    const snapshot = pling.registry.snapshot();
    expect(snapshot.scopes.find((scope) => scope.id === "todos")).toMatchObject({
      label: "待办列表",
      description: "每一行都是一条待办",
      role: "list",
      parent: "page",
      depth: 2,
      active: true,
    });
    expect(snapshot.records).toMatchObject([
      { id: "t1", fields: { text: "预约牙医", done: false }, scope: "todos", source: "declared" },
    ]);
    expect(snapshot.actions.find((action) => action.id === "remove@t1")?.scopePath).toEqual([
      "待办页面",
      "待办列表",
    ]);

    const context = renderPageContext(snapshot);
    expect(context).toContain("待办页面");
    expect(context).toContain("待办列表");
    expect(context).toContain("预约牙医");
  });

  it("记录字段实时读：同一 DOM、同一 id，数据变了快照跟着变", async () => {
    const pling = createPling({ onWarn: () => {} });
    const first = [{ id: "t1", text: "旧标题", done: false }];
    const second = [{ id: "t1", text: "新标题", done: true }];

    await render(<PlingProvider pling={pling}><App todos={first} /></PlingProvider>);
    expect(pling.registry.snapshot().records[0]!.fields).toMatchObject({ text: "旧标题", done: false });

    await render(<PlingProvider pling={pling}><App todos={second} /></PlingProvider>);
    expect(pling.registry.snapshot().records[0]!.fields).toMatchObject({ text: "新标题", done: true });
  });

  it("portal / 弹窗里的动作可以显式指定 scope", async () => {
    const pling = createPling({ onWarn: () => {} });

    function PortalApp() {
      const page = usePlingScope<HTMLElement>({ id: "page", label: "页面", role: "main" });
      const save = usePlingTool<HTMLButtonElement>({ id: "save", desc: "保存", scope: "page" });
      return (
        <main ref={page}>
          {createPortal(<button ref={save}>保存</button>, document.body)}
        </main>
      );
    }

    await render(<PlingProvider pling={pling}><PortalApp /></PlingProvider>);
    expect(pling.registry.snapshot().actions.find((action) => action.id === "save")).toMatchObject({
      scope: "page",
      scopePath: ["页面"],
    });
  });

  it("卸载后区域与记录都注销", async () => {
    const pling = createPling({ onWarn: () => {} });
    await render(
      <PlingProvider pling={pling}>
        <App todos={[{ id: "t1", text: "预约牙医", done: false }]} />
      </PlingProvider>,
    );
    expect(pling.registry.snapshot().records).toHaveLength(1);
    expect(pling.registry.snapshot().scopes).toHaveLength(2);

    await act(async () => root?.unmount());
    root = null;
    expect(pling.registry.snapshot().records).toHaveLength(0);
    expect(pling.registry.snapshot().scopes).toHaveLength(0);
  });
});
