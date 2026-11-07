import type { Locale } from "./copy";
import type { Course } from "./course-service";

export interface WorkspaceNavItem {
  label: string;
  icon: string;
  href: string;
  active?: boolean;
}

export interface WorkspaceNavGroup {
  label: string;
  items: WorkspaceNavItem[];
}

export type DemoCourse = Course;

export interface WorkspacePresentation {
  brand: string;
  store: string;
  location: string;
  storeInitial: string;
  userInitial: string;
  userName: string;
  breadcrumb: string[];
  nav: WorkspaceNavGroup[];
  page: {
    eyebrow: string;
    title: string;
    lead: string;
    action: string;
  };
  stats: {
    courses: string;
    scheduled: string;
    drafts: string;
  };
  courses: DemoCourse[];
  sections: {
    scheduleEyebrow: string;
    scheduleTitle: string;
    scheduleLead: string;
    studentsEyebrow: string;
    studentsTitle: string;
    teachersEyebrow: string;
    teachersTitle: string;
    activityEyebrow: string;
    activityTitle: string;
  };
  courseMeta: {
    perLesson: string;
    deduction: string;
  };
}

export function getWorkspacePresentation(locale: Locale): WorkspacePresentation {
  if (locale === "zh") {
    return {
      brand: "冰草约课",
      store: "冰草约课",
      location: "上海 · 徐汇店",
      storeInitial: "冰",
      userInitial: "林",
      userName: "林佳 · 负责人",
      breadcrumb: ["首页", "排课设置", "课程管理"],
      nav: [
        {
          label: "基本设置",
          items: [
            { label: "店铺信息设置", icon: "⌑", href: "#overview" },
            { label: "添加管理员", icon: "♙", href: "#teachers-panel" },
            { label: "开通微信支付通道", icon: "↗", href: "#activity-panel" },
            { label: "店铺主页配置", icon: "▣", href: "#overview" },
          ],
        },
        {
          label: "排课设置",
          items: [
            { label: "课程管理", icon: "▤", href: "#overview", active: true },
            { label: "团课排课", icon: "▦", href: "#schedule-panel" },
            { label: "私教课排课", icon: "▥", href: "#schedule-panel" },
          ],
        },
        {
          label: "卡片管理",
          items: [
            { label: "卡片模板", icon: "▭", href: "#students-panel" },
            { label: "批量发卡", icon: "▤", href: "#students-panel" },
            { label: "发卡记录", icon: "▧", href: "#activity-panel" },
          ],
        },
      ],
      page: {
        eyebrow: "COURSE LIBRARY",
        title: "课程管理",
        lead: "管理门店课程、可用卡片与默认排课规则。",
        action: "新建课程",
      },
      stats: {
        courses: "课程总数",
        scheduled: "本周有排课",
        drafts: "待完善信息",
      },
      courses: [
        {
          id: "course_yoga",
          name: "流瑜伽进阶",
          cover: "yoga",
          coverLabel: "YOGA",
          teacher: "周敏",
          cards: "月卡 / 私教 10 次卡",
          rating: "4.8",
          deduct: "1 次",
          price: "200",
          status: "published",
          statusLabel: "已上架",
          difficulty: 3,
        },
        {
          id: "course_pilates",
          name: "普拉提入门",
          cover: "pilates",
          coverLabel: "PILATES",
          teacher: "林琳",
          cards: "次卡 / 月卡",
          rating: "4.6",
          deduct: "1 次",
          price: "180",
          status: "published",
          statusLabel: "已上架",
          difficulty: 2,
        },
        {
          id: "course_private",
          name: "私教体验课",
          cover: "private",
          coverLabel: "PRIVATE",
          teacher: "待选择老师",
          cards: "单次体验卡",
          rating: "5.0",
          deduct: "1 次",
          price: "299",
          status: "draft",
          statusLabel: "草稿",
          difficulty: 1,
        },
      ],
      sections: {
        scheduleEyebrow: "SCHEDULE",
        scheduleTitle: "近期排课",
        scheduleLead: "老师时段与学员安排来自当前门店课表。",
        studentsEyebrow: "STUDENTS",
        studentsTitle: "学员与会员卡",
        teachersEyebrow: "TEACHERS",
        teachersTitle: "授课老师",
        activityEyebrow: "RECENT OPERATIONS",
        activityTitle: "最近变更",
      },
      courseMeta: {
        perLesson: " / 节",
        deduction: "扣",
      },
    };
  }

  return {
    brand: "Bingcao Studio",
    store: "Bingcao Studio",
    location: "Shanghai · Xuhui",
    storeInitial: "B",
    userInitial: "JL",
    userName: "Jia Lin · Owner",
    breadcrumb: ["Home", "Scheduling", "Courses"],
    nav: [
      {
        label: "Settings",
        items: [
          { label: "Studio profile", icon: "⌑", href: "#overview" },
          { label: "Administrators", icon: "♙", href: "#teachers-panel" },
          { label: "WeChat Pay", icon: "↗", href: "#activity-panel" },
          { label: "Studio homepage", icon: "▣", href: "#overview" },
        ],
      },
      {
        label: "Scheduling",
        items: [
          { label: "Courses", icon: "▤", href: "#overview", active: true },
          { label: "Group classes", icon: "▦", href: "#schedule-panel" },
          { label: "Private lessons", icon: "▥", href: "#schedule-panel" },
        ],
      },
      {
        label: "Memberships",
        items: [
          { label: "Card templates", icon: "▭", href: "#students-panel" },
          { label: "Issue cards", icon: "▤", href: "#students-panel" },
          { label: "Issue history", icon: "▧", href: "#activity-panel" },
        ],
      },
    ],
    page: {
      eyebrow: "COURSE LIBRARY",
      title: "Courses",
      lead: "Manage the studio catalogue, eligible cards and default scheduling rules.",
      action: "New course",
    },
    stats: {
      courses: "courses",
      scheduled: "scheduled this week",
      drafts: "need attention",
    },
    courses: [
      {
        id: "course_yoga",
        name: "Advanced Vinyasa",
        cover: "yoga",
        coverLabel: "YOGA",
        teacher: "Zhou Min",
        cards: "Monthly card / 10-class pack",
        rating: "4.8",
        deduct: "1 class",
        price: "200",
        status: "published",
        statusLabel: "Published",
        difficulty: 3,
      },
      {
        id: "course_pilates",
        name: "Pilates Foundations",
        cover: "pilates",
        coverLabel: "PILATES",
        teacher: "Lin Lin",
        cards: "Class pack / Monthly card",
        rating: "4.6",
        deduct: "1 class",
        price: "180",
        status: "published",
        statusLabel: "Published",
        difficulty: 2,
      },
      {
        id: "course_private",
        name: "Private Trial",
        cover: "private",
        coverLabel: "PRIVATE",
        teacher: "Teacher pending",
        cards: "Single trial card",
        rating: "5.0",
        deduct: "1 class",
        price: "299",
        status: "draft",
        statusLabel: "Draft",
        difficulty: 1,
      },
    ],
    sections: {
      scheduleEyebrow: "SCHEDULE",
      scheduleTitle: "Upcoming lessons",
      scheduleLead: "Teacher availability and student bookings from the live timetable.",
      studentsEyebrow: "STUDENTS",
      studentsTitle: "Students and memberships",
      teachersEyebrow: "TEACHERS",
      teachersTitle: "Teaching team",
      activityEyebrow: "RECENT OPERATIONS",
      activityTitle: "Latest changes",
    },
    courseMeta: {
      perLesson: " / class",
      deduction: "Deduct",
    },
  };
}
