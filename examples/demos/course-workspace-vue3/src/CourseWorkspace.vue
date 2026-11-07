<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from "vue";
import { createPolicy, createExecutor } from "@plingjs/core";
import { createTaskController, defaultSettle, type ActiveGuidedTask, type TaskRunSnapshot } from "@plingjs/agent";
import { AgentGuideActions, AgentInline, useAgentState, usePling } from "@plingjs/vue";
import type { GuideActionItem } from "@plingjs/vue";
import type { TaskGuideCommand } from "@plingjs/agent";
import type { Locale } from "../../../shared/course-workspace/copy";
import { COURSE_CREATE_COPY } from "../../../shared/course-create/copy";
import { COURSE_PAGE_COPY } from "../../../shared/course-create/page";
import {
  courseCreateFieldNodes,
  createCourseGuideDefinition,
  type CourseFieldNode,
} from "../../../shared/course-create/guide";
import {
  courseCardOptions,
  courseTeachers,
  createCourseFromDraft,
  emptyCourseDraft,
  initialCourses,
  recommendedCourse,
  type Course,
  type CourseDraft,
} from "../../../shared/course-create/model";
import {
  composeCourseIntakeReply,
  parseCourseIntake,
  shouldUseAgent,
  type CourseIntakeResult,
  type CourseIntakePatch,
} from "../../../shared/course-create/intake";
import {
  createCourseTaskDefinition,
  registerCourseCreateActions,
  type CourseTaskOptions,
} from "../../../shared/course-create/task";

const props = defineProps<{ locale: Locale }>();
const pling = usePling();
const page = computed(() => COURSE_PAGE_COPY[props.locale]);
const createCopy = computed(() => COURSE_CREATE_COPY[props.locale]);
const teachers = courseTeachers(props.locale);
const recommended = recommendedCourse(props.locale, teachers);
const cardOptions = courseCardOptions(props.locale);

const root = ref<HTMLElement | null>(null);
const agent = ref<{ send(text: string): Promise<void>; say(text: string): void } | null>(null);
const coverInput = ref<HTMLInputElement | null>(null);
const saveButton = ref<HTMLButtonElement | null>(null);

const courses = ref<Course[]>(initialCourses(props.locale));
const draft = reactive<CourseDraft>(emptyCourseDraft());
const modalOpen = ref(true);
const assistantOpen = ref(true);
const taskMenuOpen = ref(false);
const step = computed(() => stepFromDraft());
const busy = ref(false);
const taskError = ref("");
const reviewOpen = ref(false);
const taskSnapshot = shallowRef<TaskRunSnapshot | null>(null);
const newCourseId = ref("");
const highlightedCourseId = ref("");
const focusedField = ref("");
const skippedFields = ref<string[]>([]);
let highlightTimer: ReturnType<typeof setTimeout> | undefined;
let highlightedFields: HTMLElement[] = [];

const completed = computed(() => taskSnapshot.value?.status === "done");
const guideDefinition = createCourseGuideDefinition({
  locale: props.locale,
  teachers,
  readDraft: () => draft,
  readSkipped: () => skippedFields.value,
});
const guideField = computed<CourseFieldNode | undefined>(() => {
  const nodes = courseCreateFieldNodes(props.locale, draft, teachers, skippedFields.value);
  const focused = focusedField.value
    ? nodes.find((field) => field.field === focusedField.value)
    : undefined;
  if (focused && !focused.filled && !focused.skipped) return focused;
  // Required gaps drive the conversation. Optional fields are still reachable
  // from the guide, but they must not jump ahead of the cover or become the
  // default next question.
  return (
    nodes.find((node) => node.required && !node.filled && !node.skipped) ??
    nodes.find((node) => !node.filled && !node.skipped)
  );
});
const requiredComplete = computed(() =>
  courseCreateFieldNodes(props.locale, draft, teachers, skippedFields.value).every((field) => !field.required || field.filled || field.skipped),
);

/** One full accessible name per suggestion, with locale-appropriate punctuation. */
function suggestionLabel(use: string, field: string, suggestion: string): string {
  return props.locale === "zh" ? `${use}${field}：${suggestion}` : `${use} ${field}: ${suggestion}`;
}

const guideActions = computed<GuideActionItem[]>(() => {
  if (completed.value) {
    return [
      { id: "view-course", label: createCopy.value.done.view, command: "view-course", kind: "primary" },
      { id: "restart", label: createCopy.value.done.restart, command: "restart" },
    ];
  }
  if (reviewOpen.value && requiredComplete.value) {
    return [
      { id: "save", label: createCopy.value.review.confirm, command: "save-course", kind: "primary", disabled: busy.value },
      { id: "continue", label: createCopy.value.review.continue, command: "resume-editing", disabled: busy.value },
    ];
  }
  const field = guideField.value;
  if (!field) {
    return [
      { id: "review", label: createCopy.value.review.primary, command: "start-review", kind: "primary", disabled: busy.value },
      { id: "save-location", label: createCopy.value.review.secondary, command: "focus-save", disabled: busy.value },
    ];
  }
  const items: GuideActionItem[] = [
    field.field === "cover"
      ? { id: "pick-cover", label: createCopy.value.cover.upload, command: "pick-cover", kind: "primary", disabled: busy.value }
      : { id: "locate", label: `${createCopy.value.row.locate} · ${field.label}`, command: "locate-field", kind: "primary", disabled: busy.value },
  ];
  if (field.suggestion && field.field !== "cover") {
    items.push({
      id: "use-suggestion",
      label: createCopy.value.row.use,
      preview: field.suggestion,
      ariaLabel: suggestionLabel(createCopy.value.row.use, field.label, field.suggestion),
      command: "use-suggestion",
      kind: "suggestion",
      disabled: busy.value,
    });
  }
  if (!field.required) {
    items.push({ id: "skip", label: createCopy.value.row.skip, command: "skip-field", kind: "skip", disabled: busy.value });
  }
  if (requiredComplete.value) {
    items.push({ id: "review", label: createCopy.value.review.primary, command: "start-review", disabled: busy.value });
  }
  return items;
});

function onGuideCommand(command: string): void {
  const field = guideField.value;
  if (command === "view-course") viewNewCourse();
  else if (command === "restart") resetDemo();
  else if (command === "save-course") void saveCourse();
  else if (command === "resume-editing") resumeEditing();
  else if (command === "pick-cover") void pickCover();
  else if (command === "locate-field" && field) locateField(field);
  else if (command === "use-suggestion" && field) useSuggestion(field);
  else if (command === "skip-field" && field) skipField(field);
  else if (command === "start-review") startReview();
  else if (command === "focus-save") focusSave();
}

const emptyHint = computed(() => (completed.value ? createCopy.value.hint.completed : createCopy.value.chatEmpty));

watch(
  () => draft.cover,
  (cover, previous) => {
    if (!cover || previous || !requiredComplete.value) return;
    reviewOpen.value = true;
    agent.value?.say(reviewSummary());
  },
);

const taskOptions: CourseTaskOptions = {
  locale: props.locale,
  teachers,
  recommended,
  cardOptions,
  createCourse(next) {
    const course = createCourseFromDraft(props.locale, courses.value, next, teachers);
    courses.value = [course, ...courses.value];
    newCourseId.value = course.id;
    return course;
  },
};

const executor = createExecutor({
  registry: pling.registry,
  policy: createPolicy(async () => true),
  settle: defaultSettle,
});
const controller = createTaskController({
  invoke: (action, args) => executor.execute(action, JSON.stringify(args)),
});
let offTask: (() => void) | null = null;
let offGuidedTask: (() => void) | null = null;
let offActions: Array<() => void> = [];
const offSnapshot = controller.subscribe((snapshot) => {
  taskSnapshot.value = snapshot;
  const changed = applyTaskValues(snapshot?.values);
  if (changed.length) {
    taskError.value = "";
    markEdited();
    void nextTick(() => flashFields(changed, "is-guided", 1800));
  }
});

useAgentState(
  "course-catalogue",
  () => ({
    courses: courses.value.map((course) => ({
      id: course.id,
      name: course.name,
      teacher: course.teacher,
      cards: course.cards,
      price: course.price,
      status: course.status,
    })),
    teachers: teachers.map((teacher) => ({ id: teacher.id, name: teacher.name, subject: teacher.subject })),
  }),
  {
    description: props.locale === "zh" ? "当前课程库与可选择的授课老师" : "The current course catalogue and available teachers",
  },
);

function syncTaskValues(): void {
  const status = controller.snapshot()?.status;
  if (!status || status === "done" || status === "failed" || status === "cancelled") return;
  const values = {
    name: draft.name.trim(),
    teacherId: draft.teacherId,
    cards: draft.cards,
    difficulty: draft.difficulty,
    intro: draft.intro,
    note: draft.note,
    deduct: draft.deduct,
    price: draft.price,
    // An unuploaded cover is missing, not a completed `false` decision.
    cover: draft.cover ? true : undefined,
  };
  try {
    for (const [name, value] of Object.entries(values)) controller.setValue(name, value);
    taskSnapshot.value = controller.snapshot();
  } catch {
    // The run may already be past the field-collection state. The page is still the source of truth.
  }
}

function currentTaskValues() {
  return {
    name: draft.name.trim(),
    teacherId: draft.teacherId,
    cards: draft.cards,
    difficulty: draft.difficulty,
    intro: draft.intro,
    note: draft.note,
    deduct: draft.deduct,
    price: draft.price,
    cover: draft.cover ? true : undefined,
  };
}

function applyTaskValues(values: TaskRunSnapshot["values"] | undefined): string[] {
  if (!values) return [];
  const changed: string[] = [];
  const text = (name: string, current: string): string => {
    if (!(name in values)) return current;
    const next = String(values[name] ?? "");
    if (next === current) return current;
    changed.push(name);
    return next;
  };

  draft.name = text("name", draft.name);
  draft.cards = text("cards", draft.cards);
  draft.intro = text("intro", draft.intro);
  draft.note = text("note", draft.note);
  draft.deduct = text("deduct", draft.deduct);
  draft.price = text("price", draft.price);

  if ("teacherId" in values) {
    const next = String(values.teacherId ?? "");
    if (next !== draft.teacherId) {
      draft.teacherId = next;
      draft.teacherName = teachers.find((teacher) => teacher.id === next)?.name ?? "";
      changed.push("teacher");
    }
  }

  if ("difficulty" in values) {
    const next = Number(values.difficulty) || 0;
    if (next !== draft.difficulty) {
      draft.difficulty = next;
      changed.push("difficulty");
    }
  }

  if ("cover" in values) {
    const next = Boolean(values.cover);
    if (next !== draft.cover) {
      draft.cover = next;
      changed.push("cover");
    }
  }
  return changed;
}

function applyTaskRunValues(task: ActiveGuidedTask): void {
  applyTaskValues(task.state.snapshot?.values);
}

function fieldElement(name: string): HTMLElement | null {
  return root.value?.querySelector<HTMLElement>(`[data-field="${name}"]`) ?? null;
}

function flashFields(names: readonly string[], mode: "is-guided" | "is-pointed" = "is-guided", duration = 1800): void {
  clearTimeout(highlightTimer);
  for (const field of highlightedFields) field.classList.remove("is-guided", "is-pointed");
  const fields = names.map(fieldElement).filter((field): field is HTMLElement => Boolean(field));
  highlightedFields = fields;
  for (const field of fields) {
    field.classList.remove("is-guided", "is-pointed");
    // Restart the pulse even when the same field is located twice in a row.
    void field.offsetWidth;
    field.classList.add(mode);
  }
  const first = fields[0];
  if (first) {
    const scroller = first.closest<HTMLElement>(".modal-scroll");
    if (scroller) {
      const scrollerBox = scroller.getBoundingClientRect();
      const fieldBox = first.getBoundingClientRect();
      const top = scroller.scrollTop + fieldBox.top - scrollerBox.top - (scroller.clientHeight - fieldBox.height) / 2;
      scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    } else {
      first.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  highlightTimer = setTimeout(() => {
    for (const field of fields) field.classList.remove(mode);
    if (highlightedFields === fields) highlightedFields = [];
  }, duration);
}

async function focusFields(
  names: readonly string[],
  mode: "is-guided" | "is-pointed" = "is-pointed",
  duration = 1800,
): Promise<void> {
  modalOpen.value = true;
  await nextTick();
  flashFields(names, mode, duration);
  const target = names.map(fieldElement).find((field): field is HTMLElement => Boolean(field));
  const control = target?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select, button");
  control?.focus({ preventScroll: true });
}

function focusSave(): void {
  modalOpen.value = true;
  void nextTick(() => {
    clearTimeout(highlightTimer);
    for (const field of highlightedFields) field.classList.remove("is-guided", "is-pointed");
    highlightedFields = [];
    saveButton.value?.classList.add("is-guided");
    saveButton.value?.scrollIntoView({ behavior: "smooth", block: "center" });
    highlightTimer = setTimeout(() => saveButton.value?.classList.remove("is-guided"), 1800);
  });
}

function useSuggestion(field: CourseFieldNode): void {
  applyField(field.field);
  focusedField.value = "";
}

function skipField(field: CourseFieldNode): void {
  if (!skippedFields.value.includes(field.field)) {
    skippedFields.value = [...skippedFields.value, field.field];
  }
  focusedField.value = "";
  markEdited();
  syncTaskValues();
}

function markEdited(): void {
  if (!completed.value) reviewOpen.value = false;
}

function locateField(field: CourseFieldNode): void {
  focusedField.value = field.field;
  void focusFields([field.field], "is-pointed", 3200);
}

function setDifficulty(value: number): void {
  draft.difficulty = value;
  markEdited();
  syncTaskValues();
}

function setTeacher(value: string): void {
  draft.teacherId = value;
  draft.teacherName = teachers.find((teacher) => teacher.id === value)?.name ?? "";
  markEdited();
  syncTaskValues();
}

function onFormInput(): void {
  markEdited();
  syncTaskValues();
}

function stepFromDraft(): number {
  const nodes = courseCreateFieldNodes(props.locale, draft, teachers, skippedFields.value);
  const next = nodes.findIndex((field) => !field.filled && !field.skipped);
  if (next < 0) return 4;
  if (next <= 2) return 1;
  if (next <= 5) return 2;
  if (next === 6) return 3;
  return 4;
}

function applyBasics(): void {
  if (!draft.name.trim()) draft.name = recommended.name;
  if (!draft.difficulty) draft.difficulty = recommended.difficulty;
  if (!draft.intro.trim()) draft.intro = recommended.intro;
  taskError.value = "";
  markEdited();
  syncTaskValues();
  void focusFields(["name", "difficulty", "intro"], "is-guided");
}

function applyTeaching(): void {
  if (!draft.teacherId) {
    draft.teacherId = recommended.teacherId;
    draft.teacherName = recommended.teacherName;
  }
  if (!draft.cards.trim()) draft.cards = recommended.cards;
  if (!draft.note.trim()) draft.note = recommended.note;
  if (!draft.deduct) draft.deduct = recommended.deduct;
  if (!draft.price) draft.price = recommended.price;
  taskError.value = "";
  markEdited();
  syncTaskValues();
  void focusFields(["teacher", "cards", "note"], "is-guided");
}

function applyField(field: string): void {
  switch (field) {
    case "name":
      if (!draft.name.trim()) draft.name = recommended.name;
      break;
    case "difficulty":
      if (!draft.difficulty) draft.difficulty = recommended.difficulty;
      break;
    case "intro":
      if (!draft.intro.trim()) draft.intro = recommended.intro;
      break;
    case "teacher":
      if (!draft.teacherId) {
        draft.teacherId = recommended.teacherId;
        draft.teacherName = recommended.teacherName;
      }
      break;
    case "cards":
      if (!draft.cards.trim()) draft.cards = recommended.cards;
      break;
    case "note":
      if (!draft.note.trim()) draft.note = recommended.note;
      break;
    case "deduct":
      if (!draft.deduct) draft.deduct = recommended.deduct;
      break;
    case "price":
      if (!draft.price) draft.price = recommended.price;
      break;
  }
  taskError.value = "";
  markEdited();
  syncTaskValues();
  void focusFields([field], "is-guided");
}

function locateCover(): void {
  focusedField.value = "cover";
  void focusFields(["cover"], "is-pointed", 3200);
}

async function pickCover(): Promise<void> {
  focusedField.value = "cover";
  await focusFields(["cover"], "is-pointed", 3200);
  coverInput.value?.click();
}

function checkCover(): void {
  if (!draft.cover) {
    taskError.value = createCopy.value.cover.missing;
    return;
  }
  taskError.value = "";
}

function handleCoverSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  draft.cover = true;
  taskError.value = "";
  markEdited();
  syncTaskValues();
}

function reviewSummary(): string {
  const form = page.value.form;
  const separator = props.locale === "zh" ? "：" : ": ";
  const teacher = teachers.find((item) => item.id === draft.teacherId)?.name ?? "—";
  const difficulty = draft.difficulty || recommended.difficulty;
  const deduct = draft.deduct || recommended.deduct;
  const price = draft.price || recommended.price;
  const intro = draft.intro.trim();
  const rows = [
    `- ${form.name}${separator}${draft.name.trim() || "—"}`,
    `- ${form.teacher}${separator}${teacher}`,
    `- ${form.difficulty}${separator}${props.locale === "zh" ? `${difficulty} 星` : `${difficulty} stars`}`,
    `- ${form.cards}${separator}${draft.cards.trim() || "—"}`,
    `- ${form.deduct} / ${form.price}${separator}${deduct}${props.locale === "zh" ? " 次" : ""} · ¥${price}`,
    `- ${form.cover}${separator}${createCopy.value.review.coverYes}`,
    ...(intro ? [`- ${form.intro}${separator}${intro.length > 48 ? `${intro.slice(0, 48)}…` : intro}`] : []),
    ...(draft.note.trim() ? [`- ${form.note}${separator}${draft.note.trim()}`] : []),
  ];
  return `${createCopy.value.review.title}\n${rows.join("\n")}\n${createCopy.value.review.confirmHint}`;
}

function startReview(announce = true): void {
  if (!requiredComplete.value) {
    if (announce) agent.value?.say(missingReply());
    return;
  }
  reviewOpen.value = true;
  if (announce) agent.value?.say(reviewSummary());
}

function resumeEditing(): void {
  reviewOpen.value = false;
  agent.value?.say(createCopy.value.review.continueHint);
}

function applyIntakePatch(patch: CourseIntakePatch): CourseFieldNode["field"][] {
  const changed: CourseFieldNode["field"][] = [];
  if (patch.name !== undefined) {
    draft.name = patch.name;
    changed.push("name");
  }
  if (patch.teacherId !== undefined) {
    draft.teacherId = patch.teacherId;
    draft.teacherName = patch.teacherName ?? teachers.find((teacher) => teacher.id === patch.teacherId)?.name ?? "";
    changed.push("teacher");
  }
  if (patch.cards !== undefined) {
    draft.cards = patch.cards;
    changed.push("cards");
  }
  if (patch.difficulty !== undefined) {
    draft.difficulty = patch.difficulty;
    changed.push("difficulty");
  }
  if (patch.intro !== undefined) {
    draft.intro = patch.intro;
    changed.push("intro");
  }
  if (patch.note !== undefined) {
    draft.note = patch.note;
    changed.push("note");
  }
  if (patch.deduct !== undefined) {
    draft.deduct = patch.deduct;
    changed.push("deduct");
  }
  if (patch.price !== undefined) {
    draft.price = patch.price;
    changed.push("price");
  }
  if (changed.length) {
    taskError.value = "";
    markEdited();
    syncTaskValues();
    void nextTick(() => flashFields(changed, "is-guided", 1800));
  }
  return changed;
}

function missingReply(): string {
  const result = parseCourseIntake(props.locale === "zh" ? "还差什么？" : "What is missing?", {
    locale: props.locale,
    teachers,
    recommended,
    cardOptions,
  });
  return composeCourseIntakeReply({
    locale: props.locale,
    draft,
    result,
    teachers,
    recommended,
    cardOptions,
  });
}

function locateNextGap(result: CourseIntakeResult): void {
  if (requiredComplete.value) return;
  const nodes = courseCreateFieldNodes(props.locale, draft, teachers, skippedFields.value);
  const teacherProblem = result.unknownTeacher || result.ambiguousTeachers?.length;
  const gap = teacherProblem
    ? nodes.find((field) => field.field === "teacher")
    : result.invalidDifficulty
      ? nodes.find((field) => field.field === "difficulty")
      : nodes.find((field) => field.required && !field.filled && !field.skipped);
  if (!gap) return;
  focusedField.value = gap.field;
  modalOpen.value = true;
  void nextTick(() => flashFields([gap.field], "is-pointed", 3200));
}

async function handleBeforeSend(text: string): Promise<{ handled: boolean; reply?: string } | undefined> {
  const result = parseCourseIntake(text, {
    locale: props.locale,
    teachers,
    recommended,
    cardOptions,
    // A standalone “孕妇瑜伽” is a valid answer only while the page is
    // actually asking for the course name. Questions such as “你会做什么”
    // are still guarded by the parser's question intent.
    expects: guideField.value?.field === "name" ? "name" : undefined,
  });

  // The page only short-circuits explicit commands and values it fully
  // understood. Questions, help, vague corrections and delegated choices go to
  // the model, which reads the same task state as working memory. This is the
  // important boundary: the form is not a script pretending to be a chat.
  if (shouldUseAgent(result)) return undefined;

  if (result.wantsCancel) {
    modalOpen.value = false;
    pling.task.deactivate();
    reviewOpen.value = false;
    return { handled: true, reply: createCopy.value.cancelled };
  }

  if (result.wantsCreate) {
    if (completed.value) resetDemo();
    else openCreate();
  }

  const hasPatch = Object.keys(result.patch).length > 0;
  const hasProblem = Boolean(
    result.unknownTeacher ||
    result.ambiguousTeachers?.length ||
    result.invalidDifficulty,
  );
  if (!hasPatch && !hasProblem && !result.correction && !result.wantsCreate && !result.wantsReview && !result.wantsSave && !result.wantsStatus && !result.wantsHelp && !result.question) {
    return undefined;
  }

  if (hasPatch) applyIntakePatch(result.patch);
  await nextTick();

  const composed = composeCourseIntakeReply({
    locale: props.locale,
    draft,
    result,
    teachers,
    recommended,
    cardOptions,
  });

  if (result.wantsSave) {
    if (!requiredComplete.value) return { handled: true, reply: composed };
    if (!reviewOpen.value) return { handled: true, reply: reviewSummary() };
    const ok = await saveCourse(false);
    return { handled: true, reply: ok ? createCopy.value.done.description : taskError.value };
  }

  if (result.wantsReview) {
    if (!requiredComplete.value || hasProblem) return { handled: true, reply: composed };
    reviewOpen.value = true;
    return { handled: true, reply: reviewSummary() };
  }

  if (result.correction && !hasPatch && !hasProblem) {
    return { handled: true, reply: composed };
  }

  if (hasProblem) {
    locateNextGap(result);
    return { handled: true, reply: composed };
  }

  if (requiredComplete.value) {
    reviewOpen.value = true;
    return { handled: true, reply: reviewSummary() };
  }

  if (result.wantsCreate && !hasPatch) {
    await nextTick();
    locateNextGap(result);
    return { handled: true, reply: createCopy.value.chatEmpty };
  }

  if (hasPatch || hasProblem || result.wantsStatus) locateNextGap(result);

  return {
    handled: true,
    reply: composed,
  };
}

function openCreate(): void {
  if (completed.value) {
    resetDemo();
    return;
  }
  modalOpen.value = true;
  void nextTick(() => {
    if (!pling.task.active()) pling.task.activate("course.create");
    syncTaskValues();
  });
}

function openTaskFromMenu(): void {
  taskMenuOpen.value = false;
  openCreate();
}

function closeModal(): void {
  modalOpen.value = false;
}

async function saveCourse(announce = true): Promise<boolean> {
  if (busy.value || completed.value) return completed.value;
  syncTaskValues();
  if (!draft.name.trim() || !draft.teacherId || !draft.cards.trim()) {
    taskError.value = page.value.messages.missing;
    modalOpen.value = true;
    if (announce) agent.value?.say(taskError.value);
    return false;
  }
  if (!draft.cover) {
    taskError.value = createCopy.value.cover.missing;
    modalOpen.value = true;
    if (announce) agent.value?.say(taskError.value);
    return false;
  }

  busy.value = true;
  taskError.value = "";
  focusSave();
  const result = await controller.run();
  taskSnapshot.value = result;
  busy.value = false;

  if (result.status === "done" && newCourseId.value && courses.value[0]?.id === newCourseId.value) {
    modalOpen.value = false;
    taskError.value = "";
    reviewOpen.value = false;
    if (announce) agent.value?.say(createCopy.value.done.description);
    return true;
  }

  taskError.value = result.error?.message || createCopy.value.error;
  if (announce) agent.value?.say(taskError.value);
  return false;
}

function viewNewCourse(): void {
  const id = newCourseId.value;
  if (!id) return;
  highlightedCourseId.value = id;
  void nextTick(() => {
    root.value?.querySelector<HTMLElement>(`[data-course-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      if (highlightedCourseId.value === id) highlightedCourseId.value = "";
    }, 1800);
  });
}

function resetDemo(): void {
  clearTimeout(highlightTimer);
  Object.assign(draft, emptyCourseDraft());
  courses.value = initialCourses(props.locale);
  modalOpen.value = true;
  focusedField.value = "";
  skippedFields.value = [];
  busy.value = false;
  reviewOpen.value = false;
  taskError.value = "";
  newCourseId.value = "";
  highlightedCourseId.value = "";
  controller.reset();
  pling.task.activate("course.create");
  void nextTick(() => {
    setTimeout(() => flashFields(["name"], "is-pointed"), 450);
  });
}

async function onCommand(command: TaskGuideCommand): Promise<void> {
  switch (command.action.command) {
    case "apply-basics":
      applyBasics();
      break;
    case "focus-basics":
      focusedField.value = "name";
      await focusFields(["name", "difficulty", "intro"]);
      break;
    case "apply-teaching":
      applyTeaching();
      break;
    case "focus-teaching":
      focusedField.value = "teacher";
      await focusFields(["teacher", "cards", "note"]);
      break;
    case "focus-cover":
      focusedField.value = "cover";
      locateCover();
      break;
    case "check-cover":
      checkCover();
      break;
    case "save-course":
      await saveCourse();
      break;
    case "focus-save":
      focusedField.value = "";
      focusSave();
      break;
    case "view-course":
      viewNewCourse();
      break;
    case "restart":
      resetDemo();
      break;
    case "cancel-task":
      taskMenuOpen.value = false;
      taskError.value = "";
      pling.task.deactivate();
      break;
    default:
      if (command.action.command.startsWith("apply-")) {
        applyField(command.action.command.slice("apply-".length));
      } else if (command.action.command.startsWith("focus-")) {
        focusedField.value = command.action.command.slice("focus-".length);
        skippedFields.value = skippedFields.value.filter((field) => field !== focusedField.value);
        syncTaskValues();
        await focusFields([focusedField.value]);
      }
  }
}

onMounted(() => {
  offGuidedTask = pling.task.define({
    definition: createCourseTaskDefinition(taskOptions),
    guide: guideDefinition,
    controller,
    scope: "create-course-form",
    autoStart: true,
    keepActive: true,
    initialValues: currentTaskValues,
    state: () => ({
      snapshot: taskSnapshot.value,
      step: step.value,
      busy: busy.value,
      error: taskError.value,
      completed: completed.value,
    }),
    onActivate: (task) => {
      applyTaskRunValues(task);
      modalOpen.value = true;
      void nextTick(() => {
        syncTaskValues();
        setTimeout(() => flashFields(["name"], "is-pointed"), 450);
      });
    },
    onCommand,
  });
  offActions = registerCourseCreateActions(
    { registry: pling.registry, warn: (message) => console.warn(message) },
    taskOptions,
  );
  offTask = pling.task.register({
    id: "course-create-demo",
    ask: async (prompt) => {
      await agent.value?.send(prompt);
    },
  });
  void nextTick(() => agent.value?.say(createCopy.value.chatEmpty));
});

onBeforeUnmount(() => {
  clearTimeout(highlightTimer);
  for (const field of highlightedFields) field.classList.remove("is-guided", "is-pointed");
  highlightedFields = [];
  offTask?.();
  offGuidedTask?.();
  for (const off of offActions) off();
  offActions = [];
  offSnapshot();
  controller.reset();
});
</script>

<template>
  <div
    ref="root"
    class="app-shell"
    :class="{ 'is-assistant-collapsed': !assistantOpen }"
    @click="taskMenuOpen = false"
  >
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M8 22c0-9 6.4-14 17-14-1.2 10.1-7.4 16-17 16Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
            <path d="M8 24c4.8-5.3 9.8-8.4 14.8-10.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </span>
        <span>{{ page.brand }}</span>
      </div>

      <nav class="nav" aria-label="主导航">
        <button class="nav-item" type="button"><span class="nav-icon">⌂</span>{{ page.navHome }}</button>
        <template v-for="group in page.navGroups" :key="group.title">
          <p class="nav-group">{{ group.title }}</p>
          <button
            v-for="item in group.items"
            :key="item"
            class="nav-item"
            :class="{ 'is-active': item === page.navGroups[1]?.items[0] }"
            type="button"
          >
            <span class="nav-icon">{{ item === page.navGroups[1]?.items[0] ? '▤' : '·' }}</span>{{ item }}
          </button>
        </template>
      </nav>

      <div class="sidebar-foot">
        <span class="store-avatar">冰</span>
        <div><strong>{{ page.storeName }}</strong><span>{{ page.storeLocation }}</span></div>
      </div>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div class="breadcrumb">
          <template v-for="(crumb, index) in page.breadcrumb" :key="crumb">
            <span v-if="index" aria-hidden="true">/</span>
            <strong v-if="index === page.breadcrumb.length - 1">{{ crumb }}</strong>
            <span v-else>{{ crumb }}</span>
          </template>
        </div>
        <div class="top-actions">
          <button type="button" class="ghost-button">{{ props.locale === 'zh' ? '帮助文档' : 'Help' }}</button>
          <button type="button" class="ghost-button">{{ props.locale === 'zh' ? '导出数据' : 'Export' }}</button>
          <span class="user-avatar">冰</span>
        </div>
      </header>

      <main class="page-content">
        <div class="page-head">
          <div>
            <p class="eyebrow">{{ page.eyebrow }}</p>
            <h1>{{ page.title }}</h1>
            <p class="page-lead">{{ page.lead }}</p>
          </div>
          <button class="primary-button" type="button" @click="openCreate">
            <span>＋</span>{{ page.newCourse }}
          </button>
        </div>

        <div class="stat-row">
          <div v-for="stat in page.stats" :key="stat.label" class="stat">
            <strong>{{ stat.value }}</strong><span>{{ stat.label }}</span>
          </div>
        </div>

        <section
          class="course-list"
          :aria-label="page.listLabel"
          v-scope="{
            id: 'course-list',
            label: page.listLabel,
            description: props.locale === 'zh' ? '当前门店的课程库' : 'The current course catalogue',
            role: 'main'
          }"
        >
          <article
            v-for="course in courses"
            :key="course.id"
            class="course-card"
            :class="{ 'is-new': course.id === newCourseId, 'is-highlighted': course.id === highlightedCourseId }"
            :data-course-id="course.id"
            v-record="{
              data: course,
              label: course.name,
              fields: {
                name: course.name,
                teacher: course.teacher,
                cards: course.cards,
                difficulty: course.difficulty,
                price: course.price
              }
            }"
          >
            <div class="course-cover" :class="`cover-${course.cover}`"><span>{{ course.coverLabel }}</span></div>
            <div class="course-card__body">
              <div class="course-card__top">
                <h2>{{ course.name }}</h2>
                <span class="status-pill" :class="{ 'is-draft': course.status === 'draft' }">{{ course.statusLabel }}</span>
              </div>
              <p>{{ [course.teacher, course.cards].filter(Boolean).join(' · ') }}</p>
              <div class="course-meta">
                <span>★ {{ course.rating }}</span><span>扣 {{ course.deduct }} 次</span><span>¥{{ course.price }} / 节</span>
              </div>
            </div>
          </article>
        </section>
      </main>
    </section>

    <aside class="assistant" :class="{ 'is-collapsed': !assistantOpen }" aria-label="页灵助手">
      <AgentInline
        ref="agent"
        class="assistant-agent"
        :title="createCopy.assistantTitle"
        :placeholder="page.assistant.placeholder"
        :empty-hint="emptyHint"
        :debug="{ maxCalls: 8 }"
        :collapsible="true"
        speakers
        composer="multiline"
        task-placement="none"
        guide-placement="end"
        model-settings="readonly"
        :visible="assistantOpen"
        @collapse="assistantOpen = false"
        :before-send="handleBeforeSend"
      >
        <template #guide>
          <AgentGuideActions
            :items="guideActions"
            :hint="reviewOpen && requiredComplete ? createCopy.review.title : ''"
            :aria-label="createCopy.assistantTitle"
            @command="onGuideCommand"
          />
        </template>
        <template #nav-actions>
          <div class="task-menu-wrap" @click.stop>
            <button
              type="button"
              class="dock__ghost task-menu-toggle"
              :class="{ 'is-active': taskMenuOpen }"
              :aria-expanded="taskMenuOpen"
              :aria-label="createCopy.taskMenu"
              :title="createCopy.taskMenu"
              @click="taskMenuOpen = !taskMenuOpen"
            >
              <svg class="dock__icon" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M4 5.5h7M4 10h9M4 14.5h5" />
                <path d="m14 11.5 1.5 1.5 2-2" />
              </svg>
            </button>
            <div v-if="taskMenuOpen" class="page-actions" role="menu">
              <header>
                <strong>{{ createCopy.taskMenu }}</strong>
                <span>{{ page.form.title }}</span>
              </header>
              <button type="button" role="menuitem" @click="openTaskFromMenu">
                <span>{{ createCopy.taskCourse }}</span>
                <small>{{ createCopy.task.step }}</small>
              </button>
              <p>{{ createCopy.taskMenuHint }}</p>
            </div>
          </div>
        </template>
      </AgentInline>
    </aside>

    <button
      v-if="!assistantOpen"
      type="button"
      class="assistant-expand"
      aria-label="展开助手面板"
      title="展开助手面板"
      @click.stop="assistantOpen = true"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 5.5 6.5 10 12 14.5" /></svg>
      <span>展开助手</span>
    </button>

    <div v-if="modalOpen" class="modal-layer">
      <div class="modal-shade"></div>
      <section
        class="course-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-modal-title"
        v-scope="{
          id: 'create-course-form',
          label: page.form.title,
          description: props.locale === 'zh' ? '新建课程的原页面表单；聊天只提供建议和定位，不复制字段' : 'The original create-course form; chat only offers suggestions and locations',
          role: 'dialog'
        }"
      >
        <header class="modal-head">
          <div><h2 id="course-modal-title">{{ page.form.title }}</h2><p>{{ page.form.subtitle }}</p></div>
          <button class="modal-close" type="button" :aria-label="page.form.close" @click="closeModal">×</button>
        </header>

        <div class="modal-scroll">
          <section class="form-section">
            <div class="form-section__head"><strong>{{ page.form.sectionInfo }}</strong><span>{{ page.form.sectionHint }}</span></div>
            <div class="form-grid">
              <label class="field" data-field="name">
                <span class="field-label">{{ page.form.name }} <em>{{ page.form.required }}</em></span>
                <input v-model="draft.name" :placeholder="recommended.name" @input="onFormInput" />
              </label>

              <div class="field" data-field="difficulty">
                <span class="field-label">{{ page.form.difficulty }}</span>
                <div class="rating" :aria-label="page.form.difficulty">
                  <button
                    v-for="score in 5"
                    :key="score"
                    type="button"
                    :class="{ 'is-active': draft.difficulty >= score }"
                    :aria-label="`${score} star`"
                    @click="setDifficulty(score)"
                  >★</button>
                </div>
              </div>

              <label class="field" data-field="teacher">
                <span class="field-label">{{ page.form.teacher }}</span>
                <span class="control-shell">
                  <select :value="draft.teacherId" @change="setTeacher(($event.target as HTMLSelectElement).value)">
                    <option value="">{{ page.form.teacherPlaceholder }}</option>
                    <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">{{ teacher.name }} · {{ teacher.subject }}</option>
                  </select>
                  <svg viewBox="0 0 16 16" fill="none"><path d="m4.5 6 3.5 3.5L11.5 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
                </span>
              </label>

              <label class="field">
                <span class="field-label">{{ page.form.tag }}</span>
                <span class="control-shell">
                  <input :value="page.form.tagValue" readonly />
                  <svg viewBox="0 0 16 16" fill="none"><path d="m4.5 6 3.5 3.5L11.5 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
                </span>
              </label>

              <label class="field" data-field="cards">
                <span class="field-label">{{ page.form.cards }} <span class="help-dot">?</span></span>
                <select :value="draft.cards" @change="draft.cards = ($event.target as HTMLSelectElement).value; onFormInput()">
                  <option value="">{{ page.form.cardsPlaceholder }}</option>
                  <option v-for="option in cardOptions" :key="option" :value="option">{{ option }}</option>
                </select>
              </label>

              <label class="field" data-field="intro">
                <span class="field-label">{{ page.form.intro }}</span>
                <textarea v-model="draft.intro" :placeholder="page.form.introPlaceholder" maxlength="200" @input="onFormInput" />
                <small class="field-count">{{ draft.intro.length }} / 200</small>
              </label>

              <label class="field" data-field="note">
                <span class="field-label">{{ page.form.note }}</span>
                <textarea v-model="draft.note" :placeholder="page.form.notePlaceholder" maxlength="200" @input="onFormInput" />
                <small class="field-count">{{ draft.note.length }} / 200</small>
              </label>

              <div class="field" data-field="cover">
                <span class="field-label">{{ page.form.cover }}</span>
                <button class="upload-tile" :class="{ 'is-uploaded': draft.cover }" type="button" @click="coverInput?.click()">
                  <span class="upload-icon">＋</span>
                  <span class="upload-label">{{ page.form.upload }}</span>
                  <span class="upload-preview" aria-hidden="true"></span>
                  <span class="upload-done">{{ page.form.uploaded }}</span>
                </button>
                <input ref="coverInput" class="visually-hidden" type="file" accept="image/*" @change="handleCoverSelected" />
              </div>
            </div>
          </section>

          <section class="form-section template-section">
            <div class="form-section__head"><strong>{{ page.form.sectionTemplate }}</strong><span>{{ page.form.sectionTemplateHint }}</span></div>
            <div class="form-grid template-grid">
              <label class="field" data-field="deduct">
                <span class="field-label">{{ page.form.deduct }} <span class="help-dot">?</span></span>
                <span class="number-shell"><input v-model="draft.deduct" @input="onFormInput" /><span>{{ page.form.deductUnit }}</span></span>
              </label>
              <label class="field" data-field="price">
                <span class="field-label">{{ page.form.price }} <span class="help-dot">?</span></span>
                <span class="number-shell"><input v-model="draft.price" :placeholder="page.form.pricePlaceholder" @input="onFormInput" /><span>{{ page.form.priceUnit }}</span></span>
              </label>
            </div>
          </section>
        </div>

        <footer class="modal-foot">
          <button class="secondary-button" type="button" @click="closeModal">{{ page.form.cancel }}</button>
          <button ref="saveButton" class="primary-button save-button" type="button" :disabled="busy" @click="saveCourse">
            {{ busy ? page.form.saving : page.form.save }}
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>
