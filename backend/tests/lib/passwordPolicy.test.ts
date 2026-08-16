import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertStrongPassword,
  isStrongPassword,
  validatePassword,
  WeakPasswordError,
} from '../../src/lib/passwordPolicy.ts';

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
    assert.equal(validatePassword('Senha123!'), null);
  });

  it('Sen1! is rejected for being shorter than 8 characters', () => {
    assert.equal(validatePassword('Sen1!'), 'tooShort');
  });

  it('senha123! is rejected for missing an uppercase letter', () => {
    assert.equal(validatePassword('senha123!'), 'missingUppercase');
  });

  it('SENHA123! is rejected for missing a lowercase letter', () => {
    assert.equal(validatePassword('SENHA123!'), 'missingLowercase');
  });

  it('SenhaSenha! is rejected for missing a digit', () => {
    assert.equal(validatePassword('SenhaSenha!'), 'missingDigit');
  });

  it('Senha1234 is rejected for missing a non-alphanumeric character', () => {
    assert.equal(validatePassword('Senha1234'), 'missingSpecial');
  });

  it('Senha 123! is valid — a space counts as non-alphanumeric', () => {
    assert.equal(validatePassword('Senha 123!'), null);
  });

  it('the empty string is rejected for being shorter than 8 characters', () => {
    assert.equal(validatePassword(''), 'tooShort');
  });
});

describe('isStrongPassword', () => {
  it('is true only for the passwords the design table accepts', () => {
    assert.equal(isStrongPassword('Senha123!'), true);
    assert.equal(isStrongPassword('Senha 123!'), true);
    assert.equal(isStrongPassword('Sen1!'), false);
    assert.equal(isStrongPassword('senha123!'), false);
    assert.equal(isStrongPassword('SENHA123!'), false);
    assert.equal(isStrongPassword('SenhaSenha!'), false);
    assert.equal(isStrongPassword('Senha1234'), false);
    assert.equal(isStrongPassword(''), false);
  });
});

describe('assertStrongPassword', () => {
  it('accepts a password that satisfies the policy', () => {
    assert.doesNotThrow(() => assertStrongPassword('Senha123!'));
  });

  it('throws the WEAK_PASSWORD contract with the violated rule', () => {
    let thrown: unknown;
    try {
      assertStrongPassword('senha123');
    } catch (error) {
      thrown = error;
    }

    assert.ok(thrown instanceof WeakPasswordError);
    assert.equal((thrown as WeakPasswordError).message, 'Weak password');
    assert.equal((thrown as WeakPasswordError).code, 'WEAK_PASSWORD');
    assert.equal((thrown as WeakPasswordError).status, 400);
    assert.equal((thrown as WeakPasswordError).reason, 'missingUppercase');
  });
});
