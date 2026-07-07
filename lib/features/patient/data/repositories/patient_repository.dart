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
  })  : _local = local,
        _remote = remote,
        _syncService = syncService;

  final LocalPatientDataSource _local;
  final PatientDataSource _remote;
  final PatientSyncService _syncService;

  static const maxReadings = 288;
  static const maxAlerts = 100;
  static const maxEntries = 100;

  Future<PatientSnapshot> load() => _local.load();

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
