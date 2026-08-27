import {
  UnauthorizedError,
  accessTokenTtlSeconds,
  signAccessToken,
  type AuditContext,
  type UserRoleName,
} from '@glucore/shared';

import { getJwtSecret } from '../../lib/env';
import type { PasswordHasher } from '../../lib/passwordHasher';
import { recordAudit } from '../../lib/audit';

import type { SessionRepository } from './sessions.repository';
import type { LoginInput } from './sessions.schema';

/**
 * Signing in, and the session row that records it.
 *
 * `AuthSession` is written on every login and registration and not yet read by
 * anything. It becomes load-bearing when the gateway starts checking
 * `isRevoked` for the web roles — which is what their one-hour token buys, and
 * why the row is worth writing before there is a reader.
 */
export class SessionsService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async login(input: LoginInput, audit: AuditContext): Promise<{ token: string }> {
    const user = await this.sessions.findCredentialHolderByEmail(input.email);

    // One answer for "no such address" and "wrong password", and 401 rather
    // than 404: distinguishing them would turn login into an oracle for which
    // addresses have accounts.
    if (
      !user?.passwordHash ||
      !(await this.hasher.compare(input.password, user.passwordHash))
    ) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const role = user.role as UserRoleName;
    await this.sessions.recordLogin(user.id, audit.userAgent ?? null, this.expiryFor(role));

    console.log(`[auth] login success email=${input.email}`);
    await recordAudit({
      userId: user.id,
      entity: 'User',
      action: 'LOGIN',
      entityId: user.id,
      ...audit,
    });

    return { token: signAccessToken({ sub: user.id, role }, getJwtSecret()) };
  }

  /** Opens a session for an account that was just created. */
  async open(userId: string, userAgent: string | null): Promise<void> {
    await this.sessions.open(userId, userAgent, this.expiryFor('PATIENT'));
  }

  /**
   * The session row expires with the token it was issued alongside, so a
   * shorter-lived web token does not leave a month-long row behind.
   */
  private expiryFor(role: UserRoleName): Date {
    return new Date(Date.now() + accessTokenTtlSeconds(role) * 1000);
  }
}
