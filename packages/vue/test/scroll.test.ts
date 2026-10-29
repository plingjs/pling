import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineComponent } from "vue";
import { pendingCount } from "@plingjs/core";
import { performPrimitive } from "../src/dom";
import { createPling } from "../src/directive";
import { markScrolling, SCROLL_QUIET_MS, scrollBehavior, scrollWatcher } from "../src/scroll";

/**
 * 滚动观察器（S4b）：页面在滚的时候，`@plingjs/core` 的「还在动」计数要 > 0。
 *
 * 这是「滚动是异步的」这件事在框架里唯一的落点：
 * `settle` 会等这个计数归零，所以它准不准决定了「滚完再看」看到的是不是滚动途中的位置。
 */

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function makeTarget(): { target: HTMLElement; cleanup: () => void } {
  const target = document.createElement("div");
  document.body.appendChild(target);
  return { target, cleanup: () => target.remove() };
}

beforeEach(() => {
  // 真实应用里这一步是 `createPling` 装插件时做的（见文件末尾那条用例）
  scrollWatcher(window);
});

afterEach(() => {
  // 别把登记漏给下一个用例
  scrollWatcher(window)?.stop();
});

describe("scrollWatcher：滚动期间登记「页面还在动」", () => {
  it("元素上的滚动事件也算（capture：scroll 不冒泡，但捕获阶段会经过 window）", () => {
    const { target, cleanup } = makeTarget();
    expect(pendingCount()).toBe(0);

    target.dispatchEvent(new Event("scroll"));
    expect(pendingCount()).toBe(1);
    cleanup();
  });

  it("安静 SCROLL_QUIET_MS 之后自动注销", async () => {
    const { target, cleanup } = makeTarget();
    target.dispatchEvent(new Event("scroll"));
    expect(pendingCount()).toBe(1);

    await sleep(SCROLL_QUIET_MS + 60);
    expect(pendingCount()).toBe(0);
    cleanup();
  });

  it("滚动还在继续 → 不断续期（不是 120ms 一到就判「停了」）", async () => {
    const { target, cleanup } = makeTarget();
    target.dispatchEvent(new Event("scroll"));
    await sleep(SCROLL_QUIET_MS - 40);
    target.dispatchEvent(new Event("scroll")); // 还有新的滚动事件 → 续期
    await sleep(SCROLL_QUIET_MS - 40);
    expect(pendingCount()).toBe(1); // 光看「距第一次事件多久」会误判成停了
    await sleep(SCROLL_QUIET_MS + 60);
    expect(pendingCount()).toBe(0);
    cleanup();
  });

  it("markScrolling：框架自己动手之前先登记（不等事件，绕开「第一帧还没开始滚」）", () => {
    markScrolling(window);
    expect(pendingCount()).toBe(1);
  });

  it("同一个窗口只有一个观察器（多个应用共用一份）", () => {
    expect(scrollWatcher(window)).toBe(scrollWatcher(window));
  });

  it("没有窗口（SSR / Node）时安全降级", () => {
    expect(scrollWatcher(null)).toBeNull();
    expect(() => markScrolling(undefined)).not.toThrow();
  });
});

describe("滚动原语与滚动行为", () => {
  it("scroll 原语先登记再滚（登记是同步的，调用方紧接着就能看到）", () => {
    const { target, cleanup } = makeTarget();
    performPrimitive(target, "scroll", { to: "element" });
    expect(pendingCount()).toBe(1);
    cleanup();
  });

  it("尊重 prefers-reduced-motion：用户要求减少动效时用瞬时滚动（也就不会白等 500ms）", () => {
    const win = window as Window & { matchMedia?: (query: string) => MediaQueryList };
    const original = win.matchMedia;
    win.matchMedia = ((query: string) => ({ matches: query.includes("reduced-motion") })) as never;
    expect(scrollBehavior(win)).toBe("auto");
    win.matchMedia = ((() => ({ matches: false })) as never);
    expect(scrollBehavior(win)).toBe("smooth");
    win.matchMedia = original;
  });
});

describe("装上就生效：观察器由应用安装时挂上", () => {
  it("挂上 Pling 插件之后，页面自己的滚动也会被登记（不需要谁显式调用）", () => {
    const pi = createPling(undefined, { onWarn: () => {} });
    const { target, cleanup } = makeTarget();
    const wrapper = mount(defineComponent({ template: "<div />" }), {
      attachTo: document.body,
      global: { plugins: [pi.plugin] },
    });

    target.dispatchEvent(new Event("scroll"));
    expect(pendingCount()).toBe(1);

    wrapper.unmount();
    cleanup();
    pi.destroy();
  });
});
