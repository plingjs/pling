import { vi } from "vitest";

export interface FakeEntry {
  target: Element;
  isIntersecting: boolean;
}

/**
 * 可控的 IntersectionObserver 替身（jsdom 没有实现真的）。
 * 测试通过 sync() 把「当前可见集合」推给回调，观察器的 diff 语义与真实实现一致：
 * 只有状态发生变化的元素才会进 entries。
 */
export class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  static install(): void {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  }

  static reset(): void {
    FakeIntersectionObserver.instances = [];
  }

  readonly root: Element | null;
  readonly targets = new Set<Element>();
  private readonly callback: (entries: FakeEntry[]) => void;
  private visible = new Set<Element>();
  private reported = new Set<Element>();

  constructor(callback: (entries: FakeEntry[]) => void, options?: { root?: Element | null }) {
    this.callback = callback;
    this.root = options?.root ?? null;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
    this.visible.delete(target);
    this.reported.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
    this.visible.clear();
    this.reported.clear();
  }

  takeRecords(): FakeEntry[] {
    return [];
  }

  /**
   * 全量同步「可见集合」。
   * 与真实 IntersectionObserver 一致：每个新被观察的元素第一次一定会报一次；
   * 之后只有状态变化的元素才进 entries。
   */
  sync(visible: Iterable<Element>): void {
    const next = new Set(visible);
    const entries: FakeEntry[] = [];
    for (const target of this.targets) {
      const now = next.has(target);
      const before = this.visible.has(target);
      const firstReport = !this.reported.has(target);
      this.reported.add(target);
      if (firstReport || before !== now) entries.push({ target, isIntersecting: now });
    }
    this.visible = next;
    if (entries.length) this.callback(entries);
  }

  showAll(): void {
    this.sync(this.targets);
  }

  hideAll(): void {
    this.sync([]);
  }
}
