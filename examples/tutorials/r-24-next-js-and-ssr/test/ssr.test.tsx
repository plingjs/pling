import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createExecutor, createPolicy } from "@plingjs/core";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "../src/App";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let pling: ReturnType<typeof createPling> | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  pling?.destroy();
  document.body.innerHTML = "";
  root = null;
  host = null;
  pling = null;
});

describe("R-24 · Next.js and SSR", () => {
  it("renders business content on the server without the assistant shell", () => {
    const html = renderToString(<App locale="en" />);

    expect(html).toContain("Review the release checklist");
    expect(html).toContain("Send the customer follow-up");
    expect(html).toContain("Server-rendered first paint");
    expect(html).not.toContain("Todo assistant · SSR boundary");
  });

  it("renders the requested locale on the server", () => {
    const html = renderToString(<App locale="zh" />);

    expect(html).toContain("检查发布清单");
    expect(html).toContain("服务端首屏");
  });

  it("hydrates the same tree before registering client capabilities", async () => {
    const html = renderToString(<App locale="en" />);
    host!.innerHTML = html;

    pling = createPling({
      presence: false,
      onWarn: () => {},
      agent: { llm: createReplayLlm([]) },
    });

    await act(async () => {
      root = hydrateRoot(
        host!,
        <PlingProvider pling={pling!}>
          <App locale="en" />
        </PlingProvider>,
      );
    });
    await act(async () => {});

    const ids = pling.registry.snapshot().actions.map((action) => action.id);
    expect(ids).toEqual(expect.arrayContaining([
      "todo.overview",
      "todo.add",
      "todo.toggle",
      "todo.clear_completed",
    ]));
    expect(document.querySelectorAll(".tasks li")).toHaveLength(3);
    expect(document.querySelector(".pling-dock")).not.toBeNull();
  });

  it("executes a capability after hydration and updates the hydrated page", async () => {
    const html = renderToString(<App locale="en" />);
    host!.innerHTML = html;

    pling = createPling({
      presence: false,
      onWarn: () => {},
      agent: { llm: createReplayLlm([]) },
    });

    await act(async () => {
      root = hydrateRoot(
        host!,
        <PlingProvider pling={pling!}>
          <App locale="en" />
        </PlingProvider>,
      );
    });
    await act(async () => {});

    const executor = createExecutor({
      registry: pling.registry,
      policy: createPolicy(async () => true),
    });

    await act(async () => {
      await expect(executor.execute("todo.add", JSON.stringify({ text: "Hydration check" })))
        .resolves.toMatchObject({ result: { ok: true } });
    });

    expect(Array.from(document.querySelectorAll(".tasks li")).map((node) => node.textContent))
      .toContain("Hydration check");
    expect(pling.registry.snapshot().actions.map((action) => action.id)).toContain("todo.toggle");
  });
});
