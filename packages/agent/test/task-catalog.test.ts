import { describe, expect, it, vi } from "vitest";
import { createRegistry } from "@plingjs/core";
import {
  createTaskCatalog,
  createTaskController,
  renderTaskContext,
  type TaskDefinition,
  type TaskStep,
} from "../src";

const step: TaskStep = {
  id: "write",
  label: "Write",
  action: "write_record",
};

function definition(id: string, overrides: Partial<TaskDefinition> = {}): TaskDefinition {
  return {
    id,
    title: `Task ${id}`,
    description: `Description for ${id}`,
    examples: [`Run ${id}`],
    fields: [
      { name: "name", label: "Name" },
      { name: "count", label: "Count", type: "number", optional: true },
    ],
    steps: [step],
    ...overrides,
  };
}

function setup() {
  const registry = createRegistry();
  const invoke = vi.fn(async () => ({ ok: true }));
  const controller = createTaskController({ invoke });
  const catalog = createTaskCatalog({ registry });
  return { registry, controller, catalog, invoke };
}

describe("guided task catalog", () => {
  it("derives availability from the route and active scopes", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({ definition: definition("global"), controller });
    catalog.define({ definition: definition("course"), controller, route: "/courses" });
    catalog.define({ definition: definition("dialog"), controller, scope: "course-dialog" });

    registry.setPage({ path: "/orders", name: "orders" });
    registry.setAutoScopes([]);
    await Promise.resolve();
    expect(catalog.available().map((item) => item.id)).toEqual(["global"]);

    registry.setPage({ path: "/courses", name: "courses" });
    registry.setAutoScopes(["course-dialog"]);
    await Promise.resolve();
    expect(catalog.available().map((item) => item.id)).toEqual(["global", "course", "dialog"]);

    registry.setPage({ path: "/orders", name: "orders" });
    registry.setAutoScopes([]);
    await Promise.resolve();
    expect(catalog.available().map((item) => item.id)).toEqual(["global"]);
    catalog.destroy();
  });

  it("auto-starts one context task and never keeps two guides open", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({ definition: definition("first"), controller, route: "/courses", autoStart: true });
    catalog.define({ definition: definition("second"), controller, route: "/courses", autoStart: true });

    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();

    expect(catalog.active()?.id).toBe("first");
    expect(catalog.active()?.startedBy).toBe("page");
    expect(controller.snapshot()?.taskId).toBe("first");

    catalog.activate("second");
    expect(catalog.active()?.id).toBe("second");
    expect(controller.snapshot()?.taskId).toBe("second");

    catalog.deactivate();
    expect(catalog.active()).toBeNull();
    catalog.destroy();
  });

  it("clears an explicit guide when its context stops matching", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({ definition: definition("course"), controller, route: "/courses" });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();

    catalog.activate("course");
    expect(catalog.active()?.id).toBe("course");

    registry.setPage({ path: "/orders", name: "orders" });
    await Promise.resolve();
    expect(catalog.active()).toBeNull();
    catalog.destroy();
  });

  it("keeps an explicitly started journey active across context changes when requested", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({
      definition: definition("journey"),
      controller,
      route: "/courses",
      scope: "course-dialog",
      keepActive: true,
    });
    registry.setPage({ path: "/courses", name: "courses" });
    registry.setAutoScopes(["course-dialog"]);
    await Promise.resolve();

    catalog.activate("journey");
    expect(catalog.active()?.id).toBe("journey");

    registry.setAutoScopes([]);
    registry.setPage({ path: "/lessons", name: "lessons" });
    await Promise.resolve();
    expect(catalog.available()).toHaveLength(0);
    expect(catalog.active()?.id).toBe("journey");

    catalog.deactivate();
    await Promise.resolve();
    expect(catalog.active()).toBeNull();
    catalog.destroy();
  });

  it("keeps a completed guide visible after its scope closes, but not after a route change", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({ definition: definition("dialog"), controller, scope: "course-dialog", autoStart: true });
    registry.setAutoScopes(["course-dialog"]);
    await Promise.resolve();
    // The page identity may arrive after the scope activates it.
    expect(catalog.active()?.id).toBe("dialog");
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();

    controller.setValue("name", "Yoga foundations");
    await controller.run();
    expect(controller.snapshot()?.status).toBe("done");

    registry.setAutoScopes([]);
    await Promise.resolve();
    expect(catalog.active()?.id).toBe("dialog");

    registry.setPage({ path: "/orders", name: "orders" });
    await Promise.resolve();
    expect(catalog.active()).toBeNull();
    catalog.destroy();
  });

  it("exposes pling_start_task only for currently available tasks and records agent origin", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({ definition: definition("course"), controller, route: "/courses" });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();

    const action = registry.get("pling_start_task");
    expect(action).toBeDefined();
    const params = (action!.resolveParams?.() ?? action!.descriptor.params)!;
    const valuesSchema = (params.properties as Record<string, any>).values;
    expect(valuesSchema).toMatchObject({
      type: "object",
      properties: {
        name: { type: "string" },
        count: { type: "number" },
      },
      additionalProperties: false,
    });
    const result = await action!.run!({ task: "course", values: { name: "Yoga foundations", count: 3 } });

    expect(result).toMatchObject({ taskId: "course", active: true, startedBy: "agent" });
    expect(catalog.active()?.startedBy).toBe("agent");
    expect(controller.snapshot()?.values).toMatchObject({ name: "Yoga foundations", count: 3 });
    catalog.destroy();
  });

  it("rejects invented task ids and unknown fields", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({ definition: definition("course"), controller, route: "/courses" });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();
    const action = registry.get("pling_start_task")!;

    await expect(action.run!({ task: "invented" })).rejects.toMatchObject({ code: "INVALID_ARGS" });
    await expect(action.run!({ task: "course", values: { customerId: "stolen" } })).rejects.toMatchObject({
      code: "INVALID_ARGS",
    });
    expect(catalog.active()).toBeNull();
    catalog.destroy();
  });

  it("updates the active task through a separate working-memory action", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({
      definition: definition("course", {
        fields: [
          { name: "name", label: "Name" },
          { name: "count", label: "Count", type: "number", optional: true },
          { name: "cover", label: "Cover", type: "boolean", agentWritable: false },
        ],
      }),
      controller,
      route: "/courses",
    });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();

    catalog.activate("course", { values: { name: "Pregnancy yoga" } });
    const update = registry.get(catalog.updateActionId);
    expect(catalog.updateActionId).toBe("pling_update_task");
    expect(update).toBeDefined();
    const params = (update!.resolveParams?.() ?? update!.descriptor.params)!;
    const valuesSchema = (params.properties as Record<string, any>).values;
    expect(valuesSchema.properties).toHaveProperty("name");
    expect(valuesSchema.properties).toHaveProperty("count");
    expect(valuesSchema.properties).not.toHaveProperty("cover");
    expect((params.properties as Record<string, any>).clear.items.enum).toEqual(["name", "count"]);

    const result = await update!.run!({
      task: "course",
      values: { name: "Prenatal yoga", count: 2 },
    });
    expect(result).toMatchObject({
      taskId: "course",
      status: "collecting",
      values: { name: "Prenatal yoga", count: 2 },
      missingRequiredFields: ["cover"],
    });
    expect(controller.snapshot()?.values).toMatchObject({ name: "Prenatal yoga", count: 2 });

    await update!.run!({ task: "course", clear: ["count"] });
    expect(controller.snapshot()?.values.count).toBeUndefined();
    await expect(update!.run!({ task: "course", values: { cover: true } })).rejects.toMatchObject({
      code: "INVALID_ARGS",
    });
    catalog.destroy();
  });

  it("only exposes working-memory updates while a task is active", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({ definition: definition("course"), controller, route: "/courses" });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();

    const update = registry.get(catalog.updateActionId)!;
    expect(update.isAvailable?.()).toMatchObject({ available: false });

    catalog.activate("course", { values: { name: "Yoga foundations" } });
    expect(update.isAvailable?.()).toBe(true);

    await controller.run();
    expect(controller.snapshot()?.status).toBe("done");
    expect(update.isAvailable?.()).toMatchObject({ available: false });
    await expect(update.run!({ task: "course", values: { count: 1 } })).rejects.toMatchObject({
      code: "ACTION_UNAVAILABLE",
    });
    catalog.destroy();
  });

  it("rejects page-only fields when the model starts a task and explains working memory boundaries", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({
      definition: definition("course", {
        fields: [
          { name: "name", label: "Name", recommended: "Yoga foundations" },
          { name: "cover", label: "Cover", type: "boolean", agentWritable: false },
        ],
      }),
      controller,
      route: "/courses",
    });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();

    const start = registry.get(catalog.actionId)!;
    await expect(start.run!({ task: "course", values: { cover: true } })).rejects.toMatchObject({
      code: "INVALID_ARGS",
    });

    catalog.activate("course", { values: { name: "Yoga foundations" } });
    const text = renderTaskContext(catalog);
    expect(text).toContain("cover (Cover, boolean, required, page-only): (empty)");
    expect(text).toContain("Missing required fields: cover (Cover)");
    expect(text).toContain("recommended: Yoga foundations");
    expect(text).toContain("A single-field delegation is actionable");
    catalog.destroy();
  });

  it("forwards guide commands to the active registration", async () => {
    const { registry, catalog, controller } = setup();
    const onCommand = vi.fn();
    catalog.define({ definition: definition("course"), controller, onCommand });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();
    catalog.activate("course");

    const command = {
      action: { label: "Continue", command: "next" },
      step: null,
      stepIndex: 0,
      done: false,
    } as const;
    expect(catalog.command(command)).toBe(true);
    expect(onCommand).toHaveBeenCalledWith(command, expect.objectContaining({ id: "course" }));
    catalog.destroy();
  });

  it("exposes focus, review, save proposal and cancel as model-safe controls", async () => {
    const { registry, catalog, controller } = setup();
    const onCommand = vi.fn();
    catalog.define({
      definition: definition("course", {
        fields: [
          { name: "name", label: "Name" },
          { name: "cover", label: "Cover", type: "boolean" },
        ],
      }),
      controller,
      guide: {
        taskId: "course",
        title: "Create a course",
        fields: [{ field: "name", label: "Name", required: true }],
        steps: [{ id: "review", label: "Review", title: "Review", description: "Check the page." }],
        cancel: { label: "Cancel", command: "cancel-task" },
        agent: { review: "review-task", proposeSave: "confirm-save" },
      },
      onCommand,
    });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();

    const focus = registry.get(catalog.focusActionId)!;
    const review = registry.get(catalog.reviewActionId)!;
    const proposeSave = registry.get(catalog.proposeSaveActionId)!;
    const cancel = registry.get(catalog.cancelActionId)!;
    expect(focus.isAvailable?.()).toMatchObject({ available: false });

    catalog.activate("course", { values: { name: "Yoga foundations" } });

    expect(focus.isAvailable?.()).toBe(true);
    const focused = await focus.run!({ task: "course", field: "name" });
    expect(focused).toMatchObject({
      taskId: "course",
      field: "name",
      command: "focus-name",
      handled: true,
    });

    const reviewed = await review.run!({ task: "course" });
    expect(reviewed).toMatchObject({ taskId: "course", command: "review-task", reviewed: true });

    const blocked = await proposeSave.run!({ task: "course" });
    expect(blocked).toMatchObject({
      taskId: "course",
      handled: false,
      awaitingConfirmation: false,
      missingRequiredFields: ["cover"],
    });

    controller.setValue("cover", true);
    const proposed = await proposeSave.run!({ task: "course" });
    expect(proposed).toMatchObject({
      taskId: "course",
      command: "confirm-save",
      handled: true,
      awaitingConfirmation: true,
    });
    expect(onCommand).toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.objectContaining({ command: "confirm-save" }) }),
      expect.objectContaining({ id: "course" }),
    );
    expect(controller.snapshot()?.status).not.toBe("done");

    const cancelled = await cancel.run!({ task: "course" });
    expect(cancelled).toMatchObject({ taskId: "course", command: "cancel-task", cancelled: true });
    expect(catalog.active()).toBeNull();
    catalog.destroy();
  });

  it("does not advertise control tools that the guide does not implement", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({
      definition: definition("course"),
      controller,
      guide: {
        taskId: "course",
        title: "Create a course",
        fields: [{ field: "name", label: "Name", required: true }],
        steps: [{ id: "details", label: "Details", title: "Fill details", description: "Use the page form." }],
      },
      onCommand: vi.fn(),
    });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();
    catalog.activate("course");

    expect(registry.get(catalog.focusActionId)?.isAvailable?.()).toBe(true);
    expect(registry.get(catalog.reviewActionId)?.isAvailable?.()).toMatchObject({ available: false });
    expect(registry.get(catalog.proposeSaveActionId)?.isAvailable?.()).toMatchObject({ available: false });
    expect(registry.get(catalog.cancelActionId)?.isAvailable?.()).toMatchObject({ available: false });
    const text = renderTaskContext(catalog);
    expect(text).toContain("Page-owned control tools");
    expect(text).toContain(catalog.focusActionId);
    expect(text).not.toContain(catalog.reviewActionId);
    expect(text).not.toContain(catalog.proposeSaveActionId);
    expect(text).not.toContain(catalog.cancelActionId);
    catalog.destroy();
  });

  it("rejects malformed and business-invalid agent values before they reach the run", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({
      definition: definition("course", {
        fields: [
          { name: "name", label: "Name", maxLength: 12 },
          { name: "difficulty", label: "Difficulty", type: "number", min: 1, max: 5 },
          {
            name: "teacherId",
            label: "Teacher",
            validate: (value) => (value === "teacher_chen" ? null : "Choose a teacher from the search results."),
          },
        ],
      }),
      controller,
      onCommand: vi.fn(),
    });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();
    catalog.activate("course");
    const update = registry.get(catalog.updateActionId)!;

    await expect(update.run!({ task: "course", values: { difficulty: 9 } })).rejects.toThrow("at most 5");
    await expect(update.run!({ task: "course", values: { difficulty: "2" } })).rejects.toThrow("must be a number");
    await expect(update.run!({ task: "course", values: { name: "   " } })).rejects.toThrow("must not be blank");
    await expect(update.run!({ task: "course", values: { name: "A course name that is too long" } })).rejects.toThrow("at most 12");
    await expect(update.run!({ task: "course", values: { teacherId: "guessed" } })).rejects.toThrow("search results");
    expect(controller.snapshot()?.values).toEqual({});

    await expect(
      update.run!({ task: "course", values: { difficulty: 3, teacherId: "teacher_chen" } }),
    ).resolves.toMatchObject({ values: { difficulty: 3, teacherId: "teacher_chen" } });
    catalog.destroy();
  });

  it("notifies subscribers again when an asynchronous guide command settles", async () => {
    const { registry, catalog, controller } = setup();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    catalog.define({ definition: definition("course"), controller, onCommand: () => pending });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();
    catalog.activate("course");

    const listener = vi.fn();
    catalog.subscribe(listener);
    const command = {
      action: { label: "Continue", command: "next" },
      step: null,
      stepIndex: 0,
      done: false,
    } as const;

    expect(catalog.command(command)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    release();
    await pending;
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(2);
    catalog.destroy();
  });

  it("tells the model the registered tasks, their fields, and the no-invention boundary", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({
      definition: definition("course"),
      controller,
      guide: {
        taskId: "course",
        title: "Create a course",
        steps: [
          { id: "details", label: "Details", title: "Fill details", description: "Use the page form." },
          { id: "review", label: "Review", title: "Review", description: "Read the page back." },
        ],
      },
    });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();

    const text = renderTaskContext(catalog);
    expect(text).toContain("## Guided tasks available on this page (1)");
    expect(text).toContain("- course: Task course");
    expect(text).toContain("fields: name (Name) / count (Count, optional)");
    expect(text).toContain("guide steps: Fill details → Review");
    expect(text).toContain("They are the only tasks you may open");
    expect(text).toContain("do not invent or guess missing values");
    catalog.destroy();
  });

  it("gives the model the active task values, gaps, and conversation policy", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({
      definition: definition("course"),
      controller,
      guide: {
        taskId: "course",
        title: "Create a course",
        steps: [{ id: "details", label: "Details", title: "Fill details", description: "Use the page form." }],
      },
    });
    const course = catalog.get("course")!;
    course.definition.objective = "Create a publishable course";
    course.definition.constraints = ["The cover is uploaded by the person"];
    course.definition.successCriteria = ["The course appears in the catalogue"];
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();

    catalog.activate("course", { values: { name: "Pregnancy yoga" } });
    const text = renderTaskContext(catalog);

    expect(text).toContain("### Active guided task: course");
    expect(text).toContain("Goal: Create a publishable course");
    expect(text).toContain("Constraints: The cover is uploaded by the person");
    expect(text).toContain("Success criteria: The course appears in the catalogue");
    expect(text).toContain("name (Name, text, required, agent-writable): Pregnancy yoga");
    expect(text).toContain("count (Count, number, optional, agent-writable): (empty)");
    expect(text).toContain("Missing required fields: (none)");
    expect(text).toContain("Current guide step: 1. Fill details");
    expect(text).toContain("goal + constraints + working memory, not a script");
    expect(text).toContain("pling_update_task");
    expect(text).toContain("A whole sentence is never a field value");
    expect(text).toContain("Do not force the next missing field");
    catalog.destroy();
  });

  it("renders field type, help, and value constraints for the model", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({
      definition: definition("course", {
        fields: [
          {
            name: "difficulty",
            label: "Difficulty",
            type: "number",
            min: 1,
            max: 5,
            help: "Choose 1 to 5 stars.",
          },
          {
            name: "deduct",
            label: "Deductions",
            pattern: "^[1-9]\\d*$",
            minLength: 1,
            maxLength: 2,
          },
        ],
      }),
      controller,
    });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();

    catalog.activate("course");
    const text = renderTaskContext(catalog);
    expect(text).toContain("difficulty (Difficulty, number, required, agent-writable): (empty)");
    expect(text).toContain("help: Choose 1 to 5 stars.");
    expect(text).toContain("range: 1–5");
    expect(text).toContain("deduct (Deductions, text, required, agent-writable): (empty)");
    expect(text).toContain("length: 1–2");
    expect(text).toContain("pattern: /^[1-9]\\d*$/");
    catalog.destroy();
  });

  it("advertises only the page-owned control tools the guide actually exposes", async () => {
    const { registry, catalog, controller } = setup();
    catalog.define({
      definition: definition("course"),
      controller,
      onCommand: vi.fn(),
    });
    registry.setPage({ path: "/courses", name: "courses" });
    await Promise.resolve();
    catalog.activate("course");

    let text = renderTaskContext(catalog);
    expect(text).toContain("Use the available task control tools to point at a field.");
    expect(text).not.toContain("show a review");
    expect(text).not.toContain("save proposal is not a write");

    const registration = catalog.get("course")!;
    registration.guide = {
      taskId: "course",
      title: "Create a course",
      steps: [{ id: "details", label: "Details", title: "Fill details", description: "Use the page form." }],
      agent: { review: "review-task", proposeSave: "propose-save" },
    };
    text = renderTaskContext(catalog);
    expect(text).toContain("point at a field, show a review, propose a save");
    expect(text).toContain("A save proposal is not a write");
    catalog.destroy();
  });
});
