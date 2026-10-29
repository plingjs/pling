import { BridgeError } from "./surface-bridge.mjs";

const TOOLS = [
  {
    name: "pling_surface_describe",
    description: "Read the current Todo page surface: capabilities, input schemas, records, and visible state. Call this before invoking a business operation.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "pling_surface_invoke",
    description: "Invoke one capability returned by describe. If state is pending_approval, ask the user to confirm on the already-open page; never claim the operation is approved.",
    inputSchema: {
      type: "object",
      properties: {
        capability: { type: "string", description: "Capability id, for example todo.add or todo.toggle." },
        input: { type: "object", additionalProperties: true },
      },
      required: ["capability"],
      additionalProperties: false,
    },
  },
  {
    name: "pling_surface_approval_status",
    description: "Read the result of a pending invocation. The agent cannot approve from this tool.",
    inputSchema: {
      type: "object",
      properties: { requestId: { type: "string" } },
      required: ["requestId"],
      additionalProperties: false,
    },
  },
];

const text = (value) => ({ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) });
const errorText = (message) => ({ content: [text(message)], isError: true });

export function createMcpHandler({ bridge, serverVersion = "0.1.0" }) {
  const callTool = async (name, args) => {
    if (name === "pling_surface_describe") {
      try {
        return { content: [text(await bridge.describe())] };
      } catch (error) {
        return errorText(toMessage(error));
      }
    }
    if (name === "pling_surface_invoke") {
      try {
        if (typeof args.capability !== "string" || !args.capability.trim()) {
          return errorText("INVALID_REQUEST: capability must be a non-empty string");
        }
        if (args.input !== undefined && (!args.input || typeof args.input !== "object" || Array.isArray(args.input))) {
          return errorText("INVALID_REQUEST: input must be an object");
        }
        const result = await bridge.invoke(args.capability, args.input ?? {});
        if (result.state === "pending_approval") {
          return {
            content: [
              text(
                `Waiting for user confirmation: ${result.approval.description}\n` +
                  `reviewUrl: ${result.approval.reviewUrl}\n` +
                  `requestId: ${result.requestId}\n\n` +
                  "Ask the user to confirm on the already-open Todo page. Do not open another page or claim approval. Afterwards call pling_surface_approval_status.",
              ),
            ],
          };
        }
        return { content: [text(result.response)] };
      } catch (error) {
        return errorText(toMessage(error));
      }
    }
    if (name === "pling_surface_approval_status") {
      if (typeof args.requestId !== "string" || !args.requestId.trim()) {
        return errorText("INVALID_REQUEST: requestId must be a non-empty string");
      }
      return { content: [text(bridge.status(args.requestId))] };
    }
    return errorText(`Unknown tool: ${name}`);
  };

  return {
    async handle(method, params = {}) {
      if (method === "initialize") {
        return {
          protocolVersion: typeof params.protocolVersion === "string" ? params.protocolVersion : "2024-11-05",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "pling-todo-surface", version: serverVersion },
          instructions: "Call pling_surface_describe first. Use only the returned capabilities. A destructive invoke may return pending_approval; the user must confirm on the page.",
        };
      }
      if (method === "ping") return {};
      if (method === "tools/list") return { tools: TOOLS };
      if (method === "tools/call") {
        const name = typeof params.name === "string" ? params.name : "";
        const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
        return callTool(name, args);
      }
      throw new BridgeError("METHOD_NOT_FOUND", `Unsupported MCP method: ${method}`);
    },
  };
}

function toMessage(error) {
  if (error instanceof BridgeError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
