<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { AgentInline } from "@plingjs/vue";
import type { Locale } from "../course-workspace/copy";
import { COURSE_PAGE_COPY } from "./page";
import {
  courseCardOptions,
  courseTeachers,
  createCourseFromDraft,
  emptyCourseDraft,
  initialCourses,
  recommendedCourse,
  type Course,
  type CourseDraft,
} from "./model";
import { COURSE_DEMO_COPY } from "./copy";

const props = withDefaults(
  defineProps<{ locale: Locale; taskPlacement?: "inline" | "none" }>(),
  { taskPlacement: "none" },
);
const page = computed(() => COURSE_PAGE_COPY[props.locale]);
const copy = computed(() => COURSE_DEMO_COPY[props.locale]);
const teachers = courseTeachers(props.locale);
const recommended = recommendedCourse(props.locale, teachers);
const cardOptions = courseCardOptions(props.locale);

const root = ref<HTMLElement | null>(null);
const coverInput = ref<HTMLInputElement | null>(null);
const assistant = ref<{ say(text: string): void } | null>(null);
const courses = ref<Course[]>(initialCourses(props.locale));
const draft = reactive<CourseDraft>(emptyCourseDraft());
const modalOpen = ref(false);
const assistantOpen = ref(true);
const newCourseId = ref("");
const highlightedCourseId = ref("");
const saveError = ref("");
let highlightTimer: ReturnType<typeof setTimeout> | undefined;

const teacherName = computed(() => teachers.find((teacher) => teacher.id === draft.teacherId)?.name ?? "");
const teacherValues = computed(() =>
  teachers.map((teacher) => `${teacher.name}（${teacher.subject}）`).join(props.locale === "zh" ? "；" : "; "),
);
const cardValues = computed(() => cardOptions.join(props.locale === "zh" ? "、" : ", "));
const requiredMissing = computed(() => {
  const missing: string[] = [];
  if (!draft.name.trim()) missing.push(page.value.form.name);
  if (!draft.teacherId) missing.push(page.value.form.teacher);
  if (!draft.cards) missing.push(page.value.form.cards);
  if (!draft.cover) missing.push(page.value.form.cover);
  return missing;
});

/**
 * The form draft is a read-only record: `v-record` publishes the current
 * values, what is required and what is still missing. It creates no actions.
 */
const draftRecord = computed(() => ({
  data: { ...draft },
  id: "course-draft",
  label: copy.value.draftLabel,
  fields: {
    name: draft.name,
    difficulty: draft.difficulty,
    teacher: teacherName.value || draft.teacherId,
    cards: draft.cards,
    intro: draft.intro,
    note: draft.note,
    cover: draft.cover,
    deduct: draft.deduct,
    price: draft.price,
    required: [page.value.form.name, page.value.form.teacher, page.value.form.cards, page.value.form.cover],
    missing: requiredMissing.value,
  },
}));

function setDifficulty(value: number): void {
  draft.difficulty = value;
  saveError.value = "";
}

function setTeacher(value: string): void {
  const teacher = teachers.find((item) => item.name === value);
  draft.teacherId = teacher?.id ?? "";
  draft.teacherName = teacher?.name ?? "";
  saveError.value = "";
}

function handleCoverSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  draft.cover = true;
  saveError.value = "";
}

function openCreate(): void {
  if (newCourseId.value) {
    Object.assign(draft, emptyCourseDraft());
    newCourseId.value = "";
    highlightedCourseId.value = "";
  }
  modalOpen.value = true;
  saveError.value = "";
}

function closeModal(): void {
  modalOpen.value = false;
}

function scrollToNewCourse(): void {
  const id = newCourseId.value;
  if (!id) return;
  highlightedCourseId.value = id;
  void nextTick(() => {
    root.value?.querySelector<HTMLElement>(`[data-course-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => {
      if (highlightedCourseId.value === id) highlightedCourseId.value = "";
    }, 1800);
  });
}

function saveCourse(): { message: string; courseId: string } {
  if (requiredMissing.value.length) {
    const message = copy.value.missing(requiredMissing.value);
    saveError.value = message;
    throw new Error(message);
  }
  const course = createCourseFromDraft(
    props.locale,
    courses.value,
    { ...draft, teacherName: teacherName.value },
    teachers,
  );
  courses.value = [course, ...courses.value];
  newCourseId.value = course.id;
  saveError.value = "";
  // Let the action finish its read-back before the dialog (and this button) unmount.
  setTimeout(() => {
    modalOpen.value = false;
    scrollToNewCourse();
  }, 240);
  return { message: copy.value.saved(course.name), courseId: course.id };
}

const saveTool = computed(() => ({
  id: "save_course",
  kind: "write" as const,
  label: page.value.form.save,
  desc: copy.value.saveDesc,
  run: () => saveCourse(),
  expect: {
    desc: copy.value.saveExpect,
    check: () => courses.value[0]?.id === newCourseId.value,
  },
}));

onMounted(() => {
  void nextTick(() => assistant.value?.say?.(copy.value.greeting));
});
</script>
<template>
  <div
    ref="root"
    class="app-shell"
    :class="{ 'is-assistant-collapsed': !assistantOpen }"
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
          <button
            class="primary-button"
            type="button"
            v-tool="{
              id: 'new_course',
              kind: 'read',
              label: page.newCourse,
              desc: copy.newCourseDesc
            }"
            @click="openCreate"
          >
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
            id: 'course-catalogue',
            label: page.listLabel,
            description: copy.catalogueScope,
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
                teacher: course.teacher,
                cards: course.cards,
                difficulty: course.difficulty,
                price: course.price,
                status: course.statusLabel
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

    <aside class="course-assistant" :class="{ 'is-collapsed': !assistantOpen }" aria-label="页灵助手">
      <AgentInline
        ref="assistant"
        class="assistant-agent"
        :title="copy.assistantTitle"
        :placeholder="page.assistant.placeholder"
        :empty-hint="copy.emptyHint"
        :quick="copy.quick"
        :debug="{ maxCalls: 8 }"
        :collapsible="true"
        speakers
        composer="multiline"
        :task-placement="taskPlacement"
        model-settings="readonly"
        :visible="assistantOpen"
        @collapse="assistantOpen = false"
      />
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
          description: copy.formScope,
          role: 'dialog'
        }"
        v-record="draftRecord"
      >
        <header class="modal-head">
          <div><h2 id="course-modal-title">{{ page.form.title }}</h2><p>{{ copy.formSubtitle }}</p></div>
          <button
            class="modal-close"
            type="button"
            :aria-label="page.form.close"
            v-tool="{
              id: 'close_course_form',
              kind: 'read',
              label: page.form.close,
              desc: copy.closeDesc
            }"
            @click="closeModal"
          >×</button>
        </header>

        <div class="modal-scroll">
          <section class="form-section">
            <div class="form-section__head"><strong>{{ page.form.sectionInfo }}</strong><span>{{ page.form.sectionHint }}</span></div>
            <div class="form-grid">
              <label class="field" data-field="name">
                <span class="field-label">{{ page.form.name }} <em>{{ page.form.required }}</em></span>
                <input
                  v-model="draft.name"
                  :placeholder="recommended.name"
                  @input="saveError = ''"
                  v-tool="{
                    id: 'course_name',
                    action: 'fill',
                    label: page.form.name,
                    desc: copy.fieldDesc.name
                  }"
                />
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
                    v-tool="{
                      id: `course_difficulty_${score}`,
                      kind: 'write',
                      label: `${page.form.difficulty} ${score}`,
                      desc: copy.difficultyDesc(score)
                    }"
                    @click="setDifficulty(score)"
                  >★</button>
                </div>
              </div>

              <label class="field" data-field="teacher">
                <span class="field-label">{{ page.form.teacher }}</span>
                <span class="control-shell">
                  <select
                    :value="draft.teacherName"
                    v-tool="{
                      id: 'course_teacher',
                      action: 'select',
                      label: page.form.teacher,
                      desc: copy.teacherDesc(teacherValues)
                    }"
                    @change="setTeacher(($event.target as HTMLSelectElement).value)"
                  >
                    <option value="">{{ page.form.teacherPlaceholder }}</option>
                    <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.name">{{ teacher.name }} · {{ teacher.subject }}</option>
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
                <select
                  :value="draft.cards"
                  v-tool="{
                    id: 'course_cards',
                    action: 'select',
                    label: page.form.cards,
                    desc: copy.cardsDesc(cardValues)
                  }"
                  @change="draft.cards = ($event.target as HTMLSelectElement).value; saveError = ''"
                >
                  <option value="">{{ page.form.cardsPlaceholder }}</option>
                  <option v-for="option in cardOptions" :key="option" :value="option">{{ option }}</option>
                </select>
              </label>

              <label class="field" data-field="intro">
                <span class="field-label">{{ page.form.intro }}</span>
                <textarea
                  v-model="draft.intro"
                  :placeholder="page.form.introPlaceholder"
                  maxlength="200"
                  @input="saveError = ''"
                  v-tool="{
                    id: 'course_intro',
                    action: 'fill',
                    label: page.form.intro,
                    desc: copy.fieldDesc.intro
                  }"
                />
                <small class="field-count">{{ draft.intro.length }} / 200</small>
              </label>

              <label class="field" data-field="note">
                <span class="field-label">{{ page.form.note }}</span>
                <textarea
                  v-model="draft.note"
                  :placeholder="page.form.notePlaceholder"
                  maxlength="200"
                  @input="saveError = ''"
                  v-tool="{
                    id: 'course_note',
                    action: 'fill',
                    label: page.form.note,
                    desc: copy.fieldDesc.note
                  }"
                />
                <small class="field-count">{{ draft.note.length }} / 200</small>
              </label>

              <div class="field" data-field="cover">
                <span class="field-label">{{ page.form.cover }}</span>
                <button
                  class="upload-tile"
                  :class="{ 'is-uploaded': draft.cover }"
                  type="button"
                  v-tool="{
                    id: 'course_cover',
                    kind: 'write',
                    label: page.form.cover,
                    desc: copy.coverDesc,
                    handoff: {
                      reason: copy.coverHandoff,
                      expect: { desc: copy.coverExpect, check: () => draft.cover }
                    }
                  }"
                  @click="coverInput?.click()"
                >
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
                <span class="number-shell">
                  <input
                    v-model="draft.deduct"
                    v-tool="{
                      id: 'course_deduct',
                      action: 'fill',
                      label: page.form.deduct,
                      desc: copy.fieldDesc.deduct
                    }"
                    @input="saveError = ''"
                  />
                  <span>{{ page.form.deductUnit }}</span>
                </span>
              </label>
              <label class="field" data-field="price">
                <span class="field-label">{{ page.form.price }} <span class="help-dot">?</span></span>
                <span class="number-shell">
                  <input
                    v-model="draft.price"
                    :placeholder="page.form.pricePlaceholder"
                    v-tool="{
                      id: 'course_price',
                      action: 'fill',
                      label: page.form.price,
                      desc: copy.fieldDesc.price
                    }"
                    @input="saveError = ''"
                  />
                  <span>{{ page.form.priceUnit }}</span>
                </span>
              </label>
            </div>
          </section>
        </div>

        <footer class="modal-foot">
          <span v-if="saveError" class="form-error" role="status">{{ saveError }}</span>
          <button class="secondary-button" type="button" @click="closeModal">{{ page.form.cancel }}</button>
          <button
            class="primary-button save-button"
            type="button"
            v-tool="saveTool"
            @click="saveCourse"
          >
            {{ page.form.save }}
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.form-error {
  margin-right: auto;
  align-self: center;
  color: #b42318;
  font-size: 12px;
  line-height: 1.45;
}
</style>
