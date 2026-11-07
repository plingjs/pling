import { describe, expect, it } from "vitest";
import { composeCourseIntakeReply, parseCourseIntake, shouldUseAgent } from "./intake";
import {
  courseCardOptions,
  courseTeachers,
  emptyCourseDraft,
  recommendedCourse,
  type CourseDraft,
} from "./model";

function context(locale: "zh" | "en" = "zh") {
  const teachers = courseTeachers(locale);
  return {
    locale,
    teachers,
    recommended: recommendedCourse(locale, teachers),
    cardOptions: courseCardOptions(locale),
  };
}

function apply(draft: CourseDraft, patch: Record<string, unknown>, teachers = courseTeachers("zh")): CourseDraft {
  const next = { ...draft };
  for (const [key, value] of Object.entries(patch)) {
    if (key === "teacherId") {
      next.teacherId = String(value);
      next.teacherName = teachers.find((teacher) => teacher.id === value)?.name ?? "";
    } else {
      (next as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}

describe("course intake", () => {
  it("understands a complete Chinese course description in one pass", () => {
    const options = context();
    const result = parseCourseIntake("创建课程：孕妇瑜伽，陈老师，2星，介绍自动填写", options);

    expect(result.wantsCreate).toBe(true);
    expect(result.patch.name).toBe("孕妇瑜伽");
    expect(result.patch.teacherId).toBe("tea_chen");
    expect(result.patch.difficulty).toBe(2);
    expect(result.patch.intro).toContain("孕期");
    expect(result.unknownTeacher).toBeUndefined();
    expect(result.recognized).toEqual(["difficulty", "teacher", "name", "intro"]);
  });

  it("treats a short follow-up as a correction to the current draft", () => {
    const options = context();
    const result = parseCourseIntake("难度改成 4 星", options);

    expect(result.correction).toBe(true);
    expect(result.patch.difficulty).toBe(4);
    expect(result.patch.name).toBeUndefined();
  });

  it("does not turn a cadence fragment into the course name", () => {
    const options = context();
    const result = parseCourseIntake("每节扣2次", options);

    expect(result.patch).toEqual({ deduct: "2" });
    expect(result.recognized).toEqual(["deduct"]);
    expect(result.patch.name).toBeUndefined();
  });

  it("keeps the real name when a cadence correction follows it", () => {
    const options = context();
    const result = parseCourseIntake("孕妇瑜伽，每节扣2次", options);

    expect(result.patch.name).toBe("孕妇瑜伽");
    expect(result.patch.deduct).toBe("2");
  });

  it("does not silently replace an unknown teacher", () => {
    const options = context();
    const result = parseCourseIntake("空中瑜伽，王老师，月卡", options);

    expect(result.patch.name).toBe("空中瑜伽");
    expect(result.patch.cards).toBe("月卡");
    expect(result.patch.teacherId).toBeUndefined();
    expect(result.unknownTeacher).toBe("王老师");
  });

  it("understands a Chinese rename without asking for every field again", () => {
    const options = context();
    const result = parseCourseIntake("把课程名字改成减脂瑜伽", options);

    expect(result.correction).toBe(true);
    expect(result.patch.name).toBe("减脂瑜伽");
    expect(result.patch.teacherId).toBeUndefined();
  });

  it("asks instead of guessing when a correction has no recognisable field", () => {
    const options = context();
    const result = parseCourseIntake("帮我改一下", options);
    const draft = apply(emptyCourseDraft(), result.patch);
    const reply = composeCourseIntakeReply({ ...options, draft, result });

    expect(result.correction).toBe(true);
    expect(result.recognized).toHaveLength(0);
    expect(reply).toContain("没抓到要改哪个字段");
  });

  it("asks for the real gaps instead of walking every field", () => {
    const options = context();
    const result = parseCourseIntake("孕妇瑜伽，陈老师，2星，介绍自动填写", options);
    const draft = apply(emptyCourseDraft(), result.patch);
    const reply = composeCourseIntakeReply({ ...options, draft, result });

    expect(reply).toContain("已填入");
    expect(reply).toContain("可用卡还没定");
    expect(reply).not.toContain("约课须知");
    expect(reply).not.toContain("扣卡次数");
  });

  it("answers a question instead of treating it as the course name", () => {
    const options = context();
    for (const text of ["你会做什么", "我该做什么", "这个页面能干什么", "还能改吗"]) {
      const result = parseCourseIntake(text, options);

      expect(result.patch.name, text).toBeUndefined();
      expect(result.question, text).toBe(true);
      expect(result.recognized, text).not.toContain("name");

      const reply = composeCourseIntakeReply({
        ...options,
        draft: emptyCourseDraft(),
        result,
      });
      expect(reply, text).toContain("我可以帮你");
      expect(reply, text).not.toContain("课程名称还没给");
    }
  });

  it("accepts a short name answer only while the page is asking for the name", () => {
    const options = context();
    const result = parseCourseIntake("孕妇瑜伽", { ...options, expects: "name" });
    expect(result.patch.name).toBe("孕妇瑜伽");
    expect(result.question).toBe(false);

    const ordinaryChat = parseCourseIntake("今天天气不错", options);
    expect(ordinaryChat.patch.name).toBeUndefined();
  });

  it("does not turn an ordinary question into a value while another field is expected", () => {
    const options = context();
    const result = parseCourseIntake("这个字段是什么意思？", { ...options, expects: "name" });
    expect(result.patch.name).toBeUndefined();
    expect(result.question).toBe(true);
  });

  it("treats a delegated choice as an agent turn, not as a value", () => {
    const options = context();
    for (const text of ["你来帮我随便填", "帮我随便填", "你看着办", "都用推荐"]) {
      const result = parseCourseIntake(text, { ...options, expects: "name" });

      expect(result.patch.name, text).toBeUndefined();
      expect(result.autofill, text).toBe(true);
      expect(result.recognized, text).not.toContain("name");
      expect(shouldUseAgent(result), text).toBe(true);
    }
  });

  it("keeps field-specific delegation on the deterministic path", () => {
    const result = parseCourseIntake("随便选老师，月卡", context());
    expect(result.autofill).toBe(false);
    expect(result.patch.teacherId).toBe(context().recommended.teacherId);
    expect(result.patch.cards).toBe("月卡");
    expect(shouldUseAgent(result)).toBe(false);
  });

  it("routes questions and explicit commands to the right layer", () => {
    const options = context();
    expect(shouldUseAgent(parseCourseIntake("你会做什么", options))).toBe(true);
    expect(shouldUseAgent(parseCourseIntake("保存可以吗", options))).toBe(true);
    expect(shouldUseAgent(parseCourseIntake("保存", options))).toBe(false);
    expect(shouldUseAgent(parseCourseIntake("孕妇瑜伽，陈老师，2 星", options))).toBe(false);
    expect(shouldUseAgent(parseCourseIntake("今天天气不错", options))).toBe(true);
  });

  it("supports the English form of the same instruction", () => {
    const options = context("en");
    const result = parseCourseIntake("Create a course: pregnancy yoga, Chen, 2 stars, write the intro", options);

    expect(result.patch.name).toBe("pregnancy yoga");
    expect(result.patch.teacherId).toBe("tea_chen");
    expect(result.patch.difficulty).toBe(2);
    expect(result.patch.intro).toContain("prenatal");
  });

  it("uses the recommended teacher when the user leaves the teacher open", () => {
    const options = context();
    const result = parseCourseIntake("瑜伽进阶2星 老师随意，月卡", options);

    expect(result.patch.name).toBe("瑜伽进阶");
    expect(result.patch.difficulty).toBe(2);
    expect(result.patch.cards).toBe("月卡");
    expect(result.patch.teacherId).toBe(options.recommended.teacherId);
    expect(result.unknownTeacher).toBeUndefined();
  });

  it("understands other ways of saying any teacher", () => {
    const zh = parseCourseIntake("随便选老师，月卡", context());
    expect(zh.patch.teacherId).toBe(context().recommended.teacherId);
    expect(zh.unknownTeacher).toBeUndefined();

    const enOptions = context("en");
    const en = parseCourseIntake("any teacher, monthly card", enOptions);
    expect(en.patch.teacherId).toBe(enOptions.recommended.teacherId);
    expect(en.unknownTeacher).toBeUndefined();
  });
});
