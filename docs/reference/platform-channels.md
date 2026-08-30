# Contrato dos platform channels

> Quando usar: qualquer mudança na fronteira Flutter↔Android. Este é o contrato exato implementado (Kotlin emite, Dart parseia).

## MethodChannel `glucore/sensor/methods`

| Método | Args | Retorno | Observações |
|---|---|---|---|
| `restoreSession` | — | `{sensorId, connected, brand}` ou `null` | |
| `registerSensor` | `{barcode: String, brand: String}` | `{sensorId, connected, brand}` | síncrono: snapshot no sucesso, `PlatformException("NATIVE_ERROR")` na falha; o evento (`idle` com `session`, ou `error`) continua sendo emitido como complemento |
| `startMonitoring` | — | `null` | dispara scan BLE; progresso via eventos |
| `stopMonitoring` | — | `null` | emite `disconnected` |
| `clearSession` | — | `null` | stopMonitoring + limpa SQLite; emite `idle` |

Exceções Kotlin → `PlatformException(code: "NATIVE_ERROR", message)`.

## EventChannel `glucore/sensor/events`

Toda emissão passa por `SensorCore.dispatchEvent`, que guarda o último evento. No `onListen`, se existir um último evento, ele é **reemitido imediatamente** para o novo sink (main thread) — assinantes tardios recebem o estado corrente em vez de perder eventos emitidos antes da assinatura.

Todo evento é um `Map` com este shape (chaves sempre presentes ou null):

```jsonc
{
  "status": "idle|scanning|connecting|pairing|connected|syncingHistory|warmingUp|readingAvailable|disconnected|error",
  "connected": true,                       // bool
  "session":  { "sensorId": "...", "brand": "sibionics" },   // ou null
  "brand":    "sibionics|accuchek|libre2",
  "sync":     { "receivedCount": 12, "latestTimestampMs": 1750000000000 },  // só em syncingHistory
  "historyReading": { "value": 104.3, "timestampMs": ..., "rate": 0.021, "alarmCode": 0 }, // só em syncingHistory
  "reading":  { "value": 104.3, "timestampMs": ..., "rate": 0.021, "alarmCode": 0 },       // só em readingAvailable
  "warmup":   null,                                   // sempre null: nenhum emissor preenche esta chave
  "failure":  { "message": "..." }                    // só em error
}
```

Notas de parsing (lado Dart, `SensorPlatformEvent.fromMap` em `sensor_platform.dart`):
- `status` desconhecido → `SensorConnectionStatus.idle` (silencioso).
- `value`/`rate` são `double` (mg/dL, mg/dL/min); `timestampMs` epoch ms.
- O status `warmingUp` existe no enum Dart e **é** emitido, mas só pelo caminho NFC do Libre 2 (`LibreNfcHandler`, junto do campo `nfc`). O caminho BLE nunca o emite.
- A chave `warmup` sobrou como `null` em todos os emissores. O `WarmupPayload` que a preencheria foi removido do Kotlin: era contrato fantasma, nunca produzido. O parser Dart ainda lê a chave, então reintroduzir progresso de warmup é acrescentar o payload de um lado só.

## Sequências típicas de eventos

Conexão feliz (sensor já registrado):
```
scanning → connecting → connected → syncingHistory (×N, com historyReading)
        → readingAvailable (leitura atual promovida) → readingAvailable (a cada ~5 min)
```

Registro: retorno síncrono do MethodChannel + evento `idle` (com `session`) — ou `PlatformException` + evento `error`.
Falha de conexão: `scanning → connecting → error {failure}` (ou `disconnected` se status GATT 0).

## Arquivos-chave

| Arquivo | Papel |
|---|---|
| `android/.../MainActivity.kt` | Registro dos channels (delega tudo ao `SensorCore`) |
| `android/.../SensorCore.kt` | `dispatchEvent` (funil único + `lastEvent` para replay), delegates dos métodos |
| `android/.../SensorPlatformImpl.kt` | `emitEvent`/`emitEventMap` (shape canônico Kotlin) |
| `android/.../SibionicsBleManager.kt` | Emissões durante conexão/leitura |
| `lib/features/sensor/data/platform/sensor_platform.dart` | Wrapper Dart + parser |

## Armadilhas

- O replay no `onListen` reenvia o **último** evento; pode chegar como duplicata do que o listener acabou de receber — o mapeamento de estado no `SensorCubit` é idempotente, mantenha assim.
- `emitEventMap` roteia pelo `SensorCore.dispatchEvent` (que grava `lastEvent` e notifica o service) — emitir eventos custom sempre por ele, nunca direto no `eventSink`.
- Ao adicionar chave nova no map, adicione em **todas** as emissões (Kotlin tem vários pontos: `emitStatus`, `emitError`, `emitGlucoseReading`, `emitHistorySyncProgress`, `emitEvent`).
