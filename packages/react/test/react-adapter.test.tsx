import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling, PlingProvider, useAgentTool, usePlingTool } from "../src";

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

describe("React 适配器", () => {
  it("元素声明进入快照；执行 hook 绑定的 DOM 动作；卸载后注销", async () => {
    const pling = createPling({ onWarn: () => {} });
    const onClick = vi.fn();

    function App() {
      const open = usePlingTool<HTMLButtonElement>({ id: "open_settings", desc: "打开设置面板" });
      return <button ref={open} onClick={onClick}>设置</button>;
    }

    await render(<PlingProvider pling={pling}><App /></PlingProvider>);
    expect(pling.registry.snapshot().actions).toMatchObject([
      { id: "open_settings", primitive: "click", description: "打开设置面板", kind: "write", fidelity: "high" },
    ]);

    await pling.registry.get("open_settings")!.run!({});
    expect(onClick).toHaveBeenCalledOnce();

    await act(async () => root?.unmount());
    root = null;
    expect(pling.registry.snapshot().actions).toHaveLength(0);
  });

  it("受控输入框走同一条 type 原语，React onChange 能收到值", async () => {
    const pling = createPling({ onWarn: () => {} });

    function App() {
      const [text, setText] = useState("");
      const input = usePlingTool<HTMLInputElement>({ id: "task_text", desc: "填写待办内容" });
      return <input ref={input} value={text} onChange={(event) => setText(event.target.value)} />;
    }

    await render(<PlingProvider pling={pling}><App /></PlingProvider>);
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(vi.fn()) });
    let out!: Awaited<ReturnType<typeof executor.execute>>;
    await act(async () => {
      out = await executor.execute("task_text", JSON.stringify({ text: "买牛奶" }));
    });
    expect(out).toMatchObject({ result: { ok: true } });
    expect(document.querySelector("input")!.value).toBe("买牛奶");
  });

  it("disabled 元素不兜底：不进动作清单", async () => {
    const pling = createPling({ onWarn: () => {} });

    function App() {
      const remove = usePlingTool<HTMLButtonElement>({ id: "remove", desc: "删除", kind: "danger" });
      return <button ref={remove} disabled>删除</button>;
    }

    await render(<PlingProvider pling={pling}><App /></PlingProvider>);
    expect(pling.registry.snapshot().actions.map((action) => action.id)).not.toContain("remove");
  });

  it("函数级动作与 DOM 动作共用执行流水线", async () => {
    const pling = createPling({ onWarn: () => {} });
    const approve = vi.fn((args: Record<string, unknown>) => ({ approved: args.id }));

    function App() {
      useAgentTool({
        id: "approve_order",
        desc: "按订单号批准订单",
        kind: "write",
        params: [{ name: "id", label: "订单号" }],
        run: approve,
      });
      return <div>订单</div>;
    }

    await render(<PlingProvider pling={pling}><App /></PlingProvider>);
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(vi.fn()) });
    const out = await executor.execute("approve_order", JSON.stringify({ id: "SO-1" }));
    expect(out).toMatchObject({ result: { ok: true, data: { approved: "SO-1" } } });
    expect(approve).toHaveBeenCalledWith({ id: "SO-1" });
  });

  it("函数级动作的成功判据会进入执行回执", async () => {
    const pling = createPling({ onWarn: () => {} });

    function App() {
      useAgentTool({
        id: "complete_all",
        desc: "完成全部待办",
        kind: "write",
        run: () => ({ completed: 2 }),
        expect: {
          desc: "没有待办仍未完成",
          check: () => true,
        },
      });
      return <div>待办</div>;
    }

    await render(<PlingProvider pling={pling}><App /></PlingProvider>);
    const executor = createExecutor({ registry: pling.registry, policy: createPolicy(vi.fn()) });
    const out = await executor.execute("complete_all", "{}");
    expect(out).toMatchObject({
      result: {
        ok: true,
        data: { completed: 2 },
        expect: "没有待办仍未完成",
      },
    });
  });

  it("声明变化会重注册：模型看到最新说明", async () => {
    const pling = createPling({ onWarn: () => {} });

    function App({ label }: { label: string }) {
      const action = usePlingTool<HTMLButtonElement>({ id: "save", desc: label });
      return <button ref={action}>保存</button>;
    }

    await render(<PlingProvider pling={pling}><App label="保存草稿" /></PlingProvider>);
    expect(pling.registry.snapshot().actions[0]!.description).toBe("保存草稿");
    await render(<PlingProvider pling={pling}><App label="提交订单" /></PlingProvider>);
    expect(pling.registry.snapshot().actions[0]!.description).toBe("提交订单");
  });
});
