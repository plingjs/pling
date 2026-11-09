import { describe, expect, it } from "vitest";
import { courseGoal } from "./task";

describe("course goal", () => {
  it("declares only the outcome, boundaries and completion evidence", () => {
    const goal = courseGoal("zh");

    expect(goal.id).toBe("course.create");
    expect(goal.goal).toContain("自己打开真实表单");
    expect(goal.constraints?.join("\n")).toContain("页面上的动作是唯一操作入口");
    expect(goal.constraints?.join("\n")).toContain("封面必须由用户亲自上传");
    expect(goal.successCriteria?.join("\n")).toContain("课程库第一位");
    expect(goal).not.toHaveProperty("fields");
    expect(goal).not.toHaveProperty("steps");
    expect(goal).not.toHaveProperty("controller");
  });

  it("localizes the same contract for English pages", () => {
    const goal = courseGoal("en");

    expect(goal.title).toBe("Create a course");
    expect(goal.constraints?.join("\n")).toContain("The page's actions are the only way to operate it");
    expect(goal.successCriteria?.join("\n")).toContain("first in the catalogue");
    expect(goal.cancelLabel).toBe("Cancel task");
  });
});
