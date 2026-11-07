/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_BASE_URL?: string;
  readonly VITE_AGENT_MODEL?: string;
  readonly VITE_AGENT_MIN_ACTION_INTERVAL_MS?: string;
  readonly VITE_SURFACE_GATEWAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
