import { describe, expect, it, vi } from 'vitest';
import { isAppError } from '../../../shared/domain/appError';
import { createPasswordRecoveryUseCases } from './passwordRecoveryUseCases';

function setup() {
  const recovery = { requestReset: vi.fn().mockResolvedValue(undefined), resetPassword: vi.fn().mockResolvedValue(undefined) };
  return { recovery, ...createPasswordRecoveryUseCases({ recovery }) };
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(isAppError(error) && error.kind).toBe('validation');
  return isAppError(error) ? error.code : undefined;
}

describe('requestPasswordReset', () => {
  it('trims the address and asks for the e-mail', async () => {
    const { requestPasswordReset, recovery } = setup();
    await requestPasswordReset('  ana@clinica.com ');
    expect(recovery.requestReset).toHaveBeenCalledWith('ana@clinica.com');
  });

  it('rejects an address without @ and sends nothing', async () => {
    const { requestPasswordReset, recovery } = setup();
    expect(await codeOf(requestPasswordReset('ana'))).toBe('INVALID_EMAIL');
    expect(recovery.requestReset).not.toHaveBeenCalled();
  });
});

describe('resetPassword', () => {
  it('sends the trimmed token with a strong password', async () => {
    const { resetPassword, recovery } = setup();
    await resetPassword({ token: ' tok ', password: 'Senha123!' });
    expect(recovery.resetPassword).toHaveBeenCalledWith({ token: 'tok', password: 'Senha123!' });
  });

  it('rejects a missing token and a weak password without going out', async () => {
    const { resetPassword, recovery } = setup();
    expect(await codeOf(resetPassword({ token: ' ', password: 'Senha123!' }))).toBe('INVALID_TOKEN');
    expect(await codeOf(resetPassword({ token: 'tok', password: 'fraca' }))).toBe('WEAK_PASSWORD');
    expect(recovery.resetPassword).not.toHaveBeenCalled();
  });

  it('lets a refused token (the API answers 400) reach the caller', async () => {
    const { resetPassword, recovery } = setup();
    const refusal = new Error('refused');
    recovery.resetPassword.mockRejectedValueOnce(refusal);
    await expect(resetPassword({ token: 'tok', password: 'Senha123!' })).rejects.toBe(refusal);
  });
});
