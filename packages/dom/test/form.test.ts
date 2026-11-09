import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFormSurface } from "../src/form";

function formHtml(): string {
  return `
    <div id="form">
      <label class="field" data-field="name" data-required="true">
        <span class="field-label">课程名称 必填</span>
        <input name="name" />
      </label>
      <label class="field" data-field="teacher" data-required="true">
        <span class="field-label">授课老师</span>
        <select name="teacherId">
          <option value="">请选择</option>
          <option value="tea_zhou">周敏 · 瑜伽</option>
          <option value="tea_chen">陈静 · 孕产瑜伽</option>
        </select>
      </label>
      <div class="field" data-field="difficulty">
        <span class="field-label">难度 ?</span>
        <input type="number" min="1" max="5" />
      </div>
      <label class="field" data-field="intro">
        <span class="field-label">课程介绍</span>
        <textarea></textarea>
      </label>
      <div class="field" data-field="cover" data-required="true" data-human-only="true">
        <span class="field-label">课程封面</span>
        <button type="button">上传</button>
      </div>
    </div>
  `;
}

describe("createFormSurface", () => {
  beforeEach(() => {
    document.body.innerHTML = formHtml();
  });

  it("derives labels, required flags, current values and select options from the real DOM", () => {
    const surface = createFormSurface({ root: () => document.querySelector("#form") });
    const view = surface.view();

    expect(view.fields.map((field) => field.name)).toEqual(["name", "teacher", "difficulty", "intro", "cover"]);
    expect(view.fields[0]).toMatchObject({ label: "课程名称", required: true, kind: "text" });
    expect(view.fields[1]).toMatchObject({ label: "授课老师", required: true, kind: "select" });
    expect(view.fields[1]!.options?.map((option) => option.value)).toEqual(["", "tea_zhou", "tea_chen"]);
    expect(view.fields[2]).toMatchObject({ label: "难度", kind: "number", min: 1, max: 5 });
    expect(view.fields[4]).toMatchObject({ required: true, kind: "human" });
    expect(view.missing).toEqual(["name", "teacher", "cover"]);
    expect(view.complete).toBe(false);
  });

  it("writes through native events and reports page-only fields instead of faking them", async () => {
    const surface = createFormSurface({ root: () => document.querySelector("#form") });
    const name = document.querySelector<HTMLInputElement>('[data-field="name"] input')!;
    const intro = document.querySelector<HTMLTextAreaElement>('[data-field="intro"] textarea')!;
    const input = vi.fn();
    name.addEventListener("input", input);

    const result = await surface.fill({
      name: "孕妇瑜伽",
      teacher: "tea_chen",
      difficulty: 2,
      intro: "适合孕中期",
      cover: true,
    });

    expect(result.applied).toEqual(["name", "teacher", "difficulty", "intro"]);
    expect(result.skipped).toEqual([
      { field: "cover", reason: "This field must be completed by the person in the page." },
    ]);
    expect(name.value).toBe("孕妇瑜伽");
    expect(intro.value).toBe("适合孕中期");
    expect(input).toHaveBeenCalled();
    expect(surface.read()).toMatchObject({
      name: "孕妇瑜伽",
      teacher: "tea_chen",
      difficulty: 2,
      intro: "适合孕中期",
    });
    expect(result.view.missing).toEqual(["cover"]);
  });

  it("rejects unknown fields and invalid select options with actionable reasons", async () => {
    const surface = createFormSurface({ root: () => document.querySelector("#form") });
    const result = await surface.fill({ teacherId: "tea_chen", teacher: "tea_missing" });

    expect(result.applied).toEqual([]);
    expect(result.skipped[0]).toMatchObject({
      field: "teacherId",
      reason: expect.stringContaining("available fields: name, teacher, difficulty, intro, cover"),
    });
    expect(result.skipped[1]).toMatchObject({
      field: "teacher",
      reason: expect.stringContaining("choose from"),
    });
  });

  it("lets a page-only field report completion without becoming agent-writable", () => {
    const surface = createFormSurface({ root: () => document.querySelector("#form") });
    document.querySelector('[data-field="cover"]')!.setAttribute("data-value", "true");

    const view = surface.view();
    expect(view.fields.find((field) => field.name === "cover")).toMatchObject({
      kind: "human",
      value: "true",
    });
    expect(view.missing).not.toContain("cover");
  });

  it("focuses the real field without changing its value", async () => {
    const surface = createFormSurface({ root: () => document.querySelector("#form"), focusDuration: 0 });
    const focused = await surface.focus("teacher");
    const field = document.querySelector('[data-field="teacher"]')!;

    expect(focused).toBe(true);
    expect(field.classList.contains("is-pointed")).toBe(true);
    expect(surface.read().teacher).toBe("");
  });
});
