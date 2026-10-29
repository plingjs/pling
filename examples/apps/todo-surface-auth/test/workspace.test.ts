import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createSurface, SURFACE_PROTOCOL } from "@plingjs/surface";
import { createPling } from "@plingjs/vue";
import TodoWorkspace from "../src/components/TodoWorkspace.vue";
import ExternalApprovalPanel from "../src/components/ExternalApprovalPanel.vue";
import SurfacePanel from "../src/components/SurfacePanel.vue";
import { createExternalApproval } from "../src/surface/approval";
import type { Todo, User } from "../src/api";

const user: User = { id: "u_1", email: "ada@example.com", name: "Ada" };
const initialTodos: Todo[] = [
  { id: "t1", text: "Review the launch checklist", done: false },
  { id: "t2", text: "Send the customer follow-up", done: true },
];

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("authenticated Todo Surface demo", () => {
  it("exposes one business action, folded row actions, records, and read-only state", async () => {
    const pling = createPling({ presence: false, ui: { locale: "en-US" }, onWarn: () => {} });
    const wrapper = mount(TodoWorkspace, {
      attachTo: document.body,
      props: { user, initialTodos },
      global: { plugins: [pling.plugin] },
    });
    await flushPromises();

    const snapshot = pling.registry.snapshot();
    const ids = snapshot.actions.map((action) => action.id);
    expect(ids).toEqual(
      expect.arrayContaining(["add_task", "toggle@t1", "toggle@t2", "delete@t1", "delete@t2", "clear_completed"]),
    );
    expect(snapshot.records).toEqual([
      expect.objectContaining({
        id: "t1",
        fields: expect.objectContaining({
          label: "Review the launch checklist",
          fields: { status: "open", text: "Review the launch checklist" },
        }),
      }),
      expect.objectContaining({
        id: "t2",
        fields: expect.objectContaining({
          label: "Send the customer follow-up",
          fields: { status: "completed", text: "Send the customer follow-up" },
        }),
      }),
    ]);
    expect(snapshot.state.todo).toMatchObject({ total: 2, open: 1, completed: 1 });

    wrapper.unmount();
  });

  it("keeps manual form submission and the declared add_task action on one business path", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/todos");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({ text: "Write the weekly report" });
      return Response.json({ todo: { id: "t3", text: "Write the weekly report", done: false } }, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pling = createPling({ presence: false, ui: { locale: "en-US" }, onWarn: () => {} });
    const wrapper = mount(TodoWorkspace, {
      attachTo: document.body,
      props: { user, initialTodos },
      global: { plugins: [pling.plugin] },
    });
    await wrapper.find("#new-task").setValue("Write the weekly report");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(wrapper.findAll(".item__text").map((node) => node.text())).toContain("Write the weekly report");
    expect((wrapper.find("#new-task").element as HTMLInputElement).value).toBe("");
    wrapper.unmount();
  });

  it("requires page-side human approval before an external Agent can delete a record", async () => {
    let deleted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("/api/todos/t1");
        expect(init?.method).toBe("DELETE");
        deleted = true;
        return Response.json({ todo: initialTodos[0] });
      }),
    );

    const pling = createPling({ presence: false, ui: { locale: "en-US" }, onWarn: () => {} });
    const wrapper = mount(TodoWorkspace, {
      attachTo: document.body,
      props: { user, initialTodos },
      global: { plugins: [pling.plugin] },
    });
    await flushPromises();

    const approval = createExternalApproval({ timeoutMs: 10_000 });
    const executor = createExecutor({
      registry: pling.registry,
      policy: createPolicy(approval.confirm),
      settle: async () => {},
    });
    const surface = createSurface({
      registry: pling.registry,
      expose: ["delete@"],
      session: {
        agentId: "codex",
        sessionId: "as_1",
        userId: user.id,
        expiresAt: Date.now() + 60_000,
        scope: ["delete@"],
      },
      execute: (id, args) => executor.execute(id, args),
    });

    const pending = surface.handle({
      protocol: SURFACE_PROTOCOL,
      id: "req_delete_1",
      method: "invoke",
      capability: "delete",
      input: { record: "t1" },
    });
    await waitUntil(() => approval.current.value !== null);

    expect(deleted).toBe(false);
    expect(approval.current.value).toMatchObject({
      id: "delete@t1",
      kind: "danger",
      args: {},
    });
    expect(approval.current.value?.description).toContain("Review the launch checklist");

    approval.decide(true);
    const response = await pending;
    await flushPromises();

    expect(response).toMatchObject({ ok: true, id: "req_delete_1" });
    expect(deleted).toBe(true);
    expect(wrapper.findAll(".item__text").map((node) => node.text())).not.toContain("Review the launch checklist");
    wrapper.unmount();
    approval.close();
  });

  it("renders pairing details without leaking the page token", async () => {
    const wrapper = mount(SurfacePanel, {
      props: {
        connection: "connected",
        page: {
          pageSessionId: "ps_1",
          pageToken: "plg_page_secret",
          expiresAt: Date.now() + 60_000,
          tenantId: "demo",
          surfaceUrl: "ws://127.0.0.1:5219/surface?token=plg_page_secret",
          pairingUrl: "http://127.0.0.1:5219/v1/pairings",
          agentSessionsUrl: "http://127.0.0.1:5219/v1/agent-sessions",
          mcpUrl: "http://127.0.0.1:5219/mcp",
          scope: ["add_task", "delete@"],
        },
        pairing: {
          code: "ABCD-EFGH",
          tenantId: "demo",
          tenantName: "Pling Todo Demo",
          mcpUrl: "http://127.0.0.1:5219/mcp",
          expiresAt: Date.now() + 60_000,
          scope: ["add_task", "delete@"],
        },
        agent: null,
        busy: "",
        error: "",
      },
    });

    expect(wrapper.text()).toContain("ABCD-EFGH");
    expect(wrapper.text()).toContain("http://127.0.0.1:5219/mcp");
    expect(wrapper.text()).toContain("surface:claim ABCD-EFGH --agent codex");
    expect(wrapper.html()).not.toContain("plg_page_secret");
    wrapper.unmount();
  });

  it("replaces an expired pairing code with a clear retry action", () => {
    const wrapper = mount(SurfacePanel, {
      props: {
        connection: "connected",
        page: {
          pageSessionId: "ps_1",
          pageToken: "plg_page_secret",
          expiresAt: Date.now() + 60_000,
          tenantId: "demo",
          surfaceUrl: "ws://127.0.0.1:5219/surface?token=plg_page_secret",
          pairingUrl: "http://127.0.0.1:5219/v1/pairings",
          agentSessionsUrl: "http://127.0.0.1:5219/v1/agent-sessions",
          mcpUrl: "http://127.0.0.1:5219/mcp",
          scope: ["add_task", "delete@"],
        },
        pairing: {
          code: "OLD-CODE",
          tenantId: "demo",
          tenantName: "Pling Todo Demo",
          mcpUrl: "http://127.0.0.1:5219/mcp",
          expiresAt: Date.now() - 1,
          scope: ["add_task", "delete@"],
        },
        agent: null,
        busy: "",
        error: "",
      },
    });

    expect(wrapper.text()).toContain("Pairing expired");
    expect(wrapper.text()).toContain("Create a new pairing code");
    expect(wrapper.text()).not.toContain("OLD-CODE");
    wrapper.unmount();
  });

  it("emits only the human decision from the approval panel", () => {
    const wrapper = mount(ExternalApprovalPanel, {
      props: {
        request: {
          id: "delete@t1",
          kind: "danger",
          approval: "ask-always",
          description: "Permanently delete “Review the launch checklist”.",
          args: { record: "t1" },
          requestedAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        },
      },
    });

    expect(wrapper.text()).toContain("cannot approve its own request");
    return wrapper
      .find('[data-testid="external-allow"]')
      .trigger("click")
      .then(() => {
        expect(wrapper.emitted("decide")).toEqual([[true]]);
        wrapper.unmount();
      });
  });
});

async function waitUntil(read: () => boolean, timeoutMs = 2_000): Promise<void> {
  const started = Date.now();
  while (!read()) {
    if (Date.now() - started > timeoutMs) throw new Error("Timed out waiting for state change");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
