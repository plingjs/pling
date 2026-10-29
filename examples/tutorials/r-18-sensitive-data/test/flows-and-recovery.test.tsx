import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RESUME_FLOW_ACTION_ID, createExecutor, createPolicy, type ExecResult } from "@plingjs/core";
import { createReplayLlm } from "@plingjs/agent";
import { createPling, PlingProvider } from "@plingjs/react";
import { OrderFlowPanel } from "../src/components/OrderFlowPanel";
import type { DemoLocale } from "../src/locale";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let cleanup: (() => void) | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  cleanup?.();
  document.body.innerHTML = "";
  root = null;
  host = null;
  cleanup = null;
});

async function mountPanel(locale: DemoLocale = "en") {
  const pling = createPling({
    onWarn: () => {},
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: { llm: createReplayLlm([]) },
  });
  await act(async () => {
    root!.render(
      <PlingProvider pling={pling}>
        <OrderFlowPanel locale={locale} />
      </PlingProvider>,
    );
  });
  cleanup = () => pling.destroy();
  return pling;
}

function executorFor(pling: ReturnType<typeof createPling>) {
  return createExecutor({
    registry: pling.registry,
    policy: createPolicy(async () => true),
    // Let React commit between flow steps before the next action is resolved.
    settle: async () => {
      flushSync(() => {});
      await act(async () => {});
    },
  });
}

function outOf(result: ExecResult): Extract<ExecResult, { result: unknown }> {
  if ("error" in result) throw new Error(result.error.message);
  return result;
}

async function click(selector: string): Promise<void> {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`element not found: ${selector}`);
  await act(async () => (element as HTMLElement).click());
}

describe("R-18 · sensitive data", () => {
  it("registers one flow and four ordinary row actions", async () => {
    const pling = await mountPanel();
    const snapshot = pling.registry.snapshot();
    const flow = snapshot.actions.find((action) => action.id === "update_order_note");

    expect(flow).toMatchObject({ primitive: "flow", flowSteps: 4, kind: "write" });
    expect(snapshot.records).toHaveLength(4);
    expect(snapshot.actions.filter((action) => action.id.startsWith("open_order@"))).toHaveLength(4);
  });

  it("runs the fixed sequence as one tool call and waits for the delayed save", async () => {
    const pling = await mountPanel();
    const executor = executorFor(pling);

    const result = await executor.execute(
      "update_order_note",
      JSON.stringify({ orderId: "SO-1002", note: "Call back Friday" }),
    );
    const receipt = outOf(result);

    expect(receipt.result).toMatchObject({ ok: true, flow: { completed: 4, total: 4 } });
    expect(document.querySelector('[data-order="SO-1002"] .orders__note')?.textContent)
      .toBe("Call back Friday");
    expect(document.querySelector(".overlay")).toBeNull();
  });

  it("resumes at the failed step instead of replaying completed steps", async () => {
    const pling = await mountPanel();
    const executor = executorFor(pling);

    await click(".orders__tools .warning");
    const failed = await executor.execute(
      "update_order_note",
      JSON.stringify({ orderId: "SO-1004", note: "Call after lunch" }),
    );

    expect("error" in failed).toBe(true);
    if (!("error" in failed)) return;
    const failure = failed.error;
    expect(failure.code).toBe("STEP_FAILED");
    expect(failure.message).toContain("failed at step 4/4");
    expect(failure.message).toContain("3/4 steps");
    expect(failure.message).toContain("already taken effect");
    expect(failure.resume).toMatchObject({ flowId: "update_order_note", from: 4, failedAt: 4 });
    expect(document.querySelector('[data-order="SO-1004"] .orders__note')?.textContent)
      .toBe("Waiting for PO number");
    expect(document.querySelector(".overlay")).not.toBeNull();

    await click(".orders__tools .warning");
    const resumed = await executor.execute(
      RESUME_FLOW_ACTION_ID,
      JSON.stringify({ runId: failure.resume!.runId }),
    );

    expect(outOf(resumed).result).toMatchObject({ ok: true, flow: { completed: 4, total: 4 } });
    expect(document.querySelector('[data-order="SO-1004"] .orders__note')?.textContent)
      .toBe("Call after lunch");
    expect(document.querySelector(".overlay")).toBeNull();
    expect(pling.registry.snapshot().actions.some((action) => action.id === RESUME_FLOW_ACTION_ID))
      .toBe(false);
  });

  it("rejects an order id that is no longer an available choice", async () => {
    const pling = await mountPanel();
    const result = await executorFor(pling).execute(
      "update_order_note",
      JSON.stringify({ orderId: "SO-9999", note: "No such record" }),
    );

    expect("error" in result && result.error.code).toBe("INVALID_PARAMS");
    expect("error" in result && result.error.message).toContain("SO-9999");
  });

  it("localizes the visible operation and the declared descriptions", async () => {
    const pling = await mountPanel("zh");
    await click('[data-order="SO-1001"] button:last-child');
    const snapshot = pling.registry.snapshot();

    expect(document.body.textContent).toContain("订单备注");
    expect(snapshot.actions.find((action) => action.id === "update_order_note")?.description)
      .toContain("备注");
    expect(snapshot.actions.find((action) => action.id === "save_note")?.description)
      .toContain("保存");
  });
});
