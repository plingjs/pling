import { afterEach, describe, expect, it } from "vitest";
import { createScopeController } from "../src/scope";

/**
 * 几何判定：可见性的真相是「此刻的几何位置」，不是观察器回调的缓存。
 *
 * 为什么专门钉住：浏览器实测里，搜索把 42 行收敛成 1 行时，那一行的 DOM 被复用、
 * 位置变了，但 IntersectionObserver 回调还没到；缓存里它仍是「不可见」，
 * 于是它的动作不进快照，模型刚搜出来就去操作、拿到 ACTION_NOT_FOUND。
 * 回调是异步的，正确性不能建立在它上面。
 */

const rect = (top: number, bottom: number, left = 0, right = 100): DOMRect =>
  ({ top, bottom, left, right, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

function makeController() {
  const container = document.createElement("div");
  const el = document.createElement("button");
  container.appendChild(el);
  document.body.appendChild(container);
  // observer: null —— 完全没有观察器，逼着判定只能靠几何
  const controller = createScopeController({ observer: null, visibility: "geometry" });
  controller.declare(container, { id: "rows" });
  controller.track(el, "rows");
  return { controller, container, el };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("可见性：几何判定（同步，不依赖观察器回调）", () => {
  it("元素从容器外移进容器内，立刻判定为可见", () => {
    const { controller, container, el } = makeController();
    container.getBoundingClientRect = () => rect(0, 300);

    el.getBoundingClientRect = () => rect(1000, 1030);
    expect(controller.isVisible(el)).toBe(false);

    el.getBoundingClientRect = () => rect(10, 40);
    expect(controller.isVisible(el)).toBe(true);
  });

  it("零尺寸（display:none / 未布局）判为不可见", () => {
    const { controller, container, el } = makeController();
    container.getBoundingClientRect = () => rect(0, 300);
    el.getBoundingClientRect = () => rect(0, 0, 0, 0);
    expect(controller.isVisible(el)).toBe(false);
  });

  it("作用域容器是否在视口内，同样看几何而不是回调", () => {
    const { controller, container } = makeController();
    container.getBoundingClientRect = () => rect(5000, 5300);
    expect(controller.isScopeInView("rows")).toBe(false);
    container.getBoundingClientRect = () => rect(100, 400);
    expect(controller.isScopeInView("rows")).toBe(true);
  });

  it("没被跟踪进作用域的元素始终可见（全局动作不受裁剪）", () => {
    const { controller } = makeController();
    const lonely = document.createElement("button");
    document.body.appendChild(lonely);
    lonely.getBoundingClientRect = () => rect(0, 0, 0, 0);
    expect(controller.isVisible(lonely)).toBe(true);
  });
});
