import { AppError } from '../../../shared/domain/appError';
import { validatePassword, WEAK_PASSWORD_CODE } from '../../registration';
import { isPlausibleEmail, normalizeEmail, type PasswordRecoveryRepository } from '../domain/passwordRecovery';

export interface PasswordRecoveryUseCases {
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(input: { token: string; password: string }): Promise<void>;
}

/**
 * Both steps check what they can before going out on the network: a bad
 * address, a missing token or a weak password reject with a `validation`
 * error carrying the reason. The password rule is the registration's, the same
 * one the backend and the app apply.
 */
export function createPasswordRecoveryUseCases(deps: { recovery: PasswordRecoveryRepository }): PasswordRecoveryUseCases {
  return {
    async requestPasswordReset(email) {
      const normalized = normalizeEmail(email);
      if (!isPlausibleEmail(normalized)) throw new AppError('validation', { code: 'INVALID_EMAIL' });
      await deps.recovery.requestReset(normalized);
    },
    async resetPassword({ token, password }) {
      if (token.trim() === '') throw new AppError('validation', { code: 'INVALID_TOKEN' });
      if (validatePassword(password) !== null) throw new AppError('validation', { code: WEAK_PASSWORD_CODE });
      await deps.recovery.resetPassword({ token: token.trim(), password });
    },
  };
}
