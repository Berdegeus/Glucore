# Glucore

## Visão geral

Glucore é um aplicativo mobile em Flutter com foco em um MVP Android-first para integração com sensor CGM Sibionics.

A direção técnica pretendida do projeto é:

- Flutter para app, domínio e apresentação
- Kotlin para integração Android, sessão, BLE e boundary de plataforma
- uma ponte JNI/C++ mínima para isolar chamadas nativas/proprietárias
- bibliotecas proprietárias `.so` empacotadas no app Android quando a integração nativa estiver presente

O objetivo funcional discutido até agora para o MVP é estreito:

- um único sensor Sibionics ativo
- restauração de sessão
- estado de warmup
- exibição da glicose atual

Este README existe para registrar duas coisas ao mesmo tempo:

1. o estado real do checkout atual
2. o contexto técnico já validado em iterações anteriores do projeto, mesmo que esse estado mais avançado não esteja presente neste snapshot

Isso é importante porque o repositório atual não contém toda a camada Android/native que já foi discutida e validada em outros estados de trabalho.

## Estado real deste checkout

Data de referência deste levantamento: `2026-05-02`.

Este checkout está hoje em um estado Flutter-first com Android praticamente no template padrão. O caminho ativo do app usa um repositório fake, não uma implementação Android/native real.

### O que existe de fato

- App Flutter inicializando por `lib/main.dart`
- bootstrap em `lib/app/bootstrap/app.dart`
- camada de domínio para sessão, leitura, warmup, falha e status
- controller de UI com máquina de estados simples
- tela única de MVP para registrar sensor e iniciar monitoramento
- `SensorPlatform` em Dart com contract de `MethodChannel` e `EventChannel`
- `FakeSensorRepository` simulando registro, conexão, warmup e leituras

### O que não existe neste checkout

- implementação Android do contract de `SensorPlatform`
- registro de `MethodChannel` / `EventChannel` no Android
- `SensorPlatformImpl`
- `SensorSessionManager`
- `SibionicsBleManager`
- bridge JNI/C++
- pasta `android/app/src/main/cpp`
- `jniLibs` com bibliotecas proprietárias
- `externalNativeBuild`, CMake, `abiFilters` ou configuração NDK específica
- permissões BLE no manifest
- documentação local de dependência proprietária, como `NOTICE_JUGGLUCO_NATIVE.md`

### Consequência prática

O código Flutter já contém um boundary de plataforma em `lib/features/sensor/data/platform/sensor_platform.dart`, mas esse boundary não está ligado ao app atual.

Hoje o bootstrap faz:

- `GlucoreApp`
- `SensorController`
- `FakeSensorRepository`

Isso significa que:

- o app roda sem depender de Android native
- o fluxo observado hoje é simulado
- se alguém trocar para um repositório Android-backed sem implementar os channels no Android, o resultado esperado é `MissingPluginException` ou comportamento equivalente

## Arquitetura atual observada no Flutter

### Estrutura

Arquivos principais:

- `lib/app/bootstrap/app.dart`
- `lib/features/sensor/domain/models.dart`
- `lib/features/sensor/domain/events.dart`
- `lib/features/sensor/domain/sensor_repository.dart`
- `lib/features/sensor/data/platform/sensor_platform.dart`
- `lib/features/sensor/data/data_sources/fake_sensor_repository.dart`
- `lib/features/sensor/presentation/controller/sensor_controller.dart`
- `lib/features/sensor/presentation/pages/sensor_page.dart`

### Camada de domínio

O domínio já define os tipos centrais do MVP:

- `SensorConnectionStatus`
  - `idle`
  - `scanning`
  - `connecting`
  - `connected`
  - `warmingUp`
  - `readingAvailable`
  - `disconnected`
  - `error`
- `SensorSession`
- `GlucoseReading`
- `WarmupInfo`
- `SensorFailure`
- `SensorUiState`
- `SensorEvent`

Esse contrato de estados já é suficiente para um fluxo Android real emitir:

- restauração de sessão
- conexão
- warmup
- leitura atual
- erro

### Camada de repositório

`SensorRepository` já define uma interface razoável para o MVP:

- `restoreSession()`
- `registerSensor(String barcode)`
- `submitTransmitter(String transmitterBarcode)`
- `startMonitoring()`
- `stopMonitoring()`
- `observeSessionEvents()`
- `clearSession()`

Hoje a única implementação conectada ao app é `FakeSensorRepository`.

### Boundary de plataforma

`SensorPlatform` já define os channels e o schema de dados esperado entre Flutter e Android:

- `MethodChannel('glucore/sensor/methods')`
- `EventChannel('glucore/sensor/events')`

Métodos previstos:

- `restoreSession`
- `registerSensor`
- `submitTransmitter`
- `startMonitoring`
- `stopMonitoring`
- `clearSession`

O parsing de eventos também já está modelado para:

- `status`
- `session`
- `connected`
- `warmup`
- `reading`
- `failure`

Hoje isso é apenas um boundary disponível. Não há handler Android correspondente neste snapshot.

### Controller e UI

`SensorController` faz:

- subscribe no stream de eventos do repositório
- tentativa de restore em `init()`
- transição de estado para registro, monitoramento, parada e clear

`SensorPage` é uma UI única de MVP que exibe:

- status atual
- mensagem de erro
- campo para barcode do sensor
- ações de registrar, resetar, iniciar monitoramento, cancelar, desconectar e limpar sessão
- warmup com progress bar
- leitura atual de glicose

### Limitações já visíveis no Flutter atual

- não existe UI para fluxo de pareamento BLE real
- não existe localização; os textos estão hardcoded em inglês
- `submitTransmitter()` existe no contract, mas a UI atual não expõe esse fluxo
- o restore atual depende do repositório ativo; como o bootstrap usa o fake, o comportamento é local e simulado

## Estado real do Android neste checkout

O Android atual está praticamente no estado gerado pelo template do Flutter.

### O que foi observado

- `android/app/src/main/kotlin/com/berdegeus/glucore/MainActivity.kt` contém apenas `FlutterActivity`
- `android/app/build.gradle.kts` não contém configuração JNI/CMake/NDK além do padrão
- `android/app/src/main/AndroidManifest.xml` não contém permissões BLE nem configuração específica de libs nativas

### O que isso significa

Não há hoje:

- plugin Android próprio
- implementação de `MethodChannel`
- implementação de `EventChannel`
- boundary Kotlin para sensor
- sessão nativa persistida
- BLE/GATT
- JNI bridge
- loader de libs proprietárias

Em outras palavras: o Android atual não executa a estratégia Sibionics pretendida. Ele apenas hospeda o app Flutter.

## Fluxo simulado atual

O fluxo funcional que realmente existe hoje é o do `FakeSensorRepository`.

### Registro

- rejeita barcode vazio
- cria uma `SensorSession`
- emite `scanning`
- emite `connecting`
- marca como conectado
- emite `connected`

### Monitoramento

- exige sessão ativa
- emite `connecting`
- depois `connected`
- simula warmup
- depois emite leituras periódicas

### Restore

- só restaura a sessão fake em memória se ela ainda existir no ciclo de vida atual da instância
- não existe persistência Android real

### Limitação importante

Esse fluxo é útil para UI e máquina de estados, mas não prova nada sobre:

- BLE
- empacotamento de `.so`
- NDK
- JNI
- parsing de payload Sibionics
- persistência de sessão Android real

## Validação executada neste checkout

Validado em `2026-05-02`:

### Flutter analyze

Comando executado:

```bash
flutter analyze
```

Resultado:

- sucesso
- `No issues found!`

### Flutter test

Comando executado:

```bash
flutter test --no-pub
```

Resultado:

- sucesso
- o único teste atual é um smoke test que sobe `GlucoreApp` e verifica o texto `Glucore Sensor MVP`

### O que não foi validado neste checkout

- build Android com integração nativa Sibionics
- bridge JNI/C++
- empacotamento de `jniLibs`
- carregamento de libs proprietárias
- BLE/GATT

O motivo é simples: essas peças não estão presentes neste snapshot.

## Contexto histórico importante já validado fora deste snapshot

As seções abaixo documentam contexto técnico que já foi levantado e validado em iterações anteriores do projeto, mas que **não está presente neste checkout**.

Quem continuar o trabalho precisa entender isso para não assumir que o estado atual do repositório representa o máximo já alcançado.

### Estado Android/native mais avançado que já existiu

Em um estado de trabalho mais avançado, já havia evidência de uma arquitetura Android/native em andamento com os seguintes componentes:

- `SensorPlatformImpl`
- `SensorSessionManager`
- `SibionicsNativeBridgeAdapter`
- `GlucoreSibionicsBridge.kt`
- `SibionicsBleManager.kt`
- `SibionicsSessionRecord.kt`
- `SibionicsBarcode.kt`
- `android/app/src/main/cpp/glucore_sibionics_bridge.cpp`
- `android/app/src/main/cpp/CMakeLists.txt`
- `android/app/src/main/jniLibs/arm64-v8a/` com bibliotecas proprietárias
- configuração Gradle com `externalNativeBuild`, `abiFilters` e packaging de libs nativas

Nesse estado, a direção era:

- Flutter permanecendo como app/domain/presentation
- Kotlin assumindo sessão, channels, BLE e chamada do bridge
- JNI/C++ servindo como camada mínima para interagir com lógica proprietária

### Descobertas técnicas relevantes desse estado avançado

As seguintes descobertas já foram feitas e devem ser preservadas como contexto:

1. O primeiro alvo de bridge estava errado.
   O bridge chegou a ser apontado para símbolos inexistentes do tipo `Java_com_juggluco_JugglucoSibionics_*`.

2. O conjunto de bibliotecas empacotadas observado naquele estado parecia expor outra surface.
   A surface real encontrada estava em `libg.so`, com símbolos do tipo `Java_tk_glucodata_Natives_*`.

3. Houve necessidade de usar o `nativeLibraryDir` real do Android.
   Qualquer lógica manual de reescrever ABI/path era inadequada. O caminho precisava seguir o diretório fornecido pelo próprio Android.

4. O carregamento por caminho absoluto exigia empacotamento compatível.
   Em uma iteração anterior, o uso de `dlopen(<nativeLibraryDir>/libg.so)` exigiu packaging que extraísse as libs para filesystem quando a estratégia dependia de path absoluto.

5. Nem toda biblioteca do conjunto empacotado era um `.so` convencional.
   Já havia um caso em que:
   - `libinit.so` não era uma shared library válida
   - `libnative.so` era um executável ELF, não uma shared library normal

6. A restauração por ponteiro nativo se mostrou frágil.
   Uma falha em runtime no device foi rastreada até a chamada nativa equivalente a `activeSensorPtrs()` durante `restoreActiveSensor()`.

7. Como mitigação, houve uma tentativa anterior de usar um caminho de restore baseado em string.
   A ideia era preferir algo equivalente a `activeSensors()` e adiar o uso de paths baseados em ponteiro até ter mais confiança no comportamento do vendor code.

8. A validação rígida de barcode foi considerada incorreta.
   Em um estado anterior, chegou a existir uma regra que exigia barcode Sibionics de 16 caracteres. Depois isso foi relaxado para aceitar input cru, com trim e rejeição apenas de vazio, deixando a decisão final para a camada nativa.

### O que esse contexto histórico significa

Mesmo que o checkout atual não tenha nada disso, o projeto já acumulou algumas conclusões práticas:

- não assumir que a primeira surface JNI encontrada é a correta
- não assumir que todas as libs empacotadas são `dlopen()` targets válidos
- não assumir que restore por ponteiro é seguro
- não reintroduzir validação arbitrária de barcode no Flutter se a source of truth pretendida é a camada nativa
- manter a UI Flutter estável enquanto a integração Android/native amadurece por baixo

## Lacuna entre o checkout atual e a direção pretendida

Hoje existe uma diferença grande entre o que o app atual contém e o que o MVP Sibionics precisa.

### O Flutter já ajuda

O Flutter já oferece:

- estados e eventos do MVP
- tela mínima de operação
- boundary de plataforma desenhado
- smoke test simples

### O Android/native ainda precisa existir neste checkout

Para chegar ao MVP real, ainda seria necessário reintroduzir ou reconstruir neste repositório:

- implementação Android dos channels
- sessão Android persistida
- registro de sensor real
- restore de sessão real
- warmup e leitura real
- integração BLE/GATT
- bridge JNI/C++
- empacotamento de libs proprietárias
- documentação explícita da dependência proprietária

## Recomendações objetivas para quem continuar o projeto

### 1. Decidir qual estado é a base canônica

Antes de implementar qualquer coisa, o time precisa decidir uma destas opções:

- este checkout mínimo é a base correta e a integração Android/native deve ser reconstruída do zero aqui
- existe uma branch, stash, patchset ou worktree mais avançado que precisa ser recuperado e reintegrado

Sem essa decisão, desenvolvedores diferentes podem trabalhar assumindo realidades incompatíveis.

### 2. Não partir do pressuposto de que o bridge já está aqui

Se alguém vier trabalhar no bridge, a primeira verificação deve ser literal:

- existe `android/app/src/main/cpp`?
- existem `jniLibs` proprietárias?
- existe `SensorPlatformImpl`?
- existe `SibionicsNativeBridgeAdapter`?

Neste checkout, a resposta atual é não.

### 3. Preservar o contrato Flutter existente

Quando a integração Android/native voltar, a recomendação é manter estável o contrato já implícito no Flutter:

- restore de sessão
- registro de sensor
- start/stop monitoring
- stream de eventos com `status`, `session`, `warmup`, `reading`, `failure`

Isso reduz retrabalho na UI e concentra a complexidade onde ela realmente pertence: Android/native.

### 4. Tratar a integração proprietária como código isolado

Quando a parte nativa voltar ao repositório, ela deve vir claramente isolada:

- documentação de proveniência
- lista de bibliotecas esperadas
- observações de ABI suportada
- boundary Kotlin tipado
- C++ mínimo

Evitar espalhar detalhes proprietários pelo código Flutter é um objetivo importante.

## O que não assumir

Para evitar erros de onboarding, não assuma nenhum dos itens abaixo sem verificar o checkout atual:

- que o app já usa Android-backed repository
- que o app já registra channels no `MainActivity`
- que o app já possui BLE
- que o app já possui sessão persistida real
- que o app já possui bridge JNI/C++
- que o app já contém `libg.so` ou qualquer vendor lib
- que o app já possui regras corretas de barcode para Sibionics
- que qualquer comportamento histórico discutido anteriormente esteja materializado neste snapshot

## Mapa rápido do repositório atual

```text
lib/
  main.dart
  app/bootstrap/app.dart
  features/sensor/
    domain/
      models.dart
      events.dart
      sensor_repository.dart
    data/
      data_sources/fake_sensor_repository.dart
      platform/sensor_platform.dart
    presentation/
      controller/sensor_controller.dart
      pages/sensor_page.dart

android/
  app/
    build.gradle.kts
    src/main/
      AndroidManifest.xml
      kotlin/com/berdegeus/glucore/MainActivity.kt

test/
  widget_test.dart
```

## Resumo executivo para novos desenvolvedores

Se você está entrando agora no projeto, a leitura correta é:

- o Flutter já tem uma base mínima funcional para o MVP
- o app que roda hoje é fake/simulado
- a integração Android/native Sibionics não está presente neste checkout
- já existe contexto técnico importante sobre como essa integração provavelmente deve ser feita e quais armadilhas já apareceram
- antes de continuar o trabalho de integração, confirme se há um estado Android/native mais avançado a ser recuperado

Se esse estado mais avançado não existir mais, o próximo trabalho técnico real será reintroduzir a camada Android-backed de forma deliberada, começando por channels, sessão e boundary Kotlin, antes de BLE e antes de qualquer bridge nativa mais profunda.
