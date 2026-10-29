import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

export const BRIDGE_PROTOCOL = "pling.bridge/0.1";
const DEFAULT_APP_URL = "http://localhost:5191/external-agent-surface/?mcp=1";

export class BridgeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
  }
}

/**
 * Loopback transport between the browser page and the stdio MCP server.
 *
 * It forwards Surface describe / invoke only. It does not inspect the DOM, execute
 * business functions, or approve a pending action.
 */
export class SurfaceBridge {
  constructor(options = {}) {
    this.host = options.host ?? "127.0.0.1";
    this.port = options.port ?? 5283;
    this.token = options.token ?? "pling-todo-local";
    this.appUrl = options.appUrl ?? DEFAULT_APP_URL;
    this.allowedOrigins = new Set(options.allowedOrigins ?? defaultOrigins(this.appUrl));
    this.requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
    this.wss = null;
    this.page = null;
    this.entries = new Map();
    this.connectionWaiters = new Set();
  }

  async start() {
    if (this.wss) return this.address();
    this.wss = new WebSocketServer({ host: this.host, port: this.port, maxPayload: 256 * 1024 });
    this.wss.on("connection", (socket, request) => this.#onConnection(socket, request));
    await new Promise((resolve, reject) => {
      const onError = (error) => {
        this.wss?.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        this.wss?.off("error", onError);
        resolve();
      };
      this.wss.once("error", onError);
      this.wss.once("listening", onListening);
    });
    return this.address();
  }

  address() {
    const address = this.wss?.address();
    const port = typeof address === "object" && address ? address.port : this.port;
    return { host: this.host, port, url: `ws://${this.host}:${port}/surface` };
  }

  async stop() {
    for (const entry of this.entries.values()) {
      this.#settle(entry, this.#failure(entry, "BRIDGE_CLOSED", "MCP bridge closed"));
    }
    this.entries.clear();
    this.page?.socket.close(1001, "bridge stopped");
    this.page = null;
    if (!this.wss) return;
    await new Promise((resolve) => this.wss.close(() => resolve()));
    this.wss = null;
  }

  async waitForPage(timeoutMs = 3_000) {
    if (this.page) return;
    await new Promise((resolve, reject) => {
      const done = () => {
        clearTimeout(timer);
        this.connectionWaiters.delete(done);
        resolve();
      };
      const timer = setTimeout(() => {
        this.connectionWaiters.delete(done);
        reject(new BridgeError("PAGE_NOT_CONNECTED", "Open the Todo page with ?mcp=1 before calling the MCP tools."));
      }, timeoutMs);
      this.connectionWaiters.add(done);
    });
  }

  async describe() {
    await this.waitForPage();
    const entry = this.#createEntry("describe");
    this.#send(entry, (requestId) => ({
      type: "request",
      requestId,
      request: { protocol: "pling.surface/0.1", id: requestId, method: "describe" },
    }));
    const event = await this.#waitFirst(entry);
    if (!event.response?.ok) {
      throw new BridgeError(event.response?.error?.code ?? "INTERNAL_ERROR", event.response?.error?.message ?? "The page did not return describe data");
    }
    return event.response.result;
  }

  async invoke(capability, input = {}) {
    await this.waitForPage();
    if (typeof capability !== "string" || !capability.trim()) {
      throw new BridgeError("INVALID_REQUEST", "capability must be a non-empty string");
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BridgeError("INVALID_REQUEST", "input must be an object");
    }
    const entry = this.#createEntry("invoke", capability);
    this.#send(entry, (requestId) => ({
      type: "request",
      requestId,
      request: { protocol: "pling.surface/0.1", id: requestId, method: "invoke", capability, input },
    }));
    return this.#waitFirst(entry);
  }

  status(requestId) {
    const entry = this.entries.get(String(requestId ?? ""));
    if (!entry) {
      return { state: "not_found", requestId: String(requestId ?? ""), message: "Unknown request id; it may have expired." };
    }
    if (entry.response) return this.#done(entry);
    if (entry.approval) {
      return {
        state: "pending_approval",
        requestId: entry.requestId,
        capability: entry.capability,
        approval: this.#approvalView(entry),
      };
    }
    return { state: "waiting", requestId: entry.requestId, capability: entry.capability };
  }

  #onConnection(socket, request) {
    const origin = request.headers.origin;
    if (!origin || !this.allowedOrigins.has(origin)) {
      socket.close(1008, "origin not allowed");
      return;
    }
    let url;
    try {
      url = new URL(request.url ?? "/", `http://${request.headers.host ?? this.host}`);
    } catch {
      socket.close(1008, "bad url");
      return;
    }
    if (url.pathname !== "/surface" || url.searchParams.get("token") !== this.token) {
      socket.close(1008, "token not allowed");
      return;
    }
    socket.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        socket.close(1003, "invalid json");
        return;
      }
      this.#onMessage(socket, message);
    });
    socket.on("close", () => this.#onPageClosed(socket));
    socket.on("error", () => {});
  }

  #onMessage(socket, message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "hello") {
      if (message.protocol !== BRIDGE_PROTOCOL) {
        socket.close(1002, "protocol mismatch");
        return;
      }
      if (this.page?.socket && this.page.socket !== socket) {
        this.page.socket.close(1012, "replaced by a newer page connection");
        this.#failInflight("PAGE_REPLACED", "The business page reconnected; start the task again on the current page.");
      }
      this.page = { socket, app: typeof message.app === "string" ? message.app : "unknown" };
      socket.send(JSON.stringify({ type: "hello_ack", protocol: BRIDGE_PROTOCOL }));
      for (const waiter of [...this.connectionWaiters]) waiter();
      return;
    }
    if (!this.page || this.page.socket !== socket) return;

    if (message.type === "approval_pending" && typeof message.requestId === "string") {
      const entry = this.entries.get(message.requestId);
      if (!entry || entry.response) return;
      entry.approval = {
        description: String(message.approval?.description ?? entry.capability ?? "This operation needs confirmation"),
        args: message.approval?.args && typeof message.approval.args === "object" ? message.approval.args : {},
        kind: String(message.approval?.kind ?? "write"),
        expiresAt: Number(message.approval?.expiresAt) || Date.now() + 120_000,
      };
      entry.state = "pending_approval";
      this.#settle(entry, {
        state: "pending_approval",
        requestId: entry.requestId,
        capability: entry.capability,
        approval: this.#approvalView(entry),
      });
      return;
    }

    if (message.type === "response" && typeof message.requestId === "string") {
      const entry = this.entries.get(message.requestId);
      if (!entry) return;
      entry.response = message.response;
      entry.state = "done";
      this.#settle(entry, this.#done(entry));
    }
  }

  #onPageClosed(socket) {
    if (this.page?.socket !== socket) return;
    this.page = null;
    this.#failInflight("PAGE_DISCONNECTED", "The Todo page disconnected. Reopen it and start the call again.");
  }

  #createEntry(kind, capability) {
    const requestId = `pling_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
    const entry = { requestId, kind, capability, state: "inflight", approval: null, response: null, first: null };
    this.entries.set(requestId, entry);
    return entry;
  }

  #send(entry, build) {
    const socket = this.page?.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new BridgeError("PAGE_NOT_CONNECTED", "The Todo page is disconnected. Reopen it with ?mcp=1.");
    }
    socket.send(JSON.stringify(build(entry.requestId)));
  }

  #waitFirst(entry) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        entry.first = null;
        entry.response = this.#failure(entry, "BRIDGE_TIMEOUT", "Timed out waiting for the Todo page.");
        entry.state = "done";
        reject(new BridgeError("BRIDGE_TIMEOUT", entry.response.error.message));
      }, this.requestTimeoutMs);
      entry.first = {
        resolve: (value) => {
          clearTimeout(timer);
          entry.first = null;
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          entry.first = null;
          reject(error);
        },
      };
    });
  }

  #settle(entry, value) {
    entry.first?.resolve(value);
  }

  #approvalView(entry) {
    const url = new URL(this.appUrl);
    url.searchParams.set("mcp", "1");
    url.searchParams.set("approval", entry.requestId);
    return {
      approvalId: entry.requestId,
      requestId: entry.requestId,
      capability: entry.capability,
      description: entry.approval?.description ?? "This operation needs confirmation",
      args: entry.approval?.args ?? {},
      kind: entry.approval?.kind ?? "write",
      expiresAt: entry.approval?.expiresAt ?? Date.now() + 120_000,
      reviewUrl: url.toString(),
      canApproveFromAgent: false,
    };
  }

  #done(entry) {
    return {
      state: "done",
      requestId: entry.requestId,
      capability: entry.capability,
      response: entry.response,
      ...(entry.approval ? { approval: this.#approvalView(entry) } : {}),
    };
  }

  #failure(entry, code, message) {
    return {
      protocol: "pling.surface/0.1",
      id: entry.requestId,
      ok: false,
      error: { code, message },
    };
  }

  #failInflight(code, message) {
    for (const entry of this.entries.values()) {
      if (entry.response) continue;
      entry.response = this.#failure(entry, code, message);
      entry.state = "done";
      this.#settle(entry, this.#done(entry));
    }
  }
}

function defaultOrigins(appUrl) {
  const origin = new URL(appUrl).origin;
  const origins = new Set([origin]);
  if (origin.includes("localhost")) origins.add(origin.replace("localhost", "127.0.0.1"));
  if (origin.includes("127.0.0.1")) origins.add(origin.replace("127.0.0.1", "localhost"));
  return [...origins];
}
