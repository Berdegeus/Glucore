# Glucore

Glucore e um app mobile em Flutter com foco em um MVP Android-first para integracao com sensor CGM Sibionics.

O estado atual do repositorio ja nao e mais o template Flutter puro: o app Flutter agora sobe pelo caminho Android-backed, existe bootstrap JNI/C++, ha bibliotecas proprietarias empacotadas no Android e a sessao nativa/com cache local ja esta em progresso. Ao mesmo tempo, o monitoramento real via BLE/GATT ainda nao entrou no caminho ativo. O projeto esta, portanto, em um estado hibrido e inacabado.

Este README serve para alinhar outros desenvolvedores ao estado real do repo de hoje: o que esta implementado, o que esta parcialmente implementado, o que ainda e simulado e qual deve ser a leitura correta antes de continuar o trabalho.

## Objetivo tecnico do MVP

Direcao pretendida:

- Flutter para app, dominio e apresentacao
- Kotlin para sessao, boundary de plataforma, BLE e integracao Android
- JNI/C++ minimo para isolar a chamada ao stack nativo/proprietario
- bibliotecas proprietarias `.so` empacotadas dentro do app Android

Escopo funcional pretendido:

- um sensor Sibionics ativo
- restauracao de sessao
- warmup
- leitura atual de glicose
- app Android-first

## Leitura rapida do estado atual

O que ja e real neste checkout:

- o app Flutter ja sobe pelo `AndroidSensorRepository`, nao mais pelo fake
- o boundary Flutter <-> Android via `MethodChannel` e `EventChannel` esta ativo
- `MainActivity` registra os channels manualmente
- existe `SensorPlatformImpl` como implementacao Android ativa
- existe `SensorSessionManager` com cache local persistido
- existe `SibionicsNativeBridgeAdapter` encapsulando o bridge JNI
- existe `GlucoreSibionicsBridge.kt` + `glucore_sibionics_bridge.cpp`
- existem `.so` proprietarias em `android/app/src/main/jniLibs/arm64-v8a/`
- o build Android ja esta configurado para NDK/CMake/arm64-only

O que ainda nao e real no caminho ativo:

- BLE/GATT ainda nao foi ligado ao fluxo principal
- `startMonitoring()` ainda usa warmup e leitura simulados por timer
- `saveMatchedDevice`, `getInitialWrite` e `handleNotification` ainda nao estao mapeados no bridge ativo
- o manifesto Android ainda nao contem as permissoes BLE necessarias
- parte da UI ainda tem strings hardcoded em ingles

## Arquitetura atual

### Fluxo ativo do app

O caminho vivo hoje e:

`Flutter UI -> SensorController -> AndroidSensorRepository -> SensorPlatform -> MainActivity / SensorPlatformImpl -> SensorSessionManager + SibionicsNativeBridgeAdapter -> GlucoreSibionicsBridge -> JNI/C++ -> libg.so / libs proprietarias`

Esse ponto e importante: a arquitetura deixou de ser apenas um prototipo Flutter. O Android agora faz parte do fluxo principal.

### Camadas Flutter

Estrutura principal:

- `lib/app/bootstrap/app.dart`
- `lib/features/sensor/domain/models.dart`
- `lib/features/sensor/domain/events.dart`
- `lib/features/sensor/domain/sensor_repository.dart`
- `lib/features/sensor/data/platform/sensor_platform.dart`
- `lib/features/sensor/data/repositories/android_sensor_repository.dart`
- `lib/features/sensor/data/data_sources/fake_sensor_repository.dart`
- `lib/features/sensor/presentation/controller/sensor_controller.dart`
- `lib/features/sensor/presentation/pages/sensor_page.dart`

O dominio ja define:

- `SensorConnectionStatus`
- `SensorSession`
- `GlucoseReading`
- `WarmupInfo`
- `SensorFailure`
- `SensorUiState`
- `SensorEvent`

Esses tipos continuam sendo o contrato funcional do MVP.

### Bootstrap Flutter

`GlucoreApp` agora:

- inicializa `SensorPlatform`
- cria `AndroidSensorRepository`
- injeta esse repositorio no `SensorController`
- ativa localizacao com `flutter_localizations`

Ou seja: o repositorio fake continua no repo, mas nao e mais o caminho default do app.

### Repository e platform boundary

`SensorRepository` continua sendo a interface do dominio.

`AndroidSensorRepository` e propositalmente fino:

- repassa chamadas para `SensorPlatform`
- transforma `SensorPlatformEvent` em `SensorEvent`
- mantem a Flutter layer isolada do detalhe Android/native

`SensorPlatform` define os channels:

- `MethodChannel('glucore/sensor/methods')`
- `EventChannel('glucore/sensor/events')`

Metodos previstos:

- `restoreSession`
- `registerSensor`
- `submitTransmitter`
- `startMonitoring`
- `stopMonitoring`
- `clearSession`

Eventos esperados:

- `status`
- `session`
- `connected`
- `warmup`
- `reading`
- `failure`

Esse schema de evento e o contrato que o Android precisa preservar.

## Android atual

### MainActivity

`MainActivity` nao usa plugin Flutter separado. Ela mesma:

- cria `SensorSessionManager`
- cria `SibionicsNativeBridgeAdapter`
- cria `SensorPlatformImpl`
- chama `initializeNativeBridge()` no startup
- registra `MethodChannel`
- registra `EventChannel`

Isso significa que o bootstrap JNI ja faz parte do fluxo de abertura do app.

### SensorPlatformImpl

`SensorPlatformImpl` e o ponto central do lado Android.

Responsabilidades atuais:

- inicializar o bridge nativo
- fazer `restoreSession()` via adapter nativo
- fazer `registerSensor()` via adapter nativo
- enviar eventos para o Flutter
- manter warmup/leituras simulados por timer ate a entrada do BLE real

Pontos importantes:

- `restoreSession()` esta protegido por um guard local para nao consultar o vendor stack antes de haver uma sessao local persistida
- `registerSensor()` ja usa o caminho nativo como source of truth
- `startMonitoring()` ainda nao usa BLE real
- `clearSession()` limpa apenas o cache local Glucore, nao uma sessao nativa vendor-backed

### SensorSessionManager

`SensorSessionManager` nao e mais a autoridade de registro/restore nativo. O papel atual dele e:

- espelhar localmente a sessao retornada pelo bridge
- persistir a sessao atual em `SharedPreferences`
- armazenar um `SibionicsSessionRecord`
- manter estado local de monitoramento
- gerar snapshots para o Flutter
- receber `submitTransmitter()`

Persistencia atual:

- `SharedPreferences`
- serializacao Java/Base64 de `SibionicsSessionRecord`

Observacao pratica:

- o manager e um cache/mirror local
- a verdade de `registerSensor()` e `restoreSession()` esta sendo movida para a camada nativa

### Barcode e validacao

Estado atual de validacao:

- barcode do sensor: apenas `trim()` + rejeicao de vazio
- sem regra fixa de 16 caracteres
- a camada nativa deve decidir se o barcode e valido ou nao

Transmissor:

- ainda possui validacao local propria
- minimo de 6 caracteres
- alfanumerico

## Bridge JNI/C++ e stack nativo

### Arquivos centrais

- `android/app/src/main/kotlin/com/berdegeus/glucore/GlucoreSibionicsBridge.kt`
- `android/app/src/main/kotlin/com/berdegeus/glucore/SibionicsNativeBridgeAdapter.kt`
- `android/app/src/main/java/tk/glucodata/Natives.java`
- `android/app/src/main/cpp/glucore_sibionics_bridge.cpp`
- `android/app/src/main/cpp/CMakeLists.txt`

### O que o bridge faz hoje

O `GlucoreSibionicsBridge` expoe para Kotlin:

- `init(filesDir, nativeLibraryDir, countryCode)`
- `getLastError()`
- `registerSensor(barcode, subtype)`
- `restoreActiveSensor()`
- `saveMatchedDevice(...)`
- `getInitialWrite(sensorId)`
- `handleNotification(sensorId, payload, timestampMs)`

O lado Kotlin nao deveria consumir payload cru fora do adapter. O papel do `SibionicsNativeBridgeAdapter` e:

- inicializar o bridge uma vez
- encapsular falhas
- parsear payloads JSON ou strings simples retornadas pelo nativo
- transformar o resultado em `CallResult.Success`, `CallResult.NoData` ou `CallResult.Error`

### Surface nativa atualmente alvo

O bridge atual nao aponta mais para um surface `JugglucoSibionics` inexistente.

Ele foi retargeted para a surface exportada por `libg.so`, usando simbolos `Java_tk_glucodata_Natives_*`, com suporte via wrapper `tk.glucodata.Natives`.

Entre os simbolos mapeados/considerados estao:

- `setfilesdir`
- `setlocale`
- `getLibraryName`
- `addSIscangetName`
- `str2sensorptr`
- `sensorptr2str`
- `activeSensorPtrs`
- `activeSensors`
- `getSensorName`
- `getDeviceAddress`
- `getSensorptrSiSubtype`
- `setSensorptrSiSubtype`
- `siGetDeviceName`

### O que esta realmente bridge-backed hoje

`init(...)`

- usa o caminho nativo baseado em `ApplicationInfo.nativeLibraryDir`
- passa `filesDir`, `nativeLibraryDir` e country code para o bridge
- executa o bootstrap do stack via `tk.glucodata.Natives`

`registerSensor(...)`

- ja passa pelo bridge
- recebe o barcode cru do sensor ja normalizado por trim
- delega a decisao final de validade para a camada nativa

`restoreActiveSensor(...)`

- ja passa pelo bridge
- porem o fluxo esta protegido por cache local para evitar crash observado ao consultar estado vendor cedo demais

### O que ainda esta explicitamente incompleto

No estado atual do bridge:

- `saveMatchedDevice()` ainda esta como nao suportado
- `getInitialWrite()` ainda esta como nao suportado
- `handleNotification()` ainda esta como nao suportado

Isso e importante porque esses pontos bloqueiam a entrada do monitoramento BLE real no caminho principal.

## Bibliotecas proprietarias

As libs atuais vivem em:

- `android/app/src/main/jniLibs/arm64-v8a/`

Arquivos presentes no repo:

- `libg.so`
- `libnative.so`
- `libinit.so`
- `libdata-handle-lib.so`
- `libnative-struct2json.so`
- `libnative-algorithm-jni-v115G.so`
- `libnative-algorithm-jni-v116A.so`
- `libnative-algorithm-v1_1_5G.so`
- `libnative-algorithm-v1_1_6A.so`
- `libnative-encrypy-decrypt-v110.so`
- `libnative-sensitivity-v110.so`
- `libCALCULATION.so`
- `libcalibrat2.so`
- `libcrl_dp.so`
- `liblibre3extension.so`

Documentacao de proveniencia:

- `NOTICE_JUGGLUCO_NATIVE.md`

Esse arquivo explica:

- que o caminho Sibionics depende de libs proprietarias empacotadas no app
- que a abordagem de integracao deriva do caminho Sibionics do Juggluco
- que esse codigo deve permanecer isolado do dominio/Flutter

### Copia local do Juggluco no repositorio

O repositorio agora tambem contem uma copia local do codigo do Juggluco em:

- `Juggluco/`

Essa copia existe como base tecnica e referencia direta para a integracao Android/native do Glucore. A expectativa e reutilizar entendimento, surface nativa, comportamento e funcoes relevantes do caminho Sibionics do Juggluco para acelerar a implementacao e reduzir adivinhacao no bridge, no loader e no futuro fluxo BLE/protocolo.

Ao mesmo tempo, isso nao deve vazar como dependencia explicita da camada Flutter visual do app:

- a UI Flutter do Glucore nao deve expor o Juggluco como produto
- o app Glucore nao depende de instalar o app Juggluco no telefone junto com ele
- o uso do Juggluco aqui e como base de codigo, referencia de implementacao e origem do surface nativo empacotado dentro do proprio app Glucore

### Politica atual de loader

O bridge usa `nativeLibraryDir` como base real de carregamento. A estrategia nao deve reescrever ABI/path manualmente.

Tambem ha tratamento deliberado para artefatos suspeitos:

- `libinit.so` nao e tratada como shared library normal
- `libnative.so` nao e tratada como shared library normal

Esses detalhes importam porque o conjunto empacotado nao e composto apenas por `.so` convencionais.

## Build Android atual

O Android app ja nao esta no gradle default minimo.

Configuracao relevante em `android/app/build.gradle.kts`:

- `externalNativeBuild` com CMake
- `cppFlags += "-std=c++17"`
- `ANDROID_STL = c++_shared`
- `abiFilters += "arm64-v8a"`
- `packaging.jniLibs.useLegacyPackaging = true`
- exclusao explicita de ABIs nao empacotadas

Leitura correta:

- a integracao proprietaria atual e arm64-only
- o bridge depende do layout real de `nativeLibraryDir`
- o packaging foi ajustado para suportar `dlopen()` sobre paths absolutos

## BLE/GATT

### O que existe

Ha um `SibionicsBleManager.kt` no repo com intencao clara de:

- scan BLE
- connection timeout
- `BluetoothGattCallback`
- descoberta de device
- conexao GATT
- coordenacao futura com o bridge nativo

### O que ainda nao esta pronto

Esse manager ainda nao esta no caminho ativo do app.

Bloqueios objetivos:

- `SensorPlatformImpl.startMonitoring()` ainda usa timer
- `saveMatchedDevice()` ainda nao esta suportado no bridge
- `getInitialWrite()` ainda nao esta suportado no bridge
- `handleNotification()` ainda nao esta suportado no bridge
- o `AndroidManifest.xml` ainda nao declara as permissoes BLE necessarias

Conclusao pratica:

- existe esqueleto BLE
- nao existe monitoramento real de sensor no fluxo ativo

## Flutter UI e localizacao

### O que ja esta ligado

Localizacao ja esta configurada:

- `flutter_localizations` no `pubspec.yaml`
- `l10n.yaml`
- ARBs em `lib/l10n/app_en.arb` e `lib/l10n/app_pt.arb`
- delegates gerados em `lib/l10n/`

### O que ainda esta parcial

Apesar disso, a tela ainda nao esta 100% localizada. Em `SensorPage` ainda existem textos hardcoded em ingles, especialmente em:

- progresso/conexao
- warmup
- leitura atual
- botoes de stop/disconnect/cancel

Tambem vale notar:

- o caminho `submitTransmitter()` existe no dominio e no Android
- a UI atual nao expande esse fluxo de forma propria

## O que e real vs o que ainda e simulado

### Ja ligado ao caminho nativo

- bootstrap do bridge no startup
- `registerSensor()`
- `restoreSession()`
- persistencia local da sessao Android
- channels Flutter <-> Android

### Ainda simulado

- `startMonitoring()`
- warmup
- emissao de leitura de glicose
- lifecycle BLE/GATT do sensor

Essa separacao precisa ficar clara para evitar falsa impressao de que o monitoramento ja e real.

## Riscos e limitacoes atuais

Pontos que qualquer desenvolvedor novo precisa saber antes de mexer:

- o projeto depende de bibliotecas proprietarias Android arm64-only
- o caminho native ainda e incompleto; nem todas as funcoes previstas estao mapeadas
- o restore nativo exigiu guard local para evitar crash observado no vendor path
- `clearSession()` nao limpa a sessao vendor-backed; limpa apenas o espelho local Glucore
- o manifesto Android ainda nao esta pronto para BLE real
- a UI Flutter ainda mistura strings localizadas e strings hardcoded
- o fake repository continua no repo para referencia, mas o app nao sobe mais por ele
- `SensorController.init()` ainda coloca estado `disconnected` apos restore, entao o comportamento de restore deve ser observado com cuidado quando o Android emitir estado conectado

## Como ler o repositorio hoje

Mapa resumido:

```text
lib/
  main.dart
  app/bootstrap/app.dart
  features/sensor/
    domain/
    data/
      data_sources/fake_sensor_repository.dart
      platform/sensor_platform.dart
      repositories/android_sensor_repository.dart
    presentation/
  l10n/

android/app/src/main/
  kotlin/com/berdegeus/glucore/
    MainActivity.kt
    SensorPlatformImpl.kt
    SensorSessionManager.kt
    SibionicsBarcode.kt
    SibionicsBleManager.kt
    SibionicsNativeBridgeAdapter.kt
    SibionicsSessionRecord.kt
    GlucoreSibionicsBridge.kt
  java/tk/glucodata/Natives.java
  cpp/
    CMakeLists.txt
    glucore_sibionics_bridge.cpp
  jniLibs/arm64-v8a/
    *.so
```

## Proximo passo tecnico recomendado

Antes de qualquer redesign, a leitura tecnica mais segura e:

1. manter a arquitetura atual
2. terminar a validacao do caminho native em device real
3. completar o mapeamento das funcoes nativas ainda faltantes
4. so depois ligar `SibionicsBleManager` no caminho ativo
5. substituir a simulacao por warmup/leitura reais

Em termos práticos, o proximo slice nao deveria ser mexer no Flutter. O gargalo tecnico esta no Android/native:

- consolidar `registerSensor()` e `restoreSession()` no runtime real
- terminar a surface faltante para BLE
- adicionar permissoes/manuseio BLE no Android
- integrar `saveMatchedDevice`, `getInitialWrite` e `handleNotification`

## O que nao assumir

Nao assuma nenhum destes pontos sem verificar:

- que o monitoramento atual ja e real
- que o BLE manager ja esta integrado
- que o bridge cobre toda a surface necessaria
- que limpar sessao no app limpa a sessao nativa vendor-backed
- que todas as strings da UI ja estao localizadas
- que o repo esta pronto para multiplas ABIs Android

## Resumo executivo

Hoje o Glucore esta em um meio-termo avancado:

- Flutter ja fala com Android de verdade
- Android ja sobe bridge JNI/proprietario de verdade
- registro e restore ja estao no caminho nativo
- persistencia local Android ja existe
- o repositorio ja contem libs proprietarias e C++ bridge
- BLE real ainda nao entrou no fluxo principal
- warmup e glicose ainda sao simulados

Esse e o contexto correto para qualquer desenvolvedor que va continuar o projeto.
