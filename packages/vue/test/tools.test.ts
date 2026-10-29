import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { createExecutor, createPolicy, sensitive } from "@plingjs/core";
import { createPling, useAgentTool } from "../src";

/**
 * 函数级动作（S15）：没有 DOM 元素，只有开发者注入的实现。
 *
 * 它和 `v-tool` 共用同一条执行管线 —— 所以这里除了「没有元素」之外，
 * 其余断言（参数、敏感值、确认、生命周期）都应该和元素动作一模一样。
 */

const allowAll = createPolicy(async () => true);

function mountTool(register: () => void, template = "<div />") {
  const pi = createPling(undefined, { onWarn: () => {} });
  const Host = defineComponent({
    template,
    setup() {
      register();
      return {};
    },
  });
  const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
  return { pi, wrapper };
}

describe("useAgentTool：注册", () => {
  it("没有元素也能进动作清单：原语是 call、保真度 high、不产生 unavailable", () => {
    const { pi, wrapper } = mountTool(() => {
      useAgentTool({ id: "sync_crm", desc: "把当前订单同步到 CRM", kind: "write", run: () => undefined });
    });

    const snapshot = pi.registry.snapshot();
    expect(snapshot.actions).toHaveLength(1);
    expect(snapshot.actions[0]).toMatchObject({
      id: "sync_crm",
      primitive: "call",
      description: "把当前订单同步到 CRM",
      kind: "write",
      fidelity: "high",
      source: "declared",
    });
    expect(snapshot.unavailable).toHaveLength(0);

    wrapper.unmount();
  });

  it("desc 是必填：模型只有这一句话能判断工具是干什么的", () => {
    expect(() =>
      mountTool(() => {
        useAgentTool({ id: "bad", desc: "  ", run: () => undefined });
      }),
    ).toThrow(/缺少 desc/);
  });

  it("组件卸载时自动注销；组件外的调用则一直有效，由调用方负责", () => {
    const { pi, wrapper } = mountTool(() => {
      useAgentTool({ id: "temp", desc: "临时工具", run: () => undefined });
    });
    expect(pi.registry.get("temp")).toBeTruthy();

    wrapper.unmount();
    expect(pi.registry.get("temp")).toBeUndefined();
  });
});

describe("useAgentTool：available", () => {
  it("返回字符串 = 原因，原样进快照的 unavailable", () => {
    const pending = ref(0);
    const { pi, wrapper } = mountTool(() => {
      useAgentTool({
        id: "approve_all",
        desc: "批量通过所有待审批订单",
        kind: "write",
        available: () => (pending.value > 0 ? true : "当前没有待审批订单"),
        run: () => ({ approved: pending.value }),
      });
    });

    expect(pi.registry.snapshot().unavailable).toEqual([
      { id: "approve_all", description: "批量通过所有待审批订单", reason: "当前没有待审批订单" },
    ]);

    pending.value = 3;
    expect(pi.registry.snapshot().actions.map((action) => action.id)).toEqual(["approve_all"]);

    wrapper.unmount();
  });

  it("不可用时执行报 ACTION_UNAVAILABLE，并带上原因", async () => {
    const { pi, wrapper } = mountTool(() => {
      useAgentTool({
        id: "approve_all",
        desc: "批量通过所有待审批订单",
        available: () => "当前没有待审批订单",
        run: () => undefined,
      });
    });

    const result = await createExecutor({ registry: pi.registry, policy: allowAll }).execute("approve_all", "{}");
    expect(result).toMatchObject({
      error: { code: "ACTION_UNAVAILABLE", message: expect.stringContaining("当前没有待审批订单") },
    });

    wrapper.unmount();
  });
});

describe("useAgentTool：执行", () => {
  it("run 的返回值经有界序列化后进入回执的 data", async () => {
    const { pi, wrapper } = mountTool(() => {
      useAgentTool({
        id: "export_csv",
        desc: "导出当前筛选结果",
        kind: "read",
        run: () => ({ rows: 42, file: "orders.csv" }),
      });
    });

    const result = await createExecutor({ registry: pi.registry, policy: allowAll }).execute("export_csv", "{}");
    expect(result).toMatchObject({
      result: {
        ok: true,
        action: { id: "export_csv", description: "导出当前筛选结果" },
        data: { rows: 42, file: "orders.csv" },
      },
    });

    wrapper.unmount();
  });

  it("返回 undefined 时回执里不出现 data（和原来的 v-tool 注入完全一致）", async () => {
    const { pi, wrapper } = mountTool(() => {
      useAgentTool({ id: "noop", desc: "什么都不返回", kind: "read", run: () => undefined });
    });

    const result = await createExecutor({ registry: pi.registry, policy: allowAll }).execute("noop", "{}");
    expect(result).toMatchObject({ result: { ok: true } });
    expect((result as { result: Record<string, unknown> }).result).not.toHaveProperty("data");

    wrapper.unmount();
  });

  it("参数校验与敏感值还原走同一条管线：run 拿到的是真值", async () => {
    const seen: Record<string, unknown>[] = [];
    const { pi, wrapper } = mountTool(
      () => {
        useAgentTool({
          id: "call_customer",
          desc: "拨打客户电话",
          kind: "write",
          params: [{ name: "phone", label: "电话号码" }],
          run: (args) => {
            seen.push(args);
            return { dialed: true };
          },
        });
      },
    );

    // 把一个 token 模式的值放进快照，拿到模型会看到的代号
    const phone = sensitive("13800001234", "token");
    pi.registry.declareRecord({ id: "me", fields: { phone } });

    const token = (pi.registry.snapshot().records[0]!.fields as Record<string, string>).phone!;
    expect(token).toMatch(/^\{\{p:[0-9a-z]{7}\}\}$/);

    const result = await createExecutor({ registry: pi.registry, policy: allowAll }).execute(
      "call_customer",
      JSON.stringify({ phone: token }),
    );

    expect(result).toMatchObject({ result: { ok: true, data: { dialed: true } } });
    expect(seen[0]!.phone).toBe("13800001234");
    expect(JSON.stringify(seen).includes("13800001234")).toBe(true);
    expect(JSON.stringify(result).includes("13800001234")).toBe(false);

    wrapper.unmount();
  });

  it("缺少必填参数时不执行 run：INVALID_PARAMS", async () => {
    const run = vi.fn(() => undefined);
    const { pi, wrapper } = mountTool(() => {
      useAgentTool({
        id: "call_customer",
        desc: "拨打客户电话",
        params: [{ name: "phone", label: "电话号码" }],
        run,
      });
    });

    const result = await createExecutor({ registry: pi.registry, policy: allowAll }).execute("call_customer", "{}");
    expect(result).toMatchObject({ error: { code: "INVALID_PARAMS" } });
    expect(run).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("confirm 走确认闸门：拒绝时 run 不执行", async () => {
    const run = vi.fn(() => undefined);
    const confirm = vi.fn(async () => false as const);
    const { pi, wrapper } = mountTool(() => {
      useAgentTool({ id: "sync_crm", desc: "同步到 CRM", kind: "write", confirm: true, run });
    });

    const result = await createExecutor({ registry: pi.registry, policy: createPolicy(confirm) }).execute(
      "sync_crm",
      "{}",
    );

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sync_crm", approval: "ask", description: "同步到 CRM" }),
    );
    expect(result).toMatchObject({ error: { code: "PERMISSION_DENIED" } });
    expect(run).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
