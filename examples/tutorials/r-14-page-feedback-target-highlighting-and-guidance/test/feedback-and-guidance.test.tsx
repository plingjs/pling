import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "../src/App";
import type { DemoLocale } from "../src/copy";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  document.body.innerHTML = "";
  root = null;
  host = null;
});

async function mountApp(locale: DemoLocale = "en") {
  const pling = createPling({
    presence: { effect: "spotlight" },
    onWarn: () => {},
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: {
      config: {
        baseUrl: "/llm/v1",
        model: "test-model",
        limits: { maxTurns: 100 },
      },
      gate: () => false,
      llm: createReplayLlm([]),
    },
  });

  await act(async () => {
    root!.render(
      <PlingProvider pling={pling}>
        <MemoryRouter initialEntries={["/tasks"]}>
          <App locale={locale} />
        </MemoryRouter>
      </PlingProvider>,
    );
  });
  return pling;
}

async function click(element: Element | null): Promise<void> {
  if (!element) throw new Error("element not found");
  await act(async () => (element as HTMLElement).click());
}

async function typeInto(element: HTMLInputElement | null, value: string): Promise<void> {
  if (!element) throw new Error("input not found");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("input value setter is unavailable");
  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("R-14 · page feedback, highlighting, and human guidance", () => {
  it("turns a visible validation error into read-only page feedback", async () => {
    const pling = await mountApp();

    await click(document.querySelector("[data-save-name]"));
    pling.feedback.sync();

    expect(pling.registry.snapshot().feedback).toEqual([
      expect.objectContaining({
        id: "release_feedback",
        message: "Enter a workspace name. It cannot contain only spaces.",
        field: "workspace_name",
        severity: "error",
        scope: "release_check",
        source: "declared",
      }),
    ]);
    expect(pling.registry.snapshot().actions.some((action) => action.id === "release_feedback"))
      .toBe(false);
    expect(document.querySelector(".release__status")?.textContent).toBe("Needs attention");
  });

  it("clears feedback after a valid save", async () => {
    const pling = await mountApp();
    await click(document.querySelector("[data-save-name]"));
    expect(pling.registry.snapshot().feedback).toHaveLength(1);

    await typeInto(document.querySelector("[data-release-name]"), "Product operations");
    await click(document.querySelector("[data-save-name]"));
    pling.feedback.sync();

    expect(pling.registry.snapshot().feedback.some((item) => item.field === "workspace_name"))
      .toBe(false);
    expect(document.querySelector("#release-status")?.textContent).toContain("Product operations");
  });

  it("keeps the person-only field out of the action list and declares handoff steps", async () => {
    const pling = await mountApp();
    const snapshot = pling.registry.snapshot();

    expect(snapshot.actions.some((action) => action.id === "verification_code")).toBe(false);
    expect(snapshot.actions.some((action) => action.id === "publish_changes")).toBe(true);

    const publish = pling.registry.get("publish_changes");
    expect(publish?.handoff?.steps).toEqual([
      { text: expect.stringContaining("246810"), highlight: "verification_code" },
      { text: expect.stringContaining("Publish changes"), highlight: "publish_changes" },
    ]);
    expect(pling.registry.markGuideTarget("verification_code", "waiting")).toBe(true);
  });

  it("reports a wrong verification code without executing the handoff", async () => {
    const pling = await mountApp();

    await typeInto(document.querySelector("[data-release-code]"), "000000");
    await click(document.querySelector("[data-publish]"));
    pling.feedback.sync();

    expect(pling.registry.snapshot().feedback).toEqual([
      expect.objectContaining({
        message: "The verification code is incorrect. Check it and try again.",
        field: "verification_code",
        severity: "error",
      }),
    ]);
    expect(document.querySelector(".release__status")?.textContent).toBe("Needs attention");
  });

  it("localizes the release panel", async () => {
    await mountApp("zh");

    expect(document.body.textContent).toContain("工作区设置");
    expect(document.querySelector("[data-save-name]")?.textContent).toBe("保存名称");
    expect(document.querySelector("[data-publish]")?.textContent).toBe("发布变更");
  });
});
