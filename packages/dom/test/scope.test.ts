import { afterEach, describe, expect, it } from "vitest";
import { createScopeController, UI_ATTR } from "../src/scope";

const rect = (top: number, bottom: number, left = 0, right = 100): DOMRect =>
  ({ top, bottom, left, right, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

function setup() {
  const container = document.createElement("div");
  const el = document.createElement("button");
  container.appendChild(el);
  document.body.appendChild(container);
  const controller = createScopeController({ observer: null, visibility: "geometry" });
  controller.declare(container, { id: "rows" });
  controller.track(el, "rows");
  return { controller, container, el };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("@plingjs/dom · 作用域可见性", () => {
  it("元素进出容器可视区，同步几何判定立刻变化", () => {
    const { controller, container, el } = setup();
    container.getBoundingClientRect = () => rect(0, 300);

    el.getBoundingClientRect = () => rect(1000, 1030);
    expect(controller.isVisible(el)).toBe(false);

    el.getBoundingClientRect = () => rect(10, 40);
    expect(controller.isVisible(el)).toBe(true);
  });

  it("零尺寸判为不可见；未跟踪的全局元素始终可见", () => {
    const { controller, container, el } = setup();
    container.getBoundingClientRect = () => rect(0, 300);
    el.getBoundingClientRect = () => rect(0, 0, 0, 0);
    expect(controller.isVisible(el)).toBe(false);

    const lonely = document.createElement("button");
    document.body.appendChild(lonely);
    lonely.getBoundingClientRect = () => rect(0, 0, 0, 0);
    expect(controller.isVisible(lonely)).toBe(true);
  });

  it("容器在页面视口外时不活跃，移回来后 refresh 会广播", () => {
    const { controller, container } = setup();
    let changes = 0;
    controller.onChange(() => changes += 1);

    container.getBoundingClientRect = () => rect(5000, 5300);
    controller.refresh();
    expect(controller.activeScopes()).toEqual(new Set());
    expect(controller.isScopeInView("rows")).toBe(false);
    expect(changes).toBe(1);

    container.getBoundingClientRect = () => rect(100, 400);
    controller.refresh();
    expect(controller.activeScopes()).toEqual(new Set(["rows"]));
    expect(controller.isScopeInView("rows")).toBe(true);
  });

  it("命中测试发现被遮罩盖住；框架自己的浮窗不算遮罩", () => {
    const overlay = document.createElement("div");
    overlay.id = "mask";
    document.body.append(overlay);
    let hit: Element | null = overlay;
    const container = document.createElement("div");
    const el = document.createElement("button");
    container.appendChild(el);
    document.body.appendChild(container);
    const controller = createScopeController({ observer: null, visibility: "geometry", hitTest: () => hit });
    controller.declare(container, { id: "rows" });
    controller.track(el, "rows");
    container.getBoundingClientRect = () => rect(0, 300);
    el.getBoundingClientRect = () => rect(20, 50);

    expect(controller.coverOf(el)).toBe(overlay);

    overlay.setAttribute(UI_ATTR, "");
    expect(controller.coverOf(el)).toBeNull();

    overlay.remove();
    hit = el;
    expect(controller.coverOf(el)).toBeNull();
  });
});
