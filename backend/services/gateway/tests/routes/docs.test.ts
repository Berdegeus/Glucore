import request from 'supertest';
import { describe, expect, it } from 'vitest';
import yaml from 'yaml';

import { EnvServiceRegistry } from '@glucore/shared';

import { buildApp } from '../../src/app';
import { AuthClient } from '../../src/clients/authClient';
import { GlucoseClient } from '../../src/clients/glucoseClient';
import { createAuthenticate } from '../../src/middleware/authenticate';
import { RegisterSaga } from '../../src/modules/register/register.saga';
import { TEST_INTERNAL_JWT_SECRET, TEST_JWT_SECRET } from '../helpers/testEnv';

const registry = new EnvServiceRegistry({ auth: 'http://127.0.0.1:1', glucose: 'http://127.0.0.1:1' });
const authClient = new AuthClient(registry, TEST_INTERNAL_JWT_SECRET);
const glucoseClient = new GlucoseClient(registry, TEST_INTERNAL_JWT_SECRET);
const app = buildApp({
  container: {
    authenticate: createAuthenticate(() => TEST_JWT_SECRET),
    registry,
    authClient,
    glucoseClient,
    registerSaga: new RegisterSaga(authClient, glucoseClient),
  },
});

describe('API docs', () => {
  it('serves Swagger UI without a token', async () => {
    const res = await request(app).get('/api/v1/docs/');
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toContain('SwaggerUIBundle');
  });

  it('serves a valid OpenAPI document that covers the gateway routes', async () => {
    const res = await request(app).get('/api/v1/docs/openapi.yaml');
    expect(res.status).toBe(200);

    const spec = yaml.parse(res.text);
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        '/auth/register',
        '/auth/login',
        '/me',
        '/account',
        '/readings',
        '/carbs/item/{id}',
        '/insulin/item',
        '/alerts',
        '/settings/alerts',
        '/dashboard/summary',
      ]),
    );
  });
});
