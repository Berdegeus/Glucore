import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/presentation/cubit/patient_state.dart';
import 'package:glucore/features/sensor/domain/models.dart';

void main() {
  GlucoseReadingItem reading(Duration age) => GlucoseReadingItem(
        value: 110,
        timestamp: DateTime.now().subtract(age),
        trend: GlucoseTrend.stable,
        rate: 0,
      );

  PatientState state(Duration age, SensorConnectionStatus status) => PatientState(
        readings: [reading(age)],
        sensorState: SensorUiState(status: status),
      );

  test('recent reading with a linked sensor is live', () {
    expect(
      state(const Duration(minutes: 1), SensorConnectionStatus.readingAvailable)
          .isReadingLive,
      isTrue,
    );
  });

  test('old reading is not live even with a linked sensor', () {
    expect(
      state(const Duration(minutes: 22), SensorConnectionStatus.readingAvailable)
          .isReadingLive,
      isFalse,
    );
  });

  test('recent reading is not live once the sensor is gone', () {
    for (final status in [
      SensorConnectionStatus.idle,
      SensorConnectionStatus.scanning,
      SensorConnectionStatus.connecting,
      SensorConnectionStatus.disconnected,
      SensorConnectionStatus.error,
    ]) {
      expect(state(const Duration(minutes: 1), status).isReadingLive, isFalse,
          reason: '$status');
    }
  });

  test('history sync and warm-up count as linked', () {
    for (final status in [
      SensorConnectionStatus.connected,
      SensorConnectionStatus.syncingHistory,
      SensorConnectionStatus.warmingUp,
    ]) {
      expect(state(const Duration(minutes: 1), status).isSensorLinked, isTrue,
          reason: '$status');
    }
  });
}
