import { describe, expect, it } from "vitest";
import type { ActionErrorCode } from "@plingjs/core";
import { ACTION_ERROR_MESSAGE_KEYS, translate } from "@plingjs/ui";
import { toActivityRows } from "../src/activity";
import { toTranscriptLine } from "../src/transcript";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
type _EveryActionErrorCodeHasAMessageKey = Expect<Equal<keyof typeof ACTION_ERROR_MESSAGE_KEYS, ActionErrorCode>>;

describe("runtime error localization contract", () => {
  it("keeps error codes verbatim and localizes the summary at render time", () => {
    const event = { type: "error", code: "LLM_FAILED", message: "Failed to fetch" } as const;

    expect(toTranscriptLine(event, { locale: "en-US" })).toEqual({
      kind: "error",
      text: "LLM_FAILED: Model request failed — Failed to fetch",
    });
    expect(toTranscriptLine(event, { locale: "zh-CN" })).toEqual({
      kind: "error",
      text: "LLM_FAILED：模型请求失败 — Failed to fetch",
    });
  });

  it("uses a structured diagnostic message key and never appends the raw Chinese fallback", () => {
    const event = {
      type: "error",
      code: "NOT_CONFIGURED",
      message: "没有配置模型地址（VITE_AGENT_BASE_URL）。",
      messageKey: "diagnostic.config.base_url_missing",
      params: { env: "VITE_AGENT_BASE_URL" },
    } as const;
    const line = toTranscriptLine(event, { locale: "en-US" });

    expect(line.kind).toBe("error");
    if (line.kind !== "error") throw new Error("expected error line");
    expect(line.text).toContain("NOT_CONFIGURED");
    expect(line.text).toContain("VITE_AGENT_BASE_URL");
    expect(line.text).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("honors an injected translator so adapter message overrides also apply", () => {
    const t = (key: string, params?: Record<string, string | number | boolean | null | undefined>) =>
      key === "error.permission_denied"
        ? "Interdit"
        : translate("fr-FR", key, params);

    expect(toActivityRows([
      { type: "tool_call", id: "remove", tool: "remove", args: {} },
      { type: "tool_result", id: "remove", tool: "remove", result: { error: { code: "PERMISSION_DENIED", message: "user rejected" } } },
    ], { translate: t })[0]!.detail).toBe("PERMISSION_DENIED: Interdit — user rejected");
  });
});
