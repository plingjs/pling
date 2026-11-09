import { createPling, createTaskCard, type VanillaDock } from "@plingjs/vanilla";
import { createCourseService, type Activity } from "../../../shared/course-workspace/course-service";
import { COPY, fill, resolveDemoLocale } from "../../../shared/course-workspace/copy";
import {
  courseQuickPrompts,
  createCourseTaskView,
  createCourseTaskRuntime,
  describeCourseState,
  registerCourseActions,
  type CourseTaskRuntime,
} from "../../../shared/course-workspace/runtime";
import { getWorkspacePresentation } from "../../../shared/course-workspace/presentation";
import { createCourseForm } from "../../../shared/course-workspace/course-form";
import "../../../shared/course-workspace/styles.css";

const locale = resolveDemoLocale();
const copy = COPY[locale];
const presentation = getWorkspacePresentation(locale);

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

let taskRuntime: CourseTaskRuntime | undefined;
let taskCard: ReturnType<typeof createTaskCard> | undefined;
let taskView: ReturnType<typeof createCourseTaskView> | undefined;
let dock: VanillaDock | undefined;

const service = createCourseService(locale, () => {
  render();
  taskRuntime?.refresh();
  taskCard?.refresh();
}, presentation.courses);

const pling = createPling({
  ui: { locale: locale === "zh" ? "zh-CN" : "en-US" },
  agent: { config: { minActionIntervalMs: 320, limits: { maxTurns: 100 } } },
});

const courseForm = createCourseForm({
  locale,
  teachers: service.teachers,
});
document.body.append(courseForm.element);

let recordOffs: Array<() => void> = [];

registerCourseActions(pling, service, locale);
taskRuntime = createCourseTaskRuntime({
  registry: pling.registry,
  ask: (prompt) => pling.ask(prompt),
  catalog: pling.task,
  service,
  locale,
  form: courseForm,
  onComplete: () => render(),
});
taskCard = createTaskCard(taskRuntime.controller, {
  locale: locale === "zh" ? "zh-CN" : "en-US",
  title: copy.taskPanelTitle,
  onPrompt: (prompt) => void pling.ask(prompt),
});
taskView = createCourseTaskView(taskCard, taskRuntime);
courseForm.setHandlers({
  onSave: () => taskRuntime?.guide?.requestSave(),
  onClose: () => taskRuntime?.guide?.refresh(),
});

const text = (value: string): string => value;

pling.scope(document.querySelector("#students-panel")!, {
  id: "students",
  label: text(locale === "zh" ? "学员" : "Students"),
  description: text(locale === "zh" ? "学员、会员卡与剩余次数" : "Students, membership cards, and remaining classes"),
  role: "main",
});
pling.scope(document.querySelector("#teachers-panel")!, {
  id: "teachers",
  label: text(locale === "zh" ? "老师" : "Teachers"),
  description: text(locale === "zh" ? "可排课的老师及其科目" : "Teachers available for scheduling and their subjects"),
  role: "main",
});
pling.scope(document.querySelector("#schedule-panel")!, {
  id: "schedule",
  label: text(locale === "zh" ? "排课" : "Schedule"),
  description: text(locale === "zh" ? "接下来已安排的课程" : "Upcoming scheduled lessons"),
  role: "main",
});

pling.state("course", () => ({
  ...describeCourseState(service),
}), { description: text(locale === "zh" ? "当前学员、老师与排课状态" : "Current students, teachers, and lessons") });

dock = pling.dock({
  title: locale === "zh" ? "页灵助手" : "Pling assistant",
  placeholder: locale === "zh" ? "告诉助手你要做什么，或继续当前任务…" : "Tell the assistant what to do, or continue this task…",
  quick: courseQuickPrompts(locale),
  debug: { maxCalls: 8 },
  modelSettings: "readonly",
  task: taskView.element,
  mount: document.querySelector("#dock-mount")!,
  layout: "sidebar",
  sidebarMode: "fused",
  defaultOpen: true,
});

function openTaskInChat(taskId: string): void {
  const launch = taskRuntime?.openTask(taskId);
  dock?.open();
  if (!launch) return;
  taskCard?.open(launch.taskId, launch.values, launch.binding);
}

document.querySelector("#create-course")?.addEventListener("click", () => openTaskInChat("course.create"));

function renderCourses(): void {
  const host = document.querySelector("#course-list")!;
  host.replaceChildren();
  for (const course of service.courses) {
    const tile = element("article", "course-tile");
    tile.dataset.courseId = course.id;
    const cover = element("div", `course-cover course-cover--${course.cover}`, course.coverLabel);
    const body = element("div", "course-tile__body");
    const top = element("div", "course-tile__top");
    const status = element("span", `course-status${course.status === "draft" ? " course-status--draft" : ""}`, course.statusLabel);
    top.append(element("h2", undefined, course.name), status);
    const meta = element("div", "course-meta");
    meta.append(
      element("span", undefined, `★ ${course.rating}`),
      element("span", undefined, `${presentation.courseMeta.deduction} ${course.deduct}`),
      element("span", undefined, `¥${course.price}${presentation.courseMeta.perLesson}`),
    );
    body.append(top, element("p", undefined, `${course.teacher} · ${course.cards}`), meta);
    tile.append(cover, body);
    host.append(tile);
  }
}

function renderStudents(): void {
  const host = document.querySelector("#student-list")!;
  host.replaceChildren();
  const nameCounts = new Map<string, number>();
  for (const student of service.students) nameCounts.set(student.name, (nameCounts.get(student.name) ?? 0) + 1);

  for (const student of service.students) {
    const card = element("article", "course-student");
    card.dataset.studentId = student.id;
    const top = element("div", "course-student__top");
    const identity = element("div");
    identity.append(element("strong", undefined, student.name), element("span", "course-muted", student.phoneMasked));
    if ((nameCounts.get(student.name) ?? 0) > 1) {
      identity.append(element("span", "course-duplicate", locale === "zh" ? "重名" : "Duplicate name"));
    }
    const cardCount = element("span", "course-pill", locale === "zh" ? `${student.cards.length} 张卡` : `${student.cards.length} cards`);
    top.append(identity, cardCount);
    card.append(top);
    if (student.cards.length) {
      const list = element("ul", "course-card-list");
      for (const membership of student.cards) {
        const item = element("li");
        item.append(element("span", undefined, membership.name));
        item.append(element("strong", undefined, locale === "zh" ? `剩 ${membership.remaining} 次` : `${membership.remaining} left`));
        item.append(element("small", undefined, locale === "zh" ? `${membership.expiresAt} 到期` : `expires ${membership.expiresAt}`));
        list.append(item);
      }
      card.append(list);
    } else {
      card.append(element("p", "course-muted", locale === "zh" ? "暂无会员卡" : "No membership card"));
    }
    host.append(card);
    recordOffs.push(
      pling.record(card, {
        id: student.id,
        label: student.name,
        data: {
          name: student.name,
          phone: student.phoneMasked,
          cards: student.cards.map((membership) => ({ name: membership.name, remaining: membership.remaining })),
        },
      }),
    );
  }
}

function renderTeachers(): void {
  const host = document.querySelector("#teacher-list")!;
  host.replaceChildren();
  for (const teacher of service.teachers) {
    const row = element("div", "course-teacher");
    const avatar = element("span", "course-avatar course-avatar--soft", teacher.name.slice(0, 1));
    const info = element("div");
    info.append(element("strong", undefined, teacher.name), element("span", "course-muted", `${teacher.subject} · ${teacher.phone}`));
    row.append(avatar, info);
    host.append(row);
  }
}

function dateLabel(date: string): string {
  return date.slice(5).replace("-", locale === "zh" ? " 月 " : "/") + (locale === "zh" ? " 日" : "");
}

function renderSchedule(): void {
  const host = document.querySelector("#schedule-list")!;
  host.replaceChildren();
  const sorted = [...service.lessons].sort((left, right) => `${left.date}${left.time}`.localeCompare(`${right.date}${right.time}`));
  if (!sorted.length) {
    host.append(element("p", "course-empty", copy.noSchedule));
  }
  for (const lesson of sorted) {
    const student = service.students.find((item) => item.id === lesson.studentId);
    const teacher = service.teachers.find((item) => item.id === lesson.teacherId);
    const row = element("div", "course-lesson");
    const when = element("div", "course-lesson__when");
    when.append(element("strong", undefined, lesson.time), element("span", undefined, dateLabel(lesson.date)));
    const what = element("div", "course-lesson__what");
    what.append(element("strong", undefined, lesson.course));
    what.append(element("span", "course-muted", `${student?.name ?? "—"} · ${teacher?.name ?? "—"}`));
    if (lesson.note) what.append(element("span", "course-lesson__note", lesson.note));
    const tools = element("div", "course-lesson__tools");
    tools.append(element("span", "course-pill course-pill--soft course-lesson__subject", teacher?.subject ?? "—"));
    const noteButton = element("button", "course-lesson__note-button", copy.noteAction);
    noteButton.type = "button";
    noteButton.addEventListener("click", () => {
      const launch = taskRuntime?.openLessonNote(lesson);
      if (!launch) return;
      dock?.open();
      taskCard?.open(launch.taskId, launch.values, launch.binding);
    });
    tools.append(noteButton);
    row.append(when, what, tools);
    host.append(row);
    recordOffs.push(
      pling.record(row, {
        id: lesson.id,
        label: `${lesson.course} · ${lesson.date} ${lesson.time}`,
        data: {
          course: lesson.course,
          date: lesson.date,
          time: lesson.time,
          student: student?.name,
          teacher: teacher?.name,
          note: lesson.note,
        },
      }),
    );
  }
  document.querySelector("#schedule-count")!.textContent = fill(copy.lessonCount, { count: service.lessons.length });
}

const activityLabels: Record<Activity["kind"], string> = {
  cards: locale === "zh" ? "会员卡" : "Cards",
  teacher: locale === "zh" ? "老师" : "Teacher",
  course: locale === "zh" ? "课程" : "Course",
  lesson: locale === "zh" ? "排课" : "Lesson",
  note: locale === "zh" ? "备注" : "Note",
  blocked: locale === "zh" ? "已拦截" : "Blocked",
};

function renderActivity(): void {
  const host = document.querySelector("#activity-list")!;
  host.replaceChildren();
  if (!service.activity.length) {
    host.append(element("li", "course-empty", copy.emptyActivity));
    return;
  }
  for (const item of service.activity.slice(0, 8)) {
    const row = element("li", "course-activity__item");
    row.dataset.kind = item.kind;
    row.append(element("span", "course-activity__kind", activityLabels[item.kind]));
    const body = element("div");
    body.append(element("strong", undefined, item.title), element("p", undefined, item.detail));
    row.append(body);
    host.append(row);
  }
}

function renderStats(): void {
  document.querySelector("#stat-courses")!.textContent = String(service.courses.length);
  document.querySelector("#stat-scheduled")!.textContent = String(service.lessons.length);
  document.querySelector("#stat-drafts")!.textContent = String(service.courses.filter((course) => course.status === "draft").length);
  document.querySelector("#student-count")!.textContent = locale === "zh" ? `${service.students.length} 位学员` : `${service.students.length} students`;
  document.querySelector("#teacher-count")!.textContent = locale === "zh" ? `${service.teachers.length} 位老师` : `${service.teachers.length} teachers`;
}

function render(): void {
  for (const off of recordOffs) off();
  recordOffs = [];
  renderCourses();
  renderStudents();
  renderTeachers();
  renderSchedule();
  renderActivity();
  renderStats();
}

render();

window.setTimeout(() => {
  dock?.open();
  openTaskInChat("course.create");
}, 60);
