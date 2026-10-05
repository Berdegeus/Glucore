import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { bearerFor, buildGatewayApp } from '../helpers/gatewayApp';

/**
 * CON-04 / PRO-11: the `sharing` and `professional` prefixes are glucose-service's.
 * The gateway checks the token, rewrites the path and passes the caller's own
 * `Authorization` through; glucose still decides the role.
 */

let app: Express;
let authFake: FakeDownstream;
let glucoseFake: FakeDownstream;

beforeAll(async () => {
  authFake = await startFakeDownstream();
  glucoseFake = await startFakeDownstream();
  app = buildGatewayApp(authFake, glucoseFake);
});

beforeEach(() => {
  authFake.requests.length = 0;
  glucoseFake.requests.length = 0;
});

afterAll(async () => {
  await authFake.close();
  await glucoseFake.close();
});

describe.each(['sharing', 'professional'])('/api/v1/%s', (prefix) => {
  it('reaches glucose-service with the path rewritten and the caller\'s token', async () => {
    const authorization = bearerFor('user-1', 'HEALTH_PROFESSIONAL');

    const res = await request(app).get(`/api/v1/${prefix}/x`).set('Authorization', authorization);

    expect(res.status).toBe(200);
    expect(glucoseFake.requests).toHaveLength(1);
    expect(glucoseFake.requests[0]).toMatchObject({ method: 'GET', path: `/${prefix}/x` });
    expect(glucoseFake.requests[0].headers.authorization).toBe(authorization);
    expect(authFake.requests).toHaveLength(0);
  });

  it('forwards the body of a write', async () => {
    await request(app).post(`/api/v1/${prefix}/x`).set('Authorization', bearerFor('user-1')).send({ code: 'ABCD-EFGH' });

    expect(glucoseFake.requests.at(-1)).toMatchObject({ method: 'POST', path: `/${prefix}/x`, body: { code: 'ABCD-EFGH' } });
  });

  it('answers 401 at the gateway when there is no token, without calling glucose-service', async () => {
    const res = await request(app).get(`/api/v1/${prefix}/x`);

    expect(res.status).toBe(401);
    expect(glucoseFake.requests).toHaveLength(0);
  });
});
