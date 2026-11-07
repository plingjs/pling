import type { Locale } from "../course-workspace/copy";

export interface CourseCreateCopy {
  assistantTitle: string;
  assistantStatus: string;
  taskMenu: string;
  taskMenuHint: string;
  chatEmpty: string;
  cancelled: string;
  taskCourse: string;
  taskCurrent: string;
  tasksButton: string;
  resetButton: string;
  welcome: string;
  footer: string;
  stepSubtitle: string;
  steps: readonly [string, string, string, string];
  valuesTitle: string;
  cancelTask: string;
  required: string;
  optional: string;
  hint: {
    next: string;
    suggest: string;
    manual: string;
    cover: string;
    requiredDone: string;
    optionalSkip: string;
    done: string;
    completed: string;
    located: string;
  };
  row: {
    current: string;
    suggested: string;
    missing: string;
    source: string;
    use: string;
    locate: string;
    skip: string;
    choose: string;
  };
  labels: {
    running: string;
    completed: string;
    current: string;
    done: string;
    pending: string;
    error: string;
    skipped?: string;
  };
  stats: readonly [string, string, string];
  basics: {
    title: string;
    description: string;
    current: string;
    recommended: string;
    name: string;
    difficulty: string;
    intro: string;
    primary: string;
    secondary: string;
    missing: string;
  };
  teaching: {
    title: string;
    description: string;
    teacher: string;
    cards: string;
    note: string;
    primary: string;
    secondary: string;
    missing: string;
  };
  cover: {
    title: string;
    description: string;
    handoffTitle: string;
    handoffBody: string;
    primary: string;
    secondary: string;
    upload: string;
    missing: string;
  };
  review: {
    title: string;
    description: string;
    difficulty: string;
    teacher: string;
    cards: string;
    cover: string;
    coverYes: string;
    coverNo: string;
    deductAndPrice: string;
    primary: string;
    busy: string;
    secondary: string;
    confirm: string;
    continue: string;
    confirmHint: string;
    continueHint: string;
    missing: string;
  };
  done: {
    title: (name: string) => string;
    description: string;
    view: string;
    restart: string;
  };
  task: {
    title: string;
    description: string;
    example: string;
    step: string;
    summary: string;
    success: string;
  };
  error: string;
}

export const COURSE_CREATE_COPY: Record<Locale, CourseCreateCopy> = {
  zh: {
    assistantTitle: "页灵助手",
    assistantStatus: "正在当前页面工作",
    taskMenu: "当前页可用任务",
    taskMenuHint: "只显示当前页面可完成的任务；切换到其他模块时，列表会随之变化。",
    chatEmpty: "把课程信息一次说给我，比如「孕妇瑜伽，陈老师，2 星，介绍自动填写」。也可以直接在页面填写，我来补缺。",
    cancelled: "好，这次先不建了。需要的时候再叫我。",
    taskCourse: "创建课程",
    taskCurrent: "当前",
    tasksButton: "可用任务",
    resetButton: "重播演示",
    welcome: "我看到你已经打开了“创建新课程”。页面表单是唯一的输入来源。我只负责整理值、定位字段，并在你需要亲自处理封面时停下来。",
    footer: "助手会同时操作页面与整理信息。写入前会再次确认。",
    stepSubtitle: "课程管理 · 第 {step} 步，共 {total} 步",
    steps: ["课程信息", "教学与约课", "课程封面", "核对并保存"],
    valuesTitle: "页面值与建议",
    cancelTask: "取消任务",
    required: "必填",
    optional: "可选",
    hint: {
      next: "下一项：{field}（{flag}）。",
      suggest: "建议「{value}」。",
      manual: "可以直接在页面填写，或告诉我你的选择。",
      cover: "封面需要你亲自上传。",
      requiredDone: "必填项已经齐了。还有 {count} 个可选项可以补充，也可以直接核对保存。",
      optionalSkip: "可以直接在页面填写，也可以跳过。",
      done: "字段已经齐了。点「保存并核对结果」，我会写入并回读课程库。",
      completed: "课程已创建，可以在左侧课程库查看。",
      located: "已定位到页面上的「{field}」，可以直接填写。",
    },
    row: {
      current: "已填入",
      suggested: "建议",
      missing: "待填写",
      source: "来自示例课程模板，尚未写入页面",
      use: "自动填写",
      locate: "定位",
      skip: "跳过",
      choose: "去选择",
    },
    labels: { running: "进行中", completed: "已完成", current: "当前", done: "已完成", pending: "待开始", skipped: "已跳过", error: "无法继续" },
    stats: ["课程总数", "已上架", "待完善信息"],
    basics: {
      title: "先确定课程内容",
      description: "下面三项会写进页面里的原表单。你也可以直接在页面上改，保存前我会重新读取。",
      current: "页面当前值",
      recommended: "建议值（尚未写入）",
      name: "课程名称",
      difficulty: "难度",
      intro: "课程介绍",
      primary: "填入推荐内容并继续",
      secondary: "在页面中定位",
      missing: "页面里还没有课程名称。请先在原表单填写，或点“填入推荐内容”。",
    },
    teaching: {
      title: "确认怎么约课",
      description: "老师和可用卡决定学员能不能约到这门课。选好后会把值写进页面对应的选择器。",
      teacher: "授课老师",
      cards: "课程可用卡片",
      note: "约课须知",
      primary: "写入页面并继续",
      secondary: "查看页面字段",
      missing: "请先在页面表单里选择授课老师和可用卡。",
    },
    cover: {
      title: "封面这一步交给你",
      description: "上传需要读取你本地的文件，助手不会代选。打开页面中的封面区域后，你选图，我继续核对。",
      handoffTitle: "人工接力：选择课程封面",
      handoffBody: "课程名、老师、卡片和规则已经写入页面。剩下这张封面，需要你在原表单里完成。",
      primary: "在页面中定位封面",
      secondary: "已选好，继续核对",
      upload: "上传封面",
      missing: "还没有看到封面。请先在页面里选择一张图片，再继续核对。",
    },
    review: {
      title: "保存前，再核对一次",
      description: "下面是页面中当前的值。点击保存后，我会等页面完成写入，再回读课程列表确认结果。",
      difficulty: "难度",
      teacher: "授课老师",
      cards: "可用卡片",
      cover: "课程封面",
      coverYes: "已选择",
      coverNo: "未选择",
      deductAndPrice: "扣卡与金额",
      primary: "保存并核对结果",
      busy: "保存中…",
      secondary: "定位保存按钮",
      confirm: "确认保存",
      continue: "继续修改",
      confirmHint: "确认无误就点「确认保存」；要改哪一项，直接告诉我。",
      continueHint: "好，你说改哪一项，或者直接在页面里改。",
      missing: "课程名称、授课老师和可用卡不能为空。",
    },
    done: {
      title: (name) => `${name} 已创建`,
      description: "已回读课程列表：新课程出现在第 1 位，名称、老师与可用卡和确认值一致。",
      view: "查看新增课程",
      restart: "再做一次",
    },
    task: {
      title: "创建课程",
      description: "把课程名称、老师、可用卡与排课默认值写入课程库。",
      example: "新建瑜伽基础，周敏老师，月卡，200 元",
      step: "创建课程记录",
      summary: "写入课程库，并回读课程列表确认新课程已出现。",
      success: "新课程出现在课程库第一位",
    },
    error: "保存没有完成，请核对页面里的值后再试。",
  },
  en: {
    assistantTitle: "Pling assistant",
    assistantStatus: "Working on this page",
    taskMenu: "Tasks on this page",
    taskMenuHint: "Only tasks available on this page appear here. The list changes when you move to another module.",
    chatEmpty: "Describe the course in one go, for example “pregnancy yoga, Chen, 2 stars, write the intro”. You can also fill the page directly and I will close the gaps.",
    cancelled: "Okay, I will leave this course uncreated. Call me when you need it.",
    taskCourse: "Create a course",
    taskCurrent: "Current",
    tasksButton: "Available tasks",
    resetButton: "Replay demo",
    welcome: "I can see the existing “Create a course” form. The page form is the only source of input. I organise values, point to fields, and pause when you need to choose the cover.",
    footer: "The assistant works with the page and keeps the task in sync. It confirms before writing.",
    stepSubtitle: "Course management · step {step} of {total}",
    steps: ["Course details", "Teaching and booking", "Course cover", "Review and save"],
    valuesTitle: "Page values and suggestions",
    cancelTask: "Cancel task",
    required: "Required",
    optional: "Optional",
    hint: {
      next: "Next: {field} ({flag}). ",
      suggest: "Suggested: \"{value}\". ",
      manual: "Fill it on the page, or tell me what you want.",
      cover: "The cover needs to be uploaded by you.",
      requiredDone: "Required fields are complete. {count} optional fields remain; add them or review and save now.",
      optionalSkip: "Fill it in on the page, or skip it.",
      done: "All fields are in place. Choose Save and verify; I will write the course and read the catalogue back.",
      completed: "Course created. You can find it in the catalogue.",
      located: "Located “{field}” on the page. You can fill it in now.",
    },
    row: {
      current: "In page",
      suggested: "Suggested",
      missing: "Needs input",
      source: "From the demo course template; not written to the page",
      use: "Auto-fill",
      locate: "Locate",
      skip: "Skip",
      choose: "Choose",
    },
    labels: { running: "In progress", completed: "Completed", current: "Current", done: "Done", pending: "Not started", skipped: "Skipped", error: "Cannot continue" },
    stats: ["courses", "published", "need attention"],
    basics: {
      title: "Start with the course content",
      description: "These three values are written into the existing page form. You can edit them there; I read the page again before saving.",
      current: "Current page values",
      recommended: "Suggested values (not written yet)",
      name: "Course name",
      difficulty: "Difficulty",
      intro: "Course introduction",
      primary: "Fill recommended values and continue",
      secondary: "Locate on page",
      missing: "The page has no course name yet. Enter one in the original form or use the recommended values.",
    },
    teaching: {
      title: "Confirm how students book",
      description: "The teacher and eligible cards decide who can book this course. The selected values are written into the page controls.",
      teacher: "Teacher",
      cards: "Eligible cards",
      note: "Booking notes",
      primary: "Write to page and continue",
      secondary: "Show page fields",
      missing: "Choose a teacher and eligible cards in the page form first.",
    },
    cover: {
      title: "The cover is your step",
      description: "Uploading reads a local file, so the assistant does not choose it for you. Open the cover field, choose an image, and I will continue.",
      handoffTitle: "Human handoff: choose a course cover",
      handoffBody: "The course name, teacher, cards and rules are already in the page. Choose the cover in the original form to continue.",
      primary: "Locate the cover field",
      secondary: "Cover selected, continue",
      upload: "Upload cover",
      missing: "No cover has been selected yet. Choose an image in the page first.",
    },
    review: {
      title: "Review once before saving",
      description: "These are the current values in the page. After saving, I wait for the write and read the course list back.",
      difficulty: "Difficulty",
      teacher: "Teacher",
      cards: "Eligible cards",
      cover: "Course cover",
      coverYes: "Selected",
      coverNo: "Not selected",
      deductAndPrice: "Deduction and price",
      primary: "Save and verify",
      busy: "Saving…",
      secondary: "Locate save button",
      confirm: "Confirm save",
      continue: "Keep editing",
      confirmHint: "Click “Confirm save” if this is right. To change a field, just tell me which one.",
      continueHint: "Okay. Tell me what to change, or edit the page directly.",
      missing: "Course name, teacher and eligible cards are required.",
    },
    done: {
      title: (name) => `${name} created`,
      description: "Read back from the course list: the new course is first and its name, teacher and eligible cards match the confirmed values.",
      view: "View new course",
      restart: "Create another",
    },
    task: {
      title: "Create a course",
      description: "Write the course name, teacher, eligible cards and scheduling defaults into the catalogue.",
      example: "Create Yoga foundations with Zhou Min, monthly card, ¥200",
      step: "Create the course record",
      summary: "Write the course to the catalogue and read the list back to confirm it appears.",
      success: "The new course appears first in the catalogue",
    },
    error: "Saving did not finish. Check the page values and try again.",
  },
};

