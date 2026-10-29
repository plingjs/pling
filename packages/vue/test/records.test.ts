import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { computed, defineComponent, nextTick, ref } from "vue";
import { createPling } from "../src/directive";
import { normalizeRecordValue } from "../src/record";

/**
 * `v-record`：把 `v-for` 的一行变成模型读得到的记录。
 *
 * 它是**读**：登记的是数据，不是动作 —— 所以这里断言的全是快照里的字段，
 * 没有一个 executed / ACTION_* 的东西。
 */
function setup(template: string, setupFn?: () => Record<string, unknown>, warn?: (message: string) => void) {
  const warnings: string[] = [];
  const pi = createPling(undefined, { onWarn: warn ?? ((message) => warnings.push(message)) });
  const Host = defineComponent({ template, setup: setupFn });
  const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
  return { pi, wrapper, warnings };
}

describe("v-record：行数据", () => {
  it("傻瓜式写法：id 取 row.id，其余字段整行读进去", () => {
    const { pi } = setup(
      `<ul><li v-for="row in rows" :key="row.id" v-record="row" /></ul>`,
      () => ({ rows: [{ id: "SO-1001", customer: "华远科技", amount: 3200 }] }),
    );

    expect(pi.registry.snapshot().records).toEqual([
      { id: "SO-1001", fields: { customer: "华远科技", amount: 3200 }, scope: undefined, source: "declared" },
    ]);
  });

  it("没有 id 时退回 key；数字主键转成字符串", () => {
    const { pi } = setup(
      `<ul><li v-for="row in rows" :key="row.code" v-record="row" /></ul>`,
      () => ({ rows: [{ key: 7, name: "第一个" }] }),
    );
    const records = pi.registry.snapshot().records;
    expect(records[0]!.id).toBe("7");
    expect(records[0]!.fields).toEqual({ name: "第一个" });
  });

  it("完整写法：显式主键 / 说明 / 只暴露几个字段", () => {
    const { pi } = setup(
      `<ul><li v-record="{ data: row, id: row.code, label: '订单 ' + row.code, fields: { 金额: row.amount } }" /></ul>`,
      () => ({ row: { code: "A-1", amount: 9, 内部字段: "不该给模型看" } }),
    );
    const record = pi.registry.snapshot().records[0]!;
    expect(record.id).toBe("A-1");
    expect(record.label).toBe("订单 A-1");
    expect(record.fields).toEqual({ 金额: 9 });
  });

  it("继承 v-scope 的作用域：区域不活跃时进不了快照", () => {
    const { pi } = setup(
      `<div v-scope="{ id: 'orders', label: '订单列表' }"><ul><li v-record="row" /></ul></div>`,
      () => ({ row: { id: "SO-1001", amount: 1 } }),
    );
    // 没有 IntersectionObserver 的环境默认「都可见」（jsdom 就是），这里手动把它推出视口
    pi.scopes.setScopeInView("orders", false);
    expect(pi.registry.snapshot().records).toEqual([]);
    expect(pi.registry.snapshot().recordsTotal).toBe(1);

    pi.scopes.setScopeInView("orders", true);
    expect(pi.registry.snapshot().records[0]).toMatchObject({ id: "SO-1001", scope: "orders" });
  });

  it("数据变了：字段跟着变，不重新登记（不制造无谓的变更通知）", async () => {
    const amount = ref(100);
    const { pi } = setup(`<ul><li v-record="row" /></ul>`, () => ({
      row: { id: "SO-1001", amount },
    }));

    const onChange = vi.fn();
    pi.registry.onChange(onChange);
    amount.value = 200;
    await nextTick();

    expect(pi.registry.snapshot().records[0]!.fields).toEqual({ amount: 200 });
    expect(onChange).not.toHaveBeenCalled(); // 数据是实时读的，注册没动
  });

  it("换了一行（同一个 DOM 元素换数据）：主键变了就重新登记", async () => {
    const row = ref({ id: "SO-1001", amount: 1 });
    const { pi } = setup(`<ul><li v-record="row" /></ul>`, () => ({ row }));

    row.value = { id: "SO-1002", amount: 2 };
    await nextTick();

    expect(pi.registry.snapshot().records.map((record) => record.id)).toEqual(["SO-1002"]);
  });

  it("卸载：记录跟着消失", async () => {
    const show = ref(true);
    const { pi, wrapper } = setup(`<ul><li v-if="show" v-record="row" /></ul>`, () => ({
      show,
      row: { id: "SO-1001" },
    }));

    expect(pi.registry.snapshot().records).toHaveLength(1);
    show.value = false;
    await nextTick();
    expect(pi.registry.snapshot().records).toEqual([]);
    expect(wrapper.find("li").exists()).toBe(false);
  });

  it("顺序 = 页面上的顺序：Vue 批量挂载把登记顺序打乱时，快照按 DOM 位置排", async () => {
    const { pi, wrapper } = setup(
      `<ul><li v-for="row in filtered" :key="row.id" v-record="row">{{ row.id }}</li></ul>`,
      () => {
        const rows = ["t1", "t2", "t3", "t4", "t5", "t6"].map((id) => ({ id }));
        const query = ref("");
        const filtered = computed(() => rows.filter((row) => row.id.includes(query.value)));
        return { query, filtered };
      },
    );
    const ids = () => pi.registry.snapshot().records.map((record) => record.id);
    expect(ids()).toEqual(["t1", "t2", "t3", "t4", "t5", "t6"]);

    // 搜索收窄到一条，再放开：这几行会被重新挂载 —— Vue 是倒着创建它们的
    wrapper.vm.query = "t4";
    await nextTick();
    expect(ids()).toEqual(["t4"]);
    wrapper.vm.query = "";
    await nextTick();

    // 用户看到的顺序才是模型该看到的顺序（不然「第一条是 X」会说错）
    expect(ids()).toEqual(["t1", "t2", "t3", "t4", "t5", "t6"]);
  });

  it("没有主键：开发期告警，不登记（读不出来就说清楚，不能编）", () => {
    const { pi, warnings } = setup(`<ul><li v-record="row" /></ul>`, () => ({ row: { amount: 1 } }));
    expect(pi.registry.snapshot().records).toEqual([]);
    expect(warnings.join("\n")).toContain("没有主键");
  });

  it("取值不是对象：告警，不崩", () => {
    const { pi, warnings } = setup(`<ul><li v-record="'不是对象'" /></ul>`);
    expect(pi.registry.snapshot().records).toEqual([]);
    expect(warnings.join("\n")).toContain("需要一个对象");
  });

  it("纯归一化函数：不依赖 Vue，可单独测（三种输入各自的行为）", () => {
    expect(normalizeRecordValue({ id: "a", b: 1 })).toEqual({ record: { id: "a", fields: { b: 1 } } });
    expect(normalizeRecordValue({ data: { code: "c" }, id: "X", label: "L", fields: { f: 1 } })).toEqual({
      record: { id: "X", label: "L", fields: { f: 1 } },
    });
    expect(normalizeRecordValue({ nope: 1 }).record).toBeNull();
    expect(normalizeRecordValue(null).problem).toContain("需要一个对象");
  });
});
