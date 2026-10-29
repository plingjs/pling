import { SURFACE_PROTOCOL, type AgentSurface, type SurfaceResponse } from "@plingjs/surface";
import type { SurfaceApprovalSource, SurfaceTransport } from "./types";

interface SurfaceRequestMessage {
  type: "request";
  requestId: string;
  request: unknown;
}

export interface SurfaceBridgeOptions {
  surface: AgentSurface;
  transport: SurfaceTransport;
  approval?: SurfaceApprovalSource;
}

export interface SurfaceBridge {
  close(): void;
}

/**
 * Connect the Surface protocol kernel to the page transport.
 *
 * `invoke` is serialized so one confirmation belongs to one invocation.
 * `describe` can still run while an invocation is awaiting a human decision.
 * Approval UI stays in the host page; only its pending state crosses the bridge.
 */
export function createSurfaceBridge(options: SurfaceBridgeOptions): SurfaceBridge {
  let queue = Promise.resolve();
  let active: { requestId: string; input: Record<string, unknown> } | null = null;

  const offApproval = options.approval?.subscribe((request) => {
    if (!request || !active) return;
    options.transport.post({
      type: "approval_pending",
      requestId: active.requestId,
      approval: {
        description: request.description,
        args: active.input,
        kind: request.kind,
        expiresAt: request.expiresAt,
        ...(request.flow ? { flow: request.flow } : {}),
      },
    });
  });

  const off = options.transport.subscribe((message) => {
    if (!isRecord(message) || message.type !== "request" || typeof message.requestId !== "string") return;
    const request = message as unknown as SurfaceRequestMessage;
    if (isRecord(request.request) && request.request.method === "invoke") {
      queue = queue.then(() => run(request)).catch(() => {});
      return;
    }
    void run(request);
  });

  async function run(message: SurfaceRequestMessage): Promise<void> {
    if (isRecord(message.request) && message.request.method === "invoke") {
      active = { requestId: message.requestId, input: isRecord(message.request.input) ? message.request.input : {} };
    }
    try {
      const response = await options.surface.handle(message.request);
      options.transport.post({ type: "response", requestId: message.requestId, response });
    } catch (error) {
      options.transport.post({
        type: "response",
        requestId: message.requestId,
        response: failure(message.requestId, error),
      });
    } finally {
      if (active?.requestId === message.requestId) active = null;
    }
  }

  return {
    close() {
      offApproval?.();
      off();
      queue = Promise.resolve();
      active = null;
    },
  };
}

function failure(id: string, error: unknown): SurfaceResponse {
  return {
    protocol: SURFACE_PROTOCOL,
    id,
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
