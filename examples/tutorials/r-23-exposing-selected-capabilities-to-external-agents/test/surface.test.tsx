import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { SURFACE_PROTOCOL, type AgentSurface, type SurfaceResponse } from "@plingjs/surface";
import { createPling, PlingProvider } from "@plingjs/react";
import { App, type AppHandle } from "../src/App";
import { createTodoSurface } from "../src/surface";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let cleanup: (() => void) | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  cleanup?.();
  document.body.innerHTML = "";
  root = null;
  cleanup = null;
});

async function setup(locale: "en" | "zh" = "en") {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const app = createRef<AppHandle>();
  const pling = createPling({
    presence: false,
    onWarn: () => {},
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: { llm: createReplayLlm([]) },
  });
  await act(async () => {
    root!.render(
      <PlingProvider pling={pling}>
        <App ref={app} locale={locale} />
      </PlingProvider>,
    );
  });
  cleanup = () => pling.destroy();
  return { pling, app, surface: app.current!.surface };
}

function request(method: "describe" | "invoke", extra: Record<string, unknown> = {}) {
  return { protocol: SURFACE_PROTOCOL, id: `test-${method}-${Math.random()}`, method, ...extra };
}

function responseError(response: SurfaceResponse): string | undefined {
  if (!response.ok) return response.error.code;
  if ("error" in response.result) return response.result.error.code;
  return undefined;
}

async function waitFor(read: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (read()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for the expected UI state");
}

describe("R-23 · external capability surface", () => {
  it("publishes only the allowlisted capabilities and a bounded context", async () => {
    const { surface } = await setup();
    const response = await surface.handle(request("describe", { input: { limit: 2 } }));
    if (!response.ok || !("context" in response.result)) {
      throw new Error(response.ok ? "describe returned a non-description result" : response.error.message);
    }
    const description = response.result;
    const ids = description.capabilities.map((capability) => capability.id);

    expect(description.protocol).toBe(SURFACE_PROTOCOL);
    expect(description.app).toBe("tutorial-todo-surface");
    expect(ids).toEqual(expect.arrayContaining(["todo.overview", "todo.add", "todo.clear_completed"]));
    expect(ids.some((id) => id.startsWith("todo.remove@task"))).toBe(false);
    expect(ids.some((id) => id.startsWith("todo.toggle@task"))).toBe(false);
    expect(description.context.records.map((record) => record.id)).toEqual(["t1", "t2"]);
    expect(description.context.recordIds).toEqual(["t1", "t2", "t3"]);
    expect(description.context.recordWindow).toMatchObject({ offset: 0, limit: 2, returned: 2, total: 3, next: 2 });
    expect(description.capabilities.find((capability) => capability.id === "todo.clear_completed")).toMatchObject({
      effect: "destructive",
      approval: "always",
    });
  });

  it("invokes an allowed write through the same executor and visible handler", async () => {
    const { surface } = await setup();
    let response: SurfaceResponse | null = null;
    await act(async () => {
      response = await surface.handle(
        request("invoke", { capability: "todo.add", input: { text: "Review the surface allowlist" } }),
      );
    });

    expect(response).toMatchObject({ ok: true, result: { result: { ok: true } } });
    expect(document.querySelector(".tasks li")?.textContent).toContain("Review the surface allowlist");
  });

  it("fails closed before the executor for an unexposed capability", async () => {
    const { surface } = await setup();
    const before = surface.describe().context.records.map((record) => record.id);
    const response = await surface.handle(request("invoke", { capability: "todo.remove@task:t1" }));

    expect(responseError(response)).toBe("CAPABILITY_NOT_EXPOSED");
    expect(surface.describe().context.records.map((record) => record.id)).toEqual(before);
  });

  it("intersects the session scope with the site-wide expose list", async () => {
    const { pling } = await setup();
    const narrow = createTodoSurface(pling.registry, async () => true, ["todo.overview"]);
    const described = await narrow.surface.handle(request("describe", { input: { limit: 2 } }));
    if (!described.ok || !("context" in described.result)) {
      throw new Error(described.ok ? "describe returned a non-description result" : described.error.message);
    }

    expect(described.result.capabilities.map((capability) => capability.id)).toEqual(["todo.overview"]);
    const invoke = await narrow.surface.handle(
      request("invoke", { capability: "todo.add", input: { text: "Outside session scope" } }),
    );
    expect(responseError(invoke)).toBe("CAPABILITY_NOT_EXPOSED");
  });

  it("requires a page-side human decision for a destructive action", async () => {
    const { surface } = await setup();
    const before = surface.describe().context.records.map((record) => record.id);
    let pending!: Promise<SurfaceResponse>;
    await act(async () => {
      pending = surface.handle(request("invoke", { capability: "todo.clear_completed" }));
    });
    await waitFor(() => Boolean(document.querySelector('[data-testid="approval"]')));

    await act(async () => {
      (document.querySelector('[data-testid="approval-deny"]') as HTMLButtonElement).click();
    });
    expect(responseError(await pending)).toBe("PERMISSION_DENIED");
    expect(surface.describe().context.records.map((record) => record.id)).toEqual(before);

    await act(async () => {
      pending = surface.handle(request("invoke", { capability: "todo.clear_completed" }));
    });
    await waitFor(() => Boolean(document.querySelector('[data-testid="approval-allow"]')));
    await act(async () => {
      (document.querySelector('[data-testid="approval-allow"]') as HTMLButtonElement).click();
    });
    expect(await pending).toMatchObject({ ok: true });
    expect(surface.describe().context.records.map((record) => record.id)).toEqual(["t1", "t3"]);
  });

  it("localizes the page, capability descriptions, and approval copy", async () => {
    const { surface } = await setup("zh");
    const description = surface.describe();

    expect(document.querySelector("h1")?.textContent).toContain("开放少量业务能力");
    expect(description.capabilities.find((capability) => capability.id === "todo.add")?.description).toContain("新增");
    expect(document.body.textContent).toContain("外部 Agent 控制台");
  });
});
