import { describe, expect, it } from "vitest";
import {
  ACTION_ERROR_MESSAGE_KEYS,
  DARK_THEME,
  EN_US_MESSAGES,
  ERROR_MESSAGE_KEYS,
  LIGHT_THEME,
  createUiController,
  describePlingDiagnostic,
  describePlingError,
  errorMessageKey,
  formatAvailabilityReason,
  resolveLocale,
  resolveTheme,
  themeCssVars,
  translate,
  ZH_CN_MESSAGES,
} from "../src";

describe("@plingjs/ui", () => {
  it("keeps English and Chinese message keys in sync", () => {
    expect(Object.keys(ZH_CN_MESSAGES).sort()).toEqual(Object.keys(EN_US_MESSAGES).sort());
  });

  it("maps every action error code to a stable message key", () => {
    const codes = [
      "DUPLICATE_ACTION_ID",
      "DUPLICATE_STATE_KEY",
      "DUPLICATE_GUIDE_TARGET",
      "ACTION_NOT_FOUND",
      "INVALID_ARGS",
      "INVALID_PARAMS",
      "PERMISSION_DENIED",
      "ACTION_UNAVAILABLE",
      "EXECUTION_FAILED",
      "EXPECTATION_FAILED",
      "HANDOFF_CANCELLED",
      "HANDOFF_TIMEOUT",
      "HANDOFF_FAILED",
      "STEP_FAILED",
      "HOOK_BLOCKED",
      "LOOP_DETECTED",
    ];

    expect(Object.keys(ACTION_ERROR_MESSAGE_KEYS).sort()).toEqual(codes.sort());
    for (const code of codes) {
      const key = errorMessageKey(code);
      expect(key, code).toBe(`error.${code.toLowerCase()}`);
      expect(translate("en-US", key), code).not.toMatch(/[\u4e00-\u9fff]/);
      expect(translate("zh-CN", key), code).not.toBe(key);
    }
  });

  it("localizes error summaries while preserving codes and unknown codes", () => {
    const en = (key: string, params?: Record<string, string | number | boolean | null | undefined>) =>
      translate("en-US", key, params);
    const zh = (key: string, params?: Record<string, string | number | boolean | null | undefined>) =>
      translate("zh-CN", key, params);
    const failure = { code: "ACTION_NOT_FOUND", message: "未知动作" };

    expect(describePlingError(failure, en)).toBe("ACTION_NOT_FOUND: Action not found — 未知动作");
    expect(describePlingError(failure, zh)).toBe("ACTION_NOT_FOUND：找不到动作 — 未知动作");
    expect(describePlingError({ code: "ACTION_NOT_FOUND", message: "ACTION_NOT_FOUND: 未知动作" }, en)).toBe(
      "ACTION_NOT_FOUND: Action not found — 未知动作",
    );

    expect(describePlingError({ code: "NEW_SAFE_ERROR", message: "retry later" }, en)).toBe(
      "NEW_SAFE_ERROR: Unknown error — retry later",
    );
    expect(ERROR_MESSAGE_KEYS.NOT_CONFIGURED).toBe("error.not_configured");
  });

  it("uses localized diagnostics instead of raw Chinese hints when a structured code exists", () => {
    const en = (key: string, params?: Record<string, string | number | boolean | null | undefined>) =>
      translate("en-US", key, params);
    const zh = (key: string, params?: Record<string, string | number | boolean | null | undefined>) =>
      translate("zh-CN", key, params);
    const diagnostic = {
      ready: false,
      code: "MODEL_BASE_URL_MISSING",
      params: { env: "VITE_AGENT_BASE_URL" },
      hint: "没有配置模型地址。",
    };

    expect(describePlingDiagnostic(diagnostic, en)).toContain("VITE_AGENT_BASE_URL");
    expect(describePlingDiagnostic(diagnostic, en)).not.toMatch(/[\u4e00-\u9fff]/);
    expect(describePlingDiagnostic(diagnostic, zh)).toContain("VITE_AGENT_BASE_URL");
    expect(describePlingDiagnostic({ ready: false, hint: "custom fallback" }, en)).toBe("custom fallback");
    expect(describePlingDiagnostic({ ready: true, code: "MODEL_BASE_URL_MISSING" }, en)).toBe("");
  });

  it("translates, interpolates, and falls back to English", () => {
    expect(translate("en-US", "dock.launcher.open")).toBe("Ask Pling");
    expect(translate("zh-CN", "chat.handoff.step", { current: 2, total: 3 })).toBe("请你完成第 2 / 3 步");
    expect(translate("zh-CN", "missing.key")).toBe("missing.key");
    expect(translate("fr-FR", "dock.launcher.open")).toBe("Ask Pling");
  });

  it("localizes framework availability reasons without hiding developer text", () => {
    const en = (key: string, params?: Record<string, string | number | boolean | null | undefined>) =>
      translate("en-US", key, params);
    const zh = (key: string, params?: Record<string, string | number | boolean | null | undefined>) =>
      translate("zh-CN", key, params);

    expect(formatAvailabilityReason({ reason: "Element is disabled (disabled)", reasonKey: "availability.disabled" }, zh))
      .toBe("元素处于禁用状态");
    expect(formatAvailabilityReason({
      reason: "Element is disabled (disabled)；请先选择一条订单",
      reasonKey: "availability.disabled",
      reasonSuffix: "请先选择一条订单",
    }, zh)).toBe("元素处于禁用状态 · 请先选择一条订单");
    expect(formatAvailabilityReason({ reason: "请先选择一条订单" }, zh)).toBe("请先选择一条订单");
    expect(formatAvailabilityReason({ reasonKey: "availability.covered", reasonParams: { element: "<div.modal>" } }, en))
      .toBe("Covered by <div.modal> (possibly an open dialog or overlay)");
  });

  it("accepts explicit message overrides", () => {
    expect(
      translate("fr-FR", "dock.launcher.open", undefined, {
        catalogs: { "fr-FR": { "dock.launcher.open": "Demander à Pling" } },
      }),
    ).toBe("Demander à Pling");
  });

  it("does not auto-detect language unless locale is auto", () => {
    expect(resolveLocale(undefined, { languages: ["zh-CN"] })).toBe("en-US");
    expect(resolveLocale("auto", { languages: ["zh-CN", "en-US"] })).toBe("zh-CN");
    expect(resolveLocale("zh", {})).toBe("zh-CN");
    expect(resolveLocale("ja-JP", {})).toBe("en-US");
  });

  it("resolves light, dark, auto, and token overrides", () => {
    expect(resolveTheme("light").tokens).toEqual(LIGHT_THEME);
    expect(resolveTheme("dark").tokens).toEqual(DARK_THEME);
    expect(resolveTheme("auto", { prefersDark: true }).mode).toBe("dark");
    expect(resolveTheme({ mode: "light", tokens: { colorPrimary: "#123456" } }).cssVars["--pling-color-primary"]).toBe(
      "#123456",
    );
    expect(themeCssVars(LIGHT_THEME)["--pling-radius-lg"]).toBe("12px");
  });

  it("shares one snapshot and only notifies on real changes", () => {
    const theme = { mode: "light" as const, tokens: { colorPrimary: "#123456" } };
    const ui = createUiController({
      locale: "zh-CN",
      theme,
    });
    let calls = 0;
    const unsubscribe = ui.subscribe(() => {
      calls += 1;
    });

    expect(ui.locale).toBe("zh-CN");
    expect(ui.snapshot).toBe(ui.getSnapshot());
    expect(ui.cssVars["--pling-color-primary"]).toBe("#123456");

    ui.setLocale("zh-CN");
    ui.setTheme(theme);
    ui.setTheme({ mode: "light", tokens: { colorPrimary: "#123456" } });
    expect(calls).toBe(0);

    ui.setLocale("en-US");
    expect(calls).toBe(1);
    expect(ui.t("dock.launcher.open")).toBe("Ask Pling");

    ui.setTheme("dark");
    expect(calls).toBe(2);
    expect(ui.resolvedTheme).toBe("dark");
    expect(ui.cssVars["--pling-color-bg"]).toBe(DARK_THEME.colorBg);

    unsubscribe();
    ui.setLocale("zh-CN");
    expect(calls).toBe(2);
    ui.destroy();
  });
});
