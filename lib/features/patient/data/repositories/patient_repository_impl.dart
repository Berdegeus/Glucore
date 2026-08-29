import '../../../../core/api/auth_token_store.dart';
import '../../domain/entities/patient_entities.dart';
import '../../domain/repositories/patient_repository.dart';
import '../datasources/patient_datasource.dart';
import '../datasources/patient_local_datasource.dart';
import '../sync/patient_sync_service.dart';

/// Implementação offline-first do [PatientRepository].
///
/// Escrita: local primeiro (aguardada), depois `schedulePush()` em background.
/// Leitura: `load()` devolve o snapshot LOCAL; `refreshFromRemote()` reconcilia
/// com o backend quando há rede (push das pendências antes do pull).
class PatientRepositoryImpl implements PatientRepository {
  const PatientRepositoryImpl({
    required LocalPatientDataSource local,
    required PatientDataSource remote,
    required PatientSyncService syncService,
    required AuthTokenStore tokenStore,
  })  : _local = local,
        _remote = remote,
        _syncService = syncService,
        _tokenStore = tokenStore;

  final LocalPatientDataSource _local;
  final PatientDataSource _remote;
  final PatientSyncService _syncService;
  final AuthTokenStore _tokenStore;

  @override
  Future<PatientSnapshot> load() => _local.load();

  /// Binds the local database to the currently authenticated user (P19).
  ///
  /// Returns true when a DIFFERENT account is now logged in: the local patient
  /// data was wiped and the caller must also clear the sensor session so a
  /// previous patient's readings never land in the new account.
  @override
  Future<bool> ensureOwner() async {
    final current = await _tokenStore.readUserId();
    if (current == null) return false;
    final owner = await _local.getOwner();
    if (owner == null) {
      await _local.setOwner(current);
      return false;
    }
    if (owner != current) {
      await _local.wipeAllData();
      await _local.setOwner(current);
      return true;
    }
    return false;
  }

  @override
  Future<void> saveReadings(List<GlucoseReadingItem> readings) async {
    await _local.saveReadings(
      readings.take(PatientRepository.maxReadings).toList(),
    );
    _syncService.schedulePush();
  }

  @override
  Future<void> saveAlerts(List<AppAlertItem> alerts) async {
    await _local.saveAlerts(alerts.take(PatientRepository.maxAlerts).toList());
    _syncService.schedulePush();
  }

  /// O diário não é truncado: cortar em N entradas na gravação local perdia
  /// registro clínico do paciente sem o backend sequer participar (API-03).
  @override
  Future<void> saveCarbs(List<CarbEntry> carbs) async {
    await _local.saveCarbs(carbs);
    _syncService.schedulePush();
  }

  @override
  Future<void> saveInsulin(List<InsulinEntry> insulin) async {
    await _local.saveInsulin(insulin);
    _syncService.schedulePush();
  }

  // ── escritas por entrada (SYNC-01) ────────────────────────────────────────
  //
  // Cada uma grava a linha e enfileira a sua operação, e só então agenda o
  // push. Criar e editar são a mesma chamada porque a operação que viaja é um
  // upsert idempotente (SYNC-06).

  @override
  Future<void> addCarb(CarbEntry entry) => _upsertCarb(entry);

  @override
  Future<void> updateCarb(CarbEntry entry) => _upsertCarb(entry);

  @override
  Future<void> removeCarb(String id) async {
    await _local.deleteCarb(id);
    _syncService.schedulePush();
  }

  @override
  Future<void> addInsulin(InsulinEntry entry) => _upsertInsulin(entry);

  @override
  Future<void> updateInsulin(InsulinEntry entry) => _upsertInsulin(entry);

  @override
  Future<void> removeInsulin(String id) async {
    await _local.deleteInsulin(id);
    _syncService.schedulePush();
  }

  /// Alerta é gerado pelo app e nunca editado nem apagado pelo paciente, então
  /// a entidade só tem a operação de criação.
  @override
  Future<void> addAlert(AppAlertItem alert) async {
    await _local.upsertAlert(alert);
    _syncService.schedulePush();
  }

  Future<void> _upsertCarb(CarbEntry entry) async {
    await _local.upsertCarb(entry);
    _syncService.schedulePush();
  }

  Future<void> _upsertInsulin(InsulinEntry entry) async {
    await _local.upsertInsulin(entry);
    _syncService.schedulePush();
  }

  @override
  Future<void> saveAlertSettings(AlertSettingsModel settings) async {
    await _local.saveAlertSettings(settings);
    _syncService.schedulePush();
  }

  /// Reconciliação com o backend: empurra pendências, baixa o snapshot remoto,
  /// persiste localmente (`synced = 1`, preservando pendências que restarem) e
  /// devolve o snapshot local resultante. Sem rede → `null`, silencioso.
  @override
  Future<PatientSnapshot?> refreshFromRemote() async {
    try {
      final pushed = await _syncService.pushNow();
      if (!pushed) {
        return null;
      }
      final remoteSnapshot = await _remote.load();
      await _local.replaceWithServerSnapshot(remoteSnapshot);
      return await _local.load();
    } catch (_) {
      // Offline ou backend indisponível: o snapshot local continua valendo.
      return null;
    }
  }
}
