import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/preferences/app_preferences.dart';
import 'package:glucore/core/preferences/glucose_unit.dart';
import 'package:glucore/core/utils/date_input.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('GlucoseUnit', () {
    test('converts mg/dL to mmol/L and back', () {
      expect(GlucoseUnit.mmolL.fromMgDl(180), closeTo(9.99, 0.01));
      expect(GlucoseUnit.mmolL.toMgDl(5.5), closeTo(99.1, 0.1));
      expect(GlucoseUnit.mgDl.fromMgDl(120), 120);
    });

    test('formats whole mg/dL and one-decimal mmol/L per locale', () {
      expect(GlucoseUnit.mgDl.format(119.6, locale: 'en'), '120');
      expect(GlucoseUnit.mmolL.format(120, locale: 'en'), '6.7');
      expect(GlucoseUnit.mmolL.format(120, locale: 'pt'), '6,7');
      expect(GlucoseUnit.mmolL.formatWithUnit(120, locale: 'en'), '6.7 mmol/L');
    });

    test('parses typed values with comma or dot, rejects junk', () {
      expect(GlucoseUnit.mmolL.parseToMgDl('4,4'), closeTo(79.3, 0.1));
      expect(GlucoseUnit.mmolL.parseToMgDl('4.4'), closeTo(79.3, 0.1));
      expect(GlucoseUnit.mgDl.parseToMgDl('80'), 80);
      expect(GlucoseUnit.mgDl.parseToMgDl('abc'), isNull);
      expect(GlucoseUnit.mgDl.parseToMgDl('0'), isNull);
    });

    test('target range round-trips through mmol/L back to the same mg/dL', () {
      final text = formatGlucoseRange(80, 180, GlucoseUnit.mmolL, locale: 'en');
      expect(text, '4.4-10.0');
      expect(parseGlucoseRange(text, GlucoseUnit.mmolL), (min: 79, max: 180));
      expect(parseGlucoseRange('80 - 180', GlucoseUnit.mgDl), (min: 80, max: 180));
      expect(parseGlucoseRange('180-80', GlucoseUnit.mgDl), isNull);
    });
  });

  group('AppPreferencesCubit', () {
    setUp(() => SharedPreferences.setMockInitialValues({}));

    test('persists locale and unit and restores them', () async {
      final cubit = AppPreferencesCubit();
      await cubit.setLocale(const Locale('en'));
      await cubit.setUnit(GlucoseUnit.mmolL);

      final restored = AppPreferencesCubit();
      await restored.load();
      expect(restored.state.locale, const Locale('en'));
      expect(restored.state.unit, GlucoseUnit.mmolL);

      await restored.setLocale(null);
      final again = AppPreferencesCubit();
      await again.load();
      expect(again.state.locale, isNull);
    });
  });

  group('month-first dates (en)', () {
    test('parse and format honour the order', () {
      expect(usesMonthFirstDates(const Locale('en')), isTrue);
      expect(usesMonthFirstDates(const Locale('pt', 'BR')), isFalse);
      expect(parseBrazilianDate('03/25/1990', monthFirst: true), DateTime(1990, 3, 25));
      expect(parseBrazilianDate('25/03/1990'), DateTime(1990, 3, 25));
      expect(parseBrazilianDate('25/03/1990', monthFirst: true), isNull);
      expect(formatBrazilianDate(DateTime(1990, 3, 25), monthFirst: true), '03/25/1990');
    });
  });
}
