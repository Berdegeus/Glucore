import 'entities/glucose_reading_item.dart';
import 'reading_decimation.dart';

/// Forma do resumo diário, igual à de `contracts/glucose-histogram.json` (o app,
/// o backend e os testes dos dois leem o mesmo arquivo).
const glucoseHistogramMinMgDl = 40;
const glucoseHistogramMaxMgDl = 600;
const glucoseHistogramBins = glucoseHistogramMaxMgDl - glucoseHistogramMinMgDl + 1;

/// Dias por requisição de `PUT /readings/summaries`.
const dailySummaryPushBatchSize = 14;

/// Um dia do paciente como o servidor o guarda: contagens por mg/dL inteiro.
///
/// O servidor recebe só uma leitura a cada 5 min, mas o aparelho tem a 1/min;
/// este resumo é o que leva a resolução cheia ao painel. Com um histograma o
/// servidor calcula o TIR para qualquer faixa-alvo, as zonas, a média, o DP e o
/// CV sem as leituras de minuto.
class DailySummary {
  const DailySummary({
    required this.localDate,
    required this.utcOffsetMinutes,
    required this.readingsCount,
    required this.coveredSlots,
    required this.histogram,
  });

  /// `AAAA-MM-DD` no deslocamento abaixo.
  final String localDate;

  /// Minutos a leste de UTC ao meio-dia local desse dia (−180 em Brasília). O
  /// servidor só usa o resumo quando o painel pede o mesmo deslocamento.
  final int utcOffsetMinutes;

  /// Leituras que o sensor entregou no dia.
  final int readingsCount;

  /// Intervalos de 5 min do dia com ao menos uma leitura: o uso do sensor, seja
  /// qual for a cadência dele.
  final int coveredSlots;

  /// Leituras por mg/dL: o índice 0 é 40 mg/dL e o último, 600 mg/dL. Um valor
  /// fora da faixa conta no extremo mais próximo.
  final List<int> histogram;

  Map<String, dynamic> toJson() => {
        'localDate': localDate,
        'utcOffsetMinutes': utcOffsetMinutes,
        'readingsCount': readingsCount,
        'coveredSlots': coveredSlots,
        'histogram': histogram,
      };
}

/// Onde começa e termina um dia do paciente.
///
/// O corte do dia é do aparelho (o fuso do paciente), não do servidor. Fica
/// atrás de uma interface para os testes não dependerem do fuso da máquina.
abstract interface class DayCutter {
  /// O dia que contém [time].
  String keyOf(DateTime time);

  /// Minutos a leste de UTC ao meio-dia local de [key]. Ao meio-dia, porque é o
  /// instante que nenhuma troca de horário de verão alcança.
  int offsetMinutes(String key);

  /// `[início, fim)` do dia [key], como instantes.
  (DateTime, DateTime) boundsOf(String key);
}

String _two(int n) => n.toString().padLeft(2, '0');
String _key(int y, int m, int d) => '$y-${_two(m)}-${_two(d)}';

(int, int, int) _parts(String key) {
  final p = key.split('-');
  return (int.parse(p[0]), int.parse(p[1]), int.parse(p[2]));
}

/// O fuso do aparelho, com horário de verão.
class DeviceDayCutter implements DayCutter {
  const DeviceDayCutter();

  @override
  String keyOf(DateTime time) {
    final local = time.toLocal();
    return _key(local.year, local.month, local.day);
  }

  @override
  int offsetMinutes(String key) {
    final (y, m, d) = _parts(key);
    return DateTime(y, m, d, 12).timeZoneOffset.inMinutes;
  }

  @override
  (DateTime, DateTime) boundsOf(String key) {
    final (y, m, d) = _parts(key);
    return (DateTime(y, m, d), DateTime(y, m, d + 1));
  }
}

/// Um deslocamento fixo, sem horário de verão: o Brasil desde 2019, e os testes.
class FixedOffsetDayCutter implements DayCutter {
  const FixedOffsetDayCutter(this.offsetMinutesEast);

  final int offsetMinutesEast;

  @override
  String keyOf(DateTime time) {
    final shifted = DateTime.fromMillisecondsSinceEpoch(
      time.millisecondsSinceEpoch + offsetMinutesEast * 60000,
      isUtc: true,
    );
    return _key(shifted.year, shifted.month, shifted.day);
  }

  @override
  int offsetMinutes(String key) => offsetMinutesEast;

  @override
  (DateTime, DateTime) boundsOf(String key) {
    final (y, m, d) = _parts(key);
    final start = DateTime.utc(y, m, d).millisecondsSinceEpoch -
        offsetMinutesEast * 60000;
    return (
      DateTime.fromMillisecondsSinceEpoch(start),
      DateTime.fromMillisecondsSinceEpoch(start + const Duration(days: 1).inMilliseconds),
    );
  }
}

/// O resumo do dia [key] a partir das leituras locais dele, ou `null` se não
/// houver nenhuma.
///
/// [readings] devem ser todas as leituras locais do dia, em qualquer ordem —
/// não só as que mudaram.
DailySummary? summarizeDay(
  String key,
  Iterable<GlucoseReadingItem> readings,
  DayCutter cutter,
) {
  final histogram = List<int>.filled(glucoseHistogramBins, 0);
  final slots = <int>{};
  var count = 0;
  final slotMs = readingUploadSlot.inMilliseconds;

  for (final reading in readings) {
    final ms = reading.timestamp.millisecondsSinceEpoch;
    // `round()` arredonda a metade para longe do zero, como o `Math.round` do
    // servidor para os valores positivos (99,5 → 100 nos dois).
    final mgDl = reading.value.round().clamp(
          glucoseHistogramMinMgDl,
          glucoseHistogramMaxMgDl,
        );
    histogram[mgDl - glucoseHistogramMinMgDl] += 1;
    slots.add(ms ~/ slotMs);
    count += 1;
  }
  if (count == 0) return null;

  return DailySummary(
    localDate: key,
    utcOffsetMinutes: cutter.offsetMinutes(key),
    readingsCount: count,
    coveredSlots: slots.length,
    histogram: histogram,
  );
}
