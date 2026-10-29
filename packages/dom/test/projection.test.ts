import { afterEach, describe, expect, it } from "vitest";
import {
  closestComposed,
  containsComposed,
  queryAllComposed,
} from "../src/projection";
import { createScopeController, nearestScope } from "../src/scope";

const rect = (top: number, bottom: number, left = 0, right: 100): DOMRect =>
  ({ top, bottom, left, right, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

afterEach(() => {
  document.body.innerHTML = "";
});

function shadowFixture() {
  const outer = document.createElement("section");
  outer.setAttribute("data-pling-scope", "outer/panel");
  const host = document.createElement("div");
  outer.append(host);
  document.body.append(outer);
  const root = host.attachShadow({ mode: "open" });
  const inner = document.createElement("div");
  inner.setAttribute("data-pling-scope", "inner/form");
  const button = document.createElement("button");
  button.textContent = "保存";
  inner.append(button);
  root.append(inner);
  return { outer, host, root, inner, button };
}

describe("@plingjs/dom · 组合树投影", () => {
  it("closest / contains / nearestScope 跨过 shadow 宿主", () => {
    const { outer, host, inner, button } = shadowFixture();

    expect(closestComposed(button, "[data-pling-scope]")).toBe(inner);
    expect(nearestScope(button)).toBe("inner/form");
    expect(containsComposed(host, button)).toBe(true);
    expect(containsComposed(outer, button)).toBe(true);
    expect(containsComposed(button, host)).toBe(false);
  });

  it("深度查询按宿主 DOM 顺序进入打开的 shadow root", () => {
    const { outer, inner } = shadowFixture();
    const another = document.createElement("div");
    another.setAttribute("data-pling-scope", "after");
    outer.after(another);

    expect(queryAllComposed(document, "[data-pling-scope]")).toEqual([outer, inner, another]);
  });

  it("命中到 shadow 宿主时，不算目标被自己盖住", () => {
    const { host, button } = shadowFixture();
    const controller = createScopeController({
      observer: null,
      visibility: "geometry",
      hitTest: () => host,
    });
    button.getBoundingClientRect = () => rect(20, 50, 0, 100);

    expect(controller.coverOf(button)).toBeNull();
    expect(controller.coverOf(host)).toBeNull();
  });
});

