import {
  AgentDock,
  React,
  usePling,
  usePlingRecord,
  usePlingScope,
  usePlingState,
} from "./react19-runtime";
import { createCourseService, type Activity, type CourseService, type Lesson, type Student } from "../../../shared/course-workspace/course-service";
import { COPY, fill, type Locale } from "../../../shared/course-workspace/copy";
import { getWorkspacePresentation } from "../../../shared/course-workspace/presentation";
import {
  courseQuickPrompts,
  createCourseTaskView,
  createCourseTaskRuntime,
  describeCourseState,
  registerCourseActions,
  type CourseTaskRuntime,
} from "../../../shared/course-workspace/runtime";
import { createCourseForm } from "../../../shared/course-workspace/course-form";
import { createTaskCard, type GuidedTaskPanel } from "@plingjs/vanilla";
import type { AgentDockHandle } from "@plingjs/react";

function StudentRow({ student, duplicate, locale }: { student: Student; duplicate: boolean; locale: Locale }) {
  const zh = locale === "zh";
  const recordRef = usePlingRecord({
    data: { name: student.name, phone: student.phoneMasked, cards: student.cards },
    label: student.name,
  });
  return (
    <article ref={recordRef} className="course-student" data-student-id={student.id}>
      <div className="course-student__top">
        <div>
          <strong>{student.name}</strong>
          <span className="course-muted">{student.phoneMasked}</span>
          {duplicate ? <span className="course-duplicate">{zh ? "重名" : "Duplicate name"}</span> : null}
        </div>
        <span className="course-pill">{zh ? `${student.cards.length} 张卡` : `${student.cards.length} cards`}</span>
      </div>
      {student.cards.length ? (
        <ul className="course-card-list">
          {student.cards.map((card) => (
            <li key={card.id}>
              <span>{card.name}</span>
              <strong>{zh ? `剩 ${card.remaining} 次` : `${card.remaining} left`}</strong>
              <small>{zh ? `${card.expiresAt} 到期` : `expires ${card.expiresAt}`}</small>
            </li>
          ))}
        </ul>
      ) : <p className="course-muted">{zh ? "暂无会员卡" : "No membership card"}</p>}
    </article>
  );
}

function LessonRow({ lesson, service, locale, onNote }: { lesson: Lesson; service: CourseService; locale: Locale; onNote: () => void }) {
  const zh = locale === "zh";
  const student = service.students.find((item) => item.id === lesson.studentId)?.name ?? "—";
  const teacher = service.teachers.find((item) => item.id === lesson.teacherId);
  const recordRef = usePlingRecord({
    data: { course: lesson.course, date: lesson.date, time: lesson.time, student, teacher: teacher?.name, note: lesson.note },
    label: `${lesson.course} · ${lesson.date} ${lesson.time}`,
  });
  const dateLabel = lesson.date.slice(5).replace("-", zh ? " 月 " : "/") + (zh ? " 日" : "");
  return (
    <div ref={recordRef} className="course-lesson">
      <div className="course-lesson__when"><strong>{lesson.time}</strong><span>{dateLabel}</span></div>
      <div className="course-lesson__what">
        <strong>{lesson.course}</strong>
        <span className="course-muted">{student} · {teacher?.name ?? "—"}</span>
        {lesson.note ? <span className="course-lesson__note">{lesson.note}</span> : null}
      </div>
      <div className="course-lesson__tools">
        <span className="course-pill course-pill--soft course-lesson__subject">{teacher?.subject ?? "—"}</span>
        <button type="button" className="course-lesson__note-button" onClick={onNote}>{COPY[locale].noteAction}</button>
      </div>
    </div>
  );
}

export function App({ locale }: { locale: Locale }) {
  const zh = locale === "zh";
  const chrome = getWorkspacePresentation(locale);
  const pling = usePling();
  const [revision, setRevision] = React.useState(0);
  const taskRuntime: { current: CourseTaskRuntime | null } = React.useRef(null);
  const taskCard = React.useRef<GuidedTaskPanel | null>(null);
  const taskView = React.useRef<ReturnType<typeof createCourseTaskView> | null>(null);
  const taskHost = React.useRef<HTMLDivElement | null>(null);
  const dock = React.useRef<AgentDockHandle | null>(null);
  const service: CourseService = React.useMemo(() => createCourseService(locale, () => {
    setRevision((value: number) => value + 1);
    taskRuntime.current?.refresh();
    taskCard.current?.refresh();
  }, getWorkspacePresentation(locale).courses), [locale]);
  const courseForm = React.useMemo(
    () => createCourseForm({ locale, teachers: service.teachers }),
    [locale, service],
  );

  usePlingState("course", () => describeCourseState(service), {
    description: zh ? "当前学员、老师与排课状态" : "Current students, teachers, and lessons",
  });

  React.useEffect(() => {
    document.body.append(courseForm.element);
    const offActions = registerCourseActions(pling, service, locale);
    taskRuntime.current = createCourseTaskRuntime({
      registry: pling.registry,
      ask: (prompt: string) => pling.ask(prompt),
      catalog: pling.task,
      service,
      locale,
      form: courseForm,
      onComplete: () => {
        setRevision((value: number) => value + 1);
        taskCard.current?.refresh();
      },
    });
    taskCard.current = createTaskCard(taskRuntime.current.controller, {
      locale: locale === "zh" ? "zh-CN" : "en-US",
      title: COPY[locale].taskPanelTitle,
      onPrompt: (prompt: string) => void pling.ask(prompt),
    });
    taskView.current = createCourseTaskView(taskCard.current, taskRuntime.current);
    taskHost.current?.replaceChildren(taskView.current.element);
    courseForm.setHandlers({
      onSave: () => taskRuntime.current?.guide?.requestSave(),
      onClose: () => taskRuntime.current?.guide?.refresh(),
    });
    const timer = window.setTimeout(() => {
      dock.current?.open();
      openTaskInChat("course.create");
    }, 0);
    return () => {
      window.clearTimeout(timer);
      for (const off of offActions) off();
      taskRuntime.current?.destroy();
      taskView.current?.destroy();
      taskCard.current?.destroy();
      courseForm.destroy();
      courseForm.element.remove();
      taskRuntime.current = null;
      taskView.current = null;
      taskCard.current = null;
    };
  }, [pling, service, locale, courseForm]);

  void revision;
  const copy = COPY[locale];
  const nameCounts = new Map<string, number>();
  for (const student of service.students) nameCounts.set(student.name, (nameCounts.get(student.name) ?? 0) + 1);
  const lessons = [...service.lessons].sort((left, right) => `${left.date}${left.time}`.localeCompare(`${right.date}${right.time}`));
  const studentsScope = usePlingScope({ id: "students", label: zh ? "学员" : "Students", description: zh ? "学员、会员卡与剩余次数" : "Students, membership cards, and remaining classes", role: "main" });
  const teachersScope = usePlingScope({ id: "teachers", label: zh ? "老师" : "Teachers", description: zh ? "可排课的老师及其科目" : "Teachers available for scheduling and their subjects", role: "main" });
  const scheduleScope = usePlingScope({ id: "schedule", label: zh ? "排课" : "Schedule", description: zh ? "接下来已安排的课程" : "Upcoming scheduled lessons", role: "main" });

  const openTaskInChat = (taskId: string): void => {
    const launch = taskRuntime.current?.openTask(taskId);
    dock.current?.open();
    if (!launch) return;
    taskCard.current?.open(launch.taskId, launch.values, launch.binding);
  };
  const openLessonNote = (lesson: Lesson): void => {
    const launch = taskRuntime.current?.openLessonNote(lesson);
    dock.current?.open();
    if (!launch) return;
    taskCard.current?.open(launch.taskId, launch.values, launch.binding);
  };
  const activityLabels: Record<Activity["kind"], string> = {
    cards: zh ? "会员卡" : "Cards",
    teacher: zh ? "老师" : "Teacher",
    course: zh ? "课程" : "Course",
    lesson: zh ? "排课" : "Lesson",
    note: zh ? "备注" : "Note",
    blocked: zh ? "已拦截" : "Blocked",
  };

  return (
    <main className="course-app">
      <aside className="course-sidebar">
        <div className="course-brand">
          <span className="course-brand__mark" aria-hidden="true">{chrome.storeInitial}</span>
          <span>{chrome.brand}</span>
        </div>

        <nav className="course-nav" aria-label="Main navigation">
          {chrome.nav.map((group) => [
            <p key={`group-${group.label}`} className="course-nav-group">{group.label}</p>,
            ...group.items.map((item) => (
                <a
                  key={item.label}
                  className={`course-nav-item${item.active ? " is-active" : ""}`}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                >
                  <span className="course-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </a>
            )),
          ])}
        </nav>

        <div className="course-sidebar-foot">
          <span className="course-store-avatar">{chrome.storeInitial}</span>
          <div><strong>{chrome.store}</strong><span>{chrome.location}</span></div>
        </div>
      </aside>

      <section className="course-main">
        <header className="course-topbar">
          <div className="course-breadcrumb">
            {chrome.breadcrumb.map((part, index) => index < chrome.breadcrumb.length - 1
              ? [<span key={`part-${index}`}>{part}</span>, <span key={`sep-${index}`}>/</span>]
              : <strong key={`part-${index}`}>{part}</strong>)}
          </div>
          <div className="course-top-actions">
            <div className="course-user">
              <span className="course-user-avatar">{chrome.userInitial}</span>
              <span>{chrome.userName}</span>
            </div>
            <div className="course-lang" aria-label="Language">
              <a href="?lang=en" className={zh ? "" : "is-active"}>EN</a>
              <a href="?lang=zh" className={zh ? "is-active" : ""}>中文</a>
            </div>
          </div>
        </header>

        <main className="course-page">
          <div className="course-page-head" id="overview">
            <div>
              <p className="course-eyebrow">{chrome.page.eyebrow}</p>
              <h1>{chrome.page.title}</h1>
              <p className="course-lead">{chrome.page.lead}</p>
            </div>
            <button className="course-primary-button" type="button" onClick={() => openTaskInChat("course.create")}>
              <span aria-hidden="true">＋</span>
              <span>{chrome.page.action}</span>
            </button>
          </div>

          <div className="course-stat-row" aria-label="Course summary">
            <div className="course-stat"><strong>{service.courses.length}</strong><span>{chrome.stats.courses}</span></div>
            <div className="course-stat"><strong>{lessons.length}</strong><span>{chrome.stats.scheduled}</span></div>
            <div className="course-stat"><strong>{service.courses.filter((course) => course.status === "draft").length}</strong><span>{chrome.stats.drafts}</span></div>
          </div>

          <section className="course-grid" aria-label="Course catalogue">
            {service.courses.map((course) => (
              <article key={course.id} className="course-tile" data-course-id={course.id}>
                <div className={`course-cover course-cover--${course.cover}`}>{course.coverLabel}</div>
                <div className="course-tile__body">
                  <div className="course-tile__top">
                    <h2>{course.name}</h2>
                    <span className={`course-status${course.status === "draft" ? " course-status--draft" : ""}`}>{course.statusLabel}</span>
                  </div>
                  <p>{course.teacher} · {course.cards}</p>
                  <div className="course-meta">
                    <span>★ {course.rating}</span>
                    <span>{chrome.courseMeta.deduction} {course.deduct}</span>
                    <span>¥{course.price}{chrome.courseMeta.perLesson}</span>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section ref={scheduleScope} className="course-section" id="schedule-panel">
            <header className="course-section__head">
              <div>
                <p className="course-eyebrow">{chrome.sections.scheduleEyebrow}</p>
                <h2>{chrome.sections.scheduleTitle}</h2>
                <p className="course-section__lead">{chrome.sections.scheduleLead}</p>
              </div>
              <span className="course-pill">{fill(copy.lessonCount, { count: lessons.length })}</span>
            </header>
            <div id="schedule-list" className="course-schedule-list">
              {lessons.length === 0 ? <p className="course-empty">{copy.noSchedule}</p> : null}
              {lessons.map((lesson) => (
                <LessonRow key={lesson.id} lesson={lesson} service={service} locale={locale} onNote={() => openLessonNote(lesson)} />
              ))}
            </div>
          </section>

          <div className="course-panels">
            <section ref={studentsScope} className="course-panel" id="students-panel">
              <header className="course-panel__head">
                <div><p className="course-eyebrow">{chrome.sections.studentsEyebrow}</p><h2>{chrome.sections.studentsTitle}</h2></div>
                <span className="course-pill">{zh ? `${service.students.length} 位学员` : `${service.students.length} students`}</span>
              </header>
              <div className="course-panel__body">
                <div id="student-list" className="course-student-list">
                  {service.students.map((student: Student) => <StudentRow key={student.id} student={student} duplicate={(nameCounts.get(student.name) ?? 0) > 1} locale={locale} />)}
                </div>
              </div>
            </section>

            <section ref={teachersScope} className="course-panel" id="teachers-panel">
              <header className="course-panel__head">
                <div><p className="course-eyebrow">{chrome.sections.teachersEyebrow}</p><h2>{chrome.sections.teachersTitle}</h2></div>
                <span className="course-pill">{zh ? `${service.teachers.length} 位老师` : `${service.teachers.length} teachers`}</span>
              </header>
              <div className="course-panel__body">
                <div id="teacher-list" className="course-teacher-list">
                  {service.teachers.map((teacher: CourseService["teachers"][number]) => (
                    <div key={teacher.id} className="course-teacher"><span className="course-avatar course-avatar--soft">{teacher.name.slice(0, 1)}</span><div><strong>{teacher.name}</strong><span className="course-muted">{teacher.subject} · {teacher.phone}</span></div></div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <section className="course-section" id="activity-panel">
            <header className="course-section__head">
              <div><p className="course-eyebrow">{chrome.sections.activityEyebrow}</p><h2>{chrome.sections.activityTitle}</h2></div>
            </header>
            <ol id="activity-list" className="course-activity">
              {service.activity.length === 0 ? <li className="course-empty">{copy.emptyActivity}</li> : null}
              {service.activity.slice(0, 8).map((item: Activity) => (
                <li key={item.id} className="course-activity__item" data-kind={item.kind}><span className="course-activity__kind">{activityLabels[item.kind]}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div></li>
              ))}
            </ol>
          </section>
        </main>
      </section>

      <aside className="course-dock" aria-label="Pling assistant">
        <AgentDock
          ref={dock}
          title={zh ? "页灵助手" : "Pling assistant"}
          placeholder={zh ? "告诉助手你要做什么，或继续当前任务…" : "Tell the assistant what to do, or continue this task…"}
          quick={courseQuickPrompts(locale)}
          debug={{ maxCalls: 8 }}
          layout="sidebar"
          sidebarMode="fused"
          defaultOpen
          task={<div ref={taskHost} className="course-task-slot" />}
        />
      </aside>
    </main>
  );
}
