<script setup lang="ts">
import { onBeforeUnmount, watch } from "vue";
import { AgentInline, useAgentState, useAgentTool, usePling } from "@plingjs/vue";
import type { WorkspaceApi } from "../domain/mock-api";
import type { CreateCourseInput, WorkspaceData } from "../domain/types";

type Section = "overview" | "courses" | "group-lessons" | "private-lessons" | "teachers" | "students" | "cards" | "bookings" | "no-shows" | "settings";
const props = defineProps<{ api: WorkspaceApi; data: WorkspaceData; page: string }>();
const emit = defineEmits<{ changed: []; notice: [message: string]; navigate: [section: Section]; openCourse: [courseId: string]; showStudentCards: [studentId: string] }>();
const pling = usePling();
const taskLabels = {
  running: "进行中",
  completed: "已完成",
  current: "当前",
  done: "已完成",
  pending: "待开始",
  error: "未完成",
  required: "必填",
  optional: "可选",
  skipped: "已跳过",
} as const;
const taskSections: Record<string, readonly Section[]> = {
  "merchant.create-course": ["courses"],
  "merchant.schedule-group-class": ["courses", "group-lessons"],
  "merchant.book-private-lesson": ["private-lessons", "students", "cards", "teachers"],
  "merchant.issue-membership-card": ["cards", "students"],
  "merchant.lookup-student-cards": ["students", "cards"],
};
const sectionNames: Record<Section, string> = {
  overview: "经营概况", courses: "课程管理", "group-lessons": "团课排课", "private-lessons": "私教课排课",
  teachers: "老师管理", students: "学员管理", cards: "卡片管理", bookings: "预约查看", "no-shows": "爽约管理", settings: "店铺信息设置",
};

const phoneLabel = (phone: string) => phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
const course = (id: string) => props.data.courses.find((item) => item.id === id);
const teacherOptions = (privateOnly = false) => props.data.teachers
  .filter((teacher) => teacher.status === "active" && (!privateOnly || teacher.privateEligible))
  .map((teacher) => ({ value: teacher.id, label: `${teacher.name} · ${teacher.specialties.join(" / ")}${teacher.yearsExperience ? ` · ${teacher.yearsExperience}` : ""}` }));
const pendingCardTemplates = new Map<string, WorkspaceData["cardTemplates"][number]>();
watch(() => props.data.cardTemplates, (templates) => {
  const currentIds = new Set(templates.map((template) => template.id));
  for (const id of pendingCardTemplates.keys()) if (currentIds.has(id)) pendingCardTemplates.delete(id);
}, { flush: "sync" });
const cardTemplate = (id: string) => props.data.cardTemplates.find((item) => item.id === id) ?? pendingCardTemplates.get(id);
const cardOptions = () => [...new Map([...props.data.cardTemplates, ...pendingCardTemplates.values()].map((item) => [item.id, item])).values()]
  .map((item) => ({ value: item.id, label: `${item.name} · ${item.applicable}` }));
const studentOptions = () => props.data.students.map((student) => ({ value: student.id, label: `${student.name} · ${phoneLabel(student.phone)}` }));
const availableSlotOptions = () => props.data.privateAvailability
  .filter((slot) => slot.status === "available")
  .map((slot) => ({ value: slot.id, label: `${props.data.teachers.find((item) => item.id === slot.teacherId)?.name ?? "老师"} · ${slot.date} ${slot.start}–${slot.end}` }));
const pendingCardOptions = () => props.data.students.flatMap((student) => student.cards
  .filter((card) => card.status === "pending")
  .map((card) => ({ value: `${student.id}|${card.id}`, label: `${student.name} · ${phoneLabel(student.phone)} · ${props.data.cardTemplates.find((item) => item.id === card.templateId)?.name ?? "会员卡"}` })));
const numberList = (value: unknown) => String(value ?? "").split(/[、,，\s]+/).map(Number).filter((item) => Number.isInteger(item) && item >= 0);

useAgentState("merchant_workspace", () => ({
  currentPage: props.page,
  publishedCourses: props.data.courses.filter((item) => item.status === "published").length,
  activeTeachers: props.data.teachers.filter((item) => item.status === "active").length,
  availablePrivateSlots: props.data.privateAvailability.filter((item) => item.status === "available").length,
  studentCount: props.data.students.length,
  cardTemplateNames: props.data.cardTemplates.map((item) => item.name),
  upcomingLessonCount: props.data.lessons.filter((item) => item.status === "scheduled").length,
}), { description: "当前测试门店的业务摘要。只暴露数量与模板名，不暴露手机号、学员档案或完整业务数据。" });

const stopGoals = [
  pling.task.goal({
    id: "merchant.create-course",
    title: "创建课程",
    goal: "为当前门店创建课程；收集课程名称、类别、老师、适用卡片和必要的课程信息，复核后保存并确认课程列表中出现新课程。",
    description: "必填业务信息不明确时先问用户；老师和会员卡从当前门店选项中匹配，不要编造或索要内部 ID。",
    constraints: ["写入前复述课程名、老师、卡片和价格并请求确认", "私教课程只能匹配已开通私教资格的老师", "课程介绍与约课须知可由用户决定留空", "任务进行时只进入课程管理；除非用户明确要求，不要跳到经营概况或无关页面。"],
    successCriteria: ["业务服务返回新课程", "课程列表可查到新课程及其默认设置"],
    examples: ["创建孕妇瑜伽，陈老师，孕产专项卡，2 星，60 分钟，介绍先留空"],
    risk: "write",
    labels: taskLabels,
    cancelLabel: "取消任务",
  }),
  pling.task.goal({
    id: "merchant.schedule-group-class",
    title: "安排团课",
    goal: "为已发布团课安排一次或连续多周的课时。根据商家时区解释相对日期，检查老师与教室冲突后再创建。",
    constraints: ["从当前门店已有课程和老师中选择", "相对日期以系统提示中的当前时间和 Asia/Shanghai 商家时区为准；信息仍有歧义时先询问", "重复排期必须先预览具体日期和逐日冲突，再复述给用户", "发生冲突时停止写入并解释冲突", "保存前复述日期、时间、老师、教室和人数", "在请求用户确认前先打开团课排课页，让用户看到将要新增的课时", "任务进行时只在课程管理与团课排课之间切换；完成前不要跳到经营概况或无关页面。"],
    successCriteria: ["课时记录已创建并出现在排课列表"],
    examples: ["明天下午 3 点安排瑜伽基础，陈老师，瑜伽房 A，12 人"],
    risk: "write",
    labels: taskLabels,
    cancelLabel: "取消任务",
  }),
  pling.task.goal({
    id: "merchant.book-private-lesson",
    title: "安排私教预约",
    goal: "先确认私教老师已有可约时段，再根据课程、学员和有效会员卡创建预约。",
    constraints: ["只使用当前可约时段和私教课程", "同名学员必须通过脱敏手机号消歧", "预约不扣卡次数，必须如实告知", "任务进行时只进入私教排课、学员、卡片或老师页面；除非用户明确要求，不要跳到无关页面。"],
    successCriteria: ["私教预约记录创建成功且时段变为已预约"],
    examples: ["为林悦预约林老师明天上午的私教体态评估"],
    risk: "write",
    labels: taskLabels,
    cancelLabel: "取消任务",
  }),
  pling.task.goal({
    id: "merchant.issue-membership-card",
    title: "创建并发放会员卡",
    goal: "完成用户要求的会员卡操作。若用户同时要求新建模板并发卡，先创建模板，再将新模板发给指定学员；若只要求发卡，则使用已有模板。延期激活的卡应保持待开卡状态。",
    constraints: ["先一次性复述完整计划；用户确认后按顺序完成计划内所有步骤，不要在聊天中重复索要口头确认", "每个写动作仍使用 Pling 确认闸门，等待用户逐项批准", "用户同时要求建模板和发卡时，模板创建成功后刷新当前数据，从最新候选中选中新模板继续发卡，不要在第一步后结束任务", "重名时核对脱敏手机号", "储值卡余额与售价是两个字段", "写入后读取学员卡片列表核对卡名、余额或次数、状态与有效期", "任务进行时只进入卡片或学员页面；除非用户明确要求，不要跳到无关页面。"],
    successCriteria: ["如需新建，模板创建成功并出现在当前模板列表", "目标学员的卡片列表出现本次发放的卡，并核实状态、余额或次数与有效期"],
    examples: ["给周宁发一张 3 次体验卡，有效期 30 天"],
    risk: "write",
    labels: taskLabels,
    cancelLabel: "取消任务",
  }),
  pling.task.goal({
    id: "merchant.lookup-student-cards",
    title: "查询学员与会员卡",
    goal: "按姓名或手机号查找学员，遇到重名先让用户确认身份，再回答会员卡类型、余额或次数、有效期和状态。",
    constraints: ["这是只读任务", "不向用户索要内部学员 ID", "只返回回答问题所需的数据", "任务进行时只进入学员或卡片页面；除非用户明确要求，不要跳到无关页面。"],
    successCriteria: ["定位到唯一学员并返回准确卡片信息，或说明需要补充的信息"],
    examples: ["林悦还有几次瑜伽课？", "查手机号尾号 1234 的会员卡"],
    risk: "read",
    labels: taskLabels,
    cancelLabel: "取消任务",
  }),
];
onBeforeUnmount(() => stopGoals.forEach((stop) => stop()));

useAgentTool({
  id: "merchant.find_students",
  label: "查找学员",
  desc: "按姓名、完整手机号或手机号末四位查找学员。返回姓名、脱敏手机号与可用卡片数量，不返回内部 ID。",
  kind: "read",
  params: [{ name: "query", label: "学员姓名或手机号", minLength: 2, maxLength: 80 }],
  run: async ({ query }) => {
    const matches = await props.api.findStudents(String(query));
    return { count: matches.length, students: matches.map(({ name, phone, activeCards }) => ({ name, phone, activeCards })) };
  },
});

useAgentTool({
  id: "merchant.open_section",
  label: "打开业务页面",
  desc: "切换工作台页面，帮助用户进入相关业务功能；不会修改业务数据。任务进行时只进入完成当前任务所需的页面；除非用户明确要求，否则不要跳到经营概况或无关页面。",
  kind: "read",
  params: [{ name: "section", label: "要打开的功能", options: () => [
    { value: "overview", label: "经营概况" }, { value: "courses", label: "课程管理" }, { value: "group-lessons", label: "团课排课" },
    { value: "private-lessons", label: "私教课排课" }, { value: "teachers", label: "老师管理" }, { value: "students", label: "学员管理" },
    { value: "cards", label: "卡片管理" }, { value: "bookings", label: "预约查看" }, { value: "no-shows", label: "爽约管理" }, { value: "settings", label: "店铺信息设置" },
  ] }],
  run: async ({ section }) => {
    const destination = String(section) as Section;
    const activeTask = pling.task.active();
    const allowedSections = activeTask ? taskSections[activeTask.id] : undefined;
    if (activeTask && allowedSections && !allowedSections.includes(destination)) {
      const allowedNames = allowedSections.map((item) => sectionNames[item]).join("、");
      throw new Error(`当前正在处理“${activeTask.definition.title}”，请留在${allowedNames}完成任务。若用户已改变目标，请先取消当前任务，再切换到${sectionNames[destination]}。`);
    }
    emit("navigate", destination);
    return { opened: sectionNames[destination] };
  },
});

useAgentTool({
  id: "merchant.get_student_cards",
  label: "查询会员卡",
  desc: "按姓名或手机号查会员卡。重名时停止并列出脱敏手机号，不猜测学员身份。",
  kind: "read",
  params: [{ name: "query", label: "学员姓名或手机号", minLength: 2, maxLength: 80 }],
  run: async ({ query }) => {
    const result = await props.api.getStudentCards(String(query));
    if (result.kind === "none") return { found: false, message: "没有找到学员，请核对姓名或手机号。" };
    if (result.kind === "many") return { found: false, needsClarification: true, candidates: result.candidates.map(({ name, phone }) => ({ name, phone })) };
    return { found: true, student: { name: result.student.name, phone: result.student.phone }, cards: result.cards.map(({ name, remaining, balance, expiresOn, status }) => ({ name, remaining, balance, expiresOn: expiresOn || "待开卡", status })) };
  },
});

useAgentTool({
  id: "merchant.create_course",
  label: "创建课程",
  desc: "创建并发布门店课程。系统会校验老师、会员卡、难度、价格和人数规则；提交前必须复述核心信息并获得用户确认。",
  summary: "创建课程和之后排课使用的默认规则。",
    successHint: "创建后打开课程详情供用户核对，课程列表也会出现新记录；排课默认值不会改写已经创建的课时。",
  examples: ["创建孕妇瑜伽，陈老师，孕产专项卡，2 星，60 分钟"],
  kind: "write",
  confirm: true,
  params: [
    { name: "name", label: "课程名称", minLength: 2, maxLength: 40 },
    { name: "category", label: "课程分类", values: ["瑜伽", "普拉提", "孕产", "私教"] },
    { name: "teacherId", label: "授课老师", options: teacherOptions },
    { name: "cardTemplateId", label: "适用会员卡", options: cardOptions },
    { name: "difficulty", label: "难度星级", type: "number", min: 1, max: 5 },
    { name: "duration", label: "课程时长（分钟）", type: "number", min: 15, max: 240 },
    { name: "price", label: "单次价格（元）", type: "number", min: 0 },
    { name: "intro", label: "课程介绍；不确定时留空", maxLength: 240, optional: true },
    { name: "bookingNotice", label: "约课须知；不确定时留空", maxLength: 240, optional: true },
    { name: "room", label: "默认教室", maxLength: 40, optional: true },
    { name: "capacity", label: "每节课最大人数", type: "number", min: 1, max: 40, optional: true },
    { name: "minimumEnrollment", label: "最低开课人数", type: "number", min: 1, max: 40, optional: true },
    { name: "deductionCount", label: "每节课扣卡次数", type: "number", min: 0, optional: true },
    { name: "deductionAmount", label: "每节课扣卡金额（元）", type: "number", min: 0, optional: true },
    { name: "cancelBeforeMinutes", label: "最晚取消时间（课前分钟）", type: "number", min: 0, optional: true },
    { name: "bookingOpensMinutes", label: "最早可约时间（课前分钟）", type: "number", min: 0, optional: true },
    { name: "bookingClosesMinutes", label: "最晚可约时间（课前分钟）", type: "number", min: 0, optional: true },
    { name: "notifications", label: "开课通知时间点，分钟列表，以逗号分隔", maxLength: 80, optional: true },
    { name: "autoCancelBelowMinimum", label: "未达最低人数时自动取消", type: "boolean", optional: true },
    { name: "homepageVisible", label: "展示到店铺首页", type: "boolean", optional: true },
    { name: "postBookingInfo", label: "预约后可见信息，每行一项", maxLength: 240, optional: true },
  ],
  run: async (args) => {
    const payload: CreateCourseInput = {
      name: String(args.name), category: String(args.category), teacherId: String(args.teacherId), cardTemplateId: String(args.cardTemplateId),
      difficulty: Number(args.difficulty), duration: Number(args.duration), price: Number(args.price), intro: String(args.intro ?? ""),
      bookingNotice: String(args.bookingNotice ?? ""), room: String(args.room ?? "瑜伽房 A"), capacity: Number(args.capacity ?? 10), minimumEnrollment: Number(args.minimumEnrollment ?? 1),
      deductionCount: Number(args.deductionCount ?? 1), deductionAmount: Number(args.deductionAmount ?? 0), cancelBeforeMinutes: Number(args.cancelBeforeMinutes ?? 120),
      bookingOpensMinutes: Number(args.bookingOpensMinutes ?? 0), bookingClosesMinutes: Number(args.bookingClosesMinutes ?? 3), notifications: args.notifications === undefined ? [120] : numberList(args.notifications),
      autoCancelBelowMinimum: args.autoCancelBelowMinimum === true, homepageVisible: args.homepageVisible !== false, postBookingInfo: args.postBookingInfo ? String(args.postBookingInfo).split("\n").map((item) => item.trim()).filter(Boolean) : [],
    };
    const created = await props.api.createCourse(payload);
    emit("changed"); emit("navigate", "courses"); emit("openCourse", created.id); emit("notice", `课程「${created.name}」已创建并发布。`);
    return { created: true, course: created.name, teacher: props.data.teachers.find((item) => item.id === created.teacherId)?.name, applicableCard: props.data.cardTemplates.find((item) => item.id === created.cardTemplateId)?.name, status: "已发布" };
  },
});

useAgentTool({
  id: "merchant.update_course_defaults",
  label: "修改课程与排课默认值",
  desc: "修改现有课程资料与未来排课默认值。现有课时不会被改写；保存前先说明哪些字段会变化并获得确认。",
  kind: "write", confirm: true,
  params: [
    { name: "courseId", label: "要修改的课程", options: () => props.data.courses.map((item) => ({ value: item.id, label: `${item.name} · ${item.category}` })) },
    { name: "name", label: "新课程名称", minLength: 2, maxLength: 40, optional: true },
    { name: "teacherId", label: "授课老师", options: teacherOptions, optional: true },
    { name: "cardTemplateId", label: "适用会员卡", options: cardOptions, optional: true },
    { name: "difficulty", label: "难度星级", type: "number", min: 1, max: 5, optional: true },
    { name: "duration", label: "课程时长（分钟）", type: "number", min: 15, max: 240, optional: true },
    { name: "price", label: "单次价格（元）", type: "number", min: 0, optional: true },
    { name: "intro", label: "课程介绍", maxLength: 240, optional: true },
    { name: "bookingNotice", label: "约课须知", maxLength: 240, optional: true },
    { name: "room", label: "默认教室", maxLength: 40, optional: true },
    { name: "capacity", label: "最大人数", type: "number", min: 1, max: 40, optional: true },
    { name: "minimumEnrollment", label: "最低开课人数", type: "number", min: 1, max: 40, optional: true },
    { name: "deductionCount", label: "每节课扣卡次数", type: "number", min: 0, optional: true },
    { name: "deductionAmount", label: "每节课扣卡金额（元）", type: "number", min: 0, optional: true },
    { name: "cancelBeforeMinutes", label: "最晚取消时间（课前分钟）", type: "number", min: 0, optional: true },
    { name: "bookingOpensMinutes", label: "最早可约时间（课前分钟）", type: "number", min: 0, optional: true },
    { name: "bookingClosesMinutes", label: "最晚可约时间（课前分钟）", type: "number", min: 0, optional: true },
    { name: "notifications", label: "开课通知时间点，分钟列表，以逗号分隔", maxLength: 80, optional: true },
    { name: "autoCancelBelowMinimum", label: "未达最低人数时自动取消", type: "boolean", optional: true },
    { name: "homepageVisible", label: "展示到店铺首页", type: "boolean", optional: true },
    { name: "postBookingInfo", label: "预约后可见信息，每行一项", maxLength: 240, optional: true },
  ],
  run: async (args) => {
    const current = course(String(args.courseId));
    if (!current) throw new Error("找不到这门课程，请刷新后重新选择。");
    const updated = await props.api.updateCourse(current.id, {
      ...current,
      name: String(args.name ?? current.name), teacherId: String(args.teacherId ?? current.teacherId), cardTemplateId: String(args.cardTemplateId ?? current.cardTemplateId),
      difficulty: Number(args.difficulty ?? current.difficulty), duration: Number(args.duration ?? current.duration), price: Number(args.price ?? current.price),
      intro: String(args.intro ?? current.intro), bookingNotice: String(args.bookingNotice ?? current.bookingNotice ?? ""), room: String(args.room ?? current.room ?? "瑜伽房 A"),
      capacity: Number(args.capacity ?? current.capacity ?? 10), minimumEnrollment: Number(args.minimumEnrollment ?? current.minimumEnrollment ?? 1),
      deductionCount: Number(args.deductionCount ?? current.deductionCount ?? 1), deductionAmount: Number(args.deductionAmount ?? current.deductionAmount ?? 0),
      cancelBeforeMinutes: Number(args.cancelBeforeMinutes ?? current.cancelBeforeMinutes ?? 120), bookingOpensMinutes: Number(args.bookingOpensMinutes ?? current.bookingOpensMinutes ?? 0),
      bookingClosesMinutes: Number(args.bookingClosesMinutes ?? current.bookingClosesMinutes ?? 3),
      notifications: args.notifications === undefined ? current.notifications ?? [120] : numberList(args.notifications),
      autoCancelBelowMinimum: args.autoCancelBelowMinimum === undefined ? current.autoCancelBelowMinimum ?? false : args.autoCancelBelowMinimum === true,
      postBookingInfo: args.postBookingInfo === undefined ? current.postBookingInfo ?? [] : String(args.postBookingInfo).split("\n").map((item) => item.trim()).filter(Boolean),
      homepageVisible: args.homepageVisible === undefined ? current.homepageVisible : args.homepageVisible === true,
    });
    emit("changed"); emit("navigate", "courses"); emit("openCourse", updated.id); emit("notice", `课程「${updated.name}」的资料已更新；已有课时保持原设置。`);
    return { updated: true, course: updated.name, duration: updated.duration, room: updated.room, capacity: updated.capacity, existingLessonsChanged: false };
  },
});

useAgentTool({
  id: "merchant.add_teacher",
  label: "新增老师",
  desc: "新增老师档案。保存前核对姓名、手机号、擅长课程和私教资格。",
  kind: "write", confirm: true,
  params: [
    { name: "name", label: "老师姓名", minLength: 2, maxLength: 30 },
    { name: "phone", label: "手机号", pattern: /^1\d{10}$/ },
    { name: "specialties", label: "擅长课程，以顿号分隔", maxLength: 100 },
    { name: "yearsExperience", label: "教龄", values: ["不满一年", "1–3 年", "3–5 年", "5 年以上"], optional: true },
    { name: "privateEligible", label: "是否开通私教资格", type: "boolean", optional: true },
    { name: "introduction", label: "老师介绍", maxLength: 240, optional: true },
  ],
  run: async (args) => {
    const created = await props.api.createTeacher({ name: String(args.name), phone: String(args.phone), specialties: String(args.specialties).split(/[、,，]/), yearsExperience: args.yearsExperience ? String(args.yearsExperience) : undefined, privateEligible: args.privateEligible === true, introduction: String(args.introduction ?? "") });
    emit("changed"); emit("navigate", "teachers"); emit("notice", `老师「${created.name}」已加入门店。`);
    return { created: true, teacher: created.name, specialties: created.specialties, privateEligible: Boolean(created.privateEligible) };
  },
});

useAgentTool({
  id: "merchant.check_teacher_slot",
  label: "检查老师档期",
  desc: "只读检查老师在某日某时段是否已有团课安排。不会创建排课。",
  kind: "read",
  params: [
    { name: "teacherId", label: "授课老师", options: teacherOptions },
    { name: "date", label: "日期", format: "date" },
    { name: "start", label: "开始时间 HH:mm", pattern: /^\d{2}:\d{2}$/ },
    { name: "duration", label: "课时分钟数", type: "number", min: 15, max: 240 },
  ],
  run: async (args) => {
    const result = await props.api.checkTeacherSlot(String(args.teacherId), String(args.date), String(args.start), Number(args.duration));
    return { available: result.available, conflicts: result.conflicts };
  },
});

useAgentTool({
  id: "merchant.schedule_group_lesson",
  label: "安排团课",
  desc: "为已发布的非私教课程创建一节团课。请求确认前先打开团课排课页，让用户看到会受影响的排课列表；保存前检查并复述日期、时间、老师、教室和名额。",
  kind: "write", confirm: true,
  available: () => props.page === sectionNames["group-lessons"] || "请先打开团课排课页面，再请求用户确认新增课时。",
  params: [
    { name: "courseId", label: "团课课程", options: () => props.data.courses.filter((item) => item.status === "published" && item.category !== "私教").map((item) => ({ value: item.id, label: `${item.name} · ${item.duration} 分钟` })) },
    { name: "teacherId", label: "授课老师", options: teacherOptions },
    { name: "date", label: "上课日期", format: "date" },
    { name: "start", label: "开始时间 HH:mm", pattern: /^\d{2}:\d{2}$/ },
    { name: "duration", label: "时长（分钟）", type: "number", min: 15, max: 240, optional: true },
    { name: "room", label: "教室", maxLength: 40, optional: true },
    { name: "capacity", label: "可约人数", type: "number", min: 1, max: 40, optional: true },
  ],
  run: async (args) => {
    const selected = course(String(args.courseId));
    if (!selected || selected.category === "私教") throw new Error("请选择一门已发布的团课。");
    const created = await props.api.createLesson({ courseId: selected.id, teacherId: String(args.teacherId), date: String(args.date), start: String(args.start), duration: Number(args.duration ?? selected.duration), room: String(args.room ?? selected.room ?? "瑜伽房 A"), capacity: Number(args.capacity ?? selected.capacity ?? 10) });
    emit("changed"); emit("navigate", "group-lessons"); emit("notice", `「${selected.name}」已安排到 ${created.date} ${created.start}。`);
    return { created: true, course: selected.name, teacher: props.data.teachers.find((item) => item.id === created.teacherId)?.name, date: created.date, start: created.start, room: created.room, capacity: created.capacity };
  },
});

const seriesParams = () => [
  { name: "courseId", label: "团课课程", options: () => props.data.courses.filter((item) => item.status === "published" && item.category !== "私教").map((item) => ({ value: item.id, label: `${item.name} · ${item.duration} 分钟` })) },
  { name: "teacherId", label: "授课老师", options: teacherOptions },
  { name: "weekday", label: "星期几（周日 0 至周六 6）", type: "number" as const, options: () => [{ value: 0, label: "周日" }, { value: 1, label: "周一" }, { value: 2, label: "周二" }, { value: 3, label: "周三" }, { value: 4, label: "周四" }, { value: 5, label: "周五" }, { value: 6, label: "周六" }] },
  { name: "weeks", label: "连续周数", type: "number" as const, min: 1, max: 12 },
  { name: "start", label: "开始时间 HH:mm", pattern: /^\d{2}:\d{2}$/ },
  { name: "duration", label: "时长（分钟）", type: "number" as const, min: 15, max: 240, optional: true },
  { name: "room", label: "教室", maxLength: 40, optional: true },
  { name: "capacity", label: "可约人数", type: "number" as const, min: 1, max: 40, optional: true },
];

useAgentTool({
  id: "merchant.preview_group_lesson_series",
  label: "预览每周团课排期",
  desc: "只读预览从今天之后连续若干周某个星期几的团课日期，并逐日检查老师和教室冲突。相对日期由商家时区 Asia/Shanghai 计算；必须在创建重复排课前调用。",
  summary: "根据门店时区计算实际日期，先核对所有日期与冲突，不写入排课。",
  examples: ["接下来 3 周周二 13:00 安排瑜伽基础"],
  kind: "read",
  available: () => props.page === sectionNames["group-lessons"] || "请先打开团课排课页面，再预览排期。",
  params: seriesParams(),
  run: async (args) => {
    const selected = course(String(args.courseId));
    if (!selected || selected.category === "私教") throw new Error("请选择一门已发布的团课。");
    const preview = await props.api.previewLessonSeries({
      courseId: selected.id,
      teacherId: String(args.teacherId),
      weekday: Number(args.weekday),
      weeks: Number(args.weeks),
      start: String(args.start),
      duration: Number(args.duration ?? selected.duration),
      room: String(args.room ?? selected.room ?? "瑜伽房 A"),
      capacity: Number(args.capacity ?? selected.capacity ?? 10),
    });
    return { course: selected.name, teacher: props.data.teachers.find((item) => item.id === String(args.teacherId))?.name, time: args.start, timezone: "Asia/Shanghai", ...preview };
  },
});

useAgentTool({
  id: "merchant.create_group_lesson_series",
  label: "创建每周团课排期",
  desc: "创建连续多周的团课。必须先调用 merchant.preview_group_lesson_series，把具体日期和冲突告知用户；本动作保存前会再次检查所有日期，任一冲突则整批不写入。需要用户确认。",
  successHint: "所有新课时都应出现在团课排期列表中。",
  examples: ["确认，按预览的 3 个周二创建"],
  kind: "write", confirm: true,
  available: () => props.page === sectionNames["group-lessons"] || "请先打开团课排课页面，再创建重复排期。",
  params: seriesParams(),
  run: async (args) => {
    const selected = course(String(args.courseId));
    if (!selected || selected.category === "私教") throw new Error("请选择一门已发布的团课。");
    const created = await props.api.createLessonSeries({
      courseId: selected.id,
      teacherId: String(args.teacherId),
      weekday: Number(args.weekday),
      weeks: Number(args.weeks),
      start: String(args.start),
      duration: Number(args.duration ?? selected.duration),
      room: String(args.room ?? selected.room ?? "瑜伽房 A"),
      capacity: Number(args.capacity ?? selected.capacity ?? 10),
    });
    emit("changed");
    emit("notice", `「${selected.name}」已连续安排 ${created.length} 周，日期为 ${created.map((item) => item.date).join("、")}。`);
    return { created: true, course: selected.name, count: created.length, timezone: "Asia/Shanghai", dates: created.map((item) => item.date), start: created[0]?.start };
  },
});

useAgentTool({
  id: "merchant.open_private_availability",
  label: "开放私教时段",
  desc: "为有私教资格的老师开放一个可预约时间段。会校验日期、时间重叠和老师现有团课。",
  kind: "write", confirm: true,
  params: [
    { name: "teacherId", label: "私教老师", options: () => teacherOptions(true) },
    { name: "date", label: "日期", format: "date" },
    { name: "start", label: "开始时间 HH:mm", pattern: /^\d{2}:\d{2}$/ },
    { name: "end", label: "结束时间 HH:mm", pattern: /^\d{2}:\d{2}$/ },
  ],
  run: async (args) => {
    const created = await props.api.createAvailability({ teacherId: String(args.teacherId), date: String(args.date), start: String(args.start), end: String(args.end) });
    emit("changed"); emit("navigate", "private-lessons"); emit("notice", `已开放 ${created.date} ${created.start}–${created.end} 私教时段。`);
    return { created: true, teacher: props.data.teachers.find((item) => item.id === created.teacherId)?.name, date: created.date, start: created.start, end: created.end };
  },
});

useAgentTool({
  id: "merchant.book_private_lesson",
  label: "预约私教课",
  desc: "把唯一学员预约到其会员卡适用的私教课程和可用时段。重名需先确认身份；预约会占用时段但不扣卡次数。",
  kind: "write", confirm: true,
  params: [
    { name: "availabilityId", label: "可约时段", options: availableSlotOptions },
    { name: "courseId", label: "私教课程", options: () => props.data.courses.filter((item) => item.status === "published" && item.category === "私教").map((item) => ({ value: item.id, label: item.name })) },
    { name: "studentQuery", label: "学员（从候选中确认）", options: studentOptions },
  ],
  run: async (args) => {
    const created = await props.api.bookPrivateLesson({ availabilityId: String(args.availabilityId), courseId: String(args.courseId), studentQuery: String(args.studentQuery) });
    emit("changed"); emit("navigate", "private-lessons"); emit("notice", `已为${props.data.students.find((item) => item.id === created.studentId)?.name ?? "学员"}创建私教预约。`);
    return { created: true, student: props.data.students.find((item) => item.id === created.studentId)?.name, course: course(created.courseId)?.name, teacher: props.data.teachers.find((item) => item.id === created.teacherId)?.name, status: "已预约；未扣卡" };
  },
});

useAgentTool({
  id: "merchant.create_card_template",
  label: "创建会员卡模板",
  desc: "创建限时限次、无限次或储值卡模板。储值金额独立于售价；延期激活要明确保留。",
  kind: "write", confirm: true,
  params: [
    { name: "name", label: "卡片名称", minLength: 2, maxLength: 40 },
    { name: "kind", label: "卡片类型", values: ["limited-count", "unlimited", "stored-value"] },
    { name: "price", label: "售价（元）", type: "number", min: 0 },
    { name: "sessions", label: "限次数量；仅限次卡需要", type: "number", min: 1, optional: true },
    { name: "storedValue", label: "储值金额；仅储值卡需要", type: "number", min: 0.01, optional: true },
    { name: "validityDays", label: "有效天数", type: "number", min: 1, max: 3650 },
    { name: "applicable", label: "适用课程", maxLength: 120 },
    { name: "maxPerStudent", label: "每位学员限购张数", type: "number", min: 1, max: 100 },
    { name: "opensImmediately", label: "发卡后是否立即开卡", type: "boolean" },
  ],
  run: async (args) => {
    const created = await props.api.createCardTemplate({ name: String(args.name), kind: String(args.kind) as "limited-count" | "unlimited" | "stored-value", price: Number(args.price), sessions: Number(args.sessions ?? 0), storedValue: args.storedValue === undefined ? undefined : Number(args.storedValue), validityDays: Number(args.validityDays), applicable: String(args.applicable), maxPerStudent: Number(args.maxPerStudent), allowGuestBooking: false, opensImmediately: args.opensImmediately === true, bookingNotice: "" });
    pendingCardTemplates.set(created.id, created);
    emit("changed"); emit("navigate", "cards"); emit("notice", `会员卡模板「${created.name}」已保存。`);
    return { created: true, name: created.name, kind: created.kind, applicable: created.applicable, validityDays: created.validityDays };
  },
});

useAgentTool({
  id: "merchant.issue_membership_card",
  label: "给学员发卡",
  desc: "给用户明确选择的学员发放会员卡。学员选项由姓名和脱敏手机号组成，执行前需要再次确认。",
  kind: "write", confirm: true,
  params: [
    { name: "studentId", label: "学员", options: studentOptions },
    { name: "templateId", label: "会员卡模板", options: cardOptions },
  ],
  run: async (args) => {
    const created = await props.api.issueCard(String(args.studentId), String(args.templateId));
    emit("changed"); emit("navigate", "cards"); emit("notice", "会员卡已发放；如设置延期激活，可在学员档案中开卡。" );
    return { issued: true, student: props.data.students.find((item) => item.id === created.studentId)?.name, card: cardTemplate(created.templateId)?.name, status: created.status === "pending" ? "待开卡" : "已开卡", expiresOn: created.expiresOn || "激活后计算" };
  },
});

useAgentTool({
  id: "merchant.activate_membership_card",
  label: "激活会员卡",
  desc: "将人工确认的待开卡会员卡激活，有效期从今天开始。只允许选择待开卡记录。",
  kind: "write", confirm: true,
  available: () => pendingCardOptions().length ? true : "当前没有待开通的会员卡",
  params: [{ name: "card", label: "待激活会员卡", options: pendingCardOptions }],
  run: async ({ card }) => {
    const [studentId, cardId] = String(card).split("|");
    if (!studentId || !cardId) throw new Error("请从待开卡列表选择一张会员卡。");
    const activated = await props.api.activateCard(studentId, cardId);
    emit("changed"); emit("navigate", "students"); emit("showStudentCards", studentId); emit("notice", "会员卡已开通，有效期从今天开始计算。" );
    return { activated: true, student: props.data.students.find((item) => item.id === studentId)?.name, card: props.data.cardTemplates.find((item) => item.id === activated.templateId)?.name, expiresOn: activated.expiresOn };
  },
});
</script>

<template>
  <AgentInline
    title="门店助手"
    placeholder="说说你要处理的门店事务…"
    empty-hint="直接说“创建课程”“安排团课”或“查学员会员卡”。我会先确认关键信息，再按门店规则处理。"
    :quick="[
      '创建孕妇瑜伽，陈老师，孕产专项卡，2 星，60 分钟',
      '明天下午 3 点安排瑜伽基础，陈老师，瑜伽房 A，12 人',
      '林悦还有几次课？',
      '为林悦预约明天上午的私教体态评估',
    ]"
    :debug="{ maxCalls: 20 }"
    task-placement="pinned"
    model-settings="readonly"
  />
</template>
