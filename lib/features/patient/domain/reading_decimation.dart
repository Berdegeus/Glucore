import 'entities/glucose_reading_item.dart';

/// Cadência das leituras que o servidor guarda: uma por intervalo de 5 min.
///
/// O banco local guarda tudo o que o sensor entrega (até 1 por minuto) e é a
/// fonte dos gráficos e relatórios do aparelho. O servidor recebe só esta
/// versão rala — um quinto das linhas, o que basta para a curva, o AGP e as
/// excursões do painel — e, ao lado, os blocos de 15 min calculados aqui com a
/// resolução cheia (ver `glucose_bucket.dart`).
const readingUploadSlot = Duration(minutes: 5);

final int _slotMs = readingUploadSlot.inMilliseconds;

/// Início do intervalo de 5 min que contém [timestampMs]: o múltiplo de 5 min
/// do relógio mais próximo, por baixo.
int readingSlotStart(int timestampMs) => timestampMs - timestampMs % _slotMs;

/// Uma linha que vai ao servidor e as leituras locais pendentes que ela cobre.
class ReadingUpload {
  const ReadingUpload({required this.reading, required this.coveredKeys});

  /// A leitura enviada: a mais antiga do intervalo, **carimbada com o início
  /// dele**.
  ///
  /// O carimbo fixo é o que torna o envio idempotente: se o backfill do sensor
  /// entregar depois uma leitura mais antiga no mesmo intervalo, o representante
  /// muda de valor mas não de chave, e o servidor atualiza a linha em vez de
  /// criar uma segunda.
  final GlucoseReadingItem reading;

  /// `timestamp_ms` das leituras locais pendentes que esta linha representa —
  /// o que se marca como sincronizado quando o servidor confirma.
  final List<int> coveredKeys;
}

/// Decide o que enviar ao servidor.
///
/// - [pending]: leituras locais com `synced = 0`.
/// - [local]: as leituras locais dos intervalos em questão, pendentes ou não —
///   o representante é a mais antiga do intervalo, não a mais antiga das
///   pendentes (uma leitura nova no meio de um intervalo já enviado não pode
///   trocar o que o servidor tem).
///
/// Só intervalos **fechados** (terminaram até [now]) saem. O intervalo em curso
/// continua pendente: com uma leitura por minuto, enviá-lo a cada leitura seria
/// um POST por minuto para reescrever a mesma linha.
///
/// O resultado vem do intervalo mais antigo ao mais novo.
List<ReadingUpload> planReadingUpload({
  required Iterable<GlucoseReadingItem> pending,
  required Iterable<GlucoseReadingItem> local,
  required DateTime now,
}) {
  final nowMs = now.millisecondsSinceEpoch;

  final pendingKeysBySlot = <int, List<int>>{};
  for (final reading in pending) {
    final key = reading.timestamp.millisecondsSinceEpoch;
    final slot = readingSlotStart(key);
    if (slot + _slotMs > nowMs) continue;
    pendingKeysBySlot.putIfAbsent(slot, () => []).add(key);
  }
  if (pendingKeysBySlot.isEmpty) return const [];

  final earliest = <int, GlucoseReadingItem>{};
  void consider(GlucoseReadingItem reading) {
    final slot = readingSlotStart(reading.timestamp.millisecondsSinceEpoch);
    if (!pendingKeysBySlot.containsKey(slot)) return;
    final current = earliest[slot];
    if (current == null || reading.timestamp.isBefore(current.timestamp)) {
      earliest[slot] = reading;
    }
  }

  local.forEach(consider);
  pending.forEach(consider);

  final slots = pendingKeysBySlot.keys.toList()..sort();
  return [
    for (final slot in slots)
      ReadingUpload(
        reading: earliest[slot]!.copyWith(
          timestamp: DateTime.fromMillisecondsSinceEpoch(slot),
        ),
        coveredKeys: pendingKeysBySlot[slot]!,
      ),
  ];
}
