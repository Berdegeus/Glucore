import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/presentation/models/patient_models.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

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

  final t0 = DateTime.fromMillisecondsSinceEpoch(1000000);
  final t1 = DateTime.fromMillisecondsSinceEpoch(2000000);

  group('readings', () {
    test('round-trip preserves fields and orders desc by timestamp', () async {
      final readings = [
        GlucoseReadingItem(
          value: 110.5,
          timestamp: t0,
          trend: GlucoseTrend.rising,
          rate: 1.25,
          alarmCode: 3,
        ),
        GlucoseReadingItem(
          value: 95,
          timestamp: t1,
          trend: GlucoseTrend.falling,
          rate: -0.5,
          alarmCode: null,
        ),
      ];

      await dataSource.saveReadings(readings);
      final snapshot = await dataSource.load();

      expect(snapshot.readings, hasLength(2));
      expect(snapshot.readings.first.timestamp, t1); // desc
      final oldest = snapshot.readings.last;
      expect(oldest.value, 110.5);
      expect(oldest.trend, GlucoseTrend.rising);
      expect(oldest.rate, 1.25);
      expect(oldest.alarmCode, 3);
      expect(snapshot.readings.first.alarmCode, isNull);
    });

    test('save marks pending, markReadingsSynced clears', () async {
      final readings = [
        GlucoseReadingItem(
          value: 100,
          timestamp: t0,
          trend: GlucoseTrend.stable,
          rate: 0,
        ),
      ];
      await dataSource.saveReadings(readings);
      expect(
        await dataSource.pendingCollections(),
        {PatientCollection.readings},
      );

      await dataSource.markReadingsSynced(readings);
      expect(await dataSource.pendingCollections(), isEmpty);
    });
  });

  group('alerts', () {
    test('round-trip + pending flag + markSynced', () async {
      final alerts = [
        AppAlertItem(type: AppAlertType.glucoseLow, timestamp: t0),
        AppAlertItem(type: AppAlertType.sensorReconnected, timestamp: t0),
      ];
      await dataSource.saveAlerts(alerts);

      final snapshot = await dataSource.load();
      expect(snapshot.alerts, hasLength(2));
      expect(
        snapshot.alerts.map((a) => a.type),
        containsAll([AppAlertType.glucoseLow, AppAlertType.sensorReconnected]),
      );
      expect(
        await dataSource.pendingCollections(),
        {PatientCollection.alerts},
      );

      await dataSource.markAlertsSynced(alerts);
      expect(await dataSource.pendingCollections(), isEmpty);
    });
  });

  group('carbs', () {
    test('round-trip + pending flag + markSynced', () async {
      final carbs = [
        CarbEntry(grams: 45, description: 'Almoço', time: t0),
      ];
      await dataSource.saveCarbs(carbs);

      final snapshot = await dataSource.load();
      expect(snapshot.carbs, hasLength(1));
      expect(snapshot.carbs.first.grams, 45);
      expect(snapshot.carbs.first.description, 'Almoço');
      expect(snapshot.carbs.first.time, t0);
      expect(await dataSource.pendingCollections(), {PatientCollection.carbs});

      await dataSource.markCarbsSynced(carbs);
      expect(await dataSource.pendingCollections(), isEmpty);
    });
  });

  group('insulin', () {
    test('round-trip + pending flag + markSynced', () async {
      final insulin = [
        InsulinEntry(
          units: 4.5,
          type: InsulinType.bolus,
          time: t0,
          dayOfWeek: kDaysOfWeek[2],
        ),
      ];
      await dataSource.saveInsulin(insulin);

      final snapshot = await dataSource.load();
      expect(snapshot.insulin, hasLength(1));
      expect(snapshot.insulin.first.units, 4.5);
      expect(snapshot.insulin.first.type, InsulinType.bolus);
      expect(snapshot.insulin.first.dayOfWeek, kDaysOfWeek[2]);
      expect(
        await dataSource.pendingCollections(),
        {PatientCollection.insulin},
      );

      await dataSource.markInsulinSynced(insulin);
      expect(await dataSource.pendingCollections(), isEmpty);
    });
  });

  group('settings', () {
    test('defaults when never saved', () async {
      final snapshot = await dataSource.load();
      expect(snapshot.alertSettings.lowThreshold, 80);
      expect(snapshot.alertSettings.highThreshold, 180);
      expect(await dataSource.pendingCollections(), isEmpty);
    });

    test('round-trip + pending flag + markSynced', () async {
      await dataSource.saveAlertSettings(
        const AlertSettingsModel(lowThreshold: 70, highThreshold: 200),
      );

      final snapshot = await dataSource.load();
      expect(snapshot.alertSettings.lowThreshold, 70);
      expect(snapshot.alertSettings.highThreshold, 200);
      expect(
        await dataSource.pendingCollections(),
        {PatientCollection.settings},
      );

      await dataSource.markSettingsSynced();
      expect(await dataSource.pendingCollections(), isEmpty);
    });
  });

  group('replaceWithServerSnapshot', () {
    test('server rows land synced=1 and local pending rows survive', () async {
      // Entrada local ainda pendente de push.
      final pendingCarb = CarbEntry(grams: 30, description: 'Lanche', time: t1);
      await dataSource.saveCarbs([pendingCarb]);

      final serverSnapshot = PatientSnapshot(
        readings: [
          GlucoseReadingItem(
            value: 120,
            timestamp: t0,
            trend: GlucoseTrend.stable,
            rate: 0,
          ),
        ],
        alerts: const [],
        carbs: [CarbEntry(grams: 60, description: 'Jantar', time: t0)],
        insulin: const [],
        alertSettings:
            const AlertSettingsModel(lowThreshold: 75, highThreshold: 190),
      );

      await dataSource.replaceWithServerSnapshot(serverSnapshot);
      final snapshot = await dataSource.load();

      // Servidor + pendência local coexistem; a pendência continua pendente.
      expect(snapshot.carbs.map((c) => c.description),
          containsAll(['Lanche', 'Jantar']));
      expect(snapshot.readings, hasLength(1));
      expect(snapshot.alertSettings.lowThreshold, 75);
      expect(await dataSource.pendingCollections(), {PatientCollection.carbs});
    });

    test('pending settings win over server settings', () async {
      await dataSource.saveAlertSettings(
        const AlertSettingsModel(lowThreshold: 65, highThreshold: 210),
      );

      await dataSource.replaceWithServerSnapshot(
        const PatientSnapshot(
          readings: [],
          alerts: [],
          carbs: [],
          insulin: [],
          alertSettings: AlertSettingsModel(lowThreshold: 80, highThreshold: 180),
        ),
      );

      final snapshot = await dataSource.load();
      expect(snapshot.alertSettings.lowThreshold, 65);
      expect(snapshot.alertSettings.highThreshold, 210);
      expect(
        await dataSource.pendingCollections(),
        {PatientCollection.settings},
      );
    });
  });
}
