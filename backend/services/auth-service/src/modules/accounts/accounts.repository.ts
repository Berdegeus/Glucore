import { Prisma, type PrismaClient } from '../../lib/prisma';

import type { AccountSource } from './accounts.mapper';

export interface CreateAccountData {
  email: string;
  fullName: string;
  phone: string | null | undefined;
  passwordHash: string;
}

export interface AccountWithCredential extends AccountSource {
  passwordHash: string | null;
}

export interface UpdateAccountData {
  email?: string;
  fullName?: string;
  phone?: string | null;
}

/**
 * Everything the account module needs from storage.
 *
 * Named methods rather than a leaked query builder: the service says what it
 * wants, and swapping Postgres for anything else is a matter of another class
 * implementing this interface. It is also what lets the unit tests run against
 * an in-memory double instead of a database.
 */
export interface AccountRepository {
  findByEmail(email: string): Promise<{ id: string } | null>;
  findById(id: string): Promise<AccountSource | null>;
  findByIdWithCredential(id: string): Promise<AccountWithCredential | null>;
  /** Another account holding this email, ignoring the one being edited. */
  findOtherHolderOfEmail(email: string, exceptUserId: string): Promise<{ id: string } | null>;
  create(data: CreateAccountData): Promise<AccountSource>;
  update(
    userId: string,
    account: UpdateAccountData,
    passwordHash: string | undefined,
  ): Promise<void>;
  /** Idempotent: deleting an id that no longer exists is a success, not a 404. */
  delete(id: string): Promise<void>;
}

const ACCOUNT_FIELDS = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  status: true,
  role: true,
  createdAt: true,
} as const;

export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true } });
  }

  findById(id: string): Promise<AccountSource | null> {
    return this.prisma.user.findUnique({ where: { id }, select: ACCOUNT_FIELDS });
  }

  async findByIdWithCredential(id: string): Promise<AccountWithCredential | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...ACCOUNT_FIELDS, authCredential: { select: { passwordHash: true } } },
    });
    if (!user) return null;
    const { authCredential, ...account } = user;
    return { ...account, passwordHash: authCredential?.passwordHash ?? null };
  }

  findOtherHolderOfEmail(email: string, exceptUserId: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: { email, NOT: { id: exceptUserId } },
      select: { id: true },
    });
  }

  create(data: CreateAccountData): Promise<AccountSource> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        role: 'PATIENT',
        authCredential: { create: { passwordHash: data.passwordHash } },
      },
      select: ACCOUNT_FIELDS,
    });
  }

  /**
   * One transaction for the account row and the credential, so a password
   * change cannot land while the email change beside it fails. It is the same
   * atomicity the monolith had; what it no longer covers is the patient row,
   * which is in another database now. That is why the gateway calls this leg
   * first and only then glucose: this is the leg that can reject.
   */
  async update(
    userId: string,
    account: UpdateAccountData,
    passwordHash: string | undefined,
  ): Promise<void> {
    const operations = [];

    if (Object.keys(account).length > 0) {
      operations.push(this.prisma.user.update({ where: { id: userId }, data: account }));
    }

    if (passwordHash !== undefined) {
      operations.push(
        this.prisma.authCredential.upsert({
          where: { userId },
          update: { passwordHash },
          create: { userId, passwordHash },
        }),
      );
    }

    if (operations.length > 0) await this.prisma.$transaction(operations);
  }

  /**
   * Backs both the saga's compensation and `DELETE /account`. Both callers
   * may retry after a partial failure, so a second delete against an id that
   * is already gone must not surface as an error — `AuditLog.userId` survives
   * via `ON DELETE SET NULL`, already set up in the schema.
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return;
      throw error;
    }
  }
}
