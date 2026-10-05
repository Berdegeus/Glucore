import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { verifyInternalToken, type UserRoleName } from '@glucore/shared';

import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { bearerFor, buildGatewayApp } from '../helpers/gatewayApp';
import { TEST_INTERNAL_JWT_SECRET } from '../helpers/testEnv';

/**
 * ADM-01 / ADM-04 / ADM-05 / ADM-07: `/api/v1/admin/*` composes the two
 * services' internal admin routes behind an administrator-only gate.
 */

const ADMIN_ID = '5d000000-0000-4000-8000-0000000000aa';

const ACCOUNT_STATS = {
  accounts: {
    total: 12,
    byRole: [{ role: 'PATIENT', count: 10 }],
    byStatus: [{ status: 'ACTIVE', count: 12 }],
  },
  registrationsInPeriod: 4,
  registrationsByDay: [{ day: '2026-03-11', count: 4 }],
};

const PLATFORM_STATS = {
  activePatients: { last24h: 3, last7d: 6, registered: 10 },
  readingsByDay: [{ day: '2026-03-11', count: 900 }],
  grants: { active: 5, createdByWeek: [{ weekStart: '2026-03-09', count: 2 }] },
  alertsByType: [{ alertType: 'HYPO_RISK', count: 7 }],
};

const USERS_PAGE = {
  items: [
    {
      id: 'u-1',
      fullName: 'Ana',
      email: 'ana@example.com',
      role: 'PATIENT',
      status: 'ACTIVE',
      createdAt: '2026-03-11T00:00:00.000Z',
    },
  ],
  page: 2,
  limit: 25,
  total: 26,
};

type Leg = { status: number; body: unknown };

let authFake: FakeDownstream;
let glucoseFake: FakeDownstream;
let app: Express;
let authLeg: Leg;
let glucoseLeg: Leg;
let usersLeg: Leg;
/** Every query string a downstream received, by service. */
let queries: { auth: Record<string, unknown>[]; glucose: Record<string, unknown>[]; users: Record<string, unknown>[] };

beforeAll(async () => {
  authFake = await startFakeDownstream((fake) => {
    fake.get('/internal/admin/stats', (req, res) => {
      queries.auth.push(req.query);
      res.status(authLeg.status).json(authLeg.body);
    });
    fake.get('/internal/admin/users', (req, res) => {
      queries.users.push(req.query);
      res.status(usersLeg.status).json(usersLeg.body);
    });
  });
  glucoseFake = await startFakeDownstream((fake) => {
    fake.get('/internal/admin/stats', (req, res) => {
      queries.glucose.push(req.query);
      res.status(glucoseLeg.status).json(glucoseLeg.body);
    });
  });
  app = buildGatewayApp(authFake, glucoseFake);
});

beforeEach(() => {
  authLeg = { status: 200, body: ACCOUNT_STATS };
  glucoseLeg = { status: 200, body: PLATFORM_STATS };
  usersLeg = { status: 200, body: USERS_PAGE };
  queries = { auth: [], glucose: [], users: [] };
  authFake.requests.length = 0;
  glucoseFake.requests.length = 0;
});

afterAll(async () => {
  await authFake.close();
  await glucoseFake.close();
});

const asAdmin = bearerFor(ADMIN_ID, 'ADMINISTRATOR');
const overview = (query = '', authorization: string | null = asAdmin) => {
  const req = request(app).get(`/api/v1/admin/overview${query}`);
  return authorization ? req.set('Authorization', authorization) : req;
};
const users = (query = '', authorization: string | null = asAdmin) => {
  const req = request(app).get(`/api/v1/admin/users${query}`);
  return authorization ? req.set('Authorization', authorization) : req;
};
const downstreamCalls = () => authFake.requests.length + glucoseFake.requests.length;

describe('GET /api/v1/admin/overview', () => {
  it('answers the combined JSON of both services to an administrator', async () => {
    const res = await overview();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...ACCOUNT_STATS, ...PLATFORM_STATS });
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'accounts',
        'activePatients',
        'alertsByType',
        'grants',
        'readingsByDay',
        'registrationsByDay',
        'registrationsInPeriod',
      ].sort(),
    );
  });

  it('asks both services, each with the administrator identity of the caller', async () => {
    await overview();

    for (const fake of [authFake, glucoseFake]) {
      expect(fake.requests).toHaveLength(1);
      const token = fake.requests[0].headers['x-internal-token'] as string;
      expect(verifyInternalToken(token, TEST_INTERNAL_JWT_SECRET)).toMatchObject({
        sub: ADMIN_ID,
        role: 'ADMINISTRATOR',
      });
    }
  });

  it('defaults to 30 days', async () => {
    await overview();
    expect(queries.auth).toEqual([{ days: '30' }]);
    expect(queries.glucose).toEqual([{ days: '30' }]);
  });

  it.each([7, 30, 90])('passes days=%i to both services', async (days) => {
    const res = await overview(`?days=${days}`);

    expect(res.status).toBe(200);
    expect(queries.auth).toEqual([{ days: String(days) }]);
    expect(queries.glucose).toEqual([{ days: String(days) }]);
  });

  it.each(['14', '0', '91', 'abc', '7.5'])(
    'rejects days=%s with 400 INVALID_DASHBOARD_RANGE without calling a service',
    async (days) => {
      const res = await overview(`?days=${days}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'days must be one of 7, 30, 90', code: 'INVALID_DASHBOARD_RANGE' });
      expect(downstreamCalls()).toBe(0);
    },
  );

  it('does not pass on a field a service was not meant to expose', async () => {
    glucoseLeg.body = { ...PLATFORM_STATS, patientIds: ['p-1'], debug: true };
    authLeg.body = { ...ACCOUNT_STATS, adminEmails: ['x@example.com'] };

    const res = await overview();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...ACCOUNT_STATS, ...PLATFORM_STATS });
  });

  it.each([
    ['auth-service', () => (authLeg = { status: 503, body: { error: 'boom' } })],
    ['glucose-service', () => (glucoseLeg = { status: 503, body: { error: 'boom' } })],
  ])('answers 503 when %s fails, never a partial overview', async (_service, fail) => {
    fail();

    const res = await overview();

    expect(res.status).toBe(503);
    expect(res.body).not.toHaveProperty('accounts');
    expect(res.body).not.toHaveProperty('activePatients');
  });

  it('propagates a service answer that is not a 5xx with its status and code', async () => {
    glucoseLeg = { status: 400, body: { error: 'days must be one of 7, 30, 90', code: 'INVALID_DASHBOARD_RANGE' } };

    const res = await overview();

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_DASHBOARD_RANGE');
  });
});

describe('GET /api/v1/admin/users', () => {
  it("answers auth-service's page as it came", async () => {
    const res = await users('?page=2');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(USERS_PAGE);
    expect(glucoseFake.requests).toHaveLength(0);
  });

  it('asks auth-service with the administrator identity and the filters of the query', async () => {
    await users('?role=PATIENT&status=BLOCKED&q=50%25%20%C3%A7&page=2&limit=10&ignored=1');

    expect(queries.users).toEqual([{ role: 'PATIENT', status: 'BLOCKED', q: '50% ç', page: '2', limit: '10' }]);
    const token = authFake.requests[0].headers['x-internal-token'] as string;
    expect(verifyInternalToken(token, TEST_INTERNAL_JWT_SECRET)).toMatchObject({
      sub: ADMIN_ID,
      role: 'ADMINISTRATOR',
    });
  });

  it('hands a repeated parameter to auth-service as sent, so it can reject it', async () => {
    await users('?role=PATIENT&role=ADMINISTRATOR');
    expect(queries.users).toEqual([{ role: ['PATIENT', 'ADMINISTRATOR'] }]);
  });

  it('propagates the 400 of an invalid filter', async () => {
    usersLeg = { status: 400, body: { error: 'role must be one of ...', code: 'INVALID_FILTER' } };

    const res = await users('?role=ROOT');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILTER');
  });

  it('answers 503 when auth-service is down', async () => {
    usersLeg = { status: 503, body: { error: 'boom' } };
    expect((await users()).status).toBe(503);
  });
});

describe.each([
  ['/api/v1/admin/overview', overview],
  ['/api/v1/admin/users', users],
])('%s — access', (_path, call) => {
  it.each<UserRoleName>(['PATIENT', 'HEALTH_PROFESSIONAL'])(
    'answers 403 FORBIDDEN_ROLE to a %s token without calling a service',
    async (role) => {
      const res = await call('', bearerFor('someone', role));

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN_ROLE' });
      expect(downstreamCalls()).toBe(0);
    },
  );

  it('answers 401 without a token, and without calling a service', async () => {
    const res = await call('', null);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
    expect(downstreamCalls()).toBe(0);
  });

  it('answers 401 to a token that does not verify', async () => {
    expect((await call('', 'Bearer not-a-real-token')).status).toBe(401);
  });
});

describe('/api/v1/admin', () => {
  it('has no proxy: any other path under the prefix is not found', async () => {
    const res = await request(app).get('/api/v1/admin/accounts').set('Authorization', asAdmin);

    expect(res.status).toBe(404);
    expect(downstreamCalls()).toBe(0);
  });
});
