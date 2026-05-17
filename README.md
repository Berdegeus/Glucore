# Glucore

Glucore e um app mobile em Flutter com integracao Android nativa para um fluxo Sibionics Android-first.

O repositorio ja nao esta no estagio de mock isolado. O caminho principal hoje sobe uma shell Flutter autenticada, restaura sessao do sensor, conecta via BLE real, sincroniza backlog de leituras armazenadas no sensor e promove a glicose atual para a camada Flutter.

Este README descreve o estado real do repo hoje para que outros desenvolvedores nao assumam bootstrap antigo, caminho fake removido ou responsabilidades erradas entre Flutter e Android.

## Escopo atual

Recorte tecnico atual:

- Flutter para shell do app, dominio e apresentacao
- Bloc/Cubit para estado Flutter
- Kotlin para boundary de plataforma, sessao, BLE e coordenacao Android
- JNI/C++ minimo para isolar chamadas ao runtime nativo/proprietario
- bibliotecas nativas proprietarias arm64 carregadas pelo app Android

Recorte funcional atual:

- um sensor Sibionics ativo por vez
- restore de sessao ao abrir o app
- auto-connect quando ha sessao restaurada
- registro de sensor pelo caminho nativo
- conexao BLE/GATT real
- sincronizacao de leituras antigas do sensor antes da promocao da glicose atual
- exibicao da glicose atual na shell Flutter
- persistencia local de leituras, alertas, carbos, insulina e thresholds em `SharedPreferences`

Recorte de suporte atual:

- Android arm64
- fluxo focado em sensor Sibionics EU subtype `0`
- sem variantes chinesas neste fluxo
- sem banco de dados dedicado neste ciclo
- sem previsao glicemica real ainda

## Estado atual do app

O app hoje tem um unico root:

`main.dart -> initDependencies() -> App -> AuthGate -> PatientShellPage`

O caminho real do sensor e:

`Flutter UI -> SensorCubit -> AndroidSensorRepository -> SensorPlatform -> MainActivity / SensorPlatformImpl -> SibionicsNativeBridgeAdapter + SibionicsBleManager -> JNI/C++ bridge -> libs nativas proprietarias`

Pontos importantes:

- o caminho fake antigo deixou de ser o fluxo principal
- o Android continua sendo a autoridade operacional para registro, restore, BLE e leitura
- o Flutter agrega apresentacao e persistencia local dos dados recebidos
- o shell autenticado e a base do produto; a tela tecnica antiga do sensor nao e mais o root do app

## Arquitetura Flutter

### Root e composicao

Arquivos centrais:

- `lib/main.dart`
- `lib/app.dart`
- `lib/injection_container.dart`
- `lib/features/auth/presentation/pages/auth_gate.dart`
- `lib/features/patient/presentation/shell/patient_shell_page.dart`

Comportamento atual:

- `main()` inicializa bindings, DI e sobe `App`
- `App` sobe splash, onboarding e depois `AuthGate`
- `AuthGate` cria `SensorCubit` e `PatientCubit` quando o usuario esta autenticado
- `PatientShellPage` e a shell principal com navegacao entre monitoramento, historico, alertas e ajustes

### DI

`lib/injection_container.dart` registra:

- `SharedPreferences`
- auth datasource/repository/usecases/cubit
- `SensorPlatform`
- `SensorRepository` com `AndroidSensorRepository`
- `PatientLocalDataSource`
- `PatientLocalRepository`
- `SensorCubit`
- `PatientCubit`

`initDependencies()` faz `sl.reset()` antes de registrar tudo. Isso evita lixo de DI em testes e reinicializacoes.

### Estado Flutter

O padrao atual do app e Bloc/Cubit.

Cubits ativos:

- `AuthCubit`
- `SensorCubit`
- `PatientCubit`

#### SensorCubit

Arquivo central:

- `lib/features/sensor/presentation/cubit/sensor_cubit.dart`

Responsabilidades:

- restaurar sessao ao iniciar
- escutar `SensorEvent` vindos do Android
- auto-iniciar monitoramento quando ha sessao restaurada
- expor estado consumivel pela shell

Estados de conexao modelados em `lib/features/sensor/domain/models.dart`:

- `idle`
- `scanning`
- `connecting`
- `connected`
- `syncingHistory`
- `warmingUp`
- `readingAvailable`
- `disconnected`
- `error`

Hoje os estados mais relevantes do fluxo real sao:

- `disconnected` quando existe sessao mas o sensor ainda nao esta conectado
- `scanning` e `connecting` durante BLE
- `connected` logo apos bootstrap inicial
- `syncingHistory` enquanto valores antigos do sensor sao recebidos
- `readingAvailable` quando a glicose atual ja foi promovida

#### PatientCubit

Arquivos centrais:

- `lib/features/patient/presentation/cubit/patient_cubit.dart`
- `lib/features/patient/presentation/cubit/patient_state.dart`
- `lib/features/patient/data/datasources/patient_local_datasource.dart`
- `lib/features/patient/data/repositories/patient_local_repository.dart`

Responsabilidades:

- carregar snapshot local em `SharedPreferences`
- reagir ao stream do `SensorCubit`
- persistir leituras, alertas, carbos, insulina e thresholds
- transformar `GlucoseReading` do dominio do sensor em `GlucoseReadingItem` da shell

Persistencia local atual:

- leituras glicemicas recentes
- alertas locais
- carbos
- insulina
- configuracao de thresholds

Limites atuais:

- leituras: `288`
- alertas: `100`
- entradas manuais: `100`

### Features Flutter

#### Auth

Arquivos:

- `lib/features/auth/**`

Estado atual:

- auth local simples via `SharedPreferences`
- login/logout locais
- onboarding e splash integrados ao root app

Nao ha backend real de autenticacao neste ciclo.

#### Patient shell

Arquivos:

- `lib/features/patient/presentation/pages/monitoring_home_page.dart`
- `lib/features/patient/presentation/pages/history_page.dart`
- `lib/features/patient/presentation/pages/alerts_page.dart`
- `lib/features/patient/presentation/pages/alert_settings_page.dart`
- `lib/features/patient/presentation/pages/carb_entry_page.dart`
- `lib/features/patient/presentation/pages/insulin_entry_page.dart`
- `lib/features/patient/presentation/pages/sensor_link_page.dart`
- `lib/features/patient/presentation/pages/settings_page.dart`

Estado atual:

- `MonitoringHomePage` mostra glicose atual real, trend real e status real do sensor
- `HistoryPage` usa historico local persistido, nao mock
- `AlertsPage` usa alertas locais reais
- `AlertSettingsPage` persiste thresholds
- `CarbEntryPage` e `InsulinEntryPage` persistem entradas locais
- `SensorLinkPage` opera sobre `SensorCubit`, nao sobre estado fake

Observacoes:

- a UI ainda nao deve ser tratada como final de produto
- o foco atual e o fluxo de conexao e dados ao vivo

### Contrato Flutter <-> Android

Arquivo central:

- `lib/features/sensor/data/platform/sensor_platform.dart`

Channels atuais:

- `MethodChannel('glucore/sensor/methods')`
- `EventChannel('glucore/sensor/events')`

Metodos expostos:

- `restoreSession`
- `registerSensor`
- `submitTransmitter`
- `startMonitoring`
- `stopMonitoring`
- `clearSession`

Eventos relevantes:

- `status`
- `session`
- `sync`
- `reading`
- `historyReading`
- `failure`

Payloads relevantes:

- `reading`: leitura atual promovida
- `historyReading`: leitura antiga recebida durante `syncingHistory`
- `sync`: progresso do backlog com `receivedCount` e `latestTimestampMs`

O Flutter hoje esta preparado para:

- persistir backlog sem sobrescrever imediatamente a leitura atual
- promover a glicose atual quando o Android indicar `readingAvailable`

## Arquitetura Android

### MainActivity

Arquivo:

- `android/app/src/main/kotlin/com/berdegeus/glucore/MainActivity.kt`

`MainActivity` continua sendo o host do boundary Flutter/Android. Hoje ela:

- cria `SensorSessionManager`
- cria `SibionicsNativeBridgeAdapter`
- cria `SensorPlatformImpl`
- chama `initializeNativeBridge()` no startup
- cria `SibionicsBleManager`
- injeta o BLE manager no `SensorPlatformImpl`
- solicita permissoes BLE em runtime
- registra `MethodChannel` e `EventChannel`

Nao existe plugin Flutter separado nesta camada.

### SensorPlatformImpl

Arquivo:

- `android/app/src/main/kotlin/com/berdegeus/glucore/SensorPlatformImpl.kt`

Responsabilidades:

- inicializar a camada nativa
- restaurar sessao via adapter nativo
- registrar sensor via adapter nativo
- validar runtime nativo antes do start do BLE
- acionar `SibionicsBleManager`
- interromper scan/conexao
- emitir eventos para Flutter

Comportamento atual:

- `registerSensor()` aceita o barcode cru, faz `trim()` e rejeita apenas vazio
- a validacao final do barcode continua sendo do caminho nativo
- `restoreSession()` usa bridge nativo mais cache local Android

### SensorSessionManager

Arquivo:

- `android/app/src/main/kotlin/com/berdegeus/glucore/SensorSessionManager.kt`

Papel atual:

- espelho/cache local Android da sessao
- persistencia em `SharedPreferences`
- sincronizacao de snapshot vindo do runtime nativo

Nao e a autoridade principal do protocolo. A autoridade continua sendo o caminho nativo + BLE.

### SibionicsBleManager

Arquivo:

- `android/app/src/main/kotlin/com/berdegeus/glucore/SibionicsBleManager.kt`

Capacidades atuais:

- scan BLE filtrado
- tentativa por endereco salvo quando disponivel
- conexao GATT com retry para falhas transitarias
- descoberta de servicos e caracteristicas
- habilitacao de notificacoes
- bootstrap inicial do sensor
- processamento de notificacoes via runtime nativo
- emissao de backlog historico
- promocao da glicose atual

Comportamento importante ao conectar:

1. o app conecta e habilita notificacoes
2. o sensor pode enviar varias leituras antigas em sequencia
3. o Android entra em `syncingHistory`
4. cada leitura antiga pode ser emitida como `historyReading`
5. quando o fluxo se estabiliza perto do presente, a glicose atual e promovida
6. o Flutter recebe `readingAvailable`

Esse comportamento e intencional. O app nao deve assumir que a primeira leitura recebida ja e a glicose atual.

### Permissoes BLE

Manifesto e runtime ja contemplam:

- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `ACCESS_FINE_LOCATION`
- `android.hardware.bluetooth_le`

## Bridge nativo e libs proprietarias

Arquivos centrais:

- `android/app/src/main/kotlin/com/berdegeus/glucore/GlucoreSibionicsBridge.kt`
- `android/app/src/main/kotlin/com/berdegeus/glucore/SibionicsNativeBridgeAdapter.kt`
- `android/app/src/main/java/tk/glucodata/Natives.java`
- `android/app/src/main/cpp/glucore_sibionics_bridge.cpp`
- `android/app/src/main/cpp/CMakeLists.txt`

Papel atual dessa camada:

- inicializar o runtime nativo
- expor chamadas pequenas e focadas para Kotlin
- converter payloads crus em resultados tipados
- manter detalhes proprietarios fora do Flutter

`SibionicsNativeBridgeAdapter` cobre hoje:

- `init(...)`
- `registerSensor(...)`
- `restoreActiveSensor(...)`

Os retornos sao tratados como:

- `CallResult.Success`
- `CallResult.NoData`
- `CallResult.Error`

### Bibliotecas nativas

Dependencia atual:

- conjunto proprietario de `.so` arm64 em `android/app/src/main/jniLibs/arm64-v8a/`

Observacoes importantes:

- o build Android atual depende desses binarios existirem localmente
- o fluxo nativo e arm64-only neste ciclo
- a carga usa `nativeLibraryDir` e `dlopen()` no runtime Android
- esse conjunto nao deve ser tratado como artefato gerado do Flutter

## Localizacao

Arquivos centrais:

- `lib/l10n/app_pt.arb`
- `lib/l10n/app_pt_BR.arb`
- `lib/l10n/l10n.dart`
- `lib/l10n/localized_values.dart`

Saida gerada:

- `lib/l10n/generated/`

Observacao importante:

- `lib/l10n/generated/` e saida gerada localmente e pode precisar de `flutter gen-l10n`
- nao existe mais pipeline antigo de `app_localizations.dart` na raiz de `lib/l10n/`

## Estrutura util do repo

```text
lib/
  main.dart
  app.dart
  injection_container.dart
  core/
  features/
    auth/
    patient/
    sensor/
      data/
        platform/sensor_platform.dart
        repositories/android_sensor_repository.dart
      domain/
      presentation/cubit/
  l10n/

android/app/src/main/
  kotlin/com/berdegeus/glucore/
    MainActivity.kt
    SensorPlatformImpl.kt
    SensorSessionManager.kt
    SibionicsBleManager.kt
    SibionicsNativeBridgeAdapter.kt
    GlucoreSibionicsBridge.kt
  cpp/
    CMakeLists.txt
    glucore_sibionics_bridge.cpp
  jniLibs/arm64-v8a/
```

## O que foi removido da arquitetura antiga

Nao assuma mais estes caminhos como base do produto:

- `GlucoreApp` como root
- `lib/app/bootstrap/app.dart`
- `SensorController` com `ChangeNotifier`
- `SensorPage` antiga como tela principal
- `FakeSensorRepository` como caminho default
- `PatientMockStore` como source of truth da shell

Esses caminhos nao devem voltar como terceira arquitetura paralela.

## Estado atual do historico e dos dados

Hoje ja existe persistencia local em `SharedPreferences` para:

- leituras glicemicas
- alertas locais
- carbos
- insulina
- thresholds

Ainda nao existe neste ciclo:

- banco dedicado
- sync de backend
- analytics
- graficos
- predicao glicemica real

## Limites e pontos de atencao

Limites atuais conhecidos:

- foco em Android
- foco em arm64
- foco em um sensor ativo por vez
- foco em Sibionics EU subtype `0`

Pontos de atencao para contribuicao:

- nao reintroduzir caminho fake como atalho de produto
- nao mover a autoridade operacional do sensor para Flutter
- nao assumir que backlog historico e leitura atual sao a mesma coisa
- nao editar `lib/l10n/generated/` manualmente
- nao remover a separacao entre shell Flutter e integracao Android nativa

## Como rodar

### Backend

Prerequisitos: Node.js >= 18, PostgreSQL rodando localmente.

```bash
cd backend

# 1. Criar o banco (se ainda nao existe)
createdb glucore_dev

# 2. Copiar e editar variaveis de ambiente
cp .env.example .env       # edite DATABASE_URL e JWT_SECRET se necessario

# 3. Instalar dependencias e aplicar migrations
npm install
npx prisma migrate dev

# 4. Subir em modo dev
npm run dev
```

Para envio real de email de recuperacao de senha, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASS` no `.env`. Sem essas variaveis o token e impresso no terminal (modo dev).

### Flutter

Prerequisito: Flutter SDK instalado e Android conectado/emulador rodando.

```bash
# Descobrir o IP da maquina (macOS)
ipconfig getifaddr en0

# Rodar com o backend apontando para o IP certo
flutter run --dart-define=API_URL=http://<SEU_IP>:3001

# Ou com emulador (backend na mesma maquina)
flutter run --dart-define=API_URL=http://10.0.2.2:3001
```

Build de debug para dispositivo fisico:

```bash
flutter build apk --debug --dart-define=API_URL=http://<SEU_IP>:3001
```

### Outros comandos uteis

```bash
flutter gen-l10n          # regenerar localizacoes apos editar .arb
flutter analyze           # lint
flutter test --no-pub     # testes
cd android && ./gradlew app:assembleDebug
```

## Ultima leitura valida deste repo

O estado esperado neste checkout e:

- shell autenticada em Flutter
- estado de app via `Bloc/Cubit`
- persistencia local em `SharedPreferences`
- sensor real via Android nativo
- BLE real
- backlog historico antes da promocao da glicose atual

Se algum comportamento observado divergir disso, revise primeiro:

- `AuthGate`
- `SensorCubit`
- `PatientCubit`
- `SensorPlatformImpl`
- `SibionicsBleManager`
- `SibionicsNativeBridgeAdapter`
