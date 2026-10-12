import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/domain/daily_summary.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/domain/reading_decimation.dart';

/// O resumo diário: contagens por mg/dL inteiro, calculadas no aparelho com a
/// resolução cheia e enviadas ao servidor.
void main() {
  const brasilia = FixedOffsetDayCutter(-180);

  // Meia-noite de Brasília em 5 de agosto de 2026 (03:00 UTC).
  final midnight = DateTime.utc(2026, 8, 5, 3);
  DateTime at(int minute) => midnight.add(Duration(minutes: minute));

  GlucoseReadingItem reading(DateTime time, double value) => GlucoseReadingItem(
        value: value,
        timestamp: time,
        trend: GlucoseTrend.stable,
        rate: 0,
      );

  group('o contrato compartilhado com o backend', () {
    final contract = jsonDecode(
      File('contracts/glucose-histogram.json').readAsStringSync(),
    ) as Map<String, dynamic>;

    test('as constantes são as de contracts/glucose-histogram.json', () {
      expect(glucoseHistogramMinMgDl, contract['minMgDl']);
      expect(glucoseHistogramMaxMgDl, contract['maxMgDl']);
      expect(glucoseHistogramBins, contract['bins']);
      expect(readingUploadSlot.inMinutes, contract['slotMinutes']);
      expect(dailySummaryPushBatchSize, contract['maxDaysPerRequest']);
    });
  });

  group('summarizeDay', () {
    test('conta as leituras por mg/dL, o índice 0 sendo 40', () {
      final summary = summarizeDay(
        '2026-08-05',
        [
          reading(at(0), 100),
          reading(at(1), 100),
          reading(at(2), 40),
          reading(at(3), 600),
        ],
        brasilia,
      )!;

      expect(summary.histogram, hasLength(glucoseHistogramBins));
      expect(summary.histogram[100 - 40], 2);
      expect(summary.histogram[0], 1);
      expect(summary.histogram.last, 1);
    });

    test('o histograma soma o número de leituras', () {
      final readings = [for (var m = 0; m < 300; m++) reading(at(m), 60.0 + m % 200)];

      final summary = summarizeDay('2026-08-05', readings, brasilia)!;

      expect(summary.readingsCount, 300);
      expect(summary.histogram.reduce((a, b) => a + b), 300);
    });

    test('arredonda como o servidor: a metade sobe', () {
      final summary = summarizeDay(
        '2026-08-05',
        [reading(at(0), 99.5), reading(at(1), 99.4), reading(at(2), 100.49)],
        brasilia,
      )!;

      expect(summary.histogram[100 - 40], 2); // 99.5 e 100.49
      expect(summary.histogram[99 - 40], 1); // 99.4
    });

    test('um valor fora da faixa conta no extremo mais próximo', () {
      final summary = summarizeDay(
        '2026-08-05',
        [reading(at(0), 12), reading(at(1), 39.4), reading(at(2), 940)],
        brasilia,
      )!;

      expect(summary.histogram[0], 2);
      expect(summary.histogram.last, 1);
      expect(summary.readingsCount, 3);
    });

    test('os intervalos cobertos são os de 5 min com leitura, não as leituras', () {
      final summary = summarizeDay(
        '2026-08-05',
        [
          reading(at(0), 100),
          reading(at(1), 101),
          reading(at(4), 102), // mesmo intervalo das duas acima
          reading(at(5), 103), // o seguinte
          reading(at(60), 104), // uma hora depois
        ],
        brasilia,
      )!;

      expect(summary.readingsCount, 5);
      expect(summary.coveredSlots, 3);
    });

    test('um sensor que entrega a cada 15 min cobre um intervalo por leitura', () {
      final summary = summarizeDay(
        '2026-08-05',
        [for (var m = 0; m < 24 * 60; m += 15) reading(at(m), 100)],
        brasilia,
      )!;

      expect(summary.readingsCount, 96);
      expect(summary.coveredSlots, 96);
    });

    test('um dia cheio a 1/min cobre 288 intervalos', () {
      final summary = summarizeDay(
        '2026-08-05',
        [for (var m = 0; m < 24 * 60; m++) reading(at(m), 100)],
        brasilia,
      )!;

      expect(summary.readingsCount, 1440);
      expect(summary.coveredSlots, 288);
    });

    test('leva a data local e o deslocamento do corte', () {
      final summary = summarizeDay('2026-08-05', [reading(at(0), 100)], brasilia)!;

      expect(summary.localDate, '2026-08-05');
      expect(summary.utcOffsetMinutes, -180);
    });

    test('sem leituras não há resumo', () {
      expect(summarizeDay('2026-08-05', const [], brasilia), isNull);
    });

    test('toJson tem exatamente o formato que o servidor valida', () {
      final json = summarizeDay('2026-08-05', [reading(at(0), 100)], brasilia)!.toJson();

      expect(json.keys, unorderedEquals([
        'localDate',
        'utcOffsetMinutes',
        'readingsCount',
        'coveredSlots',
        'histogram',
      ]));
      expect(json['histogram'], isA<List<int>>());
    });
  });

  group('FixedOffsetDayCutter', () {
    test('o dia vira à meia-noite local, não à de UTC', () {
      expect(brasilia.keyOf(DateTime.utc(2026, 8, 5, 2, 59)), '2026-08-04');
      expect(brasilia.keyOf(DateTime.utc(2026, 8, 5, 3)), '2026-08-05');
      expect(brasilia.keyOf(DateTime.utc(2026, 8, 6, 2, 59)), '2026-08-05');
    });

    test('os limites do dia são [meia-noite, meia-noite seguinte)', () {
      final (start, end) = brasilia.boundsOf('2026-08-05');

      expect(start.toUtc(), DateTime.utc(2026, 8, 5, 3));
      expect(end.toUtc(), DateTime.utc(2026, 8, 6, 3));
    });

    test('a leitura no último milissegundo do dia ainda é dele', () {
      final (start, end) = brasilia.boundsOf('2026-08-05');

      expect(brasilia.keyOf(end.subtract(const Duration(milliseconds: 1))), '2026-08-05');
      expect(brasilia.keyOf(end), '2026-08-06');
      expect(brasilia.keyOf(start), '2026-08-05');
    });

    test('um fuso a leste de UTC corta do outro lado', () {
      const kolkata = FixedOffsetDayCutter(330);
      expect(kolkata.keyOf(DateTime.utc(2026, 8, 5, 18, 29)), '2026-08-05');
      expect(kolkata.keyOf(DateTime.utc(2026, 8, 5, 18, 30)), '2026-08-06');
      expect(kolkata.offsetMinutes('2026-08-05'), 330);
    });
  });

  group('DeviceDayCutter (o fuso desta máquina, qualquer que seja)', () {
    const device = DeviceDayCutter();

    test('keyOf e boundsOf concordam', () {
      for (final key in ['2026-01-15', '2026-03-08', '2026-07-01', '2026-11-01']) {
        final (start, end) = device.boundsOf(key);
        expect(device.keyOf(start), key);
        expect(device.keyOf(end.subtract(const Duration(milliseconds: 1))), key);
        expect(device.keyOf(end), isNot(key));
      }
    });

    test('o deslocamento é o do meio-dia local', () {
      expect(device.offsetMinutes('2026-08-05'),
          DateTime(2026, 8, 5, 12).timeZoneOffset.inMinutes);
    });
  });
}
