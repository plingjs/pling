import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createPolicy } from "@plingjs/core";
import {
  DEFAULT_LIMITS,
  Telemetry,
  checkAgentLimits,
  compactAt,
  createAgentLoop,
  createReplayLlm,
} from "@plingjs/agent";
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

async function mountPanel() {
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
  return pling;
}

describe("R-18 · runtime regression checks", () => {
  it("validates limits before they become unexplained runtime behavior", () => {
    expect(checkAgentLimits(DEFAULT_LIMITS)).toEqual([]);
    expect(checkAgentLimits({ ...DEFAULT_LIMITS, maxTurns: 0 })[0]).toContain("MAX_TURNS");
    expect(checkAgentLimits({ ...DEFAULT_LIMITS, compactRatio: 1.5 })[0]).toContain("COMPACT_RATIO");
    expect(compactAt({ ...DEFAULT_LIMITS, contextTokens: 4_096, reserveForOutput: 512, compactRatio: 0.5 }))
      .toBe(1_792);
  });

  it("keeps per-run turns distinct from cumulative model calls", async () => {
    const pling = await mountPanel();
    const telemetry = new Telemetry();
    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(async () => true),
      llm: createReplayLlm([
        { calls: [{ tool: "update_order_note", args: { orderId: "SO-1002", note: "Call back Friday" } }] },
        { content: "The note is saved." },
      ]),
      telemetry,
      maxTurns: 4,
      settle: async () => {
        await act(async () => {});
      },
    });

    await loop.run("Change the note on SO-1002 to Call back Friday");

    expect(loop.turnsUsed).toBe(2);
    expect(telemetry.summary()).toMatchObject({ toolCalls: 1 });
    expect(telemetry.events.find((event) => event.type === "tool")).toMatchObject({
      type: "tool",
      tool: "update_order_note",
      status: "ok",
    });
  });
});
