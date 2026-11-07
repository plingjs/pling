import type {
  TaskController,
  TaskGuideCommand,
  TaskGuideDefinition,
  TaskGuideState,
  TaskRunSnapshot,
  TaskValue,
} from "@plingjs/agent";
import {
  createGuideActions,
  type GuideActions,
  type GuideActionItem,
} from "@plingjs/vanilla";
import { COURSE_CREATE_COPY } from "../course-create/copy";
import { courseCreateFieldNodes, type CourseFieldNode } from "../course-create/guide";
import { recommendedCourse } from "../course-create/model";
import type { Locale } from "./copy";
import type { CourseDraft, CourseFormController, CourseFormTeacher } from "./course-form";

/**
 * The page-owned half of the `course.create` guided task.
 *
 * The model owns the conversation and writes only to task working memory. This
 * controller keeps that memory in sync with the real form, points at fields,
 * and turns the final step into a human-confirmed business write. It never
 * interprets the user's prose and never chooses the next question from a
 * script.
 */
export interface CourseGuideController {
  readonly element: HTMLElement;
  readonly definition: TaskGuideDefinition;
  open(): void;
  reset(): void;
  requestSave(): void;
  refresh(): void;
  state(): TaskGuideState;
  command(command: TaskGuideCommand): void | Promise<void>;
  destroy(): void;
}

export interface CourseGuideOptions {
  controller: TaskController;
  form: CourseFormController;
  teachers: readonly CourseFormTeacher[];
  locale: Locale;
  onActivate?: () => void;
  onComplete?: (draft: CourseDraft) => void;
  onRestart?: () => void;
  onCancel?: () => void;
}

function valuesFromDraft(draft: CourseDraft): Record<string, TaskValue> {
  return {
    name: draft.name.trim(),
    teacherId: draft.teacherId,
    cards: draft.cards,
    difficulty: draft.difficulty || undefined,
    price: draft.price || undefined,
    deduct: draft.deduct || undefined,
    intro: draft.intro,
    note: draft.note,
    // An unuploaded cover is missing, not a completed `false` decision.
    cover: draft.cover ? true : undefined,
  };
}

export function createCourseGuide(options: CourseGuideOptions): CourseGuideController {
  const text = COURSE_CREATE_COPY[options.locale];
  const recommended = recommendedCourse(options.locale, options.teachers);
  const skipped = new Set<string>();
  let snapshot: TaskRunSnapshot | null = null;
  let reviewOpen = false;
  let busy = false;
  let done = false;
  let announced = false;
  let error = "";
  let applyingTaskValues = false;
  let resetting = false;
  let destroyed = false;

  const draft = (): CourseDraft => options.form.read();

  const fields = (): CourseFieldNode[] =>
    courseCreateFieldNodes(options.locale, draft(), options.teachers, [...skipped]);

  function requiredComplete(): boolean {
    return fields().every((field) => !field.required || field.filled || field.skipped);
  }

  function requiredGap(): CourseFieldNode | undefined {
    return fields().find((field) => field.required && !field.filled && !field.skipped);
  }

  function guideField(): CourseFieldNode | undefined {
    return requiredGap() ?? fields().find((field) => !field.filled && !field.skipped);
  }

  function teacherName(id: string): string {
    return options.teachers.find((teacher) => teacher.id === id)?.name ?? "";
  }

  function fieldElement(name: string): HTMLElement | null {
    return options.form.element.querySelector<HTMLElement>(`[data-field="${name}"]`);
  }

  function fieldControl(name: string): HTMLElement | null {
    return fieldElement(name)?.querySelector<HTMLElement>(
      "input:not([type=hidden]), textarea, select, button",
    ) ?? null;
  }

  function locate(field: string, flash = true): void {
    options.form.open();
    if (flash) options.form.focus(field);
    fieldControl(field)?.focus({ preventScroll: true });
  }

  function suggestionFor(field: string): Partial<CourseDraft> {
    switch (field) {
      case "name":
        return { name: recommended.name };
      case "difficulty":
        return { difficulty: recommended.difficulty };
      case "intro":
        return { intro: recommended.intro };
      case "teacher":
        return { teacherId: recommended.teacherId, teacherName: recommended.teacherName };
      case "cards":
        return { cards: recommended.cards };
      case "note":
        return { note: recommended.note };
      case "deduct":
        return { deduct: recommended.deduct };
      case "price":
        return { price: recommended.price };
      default:
        return {};
    }
  }

  function syncTaskValues(): void {
    const status = options.controller.snapshot()?.status;
    if (!status || status === "done" || status === "failed" || status === "cancelled") return;
    for (const [name, value] of Object.entries(valuesFromDraft(draft()))) {
      try {
        options.controller.setValue(name, value);
      } catch {
        // The page remains the source of truth if the run moved past collection.
      }
    }
    snapshot = options.controller.snapshot();
  }

  function applyTaskValues(values: TaskRunSnapshot["values"] | undefined): string[] {
    if (!values) return [];
    const current = draft();
    const patch: Partial<CourseDraft> = {};
    const changed: string[] = [];
    const textValue = (name: keyof CourseDraft, next: unknown): void => {
      if (next === undefined || next === null) return;
      const value = String(next);
      if (value === String(current[name])) return;
      (patch as Record<string, unknown>)[name] = value;
      changed.push(String(name));
    };

    textValue("name", values.name);
    textValue("cards", values.cards);
    textValue("intro", values.intro);
    textValue("note", values.note);
    textValue("deduct", values.deduct);
    textValue("price", values.price);

    if (values.difficulty !== undefined && values.difficulty !== null) {
      const difficulty = Number(values.difficulty);
      if (Number.isFinite(difficulty) && difficulty !== current.difficulty) {
        patch.difficulty = difficulty;
        changed.push("difficulty");
      }
    }

    if (values.teacherId !== undefined && values.teacherId !== null) {
      const teacherId = String(values.teacherId);
      if (teacherId !== current.teacherId) {
        patch.teacherId = teacherId;
        patch.teacherName = teacherName(teacherId);
        changed.push("teacher");
      }
    }

    if (values.cover === true && !current.cover) {
      patch.cover = true;
      changed.push("cover");
    }

    if (Object.keys(patch).length) {
      applyingTaskValues = true;
      options.form.open();
      options.form.apply(patch, { focus: false });
      applyingTaskValues = false;
      if (changed.length) options.form.flash(changed);
    }
    return changed;
  }

  function finish(): void {
    if (announced) return;
    announced = true;
    done = true;
    busy = false;
    reviewOpen = false;
    error = "";
    options.form.close();
    options.onComplete?.(draft());
  }

  function actionItems(): GuideActionItem[] {
    if (done) {
      return [
        { id: "view-course", label: text.done.view, command: "view-course", kind: "primary" },
        { id: "restart", label: text.done.restart, command: "restart" },
      ];
    }

    if (reviewOpen && requiredComplete()) {
      return [
        {
          id: "save",
          label: text.review.confirm,
          command: "save-course",
          kind: "primary",
          disabled: busy,
        },
        { id: "continue", label: text.review.continue, command: "resume-editing", disabled: busy },
      ];
    }

    const field = guideField();
    if (!field) {
      return [
        { id: "review", label: text.review.primary, command: "start-review", kind: "primary", disabled: busy },
        { id: "save-location", label: text.review.secondary, command: "focus-save", disabled: busy },
      ];
    }

    const items: GuideActionItem[] = [
      field.field === "cover"
        ? { id: "pick-cover", label: text.cover.upload, command: "pick-cover", kind: "primary", disabled: busy }
        : {
            id: "locate",
            label: `${text.row.locate} · ${field.label}`,
            command: "locate-field",
            kind: "primary",
            disabled: busy,
          },
    ];

    if (field.suggestion && field.field !== "cover") {
      const label = text.row.use;
      items.push({
        id: "use-suggestion",
        label,
        preview: field.suggestion,
        ariaLabel: options.locale === "zh"
          ? `${label}${field.label}：${field.suggestion}`
          : `${label} ${field.label}: ${field.suggestion}`,
        command: "use-suggestion",
        kind: "suggestion",
        disabled: busy,
      });
    }

    if (!field.required) {
      items.push({ id: "skip", label: text.row.skip, command: "skip-field", kind: "skip", disabled: busy });
    }

    if (requiredComplete()) {
      items.push({ id: "review", label: text.review.primary, command: "start-review", disabled: busy });
    }
    return items;
  }

  const element = document.createElement("div");
  element.className = "course-guide course-guide--actions";
  const errorNode = document.createElement("p");
  errorNode.className = "course-guide__error";
  const actions: GuideActions = createGuideActions({
    items: [],
    locale: options.locale === "zh" ? "zh-CN" : "en-US",
    onCommand: (command) => void runCommand(command),
  });
  element.append(errorNode, actions.element);

  function render(): void {
    if (destroyed) return;
    actions.update({
      items: actionItems(),
      hint: reviewOpen && requiredComplete() ? text.review.title : "",
      locale: options.locale === "zh" ? "zh-CN" : "en-US",
      onCommand: (command) => void runCommand(command),
    });
    errorNode.textContent = error;
    errorNode.hidden = !error;
    element.dataset.state = done ? "done" : reviewOpen ? "review" : "active";
  }

  function openReview(): void {
    const missing = fields().filter((field) => field.required && !field.filled && !field.skipped);
    if (missing.length) {
      const labels = missing.map((field) => field.label).join(options.locale === "zh" ? "、" : ", ");
      error = options.locale === "zh" ? `还需要填写：${labels}` : `Still needed: ${labels}`;
      if (missing[0]) locate(missing[0].field);
      render();
      return;
    }
    options.form.open();
    syncTaskValues();
    reviewOpen = true;
    error = "";
    render();
  }

  function applySuggestion(): void {
    const field = guideField();
    if (!field) return;
    options.form.apply(suggestionFor(field.field), { focus: true });
    skipped.delete(field.field);
    error = "";
    syncTaskValues();
    render();
  }

  function skipField(): void {
    const field = guideField();
    if (!field || field.required) return;
    skipped.add(field.field);
    error = "";
    render();
  }

  function pickCover(): void {
    locate("cover");
    options.form.element.querySelector<HTMLElement>("[data-upload]")?.click();
  }

  function viewCourse(): void {
    const name = draft().name.trim();
    const tiles = [...document.querySelectorAll<HTMLElement>(".course-tile")];
    const tile = tiles.find((item) => item.querySelector("h2")?.textContent?.trim() === name);
    if (!tile) return;
    tile.scrollIntoView({ behavior: "smooth", block: "center" });
    tile.classList.add("is-highlighted");
    setTimeout(() => tile.classList.remove("is-highlighted"), 1800);
  }

  function reset(): void {
    resetting = true;
    options.controller.reset();
    options.form.reset();
    skipped.clear();
    snapshot = null;
    reviewOpen = false;
    busy = false;
    done = false;
    announced = false;
    error = "";
    options.form.open();
    resetting = false;
    render();
  }

  function restart(): void {
    reset();
    if (options.onRestart) options.onRestart();
    else options.controller.start("course.create", valuesFromDraft(draft()));
    render();
  }

  async function save(): Promise<void> {
    if (busy || done) return;
    if (!requiredComplete()) {
      openReview();
      return;
    }
    busy = true;
    error = "";
    options.form.open();
    syncTaskValues();
    render();
    try {
      const result = await options.controller.run();
      snapshot = result;
      busy = false;
      if (result.status === "done") finish();
      else error = result.error?.message || text.error;
    } catch (cause) {
      busy = false;
      error = cause instanceof Error ? cause.message : text.error;
    }
    render();
  }

  async function runCommand(command: string): Promise<void> {
    if (command === "view-course") viewCourse();
    else if (command === "restart") restart();
    else if (command === "save-course") await save();
    else if (command === "resume-editing") {
      reviewOpen = false;
      error = "";
      const field = guideField();
      if (field) locate(field.field);
      render();
    } else if (command === "pick-cover") pickCover();
    else if (command === "locate-field") {
      const field = guideField();
      if (field) locate(field.field);
    } else if (command === "use-suggestion") applySuggestion();
    else if (command === "skip-field") skipField();
    else if (command === "start-review") openReview();
    else if (command === "focus-save") {
      options.form.open();
      options.form.focusSave();
    } else if (command.startsWith("focus-")) {
      locate(command.slice("focus-".length));
    } else if (command.startsWith("apply-")) {
      const field = command.slice("apply-".length);
      options.form.apply(suggestionFor(field), { focus: true });
      syncTaskValues();
      render();
    }
  }

  const definition: TaskGuideDefinition = {
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
    labels: {
      running: text.labels.running,
      completed: text.labels.completed,
      current: text.labels.current,
      done: text.labels.done,
      pending: text.labels.pending,
      error: text.labels.error,
      required: text.required,
      optional: text.optional,
      ...(('skipped' in text.labels && typeof text.labels.skipped === "string")
        ? { skipped: text.labels.skipped }
        : {}),
    },
    fields: () => fields(),
    steps: [
      {
        id: "course.fill",
        label: text.steps[0],
        title: text.taskCourse,
        description: text.welcome,
      },
    ],
  };

  const offController = options.controller.subscribe((next) => {
    if (destroyed) return;
    snapshot = next;
    if (!next || next.taskId !== "course.create") return;
    const changed = applyTaskValues(next.values);
    if (changed.length) error = "";
    if (next.status === "done") finish();
    else if (next.status === "failed") {
      busy = false;
      error = next.error?.message || text.error;
    } else if (next.status === "cancelled") {
      busy = false;
      reviewOpen = false;
    }
    render();
  });

  const offForm = options.form.subscribe(() => {
    if (destroyed || applyingTaskValues || resetting) return;
    if (options.controller.snapshot()) syncTaskValues();
    if (draft().cover && requiredComplete() && !done) reviewOpen = true;
    render();
  });

  render();

  return {
    element,
    definition,
    open() {
      options.form.open();
      options.onActivate?.();
      render();
    },
    reset,
    requestSave: openReview,
    refresh: render,
    state() {
      return {
        snapshot,
        step: 1,
        busy,
        error,
        completed: done,
      };
    },
    async command(command) {
      const action = command.action.command;
      if (action === "review-task" || action === "propose-save") openReview();
      else if (action === "cancel-task") {
        reviewOpen = false;
        error = "";
        options.onCancel?.();
        render();
      } else {
        await runCommand(action);
      }
    },
    destroy() {
      destroyed = true;
      offController();
      offForm();
      actions.destroy();
      element.remove();
    },
  };
}
