/**
 * @deprecated 遗留入口（001 时代）。新项目请直接用 `./directive` 的 `createPling` + `v-tool` / `v-scope`
 * / `useAgentState`。
 *
 * 现在它只是一层**兼容薄壳**：内部建立在主路径 `createPling()` 之上，provide 的也是同一个
 * `PLING_KEY`。001 那会儿这里自带一个 `Symbol("pling")`，和主路径是两个注入 key、
 * provide 的类型还不一样（Registry vs PlingElement），两套插件不能混用 —— 这个坑已经收敛掉了。
 *
 * `useAgentAction` 仍保留（001 起的旧用法），但新代码用 `v-tool`（元素级声明，业务代码几乎零改动）。
 */
import { onBeforeUnmount, onMounted, type App, type Ref } from "vue";
import { createRegistry, type ActionDescriptor, type Registry } from "@plingjs/core";
import { createPling, usePling } from "./directive";
import { isActionable, performPrimitive } from "./dom";
import { useAgentState as exposeAgentState } from "./state";

/** @deprecated 遗留入口：新项目用 `createPling()`（`./directive`）。 */
export interface PlingVue {
  registry: Registry;
  plugin: { install(app: App): void };
  /** @deprecated 已被 `v-tool` 取代，请改用指令声明。 */
  useAgentAction(elRef: Ref<Element | null>, descriptor: ActionDescriptor): void;
  /** @deprecated 已并入主路径：请直接用 `./state` 的 `useAgentState`。 */
  useAgentState(key: string, read: () => unknown, description?: string): void;
}

/** @deprecated 遗留入口，新项目请用 `createPling()`（`./directive`）。 */
export function createPlingVue(registry: Registry = createRegistry()): PlingVue {
  const pi = createPling(registry);

  function useAgentAction(elRef: Ref<Element | null>, descriptor: ActionDescriptor): void {
    const { registry: reg } = usePling();
    let unbind: (() => void) | null = null;

    onMounted(() => {
      unbind = reg.bind({
        descriptor,
        isAvailable: () => (elRef.value ? isActionable(elRef.value) : false),
        run: async (args) => {
          const el = elRef.value;
          if (!el) throw new Error(`元素已卸载: ${descriptor.id}`);
          performPrimitive(el, descriptor.primitive, args);
        },
      });
    });

    onBeforeUnmount(() => {
      unbind?.();
      unbind = null;
    });
  }

  function useAgentState(key: string, read: () => unknown, description?: string): void {
    exposeAgentState(key, read, description === undefined ? {} : { description });
  }

  return { registry: pi.registry, plugin: pi.plugin, useAgentAction, useAgentState };
}
