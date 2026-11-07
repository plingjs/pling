import { afterEach, describe, expect, it } from "vitest";
import { createMemoryContinuityAuthority, createReplayLlm } from "@plingjs/agent";
import type { Llm } from "@plingjs/core";
import { createPling } from "../src";
import { waitFor } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
});

function mount(): HTMLDivElement {
  const host = document.createElement("div");
  document.body.append(host);
  return host;
}

function button(root: ParentNode, text: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (item) => item.textContent?.trim() === text,
  );
  if (!found) throw new Error(`按钮不存在：${text}`);
  return found;
}

function taskRow(root: ParentNode, text: string): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>(".pling-dock__task")).find((item) =>
    item.textContent?.includes(text),
  );
}

function hangingLlm(): { llm: Llm; release(): void } {
  let release: () => void = () => {};
  return {
    llm: async (_messages, _tools, options) => {
      await new Promise<void>((resolve, reject) => {
        const signal = options?.signal;
        if (signal?.aborted) {
          reject(new DOMException("aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
          once: true,
        });
        release = resolve;
      });
      return { content: "A 完成" };
    },
    release: () => release(),
  };
}

describe("Vanilla dock tasks", () => {
  it("only exposes the Tasks tab for shared continuity and lists remote work", async () => {
    const plain = createPling({ onWarn: () => {} });
    const plainDock = plain.dock({ defaultOpen: true });
    expect(button(plainDock.element, "Tasks").hidden).toBe(true);
    plain.destroy();

    const authority = createMemoryContinuityAuthority();
    const slow = hangingLlm();
    const aHost = mount();
    const a = createPling({
      ui: { locale: "en-US" },
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm: slow.llm,
        continuity: { scope: "browser", authority, leaseTtlMs: 30_000, takeover: "manual" },
      },
    });
    const dockA = a.dock({ mount: aHost, defaultOpen: true });
    const pendingA = dockA.runtime.session.send("把「预约牙医」标记完成");
    await waitFor(() => Boolean(dockA.runtime.continuity.sessionId));
    const sourceId = dockA.runtime.continuity.sessionId!;

    const bHost = mount();
    const b = createPling({
      ui: { locale: "en-US" },
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm: createReplayLlm([{ content: "B 完成" }]),
        continuity: { scope: "browser", authority, leaseTtlMs: 30_000, takeover: "manual" },
      },
    });
    const dockB = b.dock({ mount: bHost, defaultOpen: true });
    expect(button(dockB.element, "Tasks").hidden).toBe(false);
    button(dockB.element, "Tasks").click();
    await waitFor(() => Boolean(taskRow(dockB.element, "把「预约牙医」标记完成")));

    const row = taskRow(dockB.element, "把「预约牙医」标记完成")!;
    expect(row.textContent).toContain("Running on another page/device");
    expect(row.textContent).toContain("Follow");
    expect(row.textContent).toContain("Take over");

    button(row, "Follow").click();
    await waitFor(() => dockB.runtime.continuity.role === "follower");
    expect(dockB.element.querySelector(".pling-dock__role")?.textContent).toContain("read-only");
    expect(taskRow(dockB.element, "把「预约牙医」标记完成")?.textContent).toContain("Following read-only");

    button(taskRow(dockB.element, "把「预约牙医」标记完成")!, "Take over").click();
    await waitFor(() => dockB.runtime.continuity.role === "owner");
    await waitFor(() => dockA.runtime.continuity.leaseLost);
    expect(dockB.runtime.continuity.sessionId).toBe(sourceId);

    slow.release();
    await expect(pendingA).resolves.toBe("(Cancelled)");
    a.destroy();
    b.destroy();
  });

  it("forks a task from the list and returns to Chat", async () => {
    const authority = createMemoryContinuityAuthority();
    const a = createPling({
      ui: { locale: "en-US" },
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm: createReplayLlm([{ content: "源任务完成" }]),
        continuity: { scope: "browser", authority, leaseTtlMs: 30_000 },
      },
    });
    const dockA = a.dock({ mount: mount(), defaultOpen: true });
    await dockA.runtime.session.send("整理本周会议纪要");
    await dockA.runtime.continuity.flush();
    const sourceId = dockA.runtime.continuity.sessionId!;

    const b = createPling({
      ui: { locale: "en-US" },
      onWarn: () => {},
      agent: {
        config: { baseUrl: "/llm/v1", model: "test-model" },
        gate: () => false,
        llm: createReplayLlm([{ content: "分叉完成" }]),
        continuity: { scope: "browser", authority, leaseTtlMs: 30_000 },
      },
    });
    const dockB = b.dock({ mount: mount(), defaultOpen: true });
    button(dockB.element, "Tasks").click();
    await waitFor(() => Boolean(taskRow(dockB.element, "整理本周会议纪要")));
    button(taskRow(dockB.element, "整理本周会议纪要")!, "Fork").click();

    await waitFor(() => Boolean(dockB.runtime.continuity.sessionId));
    expect(dockB.runtime.continuity.sessionId).not.toBe(sourceId);
    expect(dockB.runtime.continuity.role).toBe("owner");
    expect(dockB.element.querySelector<HTMLButtonElement>('.pling-dock__tabs button[aria-selected="true"]')?.textContent).toBe(
      "Chat",
    );
    expect(await authority.read(sourceId)).toMatchObject({ status: "done" });

    a.destroy();
    b.destroy();
  });
});
