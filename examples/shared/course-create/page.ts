import type { Locale } from "../course-workspace/copy";

export interface CoursePageCopy {
  brand: string;
  storeName: string;
  storeLocation: string;
  navHome: string;
  navGroups: readonly { title: string; items: readonly string[] }[];
  breadcrumb: readonly string[];
  eyebrow: string;
  title: string;
  lead: string;
  newCourse: string;
  stats: readonly { value: string; label: string }[];
  listLabel: string;
  form: {
    title: string;
    subtitle: string;
    close: string;
    sectionInfo: string;
    sectionHint: string;
    name: string;
    required: string;
    difficulty: string;
    teacher: string;
    teacherPlaceholder: string;
    tag: string;
    tagValue: string;
    cards: string;
    cardsPlaceholder: string;
    intro: string;
    introPlaceholder: string;
    note: string;
    notePlaceholder: string;
    cover: string;
    upload: string;
    uploaded: string;
    sectionTemplate: string;
    sectionTemplateHint: string;
    deduct: string;
    deductUnit: string;
    price: string;
    priceUnit: string;
    pricePlaceholder: string;
    cancel: string;
    save: string;
    saving: string;
  };
  assistant: {
    menu: string;
    reset: string;
    collapse: string;
    placeholder: string;
    emptyHint: string;
    current: string;
    note: string;
  };
  messages: {
    welcome: string;
    appliedBasics: string;
    appliedTeaching: string;
    coverLocated: string;
    coverSelected: string;
    saving: string;
    saved: string;
    missing: string;
    closed: string;
  };
}

export const COURSE_PAGE_COPY: Record<Locale, CoursePageCopy> = {
  zh: {
    brand: "冰草约课",
    storeName: "冰草约课",
    storeLocation: "上海 · 徐汇店",
    navHome: "首页",
    navGroups: [
      { title: "基本设置", items: ["店铺信息设置", "添加管理员", "开通微信支付通道", "店铺主页配置"] },
      { title: "排课设置", items: ["课程管理", "团课排课", "私教课排课"] },
      { title: "卡片管理", items: ["卡片模板", "批量发卡", "发卡记录"] },
    ],
    breadcrumb: ["首页", "排课设置", "课程管理"],
    eyebrow: "COURSE LIBRARY",
    title: "课程管理",
    lead: "管理门店课程、可用卡片与默认排课规则。",
    newCourse: "新建课程",
    stats: [
      { value: "12", label: "课程总数" },
      { value: "8", label: "本周有排课" },
      { value: "3", label: "待完善信息" },
    ],
    listLabel: "课程列表",
    form: {
      title: "创建新课程",
      subtitle: "页面保持原样，助手只负责带入信息和提示下一步。",
      close: "关闭",
      sectionInfo: "课程信息",
      sectionHint: "所填内容将展示在学员端",
      name: "课程名称",
      required: "必填",
      difficulty: "请标注难度",
      teacher: "选择授课老师",
      teacherPlaceholder: "选择授课老师",
      tag: "课程标签",
      tagValue: "不分类",
      cards: "课程可用卡片",
      cardsPlaceholder: "选择可以约本课的卡片",
      intro: "课程介绍",
      introPlaceholder: "不超过 200 个字",
      note: "约课须知",
      notePlaceholder: "不超过 200 个字",
      cover: "课程封面",
      upload: "上传图片",
      uploaded: "已选择封面",
      sectionTemplate: "排课模板",
      sectionTemplateHint: "填写后，排课时将默认使用该设置。修改仅对之后创建的课生效。",
      deduct: "每节课扣卡次数",
      deductUnit: "次",
      price: "每节课扣卡金额",
      priceUnit: "元",
      pricePlaceholder: "课时价…",
      cancel: "取消",
      save: "保存",
      saving: "保存中…",
    },
    assistant: {
      menu: "可用任务",
      reset: "重播演示",
      collapse: "收起",
      placeholder: "告诉助手你要做什么，或继续当前任务…",
      emptyHint: "操作过程和核对结果会记录在这里。你也可以直接在左侧页面修改。",
      current: "当前",
      note: "助手会同时操作页面与整理信息。写入前会再次确认。",
    },
    messages: {
      welcome: "我看到你已经打开了“创建新课程”。这次不另做一套表单：我在聊天里整理信息，把值写进页面里的原表单，需要你亲自选的封面会停下来等你。",
      appliedBasics: "课程名称、难度和介绍已经写入页面。接下来确认老师和可用卡片。",
      appliedTeaching: "老师、可用卡和约课须知也写好了。课程封面上传需要你亲自完成。",
      coverLocated: "页面已经定位到课程封面。选好图片后，点一下上传区域即可继续。",
      coverSelected: "封面已经选好。我会再读一遍页面里的值，然后让你确认保存。",
      saving: "正在保存课程，并回读课程列表…",
      saved: "已保存。课程列表里已经出现这门课，字段也与刚才的确认值一致。",
      missing: "课程名称、老师和可用卡片还不能为空。请在页面表单里补齐，或使用上一步的推荐内容。",
      closed: "表单先收起来了。任务进度还在，重新打开“新建课程”就能继续。",
    },
  },
  en: {
    brand: "Bingcao Studio",
    storeName: "Bingcao Studio",
    storeLocation: "Shanghai · Xuhui",
    navHome: "Home",
    navGroups: [
      { title: "Settings", items: ["Store profile", "Administrators", "WeChat Pay", "Store homepage"] },
      { title: "Scheduling", items: ["Courses", "Group classes", "Private lessons"] },
      { title: "Cards", items: ["Card templates", "Bulk issue", "Issue history"] },
    ],
    breadcrumb: ["Home", "Scheduling", "Courses"],
    eyebrow: "COURSE LIBRARY",
    title: "Courses",
    lead: "Manage courses, eligible cards and default scheduling rules.",
    newCourse: "New course",
    stats: [
      { value: "12", label: "courses" },
      { value: "8", label: "scheduled this week" },
      { value: "3", label: "need attention" },
    ],
    listLabel: "Course catalogue",
    form: {
      title: "Create a course",
      subtitle: "The page stays as it is. The assistant brings in values and points to the next step.",
      close: "Close",
      sectionInfo: "Course information",
      sectionHint: "This appears in the student app",
      name: "Course name",
      required: "Required",
      difficulty: "Difficulty",
      teacher: "Teacher",
      teacherPlaceholder: "Choose a teacher",
      tag: "Category",
      tagValue: "Uncategorised",
      cards: "Eligible cards",
      cardsPlaceholder: "Choose the cards that can book this course",
      intro: "Course introduction",
      introPlaceholder: "Up to 200 characters",
      note: "Booking notes",
      notePlaceholder: "Up to 200 characters",
      cover: "Course cover",
      upload: "Upload image",
      uploaded: "Cover selected",
      sectionTemplate: "Scheduling defaults",
      sectionTemplateHint: "These values become the default when scheduling. Later changes only affect new lessons.",
      deduct: "Classes deducted per booking",
      deductUnit: "class",
      price: "Price per class",
      priceUnit: "CNY",
      pricePlaceholder: "Price…",
      cancel: "Cancel",
      save: "Save",
      saving: "Saving…",
    },
    assistant: {
      menu: "Available tasks",
      reset: "Replay demo",
      collapse: "Collapse",
      placeholder: "Tell the assistant what to do, or continue this task…",
      emptyHint: "Steps and verification results appear here. You can also edit the page form directly.",
      current: "Current",
      note: "The assistant works with the page and keeps the task in sync. It confirms before writing.",
    },
    messages: {
      welcome: "I can see the existing “Create a course” form. I will organise the information in chat, write values into the original page form, and pause when you need to choose the cover.",
      appliedBasics: "The course name, difficulty and introduction are now in the page. Next, confirm the teacher and eligible cards.",
      appliedTeaching: "The teacher, cards and booking notes are in the page. The cover needs your choice.",
      coverLocated: "The cover field is now in view. Choose an image, then click the upload tile to continue.",
      coverSelected: "The cover is ready. I will read the page values again before you confirm the save.",
      saving: "Saving the course and reading the catalogue back…",
      saved: "Saved. The new course is in the catalogue, and its values match the confirmation.",
      missing: "Course name, teacher and eligible cards are required. Complete them in the page form or use the recommended values.",
      closed: "The form is hidden. The task is still here; choose “New course” to continue.",
    },
  },
};
