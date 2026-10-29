import { createRef } from "react";
import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAgentLoop, createReplayLlm, runEvaluation } from "@plingjs/agent";
import { createPolicy } from "@plingjs/core";
import { createPling, PlingProvider } from "@plingjs/react";
import { App, type AppHandle } from "../src/App";
import type { DemoLocale } from "../src/copy";

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

async function mountApp(locale: DemoLocale = "en") {
  const app = createRef<AppHandle>();
  const pling = createPling({
    presence: false,
    onWarn: () => {},
    ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
    agent: {
      config: { limits: { maxTurns: 100 } },
      llm: createReplayLlm([]),
    },
  });

  await act(async () => {
    root!.render(
      <PlingProvider pling={pling}>
        <App ref={app} locale={locale} />
      </PlingProvider>,
    );
  });
  cleanup = () => pling.destroy();
  return { app, pling };
}

describe("R-20 · coverage", () => {
  it("reports the undeclared export control without registering it", async () => {
    const { pling } = await mountApp();
    const report = pling.inspectCoverage(document.querySelector("main"));
    const missing = report.targets.filter((target) => target.status === "missing");

    expect(missing).toEqual([{ element: "button#export_csv", label: "Export CSV", status: "missing" }]);
    expect(report.missing).toBe(1);
    expect(report.coveragePercent).toBeGreaterThanOrEqual(80);
    expect(pling.registry.snapshot().actions.map((action) => action.id)).not.toContain("export_csv");
  });

  it("keeps the diagnostic labels aligned with the page locale", async () => {
    const { pling } = await mountApp("zh");
    const report = pling.inspectCoverage(document.querySelector("main"));

    expect(report.targets).toContainEqual({
      element: "button#export_csv",
      label: "导出 CSV",
      status: "missing",
    });
  });
});

describe("R-20 · replay and evaluation", () => {
  it("turns a task transcript into repeatable assertions", async () => {
    const { app, pling } = await mountApp();
    const llm = createReplayLlm([
      { calls: [{ tool: "add_task", args: { text: "Prepare the demo" } }], content: "Adding it." },
      { content: "Added." },
      { content: "I cannot delete every task." },
    ]);
    const loop = createAgentLoop({
      registry: pling.registry,
      policy: createPolicy(async () => true),
      llm,
      settle: async () => {
        flushSync(() => {});
        await act(async () => {});
      },
    });

    const report = await runEvaluation({
      run: (input) => loop.run(input),
      reset: () => {
        app.current?.reset();
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
          verify: () => app.current?.getTasks().some((task) => task.text === "Prepare the demo") === true,
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
