import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/domain/entities/glucose_reading_item.dart';
import 'package:glucore/features/patient/domain/glucose_series.dart';

void main() {
  final t0 = DateTime(2026, 10, 10, 0, 0);

  GlucoseReadingItem reading(int minute, double value, {int second = 0}) =>
      GlucoseReadingItem(
        value: value,
        timestamp: t0.add(Duration(minutes: minute, seconds: second)),
        trend: GlucoseTrend.stable,
        rate: 0,
      );

  List<GlucoseReadingItem> perMinute(int minutes, double Function(int) value) =>
      [for (var m = 0; m < minutes; m++) reading(m, value(m))];

  group('chartBucketMinutes', () {
    test('short windows stay at the raw minute, long ones are thinned', () {
      expect(chartBucketMinutes(1), 1);
      expect(chartBucketMinutes(3), 2);
      expect(chartBucketMinutes(6), 3);
      expect(chartBucketMinutes(12), 5);
      expect(chartBucketMinutes(24), 10);
    });

    test('a window thinned this way plots about the target number of points', () {
      for (final hours in [1, 3, 6, 12, 24]) {
        final points = hours * 60 / chartBucketMinutes(hours);
        expect(points, lessThanOrEqualTo(chartTargetPoints), reason: '${hours}h');
      }
    });
  });

  group('thinForChart', () {
    test('one-minute buckets leave the series untouched', () {
      final series = perMinute(30, (m) => 100.0 + m);
      expect(identical(thinForChart(series, bucketMinutes: 1), series), isTrue);
    });

    test('averages the readings inside each bucket', () {
      final series = perMinute(20, (m) => m < 10 ? 100.0 : 140.0);
      final thinned = thinForChart(series, bucketMinutes: 10);

      expect(thinned, hasLength(2));
      expect(thinned.first.value, 100);
    });

    test('reduces a 24 h one-minute series to a screen-sized number of points', () {
      final series = perMinute(24 * 60, (m) => 120.0 + (m % 7));
      final thinned = thinForChart(series, bucketMinutes: chartBucketMinutes(24));

      expect(thinned.length, lessThanOrEqualTo(chartTargetPoints + 1));
      expect(thinned.length, greaterThan(100));
    });

    test('the newest reading is kept exactly, not averaged away', () {
      final series = perMinute(30, (m) => m == 29 ? 200.0 : 100.0);
      final thinned = thinForChart(series, bucketMinutes: 10);

      expect(thinned.last.value, 200);
      expect(thinned.last.timestamp, series.last.timestamp);
    });

    test('stays in chronological order', () {
      final series = perMinute(120, (m) => 100.0 + (m % 13));
      final thinned = thinForChart(series, bucketMinutes: 5);

      for (var i = 1; i < thinned.length; i++) {
        expect(thinned[i].timestamp.isAfter(thinned[i - 1].timestamp), isTrue);
      }
    });

    test('a sustained excursion survives the thinning', () {
      final series = perMinute(120, (m) => m >= 40 && m < 70 ? 260.0 : 110.0);
      final thinned = thinForChart(series, bucketMinutes: 5);

      expect(thinned.map((r) => r.value).reduce((a, b) => a > b ? a : b), 260);
    });

    test('never returns fewer than two points', () {
      final series = [reading(0, 100), reading(1, 110), reading(2, 120)];
      final thinned = thinForChart(series, bucketMinutes: 60);

      expect(thinned.length, greaterThanOrEqualTo(2));
    });

    test('too short a series is returned as it is', () {
      final series = [reading(0, 100), reading(5, 110)];
      expect(identical(thinForChart(series, bucketMinutes: 10), series), isTrue);
    });

    test('keeps the trend and alarm of the last reading in each bucket', () {
      final series = [
        reading(0, 100),
        reading(1, 100),
        GlucoseReadingItem(
          value: 100,
          timestamp: t0.add(const Duration(minutes: 2)),
          trend: GlucoseTrend.rising,
          rate: 1.3,
          alarmCode: 3,
        ),
        reading(10, 100),
        reading(11, 100),
        reading(12, 100),
      ];
      final thinned = thinForChart(series, bucketMinutes: 10);

      expect(thinned.first.trend, GlucoseTrend.rising);
      expect(thinned.first.alarmCode, 3);
    });
  });
}
