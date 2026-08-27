import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import {
  accessTokenTtlSeconds,
  signAccessToken,
  verifyAccessToken,
  type AccessTokenClaims,
} from '@glucore/shared';

/**
 * Unit tests for the shared access token, which both services now depend on:
 * auth-service signs, glucose-service verifies. A disagreement between the two
 * would show up as every request failing with 401, so the contract is pinned
 * here rather than left to the integration suites to discover.
 *
 * They live under glucose-service because the workspace runs one Vitest project
 * per service and `@glucore/shared` is aliased to its source here; coverage is
 * measured over `packages/*&#47;src` either way.
 */

const SECRET = 'test-secret-for-access-tokens';

const patient: AccessTokenClaims = { sub: 'e0a1b2c3-d4e5-4f60-8a9b-0c1d2e3f4a5b', role: 'PATIENT' };

describe('signAccessToken / verifyAccessToken', () => {
  it('round-trips the claims it was given', () => {
    expect(verifyAccessToken(signAccessToken(patient, SECRET), SECRET)).toEqual(patient);
  });

  it('carries the role in the token, not just the subject', () => {
    const decoded = jwt.decode(
      signAccessToken({ ...patient, role: 'HEALTH_PROFESSIONAL' }, SECRET),
    ) as Record<string, unknown>;
    expect(decoded.role).toBe('HEALTH_PROFESSIONAL');
    expect(decoded.sub).toBe(patient.sub);
  });

  it('rejects a token signed with another secret', () => {
    expect(verifyAccessToken(signAccessToken(patient, SECRET), 'a-different-secret')).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sub: patient.sub, role: 'PATIENT' }, SECRET, { expiresIn: -10 });
    expect(verifyAccessToken(expired, SECRET)).toBeNull();
  });

  it('rejects a well-signed token with no role', () => {
    // The shape every token had before this change. Refusing it is the point:
    // a token minted under the old scheme must not silently become a PATIENT.
    const legacy = jwt.sign({ sub: patient.sub }, SECRET, { expiresIn: '30d' });
    expect(verifyAccessToken(legacy, SECRET)).toBeNull();
  });

  it('rejects a well-signed token whose role is not one of ours', () => {
    const forged = jwt.sign({ sub: patient.sub, role: 'SUPERUSER' }, SECRET, { expiresIn: '1h' });
    expect(verifyAccessToken(forged, SECRET)).toBeNull();
  });

  it('rejects a token with no subject', () => {
    const anonymous = jwt.sign({ role: 'PATIENT' }, SECRET, { expiresIn: '1h' });
    expect(verifyAccessToken(anonymous, SECRET)).toBeNull();
  });

  it('rejects a string that is not a token at all', () => {
    expect(verifyAccessToken('not-a-jwt', SECRET)).toBeNull();
  });
});

describe('accessTokenTtlSeconds', () => {
  it('keeps the 30-day lifetime for patients', () => {
    expect(accessTokenTtlSeconds('PATIENT')).toBe(30 * 24 * 60 * 60);
  });

  it('gives the web roles an hour, so revocation can mean something', () => {
    expect(accessTokenTtlSeconds('HEALTH_PROFESSIONAL')).toBe(3600);
    expect(accessTokenTtlSeconds('ADMINISTRATOR')).toBe(3600);
  });

  it('is what the signed token actually expires by', () => {
    const decoded = jwt.decode(signAccessToken(patient, SECRET)) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBe(accessTokenTtlSeconds('PATIENT'));
  });
});
