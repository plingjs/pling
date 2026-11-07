import type { TaskController, TaskRunSnapshot } from "@plingjs/agent";
import { createGuideActions, type GuideActionItem, type GuideActions } from "@plingjs/vanilla";
import type { Locale } from "./copy";
import type { CourseDraft, CourseFormController, CourseFormTeacher } from "./course-form";

export interface CourseGuideController {
  readonly element: HTMLElement;
  open(): void;
  reset(): void;
  requestSave(): void;
  refresh(): void;
  destroy(): void;
}

export interface CourseGuideOptions {
  controller: TaskController;
  form: CourseFormController;
  teachers: readonly CourseFormTeacher[];
  locale: Locale;
  onActivate?: () => void;
  onComplete?: (draft: CourseDraft) => void;
}

interface Copy {
  welcome: string;
  title: string;
  subtitle: (step: number) => string;
  steps: readonly string[];
  stepState: { current: string; pending: string; done: string };
  state: { running: string; done: string };
  stepOne: {
    title: string;
    copy: string;
    name: string;
    difficulty: string;
    intro: string;
    recommended: string;
    current: string;
    primary: string;
    secondary: string;
    locate: string;
    openForm: string;
    message: string;
    readMessage: string;
    missing: string;
  };
  stepTwo: {
    title: string;
    copy: string;
    teacher: string;
    cards: string;
    note: string;
    noteFallback: string;
    primary: string;
    secondary: string;
    message: string;
  };
  stepThree: {
    title: string;
    copy: string;
    handoffTitle: string;
    handoffBody: string;
    primary: string;
    secondary: string;
    locateMessage: string;
    uploaded: string;
    notUploaded: string;
  };
  stepFour: {
    title: string;
    copy: string;
    difficulty: string;
    teacher: string;
    cards: string;
    cover: string;
    coverYes: string;
    coverNo: string;
    deduct: string;
    confirm: string;
    primary: string;
    secondary: string;
    saving: string;
    missing: string;
    saved: (name: string) => string;
  };
  done: {
    title: (name: string) => string;
    body: string;
    view: string;
    restart: string;
  };
  note: string;
  error: string;
}

const COPY: Record<Locale, Copy> = {
  zh: {
    welcome:
      "我看到你已经打开了“创建新课程”。这次不另做一套表单：我在聊天里整理信息，把值写进页面里的原表单，需要你亲自选的封面会停下来等你。",
    title: "创建课程",
    subtitle: (step) => `课程管理 · 第 ${step} 步，共 4 步`,
    steps: ["课程信息", "教学与约课", "课程封面", "核对并保存"],
    stepState: { current: "当前", pending: "待开始", done: "已完成" },
    state: { running: "进行中", done: "已完成" },
    stepOne: {
      title: "先确定课程内容",
      copy: "这一轮只在页面原表单里填写，助手不再重复一套输入框。可以先点“填入推荐内容”，也可以直接在左侧页面里改。",
      name: "课程名称",
      difficulty: "难度",
      intro: "课程介绍",
      recommended: "推荐内容",
      current: "页面当前值",
      primary: "自动填写",
      secondary: "读取页面值",
      locate: "定位",
      openForm: "重新打开页面表单",
      message: "课程名称、难度和介绍已经写入页面，并定位到对应字段。接下来确认老师和可用卡片。",
      readMessage: "已按页面里的当前值继续。接下来确认老师和可用卡片。",
      missing: "页面里还没有课程名称。请先在原表单填写，或点“填入推荐内容”。",
    },
    stepTwo: {
      title: "确认怎么约课",
      copy: "老师和可用卡决定学员能不能约到这门课。点选后会把值写进页面对应的选择器。",
      teacher: "授课老师",
      cards: "课程可用卡片",
      note: "约课须知",
      noteFallback: "请提前 10 分钟到店；开课前 2 小时内不可取消。",
      primary: "写入并继续",
      secondary: "定位",
      message: "老师、可用卡和约课须知已经写入页面。课程封面需要你亲自完成。",
    },
    stepThree: {
      title: "封面这一步交给你",
      copy: "上传需要读取你本地的文件，助手不会代选。打开页面中的封面区域后，你选图，我继续核对。",
      handoffTitle: "人工接力：选择课程封面",
      handoffBody: "课程名、老师、卡片和规则已经写入页面。剩下这张封面，需要你在原表单里完成。",
      primary: "定位封面",
      secondary: "继续核对",
      locateMessage: "页面已经定位到课程封面。选好图片后，我会自动继续。",
      uploaded: "封面已经选好。我会再读一遍页面里的值，然后让你确认保存。",
      notUploaded: "还没有看到封面。请先在页面里选择一张图片，再继续核对。",
    },
    stepFour: {
      title: "保存前，再核对一次",
      copy: "下面是页面中当前的值。点击保存后，我会等页面完成写入，再回读课程列表确认结果。",
      difficulty: "难度",
      teacher: "授课老师",
      cards: "可用卡片",
      cover: "课程封面",
      coverYes: "已选择",
      coverNo: "未选择",
      deduct: "扣卡与金额",
      confirm: "保存时以页面中的值为准；如你在页面里改过，我会先重新读取。",
      primary: "保存",
      secondary: "定位保存",
      saving: "保存中…",
      missing: "还有必填项没有完成。请先补齐课程名称、老师和可用卡片；封面需要你在页面里亲自上传。",
      saved: (name) => `正在保存「${name}」，并回读课程列表…`,
    },
    done: {
      title: (name) => `${name} 已创建`,
      body: "已回读课程列表：新课程出现在第 1 位，名称、老师与可用卡和确认值一致。",
      view: "查看新增课程",
      restart: "再做一次",
    },
    note: "助手会同时操作页面与整理信息。写入前会再次确认。",
    error: "保存没有完成。",
  },
  en: {
    welcome:
      "I can see the “Create a course” form is open. I will not build a second form in chat: I organise the information here and write it into the page’s original fields. The cover is the one thing that waits for you.",
    title: "Create a course",
    subtitle: (step) => `Courses · step ${step} of 4`,
    steps: ["Course information", "Teaching and booking", "Course cover", "Review and save"],
    stepState: { current: "Current", pending: "Pending", done: "Done" },
    state: { running: "In progress", done: "Done" },
    stepOne: {
      title: "Start with the course content",
      copy: "This round happens in the page’s original form. The assistant does not repeat the inputs. Use the recommended content, or edit the page directly.",
      name: "Course name",
      difficulty: "Difficulty",
      intro: "Course introduction",
      recommended: "Recommended",
      current: "Current page values",
      primary: "Fill it in",
      secondary: "Read the page",
      locate: "Point to it",
      openForm: "Reopen the page form",
      message: "The name, difficulty and introduction are now in the page, and the fields are highlighted. Next, confirm the teacher and eligible cards.",
      readMessage: "Continuing with the values currently in the page. Next, confirm the teacher and eligible cards.",
      missing: "There is no course name in the page yet. Fill it in the original form, or use the recommended content.",
    },
    stepTwo: {
      title: "Decide how students can book",
      copy: "The teacher and eligible cards decide who can book this course. Selecting a value writes it into the matching page control.",
      teacher: "Teacher",
      cards: "Eligible cards",
      note: "Booking notes",
      noteFallback: "Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
      primary: "Write and continue",
      secondary: "Point to it",
      message: "The teacher, eligible cards and booking notes are in the page. The course cover needs your input.",
    },
    stepThree: {
      title: "The cover is your step",
      copy: "Uploading reads a local file, so the assistant will not choose it for you. Point to the cover area, choose an image, and I will continue.",
      handoffTitle: "Human handoff: choose a course cover",
      handoffBody: "The name, teacher, cards and rules are already in the page. The cover still needs to be completed in the original form.",
      primary: "Point to the cover",
      secondary: "Continue",
      locateMessage: "The page is pointing at the cover. I will continue as soon as you choose an image.",
      uploaded: "The cover is selected. I will read the page again and ask you to confirm the save.",
      notUploaded: "No cover yet. Choose an image in the page first, then continue.",
    },
    stepFour: {
      title: "Check once before saving",
      copy: "These are the values currently in the page. After saving, I wait for the write to finish and read the course list back.",
      difficulty: "Difficulty",
      teacher: "Teacher",
      cards: "Eligible cards",
      cover: "Course cover",
      coverYes: "Selected",
      coverNo: "Not selected",
      deduct: "Deduction and price",
      confirm: "The page values are the source of truth. If you edited them, I read them again before saving.",
      primary: "Save",
      secondary: "Point to save",
      saving: "Saving…",
      missing: "Some required fields are still missing. Complete the course name, teacher and eligible cards; the cover must be uploaded by you in the page.",
      saved: (name) => `Saving “${name}” and reading the course list back…`,
    },
    done: {
      title: (name) => `${name} created`,
      body: "The course list was read back: the new course is first, and its name, teacher and cards match the confirmed values.",
      view: "View the new course",
      restart: "Run it again",
    },
    note: "The assistant works with the page while keeping the information in chat. It confirms before writing.",
    error: "The save did not finish.",
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function star(value: number): string {
  return "★".repeat(Math.max(0, Math.min(5, value))) + "☆".repeat(Math.max(0, 5 - Math.max(0, Math.min(5, value))));
}

export function createCourseGuide(options: CourseGuideOptions): CourseGuideController {
  const text = COPY[options.locale];
  const recommended = options.locale === "zh"
    ? {
        name: "瑜伽基础",
        difficulty: 3,
        intro: "从基础呼吸和体式开始，建立稳定的练习节奏。",
        teacherId: options.teachers[0]?.id ?? "",
        cards: "月卡",
        note: "请提前 10 分钟到店；开课前 2 小时内不可取消。",
        price: "200",
        deduct: "1.0",
      }
    : {
        name: "Yoga foundations",
        difficulty: 3,
        intro: "Start with basic breathing and postures, then build a steady practice rhythm.",
        teacherId: options.teachers[0]?.id ?? "",
        cards: "Monthly card",
        note: "Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
        price: "200",
        deduct: "1.0",
      };

  const element = document.createElement("div");
  element.className = "course-guide";
  element.innerHTML = `
    <div class="message assistant course-guide__message course-guide__message--plain">
      <div class="message-bubble">${escapeHtml(text.welcome)}</div>
    </div>
    <section class="task-card" aria-live="polite"></section>
    <p class="assistant-note">${escapeHtml(text.note)}</p>
  `;
  const cardHost = element.querySelector<HTMLElement>(".task-card")!;

  let step = 1;
  let done = false;
  let busy = false;
  let error = "";
  let selectedTeacherId = "";
  let selectedCards = "";
  let unsubForm: (() => void) | null = null;
  let destroyed = false;
  const actionViews: GuideActions[] = [];

  function draft(): CourseDraft {
    return options.form.read();
  }

  function teacherName(id: string): string {
    return options.teachers.find((teacher) => teacher.id === id)?.name ?? "";
  }

  function syncTaskValues(value: CourseDraft): void {
    const snapshot = options.controller.snapshot();
    if (!snapshot || (snapshot.status !== "collecting" && snapshot.status !== "ready" && snapshot.status !== "planned")) return;
    options.controller.setValue("name", value.name.trim());
    options.controller.setValue("teacherId", value.teacherId);
    options.controller.setValue("cards", value.cards);
    options.controller.setValue("cover", value.cover ? true : undefined);
    options.controller.setValue("difficulty", value.difficulty || 3);
    options.controller.setValue("price", value.price || recommended.price);
    options.controller.setValue("deduct", value.deduct || recommended.deduct);
    options.controller.setValue("intro", value.intro);
    options.controller.setValue("note", value.note);
  }

  function stepMarkup(): string {
    return text.steps
      .map((label, index) => {
        const number = index + 1;
        const completed = done || number < step;
        const current = !done && number === step;
        const status = completed ? text.stepState.done : current ? text.stepState.current : text.stepState.pending;
        return `
          <li class="task-step${completed ? " is-done" : ""}${current ? " is-current" : ""}">
            <span class="step-dot">${completed ? "✓" : number}</span>
            <span>${escapeHtml(label)}</span>
            <small>${status}</small>
          </li>
        `;
      })
      .join("");
  }

  function openFormLink(): string {
    if (options.form.isOpen()) return "";
    return `<button class="page-focus" type="button" data-action="open-form">${text.stepOne.openForm}</button>`;
  }

  function stepOneMarkup(): string {
    const value = draft();
    const hasName = Boolean(value.name.trim());
    const current = hasName
      ? {
          name: value.name,
          difficulty: value.difficulty,
          intro: value.intro,
          label: text.stepOne.current,
        }
      : {
          name: recommended.name,
          difficulty: recommended.difficulty,
          intro: recommended.intro,
          label: text.stepOne.recommended,
        };

    return `
      <p class="task-panel-title">${text.stepOne.title}</p>
      <p class="task-panel-copy">${text.stepOne.copy}</p>
      <div class="guide-summary">
        <div class="guide-summary__head"><span>${current.label}</span><small>${text.stepOne.name} · ${text.stepOne.difficulty} · ${text.stepOne.intro}</small></div>
        <div class="guide-summary__row"><span>${text.stepOne.name}</span><strong>${escapeHtml(current.name)}</strong></div>
        <div class="guide-summary__row"><span>${text.stepOne.difficulty}</span><strong class="guide-stars">${star(current.difficulty)}</strong></div>
        <div class="guide-summary__row"><span>${text.stepOne.intro}</span><strong>${escapeHtml(current.intro)}</strong></div>
      </div>
      ${openFormLink()}
      <div class="task-actions" data-guide-slot="basic"></div>
    `;
  }

  function stepTwoMarkup(): string {
    const value = draft();
    const teacherId = selectedTeacherId || value.teacherId || recommended.teacherId;
    const cards = selectedCards || value.cards || recommended.cards;
    const note = value.note.trim() || recommended.note;
    return `
      <p class="task-panel-title">${text.stepTwo.title}</p>
      <p class="task-panel-copy">${text.stepTwo.copy}</p>
      <div class="guide-choice">
        <span>${text.stepTwo.teacher}</span>
        <div class="guide-chips">
          ${options.teachers.map((teacher) => `
            <button type="button" class="choice-chip${teacher.id === teacherId ? " is-selected" : ""}" data-action="teacher" data-teacher="${escapeHtml(teacher.id)}">${escapeHtml(teacher.name)}</button>
          `).join("")}
        </div>
      </div>
      <div class="guide-choice">
        <span>${text.stepTwo.cards}</span>
        <div class="guide-chips">
          ${(options.locale === "zh"
            ? ["月卡", "私教 10 次卡", "单次体验卡"]
            : ["Monthly card", "10-class personal training", "Single-class trial"]).map((card) => `
              <button type="button" class="choice-chip${card === cards ? " is-selected" : ""}" data-action="cards" data-cards="${escapeHtml(card)}">${escapeHtml(card)}</button>
            `).join("")}
        </div>
      </div>
      <div class="guide-choice">
        <span>${text.stepTwo.note}</span>
        <div class="guide-note">${escapeHtml(note)}</div>
      </div>
      ${openFormLink()}
      <div class="task-actions" data-guide-slot="teaching"></div>
    `;
  }

  function stepThreeMarkup(): string {
    return `
      <p class="task-panel-title">${text.stepThree.title}</p>
      <p class="task-panel-copy">${text.stepThree.copy}</p>
      <div class="handoff-box">
        <strong>${text.stepThree.handoffTitle}</strong><br />
        ${text.stepThree.handoffBody}
      </div>
      ${openFormLink()}
      <div class="task-actions" data-guide-slot="cover"></div>
    `;
  }

  function stepFourMarkup(): string {
    const value = draft();
    return `
      <p class="task-panel-title">${text.stepFour.title}</p>
      <p class="task-panel-copy">${text.stepFour.copy}</p>
      <div class="summary-box">
        <strong>${escapeHtml(value.name || recommended.name)}</strong>
        <div class="summary-list">
          <div class="summary-row"><span>${text.stepFour.difficulty}</span><b>${value.difficulty || recommended.difficulty} ★</b></div>
          <div class="summary-row"><span>${text.stepFour.teacher}</span><b>${escapeHtml(teacherName(value.teacherId) || teacherName(recommended.teacherId))}</b></div>
          <div class="summary-row"><span>${text.stepFour.cards}</span><b>${escapeHtml(value.cards || recommended.cards)}</b></div>
          <div class="summary-row"><span>${text.stepFour.cover}</span><b>${value.cover ? text.stepFour.coverYes : text.stepFour.coverNo}</b></div>
          <div class="summary-row"><span>${text.stepFour.deduct}</span><b>${escapeHtml(value.deduct || recommended.deduct)} · ¥${escapeHtml(value.price || recommended.price)}</b></div>
        </div>
        <div class="confirm-line"><span>✓</span>${text.stepFour.confirm}</div>
      </div>
      ${error ? `<p class="task-error">${escapeHtml(error)}</p>` : ""}
      ${openFormLink()}
      <div class="task-actions" data-guide-slot="review"></div>
    `;
  }

  function doneMarkup(): string {
    const value = draft();
    return `
      <div class="result-box">
        <span class="result-check">✓</span>
        <div>
          <strong>${text.done.title(escapeHtml(value.name || recommended.name))}</strong>
          <span>${text.done.body}</span>
        </div>
      </div>
      <div class="task-actions" data-guide-slot="done"></div>
    `;
  }

  /**
   * The action row is the shared `@plingjs/dom` renderer, not bespoke markup.
   * A long recommendation never becomes a wide button: the verb stays short and
   * the value is a single-line preview with the full text in the title and the
   * accessible name. The host still owns what each command means.
   */
  function guideItems(slot: string): GuideActionItem[] {
    if (slot === "basic") {
      const value = draft();
      const current = value.name.trim()
        ? { name: value.name, difficulty: value.difficulty, intro: value.intro }
        : recommended;
      const preview = [current.name, star(current.difficulty), current.intro].filter(Boolean).join(" · ");
      return [
        {
          id: "fill-basic",
          label: text.stepOne.primary,
          preview,
          ariaLabel: `${text.stepOne.primary}${options.locale === "zh" ? "：" : ": "}${preview}`,
          command: "fill-basic",
          kind: "suggestion",
        },
        { id: "focus-basic", label: text.stepOne.locate, command: "focus-basic" },
        { id: "read-basic", label: text.stepOne.secondary, command: "read-basic" },
      ];
    }
    if (slot === "teaching") {
      return [
        { id: "fill-teaching", label: text.stepTwo.primary, command: "fill-teaching", kind: "primary" },
        { id: "focus-teaching", label: text.stepTwo.secondary, command: "focus-teaching" },
      ];
    }
    if (slot === "cover") {
      return [
        { id: "focus-cover", label: text.stepThree.primary, command: "focus-cover", kind: "primary" },
        { id: "cover-done", label: text.stepThree.secondary, command: "cover-done" },
      ];
    }
    if (slot === "review") {
      return [
        {
          id: "save",
          label: busy ? text.stepFour.saving : text.stepFour.primary,
          command: "save",
          kind: "primary",
          disabled: busy,
        },
        { id: "focus-save", label: text.stepFour.secondary, command: "focus-save", disabled: busy },
      ];
    }
    if (slot === "done") {
      return [
        { id: "view-course", label: text.done.view, command: "view-course", kind: "primary" },
        { id: "restart", label: text.done.restart, command: "restart" },
      ];
    }
    return [];
  }

  function destroyActions(): void {
    for (const view of actionViews) view.destroy();
    actionViews.length = 0;
  }

  function mountActions(): void {
    destroyActions();
    for (const host of cardHost.querySelectorAll<HTMLElement>("[data-guide-slot]")) {
      const items = guideItems(host.dataset.guideSlot ?? "");
      if (!items.length) continue;
      const view = createGuideActions({
        items,
        locale: options.locale === "zh" ? "zh-CN" : "en-US",
        ariaLabel: text.title,
        onCommand: (command) => runAction(command),
      });
      host.replaceChildren(view.element);
      actionViews.push(view);
    }
  }

  function render(): void {
    if (destroyed) return;
    destroyActions();
    const completed = done ? 4 : Math.min(step - 1, 3);
    const body = done
      ? doneMarkup()
      : step === 1
        ? stepOneMarkup()
        : step === 2
          ? stepTwoMarkup()
          : step === 3
            ? stepThreeMarkup()
            : stepFourMarkup();

    cardHost.innerHTML = `
      <div class="task-card__head">
        <div>
          <div class="task-card__title-row">
            <span class="task-card__icon">✦</span>
            <h3>${text.title}</h3>
          </div>
          <p class="task-card__sub">${done ? text.done.body : text.subtitle(step)}</p>
        </div>
        <span class="task-state${done ? " is-done" : ""}">${done ? text.state.done : text.state.running}</span>
      </div>
      <div class="progress-track" aria-hidden="true"><span style="width: ${completed * 25}%"></span></div>
      <div class="task-card__body">
        <ol class="task-steps">${stepMarkup()}</ol>
        ${error && step !== 4 ? `<p class="task-error">${escapeHtml(error)}</p>` : ""}
        ${body}
      </div>
    `;
    mountActions();
  }

  function activate(): void {
    options.form.open();
    options.onActivate?.();
  }

  function ensureTask(): void {
    const snapshot = options.controller.snapshot();
    if (!snapshot || snapshot.taskId !== "course.create" || done || snapshot.status === "done" || snapshot.status === "failed" || snapshot.status === "cancelled") {
      options.controller.reset();
      options.controller.start("course.create", {
        name: draft().name,
        teacherId: draft().teacherId,
        cards: draft().cards,
        cover: draft().cover ? true : undefined,
        difficulty: draft().difficulty || recommended.difficulty,
        price: draft().price || recommended.price,
        deduct: draft().deduct || recommended.deduct,
        intro: draft().intro,
        note: draft().note,
      });
    }
  }

  /** The visible stage is derived from the page, never from a script cursor. */
  function stepForDraft(value: CourseDraft): number {
    if (!value.name.trim()) return 1;
    if (!value.teacherId || !value.cards.trim()) return 2;
    if (!value.cover) return 3;
    return 4;
  }

  function patchFromTaskValues(values: TaskRunSnapshot["values"]): Partial<CourseDraft> {
    const current = draft();
    const patch: Partial<CourseDraft> = {};
    const text = (name: keyof CourseDraft, raw: unknown): void => {
      if (raw === undefined || raw === null) return;
      const next = String(raw);
      if (next !== String(current[name])) (patch as Record<string, unknown>)[name] = next;
    };
    text("name", values.name);
    text("cards", values.cards);
    text("intro", values.intro);
    text("note", values.note);
    text("deduct", values.deduct);
    text("price", values.price);
    if (values.difficulty !== undefined && values.difficulty !== null) {
      const next = Number(values.difficulty) || 0;
      if (next !== current.difficulty) patch.difficulty = next;
    }
    if (values.teacherId !== undefined && values.teacherId !== null) {
      const next = String(values.teacherId);
      if (next !== current.teacherId) {
        patch.teacherId = next;
        patch.teacherName = teacherName(next);
      }
    }
    return patch;
  }

  function advance(next: number): void {
    step = next;
    error = "";
    render();
  }

  function applyBasic(): void {
    const value = draft();
    const useCurrent = Boolean(value.name.trim());
    const next = useCurrent
      ? value
      : {
          ...value,
          name: recommended.name,
          difficulty: recommended.difficulty,
          intro: recommended.intro,
        };
    if (!next.name.trim()) {
      error = text.stepOne.missing;
      options.form.focus("name");
      render();
      return;
    }
    options.form.apply(
      {
        name: next.name,
        difficulty: next.difficulty || recommended.difficulty,
        intro: next.intro,
      },
      { focus: true },
    );
    syncTaskValues(options.form.read());
    advance(2);
  }

  function readBasic(): void {
    const value = draft();
    if (!value.name.trim()) {
      error = text.stepOne.missing;
      options.form.focus("name");
      render();
      return;
    }
    syncTaskValues(value);
    options.form.flash(["name", "difficulty", "intro"]);
    advance(2);
  }

  function fillTeaching(): void {
    const value = draft();
    const teacherId = selectedTeacherId || value.teacherId || recommended.teacherId;
    const cards = selectedCards || value.cards || recommended.cards;
    options.form.apply(
      {
        teacherId,
        cards,
        note: value.note.trim() ? value.note : recommended.note,
      },
      { focus: false },
    );
    options.form.flash(["teacher", "cards", "note"]);
    syncTaskValues(options.form.read());
    advance(3);
  }

  function coverDone(): void {
    if (!draft().cover) {
      error = text.stepThree.notUploaded;
      options.form.focus("cover");
      render();
      return;
    }
    syncTaskValues(draft());
    advance(4);
  }

  async function save(): Promise<void> {
    if (busy || done) return;
    const value = draft();
    if (!value.name.trim() || !value.teacherId || !value.cards.trim()) {
      error = text.stepFour.missing;
      if (!value.name.trim()) options.form.focus("name");
      else if (!value.teacherId) options.form.focus("teacher");
      else options.form.focus("cards");
      render();
      return;
    }
    busy = true;
    error = "";
    syncTaskValues(value);
    render();
    try {
      const snapshot = await options.controller.run();
      if (snapshot.status === "done") {
        done = true;
        step = 4;
        busy = false;
        options.form.close();
        options.onComplete?.(value);
        render();
        return;
      }
      if (snapshot.status === "failed") {
        error = snapshot.error?.message ? `${text.error} ${snapshot.error.message}` : text.error;
      } else {
        error = text.stepFour.missing;
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    } finally {
      busy = false;
      render();
    }
  }

  element.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const teacher = target.closest<HTMLElement>("[data-teacher]");
    if (teacher?.dataset.teacher) {
      selectedTeacherId = teacher.dataset.teacher;
      options.form.apply({ teacherId: selectedTeacherId }, { focus: true });
      render();
      return;
    }
    const card = target.closest<HTMLElement>("[data-cards]");
    if (card?.dataset.cards) {
      selectedCards = card.dataset.cards;
      options.form.apply({ cards: selectedCards }, { focus: true });
      render();
      return;
    }
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action) runAction(action);
  });

  /** One dispatch table shared by HTML controls and the shared action row. */
  function runAction(action: string): void {
    if (action === "open-form") {
      activate();
      render();
      return;
    }
    if (action === "fill-basic") applyBasic();
    if (action === "read-basic") readBasic();
    if (action === "focus-basic") options.form.focus(["name", "difficulty", "intro"]);
    if (action === "fill-teaching") fillTeaching();
    if (action === "focus-teaching") options.form.flash(["teacher", "cards", "note"]);
    if (action === "focus-cover") {
      activate();
      options.form.focus("cover");
      render();
    }
    if (action === "cover-done") coverDone();
    if (action === "save") void save();
    if (action === "focus-save") {
      activate();
      options.form.focusSave();
    }
    if (action === "view-course") {
      const name = draft().name.trim();
      const tiles = [...document.querySelectorAll<HTMLElement>(".course-tile")];
      const tile = tiles.find((item) => item.querySelector("h2")?.textContent?.trim() === name);
      if (tile) {
        tile.scrollIntoView({ behavior: "smooth", block: "center" });
        tile.classList.add("is-highlighted");
        setTimeout(() => tile.classList.remove("is-highlighted"), 1800);
      }
    }
    if (action === "restart") {
      restart();
    }
  }

  function restart(): void {
    options.controller.reset();
    options.form.reset();
    step = 1;
    done = false;
    busy = false;
    error = "";
    selectedTeacherId = "";
    selectedCards = "";
    options.form.open();
    ensureTask();
    activate();
    render();
  }

  function open(): void {
    activate();
    ensureTask();
    error = "";
    if (!done && step < 1) step = 1;
    render();
  }

  let applyingTaskValues = false;

  unsubForm = options.form.subscribe(() => {
    if (destroyed || applyingTaskValues) return;
    // The page form is the source of truth. Keep the task's working memory in
    // sync on every edit, not only when a guide button is pressed.
    if (options.controller.snapshot()) syncTaskValues(draft());
    if (step === 3 && draft().cover) {
      error = "";
      step = 4;
      syncTaskValues(draft());
      render();
      return;
    }
    if (step === 4) render();
  });

  // Keep the card honest if a snapshot arrives from outside (for example, a
  // model update or a task-level error raised by the controller).
  const unsubscribe = options.controller.subscribe((snapshot: TaskRunSnapshot | null) => {
    if (destroyed || !snapshot || snapshot.taskId !== "course.create") return;
    const patch = patchFromTaskValues(snapshot.values);
    if (Object.keys(patch).length) {
      applyingTaskValues = true;
      options.form.apply(patch, { focus: false });
      applyingTaskValues = false;
      step = stepForDraft(options.form.read());
      error = "";
      render();
    }
    if (snapshot.status === "failed" && snapshot.error) {
      error = snapshot.error.message;
      busy = false;
      render();
    }
  });

  render();

  return {
    element,
    open,
    reset: restart,
    requestSave: () => {
      void save();
    },
    refresh: render,
    destroy() {
      destroyed = true;
      destroyActions();
      unsubscribe();
      unsubForm?.();
      element.remove();
    },
  };
}
