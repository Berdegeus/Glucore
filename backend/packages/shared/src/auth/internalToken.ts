import jwt from 'jsonwebtoken';

import { isUserRoleName, type UserRoleName } from './claims';

/**
 * What the gateway asserts about the caller when it talks to a downstream
 * service on their behalf. Same shape as `AccessTokenClaims`, kept as a
 * separate type because the two tokens are signed with different secrets and
 * must never be interchangeable.
 */
export interface InternalTokenClaims {
  sub: string;
  role: UserRoleName;
}

const INTERNAL_TTL_SECONDS = 60;
const INTERNAL_AUDIENCE = 'internal';

/**
 * Signed with `INTERNAL_JWT_SECRET`, distinct from `JWT_SECRET`, so a leaked
 * user token can never be replayed as an internal one. A 60s expiry is long
 * enough to cross one hop and short enough that a captured token is useless
 * a minute later.
 */
export function signInternalToken(claims: InternalTokenClaims, secret: string): string {
  return jwt.sign({ sub: claims.sub, role: claims.role }, secret, {
    audience: INTERNAL_AUDIENCE,
    expiresIn: INTERNAL_TTL_SECONDS,
  });
}

/**
 * Verifies an internal token and returns its claims, or `null` for anything
 * unusable — bad signature, expired, wrong audience, or missing/unrecognised
 * role. Never throws, mirroring `verifyAccessToken`: the caller always wants
 * a 401, not a caught exception.
 */
export function verifyInternalToken(token: string, secret: string): InternalTokenClaims | null {
  let payload: unknown;
  try {
    payload = jwt.verify(token, secret, { audience: INTERNAL_AUDIENCE });
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload === null) return null;
  const { sub, role } = payload as { sub?: unknown; role?: unknown };
  if (typeof sub !== 'string' || sub.length === 0) return null;
  if (!isUserRoleName(role)) return null;

  return { sub, role };
}
