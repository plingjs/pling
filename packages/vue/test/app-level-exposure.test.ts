import { createApp, defineComponent, h } from "vue";
import { describe, expect, it } from "vitest";
import { createPling } from "../src/directive";
import { useAgentState } from "../src/state";

/**
 * 旧项目升级路径：**在 main.ts 里一次性暴露，不碰任何业务组件**。
 *
 * 为什么这条路径重要：老项目里「当前筛选 / 搜索 / 分页」这些值往往散在 store 里，
 * 要逐个组件加声明是不可接受的侵入。`app.runWithContext()` 让 `inject` 能拿到应用级的
 * pi，于是在应用启动处就能把 store 的视图交出去 —— 业务组件一行不动。
 *
 * 代价（要如实说）：这种暴露活在应用级，不随组件卸载（本来也就该活到应用结束）。
 */
function appWith(pi: ReturnType<typeof createPling>) {
  const app = createApp(defineComponent({ render: () => h("div") }));
  app.use(pi.plugin);
  return app;
}

describe("状态暴露：旧项目升级（应用级一次声明）", () => {
  it("在 app.runWithContext 里暴露 store 的视图，业务组件零改动", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    // 模拟 Pinia：store 活在组件树之外，由 main.ts 持有
    const store = { status: "all" as string, items: [1, 2, 3] };

    appWith(pi).runWithContext(() => {
      useAgentState("list", () => ({ status: store.status, count: store.items.length }), {
        description: "列表当前的筛选与条数",
      });
    });

    expect(pi.registry.snapshot().state).toEqual({ list: { status: "all", count: 3 } });
    store.status = "pending";
    store.items = [1];
    expect(pi.registry.snapshot().state).toEqual({ list: { status: "pending", count: 1 } });
  });

  it("应用级暴露与组件级暴露可以共存（组件卸载只注销自己那组）", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const app = appWith(pi);
    app.runWithContext(() => useAgentState("app", () => "一直活着"));

    expect(Object.keys(pi.registry.snapshot().state)).toEqual(["app"]);
  });
});
