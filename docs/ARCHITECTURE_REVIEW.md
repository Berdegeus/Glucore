# Relatório de revisão arquitetural — Glucore

> **Este arquivo é um relatório de problemas, separado da documentação estável.** Gerado por inspeção integral do código em 2026-07-05, branch `feat/insulin-and-carb-management` (inclui mudanças não commitadas). Nenhuma correção foi aplicada — apenas diagnóstico.

Sumário: **16 problemas** (P1–P16), sendo **3 críticos** (P1, P2, P7). Seção A: revisão completa da conexão com sensores. Seção B: proposta de HAL Android/iOS.

Severidade: 🔴 crítico · 🟠 alto · 🟡 médio · ⚪ baixo/higiene.

---

## Problemas

### 🔴 P1 — Dados do paciente 100% remotos, sem cache offline
**Local:** `lib/injection_container.dart:51-53`, `lib/features/patient/data/datasources/patient_local_datasource.dart`
**Descrição:** `PatientLocalDataSource` é implementado apenas por `RemotePatientDataSource` (Dio). Leituras de glicose, alertas, diário e thresholds dependem do backend estar acessível.
**Impacto:** app de CGM inutilizável offline: sem rede, `PatientCubit.initialize` falha e leituras coletadas via BLE não são persistidas em lugar nenhum (perda de dados clínicos). Cada leitura nova (a cada ~5 min) gera tráfego de rede síncrono.
**Correção sugerida:** camada offline-first — datasource local real (drift/sqflite) como fonte primária + sincronizador em background para o backend (fila de pendências, retry). O nome `PatientLocalDataSource` volta a ser verdadeiro.

### 🔴 P2 — Sincronização replace-all (deleteMany + createMany)
**Local:** `backend/src/routes/carbs.ts:41-49`, `insulin.ts:42-51`, `alerts.ts:74-81`; cliente em `patient_cubit.dart` (todo CRUD regrava a lista) e `patient_local_datasource.dart` (POST da coleção inteira)
**Descrição:** adicionar/editar/apagar 1 item apaga **todas** as linhas do paciente e recria a coleção. IDs regenerados a cada save; máximo 100 itens (excedente é silenciosamente truncado e **apagado do banco**).
**Impacto:** perda de dados em concorrência (dois devices/reqs simultâneos = last-writer-wins da coleção inteira); histórico >100 entradas destruído; impossibilita FKs futuras (ex.: `GlucosePrediction` → reading) porque IDs não são estáveis.
**Correção sugerida:** endpoints por item (`POST /carbs` unitário retornando `id`, `PUT/DELETE /carbs/:id`), app passa a operar por `id`. Resolver junto com P4.

### 🟠 P3 — O(N²) de rede durante history sync
**Local:** `lib/features/patient/presentation/cubit/patient_cubit.dart:121-129` + `197-199`
**Descrição:** cada `historyReading` (podem ser dezenas por sync) dispara `saveReadings` com a lista completa (até 288 itens) → POST com até 288 upserts em transação no Prisma (`readings.ts:49-72`), N vezes seguidas.
**Impacto:** dezenas de POSTs pesados em segundos a cada reconexão; carga desnecessária no banco; janela grande de estados intermediários.
**Correção sugerida:** debounce/batch (persistir uma vez ao fim do sync — evento `readingAvailable` já sinaliza o fim) e/ou POST delta (só leituras novas).

### 🟠 P4 — Identidade de entradas por timestamp
**Local:** `patient_cubit.dart:50-82` (`editCarbEntry`/`deleteCarbEntry`/`editInsulinEntry`/`deleteInsulinEntry` casam por `time.millisecondsSinceEpoch`)
**Descrição:** carb/insulin não têm `id`; edição/remoção compara timestamps. Time-picker da UI tem precisão de minuto → duas entradas no mesmo minuto são indistinguíveis; editar o horário de uma entrada muda sua identidade.
**Impacto:** editar/apagar o item errado ou múltiplos itens; corrupção silenciosa do diário.
**Correção sugerida:** UUID gerado no app em cada entrada, propagado pela API/DB (o Prisma já tem `id`). Pré-requisito natural de P2.

### 🟠 P5 — Nomes que mentem sobre a arquitetura
**Local:** `patient_local_datasource.dart` (classe `RemotePatientDataSource`), `PatientLocalRepository`, `auth_local_datasource.dart` (interface `AuthLocalDataSource` ← impl `RemoteAuthDataSource`)
**Descrição:** interfaces/arquivos "Local" com implementações exclusivamente remotas.
**Impacto:** induz decisões erradas (CLAUDE.md ainda descreve persistência via SharedPreferences); custo de onboarding.
**Correção sugerida:** renomear para `PatientDataSource`/`AuthDataSource` (ou resolver P1 e manter Local para a impl local real).

### 🟠 P6 — CLAUDE.md desatualizado em pontos críticos
**Local:** `CLAUDE.md`
**Descrição:** afirma (a) persistência de paciente em SharedPreferences — hoje é backend REST; (b) "AuthCubit — local-only auth; no backend" — hoje é JWT remoto; (c) `SensorSessionManager (SharedPreferences cache)` — hoje SQLite; (d) `getlastGlucose()` → `firstOrNull { 40..400 }` — hoje decodificação de long empacotado (décimos de mg/dL); (e) "no mock data path remains" — `MockSensorRepository` existe (legítimo, debug-only).
**Impacto:** agentes que seguem CLAUDE.md à risca produzem código errado.
**Correção sugerida:** atualizar CLAUDE.md apontando para `docs/` como fonte detalhada.

### 🔴 P7 — Monitoramento BLE morre com a Activity (sem ForegroundService)
**Local:** `android/.../MainActivity.kt:17-27` (todo o grafo vive em `configureFlutterEngine`)
**Descrição:** `SibionicsBleManager`, sessão e ponte nativa pertencem à Activity. Android mata o processo em background e a coleta para; nenhum reconnect automático fora do app aberto.
**Impacto:** para um CGM, é o gap funcional mais grave: sem leituras contínuas nem alertas de hipo/hiperglicemia com o app fechado — os dados só voltam via history sync na próxima abertura (e P1 impede persistência do backlog offline).
**Correção sugerida:** `ForegroundService` (tipo `connectedDevice`) dono do BLE + notificação persistente; Activity/Flutter viram observadores. Ver desenho na Seção B.
**✅ Resolvido (Fase 2.1):** pilha do sensor movida para `SensorCore` (application-scoped, dono: `GlucoreApp`); `CgmForegroundService` (connectedDevice, START_STICKY) mantém o processo vivo com notificação persistente; reconexão com backoff 30 s → 2 min → 5 min no `SibionicsBleManager`. Sobrevivência em background pendente de validação em device físico.

### 🟠 P8 — Escritas GATT sem fila + APIs BLE deprecated
**Local:** `SibionicsBleManager.kt:669-676` (`writeToSensor`), `277-282` (CCCD), `344-347` (callback antigo)
**Descrição:** (a) `writeCharacteristic` é assíncrono e só aceita 1 operação pendente; o código dispara escritas consecutivas (ex.: código 4 re-auth seguido de código 5 time-sync) sem esperar `onCharacteristicWrite` — a segunda pode retornar `false` e é apenas logada. (b) Usa APIs deprecated desde API 33: `characteristic.value = bytes` + `writeCharacteristic(char)`, `descriptor.value`, e o overload antigo de `onCharacteristicChanged` que lê `characteristic.value` (payload pode ser sobrescrito por notificação subsequente antes da leitura).
**Impacto:** perda intermitente de comandos do protocolo (auth/time-sync/ask-data) → conexões que "morrem" sem causa clara; race no payload de notificação.
**Correção sugerida:** fila de escrita serializada por `onCharacteristicWrite`; migrar para `writeCharacteristic(char, bytes, WRITE_TYPE_*)` e o callback com `value: ByteArray` (API 33+) com fallback para versões antigas.

### 🟡 P9 — Estado do BleManager mutado de múltiplas threads
**Local:** `SibionicsBleManager.kt` (campos `currentGatt`, `writeChar`, `hasDeliveredCurrentReading`, `pendingCurrentCandidate` etc.)
**Descrição:** callbacks GATT chegam em binder threads; timers/runnables rodam no main looper; nenhum lock ou confinamento de thread.
**Impacto:** races raros (ex.: `disconnect()` do main vs `onCharacteristicChanged` de binder) → NPEs, leituras duplicadas, estado inconsistente.
**Correção sugerida:** despachar todos os callbacks GATT para o `mainHandler` na entrada (padrão confinamento), como já é feito parcialmente.

### 🟡 P10 — registerSensor sem resposta síncrona (resultado só por evento)
**Local:** `MainActivity.kt:35-39`, `SensorPlatformImpl.registerSensor`, `platform-channels` contrato
**Descrição:** o MethodChannel responde `null` imediatamente; sucesso/erro chegam pelo EventChannel. Eventos emitidos antes de o Flutter assinar o stream se perdem (sem replay).
**Impacto:** UI de registro depende de timing; erro de registro pode nunca chegar (tela fica esperando).
**Correção sugerida:** retornar o snapshot/erro direto no `result` do MethodChannel (a operação já é síncrona no nativo); manter evento como complemento.
**✅ Resolvido (Fase 2.2):** `registerSensor` retorna o snapshot (ou `PlatformException`) no MethodChannel; `SensorCore` guarda o último evento e o `onListen` do EventChannel o reemite ao novo sink.

### 🟡 P11 — Segurança do backend: segredo default, CORS aberto, sem rate-limit
**Local:** `backend/src/middleware/auth.ts:4` (`JWT_SECRET ?? 'dev-secret'`; mesmo padrão em `routes/auth.ts`), `index.ts:15` (`cors()` sem origem), login/forgot-password sem rate-limit.
**Impacto:** com env ausente em produção, qualquer um forja tokens; brute-force livre em `/auth/login`.
**Correção sugerida:** `process.env.JWT_SECRET` obrigatório (fail-fast no boot), `express-rate-limit` nas rotas de auth, CORS restrito por env.

### 🟡 P12 — Código morto / caminhos nunca usados
**Locais e itens:**
- `lib/features/auth/presentation/pages/home_page.dart` — sem nenhuma referência (raiz antiga).
- `GlucoreSibionicsBridge.parseJsonResult` + `sealed class Result` (`GlucoreSibionicsBridge.kt:84-110`) — nunca chamados (o parse real é do adapter).
- JNI stubs `saveMatchedDevice`/`getInitialWrite`/`handleNotification` (`glucore_sibionics_bridge.cpp:783-827` + declarações Kotlin) — sempre retornam erro; nenhum chamador.
- Payload `warmup` + `WarmupPayload` (`SensorPlatformImpl.kt:7`) e status `warmingUp` — nunca emitidos pelo Android real (só existem no contrato e no enum Dart).
- Fluxo `submitTransmitter` — plumbing completo (channel→SQLite) mas sem UI que o chame e sem chegada ao nativo; estados `AWAITING_TRANSMITTER`/`MONITORING`/`ERROR` de `SessionStatus` nunca atribuídos.
- `LibreNFCPage` — placeholder com TODO ("NFC não implementado"), alcançável pela UI (SensorChoicePage) — usuário vê botão que não faz nada.
- Tabelas Prisma sem uso: `AuthSession`, `SensorDevice`, `SensorBinding`, `SensorSession`, `SensorStatusEvent`, `GlucosePrediction`, `ClinicalReport`, `MetricsSnapshot`, `DashboardAccessGrant`, `HealthProfessional`, `Administrator` (schema aspiracional).
**Impacto:** ruído para manutenção; superfícies falsas para agentes.
**Correção sugerida:** remover os mortos triviais (home_page, parseJsonResult); decidir e documentar destino do fluxo transmitter e do warmup; marcar Libre como "em breve" desabilitado como o Dexcom.

### 🟡 P13 — Mock fura a camada de repositório
**Local:** `sensor_cubit.dart:6` (import direto de `mock_sensor_repository.dart`), `activateMock()`
**Descrição:** o cubit instancia o mock diretamente em vez de recebê-lo via DI/`SensorRepository`; contradiz o CLAUDE.md ("no mock data path remains").
**Impacto:** camada de apresentação conhece implementação de dados; duplicação do listener (P14).
**Correção sugerida:** ou aceitar como exceção documentada de debug (mínimo: comentário + CLAUDE.md), ou injetar um `SensorRepository` alternável em debug.

### ⚪ P14 — Lógica de mapeamento de eventos duplicada no SensorCubit
**Local:** `sensor_cubit.dart:51-80` vs `183-210` — o bloco `SensorUiState(...)` do listener real e do listener mock é copiado.
**Correção sugerida:** extrair `_mapEventToState(event, {isMock})`.

### ⚪ P15 — `SensorSessionManager.onUpgrade` = DROP TABLE
**Local:** `SensorSessionManager.kt:130-133`
**Descrição:** upgrade de schema descarta a sessão do sensor (usuário terá que re-registrar o sensor após update do app que suba `DB_VERSION`).
**Correção sugerida:** migração aditiva (`ALTER TABLE`) quando `DB_VERSION` mudar.

### ⚪ P16 — Validações e heurísticas frágeis no caminho de leitura
**Local:** `SibionicsBleManager.kt:521-555` (`decodePackedGlucose` aceita 20–1000 mg/dL — CLAUDE.md documenta 40–400), `604-608` (heurística s/ms de timestamp), `396` (qualquer código desconhecido de `SIprocessData` é tentado como leitura empacotada).
**Impacto:** valor de retorno inesperado do vendor pode virar leitura de glicose plausível; faixa clínica exibida sem clamp.
**Correção sugerida:** restringir faixa aceita (ex.: 20–500 com flag), logar códigos desconhecidos sem decodificar por padrão, cobrir `decodePackedGlucose` com testes unitários (é Kotlin puro, testável).

---

## Seção A — Revisão da conexão com sensores (tarefa item 5)

Fluxo completo documentado em [architecture/sensor-pipeline.md](architecture/sensor-pipeline.md). Avaliação:

**O que está bem feito:**
- Sequência EU protocol correta e fiel ao caminho Juggluco (auth → time-sync → activation → ask-data → glucose), com dispatch por código de `SIprocessData`.
- Estratégia de conexão robusta: endereço salvo primeiro, scan filtrado por serviço `ff30` como fallback, retry GATT 133 (3× + rescan), timeouts de scan (30 s) e conexão (20 s), `requestConnectionPriority(HIGH)`.
- Guarda anti-SIGSEGV no restore (cache local antes do nativo; restore usa `activeSensors` string-based porque `activeSensorPtrs` crasha — comentário honesto no C++).
- History sync bem separado da leitura atual (promoção com settle de 2 s + idade máxima de 20 min + descarte de out-of-order).
- Bootstrap nativo completo (`startsensors/startmeals/startthreads`) — evita os SIGSEGVs de globals nulos.

**Defeitos encontrados:** P7 (lifecycle), P8 (fila de escrita + APIs deprecated — o defeito mais provável de causar quedas intermitentes hoje), P9 (threading), P16 (validação).

**Legado/inutilizado no caminho do sensor:** stubs JNI não mapeados, fluxo transmitter, warmup, `parseJsonResult` (P12). O `EverSenseClear` no connect é herança Juggluco necessária (limpa estado do parser vendor) — manter.

**Otimização:** o pipeline BLE em si é event-driven (sem polling) — ok. O desperdício está acima dele: P3 (persistência O(N²) durante sync). `SIprocessData` roda no binder thread do GATT — chamadas nativas são rápidas, sem bloqueio relevante.

---

## Seção B — Proposta de reorganização: HAL Android/iOS + app Flutter (tarefa item 4.2)

### Diagnóstico
Hoje a fronteira Flutter↔nativo é um contrato de Maps sem tipo (channels), o Android mistura papéis (Activity = dono do ciclo de vida do sensor) e não existe caminho para iOS. A dependência dura é `libg.so` (arm64 **Android-only**) — qualquer plano iOS precisa tratar isso como restrição de primeira classe.

### Arquitetura proposta

```
┌────────────────────────── Flutter (Dart) ──────────────────────────┐
│ UI / Cubits (inalterados)                                          │
│ SensorRepository (domain) ← implementado sobre a API Pigeon        │
├──────────────── Pigeon (contrato tipado, gerado) ──────────────────┤
│  CgmHostApi:    restore/register/start/stop/clear                  │
│  CgmFlutterApi: onStatus/onHistoryReading/onReading/onError        │
├───────────── Android ─────────────┬───────────── iOS ──────────────┤
│ :sensor-hal (módulo Gradle puro)  │ SensorHAL (SwiftPM target)     │
│  interface CgmSensorHal           │  protocol CgmSensorHal         │
│   ├ SibionicsHal (BLE+JNI atual)  │   ├ (bloqueado por libg.so —   │
│   └ MockHal (debug)               │   │  exige SDK vendor iOS ou   │
│ CgmForegroundService (dono do HAL,│   │  reimplementação protocolo)│
│  sobrevive à Activity — resolve P7)│  └ LibreNfcHal (viável: NFC   │
│ MainActivity: só binding          │      CoreNFC, sem vendor lib)  │
└───────────────────────────────────┴────────────────────────────────┘
```

### Contrato do HAL (idêntico nas duas plataformas)

```kotlin
interface CgmSensorHal {
    fun capabilities(): Set<Capability>            // BLE, NFC, HISTORY_SYNC…
    suspend fun register(barcode: String): SensorSession
    suspend fun restore(): SensorSession?
    fun start(session: SensorSession)              // idempotente
    fun stop()
    val events: Flow<CgmEvent>                     // Status | HistoryReading | Reading | Failure
}
```
`SibionicsHal` encapsula o trio atual (`SibionicsBleManager` + `SibionicsNativeBridgeAdapter` + `SensorSessionManager`) sem reescrevê-lo — é extração de módulo, não rewrite. `MockSensorRepository` vira `MockHal` atrás da mesma interface (resolve P13).

### Passos incrementais (cada um entregável isolado)
1. **Pigeon** substitui os channels manuais — mata a classe de bugs "chave faltando no Map" e o parser permissivo (`platform-channels.md` vira código gerado). Baixo risco, alto ganho.
2. **Extrair `:sensor-hal`** (módulo Gradle) com a interface acima; Activity passa a consumir a interface. Nenhuma mudança de comportamento.
3. **`CgmForegroundService`** passa a ser o dono do HAL (resolve P7); Flutter conecta/desconecta do serviço.
4. **Persistência offline-first** (resolve P1/P3): leituras entram num DB local pelo próprio serviço; sync com backend vira job separado.
5. **iOS**: começar por `LibreNfcHal` (CoreNFC — sem dependência vendor; a UI Libre já existe como placeholder). Sibionics em iOS **só** com SDK oficial do fabricante ou reimplementação limpa do protocolo BLE (o EU protocol está materializado nos códigos 1–10 + comandos — reimplementável, mas o payload de auth `siAuthBytes` é derivado por criptografia dentro do `libg.so`; esforço alto, tratar como projeto próprio).

### Organização de pastas alvo (Flutter)
Manter feature-first atual. Ajustes: renomear datasources "Local" mentirosos (P5); `features/sensor/data/platform/` vira `features/sensor/data/pigeon/` gerado; mock sai de `data/repositories` para `data/hal/mock/`.

---

*Fim do relatório. Correções não aplicadas. Plano de execução detalhado (fases, passos, critérios de aceite): [ARCHITECTURE_FIX_PLAN.md](ARCHITECTURE_FIX_PLAN.md).*
