import type { TaskDefinition, TaskField } from "@plingjs/agent";
import type { CourseService } from "./course-service";
import { COPY, type Locale } from "./copy";

export function createTaskDefinitions(service: CourseService, locale: Locale): TaskDefinition[] {
  const copy = COPY[locale];
  const studentField: TaskField = {
    name: "studentId",
    label: copy.studentLookup,
    type: "lookup",
    searchAction: "search_students",
    minChars: 1,
    help: copy.studentHelp,
    lookup: (query) => service.searchStudents(query),
  };

  const teacherField: TaskField = {
    name: "teacherId",
    label: copy.teacher,
    type: "lookup",
    searchAction: "search_teachers",
    minChars: 1,
    lookup: (query) => {
      const needle = query.trim().toLowerCase().replace(/\s*(老师|教師|教师|teacher)$/i, "").trim();
      return service.teachers
        .filter(
          (teacher) =>
            !needle || teacher.name.toLowerCase().includes(needle) || teacher.subject.toLowerCase().includes(needle),
        )
        .map((teacher) => ({
          value: teacher.id,
          label: teacher.name,
          description: teacher.subject,
        }));
    },
    validate: (value) =>
      service.teachers.some((teacher) => teacher.id === value)
        ? null
        : locale === "zh"
          ? "请从 search_teachers 的结果中选择老师。"
          : "Choose a teacher from the search_teachers results.",
  };

  const cardChoices = locale === "zh"
    ? [
        { value: "月卡", label: "月卡" },
        { value: "私教 10 次卡", label: "私教 10 次卡" },
        { value: "单次体验卡", label: "单次体验卡" },
      ]
    : [
        { value: "Monthly card", label: "Monthly card" },
        { value: "10-class personal training", label: "10-class personal training" },
        { value: "Single-class trial", label: "Single-class trial" },
      ];

  return [
    {
      id: "course.create",
      title: copy.taskCourseTitle,
      description: copy.taskCourseDesc,
      objective: locale === "zh"
        ? "帮助用户把一门可上架的课程创建到课程库，而不是机械地逐个询问字段。"
        : "Help the person create a publishable course in the catalogue instead of walking a fixed field sequence.",
      constraints: locale === "zh"
        ? [
            "课程名称、授课老师、可用卡与封面是完成条件；难度、介绍、须知、扣卡次数和价格可省略。",
            "封面必须由用户亲自上传，助手不能伪造。",
            "所有写入仍走 create_course 动作、执行器和回读校验。",
            "用户的问题、修改、暂停和放弃优先于继续收集字段。",
          ]
        : [
            "The course name, teacher, eligible cards and cover are the completion conditions; difficulty, intro, notes, deductions and price are optional.",
            "The cover must be uploaded by the person; the assistant must not fake it.",
            "Every write still goes through the create_course action, executor and read-back verification.",
            "Questions, corrections, pauses and abandonment take precedence over collecting the next field.",
          ],
      successCriteria: locale === "zh"
        ? ["新课程出现在课程库第一位", "名称、老师、可用卡和封面与用户确认的一致", "写入后重新读取课程列表验证成功"]
        : ["The new course appears first in the catalogue", "Name, teacher, eligible cards and cover match what the person confirmed", "The catalogue is read back after the write"],
      examples: [copy.courseExample],
      risk: "write",
      fields: [
        {
          name: "name",
          label: copy.courseName,
          placeholder: copy.courseNamePlaceholder,
          minLength: 1,
          maxLength: 40,
          recommended: locale === "zh" ? "瑜伽基础" : "Yoga foundations",
        },
        { ...teacherField, recommended: service.teachers[0]?.id ?? "" },
        {
          name: "cards",
          label: copy.courseCards,
          type: "select",
          values: cardChoices,
          recommended: cardChoices[0]?.value ?? "",
        },
        {
          name: "cover",
          label: locale === "zh" ? "课程封面" : "Course cover",
          type: "boolean",
          help: locale === "zh"
            ? "必须由用户亲自上传，助手不能代选或伪造"
            : "Must be uploaded by the person; the assistant cannot choose or fake it",
          agentWritable: false,
        },
        {
          name: "difficulty",
          label: copy.difficulty,
          type: "number",
          optional: true,
          min: 1,
          max: 5,
          recommended: 3,
        },
        {
          name: "price",
          label: copy.coursePrice,
          type: "text",
          optional: true,
          pattern: "^\\d+(?:\\.\\d+)?$",
          recommended: "200",
        },
        {
          name: "deduct",
          label: copy.courseDeduct,
          type: "text",
          optional: true,
          pattern: "^[1-9]\\d*$",
          recommended: "1",
        },
        {
          name: "intro",
          label: copy.courseIntro,
          type: "textarea",
          optional: true,
          maxLength: 200,
        },
        {
          name: "note",
          label: copy.courseNote,
          type: "textarea",
          optional: true,
          maxLength: 200,
        },
      ],
      steps: [
        {
          label: copy.createCourseStep,
          summary: copy.createCourseSummary,
          action: "create_course",
          args: (values) => ({
            name: values.name,
            teacherId: values.teacherId,
            cards: values.cards,
            difficulty: values.difficulty ?? 3,
            price: values.price || "200",
            deduct: values.deduct || "1",
            intro: values.intro,
            note: values.note,
          }),
        },
      ],
    },
    {
      id: "student.cards",
      title: copy.taskCardsTitle,
      description: copy.taskCardsDesc,
      examples: [copy.cardsExample],
      risk: "read",
      fields: [studentField],
      steps: [
        {
          label: copy.readCards,
          summary: copy.readCardsSummary,
          action: "get_student_cards",
          args: (values) => ({ studentId: values.studentId }),
        },
      ],
    },
    {
      id: "teacher.create",
      title: copy.taskTeacherTitle,
      description: copy.taskTeacherDesc,
      examples: [copy.teacherExample],
      risk: "write",
      fields: [
        { name: "name", label: copy.teacherName },
        { name: "phone", label: copy.teacherPhone, placeholder: "138 0000 0000" },
        { name: "subject", label: copy.subject, placeholder: copy.subjectPlaceholder },
      ],
      steps: [
        {
          label: copy.createTeacherStep,
          summary: copy.createTeacherSummary,
          action: "create_teacher",
          args: (values) => ({ name: values.name, phone: values.phone, subject: values.subject }),
        },
      ],
    },
    {
      id: "course.schedule",
      title: copy.taskScheduleTitle,
      description: copy.taskScheduleDesc,
      examples: [copy.scheduleExample],
      risk: "write",
      fields: [
        studentField,
        teacherField,
        { name: "date", label: copy.date, type: "date", defaultValue: "2026-03-18" },
        {
          name: "time",
          label: copy.time,
          type: "select",
          defaultValue: "10:00",
          values: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"].map((time) => ({ value: time, label: time })),
        },
        {
          name: "course",
          label: copy.course,
          type: "select",
          defaultValue: locale === "zh" ? "瑜伽基础" : "Yoga foundations",
          values: [
            { value: locale === "zh" ? "瑜伽基础" : "Yoga foundations", label: locale === "zh" ? "瑜伽基础" : "Yoga foundations" },
            { value: locale === "zh" ? "普拉提入门" : "Pilates intro", label: locale === "zh" ? "普拉提入门" : "Pilates intro" },
            { value: locale === "zh" ? "私教课" : "Personal training", label: locale === "zh" ? "私教课" : "Personal training" },
          ],
        },
      ],
      steps: [
        {
          label: copy.checkSlot,
          summary: copy.checkSlotSummary,
          action: "check_slot",
          args: (values) => ({ teacherId: values.teacherId, date: values.date, time: values.time }),
        },
        {
          label: copy.createLesson,
          summary: copy.createLessonSummary,
          action: "create_lesson",
          args: (values) => ({
            studentId: values.studentId,
            teacherId: values.teacherId,
            date: values.date,
            time: values.time,
            course: values.course,
          }),
        },
      ],
    },
    {
      id: "lesson.note",
      title: copy.taskNoteTitle,
      description: copy.taskNoteDesc,
      examples: [copy.noteExample],
      risk: "write",
      requiresRecord: true,
      fields: [
        {
          name: "note",
          label: copy.note,
          type: "textarea",
          placeholder: copy.notePlaceholder,
          help: copy.noteHelp,
        },
      ],
      steps: [
        {
          label: copy.updateNoteStep,
          summary: copy.updateNoteSummary,
          action: "update_lesson_note",
          args: (values, binding) => ({ lessonId: binding.record?.id, note: values.note }),
        },
      ],
    },
  ];
}
