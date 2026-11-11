<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from "vue";
import { createMockApi, createSeedWorkspace, type StudentCardsResult, type StudentMatch } from "../src/domain/mock-api";
import { BUSINESS_TIME_ZONE, localDateAt } from "../src/domain/calendar";
import type { CreateCourseInput, CreateLessonInput, WorkspaceData } from "../src/domain/types";

const IntegratedAgent = defineAsyncComponent(() => import("../src/components/IntegratedAgent.vue"));
const props = defineProps<{ integrated: boolean }>();

type Section = "overview" | "courses" | "group-lessons" | "private-lessons" | "teachers" | "students" | "cards" | "bookings" | "no-shows" | "settings";
type CourseScreen = "list" | "create" | "detail" | "edit";
type Dialog = "group-lesson" | "private-availability" | "private-booking" | "teacher" | "card-template" | "issue-card" | null;
const navGroups: Array<{ title: string; items: Array<{ id: Section; label: string; icon: string }> }> = [
  { title: "工作台", items: [{ id: "overview", label: "经营概况", icon: "◫" }] },
  { title: "教务管理", items: [
    { id: "courses", label: "课程管理", icon: "▤" },
    { id: "group-lessons", label: "团课排课", icon: "▦" },
    { id: "private-lessons", label: "私教课排课", icon: "◷" },
  ] },
  { title: "门店管理", items: [
    { id: "cards", label: "卡片管理", icon: "▱" },
    { id: "teachers", label: "老师管理", icon: "♙" },
    { id: "students", label: "学员管理", icon: "♧" },
    { id: "bookings", label: "预约查看", icon: "☷" },
    { id: "no-shows", label: "爽约管理", icon: "⚑" },
  ] },
  { title: "设置", items: [{ id: "settings", label: "店铺信息设置", icon: "⚙" }] },
];
const api = createMockApi();
const data = ref<WorkspaceData>(createSeedWorkspace());
const loading = ref(false);
const activeSection = ref<Section>("courses");
const courseScreen = ref<CourseScreen>("list");
const selectedCourseId = ref("");
const activeDialog = ref<Dialog>(null);
const toast = ref("");
const pageError = ref("");
const studentQuery = ref("");
const studentResults = ref<StudentMatch[]>([]);
const cardResult = ref<StudentCardsResult | null>(null);
const courseDraft = reactive<CreateCourseInput>({ name: "", category: "瑜伽", teacherId: "t-chen", cardTemplateId: "card-month", difficulty: 2, duration: 60, price: 168, intro: "", bookingNotice: "", deductionCount: 1, deductionAmount: 0, room: "瑜伽房 A", capacity: 10, minimumEnrollment: 1, autoCancelBelowMinimum: false, cancelBeforeMinutes: 120, bookingOpensMinutes: 0, bookingClosesMinutes: 3, notifications: [120], homepageVisible: true, postBookingInfo: [] });
const editingCourseId = ref("");
const teacherDraft = reactive({ name: "", phone: "", specialties: "瑜伽", introduction: "", yearsExperience: "不满一年", privateEligible: false });
const lessonDraft = reactive<CreateLessonInput>({ courseId: "c-yoga-basic", teacherId: "t-chen", date: localDate(), start: "16:00", duration: 60, room: "瑜伽房 A", capacity: 12 });
const availabilityDraft = reactive({ teacherId: "t-lin", date: localDate(1), start: "10:00", end: "11:00" });
const privateBookingDraft = reactive({ availabilityId: "", courseId: "c-private-assessment", studentQuery: "" });
const privateStudentMatches = ref<StudentMatch[]>([]);
const cardDraft = reactive({ name: "", kind: "limited-count" as "limited-count" | "unlimited" | "stored-value", sessions: 8, price: 680, validityDays: 30, applicable: "瑜伽团课", maxPerStudent: 2, allowGuestBooking: false, opensImmediately: true, bookingNotice: "", storedValue: 0 });
const issueDraft = reactive({ studentQuery: "", studentId: "", templateId: "" });
const issueMatches = ref<StudentMatch[]>([]);

function localDate(offset = 0): string {
  const [year, month, day] = localDateAt(new Date(), BUSINESS_TIME_ZONE).split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  date.setUTCDate(date.getUTCDate() + offset);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

const selectedCourse = computed(() => data.value.courses.find((course) => course.id === selectedCourseId.value));
const title = computed(() => {
  if (activeSection.value === "courses") {
    if (courseScreen.value === "create") return "创建课程";
    if (courseScreen.value === "edit") return "编辑课程";
    if (courseScreen.value === "detail") return selectedCourse.value?.name ?? "课程详情";
    return "课程管理";
  }
  return navGroups.flatMap((group) => group.items).find((item) => item.id === activeSection.value)?.label ?? "经营概况";
});
const today = computed(() => localDate());
const todayLessons = computed(() => data.value.lessons.filter((lesson) => lesson.date === today.value && lesson.status === "scheduled"));
const upcomingLessons = computed(() => [...data.value.lessons].filter((lesson) => lesson.status === "scheduled").sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)).slice(0, 5));
const schedulableCourses = computed(() => data.value.courses.filter((course) => course.status === "published" && (activeSection.value === "private-lessons" ? course.category === "私教" : course.category !== "私教")));
const noShowBookings = computed(() => data.value.bookings.filter((booking) => booking.status === "no-show"));
const activeCards = computed(() => data.value.students.flatMap((student) => student.cards.filter((card) => {
  if (card.status !== "active") return false;
  const template = data.value.cardTemplates.find((item) => item.id === card.templateId);
  return template?.kind === "stored-value" ? (card.balance ?? 0) > 0 : card.remaining > 0;
}).map((card) => ({ student, card, template: data.value.cardTemplates.find((item) => item.id === card.templateId) }))));
const allStudentCards = computed(() => data.value.students.flatMap((student) => student.cards.map((card) => ({ student, card, template: data.value.cardTemplates.find((item) => item.id === card.templateId) }))));

function teacherName(id: string): string { return data.value.teachers.find((teacher) => teacher.id === id)?.name ?? "未分配"; }
function courseName(id: string): string { return data.value.courses.find((course) => course.id === id)?.name ?? "课程已删除"; }
function templateName(id: string): string { return data.value.cardTemplates.find((template) => template.id === id)?.name ?? "未关联卡片"; }
function cardQuota(template: WorkspaceData["cardTemplates"][number]): string {
  if (template.kind === "stored-value") return `储值 ¥${(template.storedValue ?? 0).toLocaleString()}`;
  if (template.kind === "unlimited") return "不限次";
  return `${template.sessions} 次`;
}
function studentName(id: string): string { return data.value.students.find((student) => student.id === id)?.name ?? "未知学员"; }
function formatDate(date: string): string { return new Date(`${date}T12:00:00Z`).toLocaleDateString("zh-CN", { timeZone: BUSINESS_TIME_ZONE, month: "long", day: "numeric", weekday: "short" }); }
function lessonEnd(lesson: WorkspaceData["lessons"][number]): string {
  const total = Number(lesson.start.slice(0, 2)) * 60 + Number(lesson.start.slice(3)) + lesson.duration;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function switchMode(): void {
  const url = new URL(window.location.href);
  if (props.integrated) url.searchParams.set("mode", "baseline");
  else url.searchParams.delete("mode");
  window.location.href = url.toString();
}

function goToSection(section: Section, resetCourseView = true): void {
  activeSection.value = section;
  activeDialog.value = null;
  if (section === "courses" && resetCourseView) {
    courseScreen.value = "list";
    editingCourseId.value = "";
  }
}

function navigateFromAgent(section: Section): void {
  const keepCourseDetail = section === "courses" && activeSection.value === "courses" && courseScreen.value === "detail";
  goToSection(section, !keepCourseDetail);
}

function beginCourseCreation(): void {
  editingCourseId.value = "";
  selectedCourseId.value = "";
  resetCourseDraft();
  courseScreen.value = "create";
}

function showCourse(courseId: string): void {
  selectedCourseId.value = courseId;
  activeSection.value = "courses";
  courseScreen.value = "detail";
}
function openDialog(dialog: Exclude<Dialog, null>): void { activeDialog.value = dialog; }
function closeDialog(): void { activeDialog.value = null; }

async function refresh(): Promise<void> {
  data.value = await api.read();
  if (!privateBookingDraft.availabilityId) privateBookingDraft.availabilityId = data.value.privateAvailability.find((slot) => slot.status === "available")?.id ?? "";
}
function showNotice(message: string): void {
  toast.value = message;
  window.setTimeout(() => { if (toast.value === message) toast.value = ""; }, 3200);
}
function reportError(error: unknown): void { pageError.value = error instanceof Error ? error.message : String(error); }
async function runBusinessAction<T>(action: () => Promise<T>, success: string): Promise<T | undefined> {
  pageError.value = "";
  loading.value = true;
  try { const result = await action(); await refresh(); showNotice(success); return result; }
  catch (error) { reportError(error); return undefined; }
  finally { loading.value = false; }
}

async function createCourse(): Promise<void> {
  const payload = { ...courseDraft, notifications: notificationDraft.value.split(/[、,，]/).map(Number).filter(Number.isFinite) };
  const wasEditing = Boolean(editingCourseId.value);
  const saved = await runBusinessAction(() => wasEditing ? api.updateCourse(editingCourseId.value, payload) : api.createCourse(payload), wasEditing ? "课程资料已保存" : "课程已创建并发布");
  if (saved) {
    selectedCourseId.value = saved.id;
    courseScreen.value = "detail";
    editingCourseId.value = "";
    resetCourseDraft();
  }
}
const notificationDraft = ref("120");
function resetCourseDraft(): void {
  Object.assign(courseDraft, {
    name: "", category: "瑜伽", teacherId: "t-chen", cardTemplateId: "card-month", difficulty: 2, duration: 60, price: 168,
    intro: "", bookingNotice: "", coverName: "", deductionCount: 1, deductionAmount: 0, room: "瑜伽房 A", capacity: 10,
    minimumEnrollment: 1, autoCancelBelowMinimum: false, cancelBeforeMinutes: 120, bookingOpensMinutes: 0,
    bookingClosesMinutes: 3, notifications: [120], homepageVisible: true, postBookingInfo: [],
  });
  notificationDraft.value = "120";
}
function editCourse(course: WorkspaceData["courses"][number]): void {
  Object.assign(courseDraft, course);
  notificationDraft.value = (course.notifications ?? []).join(", ");
  editingCourseId.value = course.id;
  selectedCourseId.value = course.id;
  courseScreen.value = "edit";
}
function cancelCourseEdit(): void {
  const returnToDetail = Boolean(editingCourseId.value);
  editingCourseId.value = "";
  resetCourseDraft();
  courseScreen.value = returnToDetail && selectedCourse.value ? "detail" : "list";
}
function applyCourseDefaults(): void {
  const course = data.value.courses.find((item) => item.id === lessonDraft.courseId);
  if (!course) return;
  lessonDraft.teacherId = course.teacherId;
  lessonDraft.duration = course.duration;
  lessonDraft.room = course.room ?? "瑜伽房 A";
  lessonDraft.capacity = course.capacity ?? 10;
}
async function setCourseCover(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) courseDraft.coverName = file.name;
}
async function createTeacher(): Promise<void> {
  await runBusinessAction(() => api.createTeacher({ name: teacherDraft.name, phone: teacherDraft.phone, specialties: teacherDraft.specialties.split(/[、,，]/), introduction: teacherDraft.introduction, yearsExperience: teacherDraft.yearsExperience, privateEligible: teacherDraft.privateEligible }), "老师档案已保存");
  if (!pageError.value) { Object.assign(teacherDraft, { name: "", phone: "", introduction: "" }); closeDialog(); }
}
async function createLesson(): Promise<void> {
  await runBusinessAction(() => api.createLesson({ ...lessonDraft }), "排课已保存");
  if (!pageError.value) closeDialog();
}
async function searchStudents(): Promise<void> {
  pageError.value = "";
  loading.value = true;
  try { studentResults.value = await api.findStudents(studentQuery.value); cardResult.value = null; }
  catch (error) { reportError(error); }
  finally { loading.value = false; }
}
async function inspectCards(query: string): Promise<void> {
  pageError.value = "";
  loading.value = true;
  try { cardResult.value = await api.getStudentCards(query); }
  catch (error) { reportError(error); }
  finally { loading.value = false; }
}
async function showStudentCards(studentId: string): Promise<void> {
  const student = data.value.students.find((item) => item.id === studentId);
  if (!student) return;
  activeSection.value = "students";
  activeDialog.value = null;
  studentQuery.value = student.name;
  studentResults.value = await api.findStudents(student.name);
  cardResult.value = await api.getStudentCards(studentId);
}
async function searchPrivateStudents(): Promise<void> { privateStudentMatches.value = await api.findStudents(privateBookingDraft.studentQuery); }
async function createAvailability(): Promise<void> {
  const created = await runBusinessAction(() => api.createAvailability({ ...availabilityDraft }), "老师可约时间已保存");
  if (created) { privateBookingDraft.availabilityId = created.id; closeDialog(); }
}
async function bookPrivateLesson(): Promise<void> {
  await runBusinessAction(() => api.bookPrivateLesson({ ...privateBookingDraft }), "私教预约已创建，会员卡尚未扣次");
  if (!pageError.value) { privateStudentMatches.value = []; closeDialog(); }
}
async function createCardTemplate(): Promise<void> {
  await runBusinessAction(() => api.createCardTemplate({ ...cardDraft }), "会员卡模板已保存");
  if (!pageError.value) { Object.assign(cardDraft, { name: "", kind: "limited-count", sessions: 8, price: 680, validityDays: 30, applicable: "瑜伽团课", maxPerStudent: 2, allowGuestBooking: false, opensImmediately: true, bookingNotice: "", storedValue: 0 }); closeDialog(); }
}
async function searchIssueStudents(): Promise<void> { issueMatches.value = await api.findStudents(issueDraft.studentQuery); }
async function issueCard(): Promise<void> {
  await runBusinessAction(() => api.issueCard(issueDraft.studentId, issueDraft.templateId), "会员卡已发放");
  if (!pageError.value) { issueMatches.value = []; Object.assign(issueDraft, { studentQuery: "", studentId: "" }); closeDialog(); }
}
async function activateCard(studentId: string, cardId: string): Promise<void> {
  await runBusinessAction(() => api.activateCard(studentId, cardId), "会员卡已开通，有效期从今天开始计算");
}
async function resetDemo(): Promise<void> {
  loading.value = true;
  try { data.value = await api.reset(); studentResults.value = []; cardResult.value = null; selectedCourseId.value = ""; courseScreen.value = "list"; activeDialog.value = null; showNotice("本地演示数据已恢复初始状态"); }
  finally { loading.value = false; }
}
onMounted(() => { void refresh(); });
watch(activeSection, (section) => {
  if (section === "private-lessons") {
    lessonDraft.courseId = "c-private-assessment";
    lessonDraft.teacherId = "t-lin";
    lessonDraft.room = "私教室";
    lessonDraft.capacity = 1;
  } else if (section === "group-lessons" && lessonDraft.courseId === "c-private-assessment") {
    lessonDraft.courseId = "c-yoga-basic";
    lessonDraft.teacherId = "t-chen";
    lessonDraft.room = "瑜伽房 A";
    lessonDraft.capacity = 12;
  } else if (section === "group-lessons") applyCourseDefaults();
});
</script>

<template>
  <div class="bc-app" :class="{ 'is-integrated': integrated }">
    <aside class="bc-sidebar">
      <a class="bc-brand" href="#" @click.prevent="goToSection('overview')">
        <span class="bc-brand__mark">冰</span>
        <span><strong>冰草约课</strong><small>商家管理后台</small></span>
      </a>
      <div class="bc-shop"><span class="bc-shop__avatar">冰</span><span><strong>冰草瑜伽 · 测试门店</strong><small>杭州 · 西湖区</small></span><span class="bc-chevron">⌄</span></div>
      <nav class="bc-nav" aria-label="主导航">
        <div v-for="group in navGroups" :key="group.title" class="bc-nav__group">
          <p>{{ group.title }}</p>
          <button v-for="item in group.items" :key="item.id" type="button" class="bc-nav__item" :class="{ active: activeSection === item.id }" @click="goToSection(item.id)">
            <span class="bc-nav__icon">{{ item.icon }}</span><span>{{ item.label }}</span>
            <span v-if="item.id === 'no-shows' && noShowBookings.length" class="bc-nav__count">{{ noShowBookings.length }}</span>
          </button>
        </div>
      </nav>
      <div class="bc-sidebar__foot"><span class="bc-avatar">李</span><span><strong>李店长</strong><small>门店管理员</small></span><button type="button" class="bc-icon-button" title="账号设置">···</button></div>
    </aside>

    <main class="bc-main">
      <header class="bc-topbar">
        <div class="bc-breadcrumb">工作台 <span>/</span> {{ activeSection === 'courses' && courseScreen !== 'list' ? '课程管理 / ' : '' }}{{ title }}</div>
        <div class="bc-topbar__actions">
          <span class="bc-topbar__date">{{ new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }) }}</span>
          <button type="button" class="bc-icon-button" title="通知">♧<i></i></button>
          <span class="bc-avatar bc-avatar--small">李</span>
        </div>
      </header>

      <div class="bc-main__scroll">
        <div class="bc-page-head">
          <div><p class="bc-eyebrow">冰草瑜伽 · 门店运营</p><h1>{{ title }}</h1><p class="bc-page-head__sub">管理课程与日常教务，让每一项安排都清晰可查。</p></div>
          <div class="bc-page-head__actions">
            <button v-if="activeSection === 'courses' && courseScreen === 'list'" type="button" class="bc-button bc-button--primary" data-testid="course-create" @click="beginCourseCreation">＋ 创建课程</button>
            <span class="bc-mode" :class="integrated ? 'bc-mode--pling' : ''"><i></i>{{ integrated ? "Pling 已接入" : "未接入 Pling" }}</span>
            <button type="button" class="bc-button bc-button--plain" @click="switchMode">{{ integrated ? "查看未接入版" : "查看 Pling 接入版" }}</button>
          </div>
        </div>
        <div v-if="pageError" class="bc-alert" role="alert"><span>!</span>{{ pageError }}<button type="button" @click="pageError = ''">关闭</button></div>

        <template v-if="activeSection === 'overview'">
          <section class="bc-metrics">
            <article class="bc-metric"><span class="bc-metric__icon icon-blue">▤</span><div><small>在售课程</small><strong>{{ data.courses.filter((course) => course.status === 'published').length }}</strong></div><span class="bc-metric__hint">门</span></article>
            <article class="bc-metric"><span class="bc-metric__icon icon-violet">♙</span><div><small>在职老师</small><strong>{{ data.teachers.filter((teacher) => teacher.status === 'active').length }}</strong></div><span class="bc-metric__hint">位</span></article>
            <article class="bc-metric"><span class="bc-metric__icon icon-green">◷</span><div><small>今日排课</small><strong>{{ todayLessons.length }}</strong></div><span class="bc-metric__hint">节</span></article>
            <article class="bc-metric"><span class="bc-metric__icon icon-amber">♧</span><div><small>待处理爽约</small><strong>{{ noShowBookings.length }}</strong></div><span class="bc-metric__hint">条</span></article>
          </section>
          <div class="bc-dashboard-grid">
            <section class="bc-card bc-card--schedule"><div class="bc-card__head"><div><h2>近期排课</h2><p>接下来安排的课程与授课老师</p></div><button type="button" class="bc-link" @click="goToSection('group-lessons')">查看排课 <span>→</span></button></div>
              <div v-for="lesson in upcomingLessons" :key="lesson.id" class="bc-upcoming"><div class="bc-upcoming__date"><strong>{{ lesson.date.slice(8) }}</strong><small>{{ lesson.date.slice(5, 7) }}月</small></div><div class="bc-upcoming__info"><strong>{{ courseName(lesson.courseId) }}</strong><small>{{ teacherName(lesson.teacherId) }} · {{ lesson.room }}</small></div><span class="bc-time">{{ lesson.start }}</span><span class="bc-capacity">{{ lesson.booked }}/{{ lesson.capacity }} 人</span></div>
            </section>
            <section class="bc-card"><div class="bc-card__head"><div><h2>常用入口</h2><p>快速处理门店日常事务</p></div></div><div class="bc-shortcuts"><button type="button" @click="beginCourseCreation"><span>＋</span><strong>创建课程</strong><small>设置课程、老师与适用卡片</small></button><button type="button" @click="goToSection('group-lessons')"><span>◷</span><strong>安排团课</strong><small>检查老师档期并发布排课</small></button><button type="button" @click="goToSection('students')"><span>⌕</span><strong>查询学员</strong><small>查看档案与会员卡状态</small></button></div></section>
          </div>
          <section class="bc-card bc-card--recent"><div class="bc-card__head"><div><h2>门店提醒</h2><p>需要关注的运营事项</p></div></div><div class="bc-reminders"><div><span class="bc-reminder-dot dot-amber"></span><span><strong>{{ noShowBookings.length }} 条爽约记录待跟进</strong><small>查看预约记录并联系学员</small></span><button type="button" class="bc-link" @click="goToSection('no-shows')">去处理 →</button></div><div><span class="bc-reminder-dot dot-blue"></span><span><strong>{{ data.courses.filter((course) => course.status === 'draft').length }} 门课程尚未发布</strong><small>检查课程信息后可继续发布</small></span><button type="button" class="bc-link" @click="goToSection('courses')">查看课程 →</button></div></div></section>
        </template>

        <template v-else-if="activeSection === 'courses'">
          <template v-if="courseScreen === 'list'">
            <section class="bc-card bc-list-card bc-courses-list" data-testid="course-list"><div class="bc-card__head"><div><h2>课程列表 <small>{{ data.courses.length }}</small></h2><p>打开课程查看详情，编辑课程资料或排课默认值。</p></div><button class="bc-button bc-button--plain" type="button" @click="void refresh()">↻ 刷新</button></div>
              <div class="bc-table-scroll"><table class="bc-table"><thead><tr><th>课程名称</th><th>分类</th><th>授课老师</th><th>适用卡片</th><th>难度</th><th>时长</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="course in data.courses" :key="course.id"><td><strong>{{ course.name }}</strong><small class="bc-table-sub">{{ course.intro || "暂无课程介绍" }}</small></td><td>{{ course.category }}</td><td>{{ teacherName(course.teacherId) }}</td><td>{{ templateName(course.cardTemplateId) }}</td><td class="bc-stars">{{ '★'.repeat(course.difficulty) }}<span>{{ '☆'.repeat(5 - course.difficulty) }}</span></td><td>{{ course.duration }} 分钟</td><td><span class="bc-status" :class="course.status === 'published' ? 'is-green' : 'is-gray'">{{ course.status === 'published' ? "已发布" : "草稿" }}</span></td><td><div class="bc-row-actions"><button type="button" class="bc-link" @click="showCourse(course.id)">查看</button><button type="button" class="bc-link" @click="editCourse(course)">编辑</button></div></td></tr></tbody></table></div>
            </section>
          </template>

          <template v-else-if="courseScreen === 'detail'">
            <template v-if="selectedCourse">
            <div class="bc-course-detail-toolbar"><button type="button" class="bc-button bc-button--plain" data-testid="course-back" @click="goToSection('courses')">← 返回课程列表</button><div><span class="bc-status" :class="selectedCourse.status === 'published' ? 'is-green' : 'is-gray'">{{ selectedCourse.status === 'published' ? "已发布" : "草稿" }}</span><button type="button" class="bc-button bc-button--primary" data-testid="course-edit" @click="editCourse(selectedCourse)">编辑课程</button></div></div>
            <section class="bc-card bc-course-detail" data-testid="course-detail">
              <div class="bc-course-detail__hero"><div class="bc-course-cover"><span>冰草瑜伽</span><small>{{ selectedCourse.coverName || "课程封面" }}</small></div><div class="bc-course-detail__intro"><p class="bc-eyebrow">{{ selectedCourse.category }} · {{ selectedCourse.duration }} 分钟</p><h2>{{ selectedCourse.name }}</h2><p>{{ selectedCourse.intro || "暂无课程介绍" }}</p><div class="bc-stars">{{ '★'.repeat(selectedCourse.difficulty) }}<span>{{ '☆'.repeat(5 - selectedCourse.difficulty) }}</span><small>{{ selectedCourse.difficulty }} 星难度</small></div></div><div class="bc-course-price"><small>单次价格</small><strong>¥{{ selectedCourse.price.toLocaleString() }}</strong></div></div>
              <div class="bc-course-detail__grid"><article><small>授课老师</small><strong>{{ teacherName(selectedCourse.teacherId) }}</strong></article><article><small>适用卡片</small><strong>{{ templateName(selectedCourse.cardTemplateId) }}</strong></article><article><small>默认教室</small><strong>{{ selectedCourse.room || "未设置" }}</strong></article><article><small>每节课人数</small><strong>{{ selectedCourse.minimumEnrollment ?? 1 }}–{{ selectedCourse.capacity ?? 10 }} 人</strong></article><article><small>每节课扣卡</small><strong>{{ selectedCourse.deductionCount ?? 1 }} 次{{ selectedCourse.deductionAmount ? ` + ¥${selectedCourse.deductionAmount}` : "" }}</strong></article><article><small>首页展示</small><strong>{{ selectedCourse.homepageVisible === false ? "不展示" : "展示" }}</strong></article></div>
              <div class="bc-course-detail__notes"><section><h3>约课须知</h3><p>{{ selectedCourse.bookingNotice || "未设置" }}</p></section><section><h3>后续排课规则</h3><p>提前 {{ selectedCourse.cancelBeforeMinutes ?? 120 }} 分钟可取消 · 最低 {{ selectedCourse.minimumEnrollment ?? 1 }} 人开课 · 最晚课前 {{ selectedCourse.bookingClosesMinutes ?? 3 }} 分钟停止预约</p></section></div>
              <div class="bc-course-detail__foot"><span>已排课时不会随课程默认值修改而变化。</span><button type="button" class="bc-link" @click="goToSection('group-lessons')">查看排课记录 →</button></div>
            </section>
            </template>
            <section v-else class="bc-card bc-course-loading" aria-live="polite">正在读取课程详情…</section>
          </template>

          <template v-else>
            <div class="bc-course-editor-toolbar"><button type="button" class="bc-button bc-button--plain" data-testid="course-cancel" @click="cancelCourseEdit">← {{ editingCourseId ? "返回课程详情" : "返回课程列表" }}</button><p>课程资料会展示给学员，排课规则只影响之后创建的课时。</p></div>
            <section class="bc-card bc-form-card bc-course-editor" data-testid="course-editor"><div class="bc-card__head"><div><h2>{{ editingCourseId ? "课程资料" : "新课程资料" }}</h2><p>请填写课程内容、授课老师和适用会员卡。</p></div><span class="bc-required-note"><b>*</b> 为必填项</span></div>
              <form class="bc-form bc-form--course" @submit.prevent="createCourse">
              <label class="bc-field"><span>课程名称 <b>*</b></span><input v-model="courseDraft.name" required minlength="2" maxlength="40" placeholder="例如：孕妇瑜伽" /></label>
              <label class="bc-field"><span>课程分类 <b>*</b></span><select v-model="courseDraft.category"><option>瑜伽</option><option>普拉提</option><option>孕产</option><option>私教</option></select></label>
              <label class="bc-field"><span>授课老师 <b>*</b></span><select v-model="courseDraft.teacherId" required><option v-for="teacher in data.teachers.filter((item) => item.status === 'active')" :key="teacher.id" :value="teacher.id">{{ teacher.name }} · {{ teacher.specialties[0] }}</option></select></label>
              <label class="bc-field"><span>适用卡片 <b>*</b></span><select v-model="courseDraft.cardTemplateId" required><option v-for="card in data.cardTemplates" :key="card.id" :value="card.id">{{ card.name }}</option></select></label>
              <label class="bc-field"><span>课程难度</span><select v-model.number="courseDraft.difficulty"><option v-for="star in [1,2,3,4,5]" :key="star" :value="star">{{ '★'.repeat(star) }}{{ '☆'.repeat(5 - star) }} · {{ star }} 星</option></select></label>
              <label class="bc-field"><span>课程时长</span><span class="bc-input-unit"><input v-model.number="courseDraft.duration" type="number" min="15" max="240" /><em>分钟</em></span></label>
              <label class="bc-field"><span>单次价格</span><span class="bc-input-unit"><em>¥</em><input v-model.number="courseDraft.price" type="number" min="0" /><em>元</em></span></label>
              <label class="bc-field bc-field--wide"><span>课程介绍</span><textarea v-model="courseDraft.intro" rows="2" maxlength="200" placeholder="简要介绍课程内容、适合人群或练习目标"></textarea></label>
              <label class="bc-field bc-field--wide"><span>约课须知</span><textarea v-model="courseDraft.bookingNotice" rows="2" maxlength="200" placeholder="例如：请提前 10 分钟到店"></textarea></label>
              <label class="bc-field"><span>课程封面</span><input type="file" accept="image/*" @change="setCourseCover" /><small>{{ courseDraft.coverName || "选择图片，本地演示只保存文件名" }}</small></label>
              <details class="bc-rules bc-field--wide" open><summary>排课模板与约课规则</summary>
                <div class="bc-form bc-form--course">
                  <label class="bc-field"><span>每节课扣卡次数</span><input v-model.number="courseDraft.deductionCount" type="number" min="0" step="0.5" /></label>
                  <label class="bc-field"><span>每节课扣卡金额（元）</span><input v-model.number="courseDraft.deductionAmount" type="number" min="0" step="0.01" /></label>
                  <label class="bc-field"><span>默认上课教室</span><input v-model="courseDraft.room" maxlength="40" /></label>
                  <label class="bc-field"><span>课时时长（分钟）</span><input v-model.number="courseDraft.duration" type="number" min="15" max="240" /></label>
                  <label class="bc-field"><span>最大人数</span><input v-model.number="courseDraft.capacity" type="number" min="1" max="40" /></label>
                  <label class="bc-field"><span>最低开课人数</span><input v-model.number="courseDraft.minimumEnrollment" type="number" min="1" :max="courseDraft.capacity" /></label>
                  <label class="bc-field"><span>最晚取消（课前分钟）</span><input v-model.number="courseDraft.cancelBeforeMinutes" type="number" min="0" /></label>
                  <label class="bc-field"><span>最早可约（课前分钟）</span><input v-model.number="courseDraft.bookingOpensMinutes" type="number" min="0" placeholder="0 表示不限制" /></label>
                  <label class="bc-field"><span>最晚可约（课前分钟）</span><input v-model.number="courseDraft.bookingClosesMinutes" type="number" min="0" /></label>
                  <label class="bc-field"><span>开课通知时间点（课前分钟）</span><input v-model="notificationDraft" placeholder="120, 30" /></label>
                  <label class="bc-field"><span>未达最低人数自动取消</span><input v-model="courseDraft.autoCancelBelowMinimum" type="checkbox" /></label>
                  <label class="bc-field"><span>展示到店铺首页</span><input v-model="courseDraft.homepageVisible" type="checkbox" /></label>
                  <label class="bc-field bc-field--wide"><span>预约后可见信息（每行一项）</span><textarea :value="(courseDraft.postBookingInfo ?? []).join('\n')" rows="2" @input="courseDraft.postBookingInfo = ($event.target as HTMLTextAreaElement).value.split('\n').filter(Boolean)"></textarea></label>
                </div>
              </details>
              <div class="bc-form__foot"><span>{{ editingCourseId ? "已有课时保留创建时设置，新默认值只用于之后的排课。" : "保存后发布课程，并打开课程详情核对结果。" }}</span><div><button type="button" class="bc-button bc-button--plain" @click="cancelCourseEdit">取消</button><button class="bc-button bc-button--primary" :disabled="loading">{{ loading ? "保存中…" : editingCourseId ? "保存修改" : "保存并发布课程" }}</button></div></div>
              </form>
            </section>
          </template>
        </template>

        <template v-else-if="activeSection === 'group-lessons'">
          <div v-if="activeDialog === 'group-lesson'" class="bc-modal-backdrop" role="presentation" @click.self="closeDialog"><section class="bc-card bc-form-card bc-modal" role="dialog" aria-modal="true" aria-labelledby="group-lesson-dialog-title"><div class="bc-card__head"><div><h2 id="group-lesson-dialog-title">新增团课排期</h2><p>课程会带入排课模板，保存时重新检查老师时间。</p></div><button type="button" class="bc-icon-button" aria-label="关闭" @click="closeDialog">×</button></div>
            <form class="bc-form bc-form--schedule" @submit.prevent="createLesson">
              <label class="bc-field"><span>课程 <b>*</b></span><select v-model="lessonDraft.courseId" required @change="applyCourseDefaults"><option v-for="course in schedulableCourses" :key="course.id" :value="course.id">{{ course.name }}</option></select></label>
              <label class="bc-field"><span>授课老师 <b>*</b></span><select v-model="lessonDraft.teacherId" required><option v-for="teacher in data.teachers.filter((item) => item.status === 'active')" :key="teacher.id" :value="teacher.id">{{ teacher.name }} · {{ teacher.specialties[0] }}</option></select></label>
              <label class="bc-field"><span>上课日期 <b>*</b></span><input v-model="lessonDraft.date" type="date" required /></label>
              <label class="bc-field"><span>开始时间 <b>*</b></span><input v-model="lessonDraft.start" type="time" required /></label>
              <label class="bc-field"><span>时长</span><span class="bc-input-unit"><input v-model.number="lessonDraft.duration" type="number" min="15" max="240" /><em>分钟</em></span></label>
              <label class="bc-field"><span>上课教室 <b>*</b></span><input v-model="lessonDraft.room" required maxlength="40" /></label>
              <label v-if="activeSection === 'group-lessons'" class="bc-field"><span>可约人数 <b>*</b></span><span class="bc-input-unit"><input v-model.number="lessonDraft.capacity" type="number" min="1" max="40" /><em>人</em></span></label>
              <div class="bc-form__foot"><span>保存前将再次校验老师档期和可约人数。</span><button class="bc-button bc-button--primary" :disabled="loading">{{ loading ? "保存中…" : "确认排课" }}</button></div>
            </form>
          </section></div>
          <section class="bc-card bc-list-card"><div class="bc-card__head"><div><h2>排课列表 <small>{{ data.lessons.length }}</small></h2><p>按日期查看课程、老师和预约情况</p></div><button type="button" class="bc-button bc-button--primary" @click="openDialog('group-lesson')">＋ 新增排期</button></div><div class="bc-table-scroll"><table class="bc-table"><thead><tr><th>日期</th><th>时间</th><th>课程</th><th>授课老师</th><th>教室</th><th>预约情况</th><th>状态</th></tr></thead><tbody><tr v-for="lesson in data.lessons" :key="lesson.id"><td>{{ formatDate(lesson.date) }}</td><td>{{ lesson.start }}–{{ lessonEnd(lesson) }}</td><td><strong>{{ courseName(lesson.courseId) }}</strong></td><td>{{ teacherName(lesson.teacherId) }}</td><td>{{ lesson.room }}</td><td>{{ lesson.booked }}/{{ lesson.capacity }} 人</td><td><span class="bc-status is-green">{{ lesson.status === 'scheduled' ? "已排课" : lesson.status }}</span></td></tr></tbody></table></div></section>
        </template>

        <template v-else-if="activeSection === 'private-lessons'">
          <div v-if="activeDialog === 'private-availability'" class="bc-modal-backdrop" role="presentation" @click.self="closeDialog"><section class="bc-card bc-form-card bc-modal" role="dialog" aria-modal="true" aria-labelledby="availability-dialog-title"><div class="bc-card__head"><div><h2 id="availability-dialog-title">开放私教可约时间</h2><p>只有具备私教资格的老师可以开放时段。</p></div><button type="button" class="bc-icon-button" aria-label="关闭" @click="closeDialog">×</button></div>
            <form class="bc-form bc-form--schedule" @submit.prevent="createAvailability"><label class="bc-field"><span>私教老师 <b>*</b></span><select v-model="availabilityDraft.teacherId"><option v-for="teacher in data.teachers.filter((item) => item.status === 'active' && item.privateEligible)" :key="teacher.id" :value="teacher.id">{{ teacher.name }} · {{ teacher.yearsExperience || "教龄未填写" }}</option></select></label><label class="bc-field"><span>日期 <b>*</b></span><input v-model="availabilityDraft.date" type="date" required /></label><label class="bc-field"><span>开始时间 <b>*</b></span><input v-model="availabilityDraft.start" type="time" required /></label><label class="bc-field"><span>结束时间 <b>*</b></span><input v-model="availabilityDraft.end" type="time" required /></label><div class="bc-form__foot"><span>保存后可在时段列表中继续预约。</span><button class="bc-button bc-button--primary" :disabled="loading">保存可约时间</button></div></form>
          </section></div>
          <section class="bc-card bc-list-card"><div class="bc-card__head"><div><h2>可约时段 <small>{{ data.privateAvailability.filter((slot) => slot.status === 'available').length }}</small></h2><p>预约成功后，该时段会标记为已占用。</p></div><button type="button" class="bc-button bc-button--primary" @click="openDialog('private-availability')">＋ 开放时段</button></div><div class="bc-table-scroll"><table class="bc-table"><thead><tr><th>老师</th><th>日期</th><th>可约时间</th><th>状态</th></tr></thead><tbody><tr v-for="slot in data.privateAvailability" :key="slot.id"><td>{{ teacherName(slot.teacherId) }}</td><td>{{ formatDate(slot.date) }}</td><td>{{ slot.start }}–{{ slot.end }}</td><td><span class="bc-status" :class="slot.status === 'available' ? 'is-green' : 'is-gray'">{{ slot.status === 'available' ? "可预约" : "已预约" }}</span></td></tr></tbody></table></div></section>
          <div v-if="activeDialog === 'private-booking'" class="bc-modal-backdrop" role="presentation" @click.self="closeDialog"><section class="bc-card bc-form-card bc-modal" role="dialog" aria-modal="true" aria-labelledby="private-booking-dialog-title"><div class="bc-card__head"><div><h2 id="private-booking-dialog-title">为学员预约私教</h2><p>确认课程、时段、学员身份和可用会员卡。</p></div><button type="button" class="bc-icon-button" aria-label="关闭" @click="closeDialog">×</button></div>
            <form class="bc-form bc-form--schedule" @submit.prevent="bookPrivateLesson"><label class="bc-field"><span>可约时段 <b>*</b></span><select v-model="privateBookingDraft.availabilityId" required><option v-for="slot in data.privateAvailability.filter((item) => item.status === 'available')" :key="slot.id" :value="slot.id">{{ teacherName(slot.teacherId) }} · {{ slot.date }} {{ slot.start }}–{{ slot.end }}</option></select></label><label class="bc-field"><span>私教课程 <b>*</b></span><select v-model="privateBookingDraft.courseId"><option v-for="course in data.courses.filter((item) => item.status === 'published' && item.category === '私教')" :key="course.id" :value="course.id">{{ course.name }}</option></select></label><label class="bc-field"><span>学员姓名或手机号 <b>*</b></span><span class="bc-input-unit"><input v-model="privateBookingDraft.studentQuery" required placeholder="同名时补手机号末四位" /><button type="button" class="bc-button bc-button--plain" @click="searchPrivateStudents">查找</button></span></label><div v-if="privateStudentMatches.length" class="bc-candidate-list bc-field--wide"><button v-for="student in privateStudentMatches" :key="student.id" type="button" :class="{ selected: privateBookingDraft.studentQuery === student.id }" @click="privateBookingDraft.studentQuery = student.id"><strong>{{ student.name }}</strong><span>{{ student.phone }} · {{ student.activeCards }} 张可用卡</span></button><small>选中学员后仍会由业务服务按会员卡和上课日期校验。</small></div><div class="bc-form__foot"><span>预约时锁定可用卡片，签到前不扣次数。</span><button class="bc-button bc-button--primary" :disabled="loading || !privateBookingDraft.availabilityId">确认预约</button></div></form>
          </section></div>
          <section class="bc-card bc-list-card"><div class="bc-card__head"><div><h2>私教预约记录 <small>{{ data.privateBookings.length }}</small></h2><p>预约会保留在学员档案中，签到前不扣卡次数。</p></div><button type="button" class="bc-button bc-button--plain" :disabled="!data.privateAvailability.some((slot) => slot.status === 'available')" @click="openDialog('private-booking')">为学员预约</button></div><div class="bc-table-scroll"><table class="bc-table"><thead><tr><th>学员</th><th>课程</th><th>老师</th><th>预约时间</th><th>会员卡</th><th>状态</th></tr></thead><tbody><tr v-for="booking in data.privateBookings" :key="booking.id"><td>{{ studentName(booking.studentId) }}</td><td>{{ courseName(booking.courseId) }}</td><td>{{ teacherName(booking.teacherId) }}</td><td>{{ data.privateAvailability.find((slot) => slot.id === booking.availabilityId)?.date }} {{ data.privateAvailability.find((slot) => slot.id === booking.availabilityId)?.start }}</td><td>{{ templateName(data.students.find((student) => student.id === booking.studentId)?.cards.find((card) => card.id === booking.cardId)?.templateId ?? '') }}</td><td><span class="bc-status is-blue">{{ booking.status === 'booked' ? "已预约" : booking.status }}</span></td></tr></tbody></table></div></section>
        </template>

        <template v-else-if="activeSection === 'teachers'">
          <div v-if="activeDialog === 'teacher'" class="bc-modal-backdrop" role="presentation" @click.self="closeDialog"><section class="bc-card bc-form-card bc-modal" role="dialog" aria-modal="true" aria-labelledby="teacher-dialog-title"><div class="bc-card__head"><div><h2 id="teacher-dialog-title">新增老师</h2><p>老师资料用于课程匹配和排课。</p></div><button type="button" class="bc-icon-button" aria-label="关闭" @click="closeDialog">×</button></div><form class="bc-form bc-form--teacher" @submit.prevent="createTeacher"><label class="bc-field"><span>老师姓名 <b>*</b></span><input v-model="teacherDraft.name" required minlength="2" placeholder="请输入姓名" /></label><label class="bc-field"><span>手机号 <b>*</b></span><input v-model="teacherDraft.phone" required pattern="1\d{10}" maxlength="11" placeholder="用于门店联系" /></label><label class="bc-field"><span>擅长课程</span><input v-model="teacherDraft.specialties" placeholder="例如：瑜伽、拉伸" /></label><label class="bc-field"><span>教龄</span><select v-model="teacherDraft.yearsExperience"><option>不满一年</option><option>1–3 年</option><option>3–5 年</option><option>5 年以上</option></select></label><label class="bc-field"><span>私教老师</span><input v-model="teacherDraft.privateEligible" type="checkbox" /></label><label class="bc-field bc-field--wide"><span>老师介绍</span><textarea v-model="teacherDraft.introduction" rows="2" maxlength="200"></textarea></label><div class="bc-form__foot"><span>本地案例用占位头像。</span><button class="bc-button bc-button--primary" :disabled="loading">保存老师档案</button></div></form></section></div>
          <section class="bc-card bc-list-card">
            <div class="bc-card__head">
              <div><h2>老师列表 <small>{{ data.teachers.length }}</small></h2><p>当前门店可排课的老师</p></div>
              <button type="button" class="bc-button bc-button--primary" v-guide-target="{ id: 'teachers.add', label: '新增老师', description: '打开新增老师档案表单' }" @click="openDialog('teacher')">＋ 新增老师</button>
            </div>
            <div class="bc-table-scroll">
              <table class="bc-table">
                <thead><tr><th>老师</th><th>联系方式</th><th>擅长课程</th><th>私教资格</th><th>教龄</th><th>近期排课</th></tr></thead>
                <tbody>
                  <tr v-for="teacher in data.teachers" :key="teacher.id">
                    <td><span class="bc-person"><i>{{ teacher.name.slice(0, 1) }}</i><strong>{{ teacher.name }}</strong></span></td>
                    <td>{{ teacher.phone }}</td>
                    <td><span v-for="skill in teacher.specialties" :key="skill" class="bc-chip">{{ skill }}</span></td>
                    <td>{{ teacher.privateEligible ? "已开通" : "未开通" }}</td>
                    <td>{{ teacher.yearsExperience || "未填写" }}</td>
                    <td>{{ data.lessons.filter((lesson) => lesson.teacherId === teacher.id && lesson.status === 'scheduled').length }} 节</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <template v-else-if="activeSection === 'students'">
          <section class="bc-card bc-search-card"><div class="bc-card__head"><div><h2>查找学员</h2><p>可使用姓名或手机号搜索；同名学员请核对手机号。</p></div></div><form class="bc-search-form" @submit.prevent="searchStudents"><div class="bc-search-input"><span>⌕</span><input v-model="studentQuery" placeholder="输入学员姓名或手机号" /><button v-if="studentQuery" type="button" aria-label="清空搜索" @click="studentQuery = ''; studentResults = []; cardResult = null">×</button></div><button class="bc-button bc-button--primary" :disabled="loading">{{ loading ? "查询中…" : "搜索学员" }}</button></form></section>
          <section v-if="studentResults.length" class="bc-card bc-list-card"><div class="bc-card__head"><div><h2>查询结果 <small>{{ studentResults.length }}</small></h2><p>选择一位学员查看会员卡信息</p></div></div><div class="bc-student-results"><button v-for="student in studentResults" :key="student.id" type="button" class="bc-student-result" @click="inspectCards(student.id)"><span class="bc-person"><i>{{ student.name.slice(0, 1) }}</i><strong>{{ student.name }}</strong></span><span>{{ student.phone }}</span><span>{{ student.activeCards }} 张可用会员卡</span><span class="bc-link">查看卡片 →</span></button></div></section>
          <section v-if="cardResult" class="bc-card bc-list-card"><div class="bc-card__head"><div><h2>会员卡信息</h2><p>查询结果按学员档案实时读取</p></div></div><div v-if="cardResult.kind === 'one'" class="bc-student-card-detail"><div class="bc-student-card-detail__identity"><span class="bc-person"><i>{{ cardResult.student.name.slice(0, 1) }}</i><strong>{{ cardResult.student.name }}</strong></span><span>{{ cardResult.student.phone }}</span></div><div v-for="card in cardResult.cards" :key="card.id" class="bc-membership-card"><span class="bc-membership-card__mark">冰草</span><span><strong>{{ card.name }}</strong><small>{{ card.status === "pending" ? "待开卡，激活后开始计时" : `有效期至 ${card.expiresOn}` }}</small></span><b v-if="data.cardTemplates.find((item) => item.id === card.templateId)?.kind === 'stored-value'">¥{{ (card.balance ?? 0).toLocaleString() }}</b><b v-else>{{ data.cardTemplates.find((item) => item.id === card.templateId)?.kind === "unlimited" ? "不限次" : `${card.remaining} 次` }}</b><span class="bc-status" :class="card.status === 'active' ? 'is-green' : card.status === 'pending' ? 'is-blue' : 'is-gray'">{{ card.status === 'active' ? "可使用" : card.status === 'pending' ? "待开卡" : card.status === 'expired' ? "已过期" : "已用完" }}</span><button v-if="card.status === 'pending'" type="button" class="bc-link" @click="activateCard(cardResult.student.id, card.id)">立即开卡</button></div></div><p v-else-if="cardResult.kind === 'many'" class="bc-empty">有多位同名学员，请使用手机号末四位缩小范围。</p><p v-else class="bc-empty">没有找到学员，请检查姓名或手机号。</p></section>
          <section v-if="!studentResults.length && !studentQuery" class="bc-card bc-empty-state"><span>⌕</span><strong>搜索学员档案</strong><p>输入姓名或手机号，可查看预约和会员卡状态。</p></section>
        </template>

        <template v-else-if="activeSection === 'cards'">
          <div v-if="activeDialog === 'card-template'" class="bc-modal-backdrop" role="presentation" @click.self="closeDialog"><section class="bc-card bc-form-card bc-modal" role="dialog" aria-modal="true" aria-labelledby="card-template-dialog-title"><div class="bc-card__head"><div><h2 id="card-template-dialog-title">创建会员卡模板</h2><p>先设置卡片规则，再将卡片发给学员。</p></div><button type="button" class="bc-icon-button" aria-label="关闭" @click="closeDialog">×</button></div><form class="bc-form bc-form--course" @submit.prevent="createCardTemplate"><label class="bc-field"><span>卡片名称 <b>*</b></span><input v-model="cardDraft.name" required minlength="2" /></label><label class="bc-field"><span>卡片类型</span><select v-model="cardDraft.kind"><option value="limited-count">限时限次</option><option value="unlimited">不限次数</option><option value="stored-value">储值卡</option></select></label><label class="bc-field"><span>售价（元）</span><input v-model.number="cardDraft.price" type="number" min="0" step="0.01" /></label><label v-if="cardDraft.kind === 'limited-count'" class="bc-field"><span>使用次数</span><input v-model.number="cardDraft.sessions" type="number" min="1" /></label><label v-else-if="cardDraft.kind === 'stored-value'" class="bc-field"><span>储值金额（元）</span><input v-model.number="cardDraft.storedValue" type="number" min="0.01" step="0.01" /></label><label class="bc-field"><span>有效天数</span><input v-model.number="cardDraft.validityDays" type="number" min="1" /></label><label class="bc-field"><span>适用课程</span><input v-model="cardDraft.applicable" placeholder="团课 / 孕产瑜伽" /></label><label class="bc-field"><span>每人限购张数</span><input v-model.number="cardDraft.maxPerStudent" type="number" min="1" /></label><label class="bc-field"><span>允许带人约课</span><input v-model="cardDraft.allowGuestBooking" type="checkbox" /></label><label class="bc-field"><span>发卡后立即开卡</span><input v-model="cardDraft.opensImmediately" type="checkbox" /></label><label class="bc-field bc-field--wide"><span>约课须知</span><textarea v-model="cardDraft.bookingNotice" rows="2"></textarea></label><div class="bc-form__foot"><span>模板变化不会覆盖已发出的会员卡。</span><button class="bc-button bc-button--primary" :disabled="loading">保存卡片模板</button></div></form></section></div>
          <div v-if="activeDialog === 'issue-card'" class="bc-modal-backdrop" role="presentation" @click.self="closeDialog"><section class="bc-card bc-form-card bc-modal" role="dialog" aria-modal="true" aria-labelledby="issue-card-dialog-title"><div class="bc-card__head"><div><h2 id="issue-card-dialog-title">给学员发卡</h2><p>按姓名或手机号查找，重名时选择正确学员。</p></div><button type="button" class="bc-icon-button" aria-label="关闭" @click="closeDialog">×</button></div><form class="bc-form bc-form--schedule" @submit.prevent="issueCard"><label class="bc-field"><span>学员姓名或手机号 <b>*</b></span><span class="bc-input-unit"><input v-model="issueDraft.studentQuery" required placeholder="学员姓名、手机号末四位" /><button type="button" class="bc-button bc-button--plain" @click="searchIssueStudents">查找</button></span></label><label class="bc-field"><span>卡片模板 <b>*</b></span><select v-model="issueDraft.templateId" required><option v-for="template in data.cardTemplates" :key="template.id" :value="template.id">{{ template.name }} · {{ cardQuota(template) }}</option></select></label><div v-if="issueMatches.length" class="bc-candidate-list bc-field--wide"><button v-for="student in issueMatches" :key="student.id" type="button" :class="{ selected: issueDraft.studentId === student.id }" @click="issueDraft.studentId = student.id"><strong>{{ student.name }}</strong><span>{{ student.phone }} · 已持 {{ student.activeCards }} 张可用卡</span></button></div><div class="bc-form__foot"><span>发卡后自动计算有效期和可用次数。</span><button class="bc-button bc-button--primary" :disabled="loading || !issueDraft.studentId">确认发卡</button></div></form></section></div>
          <section class="bc-card bc-list-card"><div class="bc-card__head"><div><h2>卡片模板 <small>{{ data.cardTemplates.length }}</small></h2><p>课程可使用的会员卡与适用范围</p></div><div class="bc-row-actions"><button type="button" class="bc-button bc-button--plain" @click="openDialog('issue-card')">给学员发卡</button><button type="button" class="bc-button bc-button--primary" @click="openDialog('card-template')">＋ 新建模板</button></div></div><div class="bc-card-template-grid"><article v-for="card in data.cardTemplates" :key="card.id" class="bc-card-template"><span class="bc-card-template__symbol">冰草 <i>MEMBERSHIP</i></span><strong>{{ card.name }}</strong><p>{{ card.applicable }}</p><div><span>{{ cardQuota(card) }}</span><b>¥{{ card.price.toLocaleString() }}</b></div><small>有效期 {{ card.validityDays }} 天 · {{ activeCards.filter((item) => item.card.templateId === card.id).length }} 位持卡学员在使用</small></article></div></section>
          <section class="bc-card bc-list-card"><div class="bc-card__head"><div><h2>会员卡记录 <small>{{ allStudentCards.length }}</small></h2><p>包含待开卡、可使用和已失效的卡片</p></div></div><div class="bc-table-scroll"><table class="bc-table"><thead><tr><th>学员</th><th>会员卡</th><th>余额 / 剩余</th><th>有效期</th><th>状态</th></tr></thead><tbody><tr v-for="item in allStudentCards" :key="item.card.id"><td>{{ item.student.name }}</td><td>{{ item.template?.name ?? "未知卡片" }}</td><td>{{ item.template?.kind === "stored-value" ? `¥${(item.card.balance ?? 0).toLocaleString()}` : item.template?.kind === "unlimited" ? "不限次" : `${item.card.remaining} 次` }}</td><td>{{ item.card.status === 'pending' ? "开卡后计算" : item.card.expiresOn }}</td><td><span class="bc-status" :class="item.card.status === 'active' ? 'is-green' : item.card.status === 'pending' ? 'is-blue' : 'is-gray'">{{ item.card.status === 'active' ? "可使用" : item.card.status === 'pending' ? "待开卡" : item.card.status === 'expired' ? "已过期" : "已用完" }}</span></td></tr></tbody></table></div></section>
        </template>

        <template v-else-if="activeSection === 'bookings' || activeSection === 'no-shows'">
          <section class="bc-card bc-list-card"><div class="bc-card__head"><div><h2>{{ activeSection === 'no-shows' ? "爽约记录" : "预约记录" }} <small>{{ activeSection === 'no-shows' ? noShowBookings.length : data.bookings.length }}</small></h2><p>{{ activeSection === 'no-shows' ? "记录未到课预约，供门店核实与跟进" : "查看学员预约课程与到课情况" }}</p></div><button v-if="activeSection === 'bookings'" type="button" class="bc-button bc-button--plain" @click="activeSection = 'no-shows'">只看爽约</button></div><div class="bc-table-scroll"><table class="bc-table"><thead><tr><th>学员</th><th>课程</th><th>上课时间</th><th>授课老师</th><th>预约状态</th></tr></thead><tbody><tr v-for="booking in data.bookings.filter((item) => activeSection !== 'no-shows' || item.status === 'no-show')" :key="booking.id"><td><strong>{{ studentName(booking.studentId) }}</strong></td><td>{{ courseName(data.lessons.find((lesson) => lesson.id === booking.lessonId)?.courseId ?? '') }}</td><td>{{ formatDate(data.lessons.find((lesson) => lesson.id === booking.lessonId)?.date ?? today) }} {{ data.lessons.find((lesson) => lesson.id === booking.lessonId)?.start }}</td><td>{{ teacherName(data.lessons.find((lesson) => lesson.id === booking.lessonId)?.teacherId ?? '') }}</td><td><span class="bc-status" :class="booking.status === 'no-show' ? 'is-red' : booking.status === 'checked-in' ? 'is-green' : 'is-blue'">{{ booking.status === 'no-show' ? "爽约" : booking.status === 'checked-in' ? "已签到" : "已预约" }}</span></td></tr></tbody></table></div><p v-if="activeSection === 'no-shows' && !noShowBookings.length" class="bc-empty">当前没有待跟进的爽约记录。</p></section>
        </template>

        <template v-else-if="activeSection === 'settings'">
          <section class="bc-card bc-form-card"><div class="bc-card__head"><div><h2>店铺信息</h2><p>当前测试门店资料（只读示例）</p></div><span class="bc-status is-blue">已认证</span></div><div class="bc-setting-grid"><div><small>店铺名称</small><strong>冰草瑜伽 · 测试门店</strong></div><div><small>门店类型</small><strong>瑜伽 / 普拉提</strong></div><div><small>所在城市</small><strong>浙江省 · 杭州市</strong></div><div><small>营业时间</small><strong>09:00 – 21:30</strong></div><div><small>联系手机</small><strong>138 **** 8021</strong></div></div><div class="bc-setting-notice">这是仿制演示数据，不会读取或修改真实门店信息。</div></section>
        </template>

        <footer class="bc-main__foot"><span>冰草约课管理系统 · 本地交互演示</span><span>数据由 setTimeout + localStorage 模拟 <button type="button" @click="resetDemo">恢复初始数据</button></span></footer>
      </div>
    </main>

    <aside v-if="integrated" class="bc-assistant">
      <div class="bc-assistant__head"><div><span class="bc-assistant__status"><i></i> 在线</span><strong>门店助手</strong><small>当前账号的门店能力与业务规则</small></div><span class="bc-assistant__spark">✳</span></div>
      <IntegratedAgent :api="api" :data="data" :page="title" @changed="refresh" @notice="showNotice" @navigate="navigateFromAgent" @open-course="showCourse" @show-student-cards="showStudentCards" />
      <div class="bc-assistant__foot"><span>所有写操作均由业务服务校验</span><button type="button" title="当前助手使用业务动作和任务定义">?</button></div>
    </aside>

    <div v-if="toast" class="bc-toast" role="status"><span>✓</span>{{ toast }}</div>
  </div>
</template>
