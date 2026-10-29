import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createPling,
  createPlingPage,
  PlingProvider,
  usePlingFeedback,
  usePlingGuideTarget,
} from "../src";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  document.body.innerHTML = "";
  root = null;
  host = null;
});

describe("React 页面反馈", () => {
  it("声明、更新并清除只读反馈", async () => {
    const pling = createPling({ presence: false, onWarn: () => {} });
    pling.registry.setActiveScopes(["release_check"]);

    function ReleaseStatus({
      message,
      field,
      severity,
    }: {
      message: string;
      field?: string;
      severity?: "error" | "warning" | "info" | "success";
    }) {
      usePlingFeedback(
        message
          ? {
              id: "release_feedback",
              message,
              ...(field ? { field } : {}),
              ...(severity ? { severity } : {}),
              scope: "release_check",
            }
          : null,
      );
      return <p>{message}</p>;
    }

    await act(async () => {
      root!.render(
        <PlingProvider pling={pling}>
          <ReleaseStatus message="请填写工作区名称" field="workspace_name" severity="error" />
        </PlingProvider>,
      );
    });

    expect(pling.registry.snapshot().feedback[0]).toMatchObject({
      id: "release_feedback",
      message: "请填写工作区名称",
      field: "workspace_name",
      severity: "error",
      scope: "release_check",
      source: "declared",
    });
    expect(pling.registry.snapshot().actions).toEqual([]);

    await act(async () => {
      root!.render(
        <PlingProvider pling={pling}>
          <ReleaseStatus message="名称过长" field="workspace_name" severity="warning" />
        </PlingProvider>,
      );
    });
    expect(pling.registry.snapshot().feedback[0]).toMatchObject({
      message: "名称过长",
      severity: "warning",
    });

    await act(async () => {
      root!.render(
        <PlingProvider pling={pling}>
          <ReleaseStatus message="" />
        </PlingProvider>,
      );
    });
    expect(pling.registry.snapshot().feedback).toEqual([]);
    pling.destroy();
  });

  it("反馈 id 与区域遵循适配器命名空间", async () => {
    const pling = createPling({ namespace: "release", presence: false, onWarn: () => {} });
    pling.setActiveScopes(["release_check"]);

    function FormError() {
      usePlingFeedback({
        id: "required",
        message: "请填写工作区名称",
        scope: "release_check",
        field: "workspace_name",
      });
      return null;
    }

    await act(async () => {
      root!.render(
        <PlingProvider pling={pling}>
          <FormError />
        </PlingProvider>,
      );
    });

    expect(pling.registry.snapshot().feedback[0]).toMatchObject({
      id: "release/required",
      scope: "release/release_check",
    });
    pling.destroy();
  });

  it("高亮目标不进入动作清单，并遵循命名空间", async () => {
    const pling = createPling({ namespace: "release", presence: false, onWarn: () => {} });

    function VerificationCode() {
      const ref = usePlingGuideTarget<HTMLInputElement>("verification_code");
      return <input ref={ref} aria-label="发布验证码" />;
    }

    await act(async () => {
      root!.render(
        <PlingProvider pling={pling}>
          <VerificationCode />
        </PlingProvider>,
      );
    });

    expect(pling.registry.markGuideTarget("verification_code", "waiting")).toBe(true);
    expect(pling.registry.snapshot().actions).toEqual([]);
    pling.destroy();
  });

  it("自动收集 ARIA 反馈，同时忽略框架界面", async () => {
    const pling = createPling({ presence: false, onWarn: () => {} });

    await act(async () => {
      root!.render(
        <PlingProvider pling={pling}>
          <p role="alert">保存失败，请重试</p>
        </PlingProvider>,
      );
    });
    pling.feedback.sync();
    expect(pling.registry.snapshot().feedback[0]).toMatchObject({
      message: "保存失败，请重试",
      source: "aria",
    });

    const ownUi = document.createElement("div");
    ownUi.setAttribute("data-pling-ui", "");
    ownUi.innerHTML = '<p role="alert">框架自己的提示</p>';
    document.body.append(ownUi);
    pling.feedback.sync();
    expect(pling.registry.snapshot().feedback.map((item) => item.message)).not.toContain("框架自己的提示");
    pling.destroy();
  });

  it("共享页面只持有一个收集器，单个岛销毁不会停掉页面反馈", async () => {
    const page = createPlingPage();
    const left = createPling({ shared: page, namespace: "left", presence: false, onWarn: () => {} });
    const right = createPling({ shared: page, namespace: "right", presence: false, onWarn: () => {} });

    expect(left.feedback).toBe(page.feedback);
    expect(right.feedback).toBe(page.feedback);

    document.body.insertAdjacentHTML("beforeend", '<p role="alert">页面级错误</p>');
    page.feedback.sync();
    expect(page.registry.snapshot().feedback).toHaveLength(1);

    left.destroy();
    expect(page.registry.snapshot().feedback).toHaveLength(1);
    page.destroy();
    expect(page.registry.snapshot().feedback).toEqual([]);
    right.destroy();
  });
});
