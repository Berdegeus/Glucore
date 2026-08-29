import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/sync/pending_op.dart';
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
