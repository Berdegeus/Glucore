import 'package:sqflite/sqflite.dart' as sqflite;
import 'package:sqflite/sqflite.dart'
    show ConflictAlgorithm, Database, DatabaseFactory;

import '../../presentation/models/patient_models.dart';
import 'patient_datasource.dart';

/// Coleções persistidas localmente (uma tabela por coleção).
enum PatientCollection { readings, alerts, carbs, insulin, settings }

/// Datasource local (sqflite) — fonte primária dos dados do paciente.
///
/// Banco `glucore_patient.db`, colunas espelhando docs/reference/data-models.md
/// mais a flag `synced` (0 = pendente de push ao backend, 1 = já espelhado).
/// Os `save*` do contrato gravam replace-all com `synced = 0`; o
/// `PatientSyncService` consulta [pendingCollections] e limpa via `mark*Synced`.
class LocalPatientDataSource implements PatientDataSource {
  LocalPatientDataSource({DatabaseFactory? databaseFactory, String? databasePath})
      : _factory = databaseFactory,
        _databasePath = databasePath;

  static const _dbName = 'glucore_patient.db';
  static const _dbVersion = 2;

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
          await _createMetaTable(db);
        },
        onUpgrade: (db, oldVersion, newVersion) async {
          // Additive only — never DROP patient data on upgrade.
          if (oldVersion < 2) {
            await _createMetaTable(db);
          }
        },
      ),
    );
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

  Future<void> markAlertsSynced(Iterable<AppAlertItem> alerts) async {
    final db = await _db;
    final batch = db.batch();
    for (final alert in alerts) {
      batch.update(
        'alerts',
        {'synced': 1},
        where: 'type = ? AND timestamp_ms = ?',
        whereArgs: [alert.type.name, alert.timestamp.millisecondsSinceEpoch],
      );
    }
    await batch.commit(noResult: true);
  }

  Future<void> markCarbsSynced(Iterable<CarbEntry> carbs) =>
      _markSyncedByKey(
          'carbs', 'time_ms', carbs.map((c) => c.time.millisecondsSinceEpoch));

  Future<void> markInsulinSynced(Iterable<InsulinEntry> insulin) =>
      _markSyncedByKey('insulin', 'time_ms',
          insulin.map((i) => i.time.millisecondsSinceEpoch));

  Future<void> markSettingsSynced() async {
    final db = await _db;
    await db.update('settings', {'synced': 1});
  }

  /// Persiste um snapshot vindo do servidor com `synced = 1`, preservando as
  /// linhas locais ainda pendentes (`synced = 0`), que vencem o servidor até
  /// serem empurradas.
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

      await replace('readings',
          snapshot.readings.map((r) => _readingToRow(r, synced: 1)));
      await replace(
          'alerts', snapshot.alerts.map((a) => _alertToRow(a, synced: 1)));
      await replace(
          'carbs', snapshot.carbs.map((c) => _carbToRow(c, synced: 1)));
      await replace(
          'insulin', snapshot.insulin.map((i) => _insulinToRow(i, synced: 1)));

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
    Iterable<int> keys,
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

  static AppAlertItem _rowToAlert(Map<String, Object?> r) => AppAlertItem.create(
        type: AppAlertType.values.byName(r['type'] as String),
        timestamp:
            DateTime.fromMillisecondsSinceEpoch(r['timestamp_ms'] as int),
      );

  static Map<String, Object?> _alertToRow(
    AppAlertItem a, {
    required int synced,
  }) =>
      {
        'type': a.type.name,
        'timestamp_ms': a.timestamp.millisecondsSinceEpoch,
        'synced': synced,
      };

  static CarbEntry _rowToCarb(Map<String, Object?> r) => CarbEntry.create(
        grams: r['grams'] as int,
        description: r['description'] as String,
        time: DateTime.fromMillisecondsSinceEpoch(r['time_ms'] as int),
      );

  static Map<String, Object?> _carbToRow(
    CarbEntry c, {
    required int synced,
  }) =>
      {
        'time_ms': c.time.millisecondsSinceEpoch,
        'grams': c.grams,
        'description': c.description,
        'synced': synced,
      };

  static InsulinEntry _rowToInsulin(Map<String, Object?> r) => InsulinEntry.create(
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
