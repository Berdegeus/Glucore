import '../../../sensor/domain/models.dart';
import '../../domain/entities/patient_entities.dart';

class PatientState {
  const PatientState({
    this.readings = const <GlucoseReadingItem>[],
    this.alerts = const <AppAlertItem>[],
    this.carbs = const <CarbEntry>[],
    this.insulin = const <InsulinEntry>[],
    this.alertSettings = const AlertSettingsModel(
      lowThreshold: 80,
      highThreshold: 180,
    ),
    this.sensorState = SensorUiState.initial,
  });

  final List<GlucoseReadingItem> readings;
  final List<AppAlertItem> alerts;
  final List<CarbEntry> carbs;
  final List<InsulinEntry> insulin;
  final AlertSettingsModel alertSettings;
  final SensorUiState sensorState;

  GlucoseReadingItem? get currentReading =>
      readings.isEmpty ? null : readings.first;

  bool get hasRecentReading {
    final current = currentReading;
    if (current == null) {
      return false;
    }
    return current.timestamp.isAfter(
      DateTime.now().subtract(const Duration(minutes: 15)),
    );
  }

  bool get predictionAvailable => false;

  PatientState copyWith({
    List<GlucoseReadingItem>? readings,
    List<AppAlertItem>? alerts,
    List<CarbEntry>? carbs,
    List<InsulinEntry>? insulin,
    AlertSettingsModel? alertSettings,
    SensorUiState? sensorState,
  }) {
    return PatientState(
      readings: readings ?? this.readings,
      alerts: alerts ?? this.alerts,
      carbs: carbs ?? this.carbs,
      insulin: insulin ?? this.insulin,
      alertSettings: alertSettings ?? this.alertSettings,
      sensorState: sensorState ?? this.sensorState,
    );
  }
}
