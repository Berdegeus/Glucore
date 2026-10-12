import 'entities/glucose_reading_item.dart';
import 'reading_decimation.dart';

/// Forma do bloco de glicose, igual à de `contracts/glucose-histogram.json` (o
/// app, o backend e os testes dos dois leem o mesmo arquivo).
const glucoseBucketMinMgDl = 40;
const glucoseBucketMaxMgDl = 600;
const glucoseBucketDuration = Duration(minutes: 15);

/// Quantos intervalos de 5 min cabem num bloco.
const glucoseBucketSlots = 3;

/// Blocos por requisição de `PUT /readings/buckets`.
const glucoseBucketPushBatchSize = 288;

final int _bucketMs = glucoseBucketDuration.inMilliseconds;

/// Início do bloco de 15 min, alinhado a UTC, que contém [timestampMs].
///
/// Alinhado a UTC e não ao fuso do paciente de propósito: todo fuso real tem um
/// deslocamento múltiplo de 15 min, então um bloco nunca atravessa uma meia-noite
/// local, e o servidor monta o dia em **qualquer** fuso sem depender do fuso de
/// quem corta.
int glucoseBucketStart(int timestampMs) => timestampMs - timestampMs % _bucketMs;

/// Um intervalo de 15 min como o servidor o guarda: as leituras contadas por
/// mg/dL inteiro.
///
/// O servidor recebe só uma leitura a cada 5 min, mas o aparelho tem a 1/min;
/// este bloco é o que leva a resolução cheia ao painel. Com as contagens ele
/// calcula o TIR para qualquer faixa-alvo, as zonas, a média, o DP e o CV.
class GlucoseBucket {
  const GlucoseBucket({
    required this.startMs,
    required this.readingsCount,
    required this.coveredSlots,
    required this.mgDl,
    required this.counts,
  });

  /// Início do bloco, em ms de época; múltiplo de 15 min.
  final int startMs;

  /// Leituras que o sensor entregou no bloco.
  final int readingsCount;

  /// Intervalos de 5 min do bloco com ao menos uma leitura (1 a 3): o uso do
  /// sensor, seja qual for a cadência dele.
  final int coveredSlots;

  /// Valores distintos em mg/dL, crescentes, de 40 a 600.
  final List<int> mgDl;

  /// Quantas leituras teve cada valor de [mgDl], na mesma ordem.
  final List<int> counts;

  Map<String, dynamic> toJson() => {
        'startMs': startMs,
        'readingsCount': readingsCount,
        'coveredSlots': coveredSlots,
        'mgDl': mgDl,
        'counts': counts,
      };
}

/// O bloco que começa em [startMs] a partir das leituras locais dele, ou `null`
/// se não houver nenhuma.
///
/// [readings] devem ser todas as leituras locais do bloco, em qualquer ordem —
/// não só as que mudaram. Um valor fora de 40–600 conta no extremo mais
/// próximo.
GlucoseBucket? summarizeBucket(int startMs, Iterable<GlucoseReadingItem> readings) {
  final byValue = <int, int>{};
  final slots = <int>{};
  final slotMs = readingUploadSlot.inMilliseconds;
  var count = 0;

  for (final reading in readings) {
    // `round()` arredonda a metade para longe do zero, como o `Math.round` do
    // servidor para os valores positivos (99,5 → 100 nos dois).
    final mgDl = reading.value.round().clamp(glucoseBucketMinMgDl, glucoseBucketMaxMgDl);
    byValue.update(mgDl, (n) => n + 1, ifAbsent: () => 1);
    slots.add(reading.timestamp.millisecondsSinceEpoch ~/ slotMs);
    count += 1;
  }
  if (count == 0) return null;

  final values = byValue.keys.toList()..sort();
  return GlucoseBucket(
    startMs: startMs,
    readingsCount: count,
    coveredSlots: slots.length,
    mgDl: values,
    counts: [for (final value in values) byValue[value]!],
  );
}
