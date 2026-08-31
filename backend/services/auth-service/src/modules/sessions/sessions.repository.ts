import { type PrismaClient } from '../../lib/prisma';

export interface CredentialHolder {
  id: string;
  role: string;
  passwordHash: string | null;
}

export interface SessionRepository {
  findCredentialHolderByEmail(email: string): Promise<CredentialHolder | null>;
  /** Stamps the login and opens a session in one transaction. */
  recordLogin(userId: string, userAgent: string | null, expiresAt: Date): Promise<void>;
  open(userId: string, userAgent: string | null, expiresAt: Date): Promise<void>;
  /**
   * Whether the user's most recent session has been revoked. `false` when the
   * user has no session at all — there is nothing to revoke yet, so refresh
   * is not the thing that should reject that case.
   */
  isRevoked(userId: string): Promise<boolean>;
}

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCredentialHolderByEmail(email: string): Promise<CredentialHolder | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, authCredential: { select: { passwordHash: true } } },
    });
    if (!user) return null;
    return { id: user.id, role: user.role, passwordHash: user.authCredential?.passwordHash ?? null };
  }

  async recordLogin(userId: string, userAgent: string | null, expiresAt: Date): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.authCredential.update({ where: { userId }, data: { lastLoginAt: new Date() } }),
      this.prisma.authSession.create({ data: { userId, expiresAt, userAgent } }),
    ]);
  }

  async open(userId: string, userAgent: string | null, expiresAt: Date): Promise<void> {
    await this.prisma.authSession.create({ data: { userId, expiresAt, userAgent } });
  }

  async isRevoked(userId: string): Promise<boolean> {
    const latest = await this.prisma.authSession.findFirst({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      select: { isRevoked: true },
    });
    return latest?.isRevoked ?? false;
  }
}
