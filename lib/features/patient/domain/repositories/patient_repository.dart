import '../entities/patient_entities.dart';

/// Contrato do repositório do paciente (DOMAIN-02).
///
/// A implementação offline-first vive em
/// `data/repositories/patient_repository_impl.dart`; o domínio só declara o que
/// as camadas de cima podem pedir.
abstract class PatientRepository {
  /// Teto do buffer de leituras mantido em memória e no banco local.
  static const maxReadings = 288;

  /// Teto da lista de alertas.
  static const maxAlerts = 100;

  /// Snapshot local — nunca depende de rede.
  Future<PatientSnapshot> load();

  /// Amarra o banco local ao usuário autenticado (P19).
  ///
  /// Devolve `true` quando uma conta DIFERENTE está logada: os dados locais
  /// foram apagados e o chamador precisa limpar também a sessão do sensor.
  Future<bool> ensureOwner();

  Future<void> saveReadings(List<GlucoseReadingItem> readings);

  Future<void> saveAlerts(List<AppAlertItem> alerts);

  Future<void> saveCarbs(List<CarbEntry> carbs);

  Future<void> saveInsulin(List<InsulinEntry> insulin);

  // ── escritas por entrada (SYNC-01) ────────────────────────────────────────

  Future<void> addCarb(CarbEntry entry);

  Future<void> updateCarb(CarbEntry entry);

  Future<void> removeCarb(String id);

  Future<void> addInsulin(InsulinEntry entry);

  Future<void> updateInsulin(InsulinEntry entry);

  Future<void> removeInsulin(String id);

  /// Alerta é gerado pelo app e nunca editado nem apagado pelo paciente, então
  /// a entidade só tem a operação de criação.
  Future<void> addAlert(AppAlertItem alert);

  Future<void> saveAlertSettings(AlertSettingsModel settings);

  /// Reconciliação com o backend. Sem rede → `null`, silencioso.
  Future<PatientSnapshot?> refreshFromRemote();
}
