export interface AppEnv {
  apiUrl: string;
}

/** The gateway listens on :3000 in local development. */
const DEFAULT_API_URL = 'http://localhost:3000';

/** Reads the build-time configuration. Only public values live here (DEP-04). */
export function readEnv(): AppEnv {
  return { apiUrl: import.meta.env.VITE_API_URL ?? DEFAULT_API_URL };
}
