import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/domain/daily_summary.dart';
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

    GlucoseReadingItem reading(int ms, double value) => GlucoseReadingItem(
          value: value,
          timestamp: DateTime.fromMillisecondsSinceEpoch(ms),
          trend: GlucoseTrend.stable,
          rate: 0,
        );

    test('keeps every reading beyond the old 288 cap', () async {
      final many = [for (var i = 0; i < 1500; i++) reading(i * 1000, 100)];

      await dataSource.saveReadings(many);

      expect((await dataSource.load()).readings, hasLength(1500));
    });

    test('re-saving unchanged readings keeps them synced; only new or changed '
        'ones go back to pending', () async {
      final first = [reading(1000, 100), reading(2000, 110), reading(3000, 120)];
      await dataSource.saveReadings(first);
      await dataSource.markReadingsSynced(first);
      expect(await dataSource.pendingReadings(), isEmpty);

      await dataSource.saveReadings([
        ...first.take(2),
        reading(3000, 125), // same timestamp, new value
        reading(4000, 130), // new
      ]);

      final pending = await dataSource.pendingReadings();
      expect(
        pending.map((r) => r.timestamp.millisecondsSinceEpoch).toSet(),
        {3000, 4000},
      );
    });

    test('a reading missing from the saved set is deleted', () async {
      await dataSource.saveReadings([reading(1000, 100), reading(2000, 110)]);

      await dataSource.saveReadings([reading(2000, 110)]);

      final left = (await dataSource.load()).readings;
      expect(left.map((r) => r.timestamp.millisecondsSinceEpoch), [2000]);
    });

    test('pendingReadings lists only unsynced rows, newest first', () async {
      final all = [reading(1000, 100), reading(2000, 110), reading(3000, 120)];
      await dataSource.saveReadings(all);
      await dataSource.markReadingsSynced([all[1]]);

      final pending = await dataSource.pendingReadings();

      expect(pending.map((r) => r.timestamp.millisecondsSinceEpoch), [3000, 1000]);
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

    group('leituras do servidor são incorporadas, não substituídas', () {
      // Um múltiplo de 5 min, para os intervalos caírem onde se espera.
      final slot0 = DateTime.fromMillisecondsSinceEpoch(
        1700000100000 - 1700000100000 % 300000,
      );
      GlucoseReadingItem reading(DateTime time, double value) => GlucoseReadingItem(
            value: value,
            timestamp: time,
            trend: GlucoseTrend.stable,
            rate: 0,
          );
      PatientSnapshot snapshotOf(List<GlucoseReadingItem> readings) => PatientSnapshot(
            readings: readings,
            alerts: const [],
            carbs: const [],
            insulin: const [],
            alertSettings:
                const AlertSettingsModel(lowThreshold: 80, highThreshold: 180),
          );

      test('nunca apaga: o servidor devolver pouco ou nada preserva o que há',
          () async {
        final minutes = [
          for (var m = 0; m < 10; m++)
            reading(slot0.add(Duration(minutes: m)), 100.0 + m),
        ];
        await dataSource.saveReadings(minutes);
        await dataSource.markReadingsSynced(minutes);

        await dataSource.replaceWithServerSnapshot(snapshotOf(const []));

        expect((await dataSource.load()).readings, hasLength(10));
      });

      test('uma linha do servidor num intervalo que o aparelho já tem é ignorada',
          () async {
        final minutes = [
          for (var m = 0; m < 5; m++)
            reading(slot0.add(Duration(minutes: m)), 100.0 + m),
        ];
        await dataSource.saveReadings(minutes);
        await dataSource.markReadingsSynced(minutes);

        // O servidor tem o intervalo, carimbado no início, com outro valor.
        await dataSource
            .replaceWithServerSnapshot(snapshotOf([reading(slot0, 999)]));

        final stored = (await dataSource.load()).readings;
        expect(stored, hasLength(5));
        expect(stored.any((r) => r.value == 999), isFalse);
      });

      test('uma linha do servidor num intervalo vazio entra, já sincronizada',
          () async {
        final next = slot0.add(const Duration(minutes: 5));
        await dataSource.replaceWithServerSnapshot(
          snapshotOf([reading(slot0, 100), reading(next, 110)]),
        );

        expect((await dataSource.load()).readings.map((r) => r.value),
            [110, 100]);
        expect(await dataSource.pendingReadings(), isEmpty);
      });

      test('o intervalo vizinho de uma leitura local não a bloqueia', () async {
        await dataSource.saveReadings([reading(slot0.add(const Duration(minutes: 4)), 104)]);

        await dataSource.replaceWithServerSnapshot(snapshotOf([
          reading(slot0.add(const Duration(minutes: 5)), 105),
        ]));

        expect((await dataSource.load()).readings, hasLength(2));
      });

      test('uma leitura pendente não é tocada pelo servidor', () async {
        final pending = reading(slot0.add(const Duration(minutes: 2)), 102);
        await dataSource.saveReadings([pending]);

        await dataSource.replaceWithServerSnapshot(snapshotOf([reading(slot0, 999)]));

        expect((await dataSource.pendingReadings()).single.value, 102);
        expect((await dataSource.load()).readings.single.value, 102);
      });

      test('a marca d\'água é a leitura mais nova do servidor e não recua',
          () async {
        expect(await dataSource.readingsWatermarkMs(), isNull);

        final newer = slot0.add(const Duration(minutes: 30));
        await dataSource.replaceWithServerSnapshot(
          snapshotOf([reading(newer, 1), reading(slot0, 2)]),
        );
        expect(await dataSource.readingsWatermarkMs(), newer.millisecondsSinceEpoch);

        await dataSource.replaceWithServerSnapshot(snapshotOf([reading(slot0, 2)]));
        expect(await dataSource.readingsWatermarkMs(), newer.millisecondsSinceEpoch);
      });

      test('um snapshot sem leituras deixa a marca d\'água onde estava', () async {
        await dataSource.replaceWithServerSnapshot(snapshotOf([reading(slot0, 2)]));

        await dataSource.replaceWithServerSnapshot(snapshotOf(const []));

        expect(await dataSource.readingsWatermarkMs(), slot0.millisecondsSinceEpoch);
      });

      test('a marca d\'água vale mesmo sem dono gravado, e não o apaga', () async {
        await dataSource.setOwner('user-1');
        await dataSource.replaceWithServerSnapshot(snapshotOf([reading(slot0, 2)]));

        expect(await dataSource.getOwner(), 'user-1');
        expect(await dataSource.readingsWatermarkMs(), isNotNull);
      });

      test('trocar de conta zera a marca d\'água junto com os dados', () async {
        await dataSource.setOwner('user-1');
        await dataSource.replaceWithServerSnapshot(snapshotOf([reading(slot0, 2)]));

        await dataSource.wipeAllData();

        expect(await dataSource.readingsWatermarkMs(), isNull);
        expect(await dataSource.getOwner(), 'user-1');
        expect((await dataSource.load()).readings, isEmpty);
      });

      test('readingsBetween devolve o intervalo semiaberto, em ordem', () async {
        await dataSource.saveReadings([
          for (var m = 0; m < 10; m++)
            reading(slot0.add(Duration(minutes: m)), 100.0 + m),
        ]);

        final inRange = await dataSource.readingsBetween(
          slot0.add(const Duration(minutes: 2)).millisecondsSinceEpoch,
          slot0.add(const Duration(minutes: 5)).millisecondsSinceEpoch,
        );

        expect(inRange.map((r) => r.value), [102, 103, 104]);
      });
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

  group('resumo diário', () {
    const brasilia = FixedOffsetDayCutter(-180);
    late LocalPatientDataSource summaries;

    setUp(() {
      summaries = LocalPatientDataSource(
        databaseFactory: databaseFactoryFfi,
        databasePath: inMemoryDatabasePath,
        dayCutter: brasilia,
      );
    });

    tearDown(() => summaries.close());

    // 05/08/2026 00:00 em Brasília.
    final midnight = DateTime.utc(2026, 8, 5, 3);
    GlucoseReadingItem at(Duration offset, double value) => GlucoseReadingItem(
          value: value,
          timestamp: midnight.add(offset),
          trend: GlucoseTrend.stable,
          rate: 0,
        );
    DailySummary summaryOf(int count, {int value = 100, String day = '2026-08-05'}) =>
        DailySummary(
          localDate: day,
          utcOffsetMinutes: -180,
          readingsCount: count,
          coveredSlots: 1,
          histogram: [
            for (var i = 0; i < glucoseHistogramBins; i++)
              i == value - glucoseHistogramMinMgDl ? count : 0,
          ],
        );

    group('dias sujos', () {
      test('guardar leituras marca o dia delas, no corte do paciente', () async {
        await summaries.saveReadings([
          at(const Duration(hours: -1), 90), // 23:00 de 04/08
          at(const Duration(hours: 1), 100), // 01:00 de 05/08
        ]);

        expect(await summaries.dirtySummaryDays(), ['2026-08-04', '2026-08-05']);
      });

      test('regravar o mesmo conjunto não suja de novo', () async {
        final readings = [at(const Duration(hours: 1), 100)];
        await summaries.saveReadings(readings);
        await summaries.saveDailySummary(
          summarizeDay('2026-08-05', readings, brasilia)!,
          nowMs: 1,
        );

        await summaries.saveReadings(readings);

        expect(await summaries.dirtySummaryDays(), isEmpty);
      });

      test('uma leitura nova suja só o dia dela', () async {
        final first = [at(const Duration(hours: 1), 100)];
        await summaries.saveReadings(first);
        await summaries.saveDailySummary(
          summarizeDay('2026-08-05', first, brasilia)!,
          nowMs: 1,
        );

        await summaries.saveReadings([...first, at(const Duration(days: 1, hours: 1), 110)]);

        expect(await summaries.dirtySummaryDays(), ['2026-08-06']);
      });

      test('uma leitura que sai do conjunto (a poda) não suja o dia', () async {
        final readings = [
          at(const Duration(hours: 1), 100),
          at(const Duration(days: 1, hours: 1), 110),
        ];
        await summaries.saveReadings(readings);
        for (final day in ['2026-08-05', '2026-08-06']) {
          await summaries.clearSummaryDirty(day);
        }

        await summaries.saveReadings([readings.last]); // a de 05/08 foi podada

        expect(await summaries.dirtySummaryDays(), isEmpty);
      });

      test('readingsOnLocalDay devolve as leituras do dia e só elas', () async {
        await summaries.saveReadings([
          at(const Duration(minutes: -1), 90), // 23:59 de 04/08
          at(Duration.zero, 100), // 00:00 de 05/08
          at(const Duration(hours: 23, minutes: 59), 110), // 23:59 de 05/08
          at(const Duration(days: 1), 120), // 00:00 de 06/08
        ]);

        final day = await summaries.readingsOnLocalDay('2026-08-05');

        expect(day.map((r) => r.value), [100, 110]);
      });
    });

    group('saveDailySummary', () {
      test('um dia novo fica pendente e sai da fila de sujos', () async {
        await summaries.saveReadings([at(const Duration(hours: 1), 100)]);

        await summaries.saveDailySummary(summaryOf(10), nowMs: 5);

        expect((await summaries.pendingDailySummaries()).single.readingsCount, 10);
        expect(await summaries.dirtySummaryDays(), isEmpty);
        expect(await summaries.dailySummaryComputedAtMs('2026-08-05'), 5);
      });

      test('o histograma sobrevive ao armazenamento', () async {
        await summaries.saveDailySummary(summaryOf(10, value: 137), nowMs: 1);

        final stored = (await summaries.pendingDailySummaries()).single;

        expect(stored.histogram, summaryOf(10, value: 137).histogram);
        expect(stored.utcOffsetMinutes, -180);
        expect(stored.coveredSlots, 1);
      });

      test('um dia só cresce: com menos leituras, o guardado fica', () async {
        await summaries.saveDailySummary(summaryOf(1000), nowMs: 1);

        await summaries.saveDailySummary(summaryOf(288, value: 150), nowMs: 2);

        final stored = (await summaries.pendingDailySummaries()).single;
        expect(stored.readingsCount, 1000);
        expect(stored.histogram[100 - 40], 1000);
        expect(await summaries.dailySummaryComputedAtMs('2026-08-05'), 1);
      });

      test('com mais leituras, substitui e volta a ser pendente', () async {
        await summaries.saveDailySummary(summaryOf(10), nowMs: 1);
        await summaries.markDailySummariesSynced([summaryOf(10)]);
        expect(await summaries.pendingDailySummaries(), isEmpty);

        await summaries.saveDailySummary(summaryOf(20), nowMs: 2);

        expect((await summaries.pendingDailySummaries()).single.readingsCount, 20);
      });

      test('igual ao já enviado, não volta a ser pendente', () async {
        await summaries.saveDailySummary(summaryOf(10), nowMs: 1);
        await summaries.markDailySummariesSynced([summaryOf(10)]);

        await summaries.saveDailySummary(summaryOf(10), nowMs: 2);

        expect(await summaries.pendingDailySummaries(), isEmpty);
      });

      test('mesma contagem e outro histograma é uma correção: substitui', () async {
        await summaries.saveDailySummary(summaryOf(10, value: 100), nowMs: 1);
        await summaries.markDailySummariesSynced([summaryOf(10, value: 100)]);

        await summaries.saveDailySummary(summaryOf(10, value: 120), nowMs: 2);

        expect((await summaries.pendingDailySummaries()).single.histogram[120 - 40], 10);
      });

      test('os pendentes saem do dia mais antigo ao mais novo', () async {
        await summaries.saveDailySummary(summaryOf(5, day: '2026-08-07'), nowMs: 1);
        await summaries.saveDailySummary(summaryOf(5, day: '2026-08-05'), nowMs: 1);
        await summaries.saveDailySummary(summaryOf(5, day: '2026-08-06'), nowMs: 1);

        expect((await summaries.pendingDailySummaries()).map((s) => s.localDate),
            ['2026-08-05', '2026-08-06', '2026-08-07']);
      });
    });

    group('markDailySummariesSynced', () {
      test('um dia recalculado no meio do envio continua pendente', () async {
        await summaries.saveDailySummary(summaryOf(10), nowMs: 1);
        final sent = await summaries.pendingDailySummaries();
        // Enquanto o PUT estava no ar, o dia cresceu.
        await summaries.saveDailySummary(summaryOf(20), nowMs: 2);

        await summaries.markDailySummariesSynced(sent);

        expect((await summaries.pendingDailySummaries()).single.readingsCount, 20);
      });
    });

    test('trocar de conta apaga os resumos e os dias sujos', () async {
      await summaries.saveReadings([at(const Duration(hours: 1), 100)]);
      await summaries.saveDailySummary(summaryOf(10), nowMs: 1);
      await summaries.saveReadings([at(const Duration(days: 1, hours: 1), 100)]);

      await summaries.wipeAllData();

      expect(await summaries.pendingDailySummaries(), isEmpty);
      expect(await summaries.dirtySummaryDays(), isEmpty);
      expect(await summaries.dailySummaryComputedAtMs('2026-08-05'), isNull);
    });
  });
}
