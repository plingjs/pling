import { afterEach, describe, expect, it } from "vitest";
import { PLING_UI_STYLES, ensurePlingStyles } from "../src/ui-styles";

afterEach(() => {
  document.head.querySelectorAll("style[data-pling-styles]").forEach((node) => node.remove());
});

describe("ensurePlingStyles", () => {
  it("installs the canonical surface stylesheet once", () => {
    ensurePlingStyles();
    ensurePlingStyles();

    const nodes = document.head.querySelectorAll("style[data-pling-styles]");
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.textContent).toBe(PLING_UI_STYLES);
  });

  it("covers the shared assistant surface and task guide", () => {
    expect(PLING_UI_STYLES).toContain(".pling-chat__composer-box");
    expect(PLING_UI_STYLES).toContain(".pling-dock__nav");
    expect(PLING_UI_STYLES).toContain(".pling-guide__card");
    expect(PLING_UI_STYLES).toContain(".pling-guide__rail");
  });

  it("lets inline panels fill their host without inheriting the floating card", () => {
    expect(PLING_UI_STYLES).toMatch(
      /\.pling-inline--inline \.pling-inline__panel,\s*\.pling-inline--fused \.pling-inline__panel\s*\{[^}]*width:\s*100%;[^}]*height:\s*var\(--pling-inline-height,[^;]+\);[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*box-shadow:\s*none;/s,
    );
    expect(PLING_UI_STYLES).toContain(".pling-inline--dock .pling-inline__panel");
  });
});
