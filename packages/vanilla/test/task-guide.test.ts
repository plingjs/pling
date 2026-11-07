import { afterEach, describe, expect, it, vi } from "vitest";
import { createTaskGuide, type TaskGuideDefinition } from "../src/task-guide";

afterEach(() => {
  document.body.innerHTML = "";
});

const definition: TaskGuideDefinition = {
  taskId: "record.create",
  title: "Create a record",
  stepSubtitle: "Record · step {step} of {total}",
  labels: { running: "In progress", completed: "Completed" },
  steps: [
    {
      id: "record.details",
      label: "Details",
      title: "Confirm the details",
      description: "Review the read-only values before writing them into the page.",
      rowsTitle: "Suggested values",
      rows: [
        { label: "Name", value: "Yoga foundations" },
        { label: "Difficulty", value: 3, format: "stars" },
      ],
      primary: { label: "Write to page", command: "apply-details" },
      secondary: { label: "Locate field", command: "focus-details" },
    },
    {
      id: "record.cover",
      label: "Cover",
      title: "Choose a cover",
      description: "This step needs a local file.",
      handoff: { title: "Human handoff", description: "Choose the image in the page." },
      primary: { label: "Locate cover", command: "focus-cover" },
      secondary: { label: "Continue", command: "check-cover" },
    },
  ],
  done: {
    title: "Record created",
    description: "Read back from the page.",
    actions: [{ label: "View record", command: "view-record" }],
  },
};

function mountGuide() {
  const commands = vi.fn();
  const guide = createTaskGuide({ definition, onCommand: commands });
  document.body.append(guide.element);
  return { guide, commands };
}

describe("guided task renderer", () => {
  it("keeps the welcome message typographic when no avatar is configured", () => {
    const guide = createTaskGuide({
      definition: { ...definition, welcome: "I can help with this form." },
      onCommand: vi.fn(),
    });
    document.body.append(guide.element);

    expect(guide.element.querySelector(".pling-guide__bubble")?.textContent).toBe("I can help with this form.");
    expect(guide.element.querySelector(".pling-guide__avatar")).toBeNull();

    guide.destroy();
  });

  it("renders a read-only guide and emits business commands", () => {
    const { guide, commands } = mountGuide();

    expect(guide.element.querySelectorAll("input, textarea, select")).toHaveLength(0);
    expect(guide.element.textContent).toContain("step 1 of 2");
    expect(guide.element.textContent).toContain("Yoga foundations");
    expect(guide.element.textContent).toContain("★★★☆☆");

    guide.element.querySelector<HTMLButtonElement>(".pling-guide__primary")!.click();
    expect(commands).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.objectContaining({ command: "apply-details" }),
      stepIndex: 1,
      done: false,
    }));

    guide.destroy();
    expect(document.querySelector(".pling-guide")).toBeNull();
  });

  it("switches to handoff, busy, error, and completed states", () => {
    const { guide } = mountGuide();

    guide.setStep(2);
    expect(guide.element.textContent).toContain("Human handoff");
    expect(guide.element.textContent).toContain("Choose the image in the page.");

    guide.setBusy(true);
    expect(guide.element.querySelector<HTMLButtonElement>(".pling-guide__primary")!.disabled).toBe(true);

    guide.setError("Choose a cover first.");
    expect(guide.element.textContent).toContain("Choose a cover first.");

    guide.complete();
    expect(guide.element.textContent).toContain("Record created");
    expect(guide.element.textContent).toContain("View record");
    expect(guide.element.textContent).not.toContain("Human handoff");

    guide.reset();
    expect(guide.element.textContent).toContain("step 1 of 2");
    expect(guide.element.textContent).not.toContain("Record created");
  });

  it("renders field-level state and forwards row and cancel actions", () => {
    const commands = vi.fn();
    const guide = createTaskGuide({
      definition: {
        ...definition,
        cancel: { label: "Cancel task", command: "cancel-task" },
        steps: [
          {
            ...definition.steps[0]!,
            rows: [
              {
                label: "Name",
                value: "Yoga foundations",
                status: "suggested",
                badge: "Suggested",
                note: "From the course template",
                action: { label: "Use", command: "apply-name" },
              },
            ],
          },
        ],
      },
      onCommand: commands,
    });
    document.body.append(guide.element);

    expect(guide.element.querySelector(".pling-guide__row.is-suggested")).not.toBeNull();
    expect(guide.element.textContent).toContain("Suggested");
    expect(guide.element.textContent).toContain("From the course template");

    guide.element.querySelector<HTMLButtonElement>(".pling-guide__row-action")!.click();
    expect(commands).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.objectContaining({ command: "apply-name" }),
    }));

    guide.element.querySelector<HTMLButtonElement>(".pling-guide__cancel")!.click();
    expect(commands).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.objectContaining({ command: "cancel-task" }),
    }));

    guide.destroy();
  });

  it("renders a compact field rail instead of the full step card", () => {
    const commands = vi.fn();
    const guide = createTaskGuide({
      definition: {
        ...definition,
        labels: { required: "Required", optional: "Optional", skipped: "Skipped" },
        fields: [
          { field: "name", label: "Name", required: true, filled: true },
          { field: "note", label: "Note", suggested: true },
        ],
      },
      onCommand: commands,
    });
    document.body.append(guide.element);

    expect(guide.element.classList.contains("pling-guide--rail")).toBe(true);
    expect(guide.element.querySelector(".pling-guide__body")).toBeNull();
    expect(guide.element.textContent).toContain("step 1 of 2");
    expect(guide.element.textContent).toContain("Required");
    expect(guide.element.textContent).toContain("Optional");
    expect(guide.element.querySelector(".pling-guide__rail-item.is-filled .pling-guide__rail-dot")?.textContent).toBe("✓");
    expect(guide.element.querySelector(".pling-guide__rail-item.is-suggested")).not.toBeNull();

    guide.element.querySelector<HTMLButtonElement>('.pling-guide__rail-item[data-field="note"] button')!.click();
    expect(commands).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.objectContaining({ command: "focus-note" }),
    }));

    guide.destroy();
  });

  it("marks a skipped optional field in the rail before the task is done", () => {
    const guide = createTaskGuide({
      definition: {
        ...definition,
        labels: { required: "Required", optional: "Optional", skipped: "Skipped" },
        fields: [
          { field: "name", label: "Name", required: true, filled: true },
          { field: "note", label: "Note", skipped: true },
          { field: "cover", label: "Cover", required: true },
        ],
      },
      onCommand: vi.fn(),
    });
    document.body.append(guide.element);

    const skipped = guide.element.querySelector('.pling-guide__rail-item[data-field="note"]');
    const current = guide.element.querySelector('.pling-guide__rail-item[data-field="cover"]');
    expect(skipped?.classList.contains("is-skipped")).toBe(true);
    expect(skipped?.querySelector(".pling-guide__rail-dot")?.textContent).toBe("–");
    expect(skipped?.textContent).toContain("Skipped");
    expect(current?.classList.contains("is-current")).toBe(true);

    guide.destroy();
  });
});
