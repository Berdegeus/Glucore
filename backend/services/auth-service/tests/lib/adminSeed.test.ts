import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminSeedError, ensureAdminSeed, type AdminSeedEnv } from '../../src/lib/adminSeed';
import { BcryptPasswordHasher } from '../../src/lib/passwordHasher';
import { TEST_BCRYPT_ROUNDS } from '../helpers/testEnv';
import { disconnect, prisma, truncateAll } from '../helpers/db';

/**
 * REG-09 and REG-10 against a real Postgres: the seed creates the first
 * administrator exactly once, and a production boot that cannot create it
 * fails naming the variable and never printing the password.
 */

const hasher = new BcryptPasswordHasher(TEST_BCRYPT_ROUNDS);

const STRONG = 'Adm1n!Seed#2026';
const production = (overrides: AdminSeedEnv = {}): AdminSeedEnv => ({
  NODE_ENV: 'production',
  ADMIN_SEED_EMAIL: 'admin@glucore.test',
  ADMIN_SEED_PASSWORD: STRONG,
  ...overrides,
});
const development = (overrides: AdminSeedEnv = {}): AdminSeedEnv => ({ NODE_ENV: 'development', ...overrides });

const consoleSpies = () =>
  (['log', 'info', 'warn', 'error'] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
const printed = (spies: ReturnType<typeof consoleSpies>) => JSON.stringify(spies.flatMap((spy) => spy.mock.calls));

const administrators = () => prisma.user.findMany({ where: { role: 'ADMINISTRATOR' } });
const createUser = (email: string, role: 'PATIENT' | 'ADMINISTRATOR') =>
  prisma.user.create({ data: { email, fullName: 'Existing', role, authCredential: { create: { passwordHash: 'hash' } } } });

beforeEach(truncateAll);
afterEach(() => vi.restoreAllMocks());
afterAll(disconnect);

describe('ensureAdminSeed — creation', () => {
  it('creates one active administrator with a hashed credential and an audit entry when none exists', async () => {
    const spies = consoleSpies();
    const outcome = await ensureAdminSeed(prisma, production(), hasher);

    expect(outcome).toBe('created');
    const admins = await administrators();
    expect(admins).toHaveLength(1);
    expect(admins[0]).toMatchObject({ email: 'admin@glucore.test', role: 'ADMINISTRATOR', status: 'ACTIVE' });

    const credential = await prisma.authCredential.findUniqueOrThrow({ where: { userId: admins[0].id } });
    expect(credential.passwordHash).not.toBe(STRONG);
    expect(await hasher.compare(STRONG, credential.passwordHash)).toBe(true);

    const audit = await prisma.auditLog.findMany({ where: { entity: 'User', action: 'SEED_ADMIN' } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ userId: admins[0].id, entityId: admins[0].id, metadata: { email: 'admin@glucore.test' } });
    expect(JSON.stringify(audit[0])).not.toContain(STRONG);
    expect(printed(spies)).not.toContain(STRONG);
  });

  it('stores the email trimmed and lowercased, like every other account', async () => {
    await ensureAdminSeed(prisma, production({ ADMIN_SEED_EMAIL: '  Admin@Glucore.TEST ' }), hasher);

    expect((await administrators())[0].email).toBe('admin@glucore.test');
  });
});

describe('ensureAdminSeed — idempotence', () => {
  it('does not duplicate on a second boot and does not reset the password', async () => {
    await ensureAdminSeed(prisma, production(), hasher);
    const before = await prisma.authCredential.findMany();

    const outcome = await ensureAdminSeed(prisma, production({ ADMIN_SEED_PASSWORD: 'An0ther!Pass#1' }), hasher);

    expect(outcome).toBe('exists');
    expect(await administrators()).toHaveLength(1);
    expect(await prisma.authCredential.findMany()).toEqual(before);
    expect(await prisma.auditLog.count({ where: { action: 'SEED_ADMIN' } })).toBe(1);
  });

  it('creates nothing when another administrator already exists', async () => {
    await createUser('first-admin@glucore.test', 'ADMINISTRATOR');

    const outcome = await ensureAdminSeed(prisma, production(), hasher);

    expect(outcome).toBe('exists');
    const admins = await administrators();
    expect(admins.map((a) => a.email)).toEqual(['first-admin@glucore.test']);
    expect(await prisma.user.findUnique({ where: { email: 'admin@glucore.test' } })).toBeNull();
  });

  it('does not require the variables once an administrator exists, even in production', async () => {
    await createUser('first-admin@glucore.test', 'ADMINISTRATOR');

    await expect(ensureAdminSeed(prisma, production({ ADMIN_SEED_EMAIL: '', ADMIN_SEED_PASSWORD: undefined }), hasher)).resolves.toBe(
      'exists',
    );
  });
});

describe('ensureAdminSeed — variables absent', () => {
  it.each([
    ['unset', development()],
    ['empty (compose ${VAR:-})', development({ ADMIN_SEED_EMAIL: '', ADMIN_SEED_PASSWORD: '  ' })],
  ])('in development does nothing and logs a single info line when both are %s', async (_label, env) => {
    const [log, ...others] = consoleSpies();

    const outcome = await ensureAdminSeed(prisma, env, hasher);

    expect(outcome).toBe('skipped');
    expect(await prisma.user.count()).toBe(0);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('ADMIN_SEED_EMAIL');
    others.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });

  it('in development with only one variable set, warns naming the missing one and creates nothing', async () => {
    const [, , warn] = consoleSpies();

    const outcome = await ensureAdminSeed(prisma, development({ ADMIN_SEED_EMAIL: 'admin@glucore.test' }), hasher);

    expect(outcome).toBe('skipped');
    expect(await prisma.user.count()).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('ADMIN_SEED_PASSWORD');
  });

  it.each([
    ['both missing', { ADMIN_SEED_EMAIL: undefined, ADMIN_SEED_PASSWORD: undefined }, ['ADMIN_SEED_EMAIL', 'ADMIN_SEED_PASSWORD']],
    ['email missing', { ADMIN_SEED_EMAIL: '' }, ['ADMIN_SEED_EMAIL']],
    ['password missing', { ADMIN_SEED_PASSWORD: '   ' }, ['ADMIN_SEED_PASSWORD']],
  ])('in production throws naming the variable when %s', async (_label, overrides, named) => {
    const error = await ensureAdminSeed(prisma, production(overrides), hasher).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AdminSeedError);
    const { message } = error as Error;
    named.forEach((name) => expect(message).toContain(name));
    const notNamed = ['ADMIN_SEED_EMAIL', 'ADMIN_SEED_PASSWORD'].filter((name) => !named.includes(name));
    // The sentence also explains that both are needed, so only the "must be set" subject is checked.
    notNamed.forEach((name) => expect(message.split(' must be set')[0]).not.toContain(name));
    expect(await prisma.user.count()).toBe(0);
  });
});

describe('ensureAdminSeed — variables present but unusable', () => {
  it.each([
    ['production', production({ ADMIN_SEED_PASSWORD: 'weakpass' })],
    ['development', development({ ADMIN_SEED_EMAIL: 'admin@glucore.test', ADMIN_SEED_PASSWORD: 'weakpass' })],
  ])('throws naming ADMIN_SEED_PASSWORD, without the password, on a weak one in %s', async (_label, env) => {
    const spies = consoleSpies();

    const error = await ensureAdminSeed(prisma, env, hasher).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AdminSeedError);
    expect((error as Error).message).toContain('ADMIN_SEED_PASSWORD');
    expect((error as Error).message).not.toContain('weakpass');
    expect(printed(spies)).not.toContain('weakpass');
    expect(await prisma.user.count()).toBe(0);
  });

  it('throws naming ADMIN_SEED_EMAIL on a malformed email', async () => {
    const error = await ensureAdminSeed(prisma, production({ ADMIN_SEED_EMAIL: 'not-an-email' }), hasher).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AdminSeedError);
    expect((error as Error).message).toContain('ADMIN_SEED_EMAIL');
    expect(await prisma.user.count()).toBe(0);
  });

  it('refuses to promote an existing non-administrator account holding the seed email', async () => {
    await createUser('admin@glucore.test', 'PATIENT');

    const error = await ensureAdminSeed(prisma, production(), hasher).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AdminSeedError);
    expect((error as Error).message).toContain('ADMIN_SEED_EMAIL');
    expect(await administrators()).toHaveLength(0);
  });
});
