import type {
  CreateCourseInput,
  CreateAvailabilityInput,
  CreateCardTemplateInput,
  CreateLessonInput,
  BookPrivateLessonInput,
  CardTemplate,
  Course,
  Lesson,
  Student,
  StudentCard,
  Teacher,
  WorkspaceData,
  PrivateAvailability,
  PrivateBooking,
} from "./types";
import { BUSINESS_TIME_ZONE, localDateAt, upcomingWeekdayDates } from "./calendar";

const STORAGE_KEY = "bingcao:admin-workflows:workspace:v1";

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface MockApiOptions {
  storage?: StoragePort;
  delay?: (milliseconds: number) => Promise<void>;
  latencyMs?: number;
  businessTimeZone?: string;
  /** Injected business clock, mainly for deterministic recurrence tests. */
  now?: () => Date;
}

export interface LessonSeriesInput {
  courseId: string;
  teacherId: string;
  weekday: number;
  weeks: number;
  start: string;
  duration: number;
  room: string;
  capacity: number;
}

export interface LessonSeriesPreview {
  dates: string[];
  occurrences: Array<{ date: string; available: boolean; conflicts: SlotCheck["conflicts"] }>;
  available: boolean;
}

export interface StudentMatch {
  id: string;
  name: string;
  phone: string;
  activeCards: number;
}

export type StudentCardsResult =
  | { kind: "one"; student: StudentMatch; cards: Array<StudentCard & { name: string }> }
  | { kind: "many"; candidates: StudentMatch[] }
  | { kind: "none"; candidates: [] };

export interface SlotCheck {
  available: boolean;
  conflicts: Array<{ id: string; course: string; start: string; end: string; room: string }>;
}

export interface WorkspaceApi {
  read(): Promise<WorkspaceData>;
  findStudents(query: string): Promise<StudentMatch[]>;
  getStudentCards(query: string): Promise<StudentCardsResult>;
  createCourse(input: CreateCourseInput): Promise<Course>;
  createTeacher(input: Pick<Teacher, "name" | "phone" | "specialties"> & Partial<Pick<Teacher, "privateEligible" | "yearsExperience" | "introduction">>): Promise<Teacher>;
  checkTeacherSlot(teacherId: string, date: string, start: string, duration: number): Promise<SlotCheck>;
  updateCourse(courseId: string, input: CreateCourseInput): Promise<Course>;
  createLesson(input: CreateLessonInput): Promise<Lesson>;
  previewLessonSeries(input: LessonSeriesInput): Promise<LessonSeriesPreview>;
  createLessonSeries(input: LessonSeriesInput): Promise<Lesson[]>;
  createAvailability(input: CreateAvailabilityInput): Promise<PrivateAvailability>;
  bookPrivateLesson(input: BookPrivateLessonInput): Promise<PrivateBooking>;
  createCardTemplate(input: CreateCardTemplateInput): Promise<WorkspaceData["cardTemplates"][number]>;
  issueCard(studentId: string, templateId: string): Promise<StudentCard>;
  activateCard(studentId: string, cardId: string): Promise<StudentCard>;
  reset(): Promise<WorkspaceData>;
}

const localDelay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function dateOffset(days: number, now = new Date(), timeZone = BUSINESS_TIME_ZONE): string {
  const [year, month, day] = localDateAt(now, timeZone).split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function createSeedWorkspace(now = new Date(), timeZone = BUSINESS_TIME_ZONE): WorkspaceData {
  const teachers: Teacher[] = [
    { id: "t-chen", name: "陈老师", phone: "13800138021", specialties: ["瑜伽", "孕产瑜伽"], status: "active" },
    { id: "t-lin", name: "林老师", phone: "13800138035", specialties: ["普拉提", "体态修复"], status: "active", privateEligible: true, yearsExperience: "5 年以上" },
    { id: "t-wang", name: "王老师", phone: "13800138047", specialties: ["瑜伽", "拉伸"], status: "active" },
    { id: "t-zhao", name: "赵老师", phone: "13800138059", specialties: ["产后恢复"], status: "active" },
    { id: "t-chen-2", name: "陈老师", phone: "13800138062", specialties: ["普拉提"], status: "active", privateEligible: true, yearsExperience: "3 年" },
  ];
  const cardTemplates: CardTemplate[] = [
    { id: "card-month", name: "瑜伽月卡", sessions: 8, price: 680, validityDays: 45, applicable: "瑜伽团课", kind: "limited-count", maxPerStudent: 2, opensImmediately: true, allowGuestBooking: false },
    { id: "card-10", name: "精品课 10 次卡", sessions: 10, price: 1280, validityDays: 120, applicable: "团课 / 精品课", kind: "limited-count", maxPerStudent: 2, opensImmediately: true, allowGuestBooking: false },
    { id: "card-pregnancy", name: "孕产专项 8 次卡", sessions: 8, price: 1680, validityDays: 90, applicable: "孕产瑜伽", kind: "limited-count", maxPerStudent: 1, opensImmediately: true, allowGuestBooking: false },
    { id: "card-private", name: "私教体验卡", sessions: 3, price: 980, validityDays: 60, applicable: "私教课", kind: "limited-count", maxPerStudent: 1, opensImmediately: true, allowGuestBooking: false },
  ];
  const courses: Course[] = [
    { id: "c-yoga-basic", name: "瑜伽基础", category: "瑜伽", teacherId: "t-chen", cardTemplateId: "card-month", difficulty: 2, duration: 60, price: 168, intro: "从基础呼吸和体式开始，建立稳定的练习节奏。", status: "published", bookingNotice: "请提前 10 分钟到店。", deductionCount: 1, room: "瑜伽房 A", capacity: 12, minimumEnrollment: 2, cancelBeforeMinutes: 120, bookingClosesMinutes: 3, notifications: [120], homepageVisible: true },
    { id: "c-pilates", name: "核心床普拉提", category: "普拉提", teacherId: "t-lin", cardTemplateId: "card-10", difficulty: 3, duration: 50, price: 238, intro: "通过器械训练改善核心稳定与身体控制。", status: "published", deductionCount: 1, room: "器械房", capacity: 6, minimumEnrollment: 1, notifications: [120], homepageVisible: true },
    { id: "c-prenatal", name: "孕产瑜伽", category: "孕产", teacherId: "t-zhao", cardTemplateId: "card-pregnancy", difficulty: 1, duration: 60, price: 198, intro: "为孕期不同阶段提供温和、安全的练习。", status: "published", bookingNotice: "请提前告知孕周和身体状况。", deductionCount: 1, room: "瑜伽房 B", capacity: 8, minimumEnrollment: 2, autoCancelBelowMinimum: true, cancelBeforeMinutes: 120, bookingOpensMinutes: 10080, bookingClosesMinutes: 3, notifications: [120, 30], homepageVisible: true },
    { id: "c-private-assessment", name: "私教体态评估", category: "私教", teacherId: "t-lin", cardTemplateId: "card-private", difficulty: 2, duration: 60, price: 680, intro: "一对一评估活动度与体态特点，制定个人练习方案。", status: "published", bookingNotice: "预约前请准备近期运动情况。", deductionCount: 1, room: "私教室", capacity: 1, minimumEnrollment: 1, notifications: [120], homepageVisible: true },
    { id: "c-stretch", name: "午间舒展", category: "瑜伽", teacherId: "t-wang", cardTemplateId: "card-month", difficulty: 1, duration: 45, price: 128, intro: "用简单的拉伸动作缓解久坐带来的紧张。", status: "draft", room: "瑜伽房 A", capacity: 10, minimumEnrollment: 1, homepageVisible: false },
  ];
  const students: Student[] = [
    { id: "s-lin", name: "林悦", phone: "13910001234", joinedOn: dateOffset(-110, now, timeZone), cards: [{ id: "sc-101", studentId: "s-lin", templateId: "card-month", remaining: 3, expiresOn: dateOffset(18, now, timeZone), status: "active" }, { id: "sc-102", studentId: "s-lin", templateId: "card-private", remaining: 1, expiresOn: dateOffset(33, now, timeZone), status: "active" }] },
    { id: "s-zhou", name: "周宁", phone: "13910005678", joinedOn: dateOffset(-84, now, timeZone), cards: [{ id: "sc-103", studentId: "s-zhou", templateId: "card-10", remaining: 6, expiresOn: dateOffset(62, now, timeZone), status: "active" }] },
    { id: "s-chen", name: "陈静", phone: "13910009876", joinedOn: dateOffset(-64, now, timeZone), cards: [{ id: "sc-104", studentId: "s-chen", templateId: "card-pregnancy", remaining: 5, expiresOn: dateOffset(46, now, timeZone), status: "active" }] },
    { id: "s-lin-2", name: "林悦", phone: "13910004321", joinedOn: dateOffset(-20, now, timeZone), cards: [{ id: "sc-105", studentId: "s-lin-2", templateId: "card-month", remaining: 1, expiresOn: dateOffset(6, now, timeZone), status: "active" }] },
    { id: "s-wu", name: "吴晓", phone: "13910001111", joinedOn: dateOffset(-210, now, timeZone), cards: [{ id: "sc-106", studentId: "s-wu", templateId: "card-10", remaining: 0, expiresOn: dateOffset(-20, now, timeZone), status: "exhausted" }] },
  ];
  const lessons: Lesson[] = [
    { id: "l-401", courseId: "c-yoga-basic", teacherId: "t-chen", date: dateOffset(0, now, timeZone), start: "10:00", duration: 60, room: "瑜伽房 A", capacity: 12, booked: 9, status: "scheduled" },
    { id: "l-402", courseId: "c-pilates", teacherId: "t-lin", date: dateOffset(0, now, timeZone), start: "14:00", duration: 50, room: "器械房", capacity: 6, booked: 4, status: "scheduled" },
    { id: "l-403", courseId: "c-prenatal", teacherId: "t-zhao", date: dateOffset(1, now, timeZone), start: "09:30", duration: 60, room: "瑜伽房 B", capacity: 8, booked: 5, status: "scheduled" },
    { id: "l-404", courseId: "c-yoga-basic", teacherId: "t-wang", date: dateOffset(1, now, timeZone), start: "18:30", duration: 60, room: "瑜伽房 A", capacity: 12, booked: 11, status: "scheduled" },
  ];
  const bookings = [
    { id: "b-01", studentId: "s-lin", lessonId: "l-401", status: "booked" as const },
    { id: "b-02", studentId: "s-zhou", lessonId: "l-401", status: "checked-in" as const },
    { id: "b-03", studentId: "s-chen", lessonId: "l-403", status: "booked" as const },
    { id: "b-04", studentId: "s-wu", lessonId: "l-402", status: "no-show" as const },
  ];
  return {
    teachers, courses, cardTemplates, students, lessons, bookings,
    privateAvailability: [{ id: "pa-1", teacherId: "t-lin", date: dateOffset(1, now, timeZone), start: "10:00", end: "12:00", status: "available" }],
    privateBookings: [],
  };
}

function maskPhone(phone: string): string {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) throw new Error("请使用 HH:mm 时间格式。");
  if (hours === undefined || minutes === undefined || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error("请使用有效的 HH:mm 时间。");
  }
  return hours * 60 + minutes;
}

export function createMockApi(options: MockApiOptions = {}): WorkspaceApi {
  const storage = options.storage ?? browserStorage();
  const delay = options.delay ?? localDelay;
  const latencyMs = options.latencyMs ?? 240;
  const businessTimeZone = options.businessTimeZone ?? BUSINESS_TIME_ZONE;
  const now = options.now ?? (() => new Date());
  let state = readInitial();
  let sequence = 500;

  function readInitial(): WorkspaceData {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return createSeedWorkspace(now(), businessTimeZone);
    try {
      const parsed = JSON.parse(raw) as WorkspaceData;
      if (Array.isArray(parsed.courses) && Array.isArray(parsed.teachers) && Array.isArray(parsed.students)) return parsed;
    } catch {
      storage?.removeItem(STORAGE_KEY);
    }
    return createSeedWorkspace(now(), businessTimeZone);
  }

  function persist(): void {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async function wait(): Promise<void> {
    await delay(latencyMs);
  }

  function studentMatches(query: string): Student[] {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    const digits = normalized.replace(/\D/g, "");
    return state.students.filter((student) =>
      student.name.toLocaleLowerCase().includes(normalized) ||
      student.id.toLocaleLowerCase() === normalized ||
      (digits.length >= 4 && student.phone.includes(digits)),
    );
  }

  function studentSummary(student: Student): StudentMatch {
    return {
      id: student.id,
      name: student.name,
      phone: maskPhone(student.phone),
      activeCards: student.cards.filter((card) => card.status === "active" && card.remaining > 0).length,
    };
  }

  function checkSlot(teacherId: string, date: string, start: string, duration: number, room?: string): SlotCheck {
    const startAt = toMinutes(start);
    const endAt = startAt + duration;
    const conflicts = state.lessons
      .filter((lesson) => lesson.date === date && lesson.status === "scheduled" && (lesson.teacherId === teacherId || (room && lesson.room.toLocaleLowerCase() === room.trim().toLocaleLowerCase())))
      .filter((lesson) => {
        const otherStart = toMinutes(lesson.start);
        return startAt < otherStart + lesson.duration && otherStart < endAt;
      })
      .map((lesson) => ({
        id: lesson.id,
        course: state.courses.find((course) => course.id === lesson.courseId)?.name ?? "已删除课程",
        start: lesson.start,
        end: `${String(Math.floor((toMinutes(lesson.start) + lesson.duration) / 60)).padStart(2, "0")}:${String((toMinutes(lesson.start) + lesson.duration) % 60).padStart(2, "0")}`,
        room: lesson.room,
      }));
    return { available: conflicts.length === 0, conflicts };
  }

  function previewLessonSeriesNow(input: LessonSeriesInput): LessonSeriesPreview {
    if (!state.courses.some((course) => course.id === input.courseId && course.status === "published" && course.category !== "私教")) {
      throw new Error("请选择已发布的团课。");
    }
    if (!state.teachers.some((teacher) => teacher.id === input.teacherId && teacher.status === "active")) {
      throw new Error("请选择在职老师。");
    }
    if (!input.room.trim()) throw new Error("请填写教室。");
    if (!Number.isInteger(input.duration) || input.duration < 15 || input.duration > 240) throw new Error("课时时长需在 15 到 240 分钟之间。");
    if (input.capacity < 1 || input.capacity > 40) throw new Error("名额需在 1 到 40 人之间。");
    const dates = upcomingWeekdayDates(input.weekday, input.weeks, now(), businessTimeZone);
    const occurrences = dates.map((date) => {
      const slot = checkSlot(input.teacherId, date, input.start, input.duration, input.room);
      return { date, available: slot.available, conflicts: slot.conflicts };
    });
    return { dates, occurrences, available: occurrences.every((item) => item.available) };
  }

  function validateCourseInput(input: CreateCourseInput, currentCourseId?: string): string {
    const name = input.name.trim();
    if (name.length < 2) throw new Error("课程名称至少需要 2 个字。");
    if (state.courses.some((course) => course.id !== currentCourseId && course.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error("已有同名课程，请先确认名称。");
    const teacher = state.teachers.find((item) => item.id === input.teacherId && item.status === "active");
    if (!teacher) throw new Error("请选择一位在职老师。");
    if (input.category === "私教" && !teacher.privateEligible) throw new Error("私教课程只能分配给已开通私教资格的老师。");
    if (!state.cardTemplates.some((item) => item.id === input.cardTemplateId)) throw new Error("请选择适用卡片。");
    if (!Number.isInteger(input.difficulty) || input.difficulty < 1 || input.difficulty > 5) throw new Error("课程难度需在 1 到 5 星之间。");
    if (!Number.isFinite(input.price) || input.price < 0) throw new Error("课程价格不能小于 0。");
    if (!Number.isInteger(input.duration) || input.duration < 15 || input.duration > 240) throw new Error("课程时长需在 15 到 240 分钟之间。");
    if (input.capacity !== undefined && (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 40)) throw new Error("最大人数需在 1 到 40 人之间。");
    if (input.minimumEnrollment !== undefined && (!Number.isInteger(input.minimumEnrollment) || input.minimumEnrollment < 1)) throw new Error("最低开课人数至少为 1 人。");
    if (input.minimumEnrollment !== undefined && input.capacity !== undefined && input.minimumEnrollment > input.capacity) throw new Error("最低开课人数不能超过最大人数。");
    return name;
  }

  return {
    async read() {
      await wait();
      return copy(state);
    },
    async findStudents(query) {
      await wait();
      return studentMatches(query).slice(0, 10).map(studentSummary);
    },
    async getStudentCards(query) {
      await wait();
      const matches = studentMatches(query);
      if (matches.length === 0) return { kind: "none", candidates: [] };
      if (matches.length > 1) return { kind: "many", candidates: matches.map(studentSummary) };
      const student = matches[0]!;
      const cards = student.cards.map((card) => ({
        ...copy(card),
        name: state.cardTemplates.find((template) => template.id === card.templateId)?.name ?? "未知卡片",
      }));
      return { kind: "one", student: studentSummary(student), cards };
    },
    async createCourse(input) {
      await wait();
      const name = validateCourseInput(input);
      const course: Course = { ...copy(input), difficulty: input.difficulty as Course["difficulty"], id: `c-${++sequence}`, name, intro: input.intro.trim(), status: "published" };
      state.courses.unshift(course);
      persist();
      return copy(course);
    },
    async updateCourse(courseId, input) {
      await wait();
      const index = state.courses.findIndex((course) => course.id === courseId);
      if (index < 0) throw new Error("找不到要修改的课程。");
      const name = validateCourseInput(input, courseId);
      const updated: Course = { ...state.courses[index]!, ...copy(input), difficulty: input.difficulty as Course["difficulty"], name, intro: input.intro.trim() };
      state.courses[index] = updated;
      persist();
      return copy(updated);
    },
    async createTeacher(input) {
      await wait();
      const name = input.name.trim();
      const phone = input.phone.trim();
      if (name.length < 2) throw new Error("老师姓名至少需要 2 个字。");
      if (!/^1\d{10}$/.test(phone)) throw new Error("请输入 11 位手机号。");
      if (state.teachers.some((teacher) => teacher.phone === phone)) throw new Error("这个手机号已经登记过了。");
      const teacher = { ...copy(input), id: `t-${++sequence}`, name, phone, specialties: input.specialties.map((item) => item.trim()).filter(Boolean), status: "active" as const };
      state.teachers.unshift(teacher);
      persist();
      return copy(teacher);
    },
    async checkTeacherSlot(teacherId, date, start, duration) {
      await wait();
      if (!state.teachers.some((teacher) => teacher.id === teacherId && teacher.status === "active")) throw new Error("找不到在职老师。");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("请提供有效日期。");
      return checkSlot(teacherId, date, start, duration);
    },
    async createLesson(input) {
      await wait();
      if (!state.courses.some((course) => course.id === input.courseId && course.status === "published")) throw new Error("请选择已发布课程。");
      if (!state.teachers.some((teacher) => teacher.id === input.teacherId && teacher.status === "active")) throw new Error("请选择在职老师。");
      if (!input.room.trim()) throw new Error("请填写教室。");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < dateOffset(0, now(), businessTimeZone)) throw new Error("请选择今天或之后的有效日期。");
      if (!Number.isInteger(input.duration) || input.duration < 15 || input.duration > 240) throw new Error("课时时长需在 15 到 240 分钟之间。");
      if (input.capacity < 1 || input.capacity > 40) throw new Error("名额需在 1 到 40 人之间。");
      const slot = checkSlot(input.teacherId, input.date, input.start, input.duration, input.room);
      if (!slot.available) {
        const teacherConflict = slot.conflicts.some((item) => item.id && state.lessons.find((lesson) => lesson.id === item.id)?.teacherId === input.teacherId);
        const reason = teacherConflict ? "老师该时段已有安排" : "教室该时段已被占用";
        throw new Error(`${reason}：${slot.conflicts.map((item) => `${item.course} ${item.start}–${item.end}`).join("、")}`);
      }
      const lesson: Lesson = { ...copy(input), id: `l-${++sequence}`, booked: 0, status: "scheduled" };
      state.lessons.unshift(lesson);
      persist();
      return copy(lesson);
    },
    async previewLessonSeries(input) {
      await wait();
      return copy(previewLessonSeriesNow(input));
    },
    async createLessonSeries(input) {
      await wait();
      const preview = previewLessonSeriesNow(input);
      const conflicts = preview.occurrences.filter((item) => !item.available);
      if (conflicts.length) {
        throw new Error(`批量排课未创建任何课时。${conflicts.map((item) => `${item.date}：${item.conflicts.map((conflict) => `${conflict.course} ${conflict.start}–${conflict.end}`).join("、")}`).join("；")}`);
      }
      const lessons = preview.dates.map((date): Lesson => ({
        id: `l-${++sequence}`,
        courseId: input.courseId,
        teacherId: input.teacherId,
        date,
        start: input.start,
        duration: input.duration,
        room: input.room.trim(),
        capacity: input.capacity,
        booked: 0,
        status: "scheduled",
      }));
      state.lessons.unshift(...lessons);
      persist();
      return copy(lessons);
    },
    async createAvailability(input) {
      await wait();
      const teacher = state.teachers.find((item) => item.id === input.teacherId && item.status === "active" && item.privateEligible);
      if (!teacher) throw new Error("请选择已开通私教资格的在职老师。");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < dateOffset(0, now(), businessTimeZone)) throw new Error("请选择今天或之后的有效日期。");
      const startAt = toMinutes(input.start);
      const endAt = toMinutes(input.end);
      if (endAt <= startAt) throw new Error("可约时间的结束时间必须晚于开始时间。");
      const overlaps = state.privateAvailability.some((slot) => slot.teacherId === input.teacherId && slot.date === input.date && startAt < toMinutes(slot.end) && toMinutes(slot.start) < endAt);
      if (overlaps) throw new Error("这段时间与老师已有的私教时间重叠。");
      const groupConflict = state.lessons.some((lesson) => lesson.teacherId === input.teacherId && lesson.date === input.date && lesson.status === "scheduled" && startAt < toMinutes(lesson.start) + lesson.duration && toMinutes(lesson.start) < endAt);
      if (groupConflict) throw new Error("老师这段时间已有团课安排。");
      const slot: PrivateAvailability = { ...copy(input), id: `pa-${++sequence}`, status: "available" };
      state.privateAvailability.unshift(slot);
      persist();
      return copy(slot);
    },
    async bookPrivateLesson(input) {
      await wait();
      const slot = state.privateAvailability.find((item) => item.id === input.availabilityId && item.status === "available");
      if (!slot) throw new Error("这个私教时段已不可预约，请刷新后重新选择。");
      const course = state.courses.find((item) => item.id === input.courseId && item.status === "published" && item.category === "私教");
      if (!course) throw new Error("请选择已发布的私教课程。");
      if (course.teacherId !== slot.teacherId) throw new Error("所选老师没有开设这门私教课程。");
      const students = studentMatches(input.studentQuery);
      if (students.length !== 1) throw new Error(students.length ? "学员姓名重复，请补充手机号末四位。" : "没有找到这位学员。");
      const student = students[0]!;
      const card = student.cards.find((item) => item.templateId === course.cardTemplateId && item.status === "active" && item.remaining > 0 && item.expiresOn >= slot.date);
      if (!card) throw new Error("学员没有适用于该课程且在上课日有效的会员卡。");
      const booking: PrivateBooking = {
        id: `pb-${++sequence}`,
        availabilityId: slot.id,
        teacherId: slot.teacherId,
        courseId: course.id,
        studentId: student.id,
        cardId: card.id,
        status: "booked",
      };
      slot.status = "booked";
      state.privateBookings.unshift(booking);
      persist();
      return copy(booking);
    },
    async createCardTemplate(input) {
      await wait();
      const name = input.name.trim();
      if (name.length < 2) throw new Error("卡片名称至少需要 2 个字。");
      if (state.cardTemplates.some((template) => template.name === name)) throw new Error("已经有同名卡片，请修改名称。");
      if (input.price < 0 || input.validityDays < 1 || input.maxPerStudent < 1) throw new Error("请检查售价、有效期和限购数量。");
      if (input.kind === "limited-count" && (!Number.isInteger(input.sessions) || input.sessions < 1)) throw new Error("限次卡至少需要 1 次。");
      if (input.kind === "stored-value" && (!Number.isFinite(input.storedValue) || (input.storedValue ?? 0) <= 0)) throw new Error("储值卡金额必须大于 0。");
      const template = { ...copy(input), sessions: input.kind === "limited-count" ? input.sessions : 0, id: `card-${++sequence}` };
      state.cardTemplates.unshift(template);
      persist();
      return copy(template);
    },
    async issueCard(studentId, templateId) {
      await wait();
      const student = state.students.find((item) => item.id === studentId);
      const template = state.cardTemplates.find((item) => item.id === templateId);
      if (!student || !template) throw new Error("请重新选择学员和卡片。");
      const issuedCount = student.cards.filter((card) => card.templateId === templateId).length;
      if (template.maxPerStudent !== undefined && issuedCount >= template.maxPerStudent) throw new Error("该学员已达到这张卡的限购数量。");
      const startsImmediately = template.opensImmediately !== false;
      const expires = new Date();
      expires.setDate(expires.getDate() + template.validityDays);
      const card: StudentCard = {
        id: `sc-${++sequence}`,
        studentId,
        templateId,
        remaining: template.kind === "unlimited" ? Number.MAX_SAFE_INTEGER : template.kind === "stored-value" ? 0 : template.sessions,
        expiresOn: startsImmediately ? `${expires.getFullYear()}-${String(expires.getMonth() + 1).padStart(2, "0")}-${String(expires.getDate()).padStart(2, "0")}` : "",
        status: startsImmediately ? "active" : "pending",
        ...(template.kind === "stored-value" ? { balance: template.storedValue ?? template.price } : {}),
      };
      student.cards.unshift(card);
      persist();
      return copy(card);
    },
    async activateCard(studentId, cardId) {
      await wait();
      const student = state.students.find((item) => item.id === studentId);
      const card = student?.cards.find((item) => item.id === cardId);
      if (!student || !card) throw new Error("找不到这张会员卡。");
      if (card.status !== "pending") throw new Error("只有待开卡的会员卡可以激活。");
      const template = state.cardTemplates.find((item) => item.id === card.templateId);
      if (!template) throw new Error("找不到会员卡模板。");
      const expires = new Date();
      expires.setDate(expires.getDate() + template.validityDays);
      card.expiresOn = `${expires.getFullYear()}-${String(expires.getMonth() + 1).padStart(2, "0")}-${String(expires.getDate()).padStart(2, "0")}`;
      card.status = "active";
      persist();
      return copy(card);
    },
    async reset() {
      await wait();
      state = createSeedWorkspace(now(), businessTimeZone);
      storage?.removeItem(STORAGE_KEY);
      return copy(state);
    },
  };
}

function browserStorage(): StoragePort | undefined {
  try {
    if (typeof window !== "undefined") return window.localStorage;
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // Storage can be unavailable in sandboxed browser contexts.
  }
  return undefined;
}
