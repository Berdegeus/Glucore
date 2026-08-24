# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project objective

Glucore is an Android-first Flutter MVP for CGM sensors: Sibionics, Accu-Chek SmartGuide and FreeStyle Libre 2. Four layers: Flutter UI → Kotlin session/BLE → C++/JNI bridge → proprietary vendor `.so` files (arm64-v8a only).

**Current state (v1.1.0):** BLE connection live. Full GATT + Sibionics EU protocol (auth → time-sync → activation → history sync → glucose). **Multi-sensor**: Sibionics + Accu-Chek SmartGuide (PIN) + FreeStyle Libre 2 (NFC + Abbott lib) over a brand-agnostic `BrandBleManager`; app-scoped stack (`SensorCore` + `CgmForegroundService`). Flutter shell with Bloc/Cubit. **Offline-first** local SQLite (primary) + background sync; JWT auth tolerant of offline launch (P18) and scoped per-user (P19); nav providers above the root Navigator (P17). Backend: JWT auth + CRUD for carb/insulin.

**Versioning:** `dev` = integration branch for the in-progress version; `main` = tagged releases, device-regression-tested. See `docs/guides/versioning-and-branches.md` and `CHANGELOG.md`.

**Docs:** detailed docs live in `docs/` (index: `docs/README.md`; multi-brand sensor stack: `docs/reference/multi-sensor-architecture.md`; QA gates and PR checklist: `docs/guides/qa-process.md`; architecture review & known issues: `docs/ARCHITECTURE_REVIEW.md`; fix plan: `docs/ARCHITECTURE_FIX_PLAN.md`). Domain skills in `.claude/skills/`. When CLAUDE.md and `docs/` conflict, `docs/` wins.

**CI/review reference:** `.github/workflows/ci.yml` (GitHub Actions) is the source of truth for whether a PR is ready — not a local run by the author. It gates `flutter analyze`/`flutter test`, the Kotlin JVM unit tests, and the backend typecheck/test on every PR and push to `main`/`dev`. Full APK build/deploy stays out of CI until the vendor `.so` distribution problem is solved (`docs/ARCHITECTURE_FIX_PLAN.md`, item 2.4).

This file holds stable invariants (native constraints, commands, layer map). Anything that changes sprint to sprint — data flow detail, screen inventory, feature status — belongs in `docs/`, not here.

## Commands

```bash
flutter analyze
flutter test --no-pub
flutter run
flutter build apk --debug
flutter gen-l10n          # regenerate after editing .arb files
cd android && ./gradlew app:assembleDebug
cd backend && npm install && npx prisma migrate dev && npm run dev   # backend on :3001
```

## Architecture

### App root

```
main.dart → initDependencies() → App → AuthGate → PatientShellPage
```

`AuthGate` creates `SensorCubit` + `PatientCubit` when user is authenticated. `PatientShellPage` is the main shell (monitoring, history, alerts, settings).

### Flutter layer

State: Bloc/Cubit — no external state packages.

- **`SensorCubit`** — restores session, subscribes to Android event stream, auto-starts monitoring when session restored, exposes connection state to shell
- **`PatientCubit`** — reacts to `SensorCubit` stream and writes readings/alerts/carbs/insulin/thresholds **locally first**, never through the network on the UI path.
  - `PatientRepository` (`data/repositories/patient_repository.dart`) is the entry point: `load()` returns the local snapshot, `refreshFromRemote()` reconciles in the background, `ensureOwner()` wipes local data when the logged-in account changes.
  - `LocalPatientDataSource` (`data/datasources/patient_local_datasource.dart`) is the primary source: sqflite, `glucore_patient.db`, a `synced` flag per row.
  - `RemotePatientDataSource` (`data/datasources/patient_remote_datasource.dart`, Dio) is only reached through the sync path.
  - `PatientSyncService` (`data/sync/patient_sync_service.dart`) pushes pending rows with a ~2 s debounce, exponential retry, and a re-push when connectivity returns.
- **`AuthCubit`** — remote JWT auth: `RemoteAuthDataSource` → POST `/auth/login` / `/auth/register`; token stored in flutter_secure_storage (`AuthTokenStore`); validated via GET `/auth/status`. `AccountService` handles profile/password/email/reset.

`SharedPreferences` only stores the `onboarding_done` flag (`lib/app.dart`).

DI in `lib/injection_container.dart` — calls `sl.reset()` before registering to avoid stale state.

### Backend

Node/Express + Prisma/PostgreSQL in `backend/`, port 3001. Routes: `/auth`, `/readings`, `/carbs`, `/insulin`, `/alerts`, `/settings/alerts`. Auth via JWT Bearer. Flutter connects via `--dart-define=API_URL=http://<ip>:3001` (default `http://localhost:3001` in `lib/core/api/api_client.dart`).

### Debug panel / mock sensor

There is none. `DebugPanel` and `MockSensorRepository` were reverted in `f91adea`; no fake sensor path exists in `lib/` today. Any reference to `isMock`, `activateMock` or a debug panel is stale documentation, not code.

### Platform channels

- **MethodChannel** `glucore/sensor/methods`: session (`restoreSession`, `registerSensor`, `submitTransmitter`, `clearSession`), monitoring (`startMonitoring`, `stopMonitoring`), Libre NFC (`startNfcScan`, `stopNfcScan`, `getAbbottLibraryStatus`, `installAbbottLibrary`). `registerSensor` answers synchronously with the session snapshot or throws `PlatformException`.
- **EventChannel** `glucore/sensor/events`: streams events with fields `status`, `session`, `reading`, `historyReading`, `sync`, `nfc`, `failure`. `SensorCore` keeps the last event and replays it to a new subscriber on `onListen`, so no event is lost between registration and subscription.

Exact payload shapes: `docs/reference/platform-channels.md` (that doc wins on conflict).

**History sync:** the sensor sends a backlog of old readings before the current glucose. Android emits `syncingHistory` + `historyReading` during this phase; Flutter must not treat the first reading as current.

### Android layer

```
GlucoreApp (Application)
  └─ SensorCore (app-scoped singleton; owns the stack, keeps the last event)
       ├─ SensorSessionManager (SQLite session cache)
       ├─ SibionicsNativeBridgeAdapter (libg.so via JNI)
       ├─ BrandBleManager ── SibionicsBleManager / AccuChekBleManager / Libre2BleManager
       ├─ LibreNfcHandler (Libre 2 activation over NFC)
       └─ CgmForegroundService (connectedDevice; keeps monitoring alive without the Activity)

MainActivity → only registers the two channels and delegates to SensorCore
SensorPlatformImpl → resolves the active brand and drives the session
```

Per-brand protocol and what `BrandBleManager` provides for free: `docs/reference/multi-sensor-architecture.md`. Sibionics BLE sequence step by step: `docs/architecture/sensor-pipeline.md`.

### JNI / native bridge

`tk.glucodata.Natives` — direct JNI into `libg.so`. Call from Kotlin BLE layer only.

`libg.so` JNI_OnLoad resolves Java classes by fully-qualified name; a missing one aborts the process. The APK ships these five stubs today, in `android/app/src/main/java/tk/glucodata/` — the set the current code paths need:
- `tk.glucodata.GlucoseCurve`
- `tk.glucodata.Applic`
- `tk.glucodata.EverSense`
- `tk.glucodata.Libreview`
- `tk.glucodata.MessageSender`

Juggluco declares three more (`strGlucose`, `nums.item`, `NightPost`) that this app does **not** ship. If a crash reads `JNI FindClass called with pending exception ClassNotFoundException`, read the missing name from the log and add that stub — do not assume the list above is exhaustive for code paths not exercised yet. Field layouts, when needed, are in `docs/reference/native-stubs.md`.

`SibionicsNativeBridgeAdapter` covers `init`, `registerSensor`, `restoreActiveSensor` — returns `CallResult.Success / NoData / Error`.

## Critical constraints

**SIGSEGV guard:** `Natives.activeSensors()` before any sensor exists = native null-ptr crash. `restoreSession()` must check local cache first and skip native call if empty.

**JNI resolution:** `libg.so` loaded via `dlopen(RTLD_GLOBAL)` by C++ bridge; also loaded via `System.loadLibrary("g")` in `initializeNativeBridge()` so Android JNI resolver finds `Java_tk_glucodata_Natives_*` symbols.

**arm64-v8a only:** vendor `.so` files are arm64. Do not add ABI filters.

**`getlastGlucose()` layout:** returns `long[]`; index 0 = timestamp (seconds or ms, normalized), index 1 = packed reading. Packed long layout (Juggluco format, decoded in `SibionicsGlucoseDecoder`, pure Kotlin, unit-tested): bits 0–31 = glucose in tenths of mg/dL (accepted range 400..6000, i.e. 40–600 mg/dL), bits 32–47 = trend rate ×1000 as signed short, bits 48–55 = alarm code, bits 56–63 unused — a payload with anything there is rejected. Values the sensor pushes outside the documented `SIprocessData` codes go through `decodeUnsolicited`, which additionally drops anything without rate/alarm bits.

**barcode input:** `registerSensor` accepts raw trimmed barcode string. Validation is done by native layer. Example from sensor data matrix: `(01)06972831641803(11)250623(10)LT4F250671J(21)250671N869803EDU17`

**l10n:** edit `lib/l10n/app_pt.arb` / `lib/l10n/app_pt_BR.arb`, then run `flutter gen-l10n`. Never edit `lib/l10n/generated/` manually.

## Key files

| Path | Role |
|------|------|
| `lib/main.dart` | Entry point, DI init |
| `lib/injection_container.dart` | All DI registrations |
| `lib/features/auth/presentation/pages/auth_gate.dart` | Root after splash |
| `lib/features/patient/presentation/shell/patient_shell_page.dart` | Main shell |
| `lib/features/sensor/presentation/cubit/sensor_cubit.dart` | Sensor state, event stream |
| `lib/features/patient/presentation/cubit/patient_cubit.dart` | Patient data, local-first writes |
| `lib/features/patient/data/repositories/patient_repository.dart` | Local snapshot + remote reconciliation + owner guard |
| `lib/features/patient/data/sync/patient_sync_service.dart` | Debounced background push of pending rows |
| `lib/features/sensor/data/platform/sensor_platform.dart` | Platform channel wrapper |
| `lib/core/api/api_client.dart` | Dio + `API_URL` config |
| `android/.../MainActivity.kt` | Channel registration only; delegates to `SensorCore` |
| `android/.../SensorCore.kt` | App-scoped owner of the sensor stack, last-event replay |
| `android/.../CgmForegroundService.kt` | Keeps monitoring alive without the Activity |
| `android/.../SensorPlatformImpl.kt` | Brand resolution and session logic |
| `android/.../BrandBleManager.kt` | Shared scan/connect/write-queue/backoff/history-sync |
| `android/.../SibionicsBleManager.kt` | GATT + Sibionics EU protocol |
| `android/.../SibionicsGlucoseDecoder.kt` | Pure packed-reading decode + plausibility gates |
| `android/.../SibionicsNativeBridgeAdapter.kt` | JNI adapter |
| `android/.../SensorSessionManager.kt` | SQLite session cache |
| `android/app/src/main/java/tk/glucodata/Natives.java` | Direct JNI declarations |
| `android/app/src/main/cpp/CMakeLists.txt` | C++17 build, links vendor `.so` |
| `backend/src/index.ts` | Express app |

`Juggluco/` — reference copy of open-source Juggluco. **Not in this working tree** (never committed); if you clone it locally for reference, do not modify it and do not index the whole repo.

## What no longer exists

Do not reintroduce:
- `SensorController` (ChangeNotifier) — replaced by `SensorCubit`
- `SensorPage` as app root — replaced by `PatientShellPage` via `AuthGate`
- `FakeSensorRepository` / simulation timers / `PatientMockStore`
- `MockSensorRepository` + `DebugPanel` — existed briefly, reverted in `f91adea`; reintroducing a fake sensor needs a decision, not a copy-paste
- `SharedPreferences` for patient data — the local source of truth is sqflite (`glucore_patient.db`)


