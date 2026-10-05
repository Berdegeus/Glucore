import { describe, expect, it } from 'vitest';
import {
  isStrongPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HINT,
  validatePassword,
  type PasswordPolicyError,
} from './passwordPolicy';

// The case table of AD-001, shared with the app and the backend tests.
const CASES: Array<[string, string, PasswordPolicyError | null]> = [
  ['meets all five rules', 'Senha123!', null],
  ['has less than 8 characters', 'Sen1!', 'tooShort'],
  ['has no uppercase letter', 'senha123!', 'missingUppercase'],
  ['has no lowercase letter', 'SENHA123!', 'missingLowercase'],
  ['has no digit', 'SenhaSenha!', 'missingDigit'],
  ['has no special character', 'Senha1234', 'missingSpecial'],
  ['counts a space as a special character', 'Senha 123!', null],
  ['is empty', '', 'tooShort'],
  ['has 7 characters, just below the minimum', 'Senha1!', 'tooShort'],
  ['has exactly 8 characters', 'Senha12!', null],
];

describe('validatePassword (REG-02)', () => {
  it.each(CASES)('a password that %s', (_label, password, expected) => {
    expect(validatePassword(password)).toBe(expected);
    expect(isStrongPassword(password)).toBe(expected === null);
  });

  it('reports the first violated rule, in the order of the policy', () => {
    expect(validatePassword('abc')).toBe('tooShort');
    expect(validatePassword('abcdefgh')).toBe('missingUppercase');
    expect(validatePassword('ABCDEFGH')).toBe('missingLowercase');
  });

  it('keeps the minimum at 8 and names every rule in the hint', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_POLICY_HINT).toBe('Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial');
  });
});
