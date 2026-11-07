import type { TaskGuideDefinition, TaskGuideField, TaskGuideRow } from "@plingjs/agent";
import type { Locale } from "../course-workspace/copy";
import { COURSE_CREATE_COPY } from "./copy";
import { recommendedCourse, type CourseDraft, type RecommendedCourse, type CourseTeacher } from "./model";

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
  const recommended: RecommendedCourse = recommendedCourse(options.locale, options.teachers);
  const draft = (): CourseDraft => options.readDraft();
  const teacherName = (value: CourseDraft): string => {
    const selected = options.teachers.find((teacher) => teacher.id === value.teacherId);
    return selected?.name ?? value.teacherName ?? recommended.teacherName;
  };
  const fieldRow = (params: {
    field: string;
    label: string;
    current: string | number | boolean | null | undefined;
    fallback?: string | number | boolean;
    value: string | number | boolean | null | undefined;
    format?: TaskGuideRow["format"];
    filled?: boolean;
    suggested?: boolean;
  }): TaskGuideRow => {
    const filled = params.filled ?? Boolean(
      typeof params.current === "string" ? params.current.trim() : params.current,
    );
    const suggested = !filled && params.fallback !== undefined && params.suggested !== false;
    const status = filled ? "current" : suggested ? "suggested" : "missing";
    return {
      label: params.label,
      value: filled ? params.value : (params.fallback ?? "—"),
      ...(params.format ? { format: params.format } : {}),
      status,
      badge: filled ? text.row.current : suggested ? text.row.suggested : text.row.missing,
      ...(suggested ? { note: text.row.source } : {}),
      action: {
        label: filled ? text.row.locate : suggested ? text.row.use : text.row.choose,
        command: filled || !suggested ? `focus-${params.field}` : `apply-${params.field}`,
      },
    };
  };

  return {
    taskId: "course.create",
    title: text.taskCourse,
    welcome: text.welcome,
    footer: text.footer,
    stepSubtitle: text.stepSubtitle,
    cancel: { label: text.cancelTask, command: "cancel-task" },
    labels: { ...text.labels, required: text.required, optional: text.optional },
    fields: () => courseCreateFieldNodes(options.locale, draft(), options.teachers, options.readSkipped?.() ?? []),
    steps: [
      {
        id: "course.basics",
        label: text.steps[0],
        title: text.basics.title,
        description: text.basics.description,
        rowsTitle: text.valuesTitle,
        rows: () => {
          const value = draft();
          return [
            fieldRow({ field: "name", label: text.basics.name, current: value.name, fallback: recommended.name, value: value.name }),
            fieldRow({ field: "difficulty", label: text.basics.difficulty, current: value.difficulty, fallback: recommended.difficulty, value: value.difficulty, format: "stars" }),
            fieldRow({ field: "intro", label: text.basics.intro, current: value.intro, fallback: recommended.intro, value: value.intro }),
          ];
        },
        primary: { label: text.basics.primary, command: "apply-basics" },
        secondary: { label: text.basics.secondary, command: "focus-basics" },
      },
      {
        id: "course.teaching",
        label: text.steps[1],
        title: text.teaching.title,
        description: text.teaching.description,
        rowsTitle: text.valuesTitle,
        rows: () => {
          const value = draft();
          return [
            fieldRow({
              field: "teacher",
              label: text.teaching.teacher,
              current: value.teacherId,
              fallback: recommended.teacherName,
              value: teacherName(value),
            }),
            fieldRow({ field: "cards", label: text.teaching.cards, current: value.cards, fallback: recommended.cards, value: value.cards }),
            fieldRow({ field: "note", label: text.teaching.note, current: value.note, fallback: recommended.note, value: value.note }),
          ];
        },
        primary: { label: text.teaching.primary, command: "apply-teaching" },
        secondary: { label: text.teaching.secondary, command: "focus-teaching" },
      },
      {
        id: "course.cover",
        label: text.steps[2],
        title: text.cover.title,
        description: text.cover.description,
        rowsTitle: text.valuesTitle,
        rows: () => [
          fieldRow({
            field: "cover",
            label: text.review.cover,
            current: draft().cover,
            fallback: text.review.coverNo,
            suggested: false,
            value: text.review.coverYes,
          }),
        ],
        handoff: { title: text.cover.handoffTitle, description: text.cover.handoffBody },
        primary: { label: text.cover.primary, command: "focus-cover" },
        secondary: { label: text.cover.secondary, command: "check-cover" },
      },
      {
        id: "course.review",
        label: text.steps[3],
        title: text.review.title,
        description: text.review.description,
        rowsTitle: text.valuesTitle,
        rows: () => {
          const value = draft();
          return [
            fieldRow({ field: "difficulty", label: text.review.difficulty, current: value.difficulty, fallback: recommended.difficulty, value: value.difficulty, format: "stars" }),
            fieldRow({ field: "teacher", label: text.review.teacher, current: value.teacherId, value: teacherName(value) }),
            fieldRow({ field: "cards", label: text.review.cards, current: value.cards, value: value.cards }),
            fieldRow({ field: "cover", label: text.review.cover, current: value.cover, fallback: text.review.coverNo, suggested: false, value: text.review.coverYes }),
            fieldRow({
              field: "price",
              label: text.review.deductAndPrice,
              current: value.price,
              fallback: `${value.deduct || recommended.deduct} × · ¥${recommended.price}`,
              value: `${value.deduct || recommended.deduct} × · ¥${value.price || "—"}`,
            }),
          ];
        },
        primary: { label: text.review.primary, busyLabel: text.review.busy, command: "save-course" },
        secondary: { label: text.review.secondary, command: "focus-save" },
      },
    ],
    done: {
      title: (snapshot) => {
        const name = String(snapshot?.values.name ?? "").trim() || draft().name.trim() || recommended.name;
        return text.done.title(name);
      },
      description: text.done.description,
      actions: [
        { label: text.done.view, command: "view-course" },
        { label: text.done.restart, command: "restart" },
      ],
    },
  };
}

