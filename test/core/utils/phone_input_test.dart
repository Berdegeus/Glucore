import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/utils/phone_input.dart';

/// Spec: TCC-08 / spec.md "P2: Telefone com máscara" — the field masks input as
/// `(00) 00000-0000`, only digits reach the backend, and a ten digit number
/// received from the backend renders as `(00) 0000-0000` (listed edge case).

/// Types [input] one character at a time through [formatter], the way the text
/// field feeds it, and returns the resulting text.
String _typeThrough(String input) {
  const formatter = BrazilianPhoneInputFormatter();
  var value = TextEditingValue.empty;
  for (final char in input.split('')) {
    final typed = TextEditingValue(
      text: '${value.text}$char',
      selection: TextSelection.collapsed(offset: value.text.length + 1),
    );
    value = formatter.formatEditUpdate(value, typed);
  }
  return value.text;
}

void main() {
  group('BrazilianPhoneInputFormatter', () {
    // Spec-precision gap: the spec fixes the two complete shapes
    // (`(00) 00000-0000` and, for ten digits, `(00) 0000-0000`) but says
    // nothing about where the separator sits at seven to nine digits, while
    // mobile and landline are still indistinguishable. Only the states the
    // spec determines are asserted here.
    test('formats progressively while the user types', () {
      expect(_typeThrough('1'), '(1');
      expect(_typeThrough('11'), '(11');
      expect(_typeThrough('119'), '(11) 9');
      expect(_typeThrough('1134567890'), '(11) 3456-7890');
      expect(_typeThrough('11987654321'), '(11) 98765-4321');
    });

    test('discards characters that are not digits', () {
      expect(_typeThrough('a1b1c98765x4321'), '(11) 98765-4321');
    });

    test('drops digits typed beyond the eleventh', () {
      expect(_typeThrough('119876543219999'), '(11) 98765-4321');
    });
  });

  group('formatBrazilianPhone', () {
    test('renders an eleven digit number as (11) 98765-4321', () {
      expect(formatBrazilianPhone('11987654321'), '(11) 98765-4321');
    });

    test('renders a ten digit number as (11) 3456-7890', () {
      expect(formatBrazilianPhone('1134567890'), '(11) 3456-7890');
    });

    test('renders an empty value as an empty string', () {
      expect(formatBrazilianPhone(''), '');
    });

    test('renders an already formatted value unchanged', () {
      expect(formatBrazilianPhone('(11) 98765-4321'), '(11) 98765-4321');
    });
  });

  group('phoneDigitsOnly', () {
    test('strips the mask so only digits are sent to the backend', () {
      expect(phoneDigitsOnly('(11) 98765-4321'), '11987654321');
    });

    test('returns an empty string for an empty value', () {
      expect(phoneDigitsOnly(''), '');
    });
  });
}
