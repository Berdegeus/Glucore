import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { EnvServiceRegistry, verifyInternalToken } from '@glucore/shared';

import { AuthClient } from '../../src/clients/authClient';
import { UpstreamHttpError, UpstreamUnavailableError } from '../../src/clients/errors';
import { GlucoseClient } from '../../src/clients/glucoseClient';
import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { TEST_INTERNAL_JWT_SECRET } from '../helpers/testEnv';

/**
 * ADM-01 / ADM-04: the three admin calls, each on the identity of the admin who
 * asked, with the query handed on untouched for the services to validate.
 */

const ADMIN_ID = '7c6f3a0e-1111-4222-8333-444455556666';

let authFake: FakeDownstream;
let glucoseFake: FakeDownstream;
let auth: AuthClient;
let glucose: GlucoseClient;
const queries: Record<string, unknown>[] = [];

const STATS = { registrationsInPeriod: 3 };
const PAGE = { items: [], page: 1, limit: 25, total: 0 };

beforeAll(async () => {
  authFake = await startFakeDownstream((app) => {
    app.get('/internal/admin/stats', (req, res) => {
      queries.push(req.query);
      if (req.query.days === '14') {
        res.status(400).json({ error: 'days must be one of 7, 30, 90', code: 'INVALID_DASHBOARD_RANGE' });
        return;
      }
      res.json(STATS);
    });
    app.get('/internal/admin/users', (req, res) => {
      queries.push(req.query);
      res.json(PAGE);
    });
  });
  glucoseFake = await startFakeDownstream((app) => {
    app.get('/internal/admin/stats', (req, res) => {
      queries.push(req.query);
      res.json({ activePatients: { last24h: 1, last7d: 2, registered: 3 } });
    });
  });
  const registry = new EnvServiceRegistry({ auth: authFake.url, glucose: glucoseFake.url });
  auth = new AuthClient(registry, TEST_INTERNAL_JWT_SECRET);
  glucose = new GlucoseClient(registry, TEST_INTERNAL_JWT_SECRET);
});

beforeEach(() => {
  queries.length = 0;
  authFake.requests.length = 0;
  glucoseFake.requests.length = 0;
});

afterAll(async () => {
  await authFake.close();
  await glucoseFake.close();
});

const identityOf = (fake: FakeDownstream) =>
  verifyInternalToken(fake.requests[0].headers['x-internal-token'] as string, TEST_INTERNAL_JWT_SECRET);

describe('AuthClient.adminStats', () => {
  it('calls /internal/admin/stats with the days and returns the body', async () => {
    expect(await auth.adminStats(ADMIN_ID, 90)).toEqual(STATS);

    expect(authFake.requests).toHaveLength(1);
    expect(authFake.requests[0]).toMatchObject({ method: 'GET', path: '/internal/admin/stats' });
    expect(queries).toEqual([{ days: '90' }]);
  });

  it('signs the token as the asking admin, with the ADMINISTRATOR role', async () => {
    await auth.adminStats(ADMIN_ID, 30);
    expect(identityOf(authFake)).toMatchObject({ sub: ADMIN_ID, role: 'ADMINISTRATOR' });
  });

  it('propagates the upstream status and code', async () => {
    const error = await auth.adminStats(ADMIN_ID, 14).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamHttpError);
    expect(error).toMatchObject({ status: 400, code: 'INVALID_DASHBOARD_RANGE' });
  });
});

describe('AuthClient.adminUsers', () => {
  it('forwards every filter and page parameter', async () => {
    expect(
      await auth.adminUsers(ADMIN_ID, { role: 'PATIENT', status: 'BLOCKED', q: 'ana', page: '2', limit: '50' }),
    ).toEqual(PAGE);

    expect(authFake.requests[0]).toMatchObject({ method: 'GET', path: '/internal/admin/users' });
    expect(queries).toEqual([{ role: 'PATIENT', status: 'BLOCKED', q: 'ana', page: '2', limit: '50' }]);
  });

  it('percent-encodes the search text and leaves absent parameters out', async () => {
    await auth.adminUsers(ADMIN_ID, { q: '50% & ç', role: undefined });
    expect(queries).toEqual([{ q: '50% & ç' }]);
  });

  it('calls the route bare when there is no query', async () => {
    await auth.adminUsers(ADMIN_ID);
    expect(queries).toEqual([{}]);
  });

  it('signs the token as the asking admin, with the ADMINISTRATOR role', async () => {
    await auth.adminUsers(ADMIN_ID, { page: '1' });
    expect(identityOf(authFake)).toMatchObject({ sub: ADMIN_ID, role: 'ADMINISTRATOR' });
  });
});

describe('GlucoseClient.adminStats', () => {
  it('calls /internal/admin/stats with the days and returns the body', async () => {
    expect(await glucose.adminStats(ADMIN_ID, 7)).toEqual({
      activePatients: { last24h: 1, last7d: 2, registered: 3 },
    });

    expect(glucoseFake.requests[0]).toMatchObject({ method: 'GET', path: '/internal/admin/stats' });
    expect(queries).toEqual([{ days: '7' }]);
  });

  it('signs the token as the asking admin, with the ADMINISTRATOR role', async () => {
    await glucose.adminStats(ADMIN_ID, 30);
    expect(identityOf(glucoseFake)).toMatchObject({ sub: ADMIN_ID, role: 'ADMINISTRATOR' });
  });

  it('reports an unreachable service as UpstreamUnavailableError', async () => {
    const down = new GlucoseClient(new EnvServiceRegistry({ auth: 'http://127.0.0.1:1', glucose: 'http://127.0.0.1:1' }), TEST_INTERNAL_JWT_SECRET);
    await expect(down.adminStats(ADMIN_ID, 30)).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });
});
