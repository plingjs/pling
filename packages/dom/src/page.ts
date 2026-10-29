import { createRegistry, type Registry } from "@plingjs/core";
import { createFeedbackCollector, type FeedbackCollector } from "./feedback";
import {
  createScopeController,
  type ScopeController,
  type ScopeControllerOptions,
} from "./scope";

export interface PlingPageOptions {
  /** 页面级注册表；一般不用传，默认新建一个。 */
  registry?: Registry;
  /** 共享的可见性 / 区域控制器注入点（测试与特殊渲染环境用）。 */
  scopes?: ScopeControllerOptions;
}

/**
 * 一个页面共享的 Pling 运行时。
 *
 * 混合 Vue / React / 原生 JS 时，三个适配器必须看到**同一个**注册表与同一套区域 /
 * 可见性判定；否则一个入口只能操作自己那一块，模型的世界会被拆成三份。
 * 各适配器仍只负责自己的声明、派生与生命周期。
 */
export interface PlingPage {
  readonly registry: Registry;
  readonly scopes: ScopeController;
  /** 页面级 ARIA 反馈收集器：一个页面只观察一次，所有适配器共享结果。 */
  readonly feedback: FeedbackCollector;
  /** 停掉页面级观察器；各适配器应先销毁自己的声明。 */
  destroy(): void;
}

/** 建一个可被多个适配器共享的页面运行时。 */
export function createPlingPage(options: PlingPageOptions = {}): PlingPage {
  const registry = options.registry ?? createRegistry();
  const scopes = createScopeController(options.scopes);
  const feedback = createFeedbackCollector(registry);
  feedback.start();
  const stop = scopes.onChange(() => registry.setAutoScopes(scopes.activeScopes()));
  let destroyed = false;

  return {
    registry,
    scopes,
    feedback,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      feedback.stop();
      registry.setAutoScopes([]);
      scopes.destroy();
    },
  };
}
