# Stubs Java exigidos por libg.so

> Quando usar: crash `JNI FindClass called with pending exception ClassNotFoundException`, ou mudanças em `android/app/src/main/java/tk/glucodata/`.

`libg.so` (vendor Juggluco) resolve estas classes em `JNI_OnLoad`; se qualquer uma faltar no APK, o processo aborta no carregamento.

| Classe | Campos exigidos |
|---|---|
| `tk.glucodata.GlucoseCurve` | — |
| `tk.glucodata.strGlucose` | `time long`, `value String`, `sensorid String`, `rate float`, `index int`, `sensorgen2 int` |
| `tk.glucodata.nums.item` | `time long`, `mealptr int`, `value float`, `label int` |
| `tk.glucodata.Applic` | — |
| `tk.glucodata.EverSense` | — |
| `tk.glucodata.Libreview` | — |
| `tk.glucodata.MessageSender` | — |
| `tk.glucodata.NightPost` | — |

Fonte de referência: `Juggluco/Common/src/main/java/tk/glucodata/` (não modificar o diretório `Juggluco/`).

## `tk.glucodata.Natives`

Não é stub — é a superfície JNI real usada pelo Kotlin (`android/app/src/main/java/tk/glucodata/Natives.java`). Regras:
- Chamar **somente** da camada BLE Kotlin (`SibionicsBleManager`, `SensorPlatformImpl`); nunca do Flutter ou de código novo fora dessa camada.
- Símbolos `Java_tk_glucodata_Natives_*` vivem em `libg.so`; funcionam porque `System.loadLibrary("g")` roda em `initializeNativeBridge()`.
- Assinaturas novas: adicionar a declaração `native` aqui **e** confirmar que o símbolo existe no `libg.so` (via C++ `dlsym` ou teste em device) — símbolo ausente = `UnsatisfiedLinkError` em runtime, não em compile.

## Armadilhas

- ProGuard/R8: se minificação for habilitada um dia, manter keep rules para `tk.glucodata.**` (campos são acessados por JNI, invisível ao shrinker).
- Não mover essas classes de pacote — o nome fully-qualified é hardcoded no vendor `.so`.
