import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  new URL("../../demos/course-workspace-vue3/src/course-create.css", import.meta.url),
  "utf8",
);

describe("course assistant style boundaries", () => {
  it("leaves assistant internals to the shared component stylesheet", () => {
    expect(stylesheet).toContain(".assistant-agent {");
    expect(stylesheet).not.toMatch(/\.assistant-agent\s+[^\s{]/);
  });

  it("keeps the business sidebar separate from assistant message classes", () => {
    expect(stylesheet).toContain(".course-assistant {");
    expect(stylesheet).not.toMatch(/\.assistant(?:\s*[,.:#\[]|\s*\{)/);
  });
});
