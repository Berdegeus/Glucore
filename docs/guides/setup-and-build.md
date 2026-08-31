# Setup e build

> Quando usar: compilar, rodar, configurar ambiente ou entender restrições de build.

## Comandos Flutter

```bash
flutter analyze
flutter test --no-pub
flutter run                                    # backend em localhost:3001 (emulador: use IP)
flutter run --dart-define=API_URL=http://192.168.1.100:3001   # device físico
flutter build apk --debug
flutter gen-l10n                               # após editar .arb
cd android && ./gradlew app:assembleDebug
```

## Backend

```bash
cd backend
npm install            # workspace npm: packages/shared + services/glucose-service
cp services/glucose-service/.env.example services/glucose-service/.env   # DATABASE_URL, JWT_SECRET, SMTP_*
npm run migrate:dev
npm run dev            # porta 3001

# para rodar a suíte: precisa de um segundo banco (glucore_test)
cp services/glucose-service/.env.test.example services/glucose-service/.env.test
npm run build && npm test
```

## l10n

Editar `lib/l10n/app_pt.arb` e `lib/l10n/app_pt_BR.arb` → `flutter gen-l10n`. **Nunca** editar `lib/l10n/generated/`. Acesso via `context.l10n` (`lib/l10n/l10n.dart`). Valores não-traduzíveis compartilhados em `lib/l10n/localized_values.dart` (ex.: `kDaysOfWeek` está em `patient_models.dart`).

## Restrições de build (invioláveis)

| Restrição | Motivo |
|---|---|
| arm64-v8a apenas; **não** adicionar ABI filters | vendor `.so` só existem em arm64 |
| Stubs `tk/glucodata/*` devem existir no APK | `JNI_OnLoad` de `libg.so` aborta sem eles ([reference/native-stubs.md](../reference/native-stubs.md)) |
| `libg.so` carregada 2×: `dlopen(RTLD_GLOBAL)` no C++ **e** `System.loadLibrary("g")` no Kotlin | resolvedor JNI do Android precisa do loadLibrary p/ chamadas diretas Kotlin→Natives |
| C++17, CMake ≥ 3.10.2, linka só `log` e `dl` | `android/app/src/main/cpp/CMakeLists.txt` |
| Emulador x86 não roda o caminho nativo | use device arm64 ou modo mock do DebugPanel |

## Permissões Android

`MainActivity.requestBlePermissionsIfNeeded()` pede em runtime (API ≥ 31): `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION`. Sem elas o scan falha com "BLE permissions not granted".

## Dependências Flutter relevantes (pubspec.yaml)

`flutter_bloc` (estado), `get_it` (DI), `dio` (HTTP), `flutter_secure_storage` (JWT), `shared_preferences` (flag onboarding), `mobile_scanner` (barcode), `fl_chart` (gráfico glicose), `flutter_local_notifications`, `google_fonts`, `equatable` (só em auth).

## Arquivos-chave

| Arquivo | Papel |
|---|---|
| `pubspec.yaml` | Deps Flutter; SDK ^3.9.0 |
| `l10n.yaml` | Config gen-l10n |
| `android/app/src/main/cpp/CMakeLists.txt` | Build da ponte C++ |
| `backend/package.json` | Scripts backend |
| `analysis_options.yaml` | Lints (flutter_lints 5) |

## Armadilhas

- Testar sem sensor físico: DebugPanel (`kDebugMode`) → "Ativar Mock". Não criar caminhos de simulação novos.
- `test/widget_test.dart` tem 7 linhas (placeholder) — `flutter test` passa mas não valida nada.
- Backend fora do ar quebra login e o carregamento do PatientCubit — para trabalhar só na UI, suba o backend ou use mock + usuário já logado.
