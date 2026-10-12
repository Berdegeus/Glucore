import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/api/auth_token_store.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/repositories/patient_repository_impl.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/domain/daily_summary.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/domain/reading_decimation.dart';
import 'package:glucore/features/patient/domain/repositories/patient_repository.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// O pull de leituras é incremental: a primeira vez pede a janela de retenção,
/// as seguintes só o que veio depois da marca d'água, e o que o aparelho tem a
/// 1/min nunca é trocado pela versão rala do servidor.
void main() {
  sqfliteFfiInit();

  final now = DateTime.utc(2026, 8, 20, 12);
  final slot0 = DateTime.fromMillisecondsSinceEpoch(
    readingSlotStart(DateTime.utc(2026, 8, 19, 9).millisecondsSinceEpoch),
  );

  late LocalPatientDataSource local;
  late _RecordingRemote remote;
  late PatientSyncService sync;
  late PatientRepositoryImpl repository;

  setUp(() {
    local = LocalPatientDataSource(
      databaseFactory: databaseFactoryFfi,
      databasePath: inMemoryDatabasePath,
    );
    remote = _RecordingRemote();
    sync = PatientSyncService(
      local: local,
      remote: remote,
      connectivityChanges: const Stream<List<ConnectivityResult>>.empty(),
      debounce: const Duration(minutes: 5),
      retryDelays: const [Duration.zero],
      clock: () => now,
    );
    repository = PatientRepositoryImpl(
      local: local,
      remote: remote,
      syncService: sync,
      tokenStore: _NoSessionTokenStore(),
      clock: () => now,
    );
  });

  tearDown(() async {
    sync.dispose();
    await local.close();
  });

  GlucoseReadingItem reading(DateTime time, double value) => GlucoseReadingItem(
        value: value,
        timestamp: time,
        trend: GlucoseTrend.stable,
        rate: 0,
      );

  test('a primeira sincronização pede a janela de retenção inteira', () async {
    await repository.refreshFromRemote();

    expect(remote.askedFrom, [now.subtract(PatientRepository.readingRetention)]);
  });

  test('as seguintes pedem desde a marca d\'água, com folga de 10 min', () async {
    remote.serves = [reading(slot0.add(const Duration(hours: 2)), 100)];
    await repository.refreshFromRemote();

    await repository.refreshFromRemote();

    expect(
      remote.askedFrom.last,
      slot0.add(const Duration(hours: 2)).subtract(const Duration(minutes: 10)),
    );
  });

  test('nunca pede antes da janela de retenção, por mais velha que seja a marca',
      () async {
    final ancient = now.subtract(const Duration(days: 60));
    remote.serves = [reading(ancient, 100)];
    await repository.refreshFromRemote();

    await repository.refreshFromRemote();

    expect(remote.askedFrom.last, now.subtract(PatientRepository.readingRetention));
  });

  test('o que o aparelho tem a 1/min sobrevive a um servidor que só tem 5 min',
      () async {
    final minutes = [
      for (var m = 0; m < 30; m++)
        reading(slot0.add(Duration(minutes: m)), 100.0 + m),
    ];
    await local.saveReadings(minutes);
    await local.markReadingsSynced(minutes);
    // O servidor devolve a versão rala do que este aparelho mandou.
    remote.serves = [
      for (var m = 0; m < 30; m += 5) reading(slot0.add(Duration(minutes: m)), 999),
    ];

    final snapshot = await repository.refreshFromRemote();

    expect(snapshot!.readings, hasLength(30));
    expect(snapshot.readings.any((r) => r.value == 999), isFalse);
  });

  test('o que o servidor tem a mais (outro aparelho) entra', () async {
    await local.saveReadings([reading(slot0, 100)]);
    remote.serves = [
      reading(slot0.add(const Duration(minutes: 5)), 105),
      reading(slot0.add(const Duration(minutes: 10)), 110),
    ];

    final snapshot = await repository.refreshFromRemote();

    expect(snapshot!.readings, hasLength(3));
  });

  test('sem rede o snapshot local continua valendo e a marca d\'água não anda',
      () async {
    remote.serves = [reading(slot0, 100)];
    await repository.refreshFromRemote();
    final watermark = await local.readingsWatermarkMs();
    remote.fails = true;

    final result = await repository.refreshFromRemote();

    expect(result, isNull);
    expect(await local.readingsWatermarkMs(), watermark);
  });
}

class _NoSessionTokenStore extends AuthTokenStore {
  _NoSessionTokenStore() : super(const FlutterSecureStorage());

  @override
  Future<String?> readUserId() async => null;
}

class _RecordingRemote implements PatientRemoteApi {
  List<GlucoseReadingItem> serves = const [];
  final askedFrom = <DateTime>[];
  bool fails = false;

  @override
  Future<void> saveDailySummaries(List<DailySummary> days) async {}

  @override
  Future<PatientSnapshot> loadSince(DateTime readingsFrom) async {
    askedFrom.add(readingsFrom);
    if (fails) throw Exception('offline');
    return PatientSnapshot(
      readings: serves,
      alerts: const [],
      carbs: const [],
      insulin: const [],
      alertSettings:
          const AlertSettingsModel(lowThreshold: 80, highThreshold: 180),
    );
  }

  @override
  Future<PatientSnapshot> load() => throw UnimplementedError();
  @override
  Future<void> saveReadings(List<GlucoseReadingItem> readings) async {}
  @override
  Future<void> saveAlerts(List<AppAlertItem> alerts) async {}
  @override
  Future<void> saveCarbs(List<CarbEntry> carbs) async {}
  @override
  Future<void> saveInsulin(List<InsulinEntry> insulin) async {}
  @override
  Future<void> saveAlertSettings(AlertSettingsModel settings) async {}
  @override
  Future<void> upsertCarb(CarbEntry entry) async {}
  @override
  Future<void> deleteCarb(String id) async {}
  @override
  Future<void> upsertInsulin(InsulinEntry entry) async {}
  @override
  Future<void> deleteInsulin(String id) async {}
  @override
  Future<void> upsertAlert(AppAlertItem alert) async {}
  @override
  Future<void> deleteAlert(String id) async {}
}
