/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_BASE_URL?: string;
  readonly VITE_AGENT_MODEL?: string;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
