import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlingPage } from "../src/page";
import {
  plingPageFromParent,
  sharePlingPageWithFrame,
  waitForPlingPageFromParent,
} from "../src/frame";
import {
  containsProjected,
  pointInFrame,
  projectRectToTop,
  topDocumentOf,
} from "../src/projection";
import { createScopeController } from "../src/scope";

const rect = (top: number, bottom: number, left: number, right: number): DOMRect =>
  ({ top, bottom, left, right, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function iframeFixture() {
  const frame = document.createElement("iframe");
  frame.style.border = "0";
  frame.style.padding = "0";
  document.body.append(frame);
  const doc = frame.contentDocument!;
  const button = doc.createElement("button");
  doc.body.append(button);
  Object.defineProperty(frame, "offsetWidth", { configurable: true, value: 200 });
  Object.defineProperty(frame, "offsetHeight", { configurable: true, value: 100 });
  frame.getBoundingClientRect = () => rect(100, 200, 50, 250);
  button.getBoundingClientRect = () => rect(10, 30, 20, 80);
  return { frame, doc, button };
}

describe("@plingjs/dom · 同源 iframe 投影", () => {
  it("把子页面矩形和点换算到父页面视口", () => {
    const { frame, button } = iframeFixture();

    expect(projectRectToTop(button)).toMatchObject({ left: 70, top: 110, width: 60, height: 20 });
    expect(pointInFrame(frame, 70, 110)).toEqual({ x: 20, y: 10 });
    expect(topDocumentOf(button)).toBe(document);
    expect(containsProjected(frame, button)).toBe(true);
  });

  it("在 iframe 内做遮挡判定时，从顶层文档按顶层坐标命中", () => {
    const topDoc = document;
    const { frame, doc, button } = iframeFixture();
    const card = doc.createElement("article");
    doc.body.append(card);

    const topHits: Array<[number, number]> = [];
    const innerHits: Array<[number, number]> = [];
    const previousTopHitTest = Object.getOwnPropertyDescriptor(topDoc, "elementFromPoint");
    Object.defineProperty(topDoc, "elementFromPoint", {
      configurable: true,
      value: (x: number, y: number) => {
        topHits.push([x, y]);
        return frame;
      },
    });
    Object.defineProperty(doc, "elementFromPoint", {
      configurable: true,
      value: (x: number, y: number) => {
        innerHits.push([x, y]);
        return x === 50 && y === 20 ? button : card;
      },
    });

    // 模拟框架代码运行在 iframe 自己的 realm 里：globalThis.document 是子文档。
    vi.stubGlobal("document", doc);
    try {
      const controller = createScopeController({ observer: null, visibility: "geometry" });
      expect(controller.coverOf(button)).toBeNull();
      expect(topHits).toEqual([[100, 120]]);
      expect(innerHits).toEqual([[50, 20]]);
    } finally {
      vi.stubGlobal("document", topDoc);
      if (previousTopHitTest) Object.defineProperty(topDoc, "elementFromPoint", previousTopHitTest);
      else Reflect.deleteProperty(topDoc, "elementFromPoint");
    }
  });

  it("显式共享页面运行时，并可在清理时收回", () => {
    const { frame } = iframeFixture();
    const page = createPlingPage({ scopes: { observer: null, visibility: "observer" } });
    const off = sharePlingPageWithFrame(frame, page);

    expect(plingPageFromParent(frame.contentWindow!)).toBe(page);
    off();
    expect(plingPageFromParent(frame.contentWindow!)).toBeUndefined();
    page.destroy();
  });

  it("子页面可以等待父页面稍后共享的运行时", async () => {
    const { frame } = iframeFixture();
    const page = createPlingPage({ scopes: { observer: null, visibility: "observer" } });
    const waiting = waitForPlingPageFromParent({ window: frame.contentWindow!, timeoutMs: 1000 });
    const off = sharePlingPageWithFrame(frame, page);

    await expect(waiting).resolves.toBe(page);
    off();
    page.destroy();
  });
});

