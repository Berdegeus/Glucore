import type { Role } from '../../../shared/domain/role';
import type { Account } from './account';

/** A signed-in account and when its access token stops working. */
export interface Session {
  account: Account;
  /** From the token's `exp`; null when the token carries none we can read. */
  expiresAt: Date | null;
}

/** How close to expiry a refreshable session must be before it renews (ACC-10). */
export const REFRESH_WINDOW_MS = 5 * 60 * 1000;

/** Only the web roles with short-lived tokens renew; the patient's lasts 30 days. */
const REFRESHABLE_ROLES: readonly Role[] = ['HEALTH_PROFESSIONAL', 'ADMINISTRATOR'];

/**
 * True when the session should renew its token now (ACC-10): a professional
 * or administrator, under 5 minutes from expiry, who used the page in the
 * last 5 minutes. Exactly 5:00 left does not renew yet.
 */
export function needsRefresh(session: Session, now: Date, hadRecentActivity: boolean): boolean {
  if (!hadRecentActivity || !session.expiresAt) return false;
  if (!REFRESHABLE_ROLES.includes(session.account.role)) return false;
  return session.expiresAt.getTime() - now.getTime() < REFRESH_WINDOW_MS;
}
