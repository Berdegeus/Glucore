import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { bearerFor, buildGatewayApp } from '../helpers/gatewayApp';

/**
 * CON-08: the patient's list of links, composed from glucose-service (the
 * grants) and auth-service (the professionals' names). The names leg degrades;
 * the grants leg does not.
 */

const PRO_A = '00000000-0000-4000-8000-00000000000a';
const PRO_B = '00000000-0000-4000-8000-00000000000b';
const GONE = '00000000-0000-4000-8000-00000000000c';

const GRANTS = [
  { id: 'g-1', professionalId: PRO_A, specialty: 'Endocrinologia', grantedAt: '2026-10-01T10:00:00.000Z' },
  { id: 'g-2', professionalId: PRO_B, specialty: 'Nutrição', grantedAt: '2026-10-02T10:00:00.000Z' },
];

let app: Express;
let authFake: FakeDownstream;
let glucoseFake: FakeDownstream;
let grants: typeof GRANTS;
let glucoseAnswer: { status: number; body: unknown } | null;
let lookupFails: boolean;

const patientBearer = bearerFor('patient-1');
const getGrants = () => request(app).get('/api/v1/sharing/grants').set('Authorization', patientBearer);
const lookupCalls = () => authFake.requests.filter((r) => r.path === '/internal/accounts/lookup');

beforeAll(async () => {
  authFake = await startFakeDownstream((fakeApp) => {
    fakeApp.post('/internal/accounts/lookup', (req, res) => {
      if (lookupFails) {
        res.status(503).json({ error: 'boom' });
        return;
      }
      const names: Record<string, string> = { [PRO_A]: 'Dra. Ana Souza', [PRO_B]: 'Dr. Bruno Lima' };
      const ids = req.body.ids as string[];
      res.json(ids.filter((id) => names[id]).map((id) => ({ id, fullName: names[id] })));
    });
  });
  glucoseFake = await startFakeDownstream((fakeApp) => {
    fakeApp.get('/sharing/grants', (_req, res) => {
      if (glucoseAnswer) {
        res.status(glucoseAnswer.status).json(glucoseAnswer.body);
        return;
      }
      res.json({ grants });
    });
  });
  app = buildGatewayApp(authFake, glucoseFake);
});

beforeEach(() => {
  authFake.requests.length = 0;
  glucoseFake.requests.length = 0;
  grants = GRANTS;
  glucoseAnswer = null;
  lookupFails = false;
});

afterAll(async () => {
  await authFake.close();
  await glucoseFake.close();
});

describe('GET /api/v1/sharing/grants', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/v1/sharing/grants');

    expect(res.status).toBe(401);
    expect(glucoseFake.requests).toHaveLength(0);
  });

  it('returns each grant with the professional name and specialty, and no professional id', async () => {
    const res = await getGrants();

    expect(res.status).toBe(200);
    expect(res.headers['x-degraded']).toBeUndefined();
    expect(res.body).toEqual({
      grants: [
        {
          id: 'g-1',
          professional: { fullName: 'Dra. Ana Souza', specialty: 'Endocrinologia' },
          grantedAt: '2026-10-01T10:00:00.000Z',
        },
        {
          id: 'g-2',
          professional: { fullName: 'Dr. Bruno Lima', specialty: 'Nutrição' },
          grantedAt: '2026-10-02T10:00:00.000Z',
        },
      ],
    });
  });

  it('asks glucose-service with the patient\'s own token and auth-service for the professional ids', async () => {
    await getGrants();

    expect(glucoseFake.requests).toHaveLength(1);
    expect(glucoseFake.requests[0].headers.authorization).toBe(patientBearer);
    expect(glucoseFake.requests[0].headers['x-internal-token']).toBeUndefined();
    expect(lookupCalls()).toHaveLength(1);
    expect(lookupCalls()[0].body).toEqual({ ids: [PRO_A, PRO_B] });
  });

  it('answers 200 with fullName null and X-Degraded when the names lookup fails', async () => {
    lookupFails = true;

    const res = await getGrants();

    expect(res.status).toBe(200);
    expect(res.headers['x-degraded']).toBe('professional-names');
    expect(res.body.grants.map((g: { id: string; professional: unknown }) => [g.id, g.professional])).toEqual([
      ['g-1', { fullName: null, specialty: 'Endocrinologia' }],
      ['g-2', { fullName: null, specialty: 'Nutrição' }],
    ]);
  });

  it('shows a null name, without degrading, for a professional whose account no longer exists', async () => {
    grants = [{ id: 'g-3', professionalId: GONE, specialty: 'Nutrição', grantedAt: '2026-10-03T10:00:00.000Z' }];

    const res = await getGrants();

    expect(res.status).toBe(200);
    expect(res.headers['x-degraded']).toBeUndefined();
    expect(res.body.grants[0].professional).toEqual({ fullName: null, specialty: 'Nutrição' });
  });

  it('answers an empty list without asking auth-service', async () => {
    grants = [];

    const res = await getGrants();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ grants: [] });
    expect(lookupCalls()).toHaveLength(0);
  });

  it.each([
    [403, { error: 'Forbidden', code: 'FORBIDDEN' }],
    [503, { error: 'boom' }],
  ])('propagates a %i from glucose-service without calling auth-service', async (status, body) => {
    glucoseAnswer = { status, body };

    const res = await getGrants();

    expect(res.status).toBe(status);
    expect(lookupCalls()).toHaveLength(0);
  });

  it('leaves the other methods under /grants to the proxy', async () => {
    const res = await request(app).delete('/api/v1/sharing/grants/g-1').set('Authorization', patientBearer);

    expect(res.status).toBe(200);
    expect(glucoseFake.requests.at(-1)).toMatchObject({ method: 'DELETE', path: '/sharing/grants/g-1' });
    expect(lookupCalls()).toHaveLength(0);
  });
});
