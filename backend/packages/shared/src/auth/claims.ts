/**
 * What a Glucore access token carries.
 *
 * `role` is part of the token rather than looked up per request. That is a
 * reversal of an earlier decision (read the role from the database every time,
 * so a demotion took effect immediately) and it was made for a specific reason:
 * once identity lives in its own service, every authorization check would cost a
 * network round trip to it — including the reading sync, the highest-volume
 * route in the system — to protect a case that barely exists, since the mobile
 * app only ever holds PATIENT accounts.
 *
 * The privileged roles are covered better than before instead of worse: they get
 * a one-hour token and session revocation (see `accessTokenTtl`), where they
 * would previously have carried a 30-day token with no revocation at all.
 */
export type UserRoleName = 'PATIENT' | 'HEALTH_PROFESSIONAL' | 'ADMINISTRATOR';

export interface AccessTokenClaims {
  /** The user id. Named `sub` because that is the registered JWT claim. */
  sub: string;
  role: UserRoleName;
}

export const USER_ROLE_NAMES: readonly UserRoleName[] = [
  'PATIENT',
  'HEALTH_PROFESSIONAL',
  'ADMINISTRATOR',
];

export function isUserRoleName(value: unknown): value is UserRoleName {
  return typeof value === 'string' && (USER_ROLE_NAMES as readonly string[]).includes(value);
}
