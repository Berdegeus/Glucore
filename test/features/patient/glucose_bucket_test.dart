import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/domain/glucose_bucket.dart';
import 'package:glucore/features/patient/domain/reading_decimation.dart';

/// O bloco de glicose: as leituras de 15 min contadas por mg/dL inteiro,
/// calculado no aparelho com a resolução cheia e enviado ao servidor.
void main() {
  // Um múltiplo de 15 min do relógio.
  final start = DateTime.fromMillisecondsSinceEpoch(
    glucoseBucketStart(DateTime.utc(2026, 8, 5, 12).millisecondsSinceEpoch),
    isUtc: true,
  );
  DateTime at(int minute, [int second = 0]) =>
      start.add(Duration(minutes: minute, seconds: second));

  GlucoseReadingItem reading(DateTime time, double value) => GlucoseReadingItem(
        value: value,
        timestamp: time,
        trend: GlucoseTrend.stable,
        rate: 0,
      );

  GlucoseBucket bucketOf(Iterable<GlucoseReadingItem> readings) =>
      summarizeBucket(start.millisecondsSinceEpoch, readings)!;

  group('o contrato compartilhado com o backend', () {
    final contract = jsonDecode(
      File('contracts/glucose-histogram.json').readAsStringSync(),
    ) as Map<String, dynamic>;

    test('as constantes são as de contracts/glucose-histogram.json', () {
      expect(glucoseBucketMinMgDl, contract['minMgDl']);
      expect(glucoseBucketMaxMgDl, contract['maxMgDl']);
      expect(glucoseBucketDuration.inMinutes, contract['bucketMinutes']);
      expect(readingUploadSlot.inMinutes, contract['slotMinutes']);
      expect(glucoseBucketSlots, contract['slotsPerBucket']);
      expect(glucoseBucketPushBatchSize, contract['maxBucketsPerRequest']);
      expect(
        glucoseBucketDuration.inMinutes ~/ readingUploadSlot.inMinutes,
        glucoseBucketSlots,
      );
    });
  });

  group('glucoseBucketStart', () {
    test('é o múltiplo de 15 min de UTC logo abaixo', () {
      final ms = start.millisecondsSinceEpoch;
      expect(glucoseBucketStart(ms), ms);
      expect(glucoseBucketStart(ms + 1), ms);
      expect(glucoseBucketStart(ms + 15 * 60000 - 1), ms);
      expect(glucoseBucketStart(ms + 15 * 60000), ms + 15 * 60000);
    });

    test('não depende do fuso do aparelho', () {
      // O mesmo instante, escrito em UTC ou no fuso da máquina, cai no mesmo bloco.
      final instant = DateTime.utc(2026, 8, 5, 23, 59, 59);
      expect(
        glucoseBucketStart(instant.millisecondsSinceEpoch),
        glucoseBucketStart(instant.toLocal().millisecondsSinceEpoch),
      );
    });

    test('um bloco nunca atravessa a meia-noite local de nenhum fuso real', () {
      // Todo deslocamento real é múltiplo de 15 min; os extremos conhecidos:
      for (final offsetMinutes in [-720, -210, -180, 0, 330, 345, 525, 765, 840]) {
        expect(offsetMinutes % 15, 0, reason: 'UTC${offsetMinutes}min');
        // A meia-noite local, em UTC, cai no início de um bloco.
        final localMidnight = DateTime.utc(2026, 8, 5)
            .subtract(Duration(minutes: offsetMinutes))
            .millisecondsSinceEpoch;
        expect(glucoseBucketStart(localMidnight), localMidnight);
      }
    });
  });

  group('summarizeBucket', () {
    test('lista os valores distintos crescentes com as suas contagens', () {
      final bucket = bucketOf([
        reading(at(0), 150),
        reading(at(1), 100),
        reading(at(2), 150),
        reading(at(3), 100),
        reading(at(4), 150),
      ]);

      expect(bucket.mgDl, [100, 150]);
      expect(bucket.counts, [2, 3]);
      expect(bucket.readingsCount, 5);
    });

    test('as contagens somam o número de leituras', () {
      final bucket = bucketOf([
        for (var m = 0; m < 15; m++) reading(at(m), 90.0 + m % 4),
      ]);

      expect(bucket.counts.reduce((a, b) => a + b), 15);
      expect(bucket.readingsCount, 15);
    });

    test('arredonda como o servidor: a metade sobe', () {
      final bucket = bucketOf([
        reading(at(0), 99.5),
        reading(at(1), 99.4),
        reading(at(2), 100.49),
      ]);

      expect(bucket.mgDl, [99, 100]);
      expect(bucket.counts, [1, 2]); // 99.4 → 99; 99.5 e 100.49 → 100
    });

    test('um valor fora da faixa conta no extremo mais próximo', () {
      final bucket = bucketOf([
        reading(at(0), 12),
        reading(at(1), 39.4),
        reading(at(2), 940),
      ]);

      expect(bucket.mgDl, [40, 600]);
      expect(bucket.counts, [2, 1]);
    });

    test('os intervalos de 5 min cobertos são os com leitura, não as leituras', () {
      final bucket = bucketOf([
        reading(at(0), 100),
        reading(at(1), 101),
        reading(at(4), 102), // mesmo intervalo das duas acima
        reading(at(5), 103), // o seguinte
      ]);

      expect(bucket.readingsCount, 4);
      expect(bucket.coveredSlots, 2);
    });

    test('um bloco cheio a 1/min cobre os 3 intervalos', () {
      final bucket = bucketOf([for (var m = 0; m < 15; m++) reading(at(m), 100)]);

      expect(bucket.coveredSlots, glucoseBucketSlots);
    });

    test('um sensor a cada 15 min cobre 1 intervalo por bloco', () {
      expect(bucketOf([reading(at(7), 100)]).coveredSlots, 1);
    });

    test('leva o início do bloco', () {
      expect(bucketOf([reading(at(3), 100)]).startMs, start.millisecondsSinceEpoch);
    });

    test('sem leituras não há bloco', () {
      expect(summarizeBucket(start.millisecondsSinceEpoch, const []), isNull);
    });

    test('toJson tem exatamente o formato que o servidor valida', () {
      final json = bucketOf([reading(at(0), 100)]).toJson();

      expect(json, {
        'startMs': start.millisecondsSinceEpoch,
        'readingsCount': 1,
        'coveredSlots': 1,
        'mgDl': [100],
        'counts': [1],
      });
    });

    test('um bloco com os 561 valores possíveis ainda é válido', () {
      final bucket = bucketOf([
        for (var v = glucoseBucketMinMgDl; v <= glucoseBucketMaxMgDl; v++)
          reading(at(v % 15), v.toDouble()),
      ]);

      expect(bucket.mgDl, hasLength(561));
      expect(bucket.mgDl, orderedEquals([...bucket.mgDl]..sort()));
      expect(bucket.readingsCount, 561);
    });
  });
}
