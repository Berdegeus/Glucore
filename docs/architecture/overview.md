# Visão geral da arquitetura

> Quando usar: primeira leitura obrigatória; base para qualquer mudança que cruze camadas.

## Camadas

```
┌─────────────────────────────────────────────────────────┐
│ Flutter UI (lib/)                                       │
│   Bloc/Cubit: AuthCubit, SensorCubit, PatientCubit      │
├──────────────── MethodChannel / EventChannel ───────────┤
│ Android Kotlin (android/.../com/berdegeus/glucore/)     │
│   GlucoreApp (Application) → SensorCore (singleton)     │
│     ├─ SensorPlatformImpl · SibionicsBleManager (GATT)  │
│     ├─ SensorSessionManager · NativeBridgeAdapter       │
│     └─ CgmForegroundService (notificação persistente)   │
│   MainActivity: só registra os channels                 │
├──────────────── JNI ────────────────────────────────────┤
│ C++ (glucore_sibionics_bridge.cpp)                      │
│   dlopen(RTLD_GLOBAL) das libs vendor                   │
├─────────────────────────────────────────────────────────┤
│ Vendor proprietário: libg.so + libs auxiliares          │
│   (arm64-v8a, extraídas do Juggluco)                    │
└─────────────────────────────────────────────────────────┘

Paralelo:  Flutter ──Dio/REST──► backend/ (Express + Prisma + PostgreSQL)
```

## Fluxo de boot

```
main.dart
  → initDependencies()           # GetIt; sl.reset() antes de registrar
  → NotificationService.init()
  → App (app.dart)
      → SplashPage
      → OnboardingPage           # só se flag 'onboarding_done' ausente (SharedPreferences)
      → AuthGate
          ├─ não autenticado → LoginPage
          └─ autenticado → cria SensorCubit (initialize: restaura sessão
             e auto-inicia monitoramento) + PatientCubit (initialize:
             carrega snapshot do backend e assina SensorCubit.stream)
             → PatientShellPage
```

`PatientShellPage` = `IndexedStack` com 4 abas (`MonitoringHomePage`, `DiaryPage`, `ReportsPage`, `ProfilePage`) + FAB central que abre `AddObservationSheet` (registro de carbo/insulina).

No lado Android, a propriedade da pilha do sensor é da aplicação, não da Activity:

- **`GlucoreApp`** (`android:name` no manifest) possui um **`SensorCore`** lazy — singleton de escopo de aplicação que constrói `SensorSessionManager` (SQLite), `SibionicsNativeBridgeAdapter`, `SensorPlatformImpl` e `SibionicsBleManager`, inicializa a ponte nativa uma vez e concentra **toda** emissão de eventos em `dispatchEvent` (guarda o último evento para replay no `onListen` — ver `docs/reference/platform-channels.md`).
- **`MainActivity`** só registra os dois channels e delega ao `SensorCore`; pede permissões BLE + `POST_NOTIFICATIONS` (API 33+) em runtime. O monitoramento sobrevive à destruição da Activity.
- **`CgmForegroundService`** (`foregroundServiceType="connectedDevice"`, `START_STICKY`): iniciado quando `startMonitoring` tem sucesso e parado em `stopMonitoring`/`clearSession`. Não possui a pilha — mantém o processo em foreground e mostra notificação persistente (canal `cgm_monitoring`, IMPORTANCE_LOW) com status da conexão e última glicose, assinando eventos do `SensorCore`. Se o sistema reiniciar o service após kill (intent nulo) e a sessão em cache estiver `CONNECTED`, ele redispara `restoreSession` + `startMonitoring`.
- Desconexão inesperada: `SibionicsBleManager` reagenda rescan/reconexão com backoff 30 s → 2 min → 5 min (cap; zera ao conectar), então a coleta volta sozinha fora do app.
- Doze/otimização de bateria ainda podem atrasar reconexões; pedir isenção é opt-in do usuário (não implementado).

## Fluxo de dados de glicose (fim a fim)

1. Sensor Sibionics notifica em BLE (characteristic `ff31`).
2. `SibionicsBleManager` chama `Natives.SIprocessData`; código 1 → `getlastGlucose()` → decodifica long empacotado.
3. Evento (`syncingHistory`/`readingAvailable`) sai pelo `EventChannel`.
4. `SensorPlatform.observeSensorEvents()` → `AndroidSensorRepository` → `SensorCubit` emite `SensorUiState`.
5. `PatientCubit` (assinante do `SensorCubit.stream`) faz upsert em `readings` (cap 288), gera alertas de threshold, e persiste via `RemotePatientDataSource` → `POST /readings` no backend → Prisma/PostgreSQL.

**Importante:** apesar dos nomes `PatientLocalDataSource`/`PatientLocalRepository`, a persistência do paciente é 100% remota (Dio → backend). Não há cache offline. Só a sessão do sensor (SQLite Android) e o flag de onboarding são locais.

## Autenticação

Remota (não mais local-only): `RemoteAuthDataSource` → `POST /auth/login|register`, token JWT em `flutter_secure_storage` (`AuthTokenStore`), injetado como `Bearer` por interceptor Dio (`ApiClient`). `isLoggedIn()` valida token via `GET /auth/status`. `AccountService` cobre perfil/troca de e-mail/senha/reset.

## Arquivos-chave

| Arquivo | Papel |
|---|---|
| `lib/main.dart` | Entry point, DI |
| `lib/injection_container.dart` | Todas as registrações GetIt |
| `lib/app.dart` | Splash → onboarding → AuthGate |
| `lib/features/auth/presentation/pages/auth_gate.dart` | Cria SensorCubit/PatientCubit quando autenticado |
| `lib/features/patient/presentation/shell/patient_shell_page.dart` | Shell com 4 abas + FAB |
| `lib/core/api/api_client.dart` | Dio base URL (`--dart-define=API_URL`, default `http://localhost:3001`) |
| `android/.../MainActivity.kt` | Registro dos channels (delega ao `SensorCore`) |
| `android/.../GlucoreApp.kt` | Application; dona do `SensorCore` |
| `android/.../SensorCore.kt` | Agregado application-scoped da pilha do sensor |
| `android/.../CgmForegroundService.kt` | Foreground service + notificação persistente |
| `backend/src/index.ts` | Express, montagem das rotas |

## Armadilhas

- `initDependencies()` chama `sl.reset()` primeiro — nunca registrar dependências fora dele.
- Cubits são `registerFactory` (nova instância por `sl<...>()`); repositórios/datasources são lazy singletons.
- `AuthGate` recria SensorCubit/PatientCubit a cada transição de autenticação; estado de sensor não sobrevive a logout.
- Backend indisponível ⇒ `PatientCubit.initialize` lança e o app fica sem dados do diário (ver ARCHITECTURE_REVIEW §P1).
