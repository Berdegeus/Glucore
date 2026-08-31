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
}
