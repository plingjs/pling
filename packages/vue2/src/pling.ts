import { createPling as createVanillaPling, type VanillaPling, type VanillaPlingOptions } from "@plingjs/vanilla";
import type { VueConstructor } from "vue";
import { rememberPling } from "./context";
import { createDirectives } from "./directives";

export interface Vue2PlingOptions extends VanillaPlingOptions {}

export interface Vue2Pling extends VanillaPling {
  plugin: {
    install(Vue: VueConstructor): void;
  };
}

/**
 * Create a Vue 2.7 adapter instance.
 *
 * The object keeps the same execution surface as the Vue 3 and React adapters;
 * only installation and element declaration differ. The assistant entry is the
 * shared DOM dock (`pling.dock()`), so there is no second chat implementation.
 */
export function createPling(options: Vue2PlingOptions = {}): Vue2Pling {
  let installed = false;
  const base = createVanillaPling(options);
  const instance = Object.assign(base, {
    plugin: {
      install(Vue: VueConstructor): void {
        if (installed) return;
        installed = true;
        rememberPling(instance);
        (Vue.prototype as unknown as { $pling: Vue2Pling }).$pling = instance;
        const directives = createDirectives(instance);
        Vue.directive("tool", directives.tool);
        Vue.directive("scope", directives.scope);
        Vue.directive("record", directives.record);
      },
    },
  }) as Vue2Pling;
  return instance;
}
