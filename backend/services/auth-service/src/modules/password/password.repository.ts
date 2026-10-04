import { type PrismaClient } from '../../lib/prisma';

export interface ResetTokenRecord {
  token: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface PasswordRepository {
  findUserIdByEmail(email: string): Promise<string | null>;
  /** Drops any outstanding unused token, then issues one. */
  replaceOutstandingToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  findToken(token: string): Promise<ResetTokenRecord | null>;
  /** Sets the new password and burns the token in one transaction. */
  consumeToken(token: string, userId: string, passwordHash: string): Promise<void>;
}

export class PrismaPasswordRepository implements PasswordRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserIdByEmail(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    return user?.id ?? null;
  }

  async replaceOutstandingToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    // Deleting first means a second request invalidates the first token rather
    // than leaving two valid ones outstanding.
    await this.prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
    await this.prisma.passwordResetToken.create({ data: { token, userId, expiresAt } });
  }

  findToken(token: string): Promise<ResetTokenRecord | null> {
    return this.prisma.passwordResetToken.findUnique({
      where: { token },
      select: { token: true, userId: true, expiresAt: true, usedAt: true },
    });
  }

  async consumeToken(token: string, userId: string, passwordHash: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.authCredential.upsert({
        where: { userId },
        update: { passwordHash },
        create: { userId, passwordHash },
      }),
      this.prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } }),
    ]);
  }
}
