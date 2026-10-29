import { ref, type Ref } from "vue";
import { SURFACE_PROTOCOL, type AgentSurface, type SurfaceResponse } from "@plingjs/surface";
import type { ApprovalRequest } from "./approval";

export const BRIDGE_PROTOCOL = "pling.bridge/0.1";
export type BridgeConnectionState = "connecting" | "connected" | "disconnected";

interface RequestMessage {
  type: "request";
  requestId: string;
  request: {
    protocol?: string;
    id?: string;
    method?: string;
    capability?: string;
    input?: Record<string, unknown>;
  };
}

export interface McpBridgeOptions {
  surface: AgentSurface;
  approval: { subscribe(listener: (request: ApprovalRequest | null) => void): () => void };
  app?: string;
  port?: number;
  token?: string;
}

export interface McpBridge {
  state: Ref<BridgeConnectionState>;
  url: string;
  close(): void;
}

/**
 * 页面侧的最小 loopback 桥。
 *
 * 浏览器只连接 127.0.0.1。它不读取 DOM、不执行任意脚本；每个请求仍交给
 * `@plingjs/surface` 和现有 executor。审批由页面上的真人完成，MCP 客户端只收到
 * `pending_approval`，没有“代批准”工具。
 */
export function installMcpBridge(options: McpBridgeOptions): McpBridge {
  const params = new URLSearchParams(location.search);
  const port = Number(params.get("bridgePort")) || options.port || 5283;
  const token = params.get("bridgeToken") || options.token || "pling-todo-local";
  const url = `ws://127.0.0.1:${port}/surface?token=${encodeURIComponent(token)}`;
  const state = ref<BridgeConnectionState>("connecting");
  let socket: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let queue: Promise<void> = Promise.resolve();
  let active: { requestId: string; input: Record<string, unknown>; approvalSent: boolean } | null = null;

  const post = (message: unknown): void => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  const connect = (): void => {
    if (closed) return;
    state.value = "connecting";
    const next = new WebSocket(url);
    socket = next;
    next.addEventListener("open", () => {
      if (socket !== next) return;
      state.value = "connected";
      next.send(JSON.stringify({ type: "hello", protocol: BRIDGE_PROTOCOL, app: options.app ?? "example-todo-surface" }));
    });
    next.addEventListener("message", (event) => {
      if (socket !== next) return;
      let message: RequestMessage;
      try {
        message = JSON.parse(String(event.data)) as RequestMessage;
      } catch {
        return;
      }
      if (message.type !== "request" || typeof message.requestId !== "string") return;
      const run = async () => {
        const input = message.request.input && typeof message.request.input === "object" ? message.request.input : {};
        active = { requestId: message.requestId, input, approvalSent: false };
        try {
          const response = await options.surface.handle(message.request);
          post({ type: "response", requestId: message.requestId, response });
        } catch (error) {
          const response: SurfaceResponse = {
            protocol: SURFACE_PROTOCOL,
            id: message.requestId,
            ok: false,
            error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error) },
          };
          post({ type: "response", requestId: message.requestId, response });
        } finally {
          active = null;
        }
      };
      if (message.request.method === "invoke") {
        queue = queue.then(run).catch(() => {});
      } else {
        void run();
      }
    });
    next.addEventListener("close", () => {
      if (socket === next) socket = null;
      if (closed) return;
      state.value = "disconnected";
      reconnectTimer = setTimeout(connect, 1_000);
    });
  };

  const offApproval = options.approval.subscribe((request) => {
    if (!request || !active || active.approvalSent) return;
    active.approvalSent = true;
    post({
      type: "approval_pending",
      requestId: active.requestId,
      approval: {
        description: request.description,
        args: active.input,
        kind: request.kind,
        expiresAt: request.expiresAt,
      },
    });
  });

  connect();
  return {
    state,
    url,
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      offApproval();
      socket?.close(1000, "page closed");
      socket = null;
    },
  };
}
