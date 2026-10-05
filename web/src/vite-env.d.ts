/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Gateway origin, e.g. `https://api.example.com`. Read at build time; never a secret. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
