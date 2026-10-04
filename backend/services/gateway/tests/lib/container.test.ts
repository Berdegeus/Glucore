import { describe, expect, it } from 'vitest';
import { ConsulServiceRegistry, EnvServiceRegistry } from '@glucore/shared';

import { createContainer } from '../../src/container';
import type { Env } from '../../src/lib/env';

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    port: 3000,
    jwtSecret: 'a-secret',
    internalJwtSecret: 'an-internal-secret',
    corsOrigins: [],
    authServiceUrl: 'http://localhost:3002',
    glucoseServiceUrl: 'http://localhost:3001',
    serviceDiscovery: 'env',
    consulUrl: 'http://localhost:8500',
    ...overrides,
  };
}

describe('createContainer — registry selection (phase 5)', () => {
  it('wires EnvServiceRegistry by default', () => {
    const container = createContainer(baseEnv());
    expect(container.registry).toBeInstanceOf(EnvServiceRegistry);
  });

  it('wires ConsulServiceRegistry when SERVICE_DISCOVERY=consul', () => {
    const container = createContainer(baseEnv({ serviceDiscovery: 'consul' }));
    expect(container.registry).toBeInstanceOf(ConsulServiceRegistry);
  });

  it('always builds the rest of the graph regardless of discovery mode', () => {
    const container = createContainer(baseEnv({ serviceDiscovery: 'consul' }));
    expect(container.authClient).toBeDefined();
    expect(container.glucoseClient).toBeDefined();
    expect(container.registerSaga).toBeDefined();
    expect(container.authenticate).toBeTypeOf('function');
  });
});
