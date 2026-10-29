import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRegistry } from "@plingjs/core";
import { createFeedbackCollector } from "../src/feedback";

let stop: (() => void) | null = null;

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stop?.();
  stop = null;
  document.body.innerHTML = "";
});

describe("页面反馈收集器", () => {
  it("从明确的无障碍语义读取反馈", () => {
    document.body.innerHTML = `
      <p role="alert">保存失败，请重试</p>
      <p role="status">已保存</p>
      <p aria-live="assertive">库存不足</p>
    `;
    const registry = createRegistry();
    const collector = createFeedbackCollector(registry);
    stop = () => collector.stop();
    collector.start();

    expect(registry.snapshot().feedback.map((item) => [item.message, item.severity, item.source])).toEqual([
      ["保存失败，请重试", "error", "aria"],
      ["已保存", "info", "aria"],
      ["库存不足", "warning", "aria"],
    ]);
  });

  it("无效输入从标签和错误说明取得字段与原因", () => {
    document.body.innerHTML = `
      <form>
        <label for="workspace">工作区名称</label>
        <input id="workspace" aria-invalid="true" aria-errormessage="workspace-error" />
        <p id="workspace-error">请填写工作区名称</p>
      </form>
    `;
    const registry = createRegistry();
    const collector = createFeedbackCollector(registry);
    stop = () => collector.stop();
    collector.start();

    expect(registry.snapshot().feedback[0]).toMatchObject({
      message: "请填写工作区名称",
      field: "工作区名称",
      severity: "error",
      source: "aria",
    });
  });

  it("不按样式猜测，也不收集框架自己的界面", () => {
    document.body.innerHTML = `
      <p class="error toast">这只是样式</p>
      <div data-pling-ui><p role="alert">框架提示</p></div>
      <p role="alert" hidden>隐藏的错误</p>
    `;
    const registry = createRegistry();
    const collector = createFeedbackCollector(registry);
    stop = () => collector.stop();
    collector.start();

    expect(registry.snapshot().feedback).toEqual([]);
  });

  it("停止后撤掉自动收集的反馈", () => {
    document.body.innerHTML = '<p role="alert">保存失败</p>';
    const registry = createRegistry();
    const collector = createFeedbackCollector(registry);
    collector.start();
    expect(registry.snapshot().feedback).toHaveLength(1);

    collector.stop();
    expect(registry.snapshot().feedback).toEqual([]);
  });
});
