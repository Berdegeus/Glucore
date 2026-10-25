/** Machine-readable codes of the `validation` error a refused recovery step turns into. */
export type RecoveryProblem = 'INVALID_EMAIL' | 'INVALID_TOKEN';

export interface PasswordRecoveryRepository {
  /** Asks for a reset e-mail. The gateway answers the same whether or not the address has an account. */
  requestReset(email: string): Promise<void>;
  /** Spends the e-mailed token and sets the new password. */
  resetPassword(input: { token: string; password: string }): Promise<void>;
}

export function normalizeEmail(email: string): string {
  return email.trim();
}

/** The same loose check the app makes (`contains('@')`); the backend has the final say. */
export function isPlausibleEmail(email: string): boolean {
  return email.includes('@');
}
