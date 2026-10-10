import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/sensor/domain/models.dart';

void main() {
  final now = DateTime(2026, 10, 9, 12);

  HistorySyncInfo info({DateTime? first, DateTime? latest}) => HistorySyncInfo(
        receivedCount: 10,
        firstTimestamp: first,
        latestTimestamp: latest,
      );

  test('halfway through the backlog is 50%', () {
    final first = now.subtract(const Duration(hours: 10));
    final latest = now.subtract(const Duration(hours: 5));
    expect(info(first: first, latest: latest).progress(now), closeTo(0.5, 0.001));
  });

  test('unknown until both timestamps are present', () {
    expect(info().progress(now), isNull);
    expect(info(first: now.subtract(const Duration(hours: 1))).progress(now), isNull);
  });

  test('never leaves 0..1', () {
    final first = now.subtract(const Duration(hours: 10));
    expect(
      info(first: first, latest: now.add(const Duration(hours: 3))).progress(now),
      1.0,
    );
    expect(
      info(first: first, latest: first.subtract(const Duration(hours: 1))).progress(now),
      0.0,
    );
  });

  test('no span means no estimate', () {
    expect(info(first: now, latest: now).progress(now), isNull);
  });
}
