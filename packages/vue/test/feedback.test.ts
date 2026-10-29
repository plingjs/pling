import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { createRegistry } from "@plingjs/core";
import { createPling } from "../src/directive";

function setup(
  template: string,
  setupFn?: () => Record<string, unknown>,
  options: { namespace?: string; registry?: ReturnType<typeof createRegistry> } = {},
) {
  const warnings: string[] = [];
  const pi = createPling({
    onWarn: (message) => warnings.push(message),
    ...options,
  });
  const Host = defineComponent({ template, setup: setupFn });
  const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
  return { pi, wrapper, warnings };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("v-feedback：显式页面反馈", () => {
  it("字符串写法：一条 error，自动生成稳定 id", () => {
    const { pi } = setup(`<div v-feedback="'客户不能为空'" />`);
    const feedback = pi.registry.snapshot().feedback;
    expect(feedback).toHaveLength(1);
    expect(feedback[0]).toMatchObject({ message: "客户不能为空", severity: "error", source: "declared" });
    expect(feedback[0]!.id).toMatch(/^feedback_/);
  });

  it("对象写法：字段 / 级别 / 显式 id，并自动继承最近区域", () => {
    const { pi } = setup(
      `<div v-scope="{ id: 'form', label: '新建订单' }">
         <p v-feedback="{ id: 'customer_required', message: '客户不能为空', field: 'customer', severity: 'error' }" />
       </div>`,
    );
    expect(pi.registry.snapshot().feedback[0]).toMatchObject({
      id: "customer_required",
      message: "客户不能为空",
      field: "customer",
      severity: "error",
      scope: "form",
      scopePath: ["新建订单"],
    });
  });

  it("namespace：反馈 id 与 scope 自动落成本岛完整身份", () => {
    const base = createRegistry();
    const { pi } = setup(
      `<div v-scope="{ id: 'form', label: '左表单' }">
         <p v-feedback="{ id: 'required', message: '客户不能为空', field: 'customer' }" />
       </div>`,
      undefined,
      { namespace: "left", registry: base },
    );
    expect(pi.registry.snapshot().feedback[0]).toMatchObject({
      id: "left/required",
      scope: "left/form",
      scopePath: ["左表单"],
    });
    expect(base.snapshot().feedback[0]?.id).toBe("left/required");
  });

  it("文案变化：快照跟着变；空值表示此刻没有反馈", async () => {
    const error = ref("客户不能为空");
    const { pi } = setup(`<p v-feedback="{ message: error, field: 'customer' }" />`, () => ({ error }));
    expect(pi.registry.snapshot().feedback[0]!.message).toBe("客户不能为空");

    error.value = "";
    await nextTick();
    expect(pi.registry.snapshot().feedback).toEqual([]);

    error.value = "客户名称过长";
    await nextTick();
    expect(pi.registry.snapshot().feedback[0]!.message).toBe("客户名称过长");
  });

  it("数组写法：一次声明多条反馈", () => {
    const { pi } = setup(
      `<div v-feedback="[{ id: 'a', message: '客户不能为空', field: 'customer' }, { id: 'b', message: '金额必须大于 0', field: 'amount' }]" />`,
    );
    expect(pi.registry.snapshot().feedback.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("卸载：反馈跟着消失", async () => {
    const show = ref(true);
    const { pi } = setup(`<p v-if="show" v-feedback="'客户不能为空'" />`, () => ({ show }));
    expect(pi.registry.snapshot().feedback).toHaveLength(1);
    show.value = false;
    await nextTick();
    expect(pi.registry.snapshot().feedback).toEqual([]);
  });
});

describe("ARIA 自动收集：只认明确的语义", () => {
  it("role=alert / role=status / aria-live 都会进快照", async () => {
    const { pi } = setup(
      `<div>
         <p role="alert">保存失败，请重试</p>
         <p role="status">已保存</p>
         <p aria-live="assertive">库存不足</p>
       </div>`,
    );
    pi.feedback.sync();
    const feedback = pi.registry.snapshot().feedback;
    expect(feedback.map((item) => [item.message, item.severity, item.source])).toEqual([
      ["保存失败，请重试", "error", "aria"],
      ["已保存", "info", "aria"],
      ["库存不足", "warning", "aria"],
    ]);
  });

  it("aria-invalid=true：从 label / aria-errormessage 得到字段和原因", () => {
    const { pi } = setup(
      `<form>
         <label for="customer">客户</label>
         <input id="customer" aria-invalid="true" aria-errormessage="customer-error" />
         <p id="customer-error">客户不能为空</p>
       </form>`,
    );
    pi.feedback.sync();
    expect(pi.registry.snapshot().feedback[0]).toMatchObject({
      field: "客户",
      message: "客户不能为空",
      severity: "error",
      source: "aria",
    });
  });

  it("动态出现 / 消失：MutationObserver 同步（也会随 sync 立即同步）", async () => {
    const show = ref(true);
    const { pi } = setup(`<div><p v-if="show" role="alert">导出失败</p></div>`, () => ({ show }));
    await nextTick();
    pi.feedback.sync();
    expect(pi.registry.snapshot().feedback).toHaveLength(1);

    show.value = false;
    await nextTick();
    pi.feedback.sync();
    expect(pi.registry.snapshot().feedback).toEqual([]);
  });

  it("stop() 后重新 start()，观察器仍然有效", async () => {
    const { pi } = setup(`<div></div>`);
    pi.feedback.stop();
    pi.feedback.start();

    const alert = document.createElement("p");
    alert.setAttribute("role", "alert");
    alert.textContent = "重新连接后的错误";
    document.body.append(alert);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(pi.registry.snapshot().feedback.map((item) => item.message)).toContain("重新连接后的错误");
  });

  it("不按 class 猜；框架自己的界面不收集", () => {
    const { pi } = setup(
      `<div>
         <p class="error toast">这只是 CSS class</p>
         <div data-pling-ui><p role="alert">框架自己的提示</p></div>
       </div>`,
    );
    pi.feedback.sync();
    expect(pi.registry.snapshot().feedback).toEqual([]);
  });

  it("销毁 Pling：自动收集的反馈一起撤掉", () => {
    const { pi, wrapper } = setup(`<p role="alert">保存失败</p>`);
    pi.feedback.sync();
    expect(pi.registry.snapshot().feedback).toHaveLength(1);
    wrapper.unmount();
    pi.destroy();
    expect(pi.registry.snapshot().feedback).toEqual([]);
  });
});

describe("反馈文案是页面数据，不是动作", () => {
  it("不会生成任何可执行动作", () => {
    const { pi } = setup(`<p v-feedback="'客户不能为空'" role="alert">客户不能为空</p>`);
    expect(pi.registry.snapshot().actions).toEqual([]);
    expect(pi.registry.snapshot().feedback.length).toBeGreaterThanOrEqual(1);
  });

  it("重复的显式 + ARIA 反馈按字段和消息去重", () => {
    const { pi } = setup(
      `<div><input aria-label="客户" aria-invalid="true" /><p role="alert" data-pling-field="客户">客户不能为空</p></div>`,
    );
    // aria-invalid 的兜底消息是框架生成的英文（模型可见），显式提示保持页面原文。
    pi.feedback.sync();
    expect(pi.registry.snapshot().feedback.map((item) => item.message).sort()).toEqual(
      ["Invalid value for 客户", "客户不能为空"].sort(),
    );
  });
});
