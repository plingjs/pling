import * as React from "react";
import {
  AgentDock,
  PlingRecord,
  PlingScope,
  PlingState,
  type AgentDockHandle,
} from "@plingjs/react/legacy";
import { createTaskCard, type GuidedTaskPanel, type VanillaPling } from "@plingjs/vanilla";
import { createCourseService, type Activity, type CourseService } from "../../../shared/course-workspace/course-service";
import { COPY, fill, type Locale } from "../../../shared/course-workspace/copy";
import { getWorkspacePresentation, type DemoCourse, type WorkspacePresentation } from "../../../shared/course-workspace/presentation";
import {
  courseQuickPrompts,
  createCourseTaskView,
  createCourseTaskRuntime,
  decorateCourseDock,
  describeCourseState,
  registerCourseActions,
  type CourseTaskRuntime,
} from "../../../shared/course-workspace/runtime";
import { createCourseForm, type CourseFormController } from "../../../shared/course-workspace/course-form";

interface AppProps {
  locale: Locale;
  pling: VanillaPling;
}

interface AppState {
  revision: number;
}

export class App extends React.Component<AppProps, AppState> {
  private readonly service: CourseService;
  private readonly taskRuntime: CourseTaskRuntime;
  private readonly taskCard: GuidedTaskPanel;
  private readonly taskView: ReturnType<typeof createCourseTaskView>;
  private readonly taskHost: HTMLElement;
  private readonly courseForm: CourseFormController;
  private readonly offActions: Array<() => void>;
  private dock: AgentDockHandle | null = null;

  constructor(props: AppProps) {
    super(props);
    this.state = { revision: 0 };
    this.service = createCourseService(props.locale, () => {
      this.setState((state) => ({ revision: state.revision + 1 }));
      this.taskRuntime.refresh();
      this.taskCard.refresh();
    }, getWorkspacePresentation(props.locale).courses);
    this.courseForm = createCourseForm({ locale: props.locale, teachers: this.service.teachers });
    this.offActions = registerCourseActions(this.props.pling, this.service, this.props.locale);
    this.taskRuntime = createCourseTaskRuntime({
      registry: this.props.pling.registry,
      ask: (prompt) => this.props.pling.ask(prompt),
      catalog: this.props.pling.task,
      service: this.service,
      locale: this.props.locale,
      form: this.courseForm,
      onComplete: () => this.setState((state) => ({ revision: state.revision + 1 })),
    });
    const copy = COPY[this.props.locale];
    this.taskCard = createTaskCard(this.taskRuntime.controller, {
      locale: this.props.locale === "zh" ? "zh-CN" : "en-US",
      title: copy.taskPanelTitle,
      onPrompt: (prompt) => void this.props.pling.ask(prompt),
    });
    this.taskView = createCourseTaskView(this.taskCard, this.taskRuntime);
    this.taskHost = document.createElement("div");
    this.taskHost.className = "course-task-slot";
    this.taskHost.append(this.taskView.element);
    this.courseForm.setHandlers({
      onSave: () => this.taskRuntime.guide?.requestSave(),
      onClose: () => this.taskRuntime.guide?.refresh(),
    });
  }

  componentDidMount(): void {
    document.body.append(this.courseForm.element);
    window.setTimeout(() => {
      this.dock?.open();
      this.openTaskInChat("course.create");
      decorateCourseDock(this.props.locale, {
        runtime: this.taskRuntime,
        onOpenDock: () => this.dock?.open(),
        onOpenTask: (taskId) => this.openTaskInChat(taskId),
        onReset: () => this.taskRuntime.guide?.reset(),
      });
    }, 0);
  }

  componentWillUnmount(): void {
    for (const off of this.offActions) off();
    this.taskRuntime.destroy();
    this.taskView.destroy();
    this.taskCard.destroy();
    this.courseForm.destroy();
    this.courseForm.element.remove();
  }

  private readonly setDock = (handle: AgentDockHandle | null): void => {
    this.dock = handle;
  };

  private readonly courseState = (): Record<string, unknown> => describeCourseState(this.service);

  private dateLabel(date: string): string {
    return date.slice(5).replace("-", this.props.locale === "zh" ? " 月 " : "/") + (this.props.locale === "zh" ? " 日" : "");
  }

  private studentName(id: string): string {
    return this.service.students.find((student) => student.id === id)?.name ?? "—";
  }

  private teacherName(id: string): string {
    return this.service.teachers.find((teacher) => teacher.id === id)?.name ?? "—";
  }

  private teacherSubject(id: string): string {
    return this.service.teachers.find((teacher) => teacher.id === id)?.subject ?? "—";
  }

  private readonly openTaskInChat = (taskId: string): void => {
    const launch = this.taskRuntime.openTask(taskId);
    this.dock?.open();
    if (!launch) return;
    this.taskCard.open(launch.taskId, launch.values, launch.binding);
  };

  private readonly openLessonNote = (lesson: CourseService["lessons"][number]): void => {
    const launch = this.taskRuntime.openLessonNote(lesson);
    this.dock?.open();
    if (!launch) return;
    this.taskCard.open(launch.taskId, launch.values, launch.binding);
  };

  private statusLabel(kind: Activity["kind"]): string {
    const zh = this.props.locale === "zh";
    return kind === "cards" ? (zh ? "会员卡" : "Cards")
      : kind === "teacher" ? (zh ? "老师" : "Teacher")
      : kind === "course" ? (zh ? "课程" : "Course")
      : kind === "lesson" ? (zh ? "排课" : "Lesson")
      : kind === "note" ? (zh ? "备注" : "Note")
      : (zh ? "已拦截" : "Blocked");
  }

  private renderNav(chrome: WorkspacePresentation): React.ReactNode {
    return chrome.nav.map((group) => (
      <React.Fragment key={group.label}>
        <p className="course-nav-group">{group.label}</p>
        {group.items.map((item) => (
          <a
            key={item.label}
            className={`course-nav-item${item.active ? " is-active" : ""}`}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
          >
            <span className="course-nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </React.Fragment>
    ));
  }

  private renderCourses(chrome: WorkspacePresentation): React.ReactNode {
    return this.service.courses.map((course: DemoCourse) => (
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
    ));
  }

  private renderStudents(): React.ReactNode {
    const zh = this.props.locale === "zh";
    const chrome = getWorkspacePresentation(this.props.locale);
    const counts = new Map<string, number>();
    for (const student of this.service.students) counts.set(student.name, (counts.get(student.name) ?? 0) + 1);

    return (
      <PlingScope options={{ id: "students", label: zh ? "学员" : "Students", description: zh ? "学员、会员卡与剩余次数" : "Students, membership cards, and remaining classes", role: "main" }}>
        {(scopeRef) => (
          <article ref={scopeRef} id="students-panel" className="course-panel">
            <header className="course-panel__head">
              <div><p className="course-eyebrow">{chrome.sections.studentsEyebrow}</p><h3>{chrome.sections.studentsTitle}</h3></div>
              <span className="course-pill">{zh ? `${this.service.students.length} 位学员` : `${this.service.students.length} students`}</span>
            </header>
            <div className="course-panel__body">
              <div id="student-list" className="course-student-list">
                {this.service.students.map((student) => (
                  <PlingRecord key={student.id} value={{ id: student.id, label: student.name, data: { name: student.name, phone: student.phoneMasked, cards: student.cards } }}>
                    {(recordRef) => (
                      <article ref={recordRef} className="course-student" data-student-id={student.id}>
                        <div className="course-student__top">
                          <div>
                            <strong>{student.name}</strong>
                            <span className="course-muted">{student.phoneMasked}</span>
                            {(counts.get(student.name) ?? 0) > 1 ? <span className="course-duplicate">{zh ? "重名" : "Duplicate name"}</span> : null}
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
                    )}
                  </PlingRecord>
                ))}
              </div>
            </div>
          </article>
        )}
      </PlingScope>
    );
  }

  private renderTeachers(): React.ReactNode {
    const zh = this.props.locale === "zh";
    const chrome = getWorkspacePresentation(this.props.locale);

    return (
      <PlingScope options={{ id: "teachers", label: zh ? "老师" : "Teachers", description: zh ? "可排课的老师及其科目" : "Teachers available for scheduling and their subjects", role: "main" }}>
        {(scopeRef) => (
          <article ref={scopeRef} id="teachers-panel" className="course-panel">
            <header className="course-panel__head">
              <div><p className="course-eyebrow">{chrome.sections.teachersEyebrow}</p><h3>{chrome.sections.teachersTitle}</h3></div>
              <span className="course-pill">{zh ? `${this.service.teachers.length} 位老师` : `${this.service.teachers.length} teachers`}</span>
            </header>
            <div className="course-panel__body">
              <div id="teacher-list" className="course-teacher-list">
                {this.service.teachers.map((teacher) => (
                  <div key={teacher.id} className="course-teacher">
                    <span className="course-avatar course-avatar--soft">{teacher.name.slice(0, 1)}</span>
                    <div><strong>{teacher.name}</strong><span className="course-muted">{teacher.subject} · {teacher.phone}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </article>
        )}
      </PlingScope>
    );
  }

  private renderSchedule(): React.ReactNode {
    const zh = this.props.locale === "zh";
    const chrome = getWorkspacePresentation(this.props.locale);
    const copy = COPY[this.props.locale];
    const lessons = [...this.service.lessons].sort((left, right) => `${left.date}${left.time}`.localeCompare(`${right.date}${right.time}`));

    return (
      <PlingScope options={{ id: "schedule", label: zh ? "排课" : "Schedule", description: zh ? "接下来已安排的课程" : "Upcoming scheduled lessons", role: "main" }}>
        {(scopeRef) => (
          <section ref={scopeRef} id="schedule-panel" className="course-section">
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
                <PlingRecord key={lesson.id} value={{ id: lesson.id, label: `${lesson.course} · ${lesson.date} ${lesson.time}`, data: { course: lesson.course, date: lesson.date, time: lesson.time, student: this.studentName(lesson.studentId), teacher: this.teacherName(lesson.teacherId), note: lesson.note } }}>
                  {(recordRef) => (
                    <div ref={recordRef} className="course-lesson">
                      <div className="course-lesson__when"><strong>{lesson.time}</strong><span>{this.dateLabel(lesson.date)}</span></div>
                      <div className="course-lesson__what">
                        <strong>{lesson.course}</strong>
                        <span className="course-muted">{this.studentName(lesson.studentId)} · {this.teacherName(lesson.teacherId)}</span>
                        {lesson.note ? <span className="course-lesson__note">{lesson.note}</span> : null}
                      </div>
                      <div className="course-lesson__tools">
                        <span className="course-pill course-pill--soft course-lesson__subject">{this.teacherSubject(lesson.teacherId)}</span>
                        <button type="button" className="course-lesson__note-button" onClick={() => this.openLessonNote(lesson)}>{copy.noteAction}</button>
                      </div>
                    </div>
                  )}
                </PlingRecord>
              ))}
            </div>
          </section>
        )}
      </PlingScope>
    );
  }

  private renderActivity(): React.ReactNode {
    const chrome = getWorkspacePresentation(this.props.locale);
    return (
      <section className="course-section" id="activity-panel">
        <header className="course-section__head">
          <div><p className="course-eyebrow">{chrome.sections.activityEyebrow}</p><h2>{chrome.sections.activityTitle}</h2></div>
        </header>
        <ol id="activity-list" className="course-activity">
          {this.service.activity.length === 0 ? <li className="course-empty">{COPY[this.props.locale].emptyActivity}</li> : null}
          {this.service.activity.slice(0, 8).map((item) => (
            <li key={item.id} className="course-activity__item" data-kind={item.kind}>
              <span className="course-activity__kind">{this.statusLabel(item.kind)}</span>
              <div><strong>{item.title}</strong><p>{item.detail}</p></div>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  render(): React.ReactNode {
    const zh = this.props.locale === "zh";
    const chrome = getWorkspacePresentation(this.props.locale);
    const draftCount = this.service.courses.filter((course) => course.status === "draft").length;
    const lessonCount = this.service.lessons.length;
    return (
      <div className="course-app">
        <PlingState name="course" source={this.courseState} description={zh ? "当前学员、老师与排课状态" : "Current students, teachers, and lessons"} />

        <aside className="course-sidebar">
          <div className="course-brand">
            <span className="course-brand__mark" aria-hidden="true">{chrome.storeInitial}</span>
            <span>{chrome.brand}</span>
          </div>
          <nav className="course-nav" aria-label="Main navigation">{this.renderNav(chrome)}</nav>
          <div className="course-sidebar-foot">
            <span className="course-store-avatar">{chrome.storeInitial}</span>
            <div><strong>{chrome.store}</strong><span>{chrome.location}</span></div>
          </div>
        </aside>

        <section className="course-main">
          <header className="course-topbar">
            <div className="course-breadcrumb">
              {chrome.breadcrumb.map((part, index) => (
                <React.Fragment key={`${part}-${index}`}>
                  {index < chrome.breadcrumb.length - 1 ? <span>{part}</span> : <strong>{part}</strong>}
                  {index < chrome.breadcrumb.length - 1 ? <span>/</span> : null}
                </React.Fragment>
              ))}
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
              <button className="course-primary-button" type="button" onClick={() => this.openTaskInChat("course.create")}>
                <span aria-hidden="true">＋</span>
                <span>{chrome.page.action}</span>
              </button>
            </div>

            <div className="course-stat-row" aria-label="Course summary">
              <div className="course-stat"><strong>{this.service.courses.length}</strong><span>{chrome.stats.courses}</span></div>
              <div className="course-stat"><strong>{lessonCount}</strong><span>{chrome.stats.scheduled}</span></div>
              <div className="course-stat"><strong>{draftCount}</strong><span>{chrome.stats.drafts}</span></div>
            </div>

            <section className="course-grid" aria-label="Course catalogue">{this.renderCourses(chrome)}</section>
            {this.renderSchedule()}
            <div className="course-panels">
              {this.renderStudents()}
              {this.renderTeachers()}
            </div>
            {this.renderActivity()}
          </main>
        </section>

        <aside className="course-dock" aria-label="Pling assistant">
          <AgentDock
            ref={this.setDock}
            title={zh ? "页灵助手" : "Pling assistant"}
            placeholder={zh ? "告诉助手你要做什么，或继续当前任务…" : "Tell the assistant what to do, or continue this task…"}
            quick={courseQuickPrompts(this.props.locale)}
            debug={{ maxCalls: 8 }}
            modelSettings="readonly"
            layout="sidebar"
            sidebarMode="fused"
            defaultOpen
            task={this.taskHost}
          />
        </aside>
      </div>
    );
  }
}
