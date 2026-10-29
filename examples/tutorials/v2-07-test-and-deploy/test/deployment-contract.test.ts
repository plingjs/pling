import { describe, expect, it } from "vitest";
import appSource from "../src/app.ts?raw";
import manifestSource from "../package.json?raw";

describe("V2-07 · deployment contract", () => {
  it("keeps demo turns bounded and provider credentials out of the browser source", () => {
    const manifest = JSON.parse(manifestSource) as {
      scripts?: Record<string, string>;
    };

    expect(appSource).toContain("maxTurns: 100");
    expect(appSource).not.toMatch(/sk-[A-Za-z0-9_-]{12,}/);
    expect(manifest.scripts?.build).toContain("vite build");
    expect(manifest.scripts?.test).toContain("vitest run");
  });
});
