import 'package:intl/intl.dart';

/// Unit used to show and enter glucose values.
///
/// Everything stored, synced and exchanged with the sensor stays in mg/dL;
/// the unit only changes how a value is displayed and typed.
enum GlucoseUnit {
  mgDl('mg/dL'),
  mmolL('mmol/L');

  const GlucoseUnit(this.label);

  final String label;

  /// 1 mmol/L of glucose = 18.0182 mg/dL.
  static const double mgDlPerMmolL = 18.0182;

  double fromMgDl(double mgDl) =>
      this == mmolL ? mgDl / mgDlPerMmolL : mgDl;

  double toMgDl(double value) => this == mmolL ? value * mgDlPerMmolL : value;

  /// Number only (no unit), with the decimals the unit needs: whole numbers
  /// for mg/dL, one decimal for mmol/L, using [locale]'s decimal separator.
  String format(double mgDl, {String? locale}) {
    final value = fromMgDl(mgDl);
    return this == mmolL
        ? NumberFormat('0.0', locale).format(value)
        : value.round().toString();
  }

  String formatWithUnit(double mgDl, {String? locale}) =>
      '${format(mgDl, locale: locale)} $label';

  /// Reads a user-typed value in this unit and returns it in mg/dL. Accepts
  /// `,` or `.` as decimal separator. Null when it is not a positive number.
  double? parseToMgDl(String text) {
    final value = double.tryParse(text.trim().replaceAll(',', '.'));
    if (value == null || value <= 0) return null;
    return toMgDl(value);
  }

  static GlucoseUnit fromName(String? name) =>
      GlucoseUnit.values.firstWhere(
        (u) => u.name == name,
        orElse: () => GlucoseUnit.mgDl,
      );
}

/// Range typed as "min-max" in [unit], returned in whole mg/dL.
({int min, int max})? parseGlucoseRange(String text, GlucoseUnit unit) {
  final parts = text.trim().split(RegExp(r'\s*[-–]\s*'));
  if (parts.length != 2) return null;
  final min = unit.parseToMgDl(parts[0]);
  final max = unit.parseToMgDl(parts[1]);
  if (min == null || max == null) return null;
  final lo = min.round();
  final hi = max.round();
  return lo < hi ? (min: lo, max: hi) : null;
}

/// Inverse of [parseGlucoseRange], e.g. `80-180` or `4.4-10.0`.
String formatGlucoseRange(int min, int max, GlucoseUnit unit,
    {String? locale}) {
  return '${unit.format(min.toDouble(), locale: locale)}-'
      '${unit.format(max.toDouble(), locale: locale)}';
}
