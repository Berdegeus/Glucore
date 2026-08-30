import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/data/sync/pending_op.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

class _FakeRemote implements PatientRemoteApi {
  final savedReadings = <List<GlucoseReadingItem>>[];
  final savedAlerts = <List<AppAlertItem>>[];
  final savedCarbs = <List<CarbEntry>>[];
  final savedInsulin = <List<InsulinEntry>>[];
  final savedSettings = <AlertSettingsModel>[];

  /// Chamadas por item na ordem em que chegaram, como `'verbo:entidade:id'`.
  final itemCalls = <String>[];

  /// Estado que o "backend" guarda por id, para conferir idempotência.
  final carbRows = <String, CarbEntry>{};

  int failuresRemaining = 0;

  /// `'verbo:entidade:id'` que deve falhar na próxima vez que for chamado.
  String? failOnCall;

  /// Erro lançado por [failOnCall]; por padrão, falha de rede recuperável.
  Object failure = Exception('network down');

  /// `'verbo:entidade:id'` que fica pendurado até [releaseHeldCall] completar.
  /// Permite escrever no banco local com um push genuinamente em voo (SYNC-07).
  String? holdOnCall;
  final heldCallReached = Completer<void>();
  final _release = Completer<void>();

  void releaseHeldCall() {
    if (!_release.isCompleted) _release.complete();
  }

  Future<void> _maybeHold(String call) async {
    if (call != holdOnCall) return;
    if (!heldCallReached.isCompleted) heldCallReached.complete();
    await _release.future;
  }

  void _maybeFail() {
    if (failuresRemaining > 0) {
      failuresRemaining--;
      throw Exception('network down');
    }
  }

  void _record(String call) {
    itemCalls.add(call);
    if (call == failOnCall) {
      throw failure;
    }
    _maybeFail();
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

  @override
  Future<void> upsertCarb(CarbEntry entry) async {
    _record('upsert:carbs:${entry.id}');
    await _maybeHold('upsert:carbs:${entry.id}');
    carbRows[entry.id] = entry;
  }

  @override
  Future<void> deleteCarb(String id) async {
    _record('delete:carbs:$id');
    carbRows.remove(id);
  }

  @override
  Future<void> upsertInsulin(InsulinEntry entry) async =>
      _record('upsert:insulin:${entry.id}');

  @override
  Future<void> deleteInsulin(String id) async =>
      _record('delete:insulin:$id');

  @override
  Future<void> upsertAlert(AppAlertItem alert) async =>
      _record('upsert:alerts:${alert.id}');

  @override
  Future<void> deleteAlert(String id) async => _record('delete:alerts:$id');
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

  CarbEntry carb(String description) =>
      CarbEntry.create(grams: 25, description: description, time: entryTime);

  test('pushNow drains the diary queue and pushes pending collections',
      () async {
    final entry = carb('Café');
    await local.upsertCarb(entry);
    await local.saveAlertSettings(
      const AlertSettingsModel(lowThreshold: 70, highThreshold: 200),
    );

    final pushed = await service.pushNow();

    expect(pushed, isTrue);
    expect(remote.itemCalls, ['upsert:carbs:${entry.id}']);
    expect(remote.carbRows[entry.id]!.description, 'Café');
    expect(remote.savedSettings, hasLength(1));
    // Nada de replace-all de diário: a coleção de carbs não é mais enviada.
    expect(remote.savedCarbs, isEmpty);
    expect(remote.savedReadings, isEmpty);
    expect(remote.savedAlerts, isEmpty);
    expect(await local.pendingOps(), isEmpty);
  });

  test('pushNow is a no-op when nothing is pending', () async {
    final pushed = await service.pushNow();
    expect(pushed, isTrue);
    expect(remote.itemCalls, isEmpty);
    expect(remote.savedSettings, isEmpty);
  });

  test('failing remote keeps the operation queued and pushNow reports false',
      () async {
    remote.failuresRemaining = 2; // esgota a tentativa inicial + retry
    final entry = carb('Café');
    await local.upsertCarb(entry);

    final pushed = await service.pushNow();

    expect(pushed, isFalse);
    expect((await local.pendingOps()).single.entityId, entry.id);

    // Rede volta: o reenvio da mesma op limpa a fila.
    final retried = await service.pushNow();
    expect(retried, isTrue);
    expect(await local.pendingOps(), isEmpty);
  });

  test('transient failure is retried within the same pushNow', () async {
    remote.failuresRemaining = 1; // primeira tentativa falha, retry passa
    final entry = carb('Café');
    await local.upsertCarb(entry);

    final pushed = await service.pushNow();

    expect(pushed, isTrue);
    expect(remote.carbRows[entry.id]!.description, 'Café');
    expect(await local.pendingOps(), isEmpty);
  });

  test('schedulePush debounces bursts into a single push', () async {
    final entry = carb('Café');
    await local.upsertCarb(entry);

    service.schedulePush();
    service.schedulePush();
    service.schedulePush();

    await Future<void>.delayed(const Duration(milliseconds: 100));

    expect(remote.itemCalls, ['upsert:carbs:${entry.id}']);
    expect(await local.pendingOps(), isEmpty);
  });

  group('SYNC-07: escrita durante um push em voo', () {
    test('a edição feita durante o push continua pendente depois dele',
        () async {
      final first = carb('Café');
      await local.upsertCarb(first);

      // Segura a chamada remota da primeira op: o push fica genuinamente em
      // voo enquanto o teste escreve no banco local.
      remote.holdOnCall = 'upsert:carbs:${first.id}';
      final push = service.pushNow();
      await remote.heldCallReached.future;

      // Usuário edita durante o push. A op nova entra na fila com seq maior.
      final second = carb('Jantar');
      await local.upsertCarb(second);

      remote.releaseHeldCall();
      expect(await push, isTrue);

      // A op que entrou durante o push NÃO foi levada junto nem apagada: ela
      // sobrevive ao término do push e continua na fila.
      final pending = await local.pendingOps();
      expect(pending, hasLength(1));
      expect(pending.single.entityId, second.id);
      expect(remote.itemCalls, ['upsert:carbs:${first.id}']);

      // E o push seguinte a entrega.
      expect(await service.pushNow(), isTrue);
      expect(remote.carbRows[second.id]!.description, 'Jantar');
      expect(await local.pendingOps(), isEmpty);
    });
  });

  group('SYNC-02/SYNC-09: ordem e baixa da fila', () {
    test('operações saem na ordem de criação, das três entidades', () async {
      final first = carb('Lanche');
      final insulin = InsulinEntry.create(
        units: 4,
        type: InsulinType.bolus,
        time: entryTime,
        dayOfWeek: kDaysOfWeek[0],
      );
      final alert = AppAlertItem.create(
        type: AppAlertType.glucoseLow,
        timestamp: entryTime,
      );

      await local.upsertCarb(first);
      await local.upsertInsulin(insulin);
      await local.upsertAlert(alert);
      await local.deleteCarb(first.id);

      await service.pushNow();

      expect(remote.itemCalls, [
        'upsert:carbs:${first.id}',
        'upsert:insulin:${insulin.id}',
        'upsert:alerts:${alert.id}',
        'delete:carbs:${first.id}',
      ]);
      expect(await local.pendingOps(), isEmpty);
    });

    test('duas operações da mesma entrada chegam na ordem em que foram feitas',
        () async {
      final entry = carb('Lanche');
      await local.upsertCarb(entry);
      await local.upsertCarb(entry.copyWith(grams: 60));

      await service.pushNow();

      expect(remote.itemCalls, [
        'upsert:carbs:${entry.id}',
        'upsert:carbs:${entry.id}',
      ]);
      expect(remote.carbRows[entry.id]!.grams, 60);
    });
  });

  group('SYNC-03/SYNC-04: falha no meio preserva a fila', () {
    test('a op que falhou e as posteriores continuam na fila, em ordem',
        () async {
      final first = carb('Primeira');
      final second = carb('Segunda');
      final third = carb('Terceira');
      await local.upsertCarb(first);
      await local.upsertCarb(second);
      await local.upsertCarb(third);
      remote.failOnCall = 'upsert:carbs:${second.id}';

      final pushed = await service.pushNow();

      expect(pushed, isFalse);
      // A primeira subiu e saiu; a segunda e a terceira ficaram, em ordem.
      final queued = await local.pendingOps();
      expect(queued.map((o) => o.entityId).toList(), [second.id, third.id]);
      // A terceira nunca foi enviada fora de ordem.
      expect(
        remote.itemCalls.where((c) => c.endsWith(third.id)),
        isEmpty,
      );
      expect(remote.carbRows.containsKey(third.id), isFalse);
    });

    test('quando a rede volta, a fila continua de onde parou', () async {
      final first = carb('Primeira');
      final second = carb('Segunda');
      await local.upsertCarb(first);
      await local.upsertCarb(second);
      remote.failOnCall = 'upsert:carbs:${second.id}';
      await service.pushNow();

      remote.failOnCall = null;
      final pushed = await service.pushNow();

      expect(pushed, isTrue);
      expect(await local.pendingOps(), isEmpty);
      expect(remote.carbRows.keys.toSet(), {first.id, second.id});
      // A primeira não foi reenviada depois de confirmada.
      expect(
        remote.itemCalls.where((c) => c == 'upsert:carbs:${first.id}'),
        hasLength(1),
      );
    });
  });

  group('401 durante a drenagem', () {
    test('interrompe o push, preserva a fila e não tenta de novo', () async {
      final first = carb('Primeira');
      final second = carb('Segunda');
      await local.upsertCarb(first);
      await local.upsertCarb(second);
      remote.failOnCall = 'upsert:carbs:${first.id}';
      remote.failure = const PatientUnauthorizedException();

      final pushed = await service.pushNow();

      expect(pushed, isFalse);
      expect(
        (await local.pendingOps()).map((o) => o.entityId).toList(),
        [first.id, second.id],
      );
      // Sem retry: o 401 não é falha recuperável.
      expect(remote.itemCalls, ['upsert:carbs:${first.id}']);
    });
  });

  group('SYNC-05/SYNC-08: operação inválida é descartada com log', () {
    late List<String> logged;
    late DebugPrintCallback originalDebugPrint;

    setUp(() {
      logged = <String>[];
      originalDebugPrint = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        if (message != null) logged.add(message);
      };
    });

    tearDown(() => debugPrint = originalDebugPrint);

    test('entidade desconhecida sai da fila e a próxima op segue', () async {
      await local.enqueueOp(
        PendingOp.upsert(
          entity: 'fantasmas',
          entityId: 'ghost-1',
          payload: {'id': 'ghost-1'},
        ),
      );
      final entry = carb('Depois do fantasma');
      await local.upsertCarb(entry);

      final pushed = await service.pushNow();

      expect(pushed, isTrue);
      expect(await local.pendingOps(), isEmpty);
      expect(remote.itemCalls, ['upsert:carbs:${entry.id}']);
      expect(
        logged.single,
        allOf(
          contains('fantasmas'),
          contains('ghost-1'),
          contains('entidade desconhecida'),
        ),
      );
    });

    test('payload ilegível sai da fila e a próxima op segue', () async {
      await local.enqueueOp(
        PendingOp(
          entity: PendingOpEntity.carbs,
          entityId: 'carb-quebrado',
          op: PendingOpKind.upsert,
          payloadJson: '{isso não é json',
          createdAt: entryTime.millisecondsSinceEpoch,
        ),
      );
      final entry = carb('Depois do payload quebrado');
      await local.upsertCarb(entry);

      final pushed = await service.pushNow();

      expect(pushed, isTrue);
      expect(await local.pendingOps(), isEmpty);
      expect(remote.itemCalls, ['upsert:carbs:${entry.id}']);
      expect(
        logged.single,
        allOf(
          contains(PendingOpEntity.carbs),
          contains('carb-quebrado'),
          contains('payload ilegível'),
        ),
      );
    });
  });

  group('SYNC-06: reenvio da mesma operação', () {
    test('não duplica a linha no backend', () async {
      final entry = carb('Café');
      await local.upsertCarb(entry);
      remote.failuresRemaining = 3; // esgota a tentativa inicial + retry
      await service.pushNow();
      expect(await local.pendingOps(), hasLength(1));

      final pushed = await service.pushNow();

      expect(pushed, isTrue);
      expect(remote.carbRows.keys.toList(), [entry.id]);
      expect(remote.carbRows[entry.id]!.description, 'Café');
      expect(await local.pendingOps(), isEmpty);
    });
  });

  group('SYNC-10: leituras e thresholds seguem pelo caminho de coleção', () {
    test('readings vão em lote enquanto o diário vai por item', () async {
      final entry = carb('Café');
      await local.upsertCarb(entry);
      await local.saveReadings([
        GlucoseReadingItem(
          value: 110,
          timestamp: entryTime,
          trend: GlucoseTrend.stable,
          rate: 0,
        ),
      ]);

      await service.pushNow();

      expect(remote.savedReadings, hasLength(1));
      expect(remote.savedReadings.single.single.value, 110);
      expect(remote.itemCalls, ['upsert:carbs:${entry.id}']);
      expect(await local.pendingCollections(), isNot(contains(
        PatientCollection.readings,
      )));
    });
  });
}
