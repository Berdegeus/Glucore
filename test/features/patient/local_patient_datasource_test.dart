import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
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
        AppAlertItem.create(type: AppAlertType.glucoseLow, timestamp: t0),
        AppAlertItem.create(type: AppAlertType.sensorReconnected, timestamp: t0),
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
        CarbEntry.create(grams: 45, description: 'Almoço', time: t0),
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
        InsulinEntry.create(
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

  group('IDENT-04/IDENT-07: linhas do diário chaveadas por id', () {
    test('duas entradas de carboidrato no mesmo time_ms persistem as duas',
        () async {
      final first = CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      final second =
          CarbEntry.create(grams: 60, description: 'Jantar', time: t0);

      await dataSource.saveCarbs([first, second]);
      final snapshot = await dataSource.load();

      expect(snapshot.carbs, hasLength(2));
      expect(
        snapshot.carbs.map((c) => c.id),
        containsAll([first.id, second.id]),
      );
      expect(
        snapshot.carbs.map((c) => c.description),
        containsAll(['Lanche', 'Jantar']),
      );
    });

    test('duas entradas no mesmo time_ms são atualizáveis independentemente',
        () async {
      final first = CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      final second =
          CarbEntry.create(grams: 60, description: 'Jantar', time: t0);
      await dataSource.saveCarbs([first, second]);

      // Muda o horário e as gramas só da primeira.
      await dataSource
          .saveCarbs([first.copyWith(time: t1, grams: 35), second]);
      final snapshot = await dataSource.load();

      expect(snapshot.carbs, hasLength(2));
      final edited = snapshot.carbs.firstWhere((c) => c.id == first.id);
      final untouched = snapshot.carbs.firstWhere((c) => c.id == second.id);
      expect(edited.time, t1);
      expect(edited.grams, 35);
      expect(untouched.time, t0);
      expect(untouched.grams, 60);
      expect(untouched.description, 'Jantar');
    });

    test('markCarbsSynced marca só a linha do id enviado', () async {
      final first = CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      final second =
          CarbEntry.create(grams: 60, description: 'Jantar', time: t0);
      await dataSource.saveCarbs([first, second]);

      await dataSource.markCarbsSynced([first]);
      expect(await dataSource.pendingCollections(), {PatientCollection.carbs});

      await dataSource.markCarbsSynced([second]);
      expect(await dataSource.pendingCollections(), isEmpty);
    });

    test('markCarbsSynced casa por id mesmo com o horário alterado', () async {
      final entry = CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      await dataSource.saveCarbs([entry]);

      // Mesmo id, horário diferente do gravado: o casamento é por id.
      await dataSource.markCarbsSynced([entry.copyWith(time: t1)]);

      expect(await dataSource.pendingCollections(), isEmpty);
    });

    test('markInsulinSynced casa por id mesmo com o horário alterado',
        () async {
      final entry = InsulinEntry.create(
        units: 4.5,
        type: InsulinType.bolus,
        time: t0,
        dayOfWeek: kDaysOfWeek[2],
      );
      await dataSource.saveInsulin([entry]);

      await dataSource.markInsulinSynced([entry.copyWith(time: t1)]);

      expect(await dataSource.pendingCollections(), isEmpty);
    });

    test('dois alertas do mesmo tipo e horário persistem e sincronizam por id',
        () async {
      final first =
          AppAlertItem.create(type: AppAlertType.glucoseLow, timestamp: t0);
      final second =
          AppAlertItem.create(type: AppAlertType.glucoseLow, timestamp: t0);
      await dataSource.saveAlerts([first, second]);

      final snapshot = await dataSource.load();
      expect(snapshot.alerts, hasLength(2));
      expect(
        snapshot.alerts.map((a) => a.id),
        containsAll([first.id, second.id]),
      );

      await dataSource.markAlertsSynced([first]);
      expect(await dataSource.pendingCollections(), {PatientCollection.alerts});

      await dataSource.markAlertsSynced([second]);
      expect(await dataSource.pendingCollections(), isEmpty);
    });

    test('o id sobrevive ao round-trip das três coleções', () async {
      final carb = CarbEntry.create(grams: 45, description: 'Almoço', time: t0);
      final insulin = InsulinEntry.create(
        units: 4.5,
        type: InsulinType.bolus,
        time: t0,
        dayOfWeek: kDaysOfWeek[2],
      );
      final alert =
          AppAlertItem.create(type: AppAlertType.syncFailure, timestamp: t0);

      await dataSource.saveCarbs([carb]);
      await dataSource.saveInsulin([insulin]);
      await dataSource.saveAlerts([alert]);
      final snapshot = await dataSource.load();

      expect(snapshot.carbs.single.id, carb.id);
      expect(snapshot.insulin.single.id, insulin.id);
      expect(snapshot.alerts.single.id, alert.id);
    });
  });

  group('replaceWithServerSnapshot', () {
    test('server rows land synced=1 and local pending rows survive', () async {
      // Entrada local ainda pendente de push: a pendência do diário é a
      // operação em `pending_ops`, não a flag `synced` (IDENT-07).
      final pendingCarb = CarbEntry.create(grams: 30, description: 'Lanche', time: t1);
      await dataSource.upsertCarb(pendingCarb);

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
        carbs: [CarbEntry.create(grams: 60, description: 'Jantar', time: t0)],
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
