import { describe, expect, it } from "vitest";
import chatSource from "../src/components/AgentChat.vue?raw";

describe("AgentChat style isolation", () => {
  it("owns the composer button styles instead of inheriting business-page CSS", () => {
    expect(chatSource).toContain(".composer button {");
    expect(chatSource).toContain("background: var(--pling-color-primary, #2e9df7);");
    expect(chatSource).toContain(".composer button:disabled {");
    expect(chatSource).toContain("background: var(--pling-color-primary, #2e9df7);");
    expect(chatSource).toContain("opacity: 0.45;");
  });
});
