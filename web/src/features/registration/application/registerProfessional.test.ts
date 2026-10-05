import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import { accountOf, memoryTokenStore } from '../../../test/authFakes';
import type { Session } from '../../auth';
import type { ProfessionalRegistration } from '../domain/registration';
import { createRegisterProfessional } from './registerProfessional';

const INPUT: ProfessionalRegistration = {
  fullName: 'Ana Souza',
  email: 'ana@clinica.com',
  password: 'Senha123!',
  licenseNumber: 'CRM-SP 123456',
  specialty: 'Endocrinologia',
};

const SESSION: Session = { account: accountOf('HEALTH_PROFESSIONAL'), expiresAt: new Date('2026-05-03T12:00:00.000Z') };

function setup(resolve: () => Promise<Session> = () => Promise.resolve(SESSION)) {
  const tokenStore = memoryTokenStore();
  const registrations = { registerProfessional: vi.fn().mockResolvedValue({ userId: 'u1', token: 'tok-1' }) };
  const sessionEvents = { emitExpired: vi.fn(), subscribe: vi.fn(), reset: vi.fn() };
  const resolveSession = vi.fn(resolve);
  const register = createRegisterProfessional({ registrations, tokenStore, sessionEvents, resolveSession });
  return { register, registrations, tokenStore, sessionEvents, resolveSession };
}

describe('createRegisterProfessional (REG-01)', () => {
  it('registers, stores the token and returns the professional session read from /me', async () => {
    const { register, registrations, tokenStore, resolveSession, sessionEvents } = setup();

    const session = await register(INPUT);

    expect(registrations.registerProfessional).toHaveBeenCalledWith(INPUT);
    expect(tokenStore.read()).toBe('tok-1');
    expect(resolveSession).toHaveBeenCalledWith('tok-1');
    expect(session).toBe(SESSION);
    expect(session.account.role).toBe('HEALTH_PROFESSIONAL');
    expect(sessionEvents.reset).toHaveBeenCalledTimes(1);
  });

  it('sends the trimmed fields and no phone when none was typed', async () => {
    const { register, registrations } = setup();

    await register({ ...INPUT, fullName: ' Ana Souza ', licenseNumber: ' 123 ', phone: '  ' });

    expect(registrations.registerProfessional).toHaveBeenCalledWith({ ...INPUT, licenseNumber: '123' });
  });

  it('removes the token and does not re-arm the expiry notice when /me fails', async () => {
    const { register, tokenStore, sessionEvents } = setup(() => Promise.reject(new AppError('unavailable')));

    await expect(register(INPUT)).rejects.toMatchObject({ kind: 'unavailable' });

    expect(tokenStore.read()).toBeNull();
    expect(sessionEvents.reset).not.toHaveBeenCalled();
  });

  it.each(['conflict', 'rate-limited', 'validation'] as const)(
    'propagates %s from the repository without storing a token',
    async (kind) => {
      const { register, registrations, tokenStore, resolveSession } = setup();
      registrations.registerProfessional.mockRejectedValue(new AppError(kind));

      await expect(register(INPUT)).rejects.toMatchObject({ kind });

      expect(tokenStore.read()).toBeNull();
      expect(resolveSession).not.toHaveBeenCalled();
    },
  );
});

describe('createRegisterProfessional client checks (REG-02, REG-05)', () => {
  it.each<[string, Partial<ProfessionalRegistration>, string]>([
    ['a weak password', { password: 'senha123!' }, 'WEAK_PASSWORD'],
    ['a registration number of 41 characters', { licenseNumber: 'A'.repeat(41) }, 'INVALID_LICENSE_NUMBER'],
    ['a blank registration number', { licenseNumber: '   ' }, 'INVALID_LICENSE_NUMBER'],
    ['a specialty of 81 characters', { specialty: 'E'.repeat(81) }, 'INVALID_SPECIALTY'],
    ['an empty specialty', { specialty: '' }, 'INVALID_SPECIALTY'],
    ['a malformed e-mail', { email: 'ana' }, 'INVALID_EMAIL'],
    ['a name that is too short', { fullName: 'An' }, 'INVALID_FULL_NAME'],
  ])('rejects %s without calling the repository', async (_label, patch, code) => {
    const { register, registrations, tokenStore } = setup();

    await expect(register({ ...INPUT, ...patch })).rejects.toMatchObject({ kind: 'validation', code });

    expect(registrations.registerProfessional).not.toHaveBeenCalled();
    expect(tokenStore.read()).toBeNull();
  });

  it('accepts a registration number of exactly 40 characters', async () => {
    const { register, registrations } = setup();

    await register({ ...INPUT, licenseNumber: 'A'.repeat(40) });

    expect(registrations.registerProfessional).toHaveBeenCalledTimes(1);
  });
});
