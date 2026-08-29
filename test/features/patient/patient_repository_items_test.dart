import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/api/auth_token_store.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/repositories/patient_repository.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/data/sync/pending_op.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// SYNC-01, API-03 e IDENT-07: o repositório escreve por entrada, não trunca o
/// diário e a reconciliação com o servidor não atropela pendência.
void main() {
  sqfliteFfiInit();

  late LocalPatientDataSource local;
  late _FakeRemote remote;
  late _RecordingSync sync;
  late PatientRepository repository;

  setUp(() {
    local = LocalPatientDataSource(
      databaseFactory: databaseFactoryFfi,
      databasePath: inMemoryDatabasePath,
    );
    remote = _FakeRemote();
    // Debounce longo: a fila é inspecionada como ela fica depois da escrita,
    // sem um push oportunista esvaziá-la no meio do teste.
    sync = _RecordingSync(
      local: local,
      remote: remote,
      connectivityChanges: const Stream<List<ConnectivityResult>>.empty(),
      debounce: const Duration(minutes: 5),
      retryDelays: const [Duration.zero],
    );
    repository = PatientRepository(
      local: local,
      remote: remote,
      syncService: sync,
      tokenStore: _FakeTokenStore(),
    );
  });

  tearDown(() async {
    sync.dispose();
    await local.close();
  });

  final t0 = DateTime.fromMillisecondsSinceEpoch(1700000000000);
  final t1 = DateTime.fromMillisecondsSinceEpoch(1700003600000);

  CarbEntry carb(String description, {DateTime? time}) =>
      CarbEntry.create(grams: 30, description: description, time: time ?? t0);

  group('SYNC-01: uma escrita, uma operação', () {
    test('addCarb grava a entrada e enfileira um upsert', () async {
      final entry = carb('Lanche');

      await repository.addCarb(entry);

      expect((await local.load()).carbs.single.id, entry.id);
      final queued = await local.pendingOps();
      expect(queued, hasLength(1));
      expect(queued.single.entity, PendingOpEntity.carbs);
      expect(queued.single.op, PendingOpKind.upsert);
      expect(queued.single.entityId, entry.id);
    });

    test('updateCarb atualiza a linha e enfileira só a segunda operação',
        () async {
      final entry = carb('Lanche');
      await repository.addCarb(entry);

      await repository.updateCarb(entry.copyWith(grams: 75, time: t1));

      final stored = (await local.load()).carbs.single;
      expect(stored.grams, 75);
      expect(stored.time, t1);
      final queued = await local.pendingOps();
      expect(queued, hasLength(2));
      expect(queued.last.entityId, entry.id);
      expect(queued.last.op, PendingOpKind.upsert);
    });

    test('removeCarb apaga só aquela entrada e enfileira o delete', () async {
      final kept = carb('Fica');
      final gone = carb('Sai');
      await repository.addCarb(kept);
      await repository.addCarb(gone);

      await repository.removeCarb(gone.id);

      expect((await local.load()).carbs.single.id, kept.id);
      final queued = await local.pendingOps();
      expect(queued.last.op, PendingOpKind.delete);
      expect(queued.last.entityId, gone.id);
    });

    test('as operações de insulina existem e enfileiram o mesmo par', () async {
      final entry = InsulinEntry.create(
        units: 4,
        type: InsulinType.bolus,
        time: t0,
        dayOfWeek: kDaysOfWeek[0],
      );

      await repository.addInsulin(entry);
      await repository.updateInsulin(entry.copyWith(units: 6));
      expect((await local.load()).insulin.single.units, 6);

      await repository.removeInsulin(entry.id);

      expect((await local.load()).insulin, isEmpty);
      final queued = await local.pendingOps();
      expect(
        queued.map((o) => '${o.entity}:${o.op}').toList(),
        [
          'insulin:${PendingOpKind.upsert}',
          'insulin:${PendingOpKind.upsert}',
          'insulin:${PendingOpKind.delete}',
        ],
      );
    });

    test('addAlert grava o alerta e enfileira o upsert', () async {
      final alert =
          AppAlertItem.create(type: AppAlertType.glucoseLow, timestamp: t0);

      await repository.addAlert(alert);

      expect((await local.load()).alerts.single.id, alert.id);
      final queued = await local.pendingOps();
      expect(queued.single.entity, PendingOpEntity.alerts);
      expect(queued.single.entityId, alert.id);
    });

    test('cada escrita por entrada agenda o push', () async {
      final entry = carb('Lanche');
      final insulin = InsulinEntry.create(
        units: 4,
        type: InsulinType.bolus,
        time: t0,
        dayOfWeek: kDaysOfWeek[0],
      );

      await repository.addCarb(entry);
      await repository.updateCarb(entry.copyWith(grams: 45));
      await repository.removeCarb(entry.id);
      await repository.addInsulin(insulin);
      await repository.updateInsulin(insulin.copyWith(units: 5));
      await repository.removeInsulin(insulin.id);
      await repository.addAlert(
        AppAlertItem.create(type: AppAlertType.glucoseHigh, timestamp: t0),
      );

      expect(sync.scheduled, 7);
    });
  });

  group('API-03: o diário deixa de ser truncado na gravação local', () {
    test('150 entradas de carboidrato são gravadas inteiras', () async {
      final entries = [
        for (var i = 0; i < 150; i++)
          carb('Refeição $i',
              time: DateTime.fromMillisecondsSinceEpoch(1700000000000 + i)),
      ];

      await repository.saveCarbs(entries);

      final stored = (await local.load()).carbs;
      expect(stored, hasLength(150));
      expect(stored.map((c) => c.id).toSet(), entries.map((c) => c.id).toSet());
    });

    test('150 aplicações de insulina são gravadas inteiras', () async {
      final entries = [
        for (var i = 0; i < 150; i++)
          InsulinEntry.create(
            units: 1,
            type: InsulinType.basal,
            time: DateTime.fromMillisecondsSinceEpoch(1700000000000 + i),
            dayOfWeek: kDaysOfWeek[0],
          ),
      ];

      await repository.saveInsulin(entries);

      expect((await local.load()).insulin, hasLength(150));
    });
  });

  group('IDENT-07: reconciliação preserva a linha com operação pendente', () {
    test('a entrada com op na fila sobrevive ao snapshot do servidor',
        () async {
      final pending = carb('Só no aparelho');
      await repository.addCarb(pending);
      final fromServer =
          CarbEntry.create(grams: 60, description: 'Do servidor', time: t1);

      await local.replaceWithServerSnapshot(
        PatientSnapshot(
          readings: const [],
          alerts: const [],
          carbs: [fromServer],
          insulin: const [],
          alertSettings:
              const AlertSettingsModel(lowThreshold: 80, highThreshold: 180),
        ),
      );

      final stored = (await local.load()).carbs;
      expect(
        stored.map((c) => c.description),
        containsAll(['Só no aparelho', 'Do servidor']),
      );
    });

    test('a versão local vence a do servidor enquanto a op não subiu',
        () async {
      final entry = carb('Versão local');
      await repository.addCarb(entry);

      await local.replaceWithServerSnapshot(
        PatientSnapshot(
          readings: const [],
          alerts: const [],
          carbs: [
            CarbEntry(
              id: entry.id,
              grams: 999,
              description: 'Versão do servidor',
              time: t1,
            ),
          ],
          insulin: const [],
          alertSettings:
              const AlertSettingsModel(lowThreshold: 80, highThreshold: 180),
        ),
      );

      final stored = (await local.load()).carbs.single;
      expect(stored.description, 'Versão local');
      expect(stored.grams, 30);
    });

    test('linha sem operação pendente cede ao servidor', () async {
      // Entrada já confirmada: a op saiu da fila.
      final confirmed = carb('Já sincronizada');
      await repository.addCarb(confirmed);
      for (final op in await local.pendingOps()) {
        await local.deleteOp(op.seq!);
      }

      await local.replaceWithServerSnapshot(
        const PatientSnapshot(
          readings: [],
          alerts: [],
          carbs: [],
          insulin: [],
          alertSettings:
              AlertSettingsModel(lowThreshold: 80, highThreshold: 180),
        ),
      );

      // O servidor não tem mais essa entrada (apagada em outro aparelho).
      expect((await local.load()).carbs, isEmpty);
    });

    test('insulina e alertas seguem a mesma regra', () async {
      final insulin = InsulinEntry.create(
        units: 3,
        type: InsulinType.correction,
        time: t0,
        dayOfWeek: kDaysOfWeek[1],
      );
      final alert =
          AppAlertItem.create(type: AppAlertType.syncFailure, timestamp: t0);
      await repository.addInsulin(insulin);
      await repository.addAlert(alert);

      await local.replaceWithServerSnapshot(
        const PatientSnapshot(
          readings: [],
          alerts: [],
          carbs: [],
          insulin: [],
          alertSettings:
              AlertSettingsModel(lowThreshold: 80, highThreshold: 180),
        ),
      );

      final snapshot = await local.load();
      expect(snapshot.insulin.single.id, insulin.id);
      expect(snapshot.alerts.single.id, alert.id);
    });
  });
}

/// Conta os agendamentos de push sem deixar nenhum disparar.
class _RecordingSync extends PatientSyncService {
  _RecordingSync({
    required super.local,
    required super.remote,
    required super.connectivityChanges,
    required super.debounce,
    required super.retryDelays,
  });

  int scheduled = 0;

  @override
  void schedulePush() => scheduled++;
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
