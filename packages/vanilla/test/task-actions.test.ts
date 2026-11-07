import { createRegistry } from "@plingjs/core";
import type { TaskDefinition } from "@plingjs/agent";
import { describe, expect, it, vi } from "vitest";
import { registerTaskLookupActions } from "../src/task-actions";

function definitions(): TaskDefinition[] {
  return [
    {
      id: "course.schedule",
      title: "Schedule a lesson",
      fields: [
        {
          name: "studentId",
          label: "student",
          type: "lookup",
          searchAction: "search_students",
          minChars: 2,
          lookup: (query) => [
            { value: `id:${query}`, label: `${query} A`, description: "138 •••• 0001" },
            { value: "id:b", label: `${query} B` },
            { value: "id:c", label: `${query} C` },
          ],
        },
      ],
      steps: [{ label: "Schedule", action: "create_lesson" }],
    },
  ];
}

describe("task lookup actions", () => {
  it("exposes the same lookup to the model and caps the candidate list", async () => {
    const registry = createRegistry();
    const unbind = registerTaskLookupActions({ registry, warn: () => {} }, definitions(), { maxResults: 2 });
    const binding = registry.get("search_students");

    expect(binding?.descriptor).toMatchObject({
      primitive: "call",
      kind: "read",
      description: expect.stringContaining("student"),
    });
    await expect(binding!.run!({ query: "Li" })).resolves.toEqual({
      query: "Li",
      choices: [
        { value: "id:Li", label: "Li A", description: "138 •••• 0001" },
        { value: "id:b", label: "Li B" },
      ],
    });

    unbind();
    expect(registry.get("search_students")).toBeUndefined();
  });

  it("honors minChars without calling the lookup", async () => {
    const registry = createRegistry();
    const lookup = vi.fn(definitions()[0]!.fields![0]!.lookup!);
    const defs = definitions();
    defs[0]!.fields![0]!.lookup = lookup;
    registerTaskLookupActions({ registry, warn: () => {} }, defs);

    await expect(registry.get("search_students")!.run!({ query: "L" })).resolves.toEqual({
      query: "L",
      minChars: 2,
      choices: [],
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("registers a shared search id once and reports the conflict", () => {
    const registry = createRegistry();
    const warn = vi.fn();
    const defs = definitions();
    defs.push({ ...defs[0]!, id: "course.other" });

    registerTaskLookupActions({ registry, warn }, defs);

    expect(registry.get("search_students")).toBeDefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("search_students"));
  });
});
