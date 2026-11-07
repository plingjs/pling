import { createRegistry, type Registry } from "@plingjs/core";
import { createTaskCatalog, resolveAgentConfig } from "@plingjs/agent";
import { createUiController } from "@plingjs/ui";
import {
  createActionNamespace,
  createDeriver,
  createFeedbackCollector,
  createPresence,
  createScopeController,
  createTaskController,
  inspectCoverage,
  nearestScope,
  normalizeFeedbackValue,
  toFeedbackDeclaration,
  type DeriveController,
  markExplicit,
  unmarkExplicit,
} from "@plingjs/dom";
import { bindAction, bindToolWithMeta } from "./tool";
import { bindRecord } from "./record";
import { bindScope } from "./scope";
import { exposeState } from "./state";
import { readViteEnv } from "./env";
import { createDock } from "./dock";
import { createPageTracker, type PageOptions } from "./page";
import { createSurfaceGateway } from "./surface-gateway";
import type {
  TaskValue,
  VanillaDock,
  VanillaPling,
  VanillaPlingOptions,
} from "./types";

let autoId = 0;

function normalizeTask(value: TaskValue): { prompt: string; surface?: string; disabled: boolean } {
  if (typeof value === "string") return { prompt: value.trim(), disabled: false };
  const prompt = String(value?.prompt ?? "").trim();
  return {
    prompt,
    ...(value?.surface ? { surface: value.surface } : {}),
    disabled: value?.disabled === true,
  };
}

export function createPling(options: VanillaPlingOptions = {}): VanillaPling {
  const sharedPage = options.shared;
  if (sharedPage && (options.registry || options.scopes)) {
    throw new Error("pling: 传入 shared 时不能再传 registry / scopes；它们由页面统一持有");
  }
  const baseRegistry: Registry = sharedPage?.registry ?? options.registry ?? createRegistry();
  const registry = createActionNamespace(baseRegistry, options.namespace);
  const ui = createUiController(options.ui);
  const agentConfig = resolveAgentConfig({
    env: readViteEnv(),
    config: options.agent?.config,
  });
  registry.setDefaultApproval(options.defaultApproval ?? agentConfig.defaultApproval);
  const warn = options.onWarn ?? ((message: string) => console.warn(message));

  const scopes = sharedPage?.scopes ?? createScopeController(options.scopes);
  const stopScopeSync = sharedPage ? null : scopes.onChange(() => registry.setAutoScopes(scopes.activeScopes()));
  const presence = createPresence(options.presence === false ? false : (options.presence ?? {}));
  const feedback = sharedPage?.feedback ?? createFeedbackCollector(registry);
  const task = Object.assign(
    createTaskController(warn),
    createTaskCatalog({
      registry: baseRegistry,
      isScopeActive: (id) => registry.isScopeActive(id),
    }),
  );
  const pageOptions: PageOptions = options.page === false ? { enabled: false } : (options.page ?? {});
  const page = createPageTracker(registry, pageOptions, baseRegistry);

  const tracked = new Map<Element, { scope: string; untrack: () => void }>();
  const track = (element: Element, scope: string): (() => void) => {
    const current = tracked.get(element);
    if (current?.scope === scope) return () => {};
    current?.untrack();
    const untrack = scopes.track(element, scope);
    tracked.set(element, { scope, untrack });
    return () => {
      const entry = tracked.get(element);
      if (entry?.scope !== scope) return;
      entry.untrack();
      tracked.delete(element);
    };
  };

  const host = {
    ui,
    registry,
    scopes,
    task,
    presence,
    warn,
    track,
    ...(options.agent ? { agent: options.agent } : {}),
    revealSensitive: options.revealSensitive !== false,
  };

  const deriveOptions = options.derive === true ? {} : options.derive ? options.derive : null;
  const deriver: DeriveController | null = deriveOptions
    ? createDeriver(registry, scopes, { ...deriveOptions, onWarn: deriveOptions.onWarn ?? warn })
    : null;

  const cleanups = new Set<() => void>();
  const docks = new Set<VanillaDock>();
  const gateways = new Set<{ destroy(): void }>();
  const remember = (unbind: () => void): (() => void) => {
    let active = true;
    const wrapped = (): void => {
      if (!active) return;
      active = false;
      cleanups.delete(wrapped);
      unbind();
    };
    cleanups.add(wrapped);
    return wrapped;
  };

  /**
   * 原生页面没有框架的更新生命周期，同一元素常常会在列表重绘或状态变化后再次声明。
   * 和 Vue 指令的 `updated` 一样：先撤掉旧声明，再登记新的，不能让两份动作同时存在。
   */
  function declareElement<T extends Element>(
    registryMap: Map<T, () => void>,
    element: T,
    bind: () => () => void,
  ): () => void {
    registryMap.get(element)?.();
    const dispose = remember(bind());
    registryMap.set(element, dispose);
    return dispose;
  }

  function declareKeyed<T extends string>(
    registryMap: Map<T, () => void>,
    key: T,
    bind: () => () => void,
  ): () => void {
    registryMap.get(key)?.();
    const dispose = remember(bind());
    registryMap.set(key, dispose);
    return dispose;
  }

  const toolStates = new Map<Element, () => void>();
  const recordStates = new Map<Element, () => void>();
  const scopeStates = new Map<Element, () => void>();
  const stateStates = new Map<string, () => void>();
  const feedbackStates = new Map<Element, () => void>();
  const taskStates = new Map<Element, () => void>();
  const guideStates = new Map<Element, () => void>();
  const feedbackBaseIds = new WeakMap<Element, string>();

  let destroyed = false;
  if (!sharedPage) feedback.start();
  page.start(pageOptions.router);
  const diagnostics =
    options.diagnostics ??
    (readViteEnv().DEV === true && readViteEnv().MODE !== "test");
  if (diagnostics) {
    queueMicrotask(() => {
      if (destroyed) return;
      const root = globalThis.document?.body ?? null;
      const report = inspectCoverage(root);
      if (report.missing === 0) return;
      warn(
        `pling: interactive coverage ${report.coveragePercent ?? 0}% — ${report.missing}/${report.total} actionable controls are not declared, so the agent cannot see them. ` +
          "Declare controls that should be exposed with pling.tool(); leave the rest unchanged. " +
          "Call pling.inspectCoverage() to inspect the full list.",
      );
    });
  }

  return {
    ...host,
    feedback,
    page,
    task,
    ask(prompt, askOptions) {
      return task.ask(prompt, askOptions);
    },
    tool(element, toolOptions) {
      if (destroyed) throw new Error("pling 已 destroy，不能再声明动作");
      return declareElement(toolStates, element, () => {
        // 先让派生器把这个元素让出来，**再**登记显式动作：DOM 可能先于 createPling 存在，
        // 派生器可能已经绑过同名按钮；反过来做会撞上 DUPLICATE_ACTION_ID。
        if (deriver) {
          markExplicit(element, toolOptions.id ? [toolOptions.id] : []);
          deriver.sync();
        }
        let bound: ReturnType<typeof bindToolWithMeta>;
        try {
          bound = bindToolWithMeta(host, element, toolOptions);
        } catch (error) {
          if (deriver) {
            unmarkExplicit(element);
            deriver.sync();
          }
          throw error;
        }
        // 原生页面的 DOM 通常先于 createPling 存在：派生器可能已经先认出这个按钮。
        // 声明完成后重扫一次，让同一批里后声明的元素也按最新事实对齐。
        deriver?.sync();
        return () => {
          bound.unbind();
          deriver?.sync();
        };
      });
    },
    action(actionOptions) {
      if (destroyed) throw new Error("pling 已 destroy，不能再声明动作");
      return remember(bindAction(host, actionOptions));
    },
    record(element, value) {
      if (destroyed) throw new Error("pling 已 destroy，不能再声明记录");
      return declareElement(recordStates, element, () => {
        const unbind = bindRecord(host, element, value);
        // 行身份会改变派生 id（`remove@t1`），登记 / 注销后都要让派生器重新对齐。
        deriver?.sync();
        return () => {
          unbind();
          deriver?.sync();
        };
      });
    },
    scope(element, scopeOptions) {
      if (destroyed) throw new Error("pling 已 destroy，不能再声明区域");
      return declareElement(scopeStates, element, () => {
        const unbind = bindScope(host, element, scopeOptions);
        deriver?.sync();
        return () => {
          unbind();
          deriver?.sync();
        };
      });
    },
    state(key, source, stateOptions) {
      if (destroyed) throw new Error("pling 已 destroy，不能再暴露状态");
      return declareKeyed(stateStates, key, () => exposeState(registry, key, source, stateOptions));
    },
    declareFeedback(element, value) {
      if (destroyed) throw new Error("pling 已 destroy，不能再声明页面反馈");
      return declareElement(feedbackStates, element, () => {
        const { items, problem } = normalizeFeedbackValue(value);
        if (problem) warn(problem);
        if (items.length === 0) return () => {};
        const baseId = feedbackBaseIds.get(element) ?? `feedback_${++autoId}`;
        feedbackBaseIds.set(element, baseId);
        const unbinds = items.map((item, index) =>
          registry.declareFeedback(
            toFeedbackDeclaration(item, `${baseId}_${index}`, () => nearestScope(element)),
          ),
        );
        return () => {
          for (const unbind of unbinds) unbind();
        };
      });
    },
    declareTask(element, value) {
      if (destroyed) throw new Error("pling 已 destroy，不能再声明任务入口");
      return declareElement(taskStates, element, () => {
        const normalized = normalizeTask(value);
        if (!normalized.prompt) {
          warn("pling: declareTask() needs a non-empty prompt; this entrance will not send a task.");
          return () => {};
        }
        let disabled = normalized.disabled;
        const onClick = (): void => {
          if (disabled) return;
          void task
            .ask(normalized.prompt, {
              source: element,
              ...(normalized.surface ? { surface: normalized.surface } : {}),
            })
            .catch(() => {
              // The task controller reports missing surfaces through the same warning channel.
            });
        };
        element.addEventListener("click", onClick);
        markExplicit(element, []);
        return () => {
          element.removeEventListener("click", onClick);
          unmarkExplicit(element);
          disabled = true;
        };
      });
    },
    guideTarget(element, id) {
      if (destroyed) throw new Error("pling 已 destroy，不能再声明指引目标");
      return declareElement(guideStates, element, () => {
        const targetId = String(id ?? "").trim();
        if (!targetId) return () => {};
        const off = registry.declareGuideTarget(targetId, {
          presence: (state) => presence?.mark(element, state),
        });
        return off;
      });
    },
    setActiveScopes(ids) {
      registry.setActiveScopes(ids);
    },
    dock(dockOptions = {}) {
      if (destroyed) throw new Error("pling 已 destroy，不能再创建问答入口");
      const dock = createDock(host, dockOptions);
      docks.add(dock);
      return dock;
    },
    surfaceGateway(gatewayOptions) {
      if (destroyed) throw new Error("pling 已 destroy，不能再创建 Surface 网关");
      const gateway = createSurfaceGateway({ registry }, gatewayOptions);
      gateways.add(gateway);
      return gateway;
    },
    inspectCoverage(root) {
      return inspectCoverage(root ?? globalThis.document?.body ?? null);
    },
    derived: () => deriver,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const dock of [...docks]) dock.destroy();
      docks.clear();
      for (const gateway of [...gateways]) gateway.destroy();
      gateways.clear();
      for (const cleanup of [...cleanups].reverse()) cleanup();
      cleanups.clear();
      deriver?.stop();
      task.destroy();
      presence?.destroy();
      ui.destroy();
      page.stop();
      if (!sharedPage) feedback.stop();
      stopScopeSync?.();
      if (!sharedPage) scopes.destroy();
    },
  };
}
