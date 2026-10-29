import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, ref, type Ref } from "vue";
import { createExecutor } from "@plingjs/core";
import { createPolicy } from "@plingjs/core";
import { createPling } from "../src/directive";

/**
 * 期望（S4）在 Vue 适配器里的两件事：
 *   1. `v-tool` 里写的 `expect` 要原样交给执行流水线（它不在 descriptor 里，模型看不到）；
 *   2. 注入的 `run` 可以是异步的，**框架必须 await 它** —— 否则「提交接口」这类
 *      写了 `await` 的 run 会被当成同步的，框架在它还没做完时就去取快照。
 */

const allowAll = createPolicy(async () => true);
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("v-tool：expect（S4）", () => {
  it("声明里的 expect 被接进 binding（不进 descriptor：模型不需要知道）", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const done = ref(false);
    const Host = defineComponent({
      template: `<button v-tool="tool">提交</button>`,
      setup: () => ({
        done,
        tool: {
          id: "submit",
          desc: "提交订单",
          expect: { desc: "订单出现在列表里", check: () => done.value },
        },
      }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    const binding = pi.registry.get("submit")!;
    expect(binding.expect?.desc).toBe("订单出现在列表里");
    expect(typeof binding.expect?.check).toBe("function");
    // descriptor 是给模型看的那一份，不该混进运行时的判据
    expect(pi.registry.snapshot().actions[0]).not.toHaveProperty("expect");

    wrapper.unmount();
  });

  it("注入的 run 是异步的 → binding.run 会等它做完", async () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    let landed = false;
    const Host = defineComponent({
      template: `<button v-tool="tool">提交</button>`,
      setup: () => ({
        tool: {
          id: "submit",
          desc: "提交订单",
          run: async () => {
            await sleep(20);
            landed = true;
          },
        },
      }),
    });
    const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });

    await pi.registry.get("submit")!.run!({});
    // 关键断言：await 之后就已经落地了。S4 之前这里会是 false（run 没被 await）
    expect(landed).toBe(true);

    wrapper.unmount();
  });

  it("端到端：Vue 里「点了就走、20ms 后才渲染」的动作，有 expect 才能被 diff 看见", async () => {
    async function run(
      build?: (context: { rows: Ref<string[]> }) => Record<string, unknown>,
    ): Promise<{ expect?: string; changed?: { observed: boolean } }> {
      const pi = createPling(undefined, { onWarn: () => {} });
      const rows = ref<string[]>([]);
      const Host = defineComponent({
        template: `<div><button v-tool="tool">提交</button><span v-record="{ id: 'latest', fields: { 最新: rows[0] ?? null } }" /></div>`,
        setup: () => ({
          rows,
          tool: {
            id: "submit",
            desc: "提交订单",
            run: () => {
              // 点了就走：真正的落地要等 20ms（接口 / 动画），没人 await 它
              void sleep(20).then(() => {
                rows.value = ["买牛奶"];
              });
            },
            ...build?.({ rows }),
          },
        }),
      });
      const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [pi.plugin] } });
      const executor = createExecutor({ registry: pi.registry, policy: allowAll });
      const out = (await executor.execute("submit", "{}")) as {
        result?: { expect?: string; changed?: { observed: boolean } };
      };
      wrapper.unmount();
      return out.result ?? {};
    }

    // 判据就是「那一行真的渲染出来了」—— 框架等它成立才下结论
    const withExpect = await run(({ rows }) => ({
      expect: { desc: "新行渲染出来", check: () => rows.value.length > 0, timeout: 200 },
    }));
    expect(withExpect.expect).toBe("新行渲染出来");
    expect(withExpect.changed?.observed).toBe(true);

    // 对照组：同样的业务，不写 expect → 快照在渲染之前取，diff 说「无变化」
    const without = await run();
    expect(without.changed?.observed).toBe(false);
  });
});
