/**
 * Environment access for auth-service.
 *
 * Mirrors glucose-service's `lib/env.ts` deliberately, including the rule that
 * matters most: this module throws instead of calling `process.exit`. A
 * `process.exit` reachable from any module that transitively imports this one
 * tears down a test worker with no reported failure and no output; a thrown
 * error surfaces as a normal failure naming its cause. `index.ts` is what turns
 * the throw back into a non-zero exit, so a misconfigured server still refuses
 * to start.
 */

export class MissingEnvError extends Error {
  readonly status = 500;
  readonly code = 'MISSING_ENV';

  constructor(name: string, hint: string) {
    super(`${name} is not set. ${hint}`);
    this.name = 'MissingEnvError';
  }
}

const JWT_SECRET_HINT =
  'Set it in services/auth-service/.env (e.g. JWT_SECRET=$(openssl rand -hex 32)) before starting the server. ' +
  'It must be the same secret glucose-service verifies with, or every token this service mints is rejected there.';

function required(name: string, hint: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new MissingEnvError(name, hint);
  }
  return value;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface Env {
  jwtSecret: string;
  port: number;
  corsOrigins: string[];
  bcryptRounds: number;
  /** Null means "no SMTP configured": the console mailer is used instead. */
  smtp: SmtpConfig | null;
}

/** bcrypt's own recommendation, and what production has always used. */
const DEFAULT_BCRYPT_ROUNDS = 12;

function readPort(): number {
  // `??` alone is not enough: an exported-but-empty PORT= is a string, not
  // undefined, so it would slip past and parse as 0.
  const raw = process.env.PORT?.trim();
  const port = raw ? Number(raw) : 3002;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new MissingEnvError('PORT', `Expected a TCP port, got "${process.env.PORT}".`);
  }
  return port;
}

function readBcryptRounds(): number {
  const raw = process.env.BCRYPT_ROUNDS?.trim();
  if (!raw) return DEFAULT_BCRYPT_ROUNDS;
  const rounds = Number(raw);
  // The floor is bcrypt's own minimum. The ceiling is a safety rail: a stray
  // extra digit would not misconfigure the server, it would hang it for hours
  // on the first password.
  if (!Number.isInteger(rounds) || rounds < 4 || rounds > 15) {
    throw new MissingEnvError(
      'BCRYPT_ROUNDS',
      `Expected an integer between 4 and 15, got "${process.env.BCRYPT_ROUNDS}".`,
    );
  }
  return rounds;
}

/**
 * Restricts CORS to the origins listed in CORS_ORIGIN (comma-separated). When
 * unset, stays permissive for local development — but in production that
 * permissive fallback means every origin is allowed with nothing in the log
 * pointing at why, so it becomes a hard failure there instead.
 */
function readCorsOrigins(): string[] {
  const corsOrigins =
    process.env.CORS_ORIGIN?.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0) ?? [];

  if (process.env.NODE_ENV === 'production' && corsOrigins.length === 0) {
    throw new MissingEnvError(
      'CORS_ORIGIN',
      'Set a comma-separated list of allowed origins before starting the server in ' +
        'production. An empty CORS_ORIGIN in production means every origin is allowed, silently.',
    );
  }

  return corsOrigins;
}

/**
 * SMTP is all-or-nothing on purpose. A half-filled configuration — a host with
 * no credentials — used to fail at send time and get swallowed by the caller's
 * catch, which then logged the reset token as if nothing were wrong. Treating
 * it as unconfigured here makes that state visible at boot instead.
 */
function readSmtp(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT?.trim() || '587');
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new MissingEnvError('SMTP_PORT', `Expected a TCP port, got "${process.env.SMTP_PORT}".`);
  }
  return { host, port, user, pass };
}

/**
 * Reads and validates the environment. Call it from the bootstrap, not at import
 * time, so importing a module never has a side effect on process lifetime.
 */
export function loadEnv(): Env {
  return {
    jwtSecret: required('JWT_SECRET', JWT_SECRET_HINT),
    port: readPort(),
    corsOrigins: readCorsOrigins(),
    bcryptRounds: readBcryptRounds(),
    smtp: readSmtp(),
  };
}

/**
 * The signing secret, resolved on first use rather than at import, so that
 * importing a module cannot fail merely because the environment was arranged
 * afterwards.
 */
export function getJwtSecret(): string {
  return required('JWT_SECRET', JWT_SECRET_HINT);
}
