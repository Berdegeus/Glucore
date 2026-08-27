import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// IDENT-04 e IDENT-05: schema local na versão 3 (chave por `id`) e migração
/// v2 → v3 que preserva o diário do paciente.
void main() {
  sqfliteFfiInit();

  final uuidV4 = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  );

  late Directory tempDir;
  late String dbPath;

  setUp(() {
    tempDir = Directory.systemTemp.createTempSync('glucore_migration_test');
    dbPath = '${tempDir.path}/glucore_patient.db';
  });

  tearDown(() {
    if (tempDir.existsSync()) {
      tempDir.deleteSync(recursive: true);
    }
  });

  /// Cria em [dbPath] um banco exatamente no schema da versão 2.
  Future<void> seedVersion2({String? extraStatement}) async {
    final db = await databaseFactoryFfi.openDatabase(
      dbPath,
      options: OpenDatabaseOptions(
        version: 2,
        onCreate: (db, version) async {
          await db.execute('''
            CREATE TABLE readings(
              timestamp_ms INTEGER PRIMARY KEY,
              value REAL NOT NULL,
              trend TEXT NOT NULL,
              rate REAL NOT NULL,
              alarm_code INTEGER,
              synced INTEGER NOT NULL DEFAULT 0
            )
          ''');
          await db.execute('''
            CREATE TABLE alerts(
              type TEXT NOT NULL,
              timestamp_ms INTEGER NOT NULL,
              synced INTEGER NOT NULL DEFAULT 0,
              PRIMARY KEY(type, timestamp_ms)
            )
          ''');
          await db.execute('''
            CREATE TABLE carbs(
              time_ms INTEGER PRIMARY KEY,
              grams INTEGER NOT NULL,
              description TEXT NOT NULL,
              synced INTEGER NOT NULL DEFAULT 0
            )
          ''');
          await db.execute('''
            CREATE TABLE insulin(
              time_ms INTEGER PRIMARY KEY,
              units REAL NOT NULL,
              type TEXT NOT NULL,
              day_of_week TEXT NOT NULL,
              synced INTEGER NOT NULL DEFAULT 0
            )
          ''');
          await db.execute('''
            CREATE TABLE settings(
              id INTEGER PRIMARY KEY CHECK(id = 1),
              low INTEGER NOT NULL,
              high INTEGER NOT NULL,
              synced INTEGER NOT NULL DEFAULT 0
            )
          ''');
          await db.execute('''
            CREATE TABLE meta(
              id INTEGER PRIMARY KEY CHECK(id = 1),
              owner_user_id TEXT
            )
          ''');
        },
      ),
    );

    await db.insert('carbs',
        {'time_ms': 1000, 'grams': 30, 'description': 'Lanche', 'synced': 1});
    await db.insert('carbs',
        {'time_ms': 2000, 'grams': 60, 'description': 'Jantar', 'synced': 0});
    await db.insert('insulin', {
      'time_ms': 1000,
      'units': 4.5,
      'type': 'bolus',
      'day_of_week': 'Segunda-feira',
      'synced': 1,
    });
    await db.insert('alerts',
        {'type': 'glucoseLow', 'timestamp_ms': 1000, 'synced': 1});
    await db.insert('alerts',
        {'type': 'glucoseHigh', 'timestamp_ms': 2000, 'synced': 0});
    await db.insert('readings', {
      'timestamp_ms': 1000,
      'value': 110.0,
      'trend': 'stable',
      'rate': 0.0,
      'synced': 1,
    });

    if (extraStatement != null) {
      await db.execute(extraStatement);
    }
    await db.close();
  }

  /// Abre o arquivo sem lógica de versão, para inspecionar o schema cru.
  Future<Database> openRaw() => databaseFactoryFfi.openDatabase(dbPath);

  Future<int> userVersion(Database db) async {
    final rows = await db.rawQuery('PRAGMA user_version');
    return rows.first.values.first! as int;
  }

  group('IDENT-04: schema da versão 3', () {
    test('onCreate dá id TEXT PRIMARY KEY e índice de horário às três tabelas',
        () async {
      final dataSource = LocalPatientDataSource(
        databaseFactory: databaseFactoryFfi,
        databasePath: dbPath,
      );
      await dataSource.load();
      await dataSource.close();

      final db = await openRaw();
      expect(await userVersion(db), 3);

      for (final entry in {
        'carbs': 'time_ms',
        'insulin': 'time_ms',
        'alerts': 'timestamp_ms',
      }.entries) {
        final columns = await db.rawQuery('PRAGMA table_info(${entry.key})');
        final idColumn =
            columns.firstWhere((c) => c['name'] == 'id');
        expect(idColumn['type'], 'TEXT',
            reason: '${entry.key}.id deve ser TEXT');
        expect(idColumn['pk'], 1, reason: '${entry.key}.id deve ser a PK');
        expect(
          columns.where((c) => (c['pk'] as int) > 0).length,
          1,
          reason: '${entry.key} deve ter o id como única coluna de PK',
        );

        final indexes = await db.rawQuery('PRAGMA index_list(${entry.key})');
        final indexedColumns = <String>[];
        for (final index in indexes) {
          final info =
              await db.rawQuery('PRAGMA index_info(${index['name']})');
          indexedColumns.addAll(info.map((c) => c['name']! as String));
        }
        expect(indexedColumns, contains(entry.value),
            reason: '${entry.key} deve ter índice sobre ${entry.value}');
      }
      await db.close();
    });
  });

  group('IDENT-05: migração v2 → v3', () {
    test('preserva todas as linhas do diário e preenche um id por linha',
        () async {
      await seedVersion2();

      final dataSource = LocalPatientDataSource(
        databaseFactory: databaseFactoryFfi,
        databasePath: dbPath,
      );
      final snapshot = await dataSource.load();
      await dataSource.close();

      expect(snapshot.carbs, hasLength(2));
      expect(snapshot.insulin, hasLength(1));
      expect(snapshot.alerts, hasLength(2));
      expect(snapshot.readings, hasLength(1));

      final db = await openRaw();
      expect(await userVersion(db), 3);

      final carbs = await db.query('carbs', orderBy: 'time_ms ASC');
      expect(carbs, hasLength(2));
      expect(carbs.map((r) => r['id']! as String), everyElement(matches(uuidV4)));
      expect(carbs.map((r) => r['id']).toSet(), hasLength(2));
      expect(carbs.first['grams'], 30);
      expect(carbs.first['description'], 'Lanche');
      expect(carbs.first['synced'], 1);
      expect(carbs.last['description'], 'Jantar');
      expect(carbs.last['synced'], 0);

      final insulin = await db.query('insulin');
      expect(insulin, hasLength(1));
      expect(insulin.first['id']! as String, matches(uuidV4));
      expect(insulin.first['units'], 4.5);
      expect(insulin.first['type'], 'bolus');
      expect(insulin.first['day_of_week'], 'Segunda-feira');

      final alerts = await db.query('alerts', orderBy: 'timestamp_ms ASC');
      expect(alerts, hasLength(2));
      expect(alerts.map((r) => r['id']! as String), everyElement(matches(uuidV4)));
      expect(alerts.map((r) => r['id']).toSet(), hasLength(2));
      expect(alerts.first['type'], 'glucoseLow');
      expect(alerts.last['type'], 'glucoseHigh');
      expect(alerts.last['synced'], 0);

      await db.close();
    });

    test('falha no meio da migração mantém o banco na v2 sem perder linhas',
        () async {
      // `carbs_new` já ocupado força o CREATE TABLE da migração a falhar.
      await seedVersion2(extraStatement: 'CREATE TABLE carbs_new(x INTEGER)');

      final dataSource = LocalPatientDataSource(
        databaseFactory: databaseFactoryFfi,
        databasePath: dbPath,
      );
      await expectLater(dataSource.load(), throwsA(isA<Exception>()));

      final db = await openRaw();
      expect(await userVersion(db), 2);

      final carbs = await db.query('carbs', orderBy: 'time_ms ASC');
      expect(carbs, hasLength(2));
      expect(carbs.first.containsKey('id'), isFalse);
      expect(carbs.first['description'], 'Lanche');
      expect(carbs.last['description'], 'Jantar');
      expect(await db.query('insulin'), hasLength(1));
      expect(await db.query('alerts'), hasLength(2));

      await db.close();
    });
  });
}
