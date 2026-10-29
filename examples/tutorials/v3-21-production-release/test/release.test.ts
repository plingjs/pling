import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createPling } from "@plingjs/vue";
import App from "../src/App.vue";
import { evaluateRelease, previewConfig, productionConfig } from "../src/release";

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

describe("V3-21 · production release", () => {
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
    const pling = createPling({ diagnostics: false, agent: { llm: createReplayLlm([]) } });
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [pling.plugin] } });
    cleanup = () => { wrapper.unmount(); pling.destroy(); };
    await nextTick();
    const snapshot = pling.registry.snapshot();

    expect(snapshot.actions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["add_task", "toggle@t1", "release_status"]),
    );
    expect(snapshot.actions.map((action) => action.id).filter((id) => id.startsWith("release_"))).toEqual([
      "release_status",
    ]);
    expect(previewConfig.maxTurns).toBe(100);
    expect(wrapper.text()).toContain("This is a static preflight");
  });
});
