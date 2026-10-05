// The password rule of the whole product (REG-02, AD-001). It mirrors
// `lib/core/validation/password_policy.dart` and
// `backend/services/auth-service/src/lib/passwordPolicy.ts` rule for rule, in the
// same check order, and all three are tested against the same case table
// (`.specs/features/checklist-tcc-compliance/design.md`).

export type PasswordPolicyError =
  | 'tooShort'
  | 'missingUppercase'
  | 'missingLowercase'
  | 'missingDigit'
  | 'missingSpecial';

export const PASSWORD_MIN_LENGTH = 8;

/** The rule as the person reads it, under the password field (same text as the app). */
export const PASSWORD_POLICY_HINT = 'Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial';

/** Machine-readable code of the `validation` error a weak password turns into (REG-02). */
export const WEAK_PASSWORD_CODE = 'WEAK_PASSWORD';

/** `null` when `password` satisfies every rule, or the first rule it violates. */
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
