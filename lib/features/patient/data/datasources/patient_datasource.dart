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

/// Contrato do lado remoto: as coleções acima mais as operações por item que a
/// drenagem do op-log usa (SYNC-01/SYNC-06).
///
/// `upsert*` é idempotente por desenho — vale como criação e como edição —, e
/// remover algo que o servidor já não tem é sucesso, não erro.
abstract class PatientRemoteApi implements PatientDataSource {
  Future<void> upsertCarb(CarbEntry entry);
  Future<void> deleteCarb(String id);
  Future<void> upsertInsulin(InsulinEntry entry);
  Future<void> deleteInsulin(String id);
  Future<void> upsertAlert(AppAlertItem alert);
  Future<void> deleteAlert(String id);
}
