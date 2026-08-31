import { describe, expect, it } from 'vitest';

import {
  assertStrongPassword,
  isStrongPassword,
  validatePassword,
  WeakPasswordError,
} from '../../src/lib/passwordPolicy';

/**
 * Spec: TCC-01 / spec.md P1 AC1 and AC3 — a new password is only accepted with
 * at least 8 characters containing an uppercase letter, a lowercase letter, a
 * digit and a non-alphanumeric character; a violating request gets
 * `{ error: 'Weak password', code: 'WEAK_PASSWORD' }`.
 *
 * The case table below is the one in design.md ("Tabela de casos da política de
 * senha"); `test/core/validation/password_policy_test.dart` asserts the same
 * verdicts so a divergence between app and backend shows up as a red test.
 */
describe('validatePassword — design case table', () => {
  it('Senha123! is valid (meets all 5 rules)', () => {
    expect(validatePassword('Senha123!')).toBe(null);
  });

  it('Sen1! is rejected for being shorter than 8 characters', () => {
    expect(validatePassword('Sen1!')).toBe('tooShort');
  });

  it('senha123! is rejected for missing an uppercase letter', () => {
    expect(validatePassword('senha123!')).toBe('missingUppercase');
  });

  it('SENHA123! is rejected for missing a lowercase letter', () => {
    expect(validatePassword('SENHA123!')).toBe('missingLowercase');
  });

  it('SenhaSenha! is rejected for missing a digit', () => {
    expect(validatePassword('SenhaSenha!')).toBe('missingDigit');
  });

  it('Senha1234 is rejected for missing a non-alphanumeric character', () => {
    expect(validatePassword('Senha1234')).toBe('missingSpecial');
  });

  it('Senha 123! is valid — a space counts as non-alphanumeric', () => {
    expect(validatePassword('Senha 123!')).toBe(null);
  });

  it('the empty string is rejected for being shorter than 8 characters', () => {
    expect(validatePassword('')).toBe('tooShort');
  });

  it('Senha1! is rejected for being 7 characters — below the minimum', () => {
    expect(validatePassword('Senha1!')).toBe('tooShort');
  });

  it('Senha12! is valid at exactly 8 characters — the minimum boundary', () => {
    expect(validatePassword('Senha12!')).toBe(null);
  });
});

describe('isStrongPassword', () => {
  it('is true only for the passwords the design table accepts', () => {
    expect(isStrongPassword('Senha123!')).toBe(true);
    expect(isStrongPassword('Senha 123!')).toBe(true);
    expect(isStrongPassword('Sen1!')).toBe(false);
    expect(isStrongPassword('senha123!')).toBe(false);
    expect(isStrongPassword('SENHA123!')).toBe(false);
    expect(isStrongPassword('SenhaSenha!')).toBe(false);
    expect(isStrongPassword('Senha1234')).toBe(false);
    expect(isStrongPassword('')).toBe(false);
  });
});

describe('assertStrongPassword', () => {
  it('accepts a password that satisfies the policy', () => {
    expect(() => assertStrongPassword('Senha123!')).not.toThrow();
  });

  it('throws the WEAK_PASSWORD contract with the violated rule', () => {
    let thrown: unknown;
    try {
      assertStrongPassword('senha123');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(WeakPasswordError);
    expect((thrown as WeakPasswordError).message).toBe('Weak password');
    expect((thrown as WeakPasswordError).code).toBe('WEAK_PASSWORD');
    expect((thrown as WeakPasswordError).status).toBe(400);
    expect((thrown as WeakPasswordError).reason).toBe('missingUppercase');
  });
});
