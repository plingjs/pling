import { describe, expect, it } from "vitest";
import {
  createTaskController,
  type TaskDefinition,
  type TaskRunSnapshot,
  type TaskStep,
  type TaskValues,
} from "../src/task";

const studentTask: TaskDefinition = {
  id: "student.cards",
  title: "查看学员会员卡",
  description: "按姓名或手机号找到学员，再读取会员卡。",
  fields: [
    {
      name: "studentRef",
      label: "学员",
      type: "lookup",
      minChars: 2,
      lookup: async (query) =>
        query === "李娜"
          ? [
              { value: "stu_1", label: "李娜", description: "138****1234" },
              { value: "stu_2", label: "李娜", description: "139****5678" },
            ]
          : [],
    },
  ],
  steps: [
    {
      label: "读取学员",
      summary: "确认学员属于当前店铺",
      action: "get_student",
      args: (values) => ({ studentRef: values.studentRef }),
    },
    {
      label: "读取会员卡",
      summary: "只读取，不修改会员卡",
      action: "get_student_cards",
      args: (values) => ({ studentRef: values.studentRef }),
    },
  ],
};

function createHarness() {
  const calls: Array<{ action: string; args: Record<string, unknown> }> = [];
  const controller = createTaskController({
    now: (() => {
      let tick = 0;
      return () => ++tick;
    })(),
    invoke: async (action, args) => {
      calls.push({ action, args });
      return { result: { ok: true } };
    },
  });
  return { controller, calls };
}

describe("guided task controller", () => {
  it("registers definitions and starts with defaults", () => {
    const { controller } = createHarness();
    controller.register({
      ...studentTask,
      fields: [{ name: "limit", label: "数量", type: "number", defaultValue: 10, optional: true }],
    });

    const snapshot = controller.start("student.cards");
    expect(snapshot.status).toBe("ready");
    expect(snapshot.values).toEqual({ limit: 10 });
    expect(snapshot.mode).toBe("steps");
    expect(snapshot.steps.map((step) => step.status)).toEqual(["pending", "pending"]);
    expect(controller.get("student.cards")?.title).toBe("查看学员会员卡");
  });

  it("keeps collecting until required fields are present", async () => {
    const { controller, calls } = createHarness();
    controller.register(studentTask);

    expect(controller.start("student.cards").status).toBe("collecting");
    const after = controller.setValue("studentRef", "stu_1");
    expect(after.status).toBe("ready");
    expect(after.values.studentRef).toBe("stu_1");

    const final = await controller.run();
    expect(final.status).toBe("done");
    expect(calls).toEqual([
      { action: "get_student", args: { studentRef: "stu_1" } },
      { action: "get_student_cards", args: { studentRef: "stu_1" } },
    ]);
    expect(final.steps.map((step) => step.status)).toEqual(["ok", "ok"]);
  });

  it("returns a field error instead of running an incomplete task", async () => {
    const { controller, calls } = createHarness();
    controller.register(studentTask);
    controller.start("student.cards");

    const final = await controller.run();
    expect(final.status).toBe("collecting");
    expect(final.error).toEqual({ code: "TASK_FIELDS_REQUIRED", message: "学员" });
    expect(calls).toEqual([]);
  });

  it("stops on failure and marks the failing step", async () => {
    const controller = createTaskController({
      invoke: async (action) => {
        if (action === "get_student") return { error: { code: "NOT_FOUND", message: "找不到学员" } };
        return { result: { ok: true } };
      },
    });
    controller.register(studentTask);
    controller.start("student.cards", { studentRef: "missing" });

    const final = await controller.run();
    expect(final.status).toBe("failed");
    expect(final.error).toEqual({ code: "NOT_FOUND", message: "找不到学员" });
    expect(final.steps.map((step) => [step.status, step.error?.code])).toEqual([
      ["failed", "NOT_FOUND"],
      ["pending", undefined],
    ]);
  });

  it("skips an optional failing step and continues", async () => {
    const steps: TaskStep[] = [
      { label: "可选提示", action: "tip", optional: true },
      { label: "读取会员卡", action: "get_student_cards" },
    ];
    const controller = createTaskController({
      invoke: async (action) => {
        if (action === "tip") throw new Error("提示服务不可用");
        return { result: { ok: true } };
      },
    });
    controller.register({ ...studentTask, fields: [], steps });
    controller.start("student.cards");

    const final = await controller.run();
    expect(final.status).toBe("done");
    expect(final.steps.map((step) => step.status)).toEqual(["skipped", "ok"]);
    expect(final.steps[0]?.error).toEqual({ code: "TASK_STEP_FAILED", message: "提示服务不可用" });
  });

  it("builds an agent prompt without invoking an action", async () => {
    const { controller, calls } = createHarness();
    controller.register({
      id: "student.question",
      title: "询问学员情况",
      fields: [{ name: "studentName", label: "学员姓名" }],
      prompt: "请查询 {{studentName}} 的会员卡是否有效。",
    });
    controller.start("student.question", { studentName: "李娜" });

    const final = await controller.run();
    expect(final.mode).toBe("agent");
    expect(final.status).toBe("ready");
    expect(final.prompt).toBe("请查询 李娜 的会员卡是否有效。");
    expect(calls).toEqual([]);
  });

  it("emits progress snapshots and remembers completion time", async () => {
    const { controller } = createHarness();
    controller.register(studentTask);
    controller.start("student.cards", { studentRef: "stu_1" });
    const seen: TaskRunSnapshot[] = [];
    controller.subscribe((snapshot) => seen.push(snapshot));

    const final = await controller.run();
    expect(seen.map((snapshot) => snapshot.status)).toEqual([
      "planned",
      "running",
      "running",
      "verifying",
      "running",
      "verifying",
      "done",
    ]);
    expect(final.startedAt).toBeDefined();
    expect(final.finishedAt).toBeGreaterThan(final.startedAt!);
  });

  it("cancels before a pending step and aborts the injected signal", async () => {
    let release!: () => void;
    let signal: AbortSignal | undefined;
    const controller = createTaskController({
      invoke: async (_action, _args, context) => {
        signal = context.signal;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { result: { ok: true } };
      },
    });
    controller.register({ ...studentTask, fields: [], steps: [{ label: "读取", action: "read" }] });
    controller.start("student.cards");
    const running = controller.run();
    await Promise.resolve();
    controller.cancel();
    release();

    const final = await running;
    expect(signal?.aborted).toBe(true);
    expect(final.status).toBe("cancelled");
  });

  it("rejects duplicate ids and changing fields after execution starts", async () => {
    const { controller } = createHarness();
    controller.register(studentTask);
    expect(() => controller.register(studentTask)).toThrow(/Duplicate task id/);

    controller.start("student.cards", { studentRef: "stu_1" });
    await controller.run();
    expect(() => controller.setValue("studentRef", "stu_2")).toThrow(/fields can no longer be changed/);
  });

  it("throws for unknown tasks and unknown fields", () => {
    const { controller } = createHarness();
    expect(() => controller.start("missing")).toThrow(/Unknown task/);
    controller.register(studentTask);
    controller.start("student.cards");
    expect(() => controller.setValue("missing", "x")).toThrow(/has no field/);
  });

  it("accepts an ExecResult-shaped success and failure", async () => {
    const values: TaskValues = {};
    const controller = createTaskController({
      invoke: async (action) => {
        if (action === "bad") return { result: { ok: false, error: { code: "DENIED", message: "不允许" } } };
        return { result: { ok: true }, ...values };
      },
    });
    controller.register({
      id: "shape",
      title: "形状",
      steps: [
        { label: "好", action: "good" },
        { label: "坏", action: "bad" },
      ],
    });
    controller.start("shape");
    const final = await controller.run();
    expect(final.status).toBe("failed");
    expect(final.error).toEqual({ code: "DENIED", message: "不允许" });
  });

  it("can freeze values into a plan without executing", () => {
    const { controller, calls } = createHarness();
    controller.register(studentTask);
    controller.start("student.cards", { studentRef: "stu_1" });

    const planned = controller.plan();

    expect(planned.status).toBe("planned");
    expect(planned.confirmation).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it("requires explicit task-level confirmation before the first step", async () => {
    const { controller, calls } = createHarness();
    controller.register({
      id: "teacher.create",
      title: "Add a teacher",
      confirm: true,
      fields: [{ name: "name", label: "Name" }],
      steps: [{ label: "Create", action: "create_teacher" }],
    });
    controller.start("teacher.create", { name: "Chen Yu" });

    const waiting = await controller.run();
    expect(waiting.status).toBe("waiting");
    expect(waiting.waitingFor).toBe("confirmation");
    expect(waiting.confirmation).toEqual({ required: true, confirmed: false });
    expect(calls).toEqual([]);

    expect(controller.confirm().status).toBe("planned");
    const final = await controller.run();
    expect(final.status).toBe("done");
    expect(final.confirmation).toEqual({ required: true, confirmed: true });
    expect(calls).toEqual([{ action: "create_teacher", args: {} }]);
  });

  it("surfaces human handoff and verification as distinct task states", async () => {
    const controller = createTaskController({
      invoke: async (_action, _args, context) => {
        context.report("waiting", "handoff");
        context.report("verifying");
        return { result: { ok: true } };
      },
    });
    controller.register({
      id: "captcha",
      title: "Complete the captcha",
      steps: [{ label: "Confirm in the browser", action: "confirm_captcha", handoff: true }],
    });
    controller.start("captcha");
    const seen: TaskRunSnapshot[] = [];
    controller.subscribe((snapshot) => seen.push(snapshot));

    expect((await controller.run()).status).toBe("done");
    expect(seen.some((snapshot) => snapshot.status === "waiting" && snapshot.waitingFor === "handoff")).toBe(true);
    expect(seen.some((snapshot) => snapshot.status === "verifying")).toBe(true);
  });

  it("binds a page record without turning it into an editable field", async () => {
    const calls: Array<{ args: Record<string, unknown>; record?: string }> = [];
    const controller = createTaskController({
      invoke: async (_action, args, context) => {
        calls.push({ args, record: context.binding.record?.id });
        return { result: { ok: true } };
      },
    });
    controller.register({
      id: "lesson.reschedule",
      title: "Reschedule the open lesson",
      fields: [{ name: "time", label: "New time" }],
      steps: [{
        label: "Move the lesson",
        action: "reschedule_lesson",
        args: (values, binding) => ({ lessonId: binding.record?.id, time: values.time }),
      }],
    });

    const started = controller.start(
      "lesson.reschedule",
      { time: "15:00" },
      { record: { id: "lesson_1", label: "Yoga · 18 March 10:00" } },
    );
    expect(started.binding).toEqual({ record: { id: "lesson_1", label: "Yoga · 18 March 10:00" } });
    expect(started.fields.map((field) => field.name)).toEqual(["time"]);

    const final = await controller.run();
    expect(final.status).toBe("done");
    expect(calls).toEqual([{ args: { lessonId: "lesson_1", time: "15:00" }, record: "lesson_1" }]);
  });

  it("requires a selected record when the definition asks for one", () => {
    const controller = createTaskController({ invoke: async () => ({ ok: true }) });
    controller.register({
      id: "lesson.note",
      title: "Write a lesson note",
      requiresRecord: true,
      fields: [{ name: "note", label: "Note" }],
      steps: [{ label: "Save the note", action: "update_lesson_note" }],
    });

    expect(() => controller.start("lesson.note", { note: "Call Friday" })).toThrow(/requires a selected record/);
    expect(() => controller.start("lesson.note", { note: "Call Friday" }, { record: { id: " " } })).toThrow(
      /requires a selected record/,
    );
    expect(
      controller.start("lesson.note", { note: "Call Friday" }, { record: { id: "lesson_1" } }).status,
    ).toBe("ready");
  });
});
