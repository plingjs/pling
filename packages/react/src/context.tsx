import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { Registry } from "@plingjs/core";
import type {
  DeriveController,
  FeedbackCollector,
  PlingAskOptions,
  PlingTaskController,
  PresenceController,
  ScopeController,
  CoverageReport,
} from "@plingjs/dom";
import type { AgentConfigOverrides, AgentRuntimeOptions } from "@plingjs/agent";
import type { PlingUiController } from "@plingjs/ui";

/**
 * 应用级问答接线。与 Vue 的 `AgentSetup` 同义：
 * 业务侧只写在入口一次，`<AgentDock>` 自己取。
 */
export type AgentSetup = Omit<AgentRuntimeOptions, "config" | "registry" | "gate"> & {
  config?: AgentConfigOverrides;
  gate?: () => boolean;
};

export interface PlingElement {
  /** Shared language / theme / message controller (`createPling({ ui })`). */
  ui: PlingUiController;
  registry: Registry;
  /** ARIA 页面反馈收集器；共享页面只创建并观察一次。 */
  feedback: FeedbackCollector;
  /** 作用域容器 / 视口可见性 / 遮挡判定的控制器（与 Vue 共用 `@plingjs/dom` 实现）。 */
  scopes: ScopeController;
  /** 手动声明活跃作用域（自动判定之外的后门）。 */
  setActiveScopes(scopes: Iterable<string>): void;
  /** 动作高亮（存在感）；`presence: false` 时为 null。 */
  presence: PresenceController | null;
  /** L1 自动派生器（只在 `createPling({ derive: ... })` 时非空）。 */
  derived(): DeriveController | null;
  /** Human-facing task routing shared by all mounted surfaces. */
  task: PlingTaskController;
  /** Ask the mounted surface to start a task. Equivalent to `task.ask()`. */
  ask(prompt: string, options?: PlingAskOptions): Promise<void>;
  /** Read-only scan for actionable controls without a declaration. */
  inspectCoverage(root?: Element | null): CoverageReport;
  /** 停掉观察器（单页里反复建实例 / 测试用它）。 */
  destroy(): void;
  warn(message: string): void;
  /** 应用级问答接线（`createPling({ agent })`）；`<AgentDock>` 会用它。 */
  agent?: AgentSetup;
  /** 聊天里是否把 `{{p:…}}` 代号还原成真值，默认开。 */
  revealSensitive: boolean;
}

const PLING_CONTEXT = createContext<PlingElement | null>(null);

export interface PlingProviderProps {
  pling: PlingElement;
  children?: ReactNode;
}

/** 把应用级 Pling 实例放进 React 树。业务代码只在入口写一次。 */
export function PlingProvider({ pling, children }: PlingProviderProps) {
  return createElement(PLING_CONTEXT.Provider, { value: pling }, children);
}

export function usePling(): PlingElement {
  const found = useContext(PLING_CONTEXT);
  if (!found) throw new Error("pling: 请先用 <PlingProvider pling={...}> 包住应用");
  return found;
}

/** Subscribe to the shared UI snapshot. Locale and theme changes re-render in place. */
export function usePlingUi() {
  const pling = usePling();
  return useSyncExternalStore(
    pling.ui.subscribe,
    pling.ui.getSnapshot,
    pling.ui.getSnapshot,
  );
}
