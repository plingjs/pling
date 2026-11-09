import type { TaskGoalInput } from "@plingjs/agent";
import type { Locale } from "../course-workspace/copy";

/**
 * The whole task contract for this example.
 *
 * The real page already exposes `new_course`, every field, the cover handoff
 * and `save_course`. Repeating them in a field schema would create a second
 * source of truth. The goal only adds what the page cannot express by itself:
 * why the work continues after the modal closes, and how completion is judged.
 */
export function courseGoal(locale: Locale): TaskGoalInput {
  const zh = locale === "zh";
  return {
    id: "course.create",
    title: zh ? "创建课程" : "Create a course",
    goal: zh
      ? "在课程管理里新建一门课程：自己打开真实表单，按用户给出的信息填写，封面请用户上传，保存后回读课程库确认新课程在第一位。"
      : "Create a course in the course workspace: open the real form yourself, fill what the person supplied, ask them to upload the cover, save, then read the catalogue back and confirm the new course is first.",
    constraints: zh
      ? [
          "页面上的动作是唯一操作入口；不要另造字段名、选择器或表单。",
          "只填写用户明确给出或明确委托的内容；不确定就问。",
          "封面必须由用户亲自上传，你不能替用户选择本地文件。",
          "用户的问题、修改、暂停和放弃优先于继续填表。",
        ]
      : [
          "The page's actions are the only way to operate it; do not invent field names, selectors or a second form.",
          "Fill only what the person supplied or explicitly delegated; ask when unsure.",
          "The person must upload the cover; never choose a local file for them.",
          "Questions, corrections, pauses and abandonment take precedence over filling the form.",
        ],
    successCriteria: zh
      ? [
          "新课程出现在课程库第一位",
          "名称、老师、可用卡和封面与用户确认的一致",
          "保存动作已回读课程库并确认了这条新记录",
        ]
      : [
          "The new course appears first in the catalogue",
          "Name, teacher, eligible cards and cover match what the person confirmed",
          "The save action read the catalogue back and confirmed the new record",
        ],
    examples: zh
      ? ["创建孕妇瑜伽，陈静，2 星，月卡，介绍自动填写", "帮我开一门普拉提，林老师，月卡"]
      : ["Create prenatal yoga with Chen Jing, 2 stars, monthly card, write the intro", "Add a Pilates course with Lin Lin and the monthly card"],
    labels: zh ? { running: "进行中", completed: "已完成" } : { running: "In progress", completed: "Completed" },
    cancelLabel: zh ? "取消任务" : "Cancel task",
  };
}
