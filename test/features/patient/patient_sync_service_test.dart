import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/data/sync/pending_op.dart';
import 'package:glucore/features/patient/domain/glucose_bucket.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/domain/reading_decimation.dart';
import 'package:glucore/features/patient/domain/repositories/patient_repository.dart';
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

  final savedBuckets = <List<GlucoseBucket>>[];

  /// Faz `saveGlucoseBuckets` falhar com este erro, se definido.
  Object? bucketError;

  @override
  Future<void> saveGlucoseBuckets(List<GlucoseBucket> buckets) async {
    if (bucketError != null) throw bucketError!;
    savedBuckets.add(buckets);
  }

  @override
  Future<PatientSnapshot> loadSince(DateTime readingsFrom) => load();

  @override
  Future<PatientSnapshot> load() => throw UnimplementedError();

  /// A partir de qual chamada (1-based) `saveReadings` passa a falhar, ou `null`.
  /// "A partir de" e não "só essa": o serviço tenta de novo, e a retentativa
  /// não pode mascarar a falha.
  int? failReadingBatchesFrom;
  var _readingCalls = 0;

  @override
  Future<void> saveReadings(List<GlucoseReadingItem> readings) async {
    _readingCalls++;
    if (failReadingBatchesFrom != null &&
        _readingCalls >= failReadingBatchesFrom!) {
      throw Exception('network down');
    }
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

    // Uma leitura por intervalo de 5 min: cada uma vira uma linha no servidor.
    GlucoseReadingItem reading(int index) => GlucoseReadingItem(
          value: 100,
          timestamp: entryTime.add(Duration(minutes: index * 5)),
          trend: GlucoseTrend.stable,
          rate: 0,
        );

    test('um backlog grande sobe em lotes que o backend aceita inteiros',
        () async {
      await local.saveReadings([for (var i = 0; i < 1200; i++) reading(i)]);

      final pushed = await service.pushNow();

      expect(pushed, isTrue);
      expect(
        remote.savedReadings.map((batch) => batch.length),
        [500, 500, 200],
      );
      expect(
        remote.savedReadings.every(
          (batch) => batch.length <= PatientRepository.readingPushBatchSize,
        ),
        isTrue,
      );
      expect(await local.pendingReadings(), isEmpty);
    });

    test('só as leituras pendentes sobem; as já confirmadas não são reenviadas',
        () async {
      final synced = [for (var i = 0; i < 600; i++) reading(i)];
      await local.saveReadings(synced);
      await local.markReadingsSynced(synced);

      await local.saveReadings([...synced, reading(600), reading(601)]);
      await service.pushNow();

      expect(remote.savedReadings, hasLength(1));
      expect(
        remote.savedReadings.single.map((r) => r.timestamp),
        [
          for (final i in [600, 601])
            DateTime.fromMillisecondsSinceEpoch(
              readingSlotStart(reading(i).timestamp.millisecondsSinceEpoch),
            ),
        ],
      );
      expect(remote.savedReadings.single, hasLength(2));
    });

    test('se um lote falha, os já confirmados ficam synced e o resto pendente',
        () async {
      await local.saveReadings([for (var i = 0; i < 1200; i++) reading(i)]);
      remote.failReadingBatchesFrom = 2; // 1º ok, 2º em diante falha

      await service.pushNow();

      expect(await local.pendingReadings(), hasLength(700));
    });
  });

  group('leituras saem decimadas a 5 min; o banco local segue a 1/min', () {
    // 2 intervalos cheios de 1 leitura por minuto, a partir de um múltiplo de 5 min.
    final base = DateTime.fromMillisecondsSinceEpoch(
      readingSlotStart(DateTime.utc(2026, 8, 5, 12).millisecondsSinceEpoch),
    );

    GlucoseReadingItem at(int minute, double value) => GlucoseReadingItem(
          value: value,
          timestamp: base.add(Duration(minutes: minute)),
          trend: GlucoseTrend.stable,
          rate: 0,
        );

    PatientSyncService serviceAt(DateTime now) => PatientSyncService(
          local: local,
          remote: remote,
          connectivityChanges: const Stream<List<ConnectivityResult>>.empty(),
          debounce: const Duration(milliseconds: 10),
          retryDelays: const [Duration.zero],
          clock: () => now,
        );

    test('10 leituras por minuto viram 2 linhas, a mais antiga de cada intervalo',
        () async {
      await local.saveReadings([
        for (var m = 0; m < 10; m++) at(m, 100.0 + m),
      ]);
      final late = serviceAt(base.add(const Duration(hours: 1)));

      final pushed = await late.pushNow();
      late.dispose();

      expect(pushed, isTrue);
      final sent = remote.savedReadings.single;
      expect(sent.map((r) => (r.timestamp, r.value)), [
        (base, 100.0),
        (base.add(const Duration(minutes: 5)), 105.0),
      ]);
    });

    test('todas as leituras que a linha representa ficam synced; o local fica inteiro',
        () async {
      await local.saveReadings([
        for (var m = 0; m < 10; m++) at(m, 100.0 + m),
      ]);
      final late = serviceAt(base.add(const Duration(hours: 1)));

      await late.pushNow();
      late.dispose();

      expect(await local.pendingReadings(), isEmpty);
      expect((await local.load()).readings, hasLength(10));
    });

    test('o intervalo em curso continua pendente e não faz o push falhar',
        () async {
      await local.saveReadings([
        for (var m = 0; m < 8; m++) at(m, 100.0 + m),
      ]);
      // 2 min depois do início do 2º intervalo: o 1º está fechado, o 2º não.
      final during = serviceAt(base.add(const Duration(minutes: 7)));

      final pushed = await during.pushNow();

      expect(pushed, isTrue);
      expect(remote.savedReadings.single.map((r) => r.timestamp), [base]);
      expect(
        (await local.pendingReadings()).map((r) => r.timestamp),
        [at(7, 0).timestamp, at(6, 0).timestamp, at(5, 0).timestamp],
      );

      // Fechado o intervalo, o resto sai.
      final after = serviceAt(base.add(const Duration(minutes: 10)));
      await after.pushNow();
      during.dispose();
      after.dispose();

      expect(remote.savedReadings, hasLength(2));
      expect(await local.pendingReadings(), isEmpty);
    });

    test('uma leitura mais antiga que chega depois reenvia a mesma chave com o valor novo',
        () async {
      final now = base.add(const Duration(hours: 1));
      final svc = serviceAt(now);
      await local.saveReadings([at(2, 102), at(3, 103)]);
      await svc.pushNow();

      // O backfill do sensor traz o minuto 0 do mesmo intervalo.
      await local.saveReadings([at(0, 100), at(2, 102), at(3, 103)]);
      await svc.pushNow();
      svc.dispose();

      expect(remote.savedReadings, hasLength(2));
      expect(remote.savedReadings[0].single.timestamp, base);
      expect(remote.savedReadings[0].single.value, 102);
      expect(remote.savedReadings[1].single.timestamp, base);
      expect(remote.savedReadings[1].single.value, 100);
    });

    test('uma leitura nova no meio de um intervalo já enviado não troca o que o servidor tem',
        () async {
      final svc = serviceAt(base.add(const Duration(hours: 1)));
      await local.saveReadings([at(0, 100)]);
      await svc.pushNow();

      await local.saveReadings([at(0, 100), at(3, 150)]);
      await svc.pushNow();
      svc.dispose();

      // A mais antiga do intervalo continua sendo o minuto 0: mesma linha.
      expect(remote.savedReadings.last.single.value, 100);
      expect(await local.pendingReadings(), isEmpty);
    });
  });

  group('blocos de 15 min: calculados com a série de 1/min, enviados à parte', () {
    // Um múltiplo de 15 min de UTC: o início de um bloco.
    final start = DateTime.fromMillisecondsSinceEpoch(
      glucoseBucketStart(DateTime.utc(2026, 8, 5, 12).millisecondsSinceEpoch),
      isUtc: true,
    );
    final startMs = start.millisecondsSinceEpoch;
    const bucketMs = 15 * 60000;
    final afterwards = start.add(const Duration(days: 2));

    GlucoseReadingItem at(Duration offset, double value) => GlucoseReadingItem(
          value: value,
          timestamp: start.add(offset),
          trend: GlucoseTrend.stable,
          rate: 0,
        );

    PatientSyncService serviceAt(DateTime now) => PatientSyncService(
          local: local,
          remote: remote,
          connectivityChanges: const Stream<List<ConnectivityResult>>.empty(),
          debounce: const Duration(milliseconds: 10),
          retryDelays: const [Duration.zero],
          clock: () => now,
        );

    test('o bloco conta as leituras de minuto, não as de 5 min que sobem', () async {
      await local.saveReadings([
        for (var m = 0; m < 15; m++) at(Duration(minutes: m), 100),
      ]);
      final svc = serviceAt(afterwards);

      await svc.pushNow();
      svc.dispose();

      expect(remote.savedReadings.single, hasLength(3)); // 15 min / 5
      final bucket = remote.savedBuckets.single.single;
      expect(bucket.startMs, startMs);
      expect(bucket.readingsCount, 15);
      expect(bucket.coveredSlots, 3);
      expect(bucket.mgDl, [100]);
      expect(bucket.counts, [15]);
    });

    test('depois de enviado o bloco não volta a ser enviado', () async {
      await local.saveReadings([at(Duration.zero, 100)]);
      final svc = serviceAt(afterwards);
      await svc.pushNow();

      await svc.pushNow();
      svc.dispose();

      expect(remote.savedBuckets, hasLength(1));
      expect(await local.pendingGlucoseBuckets(), isEmpty);
    });

    test('um backfill de um bloco passado refaz o bloco, com todas as leituras dele',
        () async {
      final svc = serviceAt(afterwards);
      await local.saveReadings([at(const Duration(minutes: 10), 100)]);
      await svc.pushNow();

      // O sensor entrega, depois, os minutos anteriores do mesmo bloco.
      await local.saveReadings([
        for (var m = 0; m < 6; m++) at(Duration(minutes: m), 90),
        at(const Duration(minutes: 10), 100),
      ]);
      await svc.pushNow();
      svc.dispose();

      expect(remote.savedBuckets, hasLength(2));
      expect(remote.savedBuckets.last.single.readingsCount, 7);
      expect(remote.savedBuckets.last.single.mgDl, [90, 100]);
    });

    test('o bloco em curso não sobe: fica sujo até fechar', () async {
      await local.saveReadings([at(const Duration(minutes: 1), 100)]);
      // 5 min dentro do bloco.
      final during = serviceAt(start.add(const Duration(minutes: 5)));

      await during.pushNow();
      expect(remote.savedBuckets, isEmpty);
      expect(await local.dirtyBucketStarts(), [startMs]);

      // Fechado o bloco, sai.
      final after = serviceAt(start.add(const Duration(minutes: 15)));
      await after.pushNow();
      during.dispose();
      after.dispose();

      expect(remote.savedBuckets.single.single.startMs, startMs);
      expect(await local.dirtyBucketStarts(), isEmpty);
    });

    test('o bloco sobe no instante em que fecha, e não antes', () async {
      await local.saveReadings([at(const Duration(minutes: 1), 100)]);

      final early = serviceAt(start.add(const Duration(minutes: 14, seconds: 59)));
      await early.pushNow();
      expect(remote.savedBuckets, isEmpty);

      final onTime = serviceAt(start.add(const Duration(minutes: 15)));
      await onTime.pushNow();
      early.dispose();
      onTime.dispose();
      expect(remote.savedBuckets, hasLength(1));
    });

    test('leituras de blocos diferentes viram blocos diferentes', () async {
      await local.saveReadings([
        at(const Duration(minutes: 1), 100),
        at(const Duration(minutes: 16), 110),
        at(const Duration(minutes: 46), 120),
      ]);
      final svc = serviceAt(afterwards);

      await svc.pushNow();
      svc.dispose();

      expect(remote.savedBuckets.single.map((b) => b.startMs),
          [startMs, startMs + bucketMs, startMs + 3 * bucketMs]);
    });

    test('mais de 288 blocos sobem em requisições de no máximo 288', () async {
      await local.saveReadings([
        for (var b = 0; b < 600; b++) at(Duration(minutes: b * 15 + 1), 100),
      ]);
      final svc = serviceAt(start.add(const Duration(days: 30)));

      await svc.pushNow();
      svc.dispose();

      expect(remote.savedBuckets.map((b) => b.length), [288, 288, 24]);
      expect(await local.pendingGlucoseBuckets(), isEmpty);
    });

    test('duas semanas a 1/min viram 1344 blocos e 4032 leituras de 5 min', () async {
      await local.saveReadings([
        for (var m = 0; m < 14 * 24 * 60; m++) at(Duration(minutes: m), 100.0 + m % 50),
      ]);
      final svc = serviceAt(start.add(const Duration(days: 30)));

      await svc.pushNow();
      svc.dispose();

      expect(remote.savedReadings.fold<int>(0, (n, batch) => n + batch.length), 4032);
      expect(remote.savedBuckets.fold<int>(0, (n, batch) => n + batch.length), 1344);
      expect(remote.savedBuckets.map((b) => b.length), [288, 288, 288, 288, 192]);
    });

    test('uma falha nos blocos não derruba o push: o resto sobe e os blocos ficam pendentes',
        () async {
      remote.bucketError = Exception('404');
      await local.saveReadings([at(Duration.zero, 100)]);
      final svc = serviceAt(afterwards);

      final pushed = await svc.pushNow();

      expect(pushed, isTrue);
      expect(remote.savedReadings, hasLength(1));
      expect(await local.pendingGlucoseBuckets(), hasLength(1));

      // Quando o servidor passa a aceitar, o que ficou pendente sobe.
      remote.bucketError = null;
      await svc.pushNow();
      svc.dispose();
      expect(remote.savedBuckets.single.single.readingsCount, 1);
      expect(await local.pendingGlucoseBuckets(), isEmpty);
    });

    test('uma sessão recusada (401) nos blocos interrompe o push como em todo envio',
        () async {
      remote.bucketError = const PatientUnauthorizedException();
      await local.saveReadings([at(Duration.zero, 100)]);
      final svc = serviceAt(afterwards);

      final pushed = await svc.pushNow();
      svc.dispose();

      expect(pushed, isFalse);
      expect(await local.pendingGlucoseBuckets(), hasLength(1));
    });

    test('sem leituras pendentes, ainda envia um bloco que ficou pendente', () async {
      remote.bucketError = Exception('rede');
      await local.saveReadings([at(Duration.zero, 100)]);
      final svc = serviceAt(afterwards);
      await svc.pushNow();
      expect(await local.pendingCollections(), isEmpty);

      remote.bucketError = null;
      await svc.pushNow();
      svc.dispose();

      expect(remote.savedBuckets, hasLength(1));
    });

    test('um bloco de leitura podada não encolhe o que já foi enviado', () async {
      final svc = serviceAt(afterwards);
      await local.saveReadings([
        for (var m = 0; m < 15; m++) at(Duration(minutes: m), 100),
      ]);
      await svc.pushNow();

      // A retenção descarta as primeiras leituras do bloco e o conjunto é regravado.
      await local.saveReadings([
        for (var m = 10; m < 15; m++) at(Duration(minutes: m), 100),
      ]);
      await svc.pushNow();
      svc.dispose();

      expect(remote.savedBuckets, hasLength(1));
      expect(remote.savedBuckets.single.single.readingsCount, 15);
    });
  });
}
