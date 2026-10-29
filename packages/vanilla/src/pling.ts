import { createRegistry, type Registry } from "@plingjs/core";
import { resolveAgentConfig } from "@plingjs/agent";
import { createUiController } from "@plingjs/ui";
import {
  createActionNamespace,
  createDeriver,
  createPresence,
  createScopeController,
  type DeriveController,
  markExplicit,
  unmarkExplicit,
} from "@plingjs/dom";
import { bindAction, bindTool } from "./tool";
import { bindRecord } from "./record";
import { bindScope } from "./scope";
import { exposeState } from "./state";
import { readViteEnv } from "./env";
import { createDock } from "./dock";
import type { VanillaDock, VanillaPling, VanillaPlingOptions } from "./types";

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

  let destroyed = false;
  return {
    ...host,
    tool(element, toolOptions) {
      if (destroyed) throw new Error("pling 已 destroy，不能再声明动作");
      // 先让派生器把这个元素让出来，**再**登记显式动作：DOM 可能先于 createPling 存在，
      // 派生器可能已经绑过同名按钮；反过来做会撞上 DUPLICATE_ACTION_ID。
      if (deriver) {
        markExplicit(element, toolOptions.id ? [toolOptions.id] : []);
        deriver.sync();
      }
      let unbind: () => void;
      try {
        unbind = bindTool(host, element, toolOptions);
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
      return remember(() => {
        unbind();
        deriver?.sync();
      });
    },
    action(actionOptions) {
      if (destroyed) throw new Error("pling 已 destroy，不能再声明动作");
      return remember(bindAction(host, actionOptions));
    },
    record(element, value) {
      if (destroyed) throw new Error("pling 已 destroy，不能再声明记录");
      const unbind = bindRecord(host, element, value);
      // 行身份会改变派生 id（`remove@t1`），登记 / 注销后都要让派生器重新对齐。
      deriver?.sync();
      return remember(() => {
        unbind();
        deriver?.sync();
      });
    },
    scope(element, scopeOptions) {
      if (destroyed) throw new Error("pling 已 destroy，不能再声明区域");
      const unbind = bindScope(host, element, scopeOptions);
      deriver?.sync();
      return remember(() => {
        unbind();
        deriver?.sync();
      });
    },
    state(key, source, stateOptions) {
      if (destroyed) throw new Error("pling 已 destroy，不能再暴露状态");
      return remember(exposeState(registry, key, source, stateOptions));
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
    derived: () => deriver,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const dock of [...docks]) dock.destroy();
      docks.clear();
      for (const cleanup of [...cleanups].reverse()) cleanup();
      cleanups.clear();
      deriver?.stop();
      presence?.destroy();
      ui.destroy();
      stopScopeSync?.();
      if (!sharedPage) scopes.destroy();
    },
  };
}
