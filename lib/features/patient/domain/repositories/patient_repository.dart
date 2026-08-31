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

  /// Caminho de coleção das leituras, vivo e em uso (SYNC-10): leitura é
  /// append-only, nunca editada pelo paciente, então não entra no op-log.
  Future<void> saveReadings(List<GlucoseReadingItem> readings);

  /// Escritas de coleção do diário. **Sem chamador em `lib/` desde a Fase 4**,
  /// mantidas de propósito — não são código morto:
  ///
  /// - São a metade cliente dos endpoints em lote (`POST /carbs`, `/insulin`,
  ///   `/alerts`), que continuam vivos e marcados deprecated nesta release
  ///   como caminho de rollback do item 4.2 do plano. Removê-las no mesmo
  ///   release que migrou o cliente para o caminho por item deixaria o
  ///   rollback sem cliente.
  /// - `LocalPatientDataSource.save*` é também como os testes semeiam uma
  ///   coleção inteira sem passar pelo op-log.
  ///
  /// Saem junto com os endpoints em lote, quando eles forem removidos. Para
  /// mutação do diário use as escritas por entrada abaixo.
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
