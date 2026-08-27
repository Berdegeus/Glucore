import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/presentation/models/patient_models.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

class _FakeRemote implements PatientDataSource {
  final savedReadings = <List<GlucoseReadingItem>>[];
  final savedAlerts = <List<AppAlertItem>>[];
  final savedCarbs = <List<CarbEntry>>[];
  final savedInsulin = <List<InsulinEntry>>[];
  final savedSettings = <AlertSettingsModel>[];
  int failuresRemaining = 0;

  void _maybeFail() {
    if (failuresRemaining > 0) {
      failuresRemaining--;
      throw Exception('network down');
    }
  }

  @override
  Future<PatientSnapshot> load() => throw UnimplementedError();

  @override
  Future<void> saveReadings(List<GlucoseReadingItem> readings) async {
    _maybeFail();
    savedReadings.add(readings);
  }

  @override
  Future<void> saveAlerts(List<AppAlertItem> alerts) async {
    _maybeFail();
    savedAlerts.add(alerts);
  }

  @override
  Future<void> saveCarbs(List<CarbEntry> carbs) async {
    _maybeFail();
    savedCarbs.add(carbs);
  }

  @override
  Future<void> saveInsulin(List<InsulinEntry> insulin) async {
    _maybeFail();
    savedInsulin.add(insulin);
  }

  @override
  Future<void> saveAlertSettings(AlertSettingsModel settings) async {
    _maybeFail();
    savedSettings.add(settings);
  }
}

void main() {
  sqfliteFfiInit();

  late LocalPatientDataSource local;
  late _FakeRemote remote;
  late PatientSyncService service;

  setUp(() {
    local = LocalPatientDataSource(
      databaseFactory: databaseFactoryFfi,
      databasePath: inMemoryDatabasePath,
    );
    remote = _FakeRemote();
    service = PatientSyncService(
      local: local,
      remote: remote,
      connectivityChanges: const Stream<List<ConnectivityResult>>.empty(),
      debounce: const Duration(milliseconds: 10),
      retryDelays: const [Duration.zero],
    );
  });

  tearDown(() async {
    service.dispose();
    await local.close();
  });

  final entryTime = DateTime.fromMillisecondsSinceEpoch(1000000);

  test('pushNow sends pending collections to remote and clears flags',
      () async {
    await local.saveCarbs([
      CarbEntry.create(grams: 25, description: 'Café', time: entryTime),
    ]);
    await local.saveAlertSettings(
      const AlertSettingsModel(lowThreshold: 70, highThreshold: 200),
    );

    final pushed = await service.pushNow();

    expect(pushed, isTrue);
    expect(remote.savedCarbs, hasLength(1));
    expect(remote.savedCarbs.single.single.description, 'Café');
    expect(remote.savedSettings, hasLength(1));
    // Coleções sem pendência não são enviadas.
    expect(remote.savedReadings, isEmpty);
    expect(remote.savedAlerts, isEmpty);
    expect(remote.savedInsulin, isEmpty);
    expect(await local.pendingCollections(), isEmpty);
  });

  test('pushNow is a no-op when nothing is pending', () async {
    final pushed = await service.pushNow();
    expect(pushed, isTrue);
    expect(remote.savedCarbs, isEmpty);
    expect(remote.savedSettings, isEmpty);
  });

  test('failing remote keeps rows pending and pushNow reports false',
      () async {
    remote.failuresRemaining = 2; // esgota a tentativa inicial + retry
    await local.saveCarbs([
      CarbEntry.create(grams: 25, description: 'Café', time: entryTime),
    ]);

    final pushed = await service.pushNow();

    expect(pushed, isFalse);
    expect(await local.pendingCollections(), {PatientCollection.carbs});

    // Rede volta: retry com sucesso empurra e limpa a pendência.
    final retried = await service.pushNow();
    expect(retried, isTrue);
    expect(remote.savedCarbs, hasLength(1));
    expect(await local.pendingCollections(), isEmpty);
  });

  test('transient failure is retried within the same pushNow', () async {
    remote.failuresRemaining = 1; // primeira tentativa falha, retry passa
    await local.saveCarbs([
      CarbEntry.create(grams: 25, description: 'Café', time: entryTime),
    ]);

    final pushed = await service.pushNow();

    expect(pushed, isTrue);
    expect(remote.savedCarbs, hasLength(1));
    expect(await local.pendingCollections(), isEmpty);
  });

  test('schedulePush debounces bursts into a single push', () async {
    await local.saveCarbs([
      CarbEntry.create(grams: 25, description: 'Café', time: entryTime),
    ]);

    service.schedulePush();
    service.schedulePush();
    service.schedulePush();

    await Future<void>.delayed(const Duration(milliseconds: 100));

    expect(remote.savedCarbs, hasLength(1));
    expect(await local.pendingCollections(), isEmpty);
  });
}
