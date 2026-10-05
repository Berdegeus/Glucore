import type { Express } from 'express';

import { EnvServiceRegistry, signAccessToken, type UserRoleName } from '@glucore/shared';

import { buildApp } from '../../src/app';
import { AuthClient } from '../../src/clients/authClient';
import { GlucoseClient } from '../../src/clients/glucoseClient';
import { createAuthenticate } from '../../src/middleware/authenticate';
import { RegisterSaga } from '../../src/modules/register/register.saga';
import { RegisterProfessionalSaga } from '../../src/modules/registerProfessional/registerProfessional.saga';
import type { FakeDownstream } from './fakeDownstream';
import { TEST_INTERNAL_JWT_SECRET, TEST_JWT_SECRET } from './testEnv';

/**
 * The gateway wired to two fake services, the same way production wires it to
 * the real ones. A fresh app means a fresh rate-limit window.
 */
export function buildGatewayApp(authFake: FakeDownstream, glucoseFake: FakeDownstream): Express {
  const registry = new EnvServiceRegistry({ auth: authFake.url, glucose: glucoseFake.url });
  const authClient = new AuthClient(registry, TEST_INTERNAL_JWT_SECRET);
  const glucoseClient = new GlucoseClient(registry, TEST_INTERNAL_JWT_SECRET);
  return buildApp({
    container: {
      authenticate: createAuthenticate(() => TEST_JWT_SECRET),
      registry,
      authClient,
      glucoseClient,
      registerSaga: new RegisterSaga(authClient, glucoseClient),
      registerProfessionalSaga: new RegisterProfessionalSaga(authClient, glucoseClient),
    },
  });
}

/** An `Authorization` header value for an end user of the given role. */
export const bearerFor = (userId: string, role: UserRoleName = 'PATIENT'): string =>
  `Bearer ${signAccessToken({ sub: userId, role }, TEST_JWT_SECRET)}`;
