/**
 * Environment access for the gateway.
 *
 * Mirrors the other two services' `lib/env.ts` deliberately, including the
 * rule that matters most: this module throws instead of calling
 * `process.exit`, so a misconfigured server fails as a normal test failure
 * rather than tearing down the worker silently. `index.ts` turns the throw
 * back into a non-zero exit.
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
  port: number;
  jwtSecret: string;
  internalJwtSecret: string;
  corsOrigins: string[];
  authServiceUrl: string;
  glucoseServiceUrl: string;
  /** "consul" resolves auth/glucose via Consul; anything else uses the fixed URLs above. */
  serviceDiscovery: string;
  consulUrl: string;
}

const JWT_SECRET_HINT =
  'Set it in services/gateway/.env (e.g. JWT_SECRET=$(openssl rand -hex 32)) before starting the server. ' +
  'It must be the same secret auth-service signs with.';

const INTERNAL_JWT_SECRET_HINT =
  'Set it in services/gateway/.env (e.g. INTERNAL_JWT_SECRET=$(openssl rand -hex 32)) before starting the ' +
  'server. It must be distinct from JWT_SECRET and shared with auth-service and glucose-service.';

function readPort(): number {
  const raw = process.env.PORT?.trim();
  const port = raw ? Number(raw) : 3000;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new MissingEnvError('PORT', `Expected a TCP port, got "${process.env.PORT}".`);
  }
  return port;
}

/**
 * Restricts CORS to the origins listed in CORS_ORIGIN (comma-separated). When
 * unset, stays permissive for local development — but in production that
 * fallback means every origin is allowed with nothing in the log pointing at
 * why, so it becomes a hard failure there instead.
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

function readServiceUrl(name: string, defaultUrl: string): string {
  const raw = process.env[name]?.trim();
  const url = raw && raw.length > 0 ? raw : defaultUrl;
  // Trailing slash would double up when a route prefix is appended.
  return url.replace(/\/+$/, '');
}

/**
 * Reads and validates the environment. Call it from the bootstrap, not at
 * import time, so importing a module never has a side effect on process
 * lifetime.
 */
export function loadEnv(): Env {
  return {
    port: readPort(),
    jwtSecret: required('JWT_SECRET', JWT_SECRET_HINT),
    internalJwtSecret: required('INTERNAL_JWT_SECRET', INTERNAL_JWT_SECRET_HINT),
    corsOrigins: readCorsOrigins(),
    authServiceUrl: readServiceUrl('AUTH_SERVICE_URL', 'http://localhost:3002'),
    glucoseServiceUrl: readServiceUrl('GLUCOSE_SERVICE_URL', 'http://localhost:3001'),
    serviceDiscovery: process.env.SERVICE_DISCOVERY?.trim() || 'env',
    consulUrl: readServiceUrl('CONSUL_HTTP_ADDR', 'http://localhost:8500'),
  };
}

/** Resolved on first use, same reasoning as the other services' getters. */
export function getJwtSecret(): string {
  return required('JWT_SECRET', JWT_SECRET_HINT);
}

export function getInternalJwtSecret(): string {
  return required('INTERNAL_JWT_SECRET', INTERNAL_JWT_SECRET_HINT);
}
