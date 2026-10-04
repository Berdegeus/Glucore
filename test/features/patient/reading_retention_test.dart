import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/domain/repositories/patient_repository.dart';

void main() {
  final newest = DateTime.utc(2026, 10, 4, 16);

  GlucoseReadingItem at(DateTime time) => GlucoseReadingItem(
        value: 100,
        timestamp: time,
        trend: GlucoseTrend.stable,
        rate: 0,
      );

  group('retainRecentReadings', () {
    test('keeps a backfill far larger than the old 288 cap', () {
      // ~11 dias a cada 16 min, o que o sensor de bancada entregou (1.036).
      final backfill = [
        for (var i = 0; i < 1036; i++)
          at(newest.subtract(Duration(minutes: 16 * i))),
      ];

      expect(retainRecentReadings(backfill), hasLength(1036));
    });

    test('drops readings older than the retention window, anchored on the '
        'newest reading', () {
      final inside = at(newest.subtract(const Duration(days: 13, hours: 23)));
      final outside = at(newest.subtract(const Duration(days: 14, minutes: 1)));

      final kept = retainRecentReadings([at(newest), inside, outside]);

      expect(kept.map((r) => r.timestamp), [newest, inside.timestamp]);
    });

    test('the boundary reading (exactly the retention) is kept', () {
      final edge = at(newest.subtract(PatientRepository.readingRetention));

      expect(retainRecentReadings([at(newest), edge]), hasLength(2));
    });

    test('does not depend on the list order or the device clock', () {
      final old = at(newest.subtract(const Duration(days: 30)));

      final kept = retainRecentReadings([old, at(newest)]);

      expect(kept.map((r) => r.timestamp), [newest]);
    });

    test('an empty list stays empty', () {
      expect(retainRecentReadings(const []), isEmpty);
    });
  });
}
