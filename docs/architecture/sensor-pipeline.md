# Pipeline do sensor: BLE + JNI + protocolo Sibionics

> Quando usar: qualquer mudança em registro de sensor, conexão BLE, leitura de glicose ou ponte nativa. Fonte da verdade sobre a sequência real implementada.

## 1. Inicialização da ponte nativa

`MainActivity` → `SensorPlatformImpl.initializeNativeBridge()`:

1. `SibionicsNativeBridgeAdapter.initializeIfNeeded()` → `GlucoreSibionicsBridge.init(filesDir, nativeLibraryDir, countryCode)` (C++):
   - `dlopen(RTLD_NOW|RTLD_GLOBAL)` de `libg.so` (obrigatória) + ~12 libs auxiliares opcionais; `libinit.so`/`libnative.so` são puladas (não são shared libs válidas).
   - Resolve símbolos `Java_tk_glucodata_Natives_*` via `dlsym`.
   - `Natives.setfilesdir(filesDir, country, nativedir)` — retorno ≠0 = falha.
   - Bootstrap do runtime vendor: `startsensors()` → `startmeals()` → `startthreads()` (sem isso, registro pode dar SIGSEGV em globals nulos).
   - `setlocale` existe mas **não é invocado** deliberadamente.
   - Códigos de erro do init: −1 lib, −2 classe, −3/−4 símbolos, −5 setfilesdir exception, −6/−7 getLibraryName, −8..−11 bootstrap.
2. `System.loadLibrary("g")` no Kotlin — necessário para o resolvedor JNI do Android achar os símbolos nas chamadas diretas Kotlin→`Natives` (no-op se já carregada).

Resultado do init é cacheado em `bridgeInitState` (uma tentativa por processo).

## 2. Registro de sensor

Flutter (`sensor_link_page.dart`): scanner `mobile_scanner` ou digitação → `normalizeGs1Barcode()` (`lib/core/utils/gs1_barcode.dart`) → `SensorCubit.registerSensor(barcode)` → MethodChannel.

Android: `SensorPlatformImpl.registerSensor` → `SibionicsBarcode.validateSensorBarcode` (**só trim + não-vazio**; validação real é nativa) → adapter → C++ `registerSensor`:

```
addSIscangetName(barcode, index[1]) → nome nativo do sensor
str2sensorptr(nome) → sensor_ptr        (fallback: activeSensorPtrs/activeSensors)
setSensorptrSiSubtype(sensor_ptr, subtype)   # subtype 0 = padrão
sensorptr2str(sensor_ptr) → sensorId canônico
→ JSON {"status":"ok","sensorId":...,"nativeSensorPtr":...}
```

O adapter (`parseSessionPayload`) tolera múltiplas formas de payload (chaves alternativas, payload não-JSON que parece barcode). Sucesso → `SensorSessionManager.syncSessionFromNative` persiste em SQLite (`glucore_session.db`, linha única id=1) → evento `idle` com `session`. **O MethodChannel retorna `null`; o resultado chega só pelo EventChannel.**

## 3. Restauração de sessão

`restoreSession()`: se cache SQLite vazio → retorna null **sem tocar no nativo** (guarda anti-SIGSEGV). Senão → C++ `restoreActiveSensor` que usa **apenas** `activeSensors()` (strings) — `activeSensorPtrs()` comprovadamente SIGSEGV durante restore no boot. `{"status":"none","active":false}` = NoData → limpa cache local.

## 4. startMonitoring

`SensorPlatformImpl.startMonitoring`:
1. Sessão local existe? (senão erro "No sensor registered")
2. `Natives.activeSensors()` — não-vazio?
3. `Natives.getdataptr(sensors[0])` — ≠ 0?
4. `sessionManager.startMonitoring()` (status→CONNECTED no SQLite)
5. `bleManager.startSensorScan(dataptr)`

## 5. Conexão BLE (SibionicsBleManager)

UUIDs: serviço `ff30`, notify `ff31`, write `ff32`, CCCD `2902`.

```
startSensorScan(dataptr)
  ├─ getSiBluetoothNum(dataptr) → sufixo esperado do nome
  ├─ getDeviceAddress(dataptr,false) válido? → conecta direto no endereço salvo
  └─ senão: scan filtrado por serviço ff30, SCAN_MODE_LOW_LATENCY, timeout 30 s
       match: nome == siGetDeviceName(dataptr) OU últimos 4 chars do nome == 4 primeiros do bluetoothNum
       → stopScan → conecta com delay de 350 ms
connectToDevice
  ├─ siSaveDeviceName + setDeviceAddress (persiste no nativo)
  ├─ connectGatt(autoConnect=false, TRANSPORT_LE); timeout 20 s
  └─ GATT 133: retry ×3 (delay 1 s) → depois 1 rescan filtrado → então erro
STATE_CONNECTED
  ├─ requestConnectionPriority(HIGH); EverSenseClear(dataptr)
  └─ discoverServices → notify em ff31 → write CCCD
onDescriptorWrite OK
  ├─ siNotchinese(dataptr)==true  → escreve siAuthBytes(dataptr) em ff32
  └─ ==false                      → escreve siAsknewdata(dataptr)
  → emite "connected"
```

## 6. Loop de dados (`onCharacteristicChanged` → `SIprocessData`)

| Código | Ação |
|---|---|
| 1 | glicose pronta → `handleGlucoseReady()` |
| 2 | frame inválido → agenda disconnect em 30 s |
| 3 | retry → reconecta no mesmo device (delay 1 s) |
| 4 | reautentica (`siAuthBytes` → ff32) |
| 5 | time-sync (`getSItimecmd`) |
| 6 | ativação (`getSIActivation`) |
| 7 | pede dados novos (`siAsknewdata`) |
| 8, 9 | ignorados |
| 10 | reset (`getSIResetBytes`) |
| outro | tenta decodificar o próprio código como leitura empacotada (`handleDirectGlucoseResult`) |

## 7. Decodificação de glicose

`getlastGlucose()` retorna `long[]`: índice 0 = timestamp (s ou ms — `normalizeTimestampMs` multiplica por 1000 se `< 10^10`), índice 1 = leitura empacotada (formato Juggluco):

```
bits 0–31  : glicose em DÉCIMOS de mg/dL   (válido: 200..10_000 → 20..1000 mg/dL)
bits 32–47 : taxa (trend) × 1000, short com sinal
bits 48–55 : código de alarme
```

`mgdl = tenths / 10.0`. **Isto substitui a heurística antiga `firstOrNull { it in 40..400 }` citada no CLAUDE.md.**

## 8. History sync e promoção a leitura atual

O sensor manda backlog antes da leitura atual. Estado no BleManager:

- Cada código 1 antes da primeira entrega → `syncingHistory` + `historyReading` no evento; guarda candidato.
- Candidato recente (≤ 20 min, `CURRENT_READING_MAX_AGE_MS`) agenda promoção após 2 s sem novos frames (`HISTORY_SYNC_SETTLE_MS`).
- Leitura direta via `handleDirectGlucoseResult` (timestamp do telefone, não confiável) herda o timestamp sincronizado se houver.
- Depois da primeira entrega, códigos 1 emitem `readingAvailable` direto; `shouldPublishReading` descarta leituras fora de ordem (timestamp confiável < último − 1 s).

Flutter **não** deve tratar `historyReading` como leitura atual — `PatientCubit` só faz upsert na lista histórica.

## Arquivos-chave

| Arquivo | Papel |
|---|---|
| `android/.../SibionicsBleManager.kt` | Toda a máquina de estados BLE + decodificação |
| `android/.../SensorPlatformImpl.kt` | Orquestra métodos do channel, emite eventos |
| `android/.../SibionicsNativeBridgeAdapter.kt` | Única camada Kotlin que fala com payloads nativos crus |
| `android/.../SensorSessionManager.kt` | Cache de sessão em SQLite (`glucore_session.db`) |
| `android/app/src/main/cpp/glucore_sibionics_bridge.cpp` | dlopen/dlsym, init, register, restore |
| `android/app/src/main/java/tk/glucodata/Natives.java` | Declarações JNI diretas (chamar só da camada BLE Kotlin) |
| `lib/features/patient/presentation/pages/sensor_link_page.dart` | UI de registro (scanner + GS1) |

## Armadilhas

- `restoreSession` sem checar cache local primeiro = SIGSEGV nativo. Nunca chamar `activeSensors()`/`activeSensorPtrs()` antes de existir sensor.
- `getlastGlucose()` é global, não por `dataptr` — com >1 sensor ativo o resultado é ambíguo (hoje só usa `sensors[0]`).
- Escritas GATT são fire-and-forget (sem fila); ver ARCHITECTURE_REVIEW §P8 antes de adicionar novas escritas em sequência.
- Callbacks GATT chegam em binder threads; timers usam `mainHandler`. Não adicionar estado sem pensar em concorrência (§P9).
- `saveMatchedDevice`/`getInitialWrite`/`handleNotification` no bridge C++ são stubs que sempre retornam erro — não usar.
- Monitoramento morre com a Activity (sem ForegroundService) — não asumir coleta em background (§P7).
