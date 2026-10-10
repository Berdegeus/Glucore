import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/api/auth_token_store.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/repositories/patient_repository_impl.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/domain/sensor_backfill.dart';
import 'package:glucore/features/patient/domain/usecases/patient_usecases.dart';
import 'package:glucore/features/patient/presentation/cubit/patient_cubit.dart';
import 'package:glucore/features/sensor/domain/events.dart';
import 'package:glucore/features/sensor/domain/models.dart';
import 'package:glucore/features/sensor/domain/sensor_repository.dart';
import 'package:glucore/features/sensor/presentation/cubit/sensor_cubit.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// Backfill: o cubit recupera o que a lib do sensor guardou e o app não viu.
void main() {
  sqfliteFfiInit();

  late LocalPatientDataSource local;
  late _FakeSensorRepository sensorRepo;
  late SensorCubit sensorCubit;
  late PatientCubit cubit;
  var window = SensorBackfillWindow.h48;

  final now = DateTime.now();
  DateTime minute(int minutesAgo) => DateTime(
        now.year,
        now.month,
        now.day,
        now.hour,
        now.minute,
      ).subtract(Duration(minutes: minutesAgo));

  StoredSensorReading stored(int minutesAgo, [double value = 120]) =>
      StoredSensorReading(timestamp: minute(minutesAgo), value: value, rate: 1.3);

  setUp(() async {
    window = SensorBackfillWindow.h48;
    local = LocalPatientDataSource(
      databaseFactory: databaseFactoryFfi,
      databasePath: inMemoryDatabasePath,
    );
    final remote = _FakeRemote();
    cubit = PatientCubit(
      useCases: PatientUseCases.fromRepository(PatientRepositoryImpl(
        local: local,
        remote: remote,
        syncService: _InertSync(
          local: local,
          remote: remote,
          connectivityChanges: const Stream<List<ConnectivityResult>>.empty(),
        ),
        tokenStore: _FakeTokenStore(),
      )),
      backfillWindow: () async => window,
    );
    sensorRepo = _FakeSensorRepository();
    sensorCubit = SensorCubit(repository: sensorRepo);
    await cubit.initialize(sensorCubit);
  });

  tearDown(() async {
    await cubit.close();
    await sensorCubit.close();
    await local.close();
  });

  test('inserts the minutes the app lacks and persists them', () async {
    sensorRepo.stored = [stored(5), stored(4), stored(3), stored(2)];

    await cubit.reconcileFromSensorStore();

    expect(cubit.state.readings, hasLength(4));
    expect(cubit.state.readings.first.timestamp, minute(2)); // newest first
    expect(cubit.state.readings.first.value, 120);
    expect(cubit.state.readings.first.rate, 1.3);
    expect(cubit.state.readings.first.trend, GlucoseTrend.rising);
    expect((await local.load()).readings, hasLength(4));
  });

  test('asks the platform only for the chosen window', () async {
    window = SensorBackfillWindow.d7;
    sensorRepo.stored = [stored(5)];

    await cubit.reconcileFromSensorStore();

    final since = sensorRepo.requestedSince.single;
    final expected = DateTime.now().subtract(const Duration(days: 7));
    expect(since.difference(expected).inSeconds.abs(), lessThan(5));
  });

  test('"off" never touches the platform', () async {
    window = SensorBackfillWindow.off;
    sensorRepo.stored = [stored(5)];

    await cubit.reconcileFromSensorStore();

    expect(sensorRepo.requestedSince, isEmpty);
    expect(cubit.state.readings, isEmpty);
  });

  test('a second run over the same data changes nothing', () async {
    sensorRepo.stored = [stored(3), stored(2)];
    await cubit.reconcileFromSensorStore();
    final first = cubit.state.readings;

    await cubit.reconcileFromSensorStore();

    expect(identical(cubit.state.readings, first), isTrue);
    expect(cubit.state.readings, hasLength(2));
  });

  test('overlapping calls run the platform once', () async {
    final gate = Completer<void>();
    sensorRepo
      ..stored = [stored(3)]
      ..gate = gate;

    final a = cubit.reconcileFromSensorStore();
    final b = cubit.reconcileFromSensorStore();
    gate.complete();
    await Future.wait([a, b]);

    expect(sensorRepo.requestedSince, hasLength(1));
  });

  test('a platform failure leaves the readings alone and does not throw', () async {
    sensorRepo.throwOnRead = true;

    await cubit.reconcileFromSensorStore();

    expect(cubit.state.readings, isEmpty);
  });

  test('can run again after a failure', () async {
    sensorRepo.throwOnRead = true;
    await cubit.reconcileFromSensorStore();

    sensorRepo
      ..throwOnRead = false
      ..stored = [stored(2)];
    await cubit.reconcileFromSensorStore();

    expect(cubit.state.readings, hasLength(1));
  });
}

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
  dynamic noSuchMethod(Invocation invocation) => Future<void>.value();
}

class _FakeSensorRepository implements SensorRepository {
  List<StoredSensorReading> stored = const [];
  final requestedSince = <DateTime>[];
  Completer<void>? gate;
  bool throwOnRead = false;

  @override
  Future<List<StoredSensorReading>> getStoredReadings(DateTime since) async {
    requestedSince.add(since);
    await gate?.future;
    if (throwOnRead) throw StateError('boom');
    return stored;
  }

  @override
  Stream<SensorEvent> observeSessionEvents() => const Stream.empty();

  @override
  dynamic noSuchMethod(Invocation invocation) => Future<void>.value();
}
