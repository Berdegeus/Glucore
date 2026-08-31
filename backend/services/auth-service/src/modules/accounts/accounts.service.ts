import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  signAccessToken,
  type AuditContext,
} from '@glucore/shared';

import { getJwtSecret } from '../../lib/env';
import type { PasswordHasher } from '../../lib/passwordHasher';
import { assertStrongPassword } from '../../lib/passwordPolicy';
import { recordAudit } from '../../lib/audit';
import type { SessionsService } from '../sessions/sessions.service';

import { toAccountDto, type AccountDto } from './accounts.mapper';
import type { AccountRepository } from './accounts.repository';
import type { RegisterInput, UpdateAccountInput } from './accounts.schema';

export interface RegisterResult {
  token: string;
  userId: string;
}

/**
 * Account creation and maintenance.
 *
 * Knows nothing about Express and nothing about Prisma: the controller hands it
 * parsed input, the repository hands it rows. Errors are thrown as AppError
 * subclasses and turned into `{ error, code }` by the shared handler, which is
 * what replaced the thirty-odd `res.status(4xx).json(...)` scattered through
 * the route file.
 */
export class AccountsService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionsService,
  ) {}

  /**
   * Creates the account and opens a session.
   *
   * What this no longer does is create the Patient row and its alert
   * thresholds. Those live in glucose-service's database now, and the payload
   * fields that fed them (birthDate, weightKg, targetRange) have nowhere to go
   * from here — the gateway's registration saga is what puts them back (phase
   * 6.1). Until then `ensurePatient` creates the patient lazily with the
   * default 80/180 range on the first data request, which is the backstop that
   * design always assumed. Registering does not silently fail; it stores less.
   */
  async register(input: RegisterInput, audit: AuditContext): Promise<RegisterResult> {
    // Throws WeakPasswordError, which the error chain answers as 400
    // WEAK_PASSWORD. Checked before touching the database so a rejected
    // password costs nothing.
    assertStrongPassword(input.password);

    if (await this.accounts.findByEmail(input.email)) {
      throw new ConflictError('Email already registered', 'EMAIL_TAKEN');
    }

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.accounts.create({
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      passwordHash,
    });

    await this.sessions.open(user.id, audit.userAgent ?? null);

    console.log(`[auth] register success email=${input.email}`);
    await recordAudit({
      userId: user.id,
      entity: 'User',
      action: 'REGISTER',
      entityId: user.id,
      metadata: { email: input.email },
      ...audit,
    });

    return {
      token: signAccessToken({ sub: user.id, role: user.role as 'PATIENT' }, getJwtSecret()),
      userId: user.id,
    };
  }

  async getAccount(userId: string): Promise<AccountDto> {
    const user = await this.accounts.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return toAccountDto(user);
  }

  async updateAccount(
    userId: string,
    input: UpdateAccountInput,
    audit: AuditContext,
  ): Promise<void> {
    const user = await this.accounts.findByIdWithCredential(userId);
    if (!user) throw new NotFoundError('User not found');

    if (input.requiresCurrentPassword) {
      await this.assertCurrentPassword(user.passwordHash, input.currentPassword);
    }

    const account: { email?: string; fullName?: string; phone?: string | null } = {};
    if (input.fullName !== undefined) account.fullName = input.fullName;
    if (input.phone !== undefined) account.phone = input.phone;

    if (input.newEmail !== undefined) {
      if (await this.accounts.findOtherHolderOfEmail(input.newEmail, userId)) {
        throw new ConflictError('Email already registered', 'EMAIL_TAKEN');
      }
      account.email = input.newEmail;
    }

    let passwordHash: string | undefined;
    if (input.newPassword !== undefined) {
      assertStrongPassword(input.newPassword);
      passwordHash = await this.hasher.hash(input.newPassword);
    }

    await this.accounts.update(userId, account, passwordHash);

    // Only the names of the changed areas, never the values.
    const changed = [...Object.keys(account), ...(passwordHash !== undefined ? ['password'] : [])];
    await recordAudit({
      userId,
      entity: 'User',
      action: 'UPDATE_PROFILE',
      entityId: userId,
      metadata: { changed },
      ...audit,
    });
  }

  private async assertCurrentPassword(
    storedHash: string | null,
    supplied: string | undefined,
  ): Promise<void> {
    if (!supplied) throw new BadRequestError('Current password required');
    if (!storedHash || !(await this.hasher.compare(supplied, storedHash))) {
      // Distinct from TOKEN_INVALID on purpose: the session is still valid and
      // only the supplied password is wrong, so the app must not log the user
      // out. The app branches on this code.
      throw new UnauthorizedError('Invalid password', 'INVALID_CURRENT_PASSWORD');
    }
  }
}
