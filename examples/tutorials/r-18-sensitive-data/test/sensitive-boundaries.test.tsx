import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createReplayLlm } from "@plingjs/agent";
import { createPling, PlingProvider } from "@plingjs/react";
import { OrderFlowPanel } from "../src/components/OrderFlowPanel";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let cleanup: (() => void) | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  cleanup?.();
  document.body.innerHTML = "";
  root = null;
  cleanup = null;
});

async function setup() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const pling = createPling({
    onWarn: () => {},
    ui: { locale: "en-US" },
    agent: { llm: createReplayLlm([]) },
  });
  await act(async () => {
    root!.render(
      <PlingProvider pling={pling}>
        <OrderFlowPanel locale="en" />
      </PlingProvider>,
    );
  });
  cleanup = () => pling.destroy();
  const executor = createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => true),
    settle: async () => {
      await act(async () => {});
    },
  });
  return { pling, executor };
}

function fieldsOf(pling: ReturnType<typeof createPling>, id: string): Record<string, unknown> {
  return pling.registry.snapshot().records.find((record) => record.id === id)!.fields as Record<string, unknown>;
}

describe("R-18 · sensitive-data boundaries", () => {
  it("projects token, masked, and hidden values without exposing originals", async () => {
    const { pling } = await setup();
    const fields = fieldsOf(pling, "SO-1002");
    const snapshot = JSON.stringify(pling.registry.snapshot());

    expect(fields.phone).toMatch(/^\{\{p:[0-9a-z]+\}\}$/);
    expect(fields.idCard).toBe("P-1****1198");
    expect(fields.grade).toBe("[hidden]");
    expect(snapshot).not.toContain("+1 415 555 0137");
    expect(snapshot).not.toContain("P-1002-1198");
  });

  it("restores a token before the business function runs", async () => {
    const { pling, executor } = await setup();
    const token = String(fieldsOf(pling, "SO-1002").phone);

    const result = await executor.execute("call_customer@SO-1002", JSON.stringify({ phone: token }));

    expect("error" in result).toBe(false);
    expect(document.body.textContent).toContain("0137");
    expect(document.body.textContent).not.toContain("+1 415 555 0137");
  });

  it("redacts a restored token from an outbound error message", async () => {
    const { pling, executor } = await setup();
    const token = String(fieldsOf(pling, "SO-1002").phone);

    const result = await executor.execute("verify_customer", JSON.stringify({ phone: token }));

    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error.code).toBe("EXECUTION_FAILED");
    expect(result.error.message).toContain(token);
    expect(result.error.message).not.toContain("+1 415 555 0137");
  });

  it("rejects an invented token before the business function runs", async () => {
    const { executor } = await setup();
    const result = await executor.execute(
      "call_customer@SO-1001",
      JSON.stringify({ phone: "{{p:madeup1}}" }),
    );

    expect("error" in result && result.error.code).toBe("INVALID_ARGS");
    expect("error" in result && result.error.message).toContain("unknown sensitive-value tokens");
  });
});
