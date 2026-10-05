import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EnvServiceRegistry, verifyInternalToken } from '@glucore/shared';

import { AuthClient } from '../../src/clients/authClient';
import { UpstreamHttpError } from '../../src/clients/errors';
import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { TEST_INTERNAL_JWT_SECRET } from '../helpers/testEnv';

let authFake: FakeDownstream;
let client: AuthClient;

const input = { email: 'pro@example.com', password: 'Str0ng!pass', fullName: 'Dra. Ana', phone: '11999990000' };

beforeAll(async () => {
  authFake = await startFakeDownstream((app) => {
    app.post('/internal/accounts/professional', (req, res) => {
      if (req.body.email === 'taken@example.com') {
        res.status(409).json({ error: 'Email already registered', code: 'EMAIL_TAKEN' });
        return;
      }
      if (req.body.password === 'weak') {
        res.status(400).json({ error: 'Weak password', code: 'WEAK_PASSWORD' });
        return;
      }
      res.status(201).json({ userId: 'pro-1', token: 'a-token' });
    });
  });
  client = new AuthClient(new EnvServiceRegistry({ auth: authFake.url, glucose: authFake.url }), TEST_INTERNAL_JWT_SECRET);
});

afterAll(() => authFake.close());

describe('AuthClient.registerProfessional', () => {
  it('posts the account fields to /internal/accounts/professional and returns userId and token', async () => {
    authFake.requests.length = 0;
    const result = await client.registerProfessional(input);

    expect(result).toEqual({ userId: 'pro-1', token: 'a-token' });
    expect(authFake.requests).toHaveLength(1);
    expect(authFake.requests[0]).toMatchObject({ method: 'POST', path: '/internal/accounts/professional', body: input });
  });

  it('signs the internal token with the gateway service identity', async () => {
    authFake.requests.length = 0;
    await client.registerProfessional(input);

    const token = authFake.requests[0].headers['x-internal-token'] as string;
    expect(verifyInternalToken(token, TEST_INTERNAL_JWT_SECRET)).toMatchObject({ sub: 'gateway', role: 'ADMINISTRATOR' });
  });

  it.each([
    [{ ...input, email: 'taken@example.com' }, 409, 'EMAIL_TAKEN'],
    [{ ...input, password: 'weak' }, 400, 'WEAK_PASSWORD'],
  ])('propagates the upstream status and code (%#)', async (body, status, code) => {
    const error = await client.registerProfessional(body).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamHttpError);
    expect(error).toMatchObject({ status, code });
  });
});
