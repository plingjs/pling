import { GatewayError } from "./errors.mjs";

const TOOLS = [
  {
    name: "pling_surface_describe",
    description:
      "Read the currently paired business page: exposed capabilities, input schemas, records, regions, page state, and feedback. Call this before invoking an action.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "pling_surface_invoke",
    description:
      "Invoke one capability returned by pling_surface_describe. If the result is pending_approval, the user must confirm in the business page. The Agent cannot approve.",
    inputSchema: {
      type: "object",
      properties: {
        capability: { type: "string", description: "Stable capability id returned by describe" },
        input: { type: "object", description: "Business input declared by the capability schema", additionalProperties: true },
      },
      required: ["capability"],
      additionalProperties: false,
    },
  },
  {
    name: "pling_surface_approval_status",
    description:
      "Read the final status of an earlier Surface invocation. pending_approval means the user must finish confirmation in the business page.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: { type: "string", description: "requestId returned by pling_surface_invoke" },
      },
      required: ["requestId"],
      additionalProperties: false,
    },
  },
];

export function createMcpHandler(gateway) {
  return {
    async handle(body, context = {}) {
      if (!body || typeof body !== "object" || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
        return { error: { code: -32600, message: "Invalid Request" } };
      }
      if (body.id === undefined || body.id === null) return null;

      const id = body.id;
      try {
        const result = await dispatch(gateway, body.method, body.params ?? {}, context);
        return { jsonrpc: "2.0", id, result };
      } catch (error) {
        const code = error instanceof GatewayError && error.status === 401 ? -32001 : -32603;
        return {
          jsonrpc: "2.0",
          id,
          error: { code, message: error instanceof Error ? error.message : String(error) },
        };
      }
    },
  };
}

async function dispatch(gateway, method, params, context) {
  if (method === "initialize") {
    return {
      protocolVersion: typeof params.protocolVersion === "string" ? params.protocolVersion : "2025-03-26",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "pling-surface-gateway", version: "0.1.0" },
      instructions:
        "Pling Surface Gateway. The user must pair an open business page before tools work. Call pling_surface_describe first. " +
        "If pling_surface_invoke returns pending_approval, ask the user to confirm in the open business page and then call pling_surface_approval_status. " +
        "There is no approval tool; never claim an action was approved without a final response.",
    };
  }
  if (method === "ping") return {};
  if (method === "tools/list") return { tools: TOOLS };
  if (method === "tools/call") return callTool(gateway, params, context);
  throw new GatewayError("METHOD_NOT_FOUND", `Unsupported MCP method: ${method}`, 404);
}

async function callTool(gateway, params, context) {
  const name = typeof params.name === "string" ? params.name : "";
  const args = params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments) ? params.arguments : {};
  const agentToken = typeof context?.agentToken === "string" ? context.agentToken : "";
  try {
    if (name === "pling_surface_describe") {
      const response = await gateway.describe(agentToken);
      if (!response?.ok) return toolError(response?.error?.message ?? "describe failed");
      return toolText(response.result);
    }
    if (name === "pling_surface_invoke") {
      if (typeof args.capability !== "string" || !args.capability.trim()) return toolError("capability must be a non-empty string");
      if (args.input !== undefined && (!args.input || typeof args.input !== "object" || Array.isArray(args.input))) {
        return toolError("input must be an object");
      }
      const result = await gateway.invoke(agentToken, args.capability, args.input ?? {});
      if (result.state === "pending_approval") {
        return toolText(
          `Waiting for user confirmation in the business page.\n` +
            `requestId: ${result.requestId}\n` +
            `capability: ${result.capability}\n\n` +
            "Ask the user to complete confirmation in the open business page, then call pling_surface_approval_status. Do not claim approval.",
        );
      }
      return toolText(result);
    }
    if (name === "pling_surface_approval_status") {
      if (typeof args.requestId !== "string" || !args.requestId.trim()) return toolError("requestId must be a non-empty string");
      return toolText(gateway.status(agentToken, args.requestId));
    }
    return toolError(`Unknown tool: ${name}`);
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

function toolText(value) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  };
}

function toolError(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

export { TOOLS };
