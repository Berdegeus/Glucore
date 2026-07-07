# Gerenciamento de estado (Flutter)

> Quando usar: mudanças em Cubits, DI, stream de eventos do sensor, modo mock/debug ou persistência de dados do paciente.

## Cubits (flutter_bloc, sem outros pacotes de estado)

### AuthCubit (`features/auth/presentation/cubit/`)
Usecases (`LoginUseCase`, `RegisterUseCase`, `LogoutUseCase`, `GetAuthStatusUseCase`) sobre `AuthRepositoryImpl` → `RemoteAuthDataSource` (Dio). Token JWT em `flutter_secure_storage` via `AuthTokenStore`. Estados: `initial/loading/authenticated/unauthenticated/failure` (equatable).

### SensorCubit (`features/sensor/presentation/cubit/sensor_cubit.dart`)
- `initialize()`: idempotente (`_initialized`); assina `repository.observeSessionEvents()`; `restoreSession()` → se restaurou, emite `disconnected`+sessão e **auto-chama `startMonitoring()`**.
- `startMonitoring()`: no-op se status já ativo (scanning/connecting/connected/syncingHistory/readingAvailable); emite `scanning` otimista antes de chamar a plataforma.
- Mapeamento de eventos: `historySyncInfo`/`historyReading` só são mantidos enquanto `status == syncingHistory`; `reading` e `warmupInfo` fazem fallback pro valor anterior; `session` idem.
- **Modo mock (só kDebugMode)**: `activateMock()` troca a assinatura para um `MockSensorRepository` interno (replay: scanning→connecting→connected→24 history readings→leitura a cada 5 min, random-walk 70–200); `injectMockReading(value)` emite leitura única; `deactivateMock()` volta ao stream real. Estado mock carrega `isMock: true`.

### PatientCubit (`features/patient/presentation/cubit/patient_cubit.dart`)
- `initialize(sensorCubit)`: carrega snapshot **local** (`repository.load()` = sqflite, nunca depende de rede), assina `sensorCubit.stream` e dispara `refreshFromRemote()` em background — push das pendências → GET do backend → persiste local (`synced=1`, pendências locais preservadas) → re-emite o snapshot local resultante. Offline: refresh retorna `null`, silencioso.
- `_handleSensorState` (reação a cada `SensorUiState`):
  - `syncingHistory` + `historyReading` → upsert na lista `readings`.
  - `readingAvailable` → upsert + alertas de threshold (low/high, dedupe: mesmo tipo em <15 min é descartado).
  - `disconnected|error` vindos de estado ativo → `NotificationService.showSensorDisconnected()`.
  - `connected` após `disconnected|error` → alerta `sensorReconnected`.
  - Persistência: `saveReadings`/`saveAlerts` **somente se `!isMock`** (dados de mock não vão nem pro sqflite); ao sair do mock, recarrega snapshot local descartando dados de mock em memória.
- CRUD carbo/insulina: listas imutáveis reordenadas por `time` desc; **identidade da entrada = `time.millisecondsSinceEpoch`** (ver ARCHITECTURE_REVIEW §P4); cada operação regrava a coleção inteira (local e, via sync, no backend).
- Caps: `maxReadings=288`, `maxAlerts=100`, `maxEntries=100` (em `PatientRepository`).

### Camada de dados do paciente (offline-first, §P1)

```
PatientCubit → PatientRepository (data/repositories/patient_repository.dart)
                ├─ LocalPatientDataSource (sqflite)   ← fonte primária
                ├─ RemotePatientDataSource (Dio)      ← espelho REST
                └─ PatientSyncService (data/sync/)    ← push de pendências
```

- Escrita: local primeiro (aguardada, `synced=0`), depois `schedulePush()` fire-and-forget.
- `PatientSyncService`: push com debounce (~2 s), retry exponencial (inicial + 2), único push em voo (serializado), reagendado quando a conectividade volta (`connectivity_plus`). Envia coleção inteira via replace-all do backend (API unitária = Fase 4).
- `LocalPatientDataSource`: banco `glucore_patient.db`, tabelas `readings/alerts/carbs/insulin/settings` (colunas de `data-models.md` + flag `synced`); helpers `pendingCollections()`, `mark*Synced()`, `replaceWithServerSnapshot()` (linhas `synced=0` locais vencem o servidor até o push).

## DI (`lib/injection_container.dart`)

`sl.reset()` primeiro, sempre. Singletons lazy: `AuthTokenStore`, `AccountService`, datasources, repositórios, `SensorPlatform`. Factories: os 3 cubits. `Dio` criado uma vez por `ApiClient.create(tokenStore)` (interceptor Bearer).

## Ciclo de vida dos cubits

`App` provê `AuthCubit` global. `AuthGate` cria `SensorCubit`+`PatientCubit` **apenas quando autenticado** (MultiBlocProvider) — logout destrói ambos. Páginas empurradas com `Navigator` fora da árvore do shell precisam repassar cubits via `BlocProvider.value` (helper `buildPatientScopedRoute` em `patient_widgets.dart`).

## Persistência — quem guarda o quê

| Dado | Onde | Mecanismo |
|---|---|---|
| Token JWT | dispositivo | `flutter_secure_storage` |
| Flag onboarding | dispositivo | `SharedPreferences` (`onboarding_done`) |
| Sessão do sensor | dispositivo (Android) | SQLite `glucore_session.db` |
| Readings/alerts/carbs/insulin/thresholds | **dispositivo** (sqflite `glucore_patient.db`, fonte primária) + espelho no backend | `LocalPatientDataSource` + `PatientSyncService` → REST via `RemotePatientDataSource` |

## Arquivos-chave

| Arquivo | Papel |
|---|---|
| `lib/features/sensor/presentation/cubit/sensor_cubit.dart` | Estado do sensor + mock debug |
| `lib/features/patient/presentation/cubit/patient_cubit.dart` | Dados do paciente, alertas, persistência |
| `lib/features/patient/presentation/cubit/patient_state.dart` | `PatientState` (inclui `sensorState` embutido) |
| `lib/features/patient/data/repositories/patient_repository.dart` | `PatientRepository` (offline-first, caps) |
| `lib/features/patient/data/datasources/patient_local_datasource.dart` | `LocalPatientDataSource` (sqflite, fonte primária) |
| `lib/features/patient/data/datasources/patient_remote_datasource.dart` | `RemotePatientDataSource` (Dio, espelho REST) |
| `lib/features/patient/data/sync/patient_sync_service.dart` | Push de pendências (debounce + retry + connectivity) |
| `lib/features/sensor/data/repositories/android_sensor_repository.dart` | Adapta platform events → domain stream |
| `lib/features/sensor/data/repositories/mock_sensor_repository.dart` | Fake debug-only |
| `lib/injection_container.dart` | Registrações GetIt |
| `lib/core/debug/debug_panel.dart` | Bottom sheet debug (ativar mock, injetar hipo/hiper, limpar leituras) |

## Armadilhas

- `PatientState.sensorState` duplica o estado do `SensorCubit` — UI pode ler dos dois; mantenha consistência assinando só um.
- Não persistir nada quando `isMock == true` — o padrão já está no `PatientCubit`, siga-o em código novo.
- `SensorCubit` tem o mapeamento evento→estado duplicado (listener real e listener mock). Alterou um, altere o outro (§P14).
- `MockSensorRepository` é importado direto pelo cubit (fura a abstração); não usar como exemplo de injeção.
- `predictionAvailable` em `PatientState` é hardcoded `false` — recurso de predição ainda não existe.
