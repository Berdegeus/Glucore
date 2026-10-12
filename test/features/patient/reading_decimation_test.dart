import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/domain/reading_decimation.dart';

/// A regra de quais leituras sobem ao servidor: uma por intervalo de 5 min,
/// fechado, carimbada com o início do intervalo.
void main() {
  // Um múltiplo de 5 min do relógio, para os intervalos caírem onde se espera.
  final base = DateTime.fromMillisecondsSinceEpoch(
    readingSlotStart(DateTime.utc(2026, 8, 5, 12).millisecondsSinceEpoch),
  );
  DateTime min(int m, [int s = 0]) =>
      base.add(Duration(minutes: m, seconds: s));

  GlucoseReadingItem at(DateTime time, double value) => GlucoseReadingItem(
        value: value,
        timestamp: time,
        trend: GlucoseTrend.rising,
        rate: 1.5,
        alarmCode: 2,
      );

  final farFuture = base.add(const Duration(days: 1));

  group('readingSlotStart', () {
    test('é o múltiplo de 5 min do relógio logo abaixo', () {
      final ms = base.millisecondsSinceEpoch;
      expect(readingSlotStart(ms), ms);
      expect(readingSlotStart(ms + 1), ms);
      expect(readingSlotStart(ms + 299999), ms);
      expect(readingSlotStart(ms + 300000), ms + 300000);
    });
  });

  group('planReadingUpload', () {
    test('uma linha por intervalo, a mais antiga, carimbada com o início', () {
      final readings = [
        for (var m = 0; m < 10; m++) at(min(m, 20), 100.0 + m),
      ];

      final plan = planReadingUpload(
        pending: readings,
        local: readings,
        now: farFuture,
      );

      expect(plan.map((u) => u.reading.timestamp), [min(0), min(5)]);
      expect(plan.map((u) => u.reading.value), [100.0, 105.0]);
    });

    test('leva o resto da leitura (tendência, taxa, alarme) do representante', () {
      final plan = planReadingUpload(
        pending: [at(min(3), 90)],
        local: [at(min(3), 90)],
        now: farFuture,
      );

      final sent = plan.single.reading;
      expect(sent.trend, GlucoseTrend.rising);
      expect(sent.rate, 1.5);
      expect(sent.alarmCode, 2);
    });

    test('cobre todas as pendentes do intervalo, não só a enviada', () {
      final readings = [for (var m = 0; m < 5; m++) at(min(m), 100)];

      final plan = planReadingUpload(
        pending: readings,
        local: readings,
        now: farFuture,
      );

      expect(
        plan.single.coveredKeys,
        unorderedEquals([for (final r in readings) r.timestamp.millisecondsSinceEpoch]),
      );
    });

    test('o representante é a mais antiga do intervalo, pendente ou não', () {
      final stored = at(min(1), 101); // já sincronizada
      final fresh = at(min(3), 103); // pendente

      final plan = planReadingUpload(
        pending: [fresh],
        local: [stored, fresh],
        now: farFuture,
      );

      expect(plan.single.reading.value, 101);
      expect(plan.single.coveredKeys, [fresh.timestamp.millisecondsSinceEpoch]);
    });

    test('uma leitura anterior que chega depois muda o valor, não a chave', () {
      final first = planReadingUpload(
        pending: [at(min(2), 102)],
        local: [at(min(2), 102)],
        now: farFuture,
      );
      final late = [at(min(0), 100), at(min(2), 102)];
      final second = planReadingUpload(pending: [late.first], local: late, now: farFuture);

      expect(first.single.reading.timestamp, second.single.reading.timestamp);
      expect(first.single.reading.value, 102);
      expect(second.single.reading.value, 100);
    });

    test('o intervalo em curso não sobe', () {
      final readings = [at(min(5), 1), at(min(6), 2)];

      expect(
        planReadingUpload(pending: readings, local: readings, now: min(7)),
        isEmpty,
      );
    });

    test('o intervalo sobe no instante em que fecha', () {
      final readings = [at(min(0), 1)];

      expect(
        planReadingUpload(pending: readings, local: readings, now: min(4, 59)),
        isEmpty,
      );
      expect(
        planReadingUpload(pending: readings, local: readings, now: min(5)),
        hasLength(1),
      );
    });

    test('sem pendentes não há o que enviar', () {
      expect(
        planReadingUpload(pending: const [], local: [at(min(0), 1)], now: farFuture),
        isEmpty,
      );
    });

    test('a saída vem do intervalo mais antigo ao mais novo', () {
      final readings = [at(min(10), 3), at(min(0), 1), at(min(5), 2)];

      final plan = planReadingUpload(pending: readings, local: readings, now: farFuture);

      expect(plan.map((u) => u.reading.value), [1, 2, 3]);
    });

    test('duas semanas a 1/min viram 4032 linhas', () {
      final readings = [
        for (var m = 0; m < 14 * 24 * 60; m++) at(min(m), 100.0 + m % 50),
      ];

      final plan = planReadingUpload(
        pending: readings,
        local: readings,
        now: base.add(const Duration(days: 15)),
      );

      expect(readings, hasLength(20160));
      expect(plan, hasLength(4032));
    });
  });
}
