import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthClient } from '../../src/clients/authClient';
import { UpstreamHttpError } from '../../src/clients/errors';
import type { GlucoseClient } from '../../src/clients/glucoseClient';
import { RegisterProfessionalSaga } from '../../src/modules/registerProfessional/registerProfessional.saga';

const input = {
  account: { email: 'pro@example.com', password: 'Str0ng!pass', fullName: 'Dra. Ana', phone: '11999990000' },
  profile: { licenseNumber: 'CRM-123456', specialty: 'Endocrinologia' },
};

let registerProfessional: ReturnType<typeof vi.fn>;
let deleteAccount: ReturnType<typeof vi.fn>;
let createProfessional: ReturnType<typeof vi.fn>;
let saga: RegisterProfessionalSaga;

beforeEach(() => {
  registerProfessional = vi.fn().mockResolvedValue({ userId: 'pro-1', token: 'a-token' });
  deleteAccount = vi.fn().mockResolvedValue(undefined);
  createProfessional = vi.fn().mockResolvedValue({});
  saga = new RegisterProfessionalSaga(
    { registerProfessional, deleteAccount } as unknown as AuthClient,
    { createProfessional } as unknown as GlucoseClient,
  );
});

afterEach(() => vi.restoreAllMocks());

describe('RegisterProfessionalSaga', () => {
  it('creates the account, then the profile for that userId, and returns userId and token', async () => {
    const result = await saga.run(input);

    expect(result).toEqual({ userId: 'pro-1', token: 'a-token' });
    expect(registerProfessional).toHaveBeenCalledWith(input.account);
    expect(createProfessional).toHaveBeenCalledWith('pro-1', input.profile);
    expect(registerProfessional.mock.invocationCallOrder[0]).toBeLessThan(createProfessional.mock.invocationCallOrder[0]);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('never reaches glucose when the account leg fails, and propagates that error', async () => {
    const taken = new UpstreamHttpError(409, 'EMAIL_TAKEN', 'Email already registered');
    registerProfessional.mockRejectedValue(taken);

    await expect(saga.run(input)).rejects.toBe(taken);
    expect(createProfessional).not.toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes the account exactly once when the profile leg fails, and propagates the profile error', async () => {
    const invalid = new UpstreamHttpError(400, 'VALIDATION_ERROR', 'Invalid licenseNumber');
    createProfessional.mockRejectedValue(invalid);

    await expect(saga.run(input)).rejects.toBe(invalid);
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(deleteAccount).toHaveBeenCalledWith('pro-1');
  });

  it('logs saga.compensation_failed and still throws the original error when the compensation fails too', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = new UpstreamHttpError(503, undefined, 'glucose down');
    createProfessional.mockRejectedValue(original);
    deleteAccount.mockRejectedValue(new Error('auth down'));

    await expect(saga.run(input)).rejects.toBe(original);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toContain('saga.compensation_failed userId=pro-1');
  });
});
