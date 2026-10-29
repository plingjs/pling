import { afterEach, describe, expect, it } from "vitest";
import { createPlingPage } from "../src/page";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("@plingjs/dom · 共享页面运行时", () => {
  it("页面级变化同步到同一个 registry", () => {
    const page = createPlingPage({ scopes: { observer: null, visibility: "observer" } });
    const container = document.createElement("section");
    document.body.append(container);
    page.scopes.declare(container, { id: "todos" });

    expect(page.registry.isScopeActive("todos")).toBe(true);

    page.scopes.setScopeInView("todos", false);
    expect(page.registry.isScopeActive("todos")).toBe(false);

    page.scopes.setScopeInView("todos", true);
    expect(page.registry.isScopeActive("todos")).toBe(true);
    page.destroy();
  });

  it("destroy 停止同步并清空自动活跃区域", () => {
    const page = createPlingPage({ scopes: { observer: null, visibility: "observer" } });
    const container = document.createElement("section");
    document.body.append(container);
    page.scopes.declare(container, { id: "todos" });
    expect(page.registry.isScopeActive("todos")).toBe(true);

    page.destroy();
    expect(page.registry.isScopeActive("todos")).toBe(false);
    expect(() => page.destroy()).not.toThrow();
  });
});
