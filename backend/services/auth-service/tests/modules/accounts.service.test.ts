import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { verifyAccessToken } from '@glucore/shared';

import { BcryptPasswordHasher } from '../../src/lib/passwordHasher';
import { PrismaAccountRepository } from '../../src/modules/accounts/accounts.repository';
import type { RegisterInput } from '../../src/modules/accounts/accounts.schema';
import { AccountsService } from '../../src/modules/accounts/accounts.service';
import { PrismaSessionRepository } from '../../src/modules/sessions/sessions.repository';
import { SessionsService } from '../../src/modules/sessions/sessions.service';
import { disconnect, prisma, truncateAll } from '../helpers/db';
import { TEST_BCRYPT_ROUNDS, TEST_JWT_SECRET } from '../helpers/testEnv';

/**
 * REG-01/02/03/08 at the service, over a real Postgres: the professional
 * registration reuses the patient one, so each check below is also the proof
 * that the two paths agree where the spec says they must.
 */

const STRONG = 'Senha123!';
const AUDIT = { ipAddress: '10.0.0.1', userAgent: 'vitest' };

const hasher = new BcryptPasswordHasher(TEST_BCRYPT_ROUNDS);
const service = new AccountsService(
  new PrismaAccountRepository(prisma),
  hasher,
  new SessionsService(new PrismaSessionRepository(prisma), hasher),
);

const input = (overrides: Partial<RegisterInput> = {}): RegisterInput => ({
  email: 'doutora@example.com',
  password: STRONG,
  fullName: 'Dra. Ana Souza',
  phone: undefined,
  ...overrides,
});

const decodeLifetimeSeconds = (token: string): number => {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
    iat: number;
    exp: number;
  };
  return payload.exp - payload.iat;
};

beforeEach(truncateAll);

afterAll(async () => {
  await disconnect();
});

describe('AccountsService.registerProfessional', () => {
  it('creates a HEALTH_PROFESSIONAL account and answers its id and a one-hour token (REG-01)', async () => {
    const { userId, token } = await service.registerProfessional(input({ phone: '11999990000' }), AUDIT);

    const stored = await prisma.user.findUnique({ where: { id: userId }, include: { authSessions: true } });
    expect(stored).toMatchObject({ role: 'HEALTH_PROFESSIONAL', email: 'doutora@example.com', phone: '11999990000' });
    expect(stored?.authSessions).toHaveLength(1);
    expect(verifyAccessToken(token, TEST_JWT_SECRET)).toEqual({ sub: userId, role: 'HEALTH_PROFESSIONAL' });
    expect(decodeLifetimeSeconds(token)).toBe(60 * 60);
  });

  it.each(['short1!', 'senha123!', 'SENHA123!', 'SenhaSenha!', 'Senha1234'])(
    'rejects the weak password %s with WEAK_PASSWORD and creates nothing (REG-02)',
    async (password) => {
      await expect(service.registerProfessional(input({ password }), AUDIT)).rejects.toMatchObject({
        status: 400,
        code: 'WEAK_PASSWORD',
      });
      expect(await prisma.user.count()).toBe(0);
    },
  );

  it('rejects an e-mail that is already registered, as patient or professional, with EMAIL_TAKEN (REG-03)', async () => {
    await service.register(input({ email: 'taken@example.com' }), AUDIT);
    await service.registerProfessional(input({ email: 'prof@example.com' }), AUDIT);

    for (const email of ['taken@example.com', 'prof@example.com']) {
      await expect(service.registerProfessional(input({ email }), AUDIT)).rejects.toMatchObject({
        status: 409,
        code: 'EMAIL_TAKEN',
      });
    }
    expect(await prisma.user.count()).toBe(2);
  });

  it('writes a REGISTER_PROFESSIONAL audit row with the e-mail and no password (REG-08)', async () => {
    const { userId } = await service.registerProfessional(input(), AUDIT);

    const rows = await prisma.auditLog.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entity: 'User',
      action: 'REGISTER_PROFESSIONAL',
      entityId: userId,
      metadata: { email: 'doutora@example.com' },
      ipAddress: '10.0.0.1',
    });
    expect(JSON.stringify(rows[0])).not.toContain(STRONG);
  });
});

describe('AccountsService.register stays the patient registration', () => {
  it('creates a PATIENT with the 30-day token and a REGISTER audit row', async () => {
    const { userId, token } = await service.register(input({ email: 'paciente@example.com' }), AUDIT);

    const stored = await prisma.user.findUnique({ where: { id: userId } });
    expect(stored?.role).toBe('PATIENT');
    expect(verifyAccessToken(token, TEST_JWT_SECRET)).toEqual({ sub: userId, role: 'PATIENT' });
    expect(decodeLifetimeSeconds(token)).toBe(30 * 24 * 60 * 60);
    expect(await prisma.auditLog.count({ where: { userId, action: 'REGISTER' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'REGISTER_PROFESSIONAL' } })).toBe(0);
  });
});
