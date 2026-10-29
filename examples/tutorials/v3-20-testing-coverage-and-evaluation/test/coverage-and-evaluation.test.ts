import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createPolicy } from "@plingjs/core";
import {
  createAgentLoop,
  createReplayLlm,
  defaultSettle,
  runEvaluation,
} from "@plingjs/agent";
import { createPling } from "@plingjs/vue";
import App from "../src/App.vue";

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

async function setup() {
  const pling = createPling({ diagnostics: false });
  const wrapper = mount(App, { attachTo: document.body, global: { plugins: [pling.plugin] } });
  cleanup = () => { wrapper.unmount(); pling.destroy(); };
  await nextTick();
  return { pling, wrapper };
}

describe("V3-20 · coverage", () => {
  it("reports the undeclared export control without turning it into an action", async () => {
    const { pling } = await setup();
    const report = pling.inspectCoverage();
    const missing = report.targets.filter((target) => target.status === "missing");

    expect(missing).toEqual([{ element: "button#export_csv", label: "Export CSV", status: "missing" }]);
    expect(report.missing).toBe(1);
    expect(report.coveragePercent).toBeGreaterThanOrEqual(80);
    expect(pling.registry.snapshot().actions.map((action) => action.id)).not.toContain("export_csv");
  });
});

describe("V3-20 · replay and evaluation", () => {
  it("turns a task transcript into repeatable assertions", async () => {
    const { pling, wrapper } = await setup();
    const llm = createReplayLlm([
      { calls: [{ tool: "add_task", args: { text: "Prepare the demo" } }], content: "Adding it." },
      { content: "Added." },
      { content: "I cannot delete every task." },
    ]);
    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(async () => true),
      llm,
      settle: defaultSettle,
    });
    const vm = wrapper.vm as unknown as { reset: () => void };

    const report = await runEvaluation({
      run: (input) => loop.run(input),
      reset: () => {
        vm.reset();
        loop.reset();
      },
      hooks: loop.hooks,
      cases: [
        {
          name: "add one task",
          input: "Add a task to prepare the demo",
          expectIncludes: ["Added"],
          expectTools: ["add_task"],
          maxToolErrors: 0,
          verify: () => (wrapper.vm as unknown as { tasks: Array<{ text: string }> }).tasks.some((task) => task.text === "Prepare the demo"),
        },
        {
          name: "do not invent a bulk delete",
          input: "Delete every task",
          expectNotTools: ["add_task"],
          maxToolErrors: 0,
        },
      ],
    });

    expect(report.passRate).toBe(1);
    expect(report.results.map((result) => result.toolsUsed)).toEqual([["add_task"], []]);
    expect(llm.received[0]![0]!.content).toContain("add_task");
    expect(llm.received[0]![0]!.content).not.toContain("export_csv");
  });
});
