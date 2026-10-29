import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PendingApproval } from "@plingjs/agent";
import type { Approval } from "@plingjs/core";
import { AgentChat } from "../src";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = "";
});

function pending(approval: Approval, kind: PendingApproval["request"]["kind"] = "write"): PendingApproval {
  return {
    request: {
      id: "update_note@order:SO-1002",
      kind,
      approval,
      description: "Update the order note",
      args: { record: "SO-1002" },
    },
    createdAt: 0,
  };
}

async function render(approval: Approval, kind?: PendingApproval["request"]["kind"]): Promise<void> {
  await act(async () => root!.render(<AgentChat pending={pending(approval, kind)} />));
}

describe("AgentChat approval choices", () => {
  it("offers the session shortcut only for ask", async () => {
    await render("ask");
    expect(document.querySelector(".pling-chat__confirm")!.textContent).toContain("Allow for this session");

    await render("ask-always", "danger");
    expect(document.querySelector(".pling-chat__confirm")!.textContent).not.toContain("Allow for this session");
  });
});
