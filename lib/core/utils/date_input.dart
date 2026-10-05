import 'package:flutter/widgets.dart';
import 'package:flutter/services.dart';

/// Month-first (US) order is used for English; everything else is day-first.
bool usesMonthFirstDates(Locale locale) => locale.languageCode == 'en';

DateTime? parseBrazilianDate(String value, {bool monthFirst = false}) {
  final text = value.trim();
  final match = RegExp(r'^(\d{2})/(\d{2})/(\d{4})$').firstMatch(text);
  final compactMatch = RegExp(r'^\d{8}$').firstMatch(text);
  if (match != null || compactMatch != null) {
    final digits = text.replaceAll(RegExp(r'\D'), '');
    final first = int.parse(digits.substring(0, 2));
    final second = int.parse(digits.substring(2, 4));
    return _dateFromParts(
      day: monthFirst ? second : first,
      month: monthFirst ? first : second,
      year: int.parse(digits.substring(4, 8)),
    );
  }

  final isoDate = DateTime.tryParse(text);
  if (isoDate == null) return null;
  return DateTime(isoDate.year, isoDate.month, isoDate.day);
}

DateTime? _dateFromParts({
  required int day,
  required int month,
  required int year,
}) {
  final date = DateTime(year, month, day);
  if (date.year == year && date.month == month && date.day == day) {
    return date;
  }
  return null;
}

String formatBrazilianDate(DateTime date, {bool monthFirst = false}) {
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  final year = date.year.toString().padLeft(4, '0');
  return monthFirst ? '$month/$day/$year' : '$day/$month/$year';
}

String formatIsoDateOnly(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year.toString().padLeft(4, '0')}-$month-$day';
}

class BrazilianDateInputFormatter extends TextInputFormatter {
  const BrazilianDateInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final clipped = digits.length > 8 ? digits.substring(0, 8) : digits;
    final buffer = StringBuffer();

    for (var i = 0; i < clipped.length; i++) {
      if (i == 2 || i == 4) buffer.write('/');
      buffer.write(clipped[i]);
    }

    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
