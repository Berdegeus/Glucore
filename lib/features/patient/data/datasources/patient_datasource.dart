import '../../presentation/models/patient_models.dart';

/// Snapshot completo dos dados do paciente (todas as coleções + thresholds).
class PatientSnapshot {
  const PatientSnapshot({
    required this.readings,
    required this.alerts,
    required this.carbs,
    required this.insulin,
    required this.alertSettings,
  });

  final List<GlucoseReadingItem> readings;
  final List<AppAlertItem> alerts;
  final List<CarbEntry> carbs;
  final List<InsulinEntry> insulin;
  final AlertSettingsModel alertSettings;
}

/// Contrato comum aos datasources de dados do paciente.
///
/// Implementado por [LocalPatientDataSource] (sqflite, fonte primária) e
/// [RemotePatientDataSource] (Dio, espelho no backend).
abstract class PatientDataSource {
  Future<PatientSnapshot> load();
  Future<void> saveReadings(List<GlucoseReadingItem> readings);
  Future<void> saveAlerts(List<AppAlertItem> alerts);
  Future<void> saveCarbs(List<CarbEntry> carbs);
  Future<void> saveInsulin(List<InsulinEntry> insulin);
  Future<void> saveAlertSettings(AlertSettingsModel settings);
}
