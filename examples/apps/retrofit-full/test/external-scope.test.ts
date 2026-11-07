import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXTERNAL_SCOPE } from "../src/shared/external-scope";

const readJson = (relative: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8")) as Record<string, any>;

describe("external capability contract", () => {
  it("keeps the page, gateway, and retrofit plan on the same allowlist", () => {
    const config = readJson("../surface.config.json");
    const plan = readJson("../retrofit/capabilities.json");

    expect(config.tenants[0].publicDemo.scope).toEqual([...EXTERNAL_SCOPE]);
    expect(plan.external.allowlist).toEqual([...EXTERNAL_SCOPE]);
  });

  it("never mixes excluded row actions into the external allowlist", () => {
    const plan = readJson("../retrofit/capabilities.json");
    const allowlist = new Set<string>(EXTERNAL_SCOPE);

    for (const family of plan.external.excluded as string[]) {
      expect([...allowlist].some((id) => id.startsWith(family))).toBe(false);
    }
  });
});
