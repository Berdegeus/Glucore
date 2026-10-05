import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  PrismaAccountRepository,
  type CreateAccountData,
} from '../../src/modules/accounts/accounts.repository';
import { disconnect, prisma, truncateAll } from '../helpers/db';

/**
 * REG-01 and REG-06 at the storage seam: the service picks the role, the
 * repository stores it, and ADMINISTRATOR is not a role this path can create.
 */

const repo = new PrismaAccountRepository(prisma);

const accountData = (overrides: Partial<CreateAccountData> = {}): CreateAccountData => ({
  email: 'pessoa@example.com',
  fullName: 'Pessoa Teste',
  phone: undefined,
  passwordHash: 'hash',
  role: 'PATIENT',
  ...overrides,
});

beforeEach(truncateAll);

afterAll(async () => {
  await disconnect();
});

describe('PrismaAccountRepository.create role', () => {
  it.each(['PATIENT', 'HEALTH_PROFESSIONAL'] as const)('stores the %s role it was given', async (role) => {
    const created = await repo.create(accountData({ role }));

    expect(created.role).toBe(role);
    const stored = await prisma.user.findUnique({
      where: { email: 'pessoa@example.com' },
      include: { authCredential: true },
    });
    expect(stored?.role).toBe(role);
    expect(stored?.authCredential?.passwordHash).toBe('hash');
  });

  it('refuses ADMINISTRATOR and creates nothing', async () => {
    const data = accountData({ role: 'ADMINISTRATOR' as unknown as CreateAccountData['role'] });

    await expect(repo.create(data)).rejects.toThrow('Role ADMINISTRATOR cannot be created');
    expect(await prisma.user.count()).toBe(0);
  });
});
