import type { TaskDefinition, TaskValues } from "@plingjs/agent";
import type { Registry } from "@plingjs/core";
import { bindAction, registerTaskLookupActions } from "@plingjs/vanilla";
import type { Locale } from "../course-workspace/copy";
import type { Course, CourseDraft, CourseTeacher, RecommendedCourse } from "./model";

export interface CourseTaskOptions {
  locale: Locale;
  teachers: readonly CourseTeacher[];
  recommended: RecommendedCourse;
  cardOptions: readonly string[];
  createCourse(draft: CourseDraft): Course;
}

export interface CourseTaskHost {
  registry: Registry;
  warn(message: string): void;
}

function valueOf(values: TaskValues, key: string): string {
  const value = values[key];
  return value === null || value === undefined ? "" : String(value);
}

export function createCourseTaskDefinition(options: CourseTaskOptions): TaskDefinition {
  const zh = options.locale === "zh";
  const teacherLookup = (query: string) => {
    const needle = query
      .trim()
      .toLowerCase()
      .replace(/\s*(老师|教師|教师|teacher)$/i, "")
      .trim();
    return options.teachers
      .filter(
        (teacher) =>
          !needle || teacher.name.toLowerCase().includes(needle) || teacher.subject.toLowerCase().includes(needle),
      )
      .map((teacher) => ({
        value: teacher.id,
        label: teacher.name,
        description: teacher.subject,
      }));
  };

  return {
    id: "course.create",
    title: zh ? "创建课程" : "Create a course",
    description: zh
      ? "把课程名称、老师、可用卡与排课默认值写入课程库，并回读列表确认结果。"
      : "Write a course, its teacher, eligible cards and scheduling defaults into the catalogue, then read it back.",
    objective: zh
      ? "帮助用户把一门可上架的课程创建到课程库，而不是机械地逐个询问字段。"
      : "Help the person create a publishable course in the catalogue instead of walking a fixed field sequence.",
    constraints: zh
      ? [
          "课程名称、授课老师、可用卡和封面是完成条件；难度、介绍、须知、扣卡次数和价格可省略。",
          "封面必须由用户亲自上传，助手不能伪造。",
          "所有写入仍走 create_course 动作、执行器和回读校验。",
          "用户的问题、修改、暂停和放弃优先于继续收集字段。",
        ]
      : [
          "The course name, teacher, eligible cards and cover are required; difficulty, intro, notes, deductions and price are optional.",
          "The cover must be uploaded by the person; the assistant must not fake it.",
          "Every write still goes through the create_course action, executor and read-back verification.",
          "Questions, corrections, pauses and abandonment take precedence over collecting the next field.",
        ],
    successCriteria: zh
      ? ["新课程出现在课程库第一位", "名称、老师、可用卡与封面和用户确认的一致", "写入后重新读取课程列表验证成功"]
      : ["The new course appears first in the catalogue", "Name, teacher, eligible cards and cover match what the person confirmed", "The catalogue is read back after the write"],
    examples: zh ? ["新建瑜伽基础，周敏老师，月卡，200 元"] : ["Create Yoga foundations with Zhou Min, monthly card, ¥200"],
    risk: "write",
    fields: [
      {
        name: "name",
        label: zh ? "课程名称" : "Course name",
        type: "text",
        minLength: 1,
        maxLength: 40,
        recommended: options.recommended.name,
      },
      {
        name: "teacherId",
        label: zh ? "授课老师" : "Teacher",
        type: "lookup",
        lookup: teacherLookup,
        searchAction: "search_teachers",
        minChars: 1,
        validate: (value) =>
          options.teachers.some((teacher) => teacher.id === value)
            ? null
            : zh
              ? "请从 search_teachers 的结果中选择老师。"
              : "Choose a teacher from the search_teachers results.",
        recommended: options.recommended.teacherId,
      },
      {
        name: "cards",
        label: zh ? "课程可用卡片" : "Eligible cards",
        type: "select",
        values: options.cardOptions.map((value) => ({ value, label: value })),
        recommended: options.recommended.cards,
      },
      {
        name: "difficulty",
        label: zh ? "难度" : "Difficulty",
        type: "number",
        optional: true,
        min: 1,
        max: 5,
        recommended: options.recommended.difficulty,
      },
      {
        name: "intro",
        label: zh ? "课程介绍" : "Course introduction",
        type: "textarea",
        optional: true,
        maxLength: 200,
        recommended: options.recommended.intro,
      },
      {
        name: "note",
        label: zh ? "约课须知" : "Booking notes",
        type: "textarea",
        optional: true,
        maxLength: 200,
        recommended: options.recommended.note,
      },
      {
        name: "deduct",
        label: zh ? "每节课扣卡次数" : "Classes deducted",
        type: "text",
        optional: true,
        pattern: "^[1-9]\\d*$",
        recommended: options.recommended.deduct,
      },
      {
        name: "price",
        label: zh ? "每节课金额" : "Price per class",
        type: "text",
        optional: true,
        pattern: "^\\d+(?:\\.\\d+)?$",
        recommended: options.recommended.price,
      },
      {
        name: "cover",
        label: zh ? "课程封面" : "Course cover",
        type: "boolean",
        help: zh ? "需要用户亲自上传" : "Must be uploaded by the user",
        agentWritable: false,
      },
    ],
    steps: [
      {
        id: "course.save",
        label: zh ? "写入课程库并回读" : "Write and read back",
        summary: zh ? "保存课程，并确认新记录出现在课程列表第一位。" : "Save the course and confirm it appears first in the catalogue.",
        action: "create_course",
        args: (values) => {
          const teacher = options.teachers.find((item) => item.id === valueOf(values, "teacherId"));
          return {
            name: valueOf(values, "name"),
            teacherId: valueOf(values, "teacherId"),
            teacherName: teacher?.name ?? "",
            cards: valueOf(values, "cards"),
            difficulty: Number(values.difficulty) || options.recommended.difficulty,
            intro: valueOf(values, "intro"),
            note: valueOf(values, "note"),
            cover: Boolean(values.cover),
            deduct: valueOf(values, "deduct") || options.recommended.deduct,
            price: valueOf(values, "price") || options.recommended.price,
          } satisfies CourseDraft;
        },
      },
    ],
  };
}

export function registerCourseCreateActions(host: CourseTaskHost, options: CourseTaskOptions): Array<() => void> {
  const zh = options.locale === "zh";
  const definition = createCourseTaskDefinition(options);
  const create = bindAction(host, {
    id: "create_course",
    desc: zh ? "在课程库中新建一门课程" : "Create a course in the catalogue",
    label: zh ? "创建课程" : "Create course",
    summary: zh ? "写入课程名称、老师、可用卡与排课默认值" : "Write the course name, teacher, eligible cards and scheduling defaults",
    examples: zh ? ["新建瑜伽基础，周敏老师，月卡，200 元"] : ["Create Yoga foundations with Zhou Min, monthly card, ¥200"],
    successHint: zh ? "新课程出现在课程库第一位" : "The new course appears first in the catalogue",
    kind: "write",
    confirm: false,
    modelVisible: false,
    params: {
      type: "object",
      properties: {
        name: { type: "string", description: zh ? "课程名称" : "Course name" },
        teacherId: { type: "string", description: zh ? "老师 id，可先调用 search_teachers" : "Teacher id; use search_teachers first when needed" },
        cards: { type: "string", description: zh ? "可用会员卡" : "Eligible membership cards" },
        difficulty: { type: "number", description: zh ? "难度，1 到 5" : "Difficulty from 1 to 5" },
        intro: { type: "string", description: zh ? "课程介绍" : "Course introduction" },
        note: { type: "string", description: zh ? "约课须知" : "Booking notes" },
        deduct: { type: "string", description: zh ? "每节课扣卡次数" : "Classes deducted per booking" },
        price: { type: "string", description: zh ? "每节课金额" : "Price per class" },
        cover: { type: "boolean", description: zh ? "课程封面已由用户上传" : "The user has uploaded a course cover" },
      },
      required: ["name", "teacherId", "cards", "cover"],
    },
    run: (args) => {
      const course = options.createCourse({
        name: String(args.name ?? ""),
        teacherId: String(args.teacherId ?? ""),
        teacherName: String(args.teacherName ?? ""),
        cards: String(args.cards ?? ""),
        difficulty: Number(args.difficulty ?? 0),
        intro: String(args.intro ?? ""),
        note: String(args.note ?? ""),
        cover: Boolean(args.cover),
        deduct: String(args.deduct ?? ""),
        price: String(args.price ?? ""),
      });
      return {
        message: zh ? `已创建课程“${course.name}”` : `Created “${course.name}”`,
        courseId: course.id,
      };
    },
  });
  const lookups = registerTaskLookupActions(host, [definition], {
    description: (field) =>
      zh
        ? `按姓名或科目搜索${field.label}；返回的 value 用作后续动作的 ${field.name}`
        : `Search ${field.label} by name or subject. Use the returned value as ${field.name}.`,
  });
  return [create, lookups];
}
