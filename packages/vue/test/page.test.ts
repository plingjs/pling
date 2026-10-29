import { mount } from "@vue/test-utils";
import { defineComponent, h, ref, type Plugin } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlingPage } from "@plingjs/dom";
import { createPling } from "../src/directive";
import type { PageRouteLike, PageRouterLike } from "../src/page";

afterEach(() => {
  window.history.replaceState({}, "", "/");
  document.title = "";
});

function mountWith(pi: ReturnType<typeof createPling>) {
  return mount(defineComponent({ render: () => h("div", "page") }), {
    global: { plugins: [pi.plugin] },
  });
}

describe("页面身份（S10a）", () => {
  it("挂载时自动读取路径与标题；query 默认不给模型", () => {
    window.history.replaceState({}, "", "/demo/orders?token=secret&q=abc");
    document.title = "订单列表";
    const pi = createPling({ onWarn: () => {} });
    const wrapper = mountWith(pi);

    try {
      expect(pi.registry.snapshot().page).toEqual({
        path: "/demo/orders",
        title: "订单列表",
      });
    } finally {
      wrapper.unmount();
      pi.destroy();
    }
  });

  it("query 只按白名单读取", () => {
    window.history.replaceState({}, "", "/demo/orders?token=secret&q=abc");
    const pi = createPling({ page: { queryKeys: ["q"] }, onWarn: () => {} });
    const wrapper = mountWith(pi);

    try {
      expect(pi.registry.snapshot().page?.query).toEqual({ q: "abc" });
      expect(JSON.stringify(pi.registry.snapshot().page)).not.toContain("secret");
    } finally {
      wrapper.unmount();
      pi.destroy();
    }
  });

  it("pushState 与标题变化都会刷新快照", async () => {
    const pi = createPling({ onWarn: () => {} });
    const wrapper = mountWith(pi);

    try {
      window.history.pushState({}, "", "/demo/orders/SO-1002");
      document.title = "订单详情";
      await vi.waitFor(() => {
        expect(pi.registry.snapshot().page).toMatchObject({
          path: "/demo/orders/SO-1002",
          title: "订单详情",
        });
      });
    } finally {
      wrapper.unmount();
      pi.destroy();
    }
  });

  it("Vue Router 可选接入：name / params / meta.title 进入页面身份", async () => {
    const route = ref<PageRouteLike>({
      path: "/orders",
      name: "orders",
      params: {},
      query: { page: "1", token: "secret" },
      hash: "",
      meta: { title: "订单列表" },
    });
    const hooks = new Set<() => void>();
    const router: PageRouterLike = {
      currentRoute: route,
      afterEach(hook) {
        hooks.add(hook);
        return () => hooks.delete(hook);
      },
    };
    const pi = createPling({ page: { router, queryKeys: ["page"] }, onWarn: () => {} });
    const wrapper = mountWith(pi);

    try {
      expect(pi.registry.snapshot().page).toEqual({
        path: "/orders",
        title: "订单列表",
        name: "orders",
        query: { page: "1" },
      });

      route.value = {
        path: "/orders/SO-1002",
        name: "order-detail",
        params: { id: "SO-1002" },
        query: {},
        hash: "#detail",
        meta: { title: "订单详情" },
      };
      for (const hook of hooks) hook();
      await vi.waitFor(() => {
        expect(pi.registry.snapshot().page).toMatchObject({
          path: "/orders/SO-1002",
          title: "订单详情",
          name: "order-detail",
          params: { id: "SO-1002" },
          hash: "#detail",
        });
      });
    } finally {
      wrapper.unmount();
      pi.destroy();
    }
  });

  it("挂载时自动探测 app.config.globalProperties.$router", async () => {
    const route = ref<PageRouteLike>({
      path: "/orders",
      name: "orders",
      params: {},
      meta: { title: "订单列表" },
    });
    const hooks = new Set<() => void>();
    const router: PageRouterLike = {
      currentRoute: route,
      afterEach(hook) {
        hooks.add(hook);
        return () => hooks.delete(hook);
      },
    };
    const routerPlugin: Plugin = {
      install(app) {
        (app.config.globalProperties as { $router?: PageRouterLike }).$router = router;
      },
    };
    const pi = createPling({ onWarn: () => {} });
    const wrapper = mount(defineComponent({ render: () => h("div", "page") }), {
      global: { plugins: [routerPlugin, pi.plugin] },
    });

    try {
      expect(pi.registry.snapshot().page).toEqual({
        path: "/orders",
        title: "订单列表",
        name: "orders",
      });

      route.value = {
        path: "/orders/SO-1002",
        name: "order-detail",
        params: { id: "SO-1002" },
        meta: { title: "订单详情" },
      };
      for (const hook of hooks) hook();
      await vi.waitFor(() => {
        expect(pi.registry.snapshot().page).toEqual({
          path: "/orders/SO-1002",
          title: "订单详情",
          name: "order-detail",
          params: { id: "SO-1002" },
        });
      });
    } finally {
      wrapper.unmount();
      pi.destroy();
    }
  });

  it("显式 page.router 优先于自动探测到的 $router", () => {
    const auto = ref<PageRouteLike>({ path: "/auto", name: "auto", meta: { title: "自动" } });
    const explicit = ref<PageRouteLike>({ path: "/explicit", name: "explicit", meta: { title: "显式" } });
    const autoRouter: PageRouterLike = { currentRoute: auto };
    const routerPlugin: Plugin = {
      install(app) {
        (app.config.globalProperties as { $router?: PageRouterLike }).$router = autoRouter;
      },
    };
    const pi = createPling({ page: { router: { currentRoute: explicit } }, onWarn: () => {} });
    const wrapper = mount(defineComponent({ render: () => h("div", "page") }), {
      global: { plugins: [routerPlugin, pi.plugin] },
    });

    try {
      expect(pi.registry.snapshot().page).toEqual({
        path: "/explicit",
        title: "显式",
        name: "explicit",
      });
    } finally {
      wrapper.unmount();
      pi.destroy();
    }
  });

  it("page: false 时完全不收集", () => {
    window.history.replaceState({}, "", "/demo/orders");
    document.title = "订单列表";
    const pi = createPling({ page: false, onWarn: () => {} });
    const wrapper = mountWith(pi);

    try {
      expect(pi.registry.snapshot().page).toBeUndefined();
    } finally {
      wrapper.unmount();
      pi.destroy();
    }
  });

  it("destroy 后清空页面身份", () => {
    window.history.replaceState({}, "", "/demo/orders");
    document.title = "订单列表";
    const pi = createPling({ onWarn: () => {} });
    const wrapper = mountWith(pi);
    expect(pi.registry.snapshot().page).toBeDefined();

    wrapper.unmount();
    pi.destroy();
    expect(pi.registry.snapshot().page).toBeUndefined();
  });

  it("共享 registry 时只有一个适配器拥有页面身份，先写者说了算", () => {
    window.history.replaceState({}, "", "/parent");
    document.title = "父页面";
    const runtime = createPlingPage();
    const host = createPling({ shared: runtime, page: { title: () => "父页面标题" }, onWarn: () => {} });
    const hostWrapper = mountWith(host);
    const frame = createPling({ shared: runtime, page: { title: () => "子页面标题" }, onWarn: () => {} });
    const frameWrapper = mountWith(frame);

    try {
      expect(runtime.registry.snapshot().page).toEqual({ path: "/parent", title: "父页面标题" });

      frameWrapper.unmount();
      frame.destroy();
      expect(runtime.registry.snapshot().page).toEqual({ path: "/parent", title: "父页面标题" });
    } finally {
      hostWrapper.unmount();
      host.destroy();
      runtime.destroy();
    }
    expect(runtime.registry.snapshot().page).toBeUndefined();
  });

  it("不同 namespace 共享页面时，子页面显式开启 page 也不会覆盖父页面身份", () => {
    window.history.replaceState({}, "", "/parent");
    document.title = "父页面";
    const runtime = createPlingPage();
    const host = createPling({ shared: runtime, page: { title: () => "父页面标题" }, onWarn: () => {} });
    const hostWrapper = mountWith(host);
    const frame = createPling({
      shared: runtime,
      namespace: "frame",
      page: { title: () => "子页面标题" },
      onWarn: () => {},
    });
    const frameWrapper = mountWith(frame);

    try {
      expect(runtime.registry.snapshot().page).toEqual({ path: "/parent", title: "父页面标题" });

      frameWrapper.unmount();
      frame.destroy();
      expect(runtime.registry.snapshot().page).toEqual({ path: "/parent", title: "父页面标题" });
    } finally {
      hostWrapper.unmount();
      host.destroy();
      runtime.destroy();
    }
  });
});
