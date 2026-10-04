import crypto from 'crypto';

import { BadRequestError, type AuditContext } from '@glucore/shared';

import { recordAudit } from '../../lib/audit';
import type { Mailer } from '../../lib/mailer';
import type { PasswordHasher } from '../../lib/passwordHasher';
import { assertStrongPassword } from '../../lib/passwordPolicy';

import type { PasswordRepository } from './password.repository';
import type { ResetPasswordInput } from './password.schema';

const RESET_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

/** The one message both branches of forgot-password answer with. */
const NEUTRAL_REPLY = 'If the email is registered, instructions were sent.';

export class PasswordService {
  constructor(
    private readonly passwords: PasswordRepository,
    private readonly hasher: PasswordHasher,
    private readonly mailer: Mailer,
  ) {}

  /**
   * Issues a reset token, or pretends to.
   *
   * The response is identical whether or not the address has an account, which
   * is the only thing standing between this endpoint and an account-enumeration
   * oracle. For the same reason nothing is written to the audit trail for an
   * unknown address: a row per attempt would rebuild the list this response
   * refuses to give away.
   */
  async forgotPassword(email: string, audit: AuditContext): Promise<{ message: string }> {
    const userId = await this.passwords.findUserIdByEmail(email);
    if (!userId) return { message: NEUTRAL_REPLY };

    const token = crypto.randomUUID();
    await this.passwords.replaceOutstandingToken(
      userId,
      token,
      new Date(Date.now() + RESET_TOKEN_TTL_MS),
    );

    // A delivery failure is now a failure. The version this replaces caught it
    // and logged the token, which made "SMTP is broken" look exactly like "SMTP
    // is not configured" — the console mailer is a configured choice instead.
    await this.mailer.sendPasswordReset(email, token);

    await recordAudit({
      userId,
      entity: 'User',
      action: 'FORGOT_PASSWORD',
      entityId: userId,
      ...audit,
    });

    return { message: NEUTRAL_REPLY };
  }

  async resetPassword(input: ResetPasswordInput, audit: AuditContext): Promise<{ message: string }> {
    // Checked before the token is looked up, matching the old order: a weak
    // replacement is rejected as 400 WEAK_PASSWORD whether or not the token was
    // any good, which also avoids burning a valid token on a bad password.
    assertStrongPassword(input.password);

    const record = await this.passwords.findToken(input.token);
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      // Unknown, spent and expired answer alike: telling them apart would say
      // whether a token ever existed.
      throw new BadRequestError('Invalid or expired token');
    }

    const passwordHash = await this.hasher.hash(input.password);
    await this.passwords.consumeToken(input.token, record.userId, passwordHash);

    console.log(`[auth] password reset success userId=${record.userId}`);
    await recordAudit({
      userId: record.userId,
      entity: 'User',
      action: 'RESET_PASSWORD',
      entityId: record.userId,
      ...audit,
    });

    return { message: 'Password reset successful.' };
  }
}
