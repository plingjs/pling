import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm, defaultSettle } from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling, PlingProvider } from "@plingjs/react";
import type { PlingElement } from "@plingjs/react";
import { App } from "../src/App";
import type { DemoLocale } from "../src/copy";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const cleanups: Array<() => void> = [];

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  while (cleanups.length) cleanups.pop()?.();
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
  cleanups.push(() => pling.destroy());
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

function executorFor(
  pling: PlingElement,
  options: {
    allow?: boolean;
    handoff?: () => Promise<"done" | "cancelled" | "timeout">;
  } = {},
) {
  return createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => options.allow ?? true),
    settle: defaultSettle,
    ...(options.handoff ? { handoff: options.handoff } : {}),
  });
}

describe("R-15 · confirmation and human handoff", () => {
  it("maps declarations to approval policies", async () => {
    const pling = await mountApp();
    const actions = pling.registry.snapshot().actions;

    expect(actions.find((action) => action.id === "workspace_name")?.approval).toBe("none");
    expect(actions.find((action) => action.id === "save_workspace_name")?.approval).toBe("ask");
    expect(actions.find((action) => action.id === "archive_workspace")?.approval).toBe("ask-always");
    expect(actions.find((action) => action.id === "reset_workspace")?.approval).toBe("ask-always");
    expect(actions.find((action) => action.id === "publish_changes")?.handoff?.reason)
      .toContain("verification code");
  });

  it("does not execute an action when approval is denied", async () => {
    const pling = await mountApp();
    const result = await executorFor(pling, { allow: false }).execute("archive_workspace", "{}");

    expect("error" in result && result.error.code).toBe("PERMISSION_DENIED");
    expect(document.querySelector(".release__archived")).toBeNull();
  });

  it("does not simulate the handoff when the user cancels", async () => {
    const pling = await mountApp();
    const result = await executorFor(pling, {
      handoff: async () => "cancelled",
    }).execute("publish_changes", "{}");

    expect("error" in result && result.error.code).toBe("HANDOFF_CANCELLED");
    expect("error" in result && result.error.message).toContain("verification code");
    expect(document.querySelector(".release__status")?.textContent).toBe("Ready");
  });

  it("reports success only after the person completes and the page reaches the expected state", async () => {
    const pling = await mountApp();
    const result = await executorFor(pling, {
      handoff: async () => {
        await typeInto(document.querySelector("[data-release-code]"), "246810");
        await click(document.querySelector("[data-publish]"));
        return "done";
      },
    }).execute("publish_changes", "{}");

    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error(result.error.message);
    expect(result.result).toMatchObject({ handoff: { actor: "user" } });
    expect(document.querySelector(".release__status")?.textContent).toBe("Published");
  });

  it("localizes approval and handoff copy", async () => {
    const pling = await mountApp("zh");
    const actions = pling.registry.snapshot().actions;

    expect(actions.find((action) => action.id === "archive_workspace")?.description).toContain("归档");
    expect(actions.find((action) => action.id === "publish_changes")?.handoff?.reason).toContain("验证码");
    expect(document.body.textContent).toContain("重置工作区");
  });

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
