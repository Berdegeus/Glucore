import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/validation/password_policy.dart';
import 'package:glucore/l10n/l10n.dart';

/// Spec: TCC-01 / spec.md P1 AC1 — a new password is only accepted with at
/// least 8 characters containing an uppercase letter, a lowercase letter, a
/// digit and a non-alphanumeric character.
///
/// The case table below is the one in design.md ("Tabela de casos da política
/// de senha"); `backend/tests/lib/passwordPolicy.test.ts` asserts the same
/// verdicts so a divergence between app and backend shows up as a red test.
void main() {
  group('PasswordPolicy.validate — design case table', () {
    test('Senha123! is valid (meets all 5 rules)', () {
      expect(PasswordPolicy.validate('Senha123!'), isNull);
    });

    test('Sen1! is rejected for being shorter than 8 characters', () {
      expect(
        PasswordPolicy.validate('Sen1!'),
        PasswordPolicyError.tooShort,
      );
    });

    test('senha123! is rejected for missing an uppercase letter', () {
      expect(
        PasswordPolicy.validate('senha123!'),
        PasswordPolicyError.missingUppercase,
      );
    });

    test('SENHA123! is rejected for missing a lowercase letter', () {
      expect(
        PasswordPolicy.validate('SENHA123!'),
        PasswordPolicyError.missingLowercase,
      );
    });

    test('SenhaSenha! is rejected for missing a digit', () {
      expect(
        PasswordPolicy.validate('SenhaSenha!'),
        PasswordPolicyError.missingDigit,
      );
    });

    test('Senha1234 is rejected for missing a non-alphanumeric character', () {
      expect(
        PasswordPolicy.validate('Senha1234'),
        PasswordPolicyError.missingSpecial,
      );
    });

    test('Senha 123! is valid — a space counts as non-alphanumeric', () {
      expect(PasswordPolicy.validate('Senha 123!'), isNull);
    });

    test('the empty string is rejected for being shorter than 8 characters',
        () {
      expect(
        PasswordPolicy.validate(''),
        PasswordPolicyError.tooShort,
      );
    });
  });

  group('passwordPolicyMessage', () {
    late AppLocalizations l10n;

    setUp(() async {
      l10n = await AppLocalizations.delegate.load(const Locale('pt', 'BR'));
    });

    test('resolves a distinct localized message for every rule', () {
      final messages = {
        for (final error in PasswordPolicyError.values)
          error: passwordPolicyMessage(l10n, error),
      };

      expect(messages[PasswordPolicyError.tooShort],
          l10n.passwordPolicyMinLengthError);
      expect(messages[PasswordPolicyError.missingUppercase],
          l10n.passwordPolicyUppercaseError);
      expect(messages[PasswordPolicyError.missingLowercase],
          l10n.passwordPolicyLowercaseError);
      expect(messages[PasswordPolicyError.missingDigit],
          l10n.passwordPolicyDigitError);
      expect(messages[PasswordPolicyError.missingSpecial],
          l10n.passwordPolicySpecialError);
      expect(
        messages.values.toSet(),
        hasLength(PasswordPolicyError.values.length),
      );
    });
  });
}
