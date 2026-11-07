import type { TaskGuideDefinition, TaskGuideField } from "@plingjs/agent";
import type { Locale } from "../course-workspace/copy";
import { COURSE_CREATE_COPY } from "./copy";
import { recommendedCourse, type CourseDraft, type CourseTeacher } from "./model";

export interface CourseGuideOptions {
  locale: Locale;
  readDraft(): CourseDraft;
  readSkipped?: () => readonly string[];
  teachers: readonly CourseTeacher[];
}

export interface CourseFieldNode extends TaskGuideField {
  /** The recommendation shown in chat while the page is still empty. */
  suggestion?: string;
}

export function courseCreateFieldNodes(
  locale: Locale,
  value: CourseDraft,
  teachers: readonly CourseTeacher[],
  skipped: readonly string[] = [],
): CourseFieldNode[] {
  const text = COURSE_CREATE_COPY[locale];
  const recommended = recommendedCourse(locale, teachers);
  const labels = locale === "zh"
    ? { name: "课程名称", difficulty: "难度", intro: "课程介绍", teacher: "授课老师", cards: "可用卡片", note: "约课须知", cover: "课程封面", deduct: "扣卡次数", price: "单节金额" }
    : { name: "Name", difficulty: "Level", intro: "Intro", teacher: "Teacher", cards: "Cards", note: "Notes", cover: "Cover", deduct: "Deduct", price: "Price" };
  const nodes: CourseFieldNode[] = [
    { field: "name", label: labels.name, required: true, filled: Boolean(value.name.trim()), suggestion: recommended.name },
    { field: "difficulty", label: labels.difficulty, filled: Boolean(value.difficulty), suggestion: locale === "zh" ? `${recommended.difficulty} 星` : `${recommended.difficulty} stars` },
    { field: "intro", label: labels.intro, filled: Boolean(value.intro.trim()), suggestion: recommended.intro },
    { field: "teacher", label: labels.teacher, required: true, filled: Boolean(value.teacherId), suggestion: recommended.teacherName },
    { field: "cards", label: labels.cards, required: true, filled: Boolean(value.cards.trim()), suggestion: recommended.cards },
    { field: "note", label: labels.note, filled: Boolean(value.note.trim()), suggestion: recommended.note },
    { field: "cover", label: labels.cover, required: true, filled: value.cover },
    { field: "deduct", label: labels.deduct, filled: Boolean(value.deduct), suggestion: recommended.deduct },
    { field: "price", label: labels.price, filled: Boolean(value.price), suggestion: recommended.price },
  ];
  return nodes.map((node) => ({
    ...node,
    ...(node.suggestion && !node.filled ? { suggested: true } : {}),
    ...(!node.filled && skipped.includes(node.field) ? { skipped: true } : {}),
  }));
}

export function createCourseGuideDefinition(options: CourseGuideOptions): TaskGuideDefinition {
  const text = COURSE_CREATE_COPY[options.locale];
  return {
    taskId: "course.create",
    title: text.taskCourse,
    welcome: text.welcome,
    footer: text.footer,
    stepSubtitle: text.stepSubtitle,
    cancel: { label: text.cancelTask, command: "cancel-task" },
    agent: {
      review: "review-task",
      proposeSave: "propose-save",
      cancel: "cancel-task",
    },
    labels: { ...text.labels, required: text.required, optional: text.optional },
    fields: () =>
      courseCreateFieldNodes(
        options.locale,
        options.readDraft(),
        options.teachers,
        options.readSkipped?.() ?? [],
      ),
    steps: [
      {
        id: "course.fill",
        label: text.taskCourse,
        title: text.taskCourse,
        description: text.welcome,
      },
    ],
  };
}

