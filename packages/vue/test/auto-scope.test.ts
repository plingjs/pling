import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPolicy, createRuntime, type Runtime } from "@plingjs/core";
import { createPling } from "../src/directive";
import ScopedList from "./fixtures/ScopedList.vue";
import { FakeIntersectionObserver } from "./helpers/fake-io";

/** 固定 42 行数据，便于断言 */
const ROWS = Array.from({ length: 42 }, (_, i) => `SO-${1000 + i + 1}`);

function setup(): {
  pi: ReturnType<typeof createPling>;
  wrapper: VueWrapper;
  runtime: Runtime;
} {
  const pi = createPling(undefined, { onWarn: () => {} });
  const wrapper = mount(ScopedList, {
    attachTo: document.body,
    props: { rows: ROWS },
    global: { plugins: [pi.plugin] },
  });
  const runtime = createRuntime({
    registry: pi.registry,
    policy: createPolicy(async () => true), // 演示面板：自动批准
    llm: async () => ({ content: "" }),
  });
  return { pi, wrapper, runtime };
}

const wrapOf = (wrapper: VueWrapper): Element => wrapper.get(".table-wrap").element;
/** 渲染出的行顺序（表格是按金额排序的，不是按订单号） */
const rowOrders = (wrapper: VueWrapper): string[] =>
  wrapper.findAll("tr[data-order]").map((row) => row.element.getAttribute("data-order")!);
/** 第 [from, to) 行的操作按钮 */
const rowButtons = (wrapper: VueWrapper, from: number, to: number): Element[] =>
  wrapper
    .findAll("tr[data-order]")
    .slice(from, to)
    .flatMap((row) => Array.from(row.element.querySelectorAll("button")));

const containerObserver = (wrapper: VueWrapper): FakeIntersectionObserver => {
  const found = FakeIntersectionObserver.instances.find((io) => io.root === wrapOf(wrapper));
  if (!found) throw new Error("没有找到以作用域容器为 root 的观察器");
  return found;
};
const pageObserver = (wrapper: VueWrapper): FakeIntersectionObserver => {
  const found = FakeIntersectionObserver.instances.find((io) => io.root === null && io.targets.has(wrapOf(wrapper)));
  if (!found) throw new Error("没有找到观察作用域容器是否进入页面视口的观察器");
  return found;
};
const scopeOf = (pi: ReturnType<typeof createPling>): { total: number; visible: number; hasMore: boolean; explore: string[] } =>
  pi.registry.snapshot().scopes.find((scope) => scope.id === "rows")!;

beforeEach(() => {
  FakeIntersectionObserver.install();
  document.body.innerHTML = "";
});
afterEach(() => {
  vi.unstubAllGlobals();
  FakeIntersectionObserver.reset();
});

describe("自动作用域：容器声明 + 子元素继承", () => {
  it("v-scope 容器内的 v-tool 自动继承作用域，无需逐个写 scope", () => {
    const { pi, wrapper } = setup();

    const rowActions = pi.registry
      .snapshot()
      .actions.filter((action) => action.id.startsWith("approve@") || action.id.startsWith("remove@"));
    expect(rowActions.length).toBeGreaterThan(0);
    expect(rowActions.every((action) => action.scope === "rows")).toBe(true);

    wrapper.unmount();
  });
});

describe("自动裁剪：可见性决定暴露范围", () => {
  it("容器在视口内 + 只有前 10 行可见 → 只暴露这 10 行的行内动作，其余计入 total", () => {
    const { pi, wrapper } = setup();
    pageObserver(wrapper).showAll();
    containerObserver(wrapper).sync(rowButtons(wrapper, 0, 10));

    const orders = rowOrders(wrapper);
    const snapshot = pi.registry.snapshot();
    const exposed = snapshot.actions.filter((action) => action.id.startsWith("approve@")).map((action) => action.id);

    expect(exposed).toEqual(orders.slice(0, 10).map((id) => `approve@order:${id}`));
    // 42 行 × 2 + 4 个全局动作 + 1 个此刻可用的探索动作（reveal 因容器在视口内而不可用）
    expect(snapshot.total).toBe(89);
    expect(snapshot.actions.length).toBe(4 + 1 + 20);

    wrapper.unmount();
  });

  it("快照元信息告诉模型「还有更多」以及「怎么找」", () => {
    const { pi, wrapper } = setup();
    pageObserver(wrapper).showAll();
    containerObserver(wrapper).sync(rowButtons(wrapper, 0, 10));

    const orders = scopeOf(pi);
    expect(orders.total).toBe(84);
    expect(orders.visible).toBe(20);
    expect(orders.hasMore).toBe(true);
    expect(orders.explore).toContain("pling_scroll_rows");
    expect(orders.explore).not.toContain("pling_reveal_rows"); // 容器就在视口里

    wrapper.unmount();
  });

  it("全部条目都进入可见区后，滚动探索动作自动消失", () => {
    const { pi, wrapper } = setup();
    pageObserver(wrapper).showAll();
    containerObserver(wrapper).showAll();

    expect(scopeOf(pi)).toMatchObject({ total: 84, visible: 84, hasMore: false, explore: [] });
    expect(pi.registry.snapshot().actions.map((a) => a.id)).not.toContain("pling_scroll_rows");

    wrapper.unmount();
  });

  it("容器滚出页面视口 → 行内动作全部收回，只剩「把页面滚过去」的探索动作", () => {
    const { pi, wrapper } = setup();
    pageObserver(wrapper).showAll();
    containerObserver(wrapper).sync(rowButtons(wrapper, 0, 10));

    pageObserver(wrapper).sync([]); // 容器不在页面视口内

    const snapshot = pi.registry.snapshot();
    expect(snapshot.actions.some((action) => action.id.startsWith("approve@"))).toBe(false);
    expect(scopeOf(pi)).toMatchObject({ visible: 0, hasMore: true });
    expect(scopeOf(pi).explore).toContain("pling_reveal_rows");
    expect(scopeOf(pi).explore).not.toContain("pling_scroll_rows");

    wrapper.unmount();
  });
});

describe("探索闭环：目标不在可见区 → 滚动 → 出现 → 操作成功", () => {
  it("agent 找不到目标订单时，靠 hasMore + 滚动动作把它带进可见区再操作", async () => {
    const { pi, wrapper, runtime } = setup();
    const wrap = wrapOf(wrapper) as HTMLElement;
    const scrollBy = vi.fn();
    Object.defineProperty(wrap, "scrollBy", { value: scrollBy, configurable: true, writable: true });

    pageObserver(wrapper).showAll();
    containerObserver(wrapper).sync(rowButtons(wrapper, 0, 10));

    const orders = rowOrders(wrapper);
    const target = orders[10]!; // 第二屏的第一条
    const targetId = `approve@order:${target}`;

    // 第一屏：目标动作不可见，但快照告诉你还有内容 + 有探索手段
    expect(pi.registry.snapshot().actions.map((a) => a.id)).not.toContain(targetId);
    expect(scopeOf(pi).hasMore).toBe(true);

    // 调探索动作：滚动容器
    expect(await runtime.execute("pling_scroll_rows", JSON.stringify({ direction: "next" }))).toMatchObject({
      result: { ok: true },
    });
    expect(scrollBy).toHaveBeenCalledOnce();

    // 滚动后第二屏进入可见区（真实环境由 IntersectionObserver 回调完成）
    containerObserver(wrapper).sync(rowButtons(wrapper, 10, 20));
    expect(pi.registry.snapshot().actions.map((a) => a.id)).toContain(targetId);

    // 目标出现 → 操作成功
    expect(await runtime.execute(targetId, "{}")).toMatchObject({ result: { ok: true } });
    const row = wrapper.findAll("tr[data-order]").find((r) => r.element.getAttribute("data-order") === target)!;
    expect(row.text()).toContain("已通过");

    wrapper.unmount();
  });

  it("目标根本不在页面视口时，先用 reveal 把页面滚过去", async () => {
    const { pi, wrapper, runtime } = setup();
    const wrap = wrapOf(wrapper) as HTMLElement;
    const scrollIntoView = vi.fn();
    Object.defineProperty(wrap, "scrollIntoView", { value: scrollIntoView, configurable: true, writable: true });

    pageObserver(wrapper).sync([]);

    expect(await runtime.execute("pling_reveal_rows", "{}")).toMatchObject({ result: { ok: true } });
    expect(scrollIntoView).toHaveBeenCalledOnce();

    // 页面滚过去之后，容器进入视口、行内动作重新出现
    pageObserver(wrapper).showAll();
    containerObserver(wrapper).sync(rowButtons(wrapper, 0, 10));
    expect(pi.registry.snapshot().actions.filter((a) => a.id.startsWith("approve@"))).toHaveLength(10);

    wrapper.unmount();
  });
});

describe("没有 IntersectionObserver 的环境", () => {
  it("退化为「全部可见」，不会误藏动作（可见性 fail-open，声明 fail-closed）", () => {
    vi.unstubAllGlobals(); // 去掉假观察器，模拟 jsdom / 老浏览器
    const { pi, wrapper } = setup();
    const snapshot = pi.registry.snapshot();

    expect(snapshot.actions.filter((a) => a.id.startsWith("approve@"))).toHaveLength(42);
    expect(snapshot.scopes.find((s) => s.id === "rows")).toMatchObject({ total: 84, visible: 84, hasMore: false });

    wrapper.unmount();
  });
});
