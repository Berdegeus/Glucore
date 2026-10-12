import '../../domain/glucose_bucket.dart';
import '../../domain/entities/patient_entities.dart';

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

/// Sessão recusada pelo backend (401) durante uma operação por item.
///
/// Não é falha recuperável: repetir com o mesmo token dá o mesmo 401. A
/// drenagem para e deixa a fila intacta até a sessão voltar.
class PatientUnauthorizedException implements Exception {
  const PatientUnauthorizedException();

  @override
  String toString() => 'PatientUnauthorizedException: sessão recusada (401)';
}

/// Contrato do lado remoto: as coleções acima mais as operações por item que a
/// drenagem do op-log usa (SYNC-01/SYNC-06).
///
/// `upsert*` é idempotente por desenho — vale como criação e como edição —, e
/// remover algo que o servidor já não tem é sucesso, não erro.
abstract class PatientRemoteApi implements PatientDataSource {
  /// Como [load], mas as leituras só desde [readingsFrom] (inclusive), em
  /// páginas — o delta desde a última sincronização, ou a janela de retenção na
  /// primeira. O diário e os limiares vêm inteiros, como em [load].
  Future<PatientSnapshot> loadSince(DateTime readingsFrom);

  /// `PUT /readings/buckets`: os blocos de 15 min, com a resolução cheia do
  /// aparelho. Idempotente — o servidor só substitui um bloco por outro com ao
  /// menos tantas leituras. No máximo [glucoseBucketPushBatchSize] por chamada.
  Future<void> saveGlucoseBuckets(List<GlucoseBucket> buckets);

  Future<void> upsertCarb(CarbEntry entry);
  Future<void> deleteCarb(String id);
  Future<void> upsertInsulin(InsulinEntry entry);
  Future<void> deleteInsulin(String id);
  Future<void> upsertAlert(AppAlertItem alert);
  Future<void> deleteAlert(String id);
}
