import { createRegistry, type Registry } from "@plingjs/core";
import {
  createActionNamespace,
  createPresence,
  createScopeController,
  createFeedbackCollector,
  createDeriver,
  createTaskController,
  inspectCoverage,
  type DeriveController,
  type DeriveOptions,
  type PresenceOptions,
  type ScopeControllerOptions,
  type PlingPage,
} from "@plingjs/dom";
import { resolveAgentConfig } from "@plingjs/agent";
import { createUiController, type PlingUiOptions } from "@plingjs/ui";
import { readViteEnv } from "./env";
import type { AgentSetup, PlingElement } from "./context";

export interface PlingOptions {
  /** Shared framework UI language, theme and message overrides. Defaults to English. */
  ui?: PlingUiOptions;
  registry?: Registry;
  /**
   * 混合框架页面共享的页面运行时（`createPlingPage()`）。
   * 传了它之后 `registry` / `scopes` 由页面统一持有，不能再单独覆盖。
   */
  shared?: PlingPage;
  /**
   * 本适配器的动作 id 命名空间：`add` → `todo/add`。
   * 同一页面的不同岛各用一个 namespace，就可以复用同一套局部动作 id。
   */
  namespace?: string;
  onWarn?: (message: string) => void;
  /** 问答入口接线：模型、钩子、确认通道等都写在这里。 */
  agent?: AgentSetup;
  /** 聊天里把敏感值代号还原成真值；默认开。 */
  revealSensitive?: boolean;
  /** 可见性 / 遮挡判定的注入点（测试与无布局环境用）。 */
  scopes?: ScopeControllerOptions;
  /**
   * 动作高亮（存在感）：默认开启。传 `false` 全关，或传对象换画法 / 最短显示时间。
   */
  presence?: boolean | PresenceOptions;
  /**
   * L1 自动派生：默认关闭。传 `true` 让框架从 DOM 认出原生可点元素
   * （`button` / `a[href]` / `input[type=submit|button|reset]`），
   * 传对象可细调扫描范围、候选选择器、危险词表与跳过规则。
   */
  derive?: boolean | DeriveOptions;
}

export function createPling(options?: PlingOptions): PlingElement;
export function createPling(registry: Registry | undefined, options?: PlingOptions): PlingElement;
export function createPling(
  first: Registry | PlingOptions | undefined,
  second: PlingOptions = {},
): PlingElement {
  const isRegistry = typeof (first as Registry | undefined)?.bind === "function";
  const options = isRegistry ? second : ((first as PlingOptions | undefined) ?? second);
  const sharedPage = options.shared;
  if (sharedPage && (options.registry || options.scopes)) {
    throw new Error("pling: 传入 shared 时不能再传 registry / scopes；它们由页面统一持有");
  }
  const baseRegistry = sharedPage?.registry ?? (isRegistry ? (first as Registry) : (options.registry ?? createRegistry()));
  const registry = createActionNamespace(baseRegistry, options.namespace);
  const ui = createUiController(options.ui);
  const config = resolveAgentConfig({ env: readViteEnv(), config: options.agent?.config });
  registry.setDefaultApproval(config.defaultApproval);
  const warn = options.onWarn ?? ((message: string) => console.warn(message));
  const task = createTaskController(warn);

  // 与 Vue 同一条可见性链路：区域进视口 → 活跃；元素进容器视口 → 进动作清单；
  // 被弹窗 / 遮罩盖住 → 不进清单并给出原因。观察器只负责「变了就广播」。
  const scopes = sharedPage?.scopes ?? createScopeController(options.scopes);
  const feedback = sharedPage?.feedback ?? createFeedbackCollector(registry);
  if (!sharedPage) feedback.start();
  const stopScopeSync = sharedPage ? null : scopes.onChange(() => registry.setAutoScopes(scopes.activeScopes()));
  const presence = createPresence(options.presence === false ? false : (options.presence ?? {}));
  const deriveOptions: DeriveOptions | null =
    options.derive === true ? {} : options.derive ? options.derive : null;
  const deriver: DeriveController | null = deriveOptions
    ? createDeriver(registry, scopes, { ...deriveOptions, onWarn: deriveOptions.onWarn ?? warn })
    : null;

  return {
    ui,
    registry,
    feedback,
    scopes,
    presence,
    derived: () => deriver,
    task,
    ask(prompt, askOptions) {
      return task.ask(prompt, askOptions);
    },
    inspectCoverage(root = globalThis.document?.body ?? null) {
      return inspectCoverage(root);
    },
    setActiveScopes(ids) {
      registry.setActiveScopes(ids);
    },
    destroy() {
      deriver?.stop();
      if (!sharedPage) feedback.stop();
      presence?.destroy();
      ui.destroy();
      stopScopeSync?.();
      if (!sharedPage) scopes.destroy();
    },
    warn,
    ...(options.agent ? { agent: options.agent } : {}),
    revealSensitive: options.revealSensitive !== false,
  };
}
