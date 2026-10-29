/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_BASE_URL?: string;
  readonly VITE_AGENT_MODEL?: string;
  readonly VITE_DEMO_LOCALE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
