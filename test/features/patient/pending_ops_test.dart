import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/sync/pending_op.dart';
import 'package:glucore/features/patient/presentation/models/patient_models.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// SYNC-01 e SYNC-02: a fila local de operações unitárias do diário existe,
/// devolve as operações na ordem em que foram criadas e libera a que já foi
/// confirmada.
void main() {
  sqfliteFfiInit();

  late LocalPatientDataSource dataSource;

  setUp(() {
    dataSource = LocalPatientDataSource(
      databaseFactory: databaseFactoryFfi,
      databasePath: inMemoryDatabasePath,
    );
  });

  tearDown(() => dataSource.close());

  final t0 = DateTime.fromMillisecondsSinceEpoch(1700000000000);

  group('SYNC-01: a operação enfileirada carrega entidade, id e payload', () {
    test('upsert guarda o payload da entrada', () async {
      await dataSource.enqueueOp(
        PendingOp.upsert(
          entity: PendingOpEntity.carbs,
          entityId: 'carb-1',
          payload: {'id': 'carb-1', 'grams': 45, 'description': 'Almoço'},
          createdAt: t0,
        ),
      );

      final queued = await dataSource.pendingOps();

      expect(queued, hasLength(1));
      expect(queued.single.entity, PendingOpEntity.carbs);
      expect(queued.single.entityId, 'carb-1');
      expect(queued.single.op, PendingOpKind.upsert);
      expect(queued.single.createdAt, t0.millisecondsSinceEpoch);
      final payload =
          jsonDecode(queued.single.payloadJson!) as Map<String, dynamic>;
      expect(payload['grams'], 45);
      expect(payload['description'], 'Almoço');
    });

    test('delete viaja sem payload', () async {
      await dataSource.enqueueOp(
        PendingOp.delete(
          entity: PendingOpEntity.insulin,
          entityId: 'insulin-1',
          createdAt: t0,
        ),
      );

      final queued = await dataSource.pendingOps();

      expect(queued.single.op, PendingOpKind.delete);
      expect(queued.single.entityId, 'insulin-1');
      expect(queued.single.payloadJson, isNull);
    });
  });

  group('SYNC-02: ordem de saída é a ordem de criação', () {
    test('pendingOps devolve em ordem crescente de seq', () async {
      for (final id in ['a', 'b', 'c']) {
        await dataSource.enqueueOp(
          PendingOp.upsert(
            entity: PendingOpEntity.carbs,
            entityId: id,
            payload: {'id': id},
            createdAt: t0,
          ),
        );
      }

      final queued = await dataSource.pendingOps();

      expect(queued.map((o) => o.entityId).toList(), ['a', 'b', 'c']);
      expect(queued.map((o) => o.seq!).toList(), [1, 2, 3]);
    });

    test('a ordem não depende do created_at gravado', () async {
      // Primeira operação com horário POSTERIOR à segunda: um relógio que
      // volta atrás não pode reordenar a fila.
      await dataSource.enqueueOp(
        PendingOp.delete(
          entity: PendingOpEntity.carbs,
          entityId: 'primeira',
          createdAt: t0.add(const Duration(hours: 1)),
        ),
      );
      await dataSource.enqueueOp(
        PendingOp.delete(
          entity: PendingOpEntity.carbs,
          entityId: 'segunda',
          createdAt: t0,
        ),
      );

      final queued = await dataSource.pendingOps();

      expect(queued.map((o) => o.entityId).toList(), ['primeira', 'segunda']);
    });

    test('pendingOps respeita o limite devolvendo as mais antigas', () async {
      for (final id in ['a', 'b', 'c']) {
        await dataSource.enqueueOp(
          PendingOp.delete(entity: PendingOpEntity.alerts, entityId: id),
        );
      }

      final queued = await dataSource.pendingOps(limit: 2);

      expect(queued.map((o) => o.entityId).toList(), ['a', 'b']);
    });
  });

  group('SYNC-09: remoção por seq', () {
    test('deleteOp tira só a operação do seq informado', () async {
      for (final id in ['a', 'b', 'c']) {
        await dataSource.enqueueOp(
          PendingOp.delete(entity: PendingOpEntity.carbs, entityId: id),
        );
      }
      final queued = await dataSource.pendingOps();

      await dataSource.deleteOp(queued[1].seq!);

      final remaining = await dataSource.pendingOps();
      expect(remaining.map((o) => o.entityId).toList(), ['a', 'c']);
    });

    test('seq não é reaproveitado depois de uma remoção', () async {
      await dataSource.enqueueOp(
        PendingOp.delete(entity: PendingOpEntity.carbs, entityId: 'a'),
      );
      final first = (await dataSource.pendingOps()).single;
      await dataSource.deleteOp(first.seq!);

      await dataSource.enqueueOp(
        PendingOp.delete(entity: PendingOpEntity.carbs, entityId: 'b'),
      );

      final queued = await dataSource.pendingOps();
      expect(queued.single.seq, greaterThan(first.seq!));
    });
  });

  group('SYNC-01: escrita unitária grava linha e operação juntas', () {
    test('upsertCarb persiste a entrada e enfileira o upsert com o payload',
        () async {
      final entry =
          CarbEntry.create(grams: 45, description: 'Almoço', time: t0);

      await dataSource.upsertCarb(entry);

      final snapshot = await dataSource.load();
      expect(snapshot.carbs.single.id, entry.id);
      expect(snapshot.carbs.single.grams, 45);

      final queued = await dataSource.pendingOps();
      expect(queued, hasLength(1));
      expect(queued.single.entity, PendingOpEntity.carbs);
      expect(queued.single.op, PendingOpKind.upsert);
      expect(queued.single.entityId, entry.id);
      final payload =
          jsonDecode(queued.single.payloadJson!) as Map<String, dynamic>;
      expect(payload['id'], entry.id);
      expect(payload['grams'], 45);
      expect(payload['timeMs'], t0.millisecondsSinceEpoch);
    });

    test('editar a mesma entrada atualiza a linha e enfileira a segunda op',
        () async {
      final entry =
          CarbEntry.create(grams: 45, description: 'Almoço', time: t0);
      await dataSource.upsertCarb(entry);

      await dataSource.upsertCarb(entry.copyWith(grams: 60));

      final snapshot = await dataSource.load();
      expect(snapshot.carbs, hasLength(1));
      expect(snapshot.carbs.single.grams, 60);

      final queued = await dataSource.pendingOps();
      expect(queued, hasLength(2));
      expect(queued.map((o) => o.entityId).toSet(), {entry.id});
      expect(
        jsonDecode(queued.last.payloadJson!) as Map<String, dynamic>,
        containsPair('grams', 60),
      );
    });

    test('deleteCarb apaga a linha e enfileira o delete daquele id', () async {
      final kept = CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      final removed =
          CarbEntry.create(grams: 60, description: 'Jantar', time: t0);
      await dataSource.upsertCarb(kept);
      await dataSource.upsertCarb(removed);

      await dataSource.deleteCarb(removed.id);

      final snapshot = await dataSource.load();
      expect(snapshot.carbs.single.id, kept.id);

      final queued = await dataSource.pendingOps();
      expect(queued.last.op, PendingOpKind.delete);
      expect(queued.last.entityId, removed.id);
      expect(queued.last.payloadJson, isNull);
    });

    test('upsertInsulin e deleteInsulin gravam linha e operação', () async {
      final entry = InsulinEntry.create(
        units: 4.5,
        type: InsulinType.bolus,
        time: t0,
        dayOfWeek: kDaysOfWeek[2],
      );

      await dataSource.upsertInsulin(entry);
      expect((await dataSource.load()).insulin.single.units, 4.5);
      final afterUpsert = await dataSource.pendingOps();
      expect(afterUpsert.single.entity, PendingOpEntity.insulin);
      expect(afterUpsert.single.op, PendingOpKind.upsert);
      expect(
        jsonDecode(afterUpsert.single.payloadJson!) as Map<String, dynamic>,
        containsPair('units', 4.5),
      );

      await dataSource.deleteInsulin(entry.id);
      expect((await dataSource.load()).insulin, isEmpty);
      final afterDelete = await dataSource.pendingOps();
      expect(afterDelete.last.op, PendingOpKind.delete);
      expect(afterDelete.last.entityId, entry.id);
    });

    test('upsertAlert grava o alerta e enfileira o upsert', () async {
      final alert =
          AppAlertItem.create(type: AppAlertType.glucoseLow, timestamp: t0);

      await dataSource.upsertAlert(alert);

      expect((await dataSource.load()).alerts.single.id, alert.id);
      final queued = await dataSource.pendingOps();
      expect(queued.single.entity, PendingOpEntity.alerts);
      expect(queued.single.entityId, alert.id);
      expect(
        jsonDecode(queued.single.payloadJson!) as Map<String, dynamic>,
        containsPair('type', 'glucoseLow'),
      );
    });

    test('duas entradas no mesmo horário rendem duas linhas e duas operações',
        () async {
      final first = CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      final second =
          CarbEntry.create(grams: 60, description: 'Jantar', time: t0);

      await dataSource.upsertCarb(first);
      await dataSource.upsertCarb(second);

      expect((await dataSource.load()).carbs, hasLength(2));
      final queued = await dataSource.pendingOps();
      expect(queued.map((o) => o.entityId).toList(), [first.id, second.id]);
    });
  });

  group('SYNC-01: a linha e a sua operação não se separam', () {
    late Directory tempDir;
    late String dbPath;

    setUp(() {
      tempDir = Directory.systemTemp.createTempSync('glucore_op_atomicity');
      dbPath = '${tempDir.path}/glucore_patient.db';
    });

    tearDown(() {
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('falha ao enfileirar a operação desfaz a gravação da linha', () async {
      final fileBacked = LocalPatientDataSource(
        databaseFactory: databaseFactoryFfi,
        databasePath: dbPath,
      );
      // Abre o banco (roda onCreate) antes de sabotar a fila.
      await fileBacked.load();

      final raw = await databaseFactoryFfi.openDatabase(dbPath);
      await raw.execute('DROP TABLE pending_ops');

      final entry =
          CarbEntry.create(grams: 45, description: 'Almoço', time: t0);
      await expectLater(
        fileBacked.upsertCarb(entry),
        throwsA(isA<Exception>()),
      );

      // A transação foi desfeita: a linha não ficou órfã no diário.
      final rows = await raw.query('carbs');
      expect(rows, isEmpty);

      await raw.close();
      await fileBacked.close();
    });
  });

  group('IDENT-07: ids com operação pendente', () {
    test('pendingEntityIds devolve os ids da entidade pedida', () async {
      final carb = CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      final insulin = InsulinEntry.create(
        units: 2,
        type: InsulinType.basal,
        time: t0,
        dayOfWeek: kDaysOfWeek[0],
      );
      await dataSource.upsertCarb(carb);
      await dataSource.upsertInsulin(insulin);

      expect(
        await dataSource.pendingEntityIds(PendingOpEntity.carbs),
        {carb.id},
      );
      expect(
        await dataSource.pendingEntityIds(PendingOpEntity.insulin),
        {insulin.id},
      );
      expect(
        await dataSource.pendingEntityIds(PendingOpEntity.alerts),
        isEmpty,
      );
    });

    test('o id sai do conjunto quando a operação é confirmada', () async {
      final carb = CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      await dataSource.upsertCarb(carb);
      final queued = await dataSource.pendingOps();

      await dataSource.deleteOp(queued.single.seq!);

      expect(
        await dataSource.pendingEntityIds(PendingOpEntity.carbs),
        isEmpty,
      );
    });

    test('id apagado continua pendente enquanto o delete não subiu', () async {
      final carb = CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      await dataSource.upsertCarb(carb);

      await dataSource.deleteCarb(carb.id);

      expect(
        await dataSource.pendingEntityIds(PendingOpEntity.carbs),
        {carb.id},
      );
    });
  });

  group('P19: troca de conta esvazia a fila', () {
    test('wipeAllData descarta as operações do dono anterior', () async {
      await dataSource.enqueueOp(
        PendingOp.upsert(
          entity: PendingOpEntity.carbs,
          entityId: 'carb-1',
          payload: {'id': 'carb-1'},
        ),
      );

      await dataSource.wipeAllData();

      expect(await dataSource.pendingOps(), isEmpty);
    });
  });
}
