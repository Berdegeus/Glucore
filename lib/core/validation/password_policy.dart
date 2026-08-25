import '../../l10n/l10n.dart';

/// Rule violated by a candidate password, in the order the policy checks them.
enum PasswordPolicyError {
  tooShort,
  missingUppercase,
  missingLowercase,
  missingDigit,
  missingSpecial,
}

/// Single source of truth for password strength in the app.
///
/// Mirrors `backend/src/lib/passwordPolicy.ts`. Both sides are tested against
/// the same case table (design.md), so a divergence shows up as a red test.
/// Applies only where a password is *defined* (register, reset by token,
/// profile change): login validates "not empty" so legacy weak passwords can
/// still sign in.
class PasswordPolicy {
  const PasswordPolicy._();

  static const int minLength = 8;

  /// Returns `null` when [password] satisfies every rule, or the first rule
  /// it violates.
  static PasswordPolicyError? validate(String password) {
    if (password.length < minLength) {
      return PasswordPolicyError.tooShort;
    }
    if (!password.contains(RegExp(r'[A-Z]'))) {
      return PasswordPolicyError.missingUppercase;
    }
    if (!password.contains(RegExp(r'[a-z]'))) {
      return PasswordPolicyError.missingLowercase;
    }
    if (!password.contains(RegExp(r'[0-9]'))) {
      return PasswordPolicyError.missingDigit;
    }
    if (!password.contains(RegExp(r'[^A-Za-z0-9]'))) {
      return PasswordPolicyError.missingSpecial;
    }
    return null;
  }
}

/// Localized message for a violated password rule.
String passwordPolicyMessage(AppLocalizations l10n, PasswordPolicyError error) {
  switch (error) {
    case PasswordPolicyError.tooShort:
      return l10n.passwordPolicyMinLengthError;
    case PasswordPolicyError.missingUppercase:
      return l10n.passwordPolicyUppercaseError;
    case PasswordPolicyError.missingLowercase:
      return l10n.passwordPolicyLowercaseError;
    case PasswordPolicyError.missingDigit:
      return l10n.passwordPolicyDigitError;
    case PasswordPolicyError.missingSpecial:
      return l10n.passwordPolicySpecialError;
  }
}
