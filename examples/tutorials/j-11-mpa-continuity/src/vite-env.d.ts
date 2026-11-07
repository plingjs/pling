/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_LOCALE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
