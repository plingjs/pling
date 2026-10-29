import { SURFACE_PROTOCOL, type AgentSurface, type SurfaceResponse } from "@plingjs/surface";
import { watch } from "vue";
import type { ExternalApproval } from "./approval";
import type { SurfaceTransport } from "./transport";

interface SurfaceRequestMessage {
  type: "request";
  requestId: string;
  request: unknown;
}

/**
 * Connects the Surface protocol kernel to the page's WebSocket transport.
 *
 * `invoke` is serialized so one human approval can be tied to one request.
 * `describe` remains available while a confirmation is pending.
 */
export function createSurfaceBridge(options: {
  surface: AgentSurface;
  transport: SurfaceTransport;
  approval: ExternalApproval;
}) {
  let queue = Promise.resolve();
  let active: { requestId: string; input: Record<string, unknown> } | null = null;

  const offApproval = subscribeApproval(options.approval, (request) => {
    if (!active || !request) return;
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
      offApproval();
      off();
      queue = Promise.resolve();
      active = null;
    },
  };
}

function subscribeApproval(approval: ExternalApproval, handler: (request: ExternalApproval["current"]["value"]) => void) {
  return watch(approval.current, (request) => handler(request ?? null), { immediate: true, flush: "sync" });
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
