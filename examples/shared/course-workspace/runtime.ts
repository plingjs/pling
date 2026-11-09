import { createExecutor, createPolicy, type Registry } from "@plingjs/core";
import {
  createTaskController,
  defaultSettle,
  type TaskBinding,
  type TaskCatalog,
  type TaskController,
  type TaskDefinition,
  type TaskValues,
} from "@plingjs/agent";
import {
  bindAction,
  createTaskPanel,
  registerTaskLookupActions,
  type GuidedTaskPanel,
} from "@plingjs/vanilla";
import { COPY, type Locale } from "./copy";
import type { CourseService, Lesson } from "./course-service";
import { createCourseGuide, type CourseGuideController } from "./course-guide";
import type { CourseFormController } from "./course-form";
import { createTaskDefinitions } from "./tasks";

export function describeCourseState(service: CourseService): Record<string, unknown> {
  return {
    courses: service.courses.map((course) => ({
      id: course.id,
      name: course.name,
      teacher: course.teacher,
      cards: course.cards,
      price: course.price,
      status: course.status,
    })),
    students: service.students.map((student) => ({
      id: student.id,
      name: student.name,
      phone: student.phoneMasked,
      cards: student.cards.map((card) => ({ name: card.name, remaining: card.remaining })),
    })),
    teachers: service.teachers.map((teacher) => ({ id: teacher.id, name: teacher.name, subject: teacher.subject })),
    lessons: service.lessons.map((lesson) => ({
      id: lesson.id,
      date: lesson.date,
      time: lesson.time,
      course: lesson.course,
      note: lesson.note,
    })),
  };
}

export function courseQuickPrompts(locale: Locale): string[] {
  return locale === "zh"
    ? ["李娜有哪些会员卡？", "新增老师陈雨，手机号 136 0000 7788", "新建课程：普拉提进阶，林琳老师，月卡", "给李娜约 3 月 18 日 10:00 的瑜伽课"]
    : ["What cards does Li Na have?", "Add teacher Chen Yu, phone 136 0000 7788", "Create Pilates foundations with Lin Lin", "Book Li Na into yoga on 18 March at 10:00"];
}

export interface CourseActionHost {
  registry: Registry;
  warn(message: string): void;
}

export function registerCourseActions(host: CourseActionHost, service: CourseService, locale: Locale): Array<() => void> {
  const zh = locale === "zh";
  const knownTeachers = new Set(service.teachers.map((teacher) => teacher.id));
  const knownCourses = new Set(service.courses.map((course) => course.id));
  const knownLessons = new Set(service.lessons.map((lesson) => lesson.id));
  const expectNew = (
    items: readonly { id: string }[],
    known: Set<string>,
    desc: string,
  ) => ({
    desc,
    check: () => {
      const added = items.find((item) => !known.has(item.id));
      if (!added) return false;
      for (const item of items) known.add(item.id);
      return true;
    },
  });
  const params = {
    studentId: { type: "string", description: zh ? "学员 id" : "Student id" },
    teacherId: { type: "string", description: zh ? "老师 id" : "Teacher id" },
    date: { type: "string", description: zh ? "日期，YYYY-MM-DD" : "Date in YYYY-MM-DD" },
    time: { type: "string", description: zh ? "时间，HH:mm" : "Time in HH:mm" },
    course: { type: "string", description: zh ? "课程名称" : "Course name" },
    courseId: { type: "string", description: zh ? "课程 id" : "Course id" },
    cards: { type: "string", description: zh ? "可用会员卡" : "Eligible membership cards" },
    difficulty: { type: "number", description: zh ? "难度，1 到 5" : "Difficulty from 1 to 5" },
    price: { type: "number", description: zh ? "每节课金额" : "Price per class" },
    deduct: { type: "number", description: zh ? "每节课扣卡次数" : "Classes deducted per booking" },
    intro: { type: "string", description: zh ? "课程介绍" : "Course introduction" },
    name: { type: "string", description: zh ? "老师姓名" : "Teacher name" },
    phone: { type: "string", description: zh ? "手机号" : "Phone number" },
    subject: { type: "string", description: zh ? "教学科目" : "Subject" },
    lessonId: { type: "string", description: zh ? "课程 id" : "Lesson id" },
    note: { type: "string", description: zh ? "课程备注" : "Lesson note" },
  } as const;

  let expectedNote = "";
  let expectedNoteLesson = "";

  return [
    bindAction(host, {
      id: "create_course",
      desc: zh ? "在课程库中新建一门课程" : "Create a course in the catalogue",
      label: zh ? "新建课程" : "Create course",
      summary: zh ? "填写课程名称、老师、可用卡与价格，保存后课程会出现在课程库" : "Enter the course name, teacher, eligible cards and price; the course then appears in the catalogue",
      examples: zh ? ["新建普拉提进阶，林琳老师，月卡，180 元"] : ["Create Pilates foundations with Lin Lin, monthly card, ¥180"],
      successHint: zh ? "新课程出现在课程库首位" : "The new course appears at the top of the catalogue",
      kind: "write",
      modelVisible: false,
      params: {
        type: "object",
        properties: {
          name: params.course,
          teacherId: params.teacherId,
          cards: params.cards,
          difficulty: params.difficulty,
          price: params.price,
          deduct: params.deduct,
          intro: params.intro,
          note: params.note,
        },
        required: ["name", "teacherId", "cards", "price", "deduct"],
      },
      run: (args) => service.createCourse(args),
      expect: expectNew(service.courses, knownCourses, zh ? "新课程出现在课程库中" : "The new course appears in the catalogue"),
    }),
    bindAction(host, {
      id: "get_student_cards",
      desc: zh ? "读取一位学员的会员卡与剩余次数" : "Read one student's membership cards and remaining classes",
      label: zh ? "查询会员卡" : "View membership cards",
      summary: zh ? "按学员姓名或手机号查找，再读取卡与剩余次数" : "Find a student by name or phone, then read their cards and remaining classes",
      examples: zh ? ["李娜还有几张卡？", "查一下 138 0000 1234 的会员卡"] : ["How many cards does Li Na have?", "Show the cards for 138 0000 1234"],
      successHint: zh ? "返回学员的会员卡与剩余次数" : "The student's cards and remaining classes are returned",
      kind: "read",
      params: { type: "object", properties: { studentId: params.studentId }, required: ["studentId"] },
      run: (args) => service.getStudentCards(args),
    }),
    bindAction(host, {
      id: "create_teacher",
      desc: zh ? "新增一位可排课的老师" : "Add a teacher who can be scheduled",
      label: zh ? "新增老师" : "Add teacher",
      summary: zh ? "填写姓名、手机号与科目；成功后老师会进入排课选择" : "Enter name, phone and subject; the teacher becomes available for scheduling",
      examples: zh ? ["新增老师陈雨，手机号 136 0000 7788，教瑜伽"] : ["Add Chen Yu, phone 136 0000 7788, subject yoga"],
      successHint: zh ? "新老师出现在可选老师中" : "The new teacher appears in the teacher selector",
      kind: "write",
      params: {
        type: "object",
        properties: { name: params.name, phone: params.phone, subject: params.subject },
        required: ["name", "phone", "subject"],
      },
      run: (args) => service.createTeacher(args),
      expect: expectNew(service.teachers, knownTeachers, zh ? "新老师出现在可选老师中" : "The new teacher appears in the teacher selector"),
    }),
    bindAction(host, {
      id: "check_slot",
      desc: zh ? "检查一位老师在指定日期与时间是否空闲" : "Check whether a teacher is free on a date and time",
      label: zh ? "检查空闲时段" : "Check availability",
      summary: zh ? "在创建课程前确认老师没有同一时段的冲突" : "Confirm the teacher has no conflict before creating a lesson",
      examples: zh ? ["周敏 3 月 18 日 10:00 有空吗？"] : ["Is Zhou Min free on 18 March at 10:00?"],
      successHint: zh ? "明确返回该时段是否可用" : "Returns whether the slot is available",
      kind: "read",
      params: {
        type: "object",
        properties: { teacherId: params.teacherId, date: params.date, time: params.time },
        required: ["teacherId", "date", "time"],
      },
      run: (args) => service.checkSlot(args),
    }),
    bindAction(host, {
      id: "create_lesson",
      desc: zh ? "在老师空闲的时段创建一节课程" : "Create a lesson during a teacher's free slot",
      label: zh ? "排课" : "Schedule lesson",
      summary: zh ? "把学员、老师、日期、时间与课程组合成一节课" : "Combine a student, teacher, date, time and course into one lesson",
      examples: zh ? ["给李娜约 3 月 18 日 10:00 的瑜伽课"] : ["Book Li Na into yoga on 18 March at 10:00"],
      successHint: zh ? "课程出现在课表中，且老师时段不再空闲" : "The lesson appears in the timetable and the teacher's slot is no longer free",
      kind: "write",
      params: {
        type: "object",
        properties: {
          studentId: params.studentId,
          teacherId: params.teacherId,
          date: params.date,
          time: params.time,
          course: params.course,
        },
        required: ["studentId", "teacherId", "date", "time", "course"],
      },
      run: (args) => service.createLesson(args),
      expect: expectNew(service.lessons, knownLessons, zh ? "新课程出现在课表中" : "The new lesson appears in the timetable"),
    }),
    bindAction(host, {
      id: "update_lesson_note",
      desc: zh ? "给已选中的课程保存备注" : "Save a note on a selected lesson",
      label: zh ? "保存课程备注" : "Save lesson note",
      summary: zh ? "课程由页面选中，动作只接收备注内容" : "The page has already selected the lesson; the action receives only the note",
      examples: zh ? ["给第一节课程写备注：客户确认周五回电"] : ["Write “customer confirmed Friday callback” on the first lesson"],
      successHint: zh ? "备注出现在该课程的记录中" : "The note appears on that lesson record",
      kind: "write",
      params: {
        type: "object",
        properties: { lessonId: params.lessonId, note: params.note },
        required: ["lessonId", "note"],
      },
      run: (args) => {
        expectedNoteLesson = typeof args.lessonId === "string" ? args.lessonId : "";
        expectedNote = typeof args.note === "string" ? args.note : "";
        return service.updateLessonNote(args);
      },
      expect: {
        desc: zh ? "课程记录中显示刚刚保存的备注" : "The lesson record shows the saved note",
        check: () => service.lessons.find((lesson) => lesson.id === expectedNoteLesson)?.note === expectedNote,
      },
    }),
  ];
}

export interface CourseTaskRuntimeOptions {
  registry: Registry;
  ask(prompt: string): Promise<void>;
  service: CourseService;
  locale: Locale;
  /** Page-owned course form. When present, `course.create` runs as a page guide. */
  form?: CourseFormController;
  /** Shared guided-task catalogue owned by the framework instance (`pling.task`). */
  catalog?: TaskCatalog;
  /** Optional standalone panel mount. Omit when a chat card renders the same controller. */
  host?: HTMLElement;
  onComplete?: () => void;
}

export interface CourseLessonNoteLaunch {
  taskId: "lesson.note";
  values: TaskValues;
  binding: TaskBinding;
}

export interface CourseTaskLaunch {
  taskId: string;
  values: TaskValues;
  binding?: TaskBinding;
}

export interface CourseTaskRuntime {
  readonly panel: GuidedTaskPanel | null;
  readonly controller: TaskController;
  /** Page-guided presentation for `course.create`, when a form was supplied. */
  readonly guide: CourseGuideController | null;
  readonly mode: "guide" | "task";
  onMode(listener: (mode: "guide" | "task") => void): () => void;
  /** Open an unbound task, or return the launch descriptor for a chat card. */
  openTask(taskId: string, values?: TaskValues): CourseTaskLaunch | null;
  /** Open the bound note task, or return the launch descriptor for a chat card. */
  openLessonNote(lesson: Lesson): CourseLessonNoteLaunch | null;
  refresh(): void;
  destroy(): void;
}

export function createCourseTaskRuntime(options: CourseTaskRuntimeOptions): CourseTaskRuntime {
  const { registry, service, locale, host } = options;
  const copy = COPY[locale];
  let mode: "guide" | "task" = options.form ? "guide" : "task";
  const modeListeners = new Set<(mode: "guide" | "task") => void>();
  const setMode = (next: "guide" | "task"): void => {
    if (mode === next) return;
    mode = next;
    for (const listener of modeListeners) listener(mode);
  };
  const executor = createExecutor({
    registry,
    policy: createPolicy(async () => true),
    settle: defaultSettle,
  });
  const controller = createTaskController({
    invoke: (action, args) => executor.execute(action, JSON.stringify(args)),
  });
  let guide: CourseGuideController | null = null;
  const currentCourseValues = (): TaskValues => {
    if (!options.form) return {};
    const value = options.form.read();
    return {
      name: value.name.trim(),
      teacherId: value.teacherId,
      cards: value.cards,
      difficulty: value.difficulty || undefined,
      price: value.price || undefined,
      deduct: value.deduct || undefined,
      intro: value.intro,
      note: value.note,
      cover: value.cover ? true : undefined,
    };
  };
  const restartCourse = (): void => {
    setMode("guide");
    if (options.catalog) {
      options.catalog.activate("course.create", { startedBy: "page" });
    } else {
      controller.start("course.create", currentCourseValues());
      guide?.open();
    }
  };
  guide = options.form
    ? createCourseGuide({
        controller,
        form: options.form,
        teachers: service.teachers,
        locale,
        onActivate: () => setMode("guide"),
        onComplete: () => options.onComplete?.(),
        onRestart: restartCourse,
        onCancel: () => options.catalog?.deactivate(),
      })
    : null;

  let registrations: Array<() => void> = [];
  let teacherSignature = "";

  const refresh = (): void => {
    const next = service.teachers.map((teacher) => `${teacher.id}:${teacher.name}`).join("|");
    if (next === teacherSignature) return;
    teacherSignature = next;
    for (const off of registrations) off();
    const definitions = createTaskDefinitions(service, locale);
    registrations = definitions.map((definition: TaskDefinition) =>
      options.catalog
        ? options.catalog.define({
            definition,
            controller,
            ...(definition.id === "course.create" && options.form
              ? {
                  guide: guide?.definition,
                  initialValues: currentCourseValues,
                  onActivate: () => {
                    setMode("guide");
                    guide?.open();
                  },
                  onCommand: (command) => guide?.command(command),
                  state: () => guide?.state() ?? {},
                }
              : {}),
          })
        : controller.register(definition),
    );
    registrations.push(
      registerTaskLookupActions({ registry, warn: (message) => console.warn(message) }, definitions, {
        description: (field) =>
          locale === "zh"
            ? `按姓名或手机号搜索${field.label}；返回的 value 用作后续动作的 ${field.name}`
            : `Search ${field.label} by name or phone. Use the returned value as ${field.name}.`,
      }),
    );
    panel?.refresh();
    guide?.refresh();
  };

  const panel = host
    ? createTaskPanel(controller, {
        locale: locale === "zh" ? "zh-CN" : "en-US",
        title: copy.taskPanelTitle,
        onPrompt: (prompt) => options.ask(prompt),
        onComplete: () => options.onComplete?.(),
      })
    : null;
  if (panel && host) host.append(panel.element);
  refresh();

  const openTask = (taskId: string, values: TaskValues = {}): CourseTaskLaunch | null => {
    if (taskId === "course.create" && guide) {
      setMode("guide");
      if (options.catalog) {
        options.catalog.activate("course.create", { values, startedBy: "page" });
      } else {
        controller.start("course.create", { ...currentCourseValues(), ...values });
        guide.open();
      }
      return null;
    }
    setMode("task");
    if (panel) {
      panel.open(taskId, values);
      options.catalog?.activate(taskId, { values, startedBy: "page" });
      return null;
    }
    return { taskId, values };
  };

  return {
    panel,
    controller,
    guide,
    get mode() {
      return mode;
    },
    onMode(listener) {
      modeListeners.add(listener);
      return () => modeListeners.delete(listener);
    },
    openTask,
    openLessonNote(lesson) {
      setMode("task");
      const binding: TaskBinding = {
        record: {
          id: lesson.id,
          label: `${lesson.course} · ${lesson.date} ${lesson.time}`,
        },
      };
      if (panel) {
        panel.open("lesson.note", {}, binding);
        return null;
      }
      return { taskId: "lesson.note", values: {}, binding };
    },
    refresh,
    destroy() {
      for (const off of registrations) off();
      registrations = [];
      panel?.destroy();
      guide?.destroy();
      modeListeners.clear();
    },
  };
}

export interface CourseTaskView {
  readonly element: HTMLElement;
  destroy(): void;
}

/**
 * One slot for the two task views used by the business demo: the page-guided
 * course flow and the generic card for record-bound tasks such as lesson notes.
 */
export function createCourseTaskView(card: GuidedTaskPanel, runtime: CourseTaskRuntime): CourseTaskView {
  const element = document.createElement("div");
  element.className = "course-task-view";
  element.append(card.element);
  if (runtime.guide) element.append(runtime.guide.element);

  const sync = (): void => {
    const guideActive = runtime.mode === "guide" && Boolean(runtime.guide);
    element.dataset.mode = guideActive ? "guide" : "task";
    if (runtime.guide) runtime.guide.element.hidden = !guideActive;
    card.element.hidden = guideActive;
  };
  const off = runtime.onMode(sync);
  sync();

  return {
    element,
    destroy() {
      off();
      element.remove();
    },
  };
}
