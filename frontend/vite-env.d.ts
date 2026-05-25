/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API URL — leave empty in dev (uses proxy), set in production */
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
