import { EnvServiceRegistry, type ServiceRegistry } from '@glucore/shared';
import type { RequestHandler } from 'express';

import { AuthClient } from './clients/authClient';
import { GlucoseClient } from './clients/glucoseClient';
import { createAuthenticate } from './middleware/authenticate';
import { RegisterSaga } from './modules/register/register.saga';
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
  authClient: AuthClient;
  glucoseClient: GlucoseClient;
  registerSaga: RegisterSaga;
}

export function createContainer(env: Env = loadEnv()): Container {
  const registry = new EnvServiceRegistry({
    auth: env.authServiceUrl,
    glucose: env.glucoseServiceUrl,
  });

  const authClient = new AuthClient(registry, env.internalJwtSecret);
  const glucoseClient = new GlucoseClient(registry, env.internalJwtSecret);

  return {
    authenticate: createAuthenticate(() => env.jwtSecret),
    registry,
    authClient,
    glucoseClient,
    registerSaga: new RegisterSaga(authClient, glucoseClient),
  };
}
