/**
 * Environment access for the backend.
 *
 * This module throws on a missing JWT_SECRET instead of calling `process.exit`.
 * The distinction matters outside production: `process.exit` is reachable from
 * any module that transitively imports this one, so under a test runner it tears
 * the whole worker down with no reported failure and no output. A thrown error
 * surfaces as a normal failure with a stack that names the cause.
 *
 * The process bootstrap in `index.ts` is what turns that throw back into a
 * non-zero exit, so a misconfigured server still refuses to start.
 */

export class MissingEnvError extends Error {
  readonly status = 500;
  readonly code = 'MISSING_ENV';

  constructor(name: string, hint: string) {
    super(`${name} is not set. ${hint}`);
    this.name = 'MissingEnvError';
  }
}

function required(name: string, hint: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new MissingEnvError(name, hint);
  }
  return value;
}

export interface Env {
  jwtSecret: string;
  port: number;
  corsOrigins: string[];
}

/**
 * Reads and validates the environment. Call it from the bootstrap, not at import
 * time, so importing a module never has a side effect on process lifetime.
 */
export function loadEnv(): Env {
  // `??` alone is not enough: an exported-but-empty PORT= is a string, not
  // undefined, so it would slip past and parse as 0.
  const rawPort = process.env.PORT?.trim();
  const port = rawPort ? Number(rawPort) : 3001;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new MissingEnvError('PORT', `Expected a TCP port, got "${process.env.PORT}".`);
  }

  // Restrict CORS to the origins listed in CORS_ORIGIN (comma-separated).
  // When unset, stay permissive for local development.
  const corsOrigins =
    process.env.CORS_ORIGIN?.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0) ?? [];

  // The permissive fallback above is fine on a laptop, but silent in
  // production it means every origin is allowed with nothing in the log
  // pointing at why.
  if (process.env.NODE_ENV === 'production' && corsOrigins.length === 0) {
    throw new MissingEnvError(
      'CORS_ORIGIN',
      'Set a comma-separated list of allowed origins before starting the server in ' +
        'production. An empty CORS_ORIGIN in production means every origin is allowed, silently.',
    );
  }

  return {
    jwtSecret: required(
      'JWT_SECRET',
      'Set it in backend/.env (e.g. JWT_SECRET=$(openssl rand -hex 32)) before starting the server.',
    ),
    port,
    corsOrigins,
  };
}

/**
 * The signing secret, resolved on first use rather than at import.
 *
 * Kept as a function so that importing `routes/auth` or `middleware/auth` — as
 * every test that touches them does — cannot fail merely because the module
 * graph was loaded before the environment was arranged.
 */
export function getJwtSecret(): string {
  return required(
    'JWT_SECRET',
    'Set it in backend/.env (e.g. JWT_SECRET=$(openssl rand -hex 32)) before starting the server.',
  );
}

/**
 * Signs/verifies the internal token the gateway sends on every proxied
 * request. Same resolve-on-first-use reasoning as `getJwtSecret`, and
 * distinct from it so a leaked user token can never be replayed as internal.
 */
export function getInternalJwtSecret(): string {
  return required(
    'INTERNAL_JWT_SECRET',
    'Set it in backend/.env (e.g. INTERNAL_JWT_SECRET=$(openssl rand -hex 32)) before starting the server. ' +
      'It must be shared with the gateway and auth-service, which are the only things that mint or verify it.',
  );
}
