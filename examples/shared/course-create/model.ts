import type { Locale } from "../course-workspace/copy";

export interface CourseTeacher {
  id: string;
  name: string;
  subject: string;
}

export interface CourseDraft {
  name: string;
  teacherId: string;
  teacherName: string;
  cards: string;
  difficulty: number;
  intro: string;
  note: string;
  cover: boolean;
  deduct: string;
  price: string;
}

export type CourseCover = "yoga" | "pilates" | "private";

export interface Course {
  id: string;
  name: string;
  cover: CourseCover;
  coverLabel: string;
  teacher: string;
  teacherId: string;
  cards: string;
  rating: string;
  deduct: string;
  price: string;
  difficulty: number;
  status: "published" | "draft";
  statusLabel: string;
  intro?: string;
  note?: string;
}

export interface RecommendedCourse extends CourseDraft {
  price: string;
  deduct: string;
}

const RECOMMENDED = {
  zh: {
    name: "瑜伽基础",
    difficulty: 3,
    intro: "从基础呼吸和体式开始，建立稳定的练习节奏。",
    cards: "月卡",
    note: "请提前 10 分钟到店；开课前 2 小时内不可取消。",
    price: "200",
    deduct: "1.0",
  },
  en: {
    name: "Yoga foundations",
    difficulty: 3,
    intro: "Start with basic breathing and postures, then build a steady practice rhythm.",
    cards: "Monthly card",
    note: "Please arrive 10 minutes early. Cancellations are not accepted within 2 hours of the class.",
    price: "200",
    deduct: "1.0",
  },
} as const;

const TEACHERS = {
  zh: [
    { id: "tea_zhou", name: "周敏", subject: "瑜伽" },
    { id: "tea_lin", name: "林琳", subject: "普拉提" },
    { id: "tea_chen", name: "陈静", subject: "孕产瑜伽" },
  ],
  en: [
    { id: "tea_zhou", name: "Zhou Min", subject: "Yoga" },
    { id: "tea_lin", name: "Lin Lin", subject: "Pilates" },
    { id: "tea_chen", name: "Chen Jing", subject: "Prenatal yoga" },
  ],
} as const;

export function courseTeachers(locale: Locale): CourseTeacher[] {
  return TEACHERS[locale].map((teacher) => ({ ...teacher }));
}

export function recommendedCourse(locale: Locale, teachers: readonly CourseTeacher[]): RecommendedCourse {
  const values = RECOMMENDED[locale];
  const teacher = teachers[0];
  return {
    ...values,
    teacherId: teacher?.id ?? "",
    teacherName: teacher?.name ?? "",
    cover: false,
  };
}

export function emptyCourseDraft(): CourseDraft {
  return {
    name: "",
    teacherId: "",
    teacherName: "",
    cards: "",
    difficulty: 0,
    intro: "",
    note: "",
    cover: false,
    deduct: "1.0",
    price: "",
  };
}

export function courseCardOptions(locale: Locale): readonly string[] {
  return locale === "zh"
    ? ["月卡", "私教 10 次卡", "单次体验卡"]
    : ["Monthly card", "10-class personal training", "Single-class trial"];
}

export function initialCourses(locale: Locale): Course[] {
  if (locale === "en") {
    return [
      {
        id: "course_1",
        name: "Vinyasa flow",
        cover: "yoga",
        coverLabel: "YOGA",
        teacher: "Zhou Min",
        teacherId: "tea_zhou",
        cards: "Monthly card / 10-class personal training",
        rating: "4.8",
        deduct: "1",
        price: "200",
        difficulty: 4,
        status: "published",
        statusLabel: "Published",
      },
      {
        id: "course_2",
        name: "Pilates foundations",
        cover: "pilates",
        coverLabel: "PILATES",
        teacher: "Lin Lin",
        teacherId: "tea_lin",
        cards: "Class pass / Monthly card",
        rating: "4.6",
        deduct: "1",
        price: "180",
        difficulty: 2,
        status: "published",
        statusLabel: "Published",
      },
      {
        id: "course_3",
        name: "Private trial",
        cover: "private",
        coverLabel: "PRIVATE",
        teacher: "",
        teacherId: "",
        cards: "Single-class trial",
        rating: "5.0",
        deduct: "1",
        price: "299",
        difficulty: 3,
        status: "draft",
        statusLabel: "Draft",
      },
    ];
  }

  return [
    {
      id: "course_1",
      name: "流瑜伽进阶",
      cover: "yoga",
      coverLabel: "YOGA",
      teacher: "周敏",
      teacherId: "tea_zhou",
      cards: "月卡 / 私教 10 次卡",
      rating: "4.8",
      deduct: "1",
      price: "200",
      difficulty: 4,
      status: "published",
      statusLabel: "已上架",
    },
    {
      id: "course_2",
      name: "普拉提入门",
      cover: "pilates",
      coverLabel: "PILATES",
      teacher: "林琳",
      teacherId: "tea_lin",
      cards: "次卡 / 月卡",
      rating: "4.6",
      deduct: "1",
      price: "180",
      difficulty: 2,
      status: "published",
      statusLabel: "已上架",
    },
    {
      id: "course_3",
      name: "私教体验课",
      cover: "private",
      coverLabel: "PRIVATE",
      teacher: "",
      teacherId: "",
      cards: "单次体验卡",
      rating: "5.0",
      deduct: "1",
      price: "299",
      difficulty: 3,
      status: "draft",
      statusLabel: "草稿",
    },
  ];
}

export function createCourseFromDraft(
  locale: Locale,
  courses: readonly Course[],
  draft: CourseDraft,
  teachers: readonly CourseTeacher[],
): Course {
  const name = draft.name.trim();
  if (!name) throw new Error(locale === "zh" ? "请填写课程名称" : "Enter a course name");
  const teacher = teachers.find((item) => item.id === draft.teacherId);
  if (!teacher) throw new Error(locale === "zh" ? "请选择授课老师" : "Choose a teacher");
  const cards = draft.cards.trim();
  if (!cards) throw new Error(locale === "zh" ? "请选择课程可用卡片" : "Choose at least one eligible card");
  if (courses.some((course) => course.name === name)) {
    throw new Error(locale === "zh" ? `课程“${name}”已经存在` : `A course named “${name}” already exists`);
  }

  const subject = teacher.subject.toLowerCase();
  const cover: CourseCover = subject.includes("瑜伽") || subject.includes("yoga")
    ? "yoga"
    : subject.includes("普拉提") || subject.includes("pilates")
      ? "pilates"
      : "private";
  const difficulty = Math.max(1, Math.min(5, Math.round(draft.difficulty || 3)));

  return {
    id: `course_${Date.now()}`,
    name,
    cover,
    coverLabel: cover === "yoga" ? "NEW · YOGA" : cover === "pilates" ? "NEW · PILATES" : "NEW · PRIVATE",
    teacher: teacher.name,
    teacherId: teacher.id,
    cards,
    rating: (4.6 + difficulty * 0.08).toFixed(1),
    deduct: draft.deduct.trim() || "1.0",
    price: draft.price.trim() || "200",
    difficulty,
    status: "published",
    statusLabel: locale === "zh" ? "已上架" : "Published",
    ...(draft.intro.trim() ? { intro: draft.intro.trim() } : {}),
    ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
  };
}
