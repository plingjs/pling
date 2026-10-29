import { describe, expect, it } from "vitest";
import type { Llm } from "@plingjs/core";
import { DEFAULT_LIMITS, DEFAULT_RETRY, type AgentConfig } from "../src/config";
import { createReplayLlm } from "../src/replay";
import { createAgentRuntime } from "../src/runtime";
import { allowAll, makeRegistry, noSettle } from "./helpers";

const config: AgentConfig = {
  baseUrl: "/llm/v1",
  model: "test-model",
  apiKey: "",
  temperature: 0,
  maxTokens: 256,
  systemPrompt: "",
  stream: false,
  defaultApproval: "danger",
  minActionIntervalMs: 0,
  retry: { ...DEFAULT_RETRY },
  limits: { ...DEFAULT_LIMITS },
};

describe("agent request trace", () => {
  it("is opt-in and records the exact messages, tools and page snapshot sent to the model", async () => {
    const registry = makeRegistry([{ id: "add_todo", description: "Add a task" }]);
    const llm = createReplayLlm([{ content: "Done" }]);
    const runtime = createAgentRuntime({ config, registry, llm, trace: true, settle: noSettle });

    expect(runtime.trace).not.toBeNull();
    expect(runtime.trace!.calls).toEqual([]);

    await runtime.session.send("Add one task");

    const call = runtime.trace!.calls[0]!;
    expect(call).toMatchObject({ turn: 1, status: "ok" });
    expect(call.messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(call.messages[1]!.content).toBe("Add one task");
    expect(call.tools.map((tool) => tool.function.name)).toEqual(["add_todo"]);
    expect(call.snapshot.actions.map((action) => action.id)).toEqual(["add_todo"]);
    expect(call.response).toMatchObject({ content: "Done", toolCalls: [] });
    expect(call.contextTokens).toBeGreaterThan(0);
  });

  it("keeps only the configured number of calls", async () => {
    const registry = makeRegistry([{ id: "save", description: "Save" }]);
    const llm = createReplayLlm([{ calls: [{ tool: "save" }] }, { content: "Done" }]);
    const runtime = createAgentRuntime({
      config,
      registry,
      llm,
      policy: allowAll,
      trace: { maxCalls: 1 },
      settle: noSettle,
    });

    await runtime.session.send("Save it");

    expect(runtime.trace!.calls).toHaveLength(1);
    expect(runtime.trace!.calls[0]).toMatchObject({ seq: 2, turn: 2, status: "ok" });
  });

  it("records failed calls and clears with the conversation", async () => {
    const llm: Llm = async () => {
      throw new Error("gateway offline");
    };
    const runtime = createAgentRuntime({ config, llm, trace: true });

    await runtime.session.send("Hello");

    expect(runtime.trace!.calls[0]).toMatchObject({
      turn: 1,
      status: "error",
      error: { code: "LLM_FAILED", message: "gateway offline" },
    });

    runtime.session.reset();
    expect(runtime.trace!.calls).toEqual([]);
  });

  it("stays on the zero-overhead path unless explicitly enabled", () => {
    const runtime = createAgentRuntime({ config, llm: createReplayLlm([{ content: "Hi" }]) });
    expect(runtime.trace).toBeNull();
  });
});
