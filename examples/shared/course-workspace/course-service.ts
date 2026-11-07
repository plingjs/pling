import type { TaskChoice } from "@plingjs/agent";
import { COPY, fill, type Locale } from "./copy";

export interface MembershipCard {
  id: string;
  name: string;
  remaining: number;
  expiresAt: string;
}

export interface Student {
  id: string;
  name: string;
  phoneMasked: string;
  cards: MembershipCard[];
}

export interface Teacher {
  id: string;
  name: string;
  phone: string;
  subject: string;
}

export interface Course {
  id: string;
  name: string;
  cover: "yoga" | "pilates" | "private";
  coverLabel: string;
  teacher: string;
  cards: string;
  rating: string;
  deduct: string;
  price: string;
  status: "published" | "draft";
  statusLabel: string;
  difficulty: number;
  intro?: string;
  note?: string;
}

export interface Lesson {
  id: string;
  studentId: string;
  teacherId: string;
  date: string;
  time: string;
  course: string;
  note?: string;
}

export interface Activity {
  id: string;
  kind: "cards" | "teacher" | "course" | "lesson" | "note" | "blocked";
  title: string;
  detail: string;
}

export interface CourseService {
  readonly courses: readonly Course[];
  readonly students: readonly Student[];
  readonly teachers: readonly Teacher[];
  readonly lessons: readonly Lesson[];
  readonly activity: readonly Activity[];
  searchStudents(query: string): TaskChoice[];
  getStudentCards(args: Record<string, unknown>): { message: string };
  createTeacher(args: Record<string, unknown>): { message: string; teacherId: string };
  createCourse(args: Record<string, unknown>): { message: string; courseId: string };
  checkSlot(args: Record<string, unknown>): { message: string };
  createLesson(args: Record<string, unknown>): { message: string; lessonId: string };
  updateLessonNote(args: Record<string, unknown>): { message: string; lessonId: string };
}

function required(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  throw new Error(`Missing argument: ${key}`);
}

export function createCourseService(locale: Locale, onChange: () => void, seedCourses: readonly Course[] = []): CourseService {
  const copy = COPY[locale];
  const courses: Course[] = seedCourses.map((course) => ({ ...course }));
  const students: Student[] = [
    {
      id: "stu_1",
      name: locale === "zh" ? "李娜" : "Li Na",
      phoneMasked: "138****1234",
      cards: [
        { id: "card_1", name: locale === "zh" ? "月卡" : "Monthly card", remaining: 8, expiresAt: "2026-12-31" },
        { id: "card_2", name: locale === "zh" ? "私教 10 次卡" : "10-class personal training", remaining: 2, expiresAt: "2026-09-30" },
      ],
    },
    {
      id: "stu_2",
      name: locale === "zh" ? "李娜" : "Li Na",
      phoneMasked: "139****5678",
      cards: [
        { id: "card_3", name: locale === "zh" ? "次卡" : "Class pack", remaining: 6, expiresAt: "2026-08-20" },
      ],
    },
    {
      id: "stu_3",
      name: locale === "zh" ? "王浩" : "Wang Hao",
      phoneMasked: "136****4410",
      cards: [],
    },
  ];

  const teachers: Teacher[] = [
    { id: "tea_1", name: locale === "zh" ? "周敏" : "Zhou Min", phone: "138 0013 8801", subject: locale === "zh" ? "瑜伽" : "Yoga" },
    { id: "tea_2", name: locale === "zh" ? "林琳" : "Lin Lin", phone: "139 0011 2048", subject: locale === "zh" ? "普拉提" : "Pilates" },
  ];

  const lessons: Lesson[] = [
    { id: "lesson_1", studentId: "stu_1", teacherId: "tea_1", date: "2026-03-16", time: "10:00", course: locale === "zh" ? "瑜伽基础" : "Yoga foundations" },
    { id: "lesson_2", studentId: "stu_3", teacherId: "tea_2", date: "2026-03-17", time: "14:00", course: locale === "zh" ? "普拉提入门" : "Pilates intro" },
  ];

  const activity: Activity[] = [];
  let sequence = 1;

  const studentById = (id: string): Student => {
    const student = students.find((item) => item.id === id);
    if (!student) throw new Error(copy.studentMissing);
    return student;
  };

  const teacherById = (id: string): Teacher => {
    const teacher = teachers.find((item) => item.id === id);
    if (!teacher) throw new Error(copy.teacherMissing);
    return teacher;
  };

  const lessonById = (id: string): Lesson => {
    const lesson = lessons.find((item) => item.id === id);
    if (!lesson) throw new Error(copy.lessonMissing);
    return lesson;
  };

  const record = (kind: Activity["kind"], title: string, detail: string): void => {
    activity.unshift({ id: `act_${sequence++}`, kind, title, detail });
    onChange();
  };

  return {
    courses,
    students,
    teachers,
    lessons,
    activity,

    searchStudents(query) {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return [];
      const digitsQuery = normalized.replace(/\D/g, "");
      return students
        .filter((student) => {
          const digits = student.phoneMasked.replace(/\D/g, "");
          return student.name.toLowerCase().includes(normalized) || (digitsQuery.length > 0 && digits.includes(digitsQuery));
        })
        .map((student) => ({
          value: student.id,
          label: student.name,
          description: `${student.phoneMasked} · ${student.cards.length} ${locale === "zh" ? "张卡" : "cards"}`,
        }));
    },

    getStudentCards(args) {
      const student = studentById(required(args, "studentId"));
      const cardText = student.cards.length
        ? student.cards.map((card) => fill(copy.cardLine, { name: card.name, remaining: card.remaining })).join(locale === "zh" ? "；" : "; ")
        : "";
      const message = student.cards.length
        ? fill(copy.cardsFound, {
            name: student.name,
            count: student.cards.length,
            cards: cardText,
          })
        : fill(copy.noCards, { name: student.name });
      record("cards", copy.activityCards, `${student.name} · ${student.phoneMasked}`);
      return { message };
    },

    createTeacher(args) {
      const name = required(args, "name");
      const phone = required(args, "phone");
      const subject = required(args, "subject");
      const teacher: Teacher = { id: `tea_${teachers.length + 1}`, name, phone, subject };
      teachers.push(teacher);
      const message = fill(copy.teacherAdded, { name });
      record("teacher", copy.activityTeacher, `${name} · ${subject}`);
      return { message: `${message} ${locale === "zh" ? "现在可以在排课任务中选择这位老师。" : "The teacher is now available in the scheduling task."}`, teacherId: teacher.id };
    },

    createCourse(args) {
      const name = required(args, "name");
      const teacher = teacherById(required(args, "teacherId"));
      const cards = required(args, "cards");
      const difficulty = Number(args.difficulty ?? 3);
      const price = required(args, "price");
      const deduct = required(args, "deduct");
      if (courses.some((course) => course.name === name)) {
        throw new Error(fill(copy.courseNameExists, { name }));
      }
      if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 5) {
        throw new Error(copy.courseDifficultyInvalid);
      }
      const intro = typeof args.intro === "string" ? args.intro.trim() : "";
      const note = typeof args.note === "string" ? args.note.trim() : "";
      const subject = teacher.subject.toLowerCase();
      const cover = subject.includes("瑜伽") || subject.includes("yoga")
        ? "yoga"
        : subject.includes("普拉提") || subject.includes("pilates")
          ? "pilates"
          : "private";
      const course: Course = {
        id: `course_${courses.length + 1}`,
        name,
        cover,
        coverLabel: cover === "yoga" ? "YOGA" : cover === "pilates" ? "PILATES" : "COURSE",
        teacher: teacher.name,
        cards,
        rating: "—",
        deduct,
        price,
        status: "published",
        statusLabel: locale === "zh" ? "已上架" : "Published",
        difficulty,
        intro: intro || undefined,
        note: note || undefined,
      };
      courses.unshift(course);
      const message = fill(copy.courseCreated, { name, teacher: teacher.name });
      record("course", copy.activityCourse, `${name} · ${teacher.name} · ${cards}`);
      return { message, courseId: course.id };
    },

    checkSlot(args) {
      const teacher = teacherById(required(args, "teacherId"));
      const date = required(args, "date");
      const time = required(args, "time");
      const conflict = lessons.find((lesson) => lesson.teacherId === teacher.id && lesson.date === date && lesson.time === time);
      if (conflict) {
        const message = fill(copy.slotConflict, { teacher: teacher.name, date, time, course: conflict.course });
        record("blocked", copy.activityBlocked, message);
        throw new Error(message);
      }
      onChange();
      return { message: fill(copy.slotFree, { teacher: teacher.name, date, time }) };
    },

    createLesson(args) {
      const student = studentById(required(args, "studentId"));
      const teacher = teacherById(required(args, "teacherId"));
      const date = required(args, "date");
      const time = required(args, "time");
      const course = required(args, "course");
      const conflict = lessons.find((lesson) => lesson.teacherId === teacher.id && lesson.date === date && lesson.time === time);
      if (conflict) {
        const message = fill(copy.slotConflict, { teacher: teacher.name, date, time, course: conflict.course });
        record("blocked", copy.activityBlocked, message);
        throw new Error(message);
      }
      const lesson: Lesson = { id: `lesson_${lessons.length + 1}`, studentId: student.id, teacherId: teacher.id, date, time, course };
      lessons.push(lesson);
      const message = fill(copy.lessonCreated, { course, teacher: teacher.name, student: student.name, date, time });
      record("lesson", copy.activityLesson, message);
      return { message, lessonId: lesson.id };
    },

    updateLessonNote(args) {
      const lesson = lessonById(required(args, "lessonId"));
      const note = required(args, "note");
      lesson.note = note;
      const message = fill(copy.noteSaved, {
        course: lesson.course,
        date: lesson.date,
        time: lesson.time,
      });
      record("note", copy.activityNote, `${lesson.course} · ${note}`);
      return { message, lessonId: lesson.id };
    },
  };
}
