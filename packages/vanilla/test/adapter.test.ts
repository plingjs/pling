import { afterEach, describe, expect, it, vi } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createDeriver, markRecordElement } from "@plingjs/dom";
import { createPling } from "../src";

afterEach(() => {
  document.body.innerHTML = "";
});

function mountButton(label: string): { host: HTMLDivElement; button: HTMLButtonElement } {
  const host = document.createElement("div");
  const button = document.createElement("button");
  button.textContent = label;
  host.append(button);
  document.body.append(host);
  return { host, button };
}

const allowAll = () => createPolicy(vi.fn(async () => true));

describe("@plingjs/vanilla", () => {
  it("普通 DOM 元素声明成动作；执行走同一条 click 原语；返回函数可解绑", async () => {
    const { button } = mountButton("设置");
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    const pling = createPling({ onWarn: () => {} });

    const unbind = pling.tool(button, { id: "open_settings", desc: "打开设置面板" });
    expect(pling.registry.snapshot().actions).toMatchObject([
      { id: "open_settings", primitive: "click", description: "打开设置面板", kind: "write", fidelity: "high" },
    ]);

    const out = await createExecutor({ registry: pling.registry, policy: allowAll() }).execute("open_settings", "{}");
    expect(out).toMatchObject({ result: { ok: true } });
    expect(onClick).toHaveBeenCalledOnce();

    unbind();
    expect(pling.registry.snapshot().actions).toHaveLength(0);
    pling.destroy();
  });

  it("输入框的 fill 声明会写值并派发 input 事件", async () => {
    const input = document.createElement("input");
    document.body.append(input);
    const onInput = vi.fn();
    input.addEventListener("input", onInput);
    const pling = createPling({ onWarn: () => {} });

    pling.tool(input, {
      id: "composer_text",
      desc: "填写待办内容",
      action: "fill",
      params: [{ name: "text", label: "待办内容" }],
    });

    const out = await createExecutor({ registry: pling.registry, policy: allowAll() }).execute(
      "composer_text",
      JSON.stringify({ text: "写周报" }),
    );
    expect(out).toMatchObject({ result: { ok: true } });
    expect(input.value).toBe("写周报");
    expect(onInput).toHaveBeenCalled();
    pling.destroy();
  });

  it("record 让模型读到实时字段；scope 提供父级与页面顺序", () => {
    const list = document.createElement("ul");
    const row = document.createElement("li");
    list.append(row);
    document.body.append(list);
    const todo = { id: "t1", text: "买牛奶", done: false };
    const pling = createPling({ onWarn: () => {} });

    pling.scope(list, { id: "todos", label: "待办列表", role: "list" });
    pling.setActiveScopes(["todos"]);
    pling.record(row, { data: todo, label: "待办：买牛奶" });

    expect(pling.registry.snapshot()).toMatchObject({
      records: [{ id: "t1", label: "待办：买牛奶", fields: { text: "买牛奶", done: false } }],
      recordsTotal: 1,
    });

    todo.text = "买燕麦奶";
    todo.done = true;
    expect(pling.registry.snapshot().records[0]).toMatchObject({
      fields: { text: "买燕麦奶", done: true },
    });
    pling.destroy();
  });

  it("只读状态每次快照重读；函数动作和 DOM 动作共用执行流水线", async () => {
    const pling = createPling({ onWarn: () => {} });
    let count = 0;
    const approve = vi.fn((args: Record<string, unknown>) => ({ approved: args.id }));

    pling.state("todo", () => ({ count }), { description: "当前条数" });
    pling.action({
      id: "approve_order",
      desc: "按订单号批准订单",
      kind: "write",
      params: [{ name: "id", label: "订单号" }],
      run: approve,
    });

    expect(pling.registry.snapshot().state).toEqual({ todo: { count: 0 } });
    count = 3;
    expect(pling.registry.snapshot().state).toEqual({ todo: { count: 3 } });

    const out = await createExecutor({ registry: pling.registry, policy: allowAll() }).execute(
      "approve_order",
      JSON.stringify({ id: "SO-1" }),
    );
    expect(out).toMatchObject({ result: { ok: true, data: { approved: "SO-1" } } });
    expect(approve).toHaveBeenCalledWith({ id: "SO-1" });
    pling.destroy();
  });

  it("显式 tool 覆盖 L1 派生：同一元素只留开发者声明的 id", () => {
    const { host, button } = mountButton("保存");
    const pling = createPling({ onWarn: () => {} });
    pling.tool(button, { id: "save_draft", desc: "保存草稿" });

    const deriver = createDeriver(pling.registry, pling.scopes, { root: host });
    expect(deriver.ids()).toEqual([]);
    expect(pling.registry.snapshot().actions.map((action) => action.id)).toEqual(["save_draft"]);
    deriver.stop();
    pling.destroy();
  });

  it("DOM 先于 createPling 存在时，显式声明仍能接管已派生的按钮且不撞 id", () => {
    const { host, button } = mountButton("保存");
    const pling = createPling({ derive: { root: host, observe: false }, onWarn: () => {} });
    expect(pling.derived()?.ids()).toEqual(["save"]);

    const unbind = pling.tool(button, { id: "save_draft", desc: "保存草稿" });
    expect(pling.derived()?.ids()).toEqual([]);
    expect(pling.registry.snapshot().actions.map((action) => action.id)).toEqual(["save_draft"]);

    unbind();
    expect(pling.derived()?.ids()).toEqual(["save"]);
    pling.destroy();
  });

  it("createPling({ derive }) 能把记录行身份带进派生 id，并执行真实点击", async () => {
    const list = document.createElement("ul");
    const row = document.createElement("li");
    const remove = document.createElement("button");
    remove.setAttribute("aria-label", "删除");
    row.append(remove);
    list.append(row);
    document.body.append(list);
    markRecordElement(row, "t1");

    const onClick = vi.fn();
    remove.addEventListener("click", onClick);
    const pling = createPling({ derive: { root: list, observe: false }, onWarn: () => {} });
    expect(pling.derived()?.ids()).toEqual(["remove@t1"]);

    const out = await createExecutor({ registry: pling.registry, policy: allowAll() }).execute("remove@t1", "{}");
    expect(out).toMatchObject({ result: { ok: true } });
    expect(onClick).toHaveBeenCalledOnce();
    pling.destroy();
  });

  it("destroy 会注销动作、记录、状态与区域探索动作", () => {
    const { button } = mountButton("保存");
    const pling = createPling({ onWarn: () => {} });
    pling.tool(button, { id: "save", desc: "保存" });
    pling.record(button, { data: { id: "r1", value: 1 } });
    pling.state("debug", () => ({ ok: true }));
    pling.scope(document.body, { id: "page", label: "页面" });

    expect(pling.registry.snapshot().actions.length).toBeGreaterThan(0);
    pling.destroy();

    const after = pling.registry.snapshot();
    expect(after.actions).toHaveLength(0);
    expect(after.recordsTotal).toBe(0);
    expect(after.state).toEqual({});
  });
});
