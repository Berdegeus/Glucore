import jwt from 'jsonwebtoken';

import { isUserRoleName, type AccessTokenClaims, type UserRoleName } from './claims';

/**
 * Token lifetime per role.
 *
 * PATIENT keeps the 30 days it has always had: the mobile app is expected to
 * stay signed in for months, and there is no revocation path for it anyway.
 *
 * The web roles get an hour. They are the accounts worth revoking — a clinician
 * losing access has to mean something — and short expiry is what makes
 * revocation possible without checking a session table on every single request.
 */
const TTL_SECONDS: Record<UserRoleName, number> = {
  PATIENT: 30 * 24 * 60 * 60,
  HEALTH_PROFESSIONAL: 60 * 60,
  ADMINISTRATOR: 60 * 60,
};

export function accessTokenTtlSeconds(role: UserRoleName): number {
  return TTL_SECONDS[role];
}

export function signAccessToken(claims: AccessTokenClaims, secret: string): string {
  return jwt.sign({ sub: claims.sub, role: claims.role }, secret, {
    expiresIn: accessTokenTtlSeconds(claims.role),
  });
}

/**
 * Verifies a token and returns its claims, or `null` for anything unusable —
 * bad signature, expired, or well-signed but not shaped like one of ours.
 *
 * Returning null rather than throwing keeps the decision at the call site: the
 * middleware answers 401 either way, and a thrown error there would have to be
 * caught only to be turned back into the same response.
 *
 * A token whose `role` is missing or unrecognised is rejected rather than
 * defaulted. Defaulting to PATIENT would silently downgrade a privileged
 * account; defaulting to anything else would grant access on a malformed token.
 */
export function verifyAccessToken(token: string, secret: string): AccessTokenClaims | null {
  let payload: unknown;
  try {
    payload = jwt.verify(token, secret);
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload === null) return null;
  const { sub, role } = payload as { sub?: unknown; role?: unknown };
  if (typeof sub !== 'string' || sub.length === 0) return null;
  if (!isUserRoleName(role)) return null;

  return { sub, role };
}
