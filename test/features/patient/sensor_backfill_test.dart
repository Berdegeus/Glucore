import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/domain/entities/glucose_reading_item.dart';
import 'package:glucore/features/patient/domain/sensor_backfill.dart';

void main() {
  final base = DateTime(2026, 10, 9, 23, 0);

  GlucoseReadingItem reading(DateTime t, [double value = 100]) => GlucoseReadingItem(
        value: value,
        timestamp: t,
        trend: GlucoseTrend.stable,
        rate: 0,
      );

  List<GlucoseReadingItem> minutes(int from, int to, {int seconds = 0, double value = 100}) => [
        for (var m = from; m <= to; m++)
          reading(base.add(Duration(minutes: m, seconds: seconds)), value),
      ];

  test('fills the minutes an outage left empty', () {
    final existing = [...minutes(10, 10), ...minutes(14, 15)].reversed.toList();
    final stored = minutes(10, 15, value: 120);

    final merged = mergeStoredReadings(existing: existing, stored: stored);

    final times = merged.map((r) => r.timestamp.minute).toList();
    expect(times, [15, 14, 13, 12, 11, 10]);
  });

  test('never alters an existing reading, even when the stored value differs', () {
    final existing = [reading(base, 111)];
    final merged = mergeStoredReadings(
      existing: existing,
      stored: [reading(base, 999), reading(base.add(const Duration(minutes: 1)), 120)],
    );
    expect(merged.firstWhere((r) => r.timestamp == base).value, 111);
    expect(merged.length, 2);
  });

  test('a live reading at :17 covers its own minute but not the next one', () {
    final existing = [reading(base.add(const Duration(seconds: 17)))];
    final stored = [reading(base), reading(base.add(const Duration(minutes: 1)))];

    final merged = mergeStoredReadings(existing: existing, stored: stored);

    expect(merged.length, 2);
    expect(merged.map((r) => r.timestamp).toSet(), {
      base.add(const Duration(seconds: 17)),
      base.add(const Duration(minutes: 1)),
    });
  });

  test('tolerance is exclusive: exactly 30 s away still inserts', () {
    final existing = [reading(base.add(const Duration(seconds: 30)))];
    final merged = mergeStoredReadings(existing: existing, stored: [reading(base)]);
    expect(merged.length, 2);
  });

  test('returns the very same list when there is nothing to insert', () {
    final existing = minutes(0, 5).reversed.toList();
    final merged = mergeStoredReadings(existing: existing, stored: minutes(0, 5));
    expect(identical(merged, existing), isTrue);
  });

  test('no stored readings leaves the list untouched', () {
    final existing = minutes(0, 2).reversed.toList();
    expect(identical(mergeStoredReadings(existing: existing, stored: const []), existing), isTrue);
  });

  test('result is newest first', () {
    final merged = mergeStoredReadings(existing: [reading(base)], stored: minutes(1, 4));
    final times = merged.map((r) => r.timestamp).toList();
    expect(times, [...times]..sort((a, b) => b.compareTo(a)));
  });

  test('candidates that overlap each other are inserted once', () {
    final stored = [reading(base), reading(base.add(const Duration(seconds: 10)))];
    final merged = mergeStoredReadings(existing: const [], stored: stored);
    expect(merged.length, 1);
  });

  test('respects the retention window counted from the newest reading', () {
    final newest = base.add(const Duration(days: 20));
    final existing = [reading(newest)];
    final merged = mergeStoredReadings(
      existing: existing,
      stored: [reading(base), reading(newest.subtract(const Duration(days: 1)))],
    );
    expect(merged.map((r) => r.timestamp), contains(newest.subtract(const Duration(days: 1))));
    expect(merged.map((r) => r.timestamp), isNot(contains(base)));
  });

  test('handles two weeks of minutes quickly', () {
    final stored = minutes(0, 14 * 24 * 60);
    final watch = Stopwatch()..start();
    final merged = mergeStoredReadings(existing: [reading(base)], stored: stored);
    watch.stop();
    expect(merged.length, stored.length);
    expect(watch.elapsedMilliseconds, lessThan(2000));
  });

  group('SensorBackfillWindow', () {
    test('default is 48 h', () {
      expect(SensorBackfillWindow.defaultWindow, SensorBackfillWindow.h48);
    });

    test('unknown or missing wire names fall back to the default', () {
      expect(SensorBackfillWindow.fromWireName(null), SensorBackfillWindow.h48);
      expect(SensorBackfillWindow.fromWireName('bogus'), SensorBackfillWindow.h48);
      expect(SensorBackfillWindow.fromWireName('d7'), SensorBackfillWindow.d7);
    });

    test('no window is longer than the retention', () {
      for (final w in SensorBackfillWindow.values) {
        expect(w.duration <= const Duration(days: 14), isTrue, reason: w.name);
      }
    });

    test('wire names round-trip', () {
      for (final w in SensorBackfillWindow.values) {
        expect(SensorBackfillWindow.fromWireName(w.wireName), w);
      }
    });
  });
}
