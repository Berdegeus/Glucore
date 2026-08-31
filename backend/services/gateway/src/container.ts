import { EnvServiceRegistry, type ServiceRegistry } from '@glucore/shared';
import type { RequestHandler } from 'express';

import { createAuthenticate } from './middleware/authenticate';
import { loadEnv, type Env } from './lib/env';

/**
 * Composition root: the one place that knows which implementation satisfies
 * which interface. `registry` is an `EnvServiceRegistry` today and a
 * Consul-backed one from phase 5 on — nothing above this boundary changes
 * when that lands.
 */
export interface Container {
  authenticate: RequestHandler;
  registry: ServiceRegistry;
}

export function createContainer(env: Env = loadEnv()): Container {
  const registry = new EnvServiceRegistry({
    auth: env.authServiceUrl,
    glucose: env.glucoseServiceUrl,
  });

  return {
    authenticate: createAuthenticate(() => env.jwtSecret),
    registry,
  };
}
