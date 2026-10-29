import type { ConfirmRequest, Kind } from "@plingjs/core";
import type { AgentSurface } from "@plingjs/surface";
import { describe, expect, it, vi } from "vitest";
import {
  createSurfaceBridge,
  type SurfaceApprovalRequest,
  type SurfaceConnectionState,
  type SurfaceTransport,
} from "../src";

function transportStub() {
  const listeners = new Set<(message: unknown) => void>();
  const posted: unknown[] = [];
  const transport: SurfaceTransport = {
    state: "connected" as SurfaceConnectionState,
    agent: null,
    post(message) {
      posted.push(message);
    },
    subscribe(handler) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
    subscribeState() {
      return () => {};
    },
    close() {},
  };
  return {
    transport,
    posted,
    request(value: unknown) {
      for (const listener of listeners) listener({ type: "request", requestId: "r1", request: value });
    },
  };
}

function approvalStub() {
  const listeners = new Set<(request: SurfaceApprovalRequest | null) => void>();
  return {
    source: {
      subscribe(listener: (request: SurfaceApprovalRequest | null) => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    emit(request: SurfaceApprovalRequest | null) {
      for (const listener of listeners) listener(request);
    },
  };
}

function confirmRequest(): SurfaceApprovalRequest {
  return {
    id: "todo.delete",
    kind: "danger" as Kind,
    approval: "ask-always",
    description: "删除待办",
    args: { taskId: "t1" },
    expiresAt: Date.now() + 10_000,
  } satisfies ConfirmRequest & { expiresAt: number };
}

describe("createSurfaceBridge", () => {
  it("forwards describe responses", async () => {
    const fake = transportStub();
    const handle = vi.fn(async () => ({ protocol: "pling.surface/0.1" as const, id: "r1", ok: true as const, result: {} }));
    const bridge = createSurfaceBridge({
      surface: { protocol: "pling.surface/0.1", describe: vi.fn(), handle } as unknown as AgentSurface,
      transport: fake.transport,
    });

    fake.request({ protocol: "pling.surface/0.1", id: "r1", method: "describe" });
    await vi.waitFor(() => expect(fake.posted).toHaveLength(1));
    expect(handle).toHaveBeenCalledWith({ protocol: "pling.surface/0.1", id: "r1", method: "describe" });
    bridge.close();
  });

  it("serializes invokes and relays the active human approval", async () => {
    const fake = transportStub();
    const approval = approvalStub();
    let releaseFirst!: () => void;
    const first = new Promise<void>((resolve) => (releaseFirst = resolve));
    const handle = vi.fn(async (request: unknown) => {
      const id = (request as { id: string }).id;
      if (id === "r1") await first;
      return { protocol: "pling.surface/0.1" as const, id, ok: true as const, result: {} };
    });
    const bridge = createSurfaceBridge({
      surface: { protocol: "pling.surface/0.1", describe: vi.fn(), handle } as unknown as AgentSurface,
      transport: fake.transport,
      approval: approval.source,
    });

    fake.request({ protocol: "pling.surface/0.1", id: "r1", method: "invoke", capability: "todo.delete", input: { taskId: "t1" } });
    fake.request({ protocol: "pling.surface/0.1", id: "r2", method: "invoke", capability: "todo.add", input: { text: "x" } });
    await vi.waitFor(() => expect(handle).toHaveBeenCalledTimes(1));

    approval.emit(confirmRequest());
    expect(fake.posted[0]).toMatchObject({
      type: "approval_pending",
      requestId: "r1",
      approval: { description: "删除待办", kind: "danger", args: { taskId: "t1" } },
    });

    releaseFirst();
    await vi.waitFor(() => expect(handle).toHaveBeenCalledTimes(2));
    bridge.close();
  });

  it("turns bridge failures into a protocol response", async () => {
    const fake = transportStub();
    const bridge = createSurfaceBridge({
      surface: {
        protocol: "pling.surface/0.1",
        describe: vi.fn(),
        handle: async () => {
          throw new Error("boom");
        },
      } as unknown as AgentSurface,
      transport: fake.transport,
    });

    fake.request({ protocol: "pling.surface/0.1", id: "r1", method: "describe" });
    await vi.waitFor(() => expect(fake.posted).toHaveLength(1));
    expect(fake.posted[0]).toMatchObject({
      type: "response",
      response: { ok: false, error: { code: "INTERNAL_ERROR", message: "boom" } },
    });
    bridge.close();
  });
});
