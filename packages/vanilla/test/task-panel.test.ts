import { afterEach, describe, expect, it } from "vitest";
import { createTaskController, type TaskDefinition } from "@plingjs/agent";
import { createTaskCard, createTaskPanel } from "../src/task-panel";
import { click, setInput, waitFor } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
});

const courseTask: TaskDefinition = {
  id: "course.schedule",
  title: "Schedule a lesson",
  description: "Find a student, choose a card, then create the lesson.",
  fields: [
    {
      name: "studentRef",
      label: "Student",
      type: "lookup",
      minChars: 2,
      lookup: async (query) =>
        query === "Li Na"
          ? [
              { value: "stu_1", label: "Li Na", description: "138****1234" },
              { value: "stu_2", label: "Li Na", description: "139****5678" },
            ]
          : [],
    },
    {
      name: "cardRef",
      label: "Membership card",
      values: [
        { value: "card_10", label: "Ten lessons" },
        { value: "card_20", label: "Twenty lessons" },
      ],
    },
  ],
  steps: [
    {
      label: "Check the student",
      summary: "Confirm the student belongs to this shop.",
      action: "get_student",
      args: (values) => ({ studentRef: values.studentRef }),
    },
    {
      label: "Create the lesson",
      summary: "Use the selected card and time.",
      action: "create_lesson",
      args: (values) => ({ studentRef: values.studentRef, cardRef: values.cardRef }),
    },
  ],
};

function harness(definition: TaskDefinition = courseTask) {
  const calls: Array<{ action: string; args: Record<string, unknown> }> = [];
  const controller = createTaskController({
    invoke: async (action, args) => {
      calls.push({ action, args });
      return {
        result: {
          ok: true,
          data: action === "create_lesson" ? { message: "Lesson created" } : undefined,
        },
      };
    },
  });
  controller.register(definition);
  const panel = createTaskPanel(controller, { locale: "en-US" });
  document.body.append(panel.element);
  return { calls, controller, panel };
}

describe("guided task panel", () => {
  it("lists tasks, resolves a lookup, and shows human-readable progress", async () => {
    const { calls, panel } = harness();
    expect(document.querySelector(".pling-task-panel__title")?.textContent).toBe("Guided tasks");
    expect(document.querySelector(".pling-task-card__title")?.textContent).toContain("Schedule a lesson");

    click(document.querySelector(".pling-task-card"));
    const lookup = document.querySelector<HTMLInputElement>('input[type="search"]')!;
    setInput(lookup, "Li Na");
    click(document.querySelector(".pling-task-panel__secondary"));
    await waitFor(() => document.querySelectorAll(".pling-task-choice").length === 2);

    click(document.querySelector(".pling-task-choice"));
    const card = document.querySelector<HTMLSelectElement>("select")!;
    card.value = "card_10";
    card.dispatchEvent(new Event("change", { bubbles: true }));

    const run = document.querySelector<HTMLButtonElement>(".pling-task-panel__primary")!;
    expect(run.disabled).toBe(false);
    click(run);
    await waitFor(() => document.querySelectorAll(".pling-task-step[data-status='ok']").length === 2);

    expect(calls).toEqual([
      { action: "get_student", args: { studentRef: "stu_1" } },
      { action: "create_lesson", args: { studentRef: "stu_1", cardRef: "card_10" } },
    ]);
    expect(document.body.textContent).toContain("Lesson created");
    expect(document.body.textContent).toContain("Completed");
    panel.destroy();
  });

  it("keeps the run button disabled until required fields are present", () => {
    const { panel } = harness();
    click(document.querySelector(".pling-task-card"));
    expect(document.querySelector<HTMLButtonElement>(".pling-task-panel__primary")!.disabled).toBe(true);

    const card = document.querySelector<HTMLSelectElement>("select")!;
    card.value = "card_10";
    card.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.querySelector<HTMLButtonElement>(".pling-task-panel__primary")!.disabled).toBe(true);
    panel.destroy();
  });

  it("reports a failed step without exposing the raw action id", async () => {
    const definition: TaskDefinition = {
      ...courseTask,
      fields: [],
      steps: [{ label: "Check the student", action: "internal_get_student" }],
    };
    const controller = createTaskController({
      invoke: async () => ({ error: { code: "NOT_FOUND", message: "Action internal_get_student failed: Student does not exist" } }),
    });
    controller.register(definition);
    const panel = createTaskPanel(controller, { locale: "en-US" });
    document.body.append(panel.element);

    click(document.querySelector(".pling-task-card"));
    click(document.querySelector(".pling-task-panel__primary"));
    await waitFor(() => document.querySelector(".pling-task-panel__error") !== null);

    expect(document.body.textContent).toContain("Student does not exist");
    expect(document.body.textContent).not.toContain("internal_get_student");
    expect(document.body.textContent).not.toContain("Action internal_get_student failed");
    panel.destroy();
  });

  it("emits an agent prompt instead of invoking a model", async () => {
    const controller = createTaskController({ invoke: async () => ({ ok: true }) });
    controller.register({
      id: "student.summary",
      title: "Explain a student",
      fields: [{ name: "name", label: "Student name" }],
      prompt: "Summarize the membership for {{name}}.",
    });
    const panel = createTaskPanel(controller, { locale: "en-US" });
    document.body.append(panel.element);
    const received: string[] = [];
    panel.element.addEventListener("pling-task-prompt", (event) => {
      received.push((event as CustomEvent<{ prompt: string }>).detail.prompt);
    });

    panel.open("student.summary", { name: "Li Na" });
    click(document.querySelector(".pling-task-panel__primary"));
    await waitFor(() => received.length === 1);

    expect(received).toEqual(["Summarize the membership for Li Na."]);
    expect(document.querySelector(".pling-task-panel__primary")?.textContent).toBe("Send to assistant");
    panel.destroy();
  });

  it("shows a task-level confirmation before running any step", async () => {
    const confirmationTask: TaskDefinition = {
      id: "danger.archive",
      title: "Archive the customer",
      confirm: true,
      steps: [{ label: "Archive", action: "archive_customer" }],
    };
    const { calls, panel } = harness(confirmationTask);

    click(document.querySelector(".pling-task-card"));
    click(document.querySelector(".pling-task-panel__primary"));
    await waitFor(() => document.querySelector(".pling-task-panel__primary")?.textContent === "Confirm and run");
    expect(calls).toEqual([]);
    expect(document.body.textContent).toContain("Review the plan");

    click(document.querySelector(".pling-task-panel__primary"));
    await waitFor(() => calls.length === 1);
    expect(calls).toEqual([{ action: "archive_customer", args: {} }]);
    panel.destroy();
  });

  it("requires a bound record and names it before execution", async () => {
    const recordTask: TaskDefinition = {
      id: "lesson.note",
      title: "Write a lesson note",
      description: "Add a note to the lesson selected on the page.",
      requiresRecord: true,
      fields: [{ name: "note", label: "Note" }],
      steps: [{
        label: "Save the note",
        action: "update_lesson_note",
        args: (values, binding) => ({ lessonId: binding.record?.id, note: values.note }),
      }],
    };
    const { calls, panel } = harness(recordTask);
    const card = document.querySelector<HTMLButtonElement>(".pling-task-card")!;

    expect(card.disabled).toBe(true);
    expect(card.textContent).toContain("Open this task from a record row");
    expect(() => panel.open("lesson.note", { note: "Call Friday" })).toThrow(/requires a selected record/);

    panel.open(
      "lesson.note",
      { note: "Call Friday" },
      { record: { id: "lesson_1", label: "Yoga · 18 March 10:00" } },
    );
    expect(document.body.textContent).toContain("Current record: Yoga · 18 March 10:00");
    click(document.querySelector(".pling-task-panel__primary"));
    await waitFor(() => calls.length === 1);

    expect(calls).toEqual([{ action: "update_lesson_note", args: { lessonId: "lesson_1", note: "Call Friday" } }]);
    panel.destroy();
  });

  it("keeps the chat card out of the transcript until a task opens", () => {
    const controller = createTaskController({ invoke: async () => ({ ok: true }) });
    controller.register(courseTask);
    const card = createTaskCard(controller, { locale: "en-US", catalog: false });
    document.body.append(card.element);

    expect(card.element.hidden).toBe(true);
    card.open("course.schedule");
    expect(card.element.hidden).toBe(false);
    expect(document.querySelector(".pling-task-panel__run-title")?.textContent).toBe("Schedule a lesson");
    card.destroy();
  });

  it("can reveal the task catalog without losing the current run", () => {
    const controller = createTaskController({ invoke: async () => ({ ok: true }) });
    controller.register(courseTask);
    const card = createTaskCard(controller, { locale: "en-US", catalog: false });
    document.body.append(card.element);

    card.open("course.schedule");
    expect(document.querySelector(".pling-task-card")).toBeNull();
    card.setCatalog(true);
    expect(card.element.hidden).toBe(false);
    expect(document.querySelector(".pling-task-panel__run-title")?.textContent).toBe("Schedule a lesson");

    card.close();
    expect(document.querySelector(".pling-task-card__title")?.textContent).toContain("Schedule a lesson");
    card.destroy();
  });
});

