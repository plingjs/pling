import type { Locale } from "../course-workspace/copy";

interface QuickPrompt {
  label: string;
  prompt: string;
  description?: string;
}

export interface CourseDemoCopy {
  assistantTitle: string;
  emptyHint: string;
  greeting: string;
  quick: readonly QuickPrompt[];
  draftLabel: string;
  formSubtitle: string;
  formScope: string;
  catalogueScope: string;
  newCourseDesc: string;
  closeDesc: string;
  teacherDesc(values: string): string;
  cardsDesc(values: string): string;
  difficultyDesc(score: number): string;
  fieldDesc: {
    name: string;
    intro: string;
    note: string;
    deduct: string;
    price: string;
  };
  coverDesc: string;
  coverHandoff: string;
  coverExpect: string;
  saveDesc: string;
  saveExpect: string;
  missing(labels: readonly string[]): string;
  saved(name: string): string;
}

export const COURSE_DEMO_COPY: Record<Locale, CourseDemoCopy> = {
  zh: {
    assistantTitle: "课程助手",
    emptyHint: "直接说要做的事。需要新建课程时，助手会自己打开表单；封面由你上传。",
    greeting:
      "直接说要创建的课程即可，例如「孕妇瑜伽，陈静，2 星，月卡，介绍自动填写」。需要新建时我会自己打开表单；封面需要你亲自上传。",
    quick: [
      {
        label: "创建孕妇瑜伽",
        prompt: "创建课程：孕妇瑜伽，陈静，2 星，月卡，介绍自动填写",
        description: "用一组示例信息体验完整的表单填写流程",
      },
      {
        label: "还差什么",
        prompt: "看一下还差哪些必填项",
        description: "检查当前表单还缺哪些必填信息",
      },
      {
        label: "定位封面上传",
        prompt: "上传封面在哪里点？",
        description: "在页面中标出封面上传位置",
      },
    ],
    draftLabel: "正在填写的课程草稿（表单当前值）",
    formSubtitle: "原页面表单：助手会自己打开它并填写可推断的项；封面由你上传。",
    formScope: "新建课程的原页面表单。每个字段都是独立动作；保存前会校验必填项。",
    catalogueScope: "当前门店的课程库；每张卡片是一条只读记录。",
    newCourseDesc: "打开新建课程表单。助手也可以调用这个动作自己打开；如果上一门课已经保存，会清空草稿重新开始。",
    closeDesc: "关闭新建课程表单，不保存当前草稿。",
    teacherDesc: (values) => `授课老师（必填）。可选值：${values}。`,
    cardsDesc: (values) => `课程可用卡片（必填）。可选值：${values}。`,
    difficultyDesc: (score) => `把课程难度设为 ${score} 星（可选，1 到 5 星）。`,
    fieldDesc: {
      name: "课程名称（必填）。直接输入用户给出的名称，例如「孕妇瑜伽」。",
      intro:
        "课程介绍（可选）。优先使用用户给出的原文；当用户明确要求自动填写、让你写、或说「随便填」时，根据课程名称、难度、老师等已知信息生成一段简洁介绍并填入。",
      note:
        "约课须知（可选）。优先使用用户给出的原文；当用户明确要求自动填写或让你决定时，根据课程类型生成一段简短的通用注意事项并填入。",
      deduct: "每节课扣卡次数（可选，默认 1）。",
      price: "每节课扣卡金额（可选，默认 200 元）。",
    },
    coverDesc: "课程封面（必填）。这个动作不会模拟上传，必须由用户在页面上选择本地图片。",
    coverHandoff: "请点击页面上的「上传图片」，选择一张封面；上传完成后回到这里点「我已完成」。",
    coverExpect: "页面已经记录了用户选择的封面",
    saveDesc:
      "保存当前课程。只有课程名称、授课老师、课程可用卡片和课程封面都已填写时才成功；失败时会返回还缺哪些字段。",
    saveExpect: "新课程出现在课程库第一位",
    missing: (labels) => `还差：${labels.join("、")}。`,
    saved: (name) => `已创建课程「${name}」`,
  },
  en: {
    assistantTitle: "Course assistant",
    emptyHint: "Say what you want to do. I open the create-course form when needed; you upload the cover.",
    greeting:
      "Describe the course in one go, for example “Prenatal yoga, Chen Jing, 2 stars, monthly card, write the intro”. I open the form when needed and leave the cover to you.",
    quick: [
      {
        label: "Create prenatal yoga",
        prompt: "Create a course: Prenatal yoga, Chen Jing, 2 stars, monthly card, write the intro",
        description: "Try the complete form flow with the sample course details",
      },
      {
        label: "What's missing?",
        prompt: "What required fields are still missing?",
        description: "Check which required fields are still empty",
      },
      {
        label: "Locate cover upload",
        prompt: "Where do I upload the cover?",
        description: "Mark the cover upload target on the page",
      },
    ],
    draftLabel: "Course draft in the form (current values)",
    formSubtitle: "The original page form: the assistant opens it when needed and fills what it can; you upload the cover.",
    formScope: "The original create-course form. Each field is its own action; saving validates the required fields.",
    catalogueScope: "The current course catalogue; every card is a read-only record.",
    newCourseDesc: "Open the create-course form. The assistant may call this action itself; if the previous course was saved, the draft is cleared first.",
    closeDesc: "Close the create-course form without saving the current draft.",
    teacherDesc: (values) => `Teacher (required). Allowed values: ${values}.`,
    cardsDesc: (values) => `Eligible cards (required). Allowed values: ${values}.`,
    difficultyDesc: (score) => `Set the course difficulty to ${score} stars (optional, 1 to 5).`,
    fieldDesc: {
      name: "Course name (required). Enter the name the person supplied, for example “Prenatal yoga”.",
      intro:
        "Course description (optional). Prefer the person's exact words. When they explicitly ask you to write it automatically, write it, or choose freely, generate a concise description from the known course name, level and teacher, then fill it in.",
      note:
        "Booking notes (optional). Prefer the person's exact words. When they explicitly ask you to fill them or decide, generate a short set of course-appropriate notes and fill them in.",
      deduct: "Card deductions per lesson (optional, defaults to 1).",
      price: "Price per lesson (optional, defaults to 200).",
    },
    coverDesc: "Course cover (required). This action never simulates an upload; the person must choose a local image.",
    coverHandoff: "Click “Upload image” on the page and choose a cover, then come back and confirm you are done.",
    coverExpect: "The page recorded the cover the person chose",
    saveDesc:
      "Save the current course. It succeeds only when the name, teacher, eligible cards and cover are present; otherwise it lists the missing fields.",
    saveExpect: "The new course is first in the catalogue",
    missing: (labels) => `Still missing: ${labels.join(", ")}.`,
    saved: (name) => `Created “${name}”`,
  },
};

// Legacy demos (`course-workspace`, `course-workspace-react`, `course-workspace-vue2`)
// still render the full guided-task card. Keep their copy in a separate module so
// the current create-course page can carry the compact copy it actually uses.
export { COURSE_CREATE_COPY, type CourseCreateCopy } from "./copy-legacy";
