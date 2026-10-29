import { getCurrentInstance } from "vue";
import type { Vue2Pling } from "./pling";

let current: Vue2Pling | null = null;

export function rememberPling(instance: Vue2Pling): void {
  current = instance;
}

export function usePling(): Vue2Pling {
  const vm = getCurrentInstance() as { proxy?: { $pling?: unknown } } | null;
  const provided = vm?.proxy?.$pling;
  if (provided && typeof provided === "object") return provided as Vue2Pling;
  if (current) return current;
  throw new Error(
    "pling: 找不到当前实例。先调用 createPling()，再用 Vue.use(pling.plugin) 安装；组件外调用时请保留 createPling() 的返回值。",
  );
}
