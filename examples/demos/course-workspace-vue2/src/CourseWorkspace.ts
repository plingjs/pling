import { Vue, computed, onBeforeUnmount, onMounted, ref } from "./vue2-runtime";
import { createTaskCard, type GuidedTaskPanel, type VanillaDock } from "@plingjs/vanilla";
import { createCourseService, type Activity, type CourseService } from "../../../shared/course-workspace/course-service";
import { COPY, fill, type Locale } from "../../../shared/course-workspace/copy";
import { getWorkspacePresentation, type WorkspacePresentation } from "../../../shared/course-workspace/presentation";
import {
  courseQuickPrompts,
  createCourseTaskView,
  createCourseTaskRuntime,
  decorateCourseDock,
  describeCourseState,
  registerCourseActions,
  type CourseTaskRuntime,
} from "../../../shared/course-workspace/runtime";
import { createCourseForm } from "../../../shared/course-workspace/course-form";

function renderNav(h: any, chrome: WorkspacePresentation): any[] {
  const nodes: any[] = [];
  for (const group of chrome.nav) {
    nodes.push(h("p", { key: `group-${group.label}`, class: "course-nav-group" }, group.label));
    for (const item of group.items) {
      nodes.push(h("a", {
        key: item.label,
        class: `course-nav-item${item.active ? " is-active" : ""}`,
        attrs: { href: item.href, "aria-current": item.active ? "page" : undefined },
      }, [
        h("span", { class: "course-nav-icon", attrs: { "aria-hidden": "true" } }, item.icon),
        h("span", null, item.label),
      ]));
    }
  }
  return nodes;
}

function renderCourses(h: any, service: CourseService, chrome: WorkspacePresentation): any[] {
  return service.courses.map((course) => h("article", {
    key: course.id,
    class: "course-tile",
    attrs: { "data-course-id": course.id },
  }, [
    h("div", { class: ["course-cover", `course-cover--${course.cover}`] }, course.coverLabel),
    h("div", { class: "course-tile__body" }, [
      h("div", { class: "course-tile__top" }, [
        h("h2", null, course.name),
        h("span", { class: ["course-status", course.status === "draft" ? "course-status--draft" : ""] }, course.statusLabel),
      ]),
      h("p", null, `${course.teacher} · ${course.cards}`),
      h("div", { class: "course-meta" }, [
        h("span", null, `★ ${course.rating}`),
        h("span", null, `${chrome.courseMeta.deduction} ${course.deduct}`),
        h("span", null, `¥${course.price}${chrome.courseMeta.perLesson}`),
      ]),
    ]),
  ]));
}

function renderStudents(h: any, service: CourseService, chrome: WorkspacePresentation, zh: boolean): any {
  const counts = new Map<string, number>();
  for (const student of service.students) counts.set(student.name, (counts.get(student.name) ?? 0) + 1);

  return h("article", {
    attrs: { id: "students-panel" },
    class: "course-panel",
    directives: [{ name: "scope", value: { id: "students", label: zh ? "学员" : "Students", description: zh ? "学员、会员卡与剩余次数" : "Students, membership cards, and remaining classes", role: "main" } }],
  }, [
    h("header", { class: "course-panel__head" }, [
      h("div", null, [h("p", { class: "course-eyebrow" }, chrome.sections.studentsEyebrow), h("h2", null, chrome.sections.studentsTitle)]),
      h("span", { class: "course-pill" }, zh ? `${service.students.length} 位学员` : `${service.students.length} students`),
    ]),
    h("div", { class: "course-panel__body" }, [
      h("div", { attrs: { id: "student-list" }, class: "course-student-list" }, service.students.map((student) => h("article", {
        key: student.id,
        class: "course-student",
        attrs: { "data-student-id": student.id },
        directives: [{ name: "record", value: { id: student.id, label: student.name, data: { name: student.name, phone: student.phoneMasked, cards: student.cards } } }],
      }, [
        h("div", { class: "course-student__top" }, [
          h("div", null, [
            h("strong", null, student.name),
            h("span", { class: "course-muted" }, student.phoneMasked),
            (counts.get(student.name) ?? 0) > 1 ? h("span", { class: "course-duplicate" }, zh ? "重名" : "Duplicate name") : null,
          ]),
          h("span", { class: "course-pill" }, zh ? `${student.cards.length} 张卡` : `${student.cards.length} cards`),
        ]),
        student.cards.length
          ? h("ul", { class: "course-card-list" }, student.cards.map((card) => h("li", { key: card.id }, [
              h("span", null, card.name),
              h("strong", null, zh ? `剩 ${card.remaining} 次` : `${card.remaining} left`),
              h("small", null, zh ? `${card.expiresAt} 到期` : `expires ${card.expiresAt}`),
            ])))
          : h("p", { class: "course-muted" }, zh ? "暂无会员卡" : "No membership card"),
      ]))),
    ]),
  ]);
}

function renderTeachers(h: any, service: CourseService, chrome: WorkspacePresentation, zh: boolean): any {
  return h("article", {
    attrs: { id: "teachers-panel" },
    class: "course-panel",
    directives: [{ name: "scope", value: { id: "teachers", label: zh ? "老师" : "Teachers", description: zh ? "可排课的老师及其科目" : "Teachers available for scheduling and their subjects", role: "main" } }],
  }, [
    h("header", { class: "course-panel__head" }, [
      h("div", null, [h("p", { class: "course-eyebrow" }, chrome.sections.teachersEyebrow), h("h2", null, chrome.sections.teachersTitle)]),
      h("span", { class: "course-pill" }, zh ? `${service.teachers.length} 位老师` : `${service.teachers.length} teachers`),
    ]),
    h("div", { class: "course-panel__body" }, [
      h("div", { attrs: { id: "teacher-list" }, class: "course-teacher-list" }, service.teachers.map((teacher) => h("div", { key: teacher.id, class: "course-teacher" }, [
        h("span", { class: "course-avatar course-avatar--soft" }, teacher.name.slice(0, 1)),
        h("div", null, [h("strong", null, teacher.name), h("span", { class: "course-muted" }, `${teacher.subject} · ${teacher.phone}`)]),
      ]))),
    ]),
  ]);
}

export function mountCourseWorkspace(pling: any, root: HTMLElement, locale: Locale): () => void {
  const mountNode = document.createElement("div");
  root.replaceChildren(mountNode);
  const chrome = getWorkspacePresentation(locale);

  const vm = new Vue({
    setup() {
      const copy = computed(() => COPY[locale]);
      const version = ref(0);
      let taskRuntime: CourseTaskRuntime | null = null;
      let offActions: Array<() => void> = [];
      let offState: (() => void) | null = null;
      let dock: VanillaDock | null = null;
      let taskCard: GuidedTaskPanel | null = null;
      let taskView: ReturnType<typeof createCourseTaskView> | null = null;

      const service = createCourseService(locale, () => {
        version.value += 1;
        taskRuntime?.refresh();
        taskCard?.refresh();
      }, chrome.courses);
      const courseForm = createCourseForm({ locale, teachers: service.teachers });

      const zh = locale === "zh";
      const activityLabels: Record<Activity["kind"], string> = {
        cards: zh ? "会员卡" : "Cards",
        teacher: zh ? "老师" : "Teacher",
        course: zh ? "课程" : "Course",
        lesson: zh ? "排课" : "Lesson",
        note: zh ? "备注" : "Note",
        blocked: zh ? "已拦截" : "Blocked",
      };

      const dateLabel = (date: string): string => date.slice(5).replace("-", zh ? " 月 " : "/") + (zh ? " 日" : "");
      const studentName = (id: string): string => service.students.find((student) => student.id === id)?.name ?? "—";
      const teacherName = (id: string): string => service.teachers.find((teacher) => teacher.id === id)?.name ?? "—";
      const teacherSubject = (id: string): string => service.teachers.find((teacher) => teacher.id === id)?.subject ?? "—";

      const openTaskInChat = (taskId: string): void => {
        const launch = taskRuntime?.openTask(taskId);
        dock?.open();
        if (!launch) return;
        taskCard?.open(launch.taskId, launch.values, launch.binding);
      };

      const openLessonNote = (lesson: ReturnType<typeof createCourseService>["lessons"][number]): void => {
        const launch = taskRuntime?.openLessonNote(lesson);
        dock?.open();
        if (!launch) return;
        taskCard?.open(launch.taskId, launch.values, launch.binding);
      };

      onMounted(() => {
        document.body.append(courseForm.element);
        void Vue.nextTick(() => {
          offActions = registerCourseActions(pling, service, locale);
          offState = pling.state(
            "course",
            () => describeCourseState(service),
            { description: zh ? "当前学员、老师与排课状态" : "Current students, teachers, and lessons" },
          );
          taskRuntime = createCourseTaskRuntime({
            registry: pling.registry,
            ask: (prompt) => pling.ask(prompt),
            catalog: pling.task,
            service,
            locale,
            form: courseForm,
            onComplete: () => { version.value += 1; },
          });
          taskCard = createTaskCard(taskRuntime.controller, {
            locale: zh ? "zh-CN" : "en-US",
            title: copy.value.taskPanelTitle,
            onPrompt: (prompt) => void pling.ask(prompt),
          });
          taskView = createCourseTaskView(taskCard, taskRuntime);
          courseForm.setHandlers({
            onSave: () => taskRuntime?.guide?.requestSave(),
            onClose: () => taskRuntime?.guide?.refresh(),
          });
          const mount = root.querySelector<HTMLElement>("#dock-mount");
          if (!mount) return;
          dock = pling.dock({
            title: zh ? "页灵助手" : "Pling assistant",
            placeholder: zh ? "告诉助手你要做什么，或继续当前任务…" : "Tell the assistant what to do, or continue this task…",
            quick: courseQuickPrompts(locale),
            debug: { maxCalls: 8 },
            modelSettings: "readonly",
            task: taskView.element,
            mount,
            layout: "sidebar",
            sidebarMode: "fused",
            defaultOpen: true,
          });
          dock?.open();
          openTaskInChat("course.create");
          decorateCourseDock(locale, {
            runtime: taskRuntime ?? undefined,
            onOpenDock: () => dock?.open(),
            onOpenTask: openTaskInChat,
            onReset: () => taskRuntime?.guide?.reset(),
          });
        });
      });

      onBeforeUnmount(() => {
        offState?.();
        for (const off of offActions) off();
        taskRuntime?.destroy();
        taskView?.destroy();
        taskCard?.destroy();
        courseForm.destroy();
        courseForm.element.remove();
        dock?.destroy();
      });

      return {
        copy,
        version,
        service,
        chrome,
        activityLabels,
        dateLabel,
        studentName,
        teacherName,
        teacherSubject,
        openTaskInChat,
        openLessonNote,
      };
    },
    render(this: {
      copy: { lessonCount: string; noSchedule: string; emptyActivity: string; noteAction: string };
      version: number;
      service: CourseService;
      chrome: WorkspacePresentation;
      activityLabels: Record<Activity["kind"], string>;
      dateLabel: (date: string) => string;
      studentName: (id: string) => string;
      teacherName: (id: string) => string;
      teacherSubject: (id: string) => string;
      openTaskInChat: (taskId: string) => void;
      openLessonNote: (lesson: CourseService["lessons"][number]) => void;
    }, h: any): any {
      void this.version;
      const zh = locale === "zh";
      const service = this.service;
      const sortedLessons = [...service.lessons].sort((left, right) => `${left.date}${left.time}`.localeCompare(`${right.date}${right.time}`));

      const schedule = h("section", {
        attrs: { id: "schedule-panel" },
        class: "course-section",
        directives: [{ name: "scope", value: { id: "schedule", label: zh ? "排课" : "Schedule", description: zh ? "接下来已安排的课程" : "Upcoming scheduled lessons", role: "main" } }],
      }, [
        h("header", { class: "course-section__head" }, [
          h("div", null, [
            h("p", { class: "course-eyebrow" }, this.chrome.sections.scheduleEyebrow),
            h("h2", null, this.chrome.sections.scheduleTitle),
            h("p", { class: "course-section__lead" }, this.chrome.sections.scheduleLead),
          ]),
          h("span", { class: "course-pill" }, fill(this.copy.lessonCount, { count: sortedLessons.length })),
        ]),
        h("div", { attrs: { id: "schedule-list" }, class: "course-schedule-list" }, [
          sortedLessons.length === 0 ? h("p", { class: "course-empty" }, this.copy.noSchedule) : null,
          ...sortedLessons.map((lesson) => h("div", {
            key: lesson.id,
            class: "course-lesson",
            directives: [{ name: "record", value: { id: lesson.id, label: `${lesson.course} · ${lesson.date} ${lesson.time}`, data: { course: lesson.course, date: lesson.date, time: lesson.time, student: this.studentName(lesson.studentId), teacher: this.teacherName(lesson.teacherId), note: lesson.note } } }],
          }, [
            h("div", { class: "course-lesson__when" }, [h("strong", null, lesson.time), h("span", null, this.dateLabel(lesson.date))]),
            h("div", { class: "course-lesson__what" }, [
              h("strong", null, lesson.course),
              h("span", { class: "course-muted" }, `${this.studentName(lesson.studentId)} · ${this.teacherName(lesson.teacherId)}`),
              lesson.note ? h("span", { class: "course-lesson__note" }, lesson.note) : null,
            ]),
            h("div", { class: "course-lesson__tools" }, [
              h("span", { class: "course-pill course-pill--soft course-lesson__subject" }, this.teacherSubject(lesson.teacherId)),
              h("button", { attrs: { type: "button" }, class: "course-lesson__note-button", on: { click: () => this.openLessonNote(lesson) } }, this.copy.noteAction),
            ]),
          ])),
        ]),
      ]);

      const activity = h("section", { attrs: { id: "activity-panel" }, class: "course-section" }, [
        h("header", { class: "course-section__head" }, [h("div", null, [
          h("p", { class: "course-eyebrow" }, this.chrome.sections.activityEyebrow),
          h("h2", null, this.chrome.sections.activityTitle),
        ])]),
        h("ol", { attrs: { id: "activity-list" }, class: "course-activity" }, [
          service.activity.length === 0 ? h("li", { class: "course-empty" }, this.copy.emptyActivity) : null,
          ...service.activity.slice(0, 8).map((item) => h("li", { key: item.id, class: "course-activity__item", attrs: { "data-kind": item.kind } }, [
            h("span", { class: "course-activity__kind" }, this.activityLabels[item.kind]),
            h("div", null, [h("strong", null, item.title), h("p", null, item.detail)]),
          ])),
        ]),
      ]);

      return h("div", { class: "course-app" }, [
        h("aside", { class: "course-sidebar" }, [
          h("div", { class: "course-brand" }, [
            h("span", { class: "course-brand__mark", attrs: { "aria-hidden": "true" } }, this.chrome.storeInitial),
            h("span", null, this.chrome.brand),
          ]),
          h("nav", { class: "course-nav", attrs: { "aria-label": "Main navigation" } }, renderNav(h, this.chrome)),
          h("div", { class: "course-sidebar-foot" }, [
            h("span", { class: "course-store-avatar" }, this.chrome.storeInitial),
            h("div", null, [h("strong", null, this.chrome.store), h("span", null, this.chrome.location)]),
          ]),
        ]),

        h("section", { class: "course-main" }, [
          h("header", { class: "course-topbar" }, [
            h("div", { class: "course-breadcrumb" }, this.chrome.breadcrumb.flatMap((part, index) => {
              const last = index === this.chrome.breadcrumb.length - 1;
              const node = last ? h("strong", { key: `part-${index}` }, part) : h("span", { key: `part-${index}` }, part);
              return last ? [node] : [node, h("span", { key: `sep-${index}` }, "/")];
            })),
            h("div", { class: "course-top-actions" }, [
              h("div", { class: "course-user" }, [
                h("span", { class: "course-user-avatar" }, this.chrome.userInitial),
                h("span", null, this.chrome.userName),
              ]),
              h("div", { class: "course-lang", attrs: { "aria-label": "Language" } }, [
                h("a", { attrs: { href: "?lang=en" }, class: zh ? "" : "is-active" }, "EN"),
                h("a", { attrs: { href: "?lang=zh" }, class: zh ? "is-active" : "" }, "中文"),
              ]),
            ]),
          ]),

          h("main", { class: "course-page" }, [
            h("div", { attrs: { id: "overview" }, class: "course-page-head" }, [
              h("div", null, [
                h("p", { class: "course-eyebrow" }, this.chrome.page.eyebrow),
                h("h1", null, this.chrome.page.title),
                h("p", { class: "course-lead" }, this.chrome.page.lead),
              ]),
              h("button", { attrs: { type: "button" }, class: "course-primary-button", on: { click: () => this.openTaskInChat("course.create") } }, [
                h("span", { attrs: { "aria-hidden": "true" } }, "＋"),
                h("span", null, this.chrome.page.action),
              ]),
            ]),

            h("div", { class: "course-stat-row", attrs: { "aria-label": "Course summary" } }, [
              h("div", { class: "course-stat" }, [h("strong", null, String(service.courses.length)), h("span", null, this.chrome.stats.courses)]),
              h("div", { class: "course-stat" }, [h("strong", null, String(service.lessons.length)), h("span", null, this.chrome.stats.scheduled)]),
              h("div", { class: "course-stat" }, [h("strong", null, String(service.courses.filter((course) => course.status === "draft").length)), h("span", null, this.chrome.stats.drafts)]),
            ]),

            h("section", { class: "course-grid", attrs: { "aria-label": "Course catalogue" } }, renderCourses(h, service, this.chrome)),
            schedule,
            h("div", { class: "course-panels" }, [
              renderStudents(h, service, this.chrome, zh),
              renderTeachers(h, service, this.chrome, zh),
            ]),
            activity,
          ]),
        ]),

        h("aside", { class: "course-dock", attrs: { id: "dock-mount", "aria-label": "Pling assistant" } }),
      ]);
    },
  }).$mount(mountNode);

  return () => {
    vm.$destroy();
    root.replaceChildren();
  };
}
