import { describe, expect, it, vi } from "vitest";
import { createRegistry } from "@plingjs/core";
import { createTaskCatalog, createTaskController } from "@plingjs/agent";
import type { Course, CourseTeacher } from "./model";
import { createCourseTaskDefinition } from "./task";

const teachers: CourseTeacher[] = [
  { id: "teacher_chen", name: "陈老师", subject: "瑜伽" },
  { id: "teacher_wang", name: "王老师", subject: "普拉提" },
];

function setup() {
  const registry = createRegistry();
  const controller = createTaskController({ invoke: vi.fn(async () => ({ ok: true })) });
  const catalog = createTaskCatalog({ registry });
  const onCommand = vi.fn();
  const definition = createCourseTaskDefinition({
    locale: "zh",
    teachers,
    cardOptions: ["月卡", "季卡"],
    recommended: {
      name: "瑜伽基础",
      teacherId: "teacher_chen",
      teacherName: "陈老师",
      cards: "月卡",
      difficulty: 3,
      intro: "从基础呼吸和体式开始。",
      note: "请提前 10 分钟到店。",
      cover: false,
      deduct: "1",
      price: "200",
    },
    createCourse: (draft) => ({ id: "course_new", ...draft }) as unknown as Course,
  });
  catalog.define({
    definition,
    controller,
    guide: {
      taskId: "course.create",
      title: "创建课程",
      steps: [{ id: "details", label: "课程信息", title: "填写课程信息", description: "使用页面表单。" }],
      agent: { review: "review-task", proposeSave: "propose-save", cancel: "cancel-task" },
    },
    onCommand,
  });
  registry.setPage({ path: "/courses", name: "courses" });
  return { registry, controller, catalog, onCommand };
}

describe("course task definition", () => {
  it("accepts several values from one sentence and keeps them as working memory", async () => {
    const { registry, catalog, controller } = setup();
    catalog.activate("course.create");
    const update = registry.get(catalog.updateActionId)!;

    await update.run!({
      task: "course.create",
      values: { name: "孕妇瑜伽", teacherId: "teacher_chen", difficulty: 2, intro: "温和的孕期练习。" },
    });

    expect(controller.snapshot()?.values).toMatchObject({
      name: "孕妇瑜伽",
      teacherId: "teacher_chen",
      difficulty: 2,
      intro: "温和的孕期练习。",
    });
    catalog.destroy();
  });

  it("rejects invalid values before writing any of them", async () => {
    const { registry, catalog, controller } = setup();
    catalog.activate("course.create");
    const update = registry.get(catalog.updateActionId)!;
    await expect(update.run!({ task: "course.create", values: { teacherId: "teacher_missing" } })).rejects.toThrow(
      "search_teachers",
    );
    await expect(update.run!({ task: "course.create", values: { difficulty: 9 } })).rejects.toThrow("at most 5");
    await expect(update.run!({ task: "course.create", values: { deduct: "1.5" } })).rejects.toThrow("required format");
    await expect(
      update.run!({ task: "course.create", values: { name: "这是一门非常长的课程名称".repeat(4) } }),
    ).rejects.toThrow("at most 40");
    expect(controller.snapshot()?.values).toEqual({});
    catalog.destroy();
  });

  it("does not open the save step while required fields are missing", async () => {
    const { registry, catalog, controller, onCommand } = setup();
    catalog.activate("course.create");
    const update = registry.get(catalog.updateActionId)!;
    const propose = registry.get(catalog.proposeSaveActionId)!;

    await update.run!({ task: "course.create", values: { name: "孕妇瑜伽" } });
    const result = await propose.run!({ task: "course.create" });

    expect(result).toMatchObject({ handled: false, awaitingConfirmation: false });
    expect(result.missingRequiredFields).toContain("teacherId");
    expect(onCommand).not.toHaveBeenCalled();
    catalog.destroy();
  });
});
