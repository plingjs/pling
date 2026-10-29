import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "../src/App";
import { evaluateRelease, previewConfig, productionConfig } from "../src/release";

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

async function mountApp() {
  const pling = createPling({
    presence: false,
    onWarn: () => {},
    agent: { llm: createReplayLlm([]) },
  });
  await act(async () => {
    root!.render(
      <PlingProvider pling={pling}>
        <App locale="en" />
      </PlingProvider>,
    );
  });
  cleanup = () => pling.destroy();
  return pling;
}

describe("R-21 · production release", () => {
  it("accepts the production configuration and blocks key or model-policy leaks", () => {
    expect(evaluateRelease(previewConfig).ready).toBe(true);
    expect(evaluateRelease(productionConfig).ready).toBe(true);

    const unsafe = evaluateRelease({
      ...productionConfig,
      gatewayUrl: "http://app.example.com/api/llm/v1",
      browserApiKey: "provider-secret",
      modelPolicy: { mode: "pinned", models: ["*"] },
      appOrigin: "https://app.example.com",
      allowedOrigins: ["*"],
      maxTurns: 100,
      telemetryEndpoint: "",
      killSwitchUrl: "unsafe",
    });
    expect(unsafe.ready).toBe(false);
    expect(unsafe.checks.filter((check) => check.status === "fail").map((check) => check.id)).toEqual(
      expect.arrayContaining([
        "gateway_tls",
        "browser_key",
        "model_policy",
        "turn_budget",
        "telemetry",
        "origin_allowlist",
        "kill_switch",
      ]),
    );
  });

  it("keeps release controls out of the agent surface", async () => {
    const pling = await mountApp();
    const snapshot = pling.registry.snapshot();

    expect(snapshot.actions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["add_task", "toggle@t1", "release_status"]),
    );
    expect(snapshot.actions.map((action) => action.id).filter((id) => id.startsWith("release_"))).toEqual([
      "release_status",
    ]);
    expect(previewConfig.maxTurns).toBe(100);
    expect(document.body.textContent).toContain("This is a static preflight");
  });
});
