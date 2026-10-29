import { StrictMode, act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPling, PlingProvider, usePlingScope, usePlingTool, type PlingOptions } from "../src";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = "";
});

const rect = (top: number, bottom: number, left = 0, right = 100): DOMRect =>
  ({ top, bottom, left, right, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

async function render(node: ReactNode): Promise<void> {
  await act(async () => root!.render(node));
}

function Page() {
  const scope = usePlingScope<HTMLElement>({ id: "rows", label: "记录列表", role: "list" });
  const save = usePlingTool<HTMLButtonElement>({ id: "save", desc: "保存记录" });
  return <section ref={scope}><button ref={save}>保存</button></section>;
}

async function setup(options: PlingOptions = {}) {
  const pling = createPling({ onWarn: () => {}, ...options });
  await render(<PlingProvider pling={pling}><Page /></PlingProvider>);
  const scope = document.querySelector("section")!;
  const button = document.querySelector("button")!;
  return { pling, scope, button };
}

describe("React 可见性与遮挡裁剪", () => {
  it("元素滚出容器可视区 → 不进动作清单；移回来 → 立刻出现", async () => {
    const { pling, scope, button } = await setup({
      scopes: { observer: null, visibility: "geometry" },
    });
    scope.getBoundingClientRect = () => rect(0, 300);
    await act(async () => pling.scopes.refresh());

    button.getBoundingClientRect = () => rect(1000, 1030);
    let snapshot = pling.registry.snapshot();
    expect(snapshot.actions.map((action) => action.id)).not.toContain("save");
    expect(snapshot.actions.map((action) => action.id)).toContain("pling_scroll_rows");
    expect(snapshot.scopes.find((item) => item.id === "rows")).toMatchObject({ active: true, hasMore: true });

    button.getBoundingClientRect = () => rect(20, 50);
    snapshot = pling.registry.snapshot();
    expect(snapshot.actions.map((action) => action.id)).toContain("save");
    expect(snapshot.actions.map((action) => action.id)).not.toContain("pling_scroll_rows");
    expect(snapshot.scopes.find((item) => item.id === "rows")?.hasMore).toBe(false);
  });

  it("区域滚出页面视口 → 区域不活跃，子动作被裁剪；移回来恢复", async () => {
    const { pling, scope, button } = await setup({
      scopes: { observer: null, visibility: "geometry" },
    });
    button.getBoundingClientRect = () => rect(20, 50);
    scope.getBoundingClientRect = () => rect(5000, 5300);
    await act(async () => pling.scopes.refresh());
    let snapshot = pling.registry.snapshot();
    expect(snapshot.scopes.find((item) => item.id === "rows")?.active).toBe(false);
    expect(snapshot.actions.map((action) => action.id)).not.toContain("save");

    scope.getBoundingClientRect = () => rect(0, 300);
    await act(async () => pling.scopes.refresh());
    snapshot = pling.registry.snapshot();
    expect(snapshot.scopes.find((item) => item.id === "rows")?.active).toBe(true);
    expect(snapshot.actions.map((action) => action.id)).toContain("save");
  });

  it("被遮罩盖住 → 动作不可用并给出原因；框架自己的浮窗不算遮罩", async () => {
    const overlay = document.createElement("div");
    overlay.id = "mask";
    document.body.append(overlay);

    let hit: Element | null = overlay;
    const { pling, scope, button } = await setup({
      scopes: { observer: null, visibility: "geometry", hitTest: () => hit },
    });
    scope.getBoundingClientRect = () => rect(0, 300);
    button.getBoundingClientRect = () => rect(20, 50);
    await act(async () => pling.scopes.refresh());

    let snapshot = pling.registry.snapshot();
    expect(snapshot.actions.map((action) => action.id)).not.toContain("save");
    expect(snapshot.unavailable.find((item) => item.id === "save")?.reason).toContain("Covered by");

    overlay.setAttribute("data-pling-ui", "");
    snapshot = pling.registry.snapshot();
    expect(snapshot.actions.map((action) => action.id)).toContain("save");

    overlay.remove();
    hit = button;
    snapshot = pling.registry.snapshot();
    expect(snapshot.actions.map((action) => action.id)).toContain("save");
  });

  it("StrictMode 的重复挂载不会留下重复区域或动作", async () => {
    const pling = createPling({ onWarn: () => {}, scopes: { observer: null, visibility: "geometry" } });
    await render(
      <StrictMode>
        <PlingProvider pling={pling}><Page /></PlingProvider>
      </StrictMode>,
    );
    const scope = document.querySelector("section")!;
    const button = document.querySelector("button")!;
    scope.getBoundingClientRect = () => rect(0, 300);
    button.getBoundingClientRect = () => rect(20, 50);
    await act(async () => pling.scopes.refresh());
    let snapshot = pling.registry.snapshot();
    expect(snapshot.scopes.filter((item) => item.id === "rows")).toHaveLength(1);
    expect(snapshot.actions.filter((action) => action.id === "save")).toHaveLength(1);

    scope.getBoundingClientRect = () => rect(5000, 5300);
    await act(async () => pling.scopes.refresh());
    snapshot = pling.registry.snapshot();
    expect(snapshot.actions.filter((action) => action.id === "pling_reveal_rows")).toHaveLength(1);
  });

  it("区域自动生成探索动作：不在视口内时出现 reveal，进入后收起", async () => {
    const { pling, scope, button } = await setup({
      scopes: { observer: null, visibility: "geometry" },
    });
    button.getBoundingClientRect = () => rect(20, 50);
    scope.getBoundingClientRect = () => rect(5000, 5300);
    await act(async () => pling.scopes.refresh());

    let snapshot = pling.registry.snapshot();
    expect(snapshot.actions.map((action) => action.id)).toContain("pling_reveal_rows");
    expect(snapshot.scopes.find((item) => item.id === "rows")?.explore).toContain("pling_reveal_rows");

    scope.getBoundingClientRect = () => rect(0, 300);
    await act(async () => pling.scopes.refresh());
    snapshot = pling.registry.snapshot();
    expect(snapshot.actions.map((action) => action.id)).not.toContain("pling_reveal_rows");
  });
});
