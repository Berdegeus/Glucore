import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EnvServiceRegistry, verifyInternalToken } from '@glucore/shared';

import { UpstreamHttpError } from '../../src/clients/errors';
import { GlucoseClient } from '../../src/clients/glucoseClient';
import { startFakeDownstream, type FakeDownstream } from '../helpers/fakeDownstream';
import { TEST_INTERNAL_JWT_SECRET } from '../helpers/testEnv';

let glucoseFake: FakeDownstream;
let client: GlucoseClient;

const profile = { licenseNumber: 'CRM-123456', specialty: 'Endocrinologia' };

const claimsOfLastCall = () =>
  verifyInternalToken(glucoseFake.requests.at(-1)!.headers['x-internal-token'] as string, TEST_INTERNAL_JWT_SECRET);

beforeAll(async () => {
  glucoseFake = await startFakeDownstream((app) => {
    app.post('/internal/professionals', (req, res) => {
      if (req.body.licenseNumber === 'invalid') {
        res.status(400).json({ error: 'Invalid licenseNumber', code: 'VALIDATION_ERROR' });
        return;
      }
      res.status(201).json({ userId: 'pro-1', ...req.body });
    });
    app.get('/internal/professionals/me', (req, res) => {
      const claims = verifyInternalToken(req.headers['x-internal-token'] as string, TEST_INTERNAL_JWT_SECRET);
      if (claims?.sub === 'no-profile') {
        res.status(404).json({ error: 'Professional not found' });
        return;
      }
      res.json({ userId: claims?.sub, ...profile });
    });
    app.delete('/internal/professionals/:id', (_req, res) => res.status(204).send());
  });
  client = new GlucoseClient(new EnvServiceRegistry({ auth: glucoseFake.url, glucose: glucoseFake.url }), TEST_INTERNAL_JWT_SECRET);
});

afterAll(() => glucoseFake.close());

describe('GlucoseClient professional calls', () => {
  it('createProfessional posts the profile fields and signs the token with the new userId as HEALTH_PROFESSIONAL', async () => {
    const result = await client.createProfessional('pro-1', profile);

    expect(result).toEqual({ userId: 'pro-1', ...profile });
    expect(glucoseFake.requests.at(-1)).toMatchObject({ method: 'POST', path: '/internal/professionals', body: profile });
    expect(claimsOfLastCall()).toEqual({ sub: 'pro-1', role: 'HEALTH_PROFESSIONAL' });
  });

  it('createProfessional propagates an upstream validation error with its status and code', async () => {
    const error = await client.createProfessional('pro-1', { ...profile, licenseNumber: 'invalid' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamHttpError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });

  it('getProfessional reads /internal/professionals/me on behalf of the caller', async () => {
    const result = await client.getProfessional('pro-1');

    expect(result).toEqual({ userId: 'pro-1', ...profile });
    expect(glucoseFake.requests.at(-1)).toMatchObject({ method: 'GET', path: '/internal/professionals/me' });
    expect(claimsOfLastCall()).toEqual({ sub: 'pro-1', role: 'HEALTH_PROFESSIONAL' });
  });

  it('getProfessional propagates 404 when there is no profile', async () => {
    const error = await client.getProfessional('no-profile').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamHttpError);
    expect(error).toMatchObject({ status: 404 });
  });

  it('deleteProfessional deletes by id with the gateway service identity', async () => {
    await expect(client.deleteProfessional('pro-1')).resolves.toBeUndefined();

    expect(glucoseFake.requests.at(-1)).toMatchObject({ method: 'DELETE', path: '/internal/professionals/pro-1' });
    expect(claimsOfLastCall()).toEqual({ sub: 'gateway', role: 'ADMINISTRATOR' });
  });
});
