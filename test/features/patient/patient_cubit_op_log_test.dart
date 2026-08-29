import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/api/auth_token_store.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/repositories/patient_repository_impl.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/data/sync/pending_op.dart';
import 'package:glucore/features/patient/presentation/cubit/patient_cubit.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/sensor/domain/events.dart';
import 'package:glucore/features/sensor/domain/models.dart';
import 'package:glucore/features/sensor/domain/sensor_repository.dart';
import 'package:glucore/features/sensor/presentation/cubit/sensor_cubit.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// SYNC-01 e SYNC-10: as mutações de diário do cubit viram operações por
/// entrada; leituras continuam na gravação de coleção.
void main() {
  sqfliteFfiInit();

  late LocalPatientDataSource local;
  late PatientCubit cubit;

  setUp(() {
    local = LocalPatientDataSource(
      databaseFactory: databaseFactoryFfi,
      databasePath: inMemoryDatabasePath,
    );
    final remote = _FakeRemote();
    cubit = PatientCubit(
      repository: PatientRepositoryImpl(
        local: local,
        remote: remote,
        // Sync inerte: o teste olha a fila como o cubit a deixa, sem um push
        // drenando no meio. A drenagem tem os próprios testes.
        syncService: _InertSync(
          local: local,
          remote: remote,
          connectivityChanges: const Stream<List<ConnectivityResult>>.empty(),
        ),
        tokenStore: _FakeTokenStore(),
      ),
    );
  });

  tearDown(() async {
    await cubit.close();
    await local.close();
  });

  final t0 = DateTime.fromMillisecondsSinceEpoch(1700000000000);
  final t1 = DateTime.fromMillisecondsSinceEpoch(1700003600000);

  Future<List<PendingOp>> queue() => local.pendingOps();

  group('SYNC-01: carboidrato', () {
    test('adicionar gera exatamente uma operação de upsert', () async {
      final entry =
          CarbEntry.create(grams: 30, description: 'Lanche', time: t0);

      await cubit.addCarbEntry(entry);

      final queued = await queue();
      expect(queued, hasLength(1));
      expect(queued.single.entity, PendingOpEntity.carbs);
      expect(queued.single.op, PendingOpKind.upsert);
      expect(queued.single.entityId, entry.id);
    });

    test('editar uma entrada gera exatamente uma operação, só da entrada mexida',
        () async {
      final first =
          CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      final second =
          CarbEntry.create(grams: 60, description: 'Jantar', time: t0);
      await cubit.addCarbEntry(first);
      await cubit.addCarbEntry(second);
      for (final op in await queue()) {
        await local.deleteOp(op.seq!); // as criações já subiram
      }

      await cubit.editCarbEntry(first.copyWith(grams: 45, time: t1));

      final queued = await queue();
      expect(queued, hasLength(1));
      expect(queued.single.entityId, first.id);
      expect(queued.single.op, PendingOpKind.upsert);
      // A outra entrada não foi reenviada por tabela.
      expect(queued.where((o) => o.entityId == second.id), isEmpty);
      expect((await local.load()).carbs, hasLength(2));
    });

    test('apagar gera uma operação de delete daquele id', () async {
      final entry =
          CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      await cubit.addCarbEntry(entry);
      for (final op in await queue()) {
        await local.deleteOp(op.seq!);
      }

      await cubit.deleteCarbEntry(entry);

      final queued = await queue();
      expect(queued, hasLength(1));
      expect(queued.single.op, PendingOpKind.delete);
      expect(queued.single.entityId, entry.id);
      expect((await local.load()).carbs, isEmpty);
    });
  });

  group('SYNC-01: insulina', () {
    InsulinEntry entry() => InsulinEntry.create(
          units: 4,
          type: InsulinType.bolus,
          time: t0,
          dayOfWeek: kDaysOfWeek[0],
        );

    test('adicionar, editar e apagar geram uma operação cada', () async {
      final insulin = entry();

      await cubit.addInsulinEntry(insulin);
      await cubit.editInsulinEntry(insulin.copyWith(units: 6));
      await cubit.deleteInsulinEntry(insulin);

      final queued = await queue();
      expect(
        queued.map((o) => '${o.entity}:${o.op}').toList(),
        [
          'insulin:${PendingOpKind.upsert}',
          'insulin:${PendingOpKind.upsert}',
          'insulin:${PendingOpKind.delete}',
        ],
      );
      expect(queued.map((o) => o.entityId).toSet(), {insulin.id});
    });
  });

  group('SYNC-01/SYNC-10: alerta por item, leitura por coleção', () {
    test('um alerta de glicemia baixa é gravado por item com a leitura em lote',
        () async {
      final sensor = _StubSensorCubit(
        SensorUiState(
          status: SensorConnectionStatus.readingAvailable,
          reading: GlucoseReading(value: 55, timestamp: t0, rate: -0.5),
        ),
      );
      addTearDown(sensor.close);

      await cubit.initialize(sensor);

      final alerts = (await local.load()).alerts;
      expect(alerts, hasLength(1));
      expect(alerts.single.type, AppAlertType.glucoseLow);

      final queued = await queue();
      expect(queued, hasLength(1));
      expect(queued.single.entity, PendingOpEntity.alerts);
      expect(queued.single.op, PendingOpKind.upsert);
      expect(queued.single.entityId, alerts.single.id);

      // A leitura foi gravada, e não entrou na fila de operações.
      expect((await local.load()).readings.single.value, 55);
      expect(
        queued.where((o) => o.entity != PendingOpEntity.alerts),
        isEmpty,
      );
    });

    test('leitura dentro da faixa não gera alerta nem operação', () async {
      final sensor = _StubSensorCubit(
        SensorUiState(
          status: SensorConnectionStatus.readingAvailable,
          reading: GlucoseReading(value: 110, timestamp: t0),
        ),
      );
      addTearDown(sensor.close);

      await cubit.initialize(sensor);

      expect((await local.load()).alerts, isEmpty);
      expect(await queue(), isEmpty);
      expect((await local.load()).readings.single.value, 110);
    });
  });
}

/// Sync que nunca empurra nada: isola o cubit da drenagem.
class _InertSync extends PatientSyncService {
  _InertSync({
    required super.local,
    required super.remote,
    required super.connectivityChanges,
  });

  @override
  void schedulePush() {}

  @override
  Future<bool> pushNow() async => false;
}

class _FakeTokenStore extends AuthTokenStore {
  _FakeTokenStore() : super(const FlutterSecureStorage());

  @override
  Future<String?> readUserId() async => null;
}

class _FakeRemote implements PatientRemoteApi {
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

/// Sensor parado no estado pedido: o `PatientCubit` reage a ele em
/// `initialize`.
class _StubSensorCubit extends SensorCubit {
  _StubSensorCubit(SensorUiState initial)
      : super(repository: _FakeSensorRepository()) {
    emit(initial);
  }
}

class _FakeSensorRepository implements SensorRepository {
  @override
  Future<SensorSession?> restoreSession() => throw UnimplementedError();
  @override
  Future<SensorSession?> registerSensor(
    String barcode, {
    SensorBrand brand = SensorBrand.sibionics,
  }) =>
      throw UnimplementedError();
  @override
  Future<void> submitTransmitter(String transmitterBarcode) =>
      throw UnimplementedError();
  @override
  Future<void> startMonitoring() => throw UnimplementedError();
  @override
  Future<void> stopMonitoring() => throw UnimplementedError();
  @override
  Stream<SensorEvent> observeSessionEvents() => const Stream.empty();
  @override
  Future<void> clearSession() => throw UnimplementedError();
  @override
  Future<AbbottLibraryStatus> getAbbottLibraryStatus() =>
      throw UnimplementedError();
  @override
  Future<void> installAbbottLibrary(String path) => throw UnimplementedError();
  @override
  Future<void> startNfcScan() => throw UnimplementedError();
  @override
  Future<void> stopNfcScan() => throw UnimplementedError();
}
