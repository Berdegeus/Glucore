import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { EnvServiceRegistry, verifyInternalToken } from '@glucore/shared';

import { AuthClient } from '../../src/clients/authClient';
import { UpstreamHttpError } from '../../src/clients/errors';
import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { TEST_INTERNAL_JWT_SECRET } from '../helpers/testEnv';

let authFake: FakeDownstream;
let client: AuthClient;

const KNOWN = new Map<string, string>();
const uuids = (n: number) => Array.from({ length: n }, () => randomUUID());
const sentIds = () => authFake.requests.map((r) => (r.body as { ids: string[] }).ids);

beforeAll(async () => {
  authFake = await startFakeDownstream((app) => {
    // Answers only the ids it knows, like the real endpoint; the id "fail" simulates an outage.
    app.post('/internal/accounts/lookup', (req, res) => {
      const ids = req.body.ids as string[];
      if (ids.includes('fail')) {
        res.status(503).json({ error: 'boom' });
        return;
      }
      res.json(ids.filter((id) => KNOWN.has(id)).map((id) => ({ id, fullName: KNOWN.get(id) })));
    });
  });
  client = new AuthClient(new EnvServiceRegistry({ auth: authFake.url, glucose: authFake.url }), TEST_INTERNAL_JWT_SECRET);
});

beforeEach(() => {
  authFake.requests.length = 0;
  KNOWN.clear();
});

afterAll(() => authFake.close());

describe('AuthClient.lookupAccounts', () => {
  it('sends the ids to /internal/accounts/lookup and returns an id → name map', async () => {
    const [a, b] = uuids(2);
    KNOWN.set(a, 'Dra. Ana Souza').set(b, 'Dr. Bruno Lima');

    const names = await client.lookupAccounts([a, b]);

    expect(names).toEqual(new Map([[a, 'Dra. Ana Souza'], [b, 'Dr. Bruno Lima']]));
    expect(authFake.requests).toHaveLength(1);
    expect(authFake.requests[0]).toMatchObject({ method: 'POST', path: '/internal/accounts/lookup', body: { ids: [a, b] } });
  });

  it('signs the internal token with the gateway service identity', async () => {
    await client.lookupAccounts(uuids(1));

    const token = authFake.requests[0].headers['x-internal-token'] as string;
    expect(verifyInternalToken(token, TEST_INTERNAL_JWT_SECRET)).toMatchObject({ sub: 'gateway', role: 'ADMINISTRATOR' });
  });

  it('does not call the upstream for an empty list', async () => {
    const names = await client.lookupAccounts([]);

    expect(names.size).toBe(0);
    expect(authFake.requests).toHaveLength(0);
  });

  it('leaves an id the upstream does not know out of the map', async () => {
    const [known, unknown] = uuids(2);
    KNOWN.set(known, 'Conta Real');

    const names = await client.lookupAccounts([unknown, known]);

    expect([...names.keys()]).toEqual([known]);
  });

  it('sends a repeated id once', async () => {
    const [id] = uuids(1);
    await client.lookupAccounts([id, id]);

    expect(sentIds()).toEqual([[id]]);
  });

  it.each([
    [200, [200]],
    [201, [200, 1]],
    [450, [200, 200, 50]],
  ])('splits %i ids into batches of at most 200 (%j) and merges the answers', async (total, batches) => {
    const ids = uuids(total);
    ids.forEach((id, i) => KNOWN.set(id, `Nome ${i}`));

    const names = await client.lookupAccounts(ids);

    expect(sentIds().map((chunk) => chunk.length)).toEqual(batches);
    expect(names.size).toBe(total);
    expect(names.get(ids[total - 1])).toBe(`Nome ${total - 1}`);
  });

  it('propagates an upstream failure', async () => {
    const error = await client.lookupAccounts(['fail']).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamHttpError);
    expect(error).toMatchObject({ status: 503 });
  });
});
