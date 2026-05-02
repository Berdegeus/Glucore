# Glucore

Glucore e um app mobile em Flutter com integracao Android nativa para um fluxo Sibionics Android-first.

O repositorio ja nao esta mais em fase de mock simples. O caminho principal do app hoje registra sensor, restaura sessao, conecta via BLE, sincroniza leituras armazenadas no sensor e promove a glicose atual para a camada Flutter.

Este README descreve o estado real do repo hoje para que outros desenvolvedores consigam continuar o trabalho sem assumir arquitetura antiga, simulacoes removidas ou escopo maior do que o que esta implementado.

## Escopo atual

Recorte tecnico atual:

- Flutter para app, dominio e apresentacao
- Kotlin para boundary de plataforma, sessao, BLE e coordenacao Android
- JNI/C++ minimo para isolar chamadas ao stack nativo/proprietario
- bibliotecas nativas proprietarias empacotadas no app Android

Recorte funcional atual:

- um sensor Sibionics ativo por vez
- registro de sensor via caminho nativo
- restore de sessao local no app
- conexao BLE real
- sincronizacao de leituras antigas ao conectar um sensor ja em uso
- promocao da glicose atual para a camada Flutter

Recorte de suporte atual:

- Android arm64
- fluxo padrao do sensor registrado com subtype `0`
- sem persistencia de historico de glicose no Flutter por enquanto

## Leitura rapida do estado atual

O que ja esta real no caminho ativo:

- o app sobe pelo `AndroidSensorRepository`, nao pelo fake
- `MainActivity` registra `MethodChannel` e `EventChannel`
- o bridge nativo e inicializado no startup
- `registerSensor()` usa a camada nativa como source of truth
- `restoreSession()` usa bridge nativo + cache local Android
- `startMonitoring()` usa BLE/GATT real
- `SibionicsBleManager` ja esta ligado ao fluxo principal
- leituras antigas do sensor sao recebidas em sequencia na conexao
- a leitura atual chega ao Flutter e pode ser exibida na tela

O que ainda nao e objetivo concluido:

- persistir historico de leituras no app
- tratar a UI como produto final
- ampliar suporte para outros recortes de sensor fora do fluxo atual
- expandir o dominio para analytics, graficos ou armazenamento continuo

## Fluxo ativo do app

O caminho principal hoje e:

`Flutter UI -> SensorController -> AndroidSensorRepository -> SensorPlatform -> MainActivity / SensorPlatformImpl -> SibionicsNativeBridgeAdapter + SibionicsBleManager -> JNI/C++ bridge -> libs nativas proprietarias`

Esse fluxo e o que deve ser preservado. O Android e a autoridade operacional para registro, restore, conexao e leitura.

## Arquitetura Flutter

Arquivos centrais:

- `lib/app/bootstrap/app.dart`
- `lib/features/sensor/domain/models.dart`
- `lib/features/sensor/domain/events.dart`
- `lib/features/sensor/domain/sensor_repository.dart`
- `lib/features/sensor/data/platform/sensor_platform.dart`
- `lib/features/sensor/data/repositories/android_sensor_repository.dart`
- `lib/features/sensor/data/data_sources/fake_sensor_repository.dart`
- `lib/features/sensor/presentation/controller/sensor_controller.dart`
- `lib/features/sensor/presentation/pages/sensor_page.dart`

Pontos importantes:

- `GlucoreApp` sobe com `SensorPlatform`, `AndroidSensorRepository` e `SensorController`
- `SensorRepository` continua sendo o boundary do dominio
- `AndroidSensorRepository` permanece fino e so adapta Flutter <-> Android
- o fake repository continua no repo para referencia, mas nao e o caminho default do app

### Estados da camada Flutter

O dominio ja modela estes estados:

- `idle`
- `scanning`
- `connecting`
- `connected`
- `syncingHistory`
- `warmingUp`
- `readingAvailable`
- `disconnected`
- `error`

No fluxo Sibionics ativo hoje, os estados mais relevantes sao:

- `idle` para sensor registrado mas ainda desconectado
- `scanning` e `connecting` durante BLE
- `connected` logo apos bootstrap BLE
- `syncingHistory` enquanto o sensor envia valores antigos armazenados
- `readingAvailable` quando a glicose atual ja foi promovida para o Flutter

O estado `warmingUp` ainda existe no dominio, mas nao e hoje o estado principal do fluxo conectado real.

### Contrato Flutter <-> Android

`SensorPlatform` define:

- `MethodChannel('glucore/sensor/methods')`
- `EventChannel('glucore/sensor/events')`

Metodos esperados:

- `restoreSession`
- `registerSensor`
- `submitTransmitter`
- `startMonitoring`
- `stopMonitoring`
- `clearSession`

Eventos ativos hoje:

- `status`
- `session`
- `sync`
- `reading`
- `failure`

`reading` carrega pelo menos:

- `value`
- `timestampMs`

`sync` carrega:

- `receivedCount`
- `latestTimestampMs`

## Android ativo

### MainActivity

`MainActivity` nao usa um plugin Flutter separado. Ela mesma:

- cria `SensorSessionManager`
- cria `SibionicsNativeBridgeAdapter`
- cria `SensorPlatformImpl`
- chama `initializeNativeBridge()` no startup
- cria `SibionicsBleManager`
- injeta o BLE manager no `SensorPlatformImpl`
- solicita permissoes BLE em runtime
- registra os channels Flutter

### SensorPlatformImpl

`SensorPlatformImpl` e o entrypoint principal do lado Android.

Responsabilidades atuais:

- inicializar o bridge nativo
- restaurar sessao via adapter nativo
- registrar sensor via adapter nativo
- validar se existe sensor ativo no runtime nativo antes da conexao
- acionar `SibionicsBleManager` no `startMonitoring()`
- interromper scan/conexao no `stopMonitoring()`
- emitir eventos para o Flutter

`registerSensor()` hoje:

- recebe o barcode cru vindo do Flutter
- faz apenas `trim()` + rejeicao de vazio
- delega a validade final do barcode para o caminho nativo

### SensorSessionManager

`SensorSessionManager` e um espelho/cache local Android, nao a autoridade principal de protocolo.

Papel atual:

- persistir a sessao em `SharedPreferences`
- armazenar um `SibionicsSessionRecord`
- sincronizar snapshot vindo do bridge nativo
- manter transicoes locais de sessao e monitoramento
- expor estado atual para o resto do Android

Persistencia atual:

- sessao local
- ids de sensor/transmitter
- estado local basico de monitoramento

Nao ha persistencia de historico de glicose no Flutter nem no fluxo de apresentacao atual.

## BLE e fluxo de leitura

`SibionicsBleManager` ja esta no caminho principal.

Capacidades atuais:

- scan BLE com filtro do servico esperado
- tentativa por endereco salvo quando disponivel
- conexao GATT com retry para falhas transitarias
- descoberta de servicos e caracteristicas
- habilitacao de notificacoes
- bootstrap inicial de comando no sensor
- processamento das notificacoes via runtime nativo
- emissao de progresso de sincronizacao
- emissao da leitura atual para Flutter

### Comportamento importante ao conectar

Quando um sensor ja em uso e conectado, o comportamento esperado hoje e:

1. o app conecta e habilita notificacoes
2. o sensor envia uma sequencia de valores armazenados
3. o Android emite `syncingHistory` enquanto recebe esse backlog
4. quando o backlog chega perto do tempo atual, a leitura mais recente e promovida
5. o Flutter passa a receber `readingAvailable`

Esse comportamento e intencional. O app ja esta preparado para nao tratar o primeiro valor recebido como necessariamente a glicose atual.

### O que a tela atual representa

A `SensorPage` atual e uma tela tecnica para validar o fluxo, nao a UI final do produto.

Ela ja diferencia:

- sensor sem sessao
- sensor registrado mas desconectado
- scan/conexao em andamento
- sensor conectado aguardando primeira leitura
- sincronizacao de valores antigos
- glicose atual disponivel

## Bridge nativo e bibliotecas proprietarias

Arquivos centrais:

- `android/app/src/main/kotlin/com/berdegeus/glucore/GlucoreSibionicsBridge.kt`
- `android/app/src/main/kotlin/com/berdegeus/glucore/SibionicsNativeBridgeAdapter.kt`
- `android/app/src/main/java/tk/glucodata/Natives.java`
- `android/app/src/main/cpp/glucore_sibionics_bridge.cpp`
- `android/app/src/main/cpp/CMakeLists.txt`

O papel dessa camada e:

- inicializar o runtime nativo
- expor chamadas pequenas para Kotlin
- converter payloads crus em resultados tipados
- manter detalhes proprietarios fora da camada Flutter

`SibionicsNativeBridgeAdapter` cobre hoje:

- `init(...)`
- `registerSensor(...)`
- `restoreActiveSensor(...)`

O adapter encapsula falhas e transforma o retorno em:

- `CallResult.Success`
- `CallResult.NoData`
- `CallResult.Error`

### Bibliotecas nativas

As bibliotecas proprietarias atuais vivem em:

- `android/app/src/main/jniLibs/arm64-v8a/`

O build Android usa:

- `externalNativeBuild` com CMake
- `c++17`
- `abiFilters += "arm64-v8a"`
- `packaging.jniLibs.useLegacyPackaging = true`

Leitura correta:

- a integracao nativa atual e arm64-only
- o loader usa o `nativeLibraryDir` real fornecido pelo Android
- o APK e empacotado para permitir `dlopen()` sobre os `.so` extraidos

## Android permissions

O manifesto Android ja declara o necessario para o caminho BLE atual:

- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `ACCESS_FINE_LOCATION`
- `android.hardware.bluetooth_le`

`MainActivity` tambem solicita essas permissoes em runtime quando necessario.

## Estrutura util do repositorio

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
  java/tk/glucodata/
    Natives.java
  cpp/
    CMakeLists.txt
    glucore_sibionics_bridge.cpp
  jniLibs/arm64-v8a/
    *.so
```

## Limites e cuidados atuais

Pontos que qualquer desenvolvedor novo precisa saber:

- o projeto depende de bibliotecas nativas proprietarias empacotadas no app
- o recorte funcional atual e estreito; nao assuma suporte amplo a todos os cenarios de sensor
- a tela atual serve para validar conexao e leitura, nao para definir UX final
- o historico recebido ao conectar nao esta sendo persistido
- o app so precisa manter a leitura atual visivel por enquanto
- o fake repository ainda existe, mas o app real nao sobe por ele
- a camada Android continua sendo a fonte de verdade operacional

## Proximo criterio tecnico para continuar

Quem for continuar o projeto deve partir destas premissas:

1. preservar o contrato Flutter <-> Android atual
2. nao recolocar simulacao onde hoje ja existe conexao real
3. tratar `syncingHistory` como parte normal do fluxo de sensor ja em uso
4. manter o Android como coordenador de registro, restore e leitura
5. ampliar funcionalidades a partir do caminho ativo, nao de uma arquitetura paralela

Em termos práticos, o repo hoje ja esta preparado para evoluir em cima de conexao real e leitura atual real. O proximo trabalho deve partir desse estado, e nao de uma suposicao de que BLE, sync e leitura ainda estao simulados.
