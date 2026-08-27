/**
 * Single source of truth for password strength in the backend.
 *
 * Mirrors `lib/core/validation/password_policy.dart` rule for rule, in the same
 * check order. Both sides are tested against the same case table (design.md),
 * so a divergence shows up as a red test.
 *
 * Applies only where a password is *defined* (register, reset by token, profile
 * change). Login only requires a non-empty password so accounts created before
 * this policy can still sign in.
 */

export type PasswordPolicyError =
  | 'tooShort'
  | 'missingUppercase'
  | 'missingLowercase'
  | 'missingDigit'
  | 'missingSpecial';

export const PASSWORD_MIN_LENGTH = 8;

/** Returns `null` when `password` satisfies every rule, or the first rule it violates. */
export function validatePassword(password: string): PasswordPolicyError | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'tooShort';
  if (!/[A-Z]/.test(password)) return 'missingUppercase';
  if (!/[a-z]/.test(password)) return 'missingLowercase';
  if (!/[0-9]/.test(password)) return 'missingDigit';
  if (!/[^A-Za-z0-9]/.test(password)) return 'missingSpecial';
  return null;
}

export function isStrongPassword(password: string): boolean {
  return validatePassword(password) === null;
}

/** Thrown by `assertStrongPassword`; carries the HTTP contract of spec P1 AC3. */
export class WeakPasswordError extends Error {
  code = 'WEAK_PASSWORD';
  status = 400;
  reason: PasswordPolicyError;

  constructor(reason: PasswordPolicyError) {
    super('Weak password');
    this.name = 'WeakPasswordError';
    this.reason = reason;
  }
}

/** Throws `WeakPasswordError` when `password` violates the policy. */
export function assertStrongPassword(password: string): void {
  const reason = validatePassword(password);
  if (reason !== null) throw new WeakPasswordError(reason);
}
