import { afterEach, describe, expect, it, vi } from "vitest";
import { createGuideActions } from "../src/guide-actions";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("compact guide actions", () => {
  it("keeps a long suggestion as a short label plus a one-line preview", () => {
    const onCommand = vi.fn();
    const actions = createGuideActions({
      ariaLabel: "任务操作",
      onCommand,
      items: [
        { id: "locate", label: "定位 · 约课须知", command: "focus-note", kind: "primary" },
        {
          id: "use",
          label: "自动填写",
          preview: "请提前 10 分钟到店；开课前 2 小时内不可取消。",
          ariaLabel: "自动填写约课须知：请提前 10 分钟到店；开课前 2 小时内不可取消。",
          command: "apply-note",
          kind: "suggestion",
        },
        { id: "skip", label: "跳过", command: "skip-note", kind: "skip" },
      ],
    });
    document.body.append(actions.element);

    const group = actions.element;
    expect(group.getAttribute("role")).toBe("group");
    const suggestion = actions.element.querySelector<HTMLButtonElement>(".pling-guide-action.is-suggestion")!;
    expect(group?.getAttribute("aria-label")).toBe("任务操作");
    expect(suggestion.textContent).toBe("自动填写请提前 10 分钟到店；开课前 2 小时内不可取消。");
    expect(suggestion.querySelector(".pling-guide-action__preview")?.textContent).toContain("开课前 2 小时");
    expect(suggestion.title).toContain("请提前 10 分钟到店");
    expect(suggestion.getAttribute("aria-label")).toContain("约课须知");

    suggestion.click();
    expect(onCommand).toHaveBeenCalledWith("apply-note");
    actions.destroy();
  });

  it("updates in place and does not emit disabled commands", () => {
    const onCommand = vi.fn();
    const actions = createGuideActions({
      items: [{ id: "save", label: "保存", command: "save", kind: "primary" }],
      onCommand,
    });
    document.body.append(actions.element);

    actions.update({
      items: [{ id: "save", label: "保存中…", command: "save", kind: "primary", disabled: true }],
      hint: "保存前再核对一次",
    });
    const button = actions.element.querySelector<HTMLButtonElement>(".pling-guide-action")!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe("保存中…");
    expect(actions.element.querySelector(".pling-guide-actions__hint")?.textContent).toBe("保存前再核对一次");

    button.click();
    expect(onCommand).not.toHaveBeenCalled();
    actions.destroy();
  });

  it("shares one stylesheet and keeps an accessible name without a preview", () => {
    const first = createGuideActions({
      items: [{ id: "save", label: "Save", command: "save", kind: "primary" }],
      onCommand: vi.fn(),
    });
    const second = createGuideActions({
      items: [{ id: "cancel", label: "Cancel", command: "cancel", ariaLabel: "Cancel this task" }],
      onCommand: vi.fn(),
    });
    document.body.append(first.element, second.element);

    expect(document.querySelectorAll("#pling-guide-actions-styles")).toHaveLength(1);
    expect(second.element.querySelector(".pling-guide-actions__hint")?.hasAttribute("hidden")).toBe(true);
    expect(second.element.querySelector(".pling-guide-action")?.getAttribute("aria-label")).toBe(
      "Cancel this task",
    );
    first.destroy();
    second.destroy();
  });

  it("uses locale punctuation for the generated title and accessible name", () => {
    const en = createGuideActions({
      locale: "en-US",
      items: [{ id: "use", label: "Auto-fill", preview: "Monthly card", command: "apply" }],
      onCommand: vi.fn(),
    });
    const zh = createGuideActions({
      locale: "zh-CN",
      items: [{ id: "use", label: "自动填写", preview: "月卡", command: "apply" }],
      onCommand: vi.fn(),
    });
    document.body.append(en.element, zh.element);

    const enButton = en.element.querySelector(".pling-guide-action")!;
    expect(enButton.getAttribute("title")).toBe("Auto-fill: Monthly card");
    expect(enButton.getAttribute("aria-label")).toBe("Auto-fill: Monthly card");

    const zhButton = zh.element.querySelector(".pling-guide-action")!;
    expect(zhButton.getAttribute("title")).toBe("自动填写「月卡」");
    expect(zhButton.getAttribute("aria-label")).toBe("自动填写：月卡");
    en.destroy();
    zh.destroy();
  });
});
