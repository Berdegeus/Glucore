import '../../../../core/api/auth_token_store.dart';
import '../../presentation/models/patient_models.dart';
import '../datasources/patient_datasource.dart';
import '../datasources/patient_local_datasource.dart';
import '../sync/patient_sync_service.dart';

/// Repositório offline-first dos dados do paciente.
///
/// Escrita: local primeiro (aguardada), depois `schedulePush()` em background.
/// Leitura: `load()` devolve o snapshot LOCAL; `refreshFromRemote()` reconcilia
/// com o backend quando há rede (push das pendências antes do pull).
class PatientRepository {
  const PatientRepository({
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

  static const maxReadings = 288;
  static const maxAlerts = 100;
  static const maxEntries = 100;

  Future<PatientSnapshot> load() => _local.load();

  /// Binds the local database to the currently authenticated user (P19).
  ///
  /// Returns true when a DIFFERENT account is now logged in: the local patient
  /// data was wiped and the caller must also clear the sensor session so a
  /// previous patient's readings never land in the new account.
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

  Future<void> saveReadings(List<GlucoseReadingItem> readings) async {
    await _local.saveReadings(readings.take(maxReadings).toList());
    _syncService.schedulePush();
  }

  Future<void> saveAlerts(List<AppAlertItem> alerts) async {
    await _local.saveAlerts(alerts.take(maxAlerts).toList());
    _syncService.schedulePush();
  }

  Future<void> saveCarbs(List<CarbEntry> carbs) async {
    await _local.saveCarbs(carbs.take(maxEntries).toList());
    _syncService.schedulePush();
  }

  Future<void> saveInsulin(List<InsulinEntry> insulin) async {
    await _local.saveInsulin(insulin.take(maxEntries).toList());
    _syncService.schedulePush();
  }

  Future<void> saveAlertSettings(AlertSettingsModel settings) async {
    await _local.saveAlertSettings(settings);
    _syncService.schedulePush();
  }

  /// Reconciliação com o backend: empurra pendências, baixa o snapshot remoto,
  /// persiste localmente (`synced = 1`, preservando pendências que restarem) e
  /// devolve o snapshot local resultante. Sem rede → `null`, silencioso.
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
