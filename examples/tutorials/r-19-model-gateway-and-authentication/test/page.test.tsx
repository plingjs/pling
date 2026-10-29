import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createReplayLlm } from "@plingjs/agent";
import { createPling, PlingProvider } from "@plingjs/react";
import { App } from "../src/App";

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

describe("R-19 · browser page", () => {
  it("declares page capabilities without exposing a provider key", async () => {
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
          <App locale="en" />
        </PlingProvider>,
      );
    });
    cleanup = () => pling.destroy();

    const snapshot = pling.registry.snapshot();
    expect(snapshot.actions.map((action) => action.id)).toEqual(
      expect.arrayContaining(["add_task", "toggle@t1", "sign_in_status"]),
    );
    expect(snapshot.records).toHaveLength(3);
    expect(document.body.textContent).toContain("API key: none in the browser");
    expect(document.body.textContent).not.toContain("server-provider-key");
  });
});
