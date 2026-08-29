import 'package:sqflite/sqflite.dart' as sqflite;
import 'package:sqflite/sqflite.dart'
    show ConflictAlgorithm, Database, DatabaseExecutor, DatabaseFactory;
import 'package:uuid/uuid.dart';

import '../../domain/entities/patient_entities.dart';
import '../sync/pending_op.dart';
import 'patient_datasource.dart';

const _uuid = Uuid();

/// Coleções persistidas localmente (uma tabela por coleção).
enum PatientCollection { readings, alerts, carbs, insulin, settings }

/// Datasource local (sqflite) — fonte primária dos dados do paciente.
///
/// Banco `glucore_patient.db`, colunas espelhando docs/reference/data-models.md
/// mais a flag `synced` (0 = pendente de push ao backend, 1 = já espelhado).
///
/// **O que conta como pendente depende da coleção.** Leituras e thresholds
/// continuam no replace-all: gravam com `synced = 0`, o `PatientSyncService`
/// consulta [pendingCollections] e limpa via `mark*Synced`. Carboidratos,
/// insulina e alertas passaram a viajar pelo op-log: a pendência é a linha em
/// `pending_ops` ([pendingOps], [pendingEntityIds]), não a flag — que nessas
/// três tabelas sobrevive só como marca de origem do dado.
class LocalPatientDataSource implements PatientDataSource {
  LocalPatientDataSource({DatabaseFactory? databaseFactory, String? databasePath})
      : _factory = databaseFactory,
        _databasePath = databasePath;

  static const _dbName = 'glucore_patient.db';
  static const _dbVersion = 3;

  final DatabaseFactory? _factory;
  final String? _databasePath;
  Future<Database>? _database;

  Future<Database> get _db => _database ??= _open();

  Future<Database> _open() async {
    final factory = _factory ?? sqflite.databaseFactory;
    final path = _databasePath ??
        '${await factory.getDatabasesPath()}/$_dbName';
    return factory.openDatabase(
      path,
      options: sqflite.OpenDatabaseOptions(
        version: _dbVersion,
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
          await db.execute(_createAlertsTable);
          await db.execute(_indexAlertsTime);
          await db.execute(_createCarbsTable);
          await db.execute(_indexCarbsTime);
          await db.execute(_createInsulinTable);
          await db.execute(_indexInsulinTime);
          await db.execute('''
            CREATE TABLE settings(
              id INTEGER PRIMARY KEY CHECK(id = 1),
              low INTEGER NOT NULL,
              high INTEGER NOT NULL,
              synced INTEGER NOT NULL DEFAULT 0
            )
          ''');
          await _createMetaTable(db);
          await db.execute(_createPendingOpsTable);
        },
        onUpgrade: (db, oldVersion, newVersion) async {
          // Additive only — never DROP patient data on upgrade.
          if (oldVersion < 2) {
            await _createMetaTable(db);
          }
          if (oldVersion < 3) {
            await _migrateDiaryToUuidKeys(db);
          }
        },
      ),
    );
  }

  // ── schema das coleções do diário (v3) ────────────────────────────────────

  static const _createAlertsTable = '''
        CREATE TABLE alerts(
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          timestamp_ms INTEGER NOT NULL,
          synced INTEGER NOT NULL DEFAULT 0
        )
      ''';
  static const _indexAlertsTime =
      'CREATE INDEX idx_alerts_time ON alerts(timestamp_ms)';

  static const _createCarbsTable = '''
        CREATE TABLE carbs(
          id TEXT PRIMARY KEY,
          time_ms INTEGER NOT NULL,
          grams INTEGER NOT NULL,
          description TEXT NOT NULL,
          synced INTEGER NOT NULL DEFAULT 0
        )
      ''';
  static const _indexCarbsTime =
      'CREATE INDEX idx_carbs_time ON carbs(time_ms)';

  static const _createInsulinTable = '''
        CREATE TABLE insulin(
          id TEXT PRIMARY KEY,
          time_ms INTEGER NOT NULL,
          units REAL NOT NULL,
          type TEXT NOT NULL,
          day_of_week TEXT NOT NULL,
          synced INTEGER NOT NULL DEFAULT 0
        )
      ''';
  static const _indexInsulinTime =
      'CREATE INDEX idx_insulin_time ON insulin(time_ms)';

  /// Op-log do diário (SYNC-01/SYNC-02): `seq` dá a ordem total de drenagem,
  /// independente do relógio do aparelho.
  static const _createPendingOpsTable = '''
        CREATE TABLE pending_ops(
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          entity TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          op TEXT NOT NULL,
          payload_json TEXT,
          created_at INTEGER NOT NULL
        )
      ''';

  /// v2 → v3 (IDENT-05): cria o op-log e troca a PK das três coleções do
  /// diário por `id TEXT`, gerando um UUID v4 por linha existente. Nenhuma
  /// linha do paciente é descartada. O sqflite já executa `onUpgrade` dentro de
  /// uma transação, então uma falha no meio desfaz tudo e o banco permanece na
  /// v2.
  static Future<void> _migrateDiaryToUuidKeys(Database db) async {
    await db.execute(_createPendingOpsTable);
    await _rebuildWithUuidKey(
      db,
      table: 'alerts',
      createTable: _createAlertsTable,
      carriedColumns: ['type', 'timestamp_ms', 'synced'],
      createIndex: _indexAlertsTime,
    );
    await _rebuildWithUuidKey(
      db,
      table: 'carbs',
      createTable: _createCarbsTable,
      carriedColumns: ['time_ms', 'grams', 'description', 'synced'],
      createIndex: _indexCarbsTime,
    );
    await _rebuildWithUuidKey(
      db,
      table: 'insulin',
      createTable: _createInsulinTable,
      carriedColumns: [
        'time_ms',
        'units',
        'type',
        'day_of_week',
        'synced',
      ],
      createIndex: _indexInsulinTime,
    );
  }

  static Future<void> _rebuildWithUuidKey(
    Database db, {
    required String table,
    required String createTable,
    required List<String> carriedColumns,
    required String createIndex,
  }) async {
    final legacyRows = await db.query(table);

    await db.execute(
      createTable.replaceFirst('TABLE $table(', 'TABLE ${table}_new('),
    );

    final batch = db.batch();
    for (final row in legacyRows) {
      batch.insert('${table}_new', {
        'id': _uuid.v4(),
        for (final column in carriedColumns) column: row[column],
      });
    }
    await batch.commit(noResult: true);

    await db.execute('DROP TABLE $table');
    await db.execute('ALTER TABLE ${table}_new RENAME TO $table');
    await db.execute(createIndex);
  }

  /// Single-row table binding the local database to its owning user (P19).
  static Future<void> _createMetaTable(Database db) => db.execute('''
        CREATE TABLE meta(
          id INTEGER PRIMARY KEY CHECK(id = 1),
          owner_user_id TEXT
        )
      ''');

  // ── Ownership (P19) ─────────────────────────────────────────────────────

  /// The user id this local database currently belongs to, or null if unset.
  Future<String?> getOwner() async {
    final db = await _db;
    final rows = await db.query('meta', where: 'id = 1', limit: 1);
    if (rows.isEmpty) return null;
    return rows.first['owner_user_id'] as String?;
  }

  Future<void> setOwner(String userId) async {
    final db = await _db;
    await db.insert(
      'meta',
      {'id': 1, 'owner_user_id': userId},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Clears every patient collection (keeps the `meta` row). Used when a
  /// different account logs in on the same device.
  Future<void> wipeAllData() async {
    final db = await _db;
    await db.transaction((txn) async {
      await txn.delete('readings');
      await txn.delete('alerts');
      await txn.delete('carbs');
      await txn.delete('insulin');
      await txn.delete('settings');
      // A fila vai junto: uma operação do dono anterior enviada sob o novo
      // login gravaria o diário de um paciente na conta de outro (P19).
      await txn.delete('pending_ops');
    });
  }

  // ── op-log do diário (SYNC-01/SYNC-02) ────────────────────────────────────

  /// Enfileira uma operação unitária. Escritas de diário chamam a variante
  /// transacional (uma linha e sua operação nunca se separam).
  Future<void> enqueueOp(PendingOp op) async {
    final db = await _db;
    await db.insert('pending_ops', op.toRow());
  }

  /// Operações pendentes em ordem crescente de `seq` — a ordem em que foram
  /// criadas é a ordem em que precisam chegar ao backend (SYNC-02).
  Future<List<PendingOp>> pendingOps({int limit = 200}) async {
    final db = await _db;
    final rows = await db.query(
      'pending_ops',
      orderBy: 'seq ASC',
      limit: limit,
    );
    return rows.map(PendingOp.fromRow).toList();
  }

  /// Remove uma operação confirmada pelo backend (SYNC-09).
  Future<void> deleteOp(int seq) async {
    final db = await _db;
    await db.delete('pending_ops', where: 'seq = ?', whereArgs: [seq]);
  }

  /// Ids de [entity] com pelo menos uma operação ainda na fila.
  ///
  /// A reconciliação com o servidor usa este conjunto para não sobrescrever uma
  /// entrada que o backend ainda não viu (IDENT-07).
  Future<Set<String>> pendingEntityIds(String entity) async =>
      _pendingIdsIn(await _db, entity);

  static Future<Set<String>> _pendingIdsIn(
    DatabaseExecutor executor,
    String entity,
  ) async {
    final rows = await executor.query(
      'pending_ops',
      columns: ['entity_id'],
      where: 'entity = ?',
      whereArgs: [entity],
      distinct: true,
    );
    return rows.map((row) => row['entity_id']! as String).toSet();
  }

  // ── escritas unitárias do diário (SYNC-01/SYNC-07) ────────────────────────
  //
  // Linha e operação são gravadas na MESMA transação: uma linha sem a sua
  // operação nunca chegaria ao backend, e uma operação sem a sua linha
  // empurraria dado que o paciente não tem.

  Future<void> upsertCarb(CarbEntry entry) => _writeWithOp(
        table: 'carbs',
        row: _carbToRow(entry, synced: 0),
        op: PendingOp.upsert(
          entity: PendingOpEntity.carbs,
          entityId: entry.id,
          payload: entry.toJson(),
        ),
      );

  Future<void> deleteCarb(String id) =>
      _deleteWithOp(table: 'carbs', entity: PendingOpEntity.carbs, id: id);

  Future<void> upsertInsulin(InsulinEntry entry) => _writeWithOp(
        table: 'insulin',
        row: _insulinToRow(entry, synced: 0),
        op: PendingOp.upsert(
          entity: PendingOpEntity.insulin,
          entityId: entry.id,
          payload: entry.toJson(),
        ),
      );

  Future<void> deleteInsulin(String id) =>
      _deleteWithOp(table: 'insulin', entity: PendingOpEntity.insulin, id: id);

  Future<void> upsertAlert(AppAlertItem alert) => _writeWithOp(
        table: 'alerts',
        row: _alertToRow(alert, synced: 0),
        op: PendingOp.upsert(
          entity: PendingOpEntity.alerts,
          entityId: alert.id,
          payload: alert.toJson(),
        ),
      );

  Future<void> _writeWithOp({
    required String table,
    required Map<String, Object?> row,
    required PendingOp op,
  }) async {
    final db = await _db;
    await db.transaction((txn) async {
      await txn.insert(table, row, conflictAlgorithm: ConflictAlgorithm.replace);
      await txn.insert('pending_ops', op.toRow());
    });
  }

  Future<void> _deleteWithOp({
    required String table,
    required String entity,
    required String id,
  }) async {
    final db = await _db;
    await db.transaction((txn) async {
      await txn.delete(table, where: 'id = ?', whereArgs: [id]);
      await txn.insert(
        'pending_ops',
        PendingOp.delete(entity: entity, entityId: id).toRow(),
      );
    });
  }

  Future<void> close() async {
    final open = _database;
    _database = null;
    if (open != null) {
      await (await open).close();
    }
  }

  // ── PatientDataSource ─────────────────────────────────────────────────────

  @override
  Future<PatientSnapshot> load() async {
    final db = await _db;
    final readings = await db.query('readings', orderBy: 'timestamp_ms DESC');
    final alerts = await db.query('alerts', orderBy: 'timestamp_ms DESC');
    final carbs = await db.query('carbs', orderBy: 'time_ms DESC');
    final insulin = await db.query('insulin', orderBy: 'time_ms DESC');
    final settings = await db.query('settings', limit: 1);

    return PatientSnapshot(
      readings: readings.map(_rowToReading).toList(),
      alerts: alerts.map(_rowToAlert).toList(),
      carbs: carbs.map(_rowToCarb).toList(),
      insulin: insulin.map(_rowToInsulin).toList(),
      alertSettings: settings.isEmpty
          ? const AlertSettingsModel(lowThreshold: 80, highThreshold: 180)
          : AlertSettingsModel(
              lowThreshold: settings.first['low'] as int,
              highThreshold: settings.first['high'] as int,
            ),
    );
  }

  @override
  Future<void> saveReadings(List<GlucoseReadingItem> readings) =>
      _replaceTable('readings', readings.map((r) => _readingToRow(r, synced: 0)));

  @override
  Future<void> saveAlerts(List<AppAlertItem> alerts) =>
      _replaceTable('alerts', alerts.map((a) => _alertToRow(a, synced: 0)));

  @override
  Future<void> saveCarbs(List<CarbEntry> carbs) =>
      _replaceTable('carbs', carbs.map((c) => _carbToRow(c, synced: 0)));

  @override
  Future<void> saveInsulin(List<InsulinEntry> insulin) =>
      _replaceTable('insulin', insulin.map((i) => _insulinToRow(i, synced: 0)));

  @override
  Future<void> saveAlertSettings(AlertSettingsModel settings) async {
    final db = await _db;
    await db.insert(
      'settings',
      _settingsToRow(settings, synced: 0),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // ── suporte ao PatientSyncService ─────────────────────────────────────────

  /// Coleções com pelo menos uma linha `synced = 0`.
  Future<Set<PatientCollection>> pendingCollections() async {
    final db = await _db;
    final pending = <PatientCollection>{};
    for (final collection in PatientCollection.values) {
      final rows = await db.rawQuery(
        'SELECT 1 FROM ${_tableOf(collection)} WHERE synced = 0 LIMIT 1',
      );
      if (rows.isNotEmpty) {
        pending.add(collection);
      }
    }
    return pending;
  }

  /// Marca como sincronizadas apenas as linhas cujas chaves foram enviadas —
  /// escritas que corram em paralelo com o push continuam pendentes.
  Future<void> markReadingsSynced(Iterable<GlucoseReadingItem> readings) =>
      _markSyncedByKey('readings', 'timestamp_ms',
          readings.map((r) => r.timestamp.millisecondsSinceEpoch));

  Future<void> markAlertsSynced(Iterable<AppAlertItem> alerts) =>
      _markSyncedByKey('alerts', 'id', alerts.map((a) => a.id));

  Future<void> markCarbsSynced(Iterable<CarbEntry> carbs) =>
      _markSyncedByKey('carbs', 'id', carbs.map((c) => c.id));

  Future<void> markInsulinSynced(Iterable<InsulinEntry> insulin) =>
      _markSyncedByKey('insulin', 'id', insulin.map((i) => i.id));

  Future<void> markSettingsSynced() async {
    final db = await _db;
    await db.update('settings', {'synced': 1});
  }

  /// Persiste um snapshot vindo do servidor com `synced = 1`, sem atropelar o
  /// que ainda não subiu.
  ///
  /// Em leituras, a pendência é `synced = 0`. Nas três coleções do diário, é a
  /// linha citada em `pending_ops`: a entrada com operação na fila sobrevive à
  /// reconciliação e vence o servidor até ser empurrada (IDENT-07).
  Future<void> replaceWithServerSnapshot(PatientSnapshot snapshot) async {
    final db = await _db;
    await db.transaction((txn) async {
      Future<void> replace(
        String table,
        Iterable<Map<String, Object?>> rows,
      ) async {
        await txn.delete(table, where: 'synced = 1');
        final batch = txn.batch();
        for (final row in rows) {
          batch.insert(table, row, conflictAlgorithm: ConflictAlgorithm.ignore);
        }
        await batch.commit(noResult: true);
      }

      Future<void> replaceDiary(
        String table,
        String entity,
        Iterable<Map<String, Object?>> rows,
      ) async {
        final pending = await _pendingIdsIn(txn, entity);
        if (pending.isEmpty) {
          await txn.delete(table);
        } else {
          final marks = List.filled(pending.length, '?').join(', ');
          await txn.delete(
            table,
            where: 'id NOT IN ($marks)',
            whereArgs: pending.toList(),
          );
        }
        final batch = txn.batch();
        for (final row in rows) {
          // `ignore`: a linha pendente com o mesmo id não é sobrescrita pela
          // versão do servidor, que ainda não viu a alteração local.
          batch.insert(table, row, conflictAlgorithm: ConflictAlgorithm.ignore);
        }
        await batch.commit(noResult: true);
      }

      await replace('readings',
          snapshot.readings.map((r) => _readingToRow(r, synced: 1)));
      await replaceDiary('alerts', PendingOpEntity.alerts,
          snapshot.alerts.map((a) => _alertToRow(a, synced: 1)));
      await replaceDiary('carbs', PendingOpEntity.carbs,
          snapshot.carbs.map((c) => _carbToRow(c, synced: 1)));
      await replaceDiary('insulin', PendingOpEntity.insulin,
          snapshot.insulin.map((i) => _insulinToRow(i, synced: 1)));

      final pendingSettings = await txn.query(
        'settings',
        where: 'synced = 0',
        limit: 1,
      );
      if (pendingSettings.isEmpty) {
        await txn.insert(
          'settings',
          _settingsToRow(snapshot.alertSettings, synced: 1),
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  Future<void> _replaceTable(
    String table,
    Iterable<Map<String, Object?>> rows,
  ) async {
    final db = await _db;
    await db.transaction((txn) async {
      await txn.delete(table);
      final batch = txn.batch();
      for (final row in rows) {
        batch.insert(table, row, conflictAlgorithm: ConflictAlgorithm.replace);
      }
      await batch.commit(noResult: true);
    });
  }

  Future<void> _markSyncedByKey(
    String table,
    String keyColumn,
    Iterable<Object> keys,
  ) async {
    final db = await _db;
    final batch = db.batch();
    for (final key in keys) {
      batch.update(
        table,
        {'synced': 1},
        where: '$keyColumn = ?',
        whereArgs: [key],
      );
    }
    await batch.commit(noResult: true);
  }

  static String _tableOf(PatientCollection collection) =>
      collection.name; // enum names casam com os nomes das tabelas

  // ── mappers linha ↔ modelo ────────────────────────────────────────────────

  static GlucoseReadingItem _rowToReading(Map<String, Object?> r) =>
      GlucoseReadingItem(
        value: (r['value'] as num).toDouble(),
        timestamp:
            DateTime.fromMillisecondsSinceEpoch(r['timestamp_ms'] as int),
        trend: GlucoseTrend.values.byName(r['trend'] as String),
        rate: (r['rate'] as num).toDouble(),
        alarmCode: r['alarm_code'] as int?,
      );

  static Map<String, Object?> _readingToRow(
    GlucoseReadingItem r, {
    required int synced,
  }) =>
      {
        'timestamp_ms': r.timestamp.millisecondsSinceEpoch,
        'value': r.value,
        'trend': r.trend.name,
        'rate': r.rate,
        'alarm_code': r.alarmCode,
        'synced': synced,
      };

  static AppAlertItem _rowToAlert(Map<String, Object?> r) => AppAlertItem(
        id: r['id'] as String,
        type: AppAlertType.values.byName(r['type'] as String),
        timestamp:
            DateTime.fromMillisecondsSinceEpoch(r['timestamp_ms'] as int),
      );

  static Map<String, Object?> _alertToRow(
    AppAlertItem a, {
    required int synced,
  }) =>
      {
        'id': a.id,
        'type': a.type.name,
        'timestamp_ms': a.timestamp.millisecondsSinceEpoch,
        'synced': synced,
      };

  static CarbEntry _rowToCarb(Map<String, Object?> r) => CarbEntry(
        id: r['id'] as String,
        grams: r['grams'] as int,
        description: r['description'] as String,
        time: DateTime.fromMillisecondsSinceEpoch(r['time_ms'] as int),
      );

  static Map<String, Object?> _carbToRow(
    CarbEntry c, {
    required int synced,
  }) =>
      {
        'id': c.id,
        'time_ms': c.time.millisecondsSinceEpoch,
        'grams': c.grams,
        'description': c.description,
        'synced': synced,
      };

  static InsulinEntry _rowToInsulin(Map<String, Object?> r) => InsulinEntry(
        id: r['id'] as String,
        units: (r['units'] as num).toDouble(),
        type: InsulinType.values.byName(r['type'] as String),
        time: DateTime.fromMillisecondsSinceEpoch(r['time_ms'] as int),
        dayOfWeek: r['day_of_week'] as String,
      );

  static Map<String, Object?> _insulinToRow(
    InsulinEntry i, {
    required int synced,
  }) =>
      {
        'id': i.id,
        'time_ms': i.time.millisecondsSinceEpoch,
        'units': i.units,
        'type': i.type.name,
        'day_of_week': i.dayOfWeek,
        'synced': synced,
      };

  static Map<String, Object?> _settingsToRow(
    AlertSettingsModel s, {
    required int synced,
  }) =>
      {
        'id': 1,
        'low': s.lowThreshold,
        'high': s.highThreshold,
        'synced': synced,
      };
}
