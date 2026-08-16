import 'package:flutter/services.dart';

/// Digits of [value], with every other character discarded.
///
/// The backend stores and returns phone numbers as bare digits, so this is what
/// the app sends.
String phoneDigitsOnly(String value) => value.replaceAll(RegExp(r'\D'), '');

/// Formats [value] as a Brazilian phone number, progressively.
///
/// Eleven digits render as `(11) 98765-4321` and ten digits as `(11) 3456-7890`;
/// anything shorter renders as far as the digits go. Non-digits are discarded
/// and digits beyond the eleventh are dropped.
String formatBrazilianPhone(String value) {
  final digits = phoneDigitsOnly(value);
  final clipped = digits.length > 11 ? digits.substring(0, 11) : digits;
  if (clipped.isEmpty) return '';

  final dashAt = clipped.length > 10 ? 7 : 6;
  final buffer = StringBuffer('(');
  for (var i = 0; i < clipped.length; i++) {
    if (i == 2) buffer.write(') ');
    if (i == dashAt) buffer.write('-');
    buffer.write(clipped[i]);
  }
  return buffer.toString();
}

/// Applies [formatBrazilianPhone] while the user types.
class BrazilianPhoneInputFormatter extends TextInputFormatter {
  const BrazilianPhoneInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final text = formatBrazilianPhone(newValue.text);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
