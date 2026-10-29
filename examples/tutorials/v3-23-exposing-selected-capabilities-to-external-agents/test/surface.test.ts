import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { SURFACE_PROTOCOL, type AgentSurface, type SurfaceResponse } from "@plingjs/surface";
import { createPling } from "@plingjs/vue";
import App from "../src/App.vue";
import { createTodoSurface } from "../src/surface";

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

async function setup(locale: "en" | "zh" = "en") {
  const pling = createPling({
    diagnostics: false,
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: { llm: createReplayLlm([]) },
  });
  const wrapper = mount(App, {
    attachTo: document.body,
    props: { locale },
    global: { plugins: [pling.plugin] },
  });
  cleanup = () => { wrapper.unmount(); pling.destroy(); };
  await nextTick();
  const vm = wrapper.vm as unknown as { surface: AgentSurface };
  return { pling, surface: vm.surface, wrapper };
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

describe("V3-23 · external capability surface", () => {
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
    const { surface, wrapper } = await setup();
    const response = await surface.handle(
      request("invoke", { capability: "todo.add", input: { text: "Review the surface allowlist" } }),
    );
    await nextTick();

    expect(response).toMatchObject({ ok: true, result: { result: { ok: true } } });
    expect(wrapper.findAll(".tasks li")[0]?.text()).toContain("Review the surface allowlist");
  });

  it("fails closed before the executor for an unexposed capability", async () => {
    const { surface } = await setup();
    const before = surface.describe().context.records.map((record) => record.id);
    const response = await surface.handle(
      request("invoke", { capability: "todo.remove@task:t1" }),
    );

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
    const { surface, wrapper } = await setup();
    const before = surface.describe().context.records.map((record) => record.id);
    const pending = surface.handle(request("invoke", { capability: "todo.clear_completed" }));
    await waitFor(() => wrapper.find('[data-testid="approval"]').exists());

    expect(wrapper.find('[data-testid="approval"]').exists()).toBe(true);
    await wrapper.get('[data-testid="approval-deny"]').trigger("click");
    const denied = await pending;
    expect(responseError(denied)).toBe("PERMISSION_DENIED");
    expect(surface.describe().context.records.map((record) => record.id)).toEqual(before);

    const allowed = surface.handle(request("invoke", { capability: "todo.clear_completed" }));
    await waitFor(() => wrapper.find('[data-testid="approval-allow"]').exists());
    await wrapper.get('[data-testid="approval-allow"]').trigger("click");
    expect(await allowed).toMatchObject({ ok: true });
    await nextTick();
    expect(surface.describe().context.records.map((record) => record.id)).toEqual(["t1", "t3"]);
  });

  it("localizes the page, capability descriptions, and approval copy", async () => {
    const { surface, wrapper } = await setup("zh");
    const description = surface.describe();

    expect(wrapper.get("h1").text()).toContain("开放少量业务能力");
    expect(description.capabilities.find((capability) => capability.id === "todo.add")?.description).toContain("新增");
    expect(wrapper.text()).toContain("外部 Agent 控制台");
  });
});
