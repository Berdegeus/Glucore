# Relatório de revisão arquitetural — Glucore

> **Este arquivo é um relatório de problemas, separado da documentação estável.** Gerado por inspeção integral do código em 2026-07-05, branch `feat/insulin-and-carb-management`. **Atualizado em 2026-07-07** (branch `feat/multi-sensor-libre2-accuchek`) por uma segunda revisão independente: status de P1–P16 reavaliado contra o código atual e novos problemas P17–P35 adicionados. **Atualizado em 2026-07-30 (v1.1.0):** os 3 críticos P17, P18 e P19 foram corrigidos (ver CHANGELOG.md). Demais problemas seguem em diagnóstico.

Sumário: **35 problemas** (P1–P35). Da revisão original, **10 resolvidos** (P1, P3, P6, P7, P8, P9, P10, P14, P15, P16), **3 parciais** (P2, P5, P11) e **3 abertos** (P4, P12, P13). P6 e P16 fecharam em 2026-08-20. A revisão de 2026-07-07 acrescentou os críticos P17, P18, P19 — **todos resolvidos na v1.1.0 (2026-07-30)**. Os demais de P20–P35 seguem abertos com **Solução proposta** (diagnóstico + desenho técnico). Seção A: revisão da conexão com sensores. Seção B: proposta de HAL Android/iOS.

Severidade: 🔴 crítico · 🟠 alto · 🟡 médio · ⚪ baixo/higiene.

---

## Problemas (revisão 2026-07-05, status atualizado)

### 🔴 P1 — Dados do paciente 100% remotos, sem cache offline
**Local:** `lib/injection_container.dart:51-53`, `lib/features/patient/data/datasources/patient_local_datasource.dart`
**Descrição:** `PatientLocalDataSource` era implementado apenas por `RemotePatientDataSource` (Dio). Leituras de glicose, alertas, diário e thresholds dependiam do backend estar acessível.
**✅ Resolvido (2026-07-07):** offline-first implementado — `LocalPatientDataSource` (sqflite, `glucore_patient.db`, flag `synced` por linha) é a fonte primária (`patient_local_datasource.dart:17`); `PatientSyncService` faz push com debounce/retry e reagenda quando a conectividade volta (`patient_sync_service.dart:18`); `PatientRepository.refreshFromRemote()` reconcilia preservando pendências (`patient_repository.dart:58-71`). Problemas residuais na sincronização: ver P27 e P28.

### 🔴 P2 — Sincronização replace-all (deleteMany + createMany)
**Local:** `backend/services/glucose-service/src/modules/carbs/carbs.repository.ts:58-59`, `insulin/insulin.repository.ts:62-63`, `alerts/alerts.repository.ts:25-26`; cliente em `patient_sync_service.dart:90-117` (POST da coleção inteira)
**Descrição:** adicionar/editar/apagar 1 item apaga **todas** as linhas do paciente e recria a coleção; máximo 100 itens (excedente silenciosamente truncado).
**Impacto:** perda de dados em concorrência (dois devices = last-writer-wins da coleção inteira); histórico >100 entradas destruído.

**🟡 Parcial (2026-07-07):** o backend ganhou endpoints por item (`POST /carbs/item`, `PUT/DELETE /carbs/item/:id` — o batch está marcado deprecated em `backend/services/glucose-service/src/modules/carbs/carbs.routes.ts:18`) e o replace-all agora preserva ids enviados pelo cliente, **mas o app continua usando exclusivamente o replace-all em lote** (`patient_remote_datasource.dart:73-86`). O risco multi-device permanece integral. Agravante novo: o replace-all não é atômico — ver P27.
**Solução proposta:** migrar o app para a API por item, em cima do P4 (UUID no cliente):
1. Trocar a flag `synced` por coluna de coleção por um **op-log local**: tabela `pending_ops(id, entity, entity_id, op ∈ {upsert, delete}, payload_json, created_at)`. Cada `addCarbEntry`/`edit*`/`delete*` grava a linha do dado **e** enfileira uma op.
2. `PatientSyncService._pushPending` passa a drenar o op-log em ordem: `upsert` → `POST /carbs/item` ou `PUT /carbs/item/:id`; `delete` → `DELETE /carbs/item/:id`. Op confirmada (2xx) é removida da fila; falha mantém e re-tenta. Idempotência garantida pelo UUID.
3. Manter o replace-all em lote apenas para leituras de glicose (append-only, sem edição) e como bootstrap de conta nova; remover o uso para carbs/insulin/alerts.
4. Concorrência multi-device deixa de ser last-writer-wins de coleção e vira por item; conflitos residuais (mesmo item editado em dois devices) resolvidos por `updated_at` mais recente no backend.

### 🟠 P3 — O(N²) de rede durante history sync
**Local:** `lib/features/patient/presentation/cubit/patient_cubit.dart`
**✅ Resolvido (2026-07-07):** o backlog de history readings só atualiza o estado em memória; a persistência acontece uma única vez quando a leitura atual chega (`patient_cubit.dart:143-151`, comentário explícito), e o push remoto tem debounce de 2 s no `PatientSyncService` (`patient_sync_service.dart:53-59`).

### 🟠 P4 — Identidade de entradas por timestamp
**Local:** `patient_cubit.dart:72-104` (`editCarbEntry`/`deleteCarbEntry`/`editInsulinEntry`/`deleteInsulinEntry` casam por `time.millisecondsSinceEpoch`); PKs locais `time_ms` (`patient_local_datasource.dart:59-74`)
**Descrição:** carb/insulin não têm `id`; edição/remoção compara timestamps; agora o timestamp também é PRIMARY KEY no SQLite local — duas entradas no mesmo ms colidem silenciosamente (`ConflictAlgorithm.replace`), e editar o horário muda a identidade.
**Impacto:** editar/apagar o item errado; corrupção silenciosa do diário; e agora também é a chave usada pelo `mark*Synced` do sync (ver P28).
**Status 2026-07-07: aberto e reforçado** — o backend já expõe ids estáveis (P2 parcial), mas o app não os consome.
**Solução proposta:**
1. Adicionar `final String id` a `CarbEntry`/`InsulinEntry` (`patient_models.dart`), gerado com `package:uuid` (v4) no construtor de criação; entradas vindas do backend usam o id do servidor.
2. Migração do SQLite local para v2: `ALTER TABLE carbs ADD COLUMN id TEXT` + backfill `id = uuid()` para linhas existentes; trocar a PK: recriar tabela com `id TEXT PRIMARY KEY` e `time_ms` como coluna indexada comum (mesmo para `insulin`). `onUpgrade` aditivo, sem DROP de dados.
3. `editCarbEntry`/`deleteCarbEntry`/`editInsulinEntry`/`deleteInsulinEntry` passam a casar por `entry.id` (o `copyWith` de edição preserva o id — mudar horário deixa de mudar identidade).
4. Payloads remotos incluem `id` (o backend já preserva UUIDs válidos no replace-all e já opera por id nos endpoints unitários).
5. `mark*Synced` do sync passa a marcar por `id` — elimina metade do P28 de graça.

### 🟠 P5 — Nomes que mentem sobre a arquitetura
**Local:** `auth_local_datasource.dart` (interface `AuthLocalDataSource` ← impl `RemoteAuthDataSource`)

**🟡 Parcial (2026-07-07):** `patient_local_datasource.dart` agora contém um datasource local de verdade (`LocalPatientDataSource`) e o remoto vive em `patient_remote_datasource.dart` — resolvido no lado patient. Permanece a mentira no auth: `AuthLocalDataSource` é implementada só por `RemoteAuthDataSource` (`auth_local_datasource.dart:6-21`).
**Solução proposta:** rename mecânico, sem mudança de comportamento: interface `AuthLocalDataSource` → `AuthDataSource`, arquivo `auth_local_datasource.dart` → `auth_datasource.dart`; ajustar o registro em `injection_container.dart:39-41` e imports. Se o P18 introduzir um modo offline com estado de auth cacheado, aí sim criar um `LocalAuthDataSource` real (token + userId em secure storage) e a interface volta a ter duas implementações honestas.

### 🟠 P6 — CLAUDE.md desatualizado em pontos críticos
**Local:** `CLAUDE.md`
**✅ Resolvido (2026-08-20).** O arquivo foi reescrito contra o código: `CLAUDE.md:44-48` descreve a persistência local-first (`PatientRepository` → `LocalPatientDataSource` sqflite + `PatientSyncService`), `CLAUDE.md:74-85` traz o mapa `GlucoreApp → SensorCore → SensorPlatformImpl → BrandBleManager {Sibionics, AccuChek, Libre2}` com `CgmForegroundService` e `LibreNfcHandler`, e `CLAUDE.md:15` fixa a regra de que detalhe volátil vive em `docs/`. Três divergências extras foram encontradas e corrigidas no caminho: o painel de debug e o `MockSensorRepository` não existem mais (revertidos em `f91adea`), a faixa do packed reading estava documentada como 200..10000 quando o decoder aceita 400..6000, e a lista de métodos do canal não tinha as chamadas NFC do Libre. **Causa tratada, não só o sintoma:** o arquivo deixou de ser gitignored (`.gitignore` perdeu a linha `CLAUDE.md`) e passou a ser versionado, então a divergência agora aparece em diff de PR; o item de checklist "mudou camada ou fluxo? atualizou CLAUDE.md/docs?" está em `docs/guides/qa-process.md`.

**Histórico — Status 2026-07-07: aberto (conteúdo mudou, desatualização persiste).** Os itens originais foram corrigidos, mas o arquivo voltou a divergir: descreve o `PatientCubit` como persistindo "via REST to the backend through RemotePatientDataSource" quando hoje a persistência primária é local/offline-first com sync em background, e não menciona `LocalPatientDataSource`, `PatientSyncService` nem o suporte multi-marca (Accu-Chek/Libre 2, `BrandBleManager`, `SensorCore`, `CgmForegroundService`).
**Solução proposta:** tratar a causa, não só o sintoma:
1. Reescrever as seções divergentes: `PatientCubit` = escrita local-first (`LocalPatientDataSource`) + `PatientSyncService` (debounce/retry/connectivity) + `refreshFromRemote`; camada Android = `GlucoreApp → SensorCore → SensorPlatformImpl → BrandBleManager {Sibionics, AccuChek, Libre2} + CgmForegroundService + LibreNfcHandler`.
2. Reduzir o CLAUDE.md a invariantes estáveis (constraints nativas, comandos, mapa de camadas) e mover detalhe volátil para `docs/` — a regra "quando conflitar, docs/ vence" já existe; o CLAUDE.md deve parar de duplicar o que muda por sprint.
3. Processo: item fixo de PR-checklist ("mudou camada/fluxo? atualizou CLAUDE.md/docs?") — é o único mecanismo que impede a terceira reincidência.

### 🔴 P7 — Monitoramento BLE morre com a Activity (sem ForegroundService)
**✅ Resolvido (Fase 2.1):** pilha do sensor movida para `SensorCore` (application-scoped, dono: `GlucoreApp`); `CgmForegroundService` (connectedDevice, START_STICKY) mantém o processo vivo com notificação persistente; reconexão com backoff 30 s → 2 min → 5 min. Confirmado no código atual (`SensorCore.kt:24`, `CgmForegroundService.kt:30`, `BrandBleManager.kt:42`). Sobrevivência em background pendente de validação em device físico. Ressalva nova: o caminho de restart do serviço roda tudo na main thread (ver P32) e retoma monitoramento com base num status CONNECTED que é gravado antes de haver conexão real (ver P33).

### 🟠 P8 — Escritas GATT sem fila + APIs BLE deprecated
**✅ Resolvido (2026-07-07):** `BrandBleManager` implementa fila de escrita serializada por `onCharacteristicWrite` com retry único (`BrandBleManager.kt:727-802`), usa `writeCharacteristic(char, bytes, type)`/`writeDescriptor(cccd, value)` em API 33+ com fallback legado, e o overload antigo de `onCharacteristicChanged` copia o buffer antes de postar (`BrandBleManager.kt:328-347`).

### 🟡 P9 — Estado do BleManager mutado de múltiplas threads
**✅ Resolvido (2026-07-07):** todos os callbacks GATT são postados ao main looper na entrada e há `assertMainThread()` em builds debug (`BrandBleManager.kt:104-110, 306-375`).
**⚠️ Divergência nova:** o confinamento é violado pelo caminho NFC do Libre 2 — ver P25.

### 🟡 P10 — registerSensor sem resposta síncrona (resultado só por evento)
**✅ Resolvido (Fase 2.2):** `registerSensor` retorna o snapshot (ou `PlatformException`) no MethodChannel; `SensorCore` guarda o último evento e o `onListen` do EventChannel o reemite ao novo sink (`SensorCore.kt:156-165`). Efeito colateral novo: erro chega duplicado (exceção + evento) — ver P29.

### 🟡 P11 — Segurança do backend: segredo default, CORS aberto, sem rate-limit

**🟡 Parcial (2026-08-26):** `JWT_SECRET` é obrigatório com fail-fast no boot — `loadEnv()`/`getJwtSecret()` lançam `MissingEnvError` e o bootstrap sai 1 (`backend/services/glucose-service/src/lib/env.ts:24-30,42`); o CORS é restringível por `CORS_ORIGIN` (`backend/services/glucose-service/src/app.ts:39`, `backend/services/glucose-service/src/lib/env.ts:59-62`) — mas sem a env cai em `cors()` aberto. Rate-limit **existe** desde então (`backend/services/glucose-service/src/routes/auth.ts:47-63`): 10 req/15 min por IP em login, forgot-password e reset-password; 20/15 min em register; desligado sob `NODE_ENV=test`. Resta só o item 2 abaixo (CORS obrigatório em produção).
**Solução proposta:**
1. `express-rate-limit` escopado nas rotas de auth: ex. login 10 req/15 min por IP, register 5/15 min, forgot-password 3/h; resposta 429 com `Retry-After`. Montar só em `/auth`, não global (o sync do app é legitimamente chatty).
2. CORS: em `NODE_ENV=production`, exigir `CORS_ORIGIN` no mesmo estilo fail-fast do `env.ts` (sem env → `process.exit(1)`); manter fallback aberto apenas em dev.
3. Complementos baratos: `helmet()` global e limite de body (`express.json({ limit: '256kb' })`) — os POSTs de coleção têm teto conhecido (288 leituras).

### 🟡 P12 — Código morto / caminhos nunca usados
**Status 2026-07-07: parcialmente resolvido.**
- ✅ `home_page.dart` removido; `LibreNFCPage` deixou de ser placeholder (fluxo NFC + biblioteca Abbott implementados).
- ✅ Status `warmingUp` agora é emitido pelo caminho NFC do Libre 2 (`LibreNfcHandler.kt:78,95,104`).
- Aberto: fluxo `submitTransmitter` segue com plumbing completo (channel→SQLite) e **nenhuma UI chamando** (nenhuma referência fora do cubit/platform); payload `warmup` do BLE (`WarmupPayload`, `SensorPlatformImpl.kt:7`) segue nunca emitido; tabelas Prisma aspiracionais seguem sem uso.
**Solução proposta:**
1. **Transmitter:** nenhum dos três sensores suportados usa transmissor separado — remover o fluxo inteiro (método `submitTransmitter` nos channels/cubit/repository, `SibionicsBarcode.validateTransmitterBarcode`, coluna `transmitter_id` mantida no SQLite por compatibilidade mas sem escrita, estados `TRANSMITTER_ASSIGNED`/`AWAITING_TRANSMITTER` do enum). Se um sensor futuro precisar, o HAL (Seção B) reintroduz via capability.
2. **Warmup BLE:** o Libre 2 já expõe warmup via NFC; para Sibionics, ou emitir `warmup` real a partir do tempo de ativação nativo (o `SensorSessionManager` saberá o `activated_at_ms` com o P24), ou apagar `WarmupPayload` e o campo `warmup` do contrato de evento — não deixar contrato fantasma.
3. **Prisma:** mover as tabelas aspiracionais (`GlucosePrediction`, `ClinicalReport`, `HealthProfessional`, …) para um comentário/roadmap no schema e gerar migração de drop, ou marcá-las com `/// roadmap` — o critério é que `prisma migrate` não crie superfície que nenhuma rota toca.

### 🟡 P13 — Mock fura a camada de repositório
**Local:** `sensor_cubit.dart:6` (import direto de `mock_sensor_repository.dart`), `activateMock()` (`sensor_cubit.dart:237-264`)
**Status 2026-07-07: aberto** (inalterado). O CLAUDE.md ao menos já documenta o mock como exceção legítima de debug.
**Solução proposta:** inverter a dependência sem cerimônia extra: criar um `SwitchableSensorRepository implements SensorRepository` registrado no DI como o `SensorRepository` (delegando para `AndroidSensorRepository` por padrão), com `enableMock()`/`disableMock()` disponíveis apenas em debug (`assert` + `kDebugMode`). Ele expõe **um único stream** que re-emite o do delegate ativo e anexa a flag `isMock` ao evento. O `SensorCubit` perde `_mockRepo`, `activateMock`, `deactivateMock` e o import do mock (`sensor_cubit.dart:6,16,237-294`); o `DebugPanel` passa a chamar o switcher via `sl<>`. `injectMockReading` vira método do próprio mock (`emitReading(value)`), acessado pelo switcher.

### ⚪ P14 — Lógica de mapeamento de eventos duplicada no SensorCubit
**✅ Resolvido (2026-07-07):** extraído `_mapEventToState(event, {isMock})` (`sensor_cubit.dart:51-67`), usado pelos listeners real e mock.

### ⚪ P15 — `SensorSessionManager.onUpgrade` = DROP TABLE
**✅ Resolvido (2026-07-07):** migração aditiva por versão com comentário proibindo DROP (`SensorSessionManager.kt:136-143`).

### ⚪ P16 — Validações e heurísticas frágeis no caminho de leitura

**✅ Resolvido (2026-08-20).** O residual foi fechado no decoder puro: `SibionicsGlucoseDecoder.kt:51` rejeita qualquer payload com bits 56–63 diferentes de zero (bits não usados pelo formato) e `SibionicsGlucoseDecoder.kt:79-84` acrescenta `decodeUnsolicited`, que descarta todo valor abaixo de `0x10000` — ou seja, sem bits de rate/alarm — porque nessa faixa um código de protocolo é indistinguível de uma leitura. `SibionicsBleManager.kt:278-284` passou a usar esse caminho e loga o descarte com o valor bruto. A heurística s/ms continua, mas agora `normalizeTimestamp` devolve `usedFallback` (`SibionicsGlucoseDecoder.kt:97-98`) e `SibionicsBleManager.kt:258-264` registra em log quando o relógio do device foi usado, o que torna sensor com relógio quebrado detectável em campo. Cobertura: `SibionicsGlucoseDecoderTest` foi de 10 para 17 testes, e as quatro mutações do sensor de discriminação (remover o gate de bits altos, zerar o limiar de `decodeUnsolicited`, fixar `usedFallback` em false, alargar a faixa) são todas mortas por teste.

**Histórico — 🟡 Parcial (2026-07-07):** decodificação extraída para `SibionicsGlucoseDecoder` (Kotlin puro, testável), faixa aceita restringida para 40–600 mg/dL (`SibionicsGlucoseDecoder.kt:18-19`), e códigos desconhecidos de `SIprocessData` só são tentados como leitura quando um history sync já produziu timestamp (`SibionicsBleManager.kt:216-225`). Residual: durante um sync ativo, um código vendor inesperado ainda pode virar leitura plausível; a heurística s/ms de timestamp permanece (`SibionicsGlucoseDecoder.kt:58-62`).
**Solução proposta:**
1. Fechar o residual do `handleDirectGlucoseResult`: além do gate por `lastSyncedTimestampMs`, exigir estrutura de leitura plausível — código com bits de rate/alarm coerentes (ex.: rejeitar quando os bits 56–63, não usados pelo formato, são ≠ 0) e valor pequeno demais para ser um packed reading (`code < 0x10000` já cobre os códigos de protocolo 1–10; nunca decodificar nessa faixa).
2. Timestamp: manter a heurística s/ms mas registrar métrica/log estruturado sempre que o fallback `System.currentTimeMillis()` for usado, para detectar sensor com relógio quebrado em campo.
3. Testes JVM para `SibionicsGlucoseDecoder`: bordas (399/400/6000/6001 décimos), rate negativo (short com sinal), alarm code, e `normalizeTimestampMs` (0, segundos, ms) — a classe é pura justamente para isso.

---

## Problemas novos — revisão independente 2026-07-07

### 🔴 P17 — Crash de navegação: `SensorChoicePage` fora do escopo dos providers
**Local:** `lib/features/patient/presentation/pages/settings_page.dart:57`, `profile_page.dart:159` (push com `MaterialPageRoute` puro) → `sensor_choice_page.dart:31,46,61` (`buildPatientScopedRoute(..., withSensorCubit: true)` lê `context.read<SensorCubit>()`)
**Descrição:** `SensorCubit`/`PatientCubit` são providos na subtree do `AuthGate` (`auth_gate.dart:28-39`), abaixo do `Navigator` raiz. Rotas empurradas no Navigator raiz ficam **acima** desses providers. As demais telas usam `buildPatientScopedRoute` (que captura os cubits no push — `patient_widgets.dart:83-110`), mas `SensorChoicePage` é empurrada com `MaterialPageRoute` cru; dentro dela, qualquer tap num card de marca faz `context.read<SensorCubit>()` num contexto sem provider.
**Impacto:** `ProviderNotFoundException` — tocar em "Sibionics"/"Accu-Chek"/"Libre 2" a partir de Configurações ou Perfil quebra a tela de escolha de sensor. O fluxo multi-marca inteiro (feature da branch) é inalcançável por esses caminhos.
**✅ Resolvido (v1.1.0, commit `3ab0025`):** o `MultiBlocProvider` (`SensorCubit`/`PatientCubit`) foi movido para **acima do Navigator raiz** via `MaterialApp.builder` (`app.dart`), gated em `AuthStatus.authenticated` (variante mais simples que o Navigator aninhado proposto — sem mudança de UX). `AuthGate` só alterna login × shell; `buildPatientScopedRoute` virou `MaterialPageRoute` simples (flags no-op) e os 2 pushes crus (settings/profile) foram escopados como rede de segurança. Guarda de regressão em `test/features/patient/sensor_choice_navigation_test.dart`.
**Solução proposta (histórica):**
1. **Imediato:** trocar os dois pushes por `buildPatientScopedRoute(context, const SensorChoicePage(), withSensorCubit: true)` — a `SensorChoicePage` então repassa os cubits já disponíveis no seu contexto (o helper interno dela continua funcionando).
2. **Estrutural (elimina a classe de bug):** mover o `MultiBlocProvider` de `SensorCubit`/`PatientCubit` para **cima do Navigator** — na prática, um `Navigator` aninhado dentro do branch autenticado do `AuthGate` (ou providers acima do `MaterialApp.home` criados/destruídos com o login). Toda rota empurrada nesse Navigator herda os providers e `buildPatientScopedRoute` some.
3. **Guarda de regressão:** widget test que monta o shell autenticado (com fakes), navega Configurações → "Trocar sensor" → tap em cada marca e falha se lançar `ProviderNotFoundException`.

### 🔴 P18 — Início offline desloga o usuário e apaga o token
**Local:** `lib/features/auth/data/datasources/auth_local_datasource.dart:79-89` (`isLoggedIn`), `auth_cubit.dart:35-41` (`checkAuthStatus`)
**Descrição:** `isLoggedIn()` valida o token com `GET /auth/status` e, em **qualquer** `DioException` — inclusive erro de conexão/timeout —, **deleta o token** do secure storage e retorna false. `checkAuthStatus` também mapeia erro de rede para `unauthenticated`.
**Impacto:** app de CGM offline-first que exige rede para abrir: sem internet, o usuário cai na tela de login, não consegue autenticar (login também exige rede) e perde acesso a todos os dados locais e ao monitoramento BLE — que nem dependem do backend. Pior: o token foi destruído, então mesmo uma queda momentânea do backend desloga permanentemente.
**✅ Resolvido (v1.1.0, commit `5004f9f`):** `isLoggedIn()` retorna o ternário `AuthSessionStatus { authenticated, invalid, unreachable }` (datasource → repository → usecase); o token só é apagado em 401/403; erro de rede/timeout/5xx → `unreachable` mantém o token. `AuthCubit.checkAuthStatus` emite `authenticated` otimista com `offlineValidation: true` em `unreachable`, e revalida ao voltar a conectividade (`connectivity_plus` injetável). Testes em `test/features/auth/auth_cubit_offline_test.dart`. Tratamento runtime de 401 (P20) segue fora de escopo.
**Solução proposta (histórica):**
1. `isLoggedIn()` passa a devolver resultado ternário (`authenticated | invalid | unreachable`): deletar o token **apenas** quando `e.response?.statusCode == 401/403`; em `connectionError`/timeout/5xx, manter o token e reportar `unreachable`.
2. `AuthCubit.checkAuthStatus`: `unreachable` + token presente → emitir `authenticated` otimista (os dados e o BLE são locais) com flag `offlineValidation: true` no estado.
3. Revalidação adiada: assinar o mesmo stream do `connectivity_plus` já usado pelo `PatientSyncService`; quando a rede volta, repetir `GET /auth/status` — 401 aí sim desloga (fluxo do P20).
4. O login/registro continuam exigindo rede (correto); só a *sessão existente* ganha tolerância a offline.

### 🔴 P19 — Logout/troca de usuário não isola dados: sensor continua e o banco local é compartilhado
**Local:** `settings_page.dart:110` (logout → só `AuthCubit.logout()`), `auth_cubit.dart:110-119`, `patient_local_datasource.dart:22` (`glucore_patient.db` único, sem escopo de usuário), `sensor_cubit.dart` (nada para o monitoramento no logout)
**Descrição:** logout apenas apaga o token JWT. (a) O monitoramento BLE + `CgmForegroundService` continuam rodando; a sessão do sensor fica no SQLite Android. (b) O banco local do paciente é por-dispositivo, não por-usuário. No próximo login — **inclusive com outra conta** — `SensorCubit.initialize()` restaura a sessão e religa o monitoramento, `PatientCubit.initialize()` carrega o snapshot local do usuário anterior, e o `PatientSyncService` empurra essas pendências para a conta recém-logada.
**Impacto:** dados clínicos de um paciente exibidos e **persistidos na conta de outro** (privacidade + integridade); leituras do sensor físico de A gravadas no prontuário de B.
**✅ Resolvido (v1.1.0, commit `75c416a`):** estado local amarrado a um dono. `glucore_patient.db` v2 ganhou tabela aditiva `meta(owner_user_id)` (`getOwner`/`setOwner`/`wipeAllData`); `AuthTokenStore.readUserId()` decodifica o `sub` do JWT localmente (sem rede, sem dependência nova). `PatientRepository.ensureOwner()` (chamado em `PatientCubit.initialize`) faz wipe + `SensorCubit.clearSession()` quando a conta diverge. Logout **amigável** (opção b): monitoramento não é forçado a parar; o guard de owner no `PatientSyncService` (não faz push quando `owner != userId atual`) também interrompe o sync pós-logout sem `pause()` explícito, já que o token some. Testes em `test/features/patient/user_isolation_test.dart`. (O backend já expunha `userId` em `/auth/status` — nenhuma mudança de servidor foi necessária.)
**Solução proposta (histórica):** amarrar todo estado local a um dono e verificar na entrada:
1. **Registrar o dono:** ao autenticar, guardar o `userId` (o backend já o tem no JWT `sub`; expor em `/auth/status`) junto ao token no secure storage e numa tabela `meta(owner_user_id)` do `glucore_patient.db`.
2. **Verificação no login:** `PatientCubit.initialize` (ou o `AuthGate` antes de criar os cubits) compara `userId` autenticado × `owner_user_id` local. Divergiu → wipe do banco patient, `SensorCubit.clearSession()` (para BLE + foreground service + sessão Android) e gravação do novo dono. Igual → segue normal.
3. **Logout:** duas UX válidas — (a) conservador: logout também para o monitoramento e limpa a sessão do sensor; (b) amigável: logout mantém tudo e a verificação do passo 2 protege a troca de conta. Recomendado (b) + parar apenas o `PatientSyncService` (sem token não há push válido) para não queimar retries em 401.
4. O push pendente nunca pode cruzar contas: o `PatientSyncService` deve checar `owner_user_id == userId atual` antes de qualquer `pushNow()`.

### 🟠 P20 — Token expirado = sync silenciosamente morto para sempre (sem tratamento de 401)
**Local:** `lib/core/api/api_client.dart` (nenhum interceptor de resposta), `patient_repository.dart:67-70` (`catch (_) → null`), `patient_sync_service.dart:76-88` (retry engole tudo)
**Descrição:** não existe tratamento de 401 em nenhuma camada. Quando o JWT expira, todo push/pull falha e é engolido como se fosse "offline"; o usuário continua vendo o app funcionar (dados locais), sem qualquer indicação de que nada mais sincroniza, e o `AuthCubit` nunca fica sabendo.
**Impacto:** perda silenciosa e permanente de espelhamento no backend; contradiz a expectativa de "backup na nuvem".
**Solução proposta:**
1. **Interceptor Dio de resposta** no `ApiClient`: em 401 (fora das rotas `/auth/login|register`), publicar num `StreamController<AuthEvent>` singleton (`sessionExpired`) registrado no DI.
2. `AuthCubit` assina esse stream no construtor: `sessionExpired` → deletar token, emitir `unauthenticated(error: sessionExpired)`; `AuthGate` derruba para a tela de login com mensagem "sessão expirada".
3. `PatientSyncService`: classificar erro no `_pushWithRetry` — 401 é falha *permanente* (não re-tentar; abortar o ciclo e aguardar novo login), rede/5xx continua re-tentável. Os dados ficam pendentes (`synced=0`) e sincronizam após o re-login.
4. **Visibilidade:** expor no `PatientState` um `syncStatus` (`synced | pending(n) | authRequired`) derivado de `pendingCollections()` + resultado do último push; exibir como badge discreto em Configurações — o usuário passa a saber quando o espelhamento parou.

### 🟠 P21 — Permissões BLE nunca pedidas em Android 10/11; pedido fire-and-forget
**Local:** `android/.../MainActivity.kt:155-172`
**Descrição:** `ACCESS_FINE_LOCATION` só é solicitada quando `SDK_INT >= S` (junto com as permissões novas). Em Android 10/11 (API 29/30), o scan BLE **exige** location e ela nunca é pedida — o scan filtrado simplesmente não retorna resultados. Além disso o pedido é fire-and-forget (sem `onRequestPermissionsResult`): o usuário pode iniciar o pareamento antes de conceder, e `hasBlePermissions()` só cobre `BLUETOOTH_SCAN/CONNECT` (API 31+), não location.
**Impacto:** em Android 10/11 o app fica preso em "Procurando sensor…" até o timeout de 30 s e termina em erro genérico, sem nenhuma pista da causa real.
**Solução proposta:**
1. Corrigir a matriz de permissões: `SDK_INT >= S` → `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT`; `SDK_INT in 23..30` → `ACCESS_FINE_LOCATION` (e declarar `neverForLocation` no scan quando aplicável). `hasBlePermissions()` no `BrandBleManager` precisa refletir a mesma matriz (hoje só checa as permissões de API 31+, que em API < 31 retornam granted por não existirem — mascarando a falta de location).
2. Transformar o pedido em fluxo com resultado: método de canal `ensureBlePermissions()` → `MainActivity.requestPermissions` + `onRequestPermissionsResult` → completa o `MethodChannel.Result` com `granted | denied | permanentlyDenied`.
3. Gate na UI: `SensorLinkPage`/`LibreNFCPage` chamam `ensureBlePermissions()` antes de `registerSensor`/`startMonitoring`; `denied` → card explicativo com botão "Permitir"; `permanentlyDenied` → botão que abre as configurações do app (`app_settings`). Nunca iniciar scan sem a permissão da plataforma corrente.
4. Adicionalmente checar `BluetoothAdapter.isEnabled` e (API < 31) location services ligados — as duas outras causas de "scan mudo" — e mapear para mensagens específicas.

### 🟠 P22 — Alertas de hipo/hiperglicemia nunca geram notificação
**Local:** `lib/core/notifications/notification_service.dart:37-47` (`showGlucoseLow`/`showGlucoseHigh` sem nenhum chamador), `patient_cubit.dart:163-172` e `253-272` (thresholds só adicionam item à lista de alertas em memória)
**Descrição:** o serviço de notificação tem métodos prontos para glicose baixa/alta, mas o `PatientCubit` só registra o alerta na lista interna (visível na aba de notificações). A única notificação de sistema disparada é a de sensor desconectado (`patient_cubit.dart:214-216`).
**Impacto:** para um CGM é o alerta de maior valor clínico — hipoglicemia com o app em background passa despercebida.
**Solução proposta:**
1. **Curto prazo (Flutter):** em `_withThresholdAlerts`, quando `_prependAlert` efetivamente adiciona (não dedupe), disparar `NotificationService.showGlucoseLow/High(value)` — o dedupe de 15 min já existente vira o throttle da notificação. Gate `!isMock`. Canal Android com `Importance.high` + som/vibração próprios para hipo (diferente do canal de status).
2. **Correto de verdade (Android):** o alerta não pode depender do Flutter estar vivo — a leitura já chega no processo nativo via `SensorCore.dispatchEvent`. Adicionar um `GlucoseAlertObserver` registrado como listener do `SensorCore` (mesmo mecanismo do `CgmForegroundService`): compara `reading.value` com thresholds (espelhados do Flutter para `SharedPreferences`/SQLite Android a cada `updateAlertSettings`) e posta a notificação nativamente, com dedupe próprio. O caminho Flutter do item 1 vira redundância inofensiva (mesmo id de notificação).
3. Tratar `POST_NOTIFICATIONS` negada (API 33+): estado visível em Configurações de Alertas ("notificações desativadas pelo sistema").

### 🟠 P23 — Race na inicialização do SensorCubit: replay do evento pode ser sobrescrito
**Local:** `sensor_cubit.dart:20-49` (`initialize`), `SensorCore.kt:156-165` (replay do último evento no `onListen`)
**Descrição:** `initialize()` assina o stream **antes** de aguardar `restoreSession()`. O Android reemite o último evento assim que o sink conecta (ex.: `readingAvailable` de um serviço que continuou rodando). Se esse evento chegar durante o `await`, o código em seguida o sobrescreve: com sessão restaurada, `emit(status: disconnected)` (linha 32) apaga o estado conectado real; sem sessão, `emit(SensorUiState.initial)` (linha 39) zera tudo. Em seguida `startMonitoring()` vê `disconnected` e dispara um scan redundante sobre uma conexão viva.
**Impacto:** dependência de ordem de eventos na inicialização — UI mostra "desconectado"/scan enquanto o sensor está conectado; pior no cenário-alvo do foreground service (app reaberto com BLE ativo).
**Solução proposta:** tornar o estado sintético subordinado ao real:
1. No `SensorCubit`, flag `_receivedPlatformEvent` setada pelo listener. Após o `await repository.restoreSession()`: se a flag está setada, **não emitir nada** (o replay do `SensorCore` já é o estado verdadeiro; apenas mesclar `session` restaurada se o evento não trouxe uma) e **não chamar `startMonitoring()`** se o status corrente já é ativo (o guard existente em `startMonitoring` cobre isso, desde que o estado real não tenha sido sobrescrito antes).
2. Alternativa mais robusta ao timing: expor `getCurrentState` no MethodChannel (o `SensorCore.lastEvent` já existe) e fazer `initialize()` buscar sessão + último evento numa única chamada síncrona **antes** de assinar o stream — elimina a janela em vez de tratá-la.
3. Teste de unidade do cubit com stream fake que emite `readingAvailable` durante o `restoreSession` pendente, garantindo que o estado final é `readingAvailable` e que nenhum scan redundante foi disparado.

### 🟠 P24 — "Dias restantes" do sensor sempre reseta (createdAt fabricado no restore)
**Local:** `lib/features/sensor/domain/models.dart:48-53` (`createdAt = DateTime.now()` como default), `sensor_platform.dart:35-39` (`toSession()` não passa createdAt), `monitoring_home_page.dart:526-527` (`14 - daysUsed`)
**Descrição:** o Android não envia a data de ativação do sensor; o Dart preenche `createdAt` com `DateTime.now()` a cada restore. O card do monitor calcula "Xd restantes" a partir disso.
**Impacto:** a vida útil exibida do dispositivo médico está sempre errada — todo restart do app volta para "14d restantes" (e o valor 14 é hardcoded, incorreto para o SmartGuide de 15 dias).
**Solução proposta:**
1. **Persistir a ativação no Android:** coluna `activated_at_ms` no `sensor_session` (migração v3 aditiva), gravada uma única vez no `registerSensor`/`registerNfcSensor` (para Libre, preferir o tempo de início que o nativo conhece — o warmup NFC implica ativação recente; para Sibionics, o momento do registro é aproximação aceitável, o sensor é ativado no corpo junto).
2. **Transportar no contrato:** incluir `activatedAtMs` no map de sessão do channel (`toPlatformMap` + evento) e no `SensorSessionSnapshot`/`SensorSession` Dart — `createdAt` deixa de ter default `DateTime.now()` (torná-lo obrigatório ou nullable explícito; default silencioso é o que causou o bug).
3. **Duração por marca:** `int get lifetimeDays` no enum `SensorBrand` (sibionics 14, accuchek 15, libre2 14); `_SensorStrip` calcula `lifetimeDays - daysUsed` e mostra estado "expirado" quando ≤ 0 em vez de clamp para 0 sem explicação.

### 🟠 P25 — Registro NFC do Libre 2 mexe em estado main-thread a partir da thread NFC
**Local:** `SensorCore.kt:59-64` (`onSensorRegistered = { platform.registerNfcSensor(...) }`), `MainActivity.kt:127-131` (callback reader-mode roda na thread NFC), `SensorPlatformImpl.kt:132-144` (`registerNfcSensor` muta `activeBleManager`, chama `stopScan()`/`disconnect()` e grava sessão)
**Descrição:** todo o fluxo NFC roda na thread do reader mode (por design, transceive é bloqueante), mas `registerNfcSensor` mexe em estado que o resto do sistema confina à main thread: `activeBleManager` (e os métodos `stopScan/disconnect` do `BrandBleManager`, cujo contrato é main-thread-only — `BrandBleManager.kt:104-110`) e `SensorSessionManager` (`currentSession` var sem sincronização + SQLite).
**Impacto:** race real — em debug o `assertMainThread()` pode derrubar o app durante o scan NFC com BLE ativo; em release, estado inconsistente do manager/sessão.
**Solução proposta:**
1. No `SensorCore`, embrulhar o callback: `onSensorRegistered = { serial -> mainHandler.post { platform.registerNfcSensor(serial) } }` — o I/O NFC bloqueante continua na thread do reader (correto), só a mutação de estado salta para a main. O `dispatchEvent` já é seguro (campo `@Volatile` + `CopyOnWriteArraySet` + entrega via `deliverEventToSink` que posta na main).
2. Defesa em profundidade: `assertMainThread()` (o mesmo helper do `BrandBleManager`) na entrada de `registerNfcSensor`, `startMonitoring`, `stopMonitoring` e dos mutadores do `SensorSessionManager` — transforma qualquer regressão futura de threading em crash de debug imediato em vez de corrupção silenciosa.
3. Auditar os demais pontos de entrada fora da main: hoje só o NFC; o executor do P32, quando existir, precisa respeitar a mesma regra (postar mutações de manager/sessão na main ou serializar tudo no executor único).

### 🟠 P26 — `_handleSensorState` assíncrono sem serialização de eventos
**Local:** `patient_cubit.dart:33-38` (`listen(_handleSensorState)` + chamada manual com o estado atual), `118-226`
**Descrição:** o handler é `async` (aguarda `repository.load()` no fim do mock e `saveReadings/saveAlerts` no fim do fluxo normal), mas o `listen` não serializa: eventos em rajada (history sync, reconexão) processam concorrentemente. `previousStatus` é lido do estado no início de cada invocação — duas invocações intercaladas podem ver o mesmo `previousStatus`, duplicar alertas de reconexão ou persistir uma lista mais antiga por cima da mais nova. Além disso `initialize` chama `_handleSensorState(sensorCubit.state)` logo após assinar, podendo processar o mesmo estado duas vezes.
**Impacto:** estados inconsistentes intermitentes e persistência fora de ordem sob rajadas de eventos — exatamente o cenário do history sync.
**Solução proposta:** serializar o processamento com o mesmo padrão de fila encadeada já usado no `PatientSyncService`:
```dart
Future<void> _queue = Future.value();
void _enqueue(SensorUiState s) {
  _queue = _queue.then((_) => _handleSensorState(s));
}
// initialize():
_sensorSubscription = sensorCubit.stream.listen(_enqueue);
_enqueue(sensorCubit.state);
```
Cada evento só começa quando o anterior terminou (incluindo os awaits de `repository.load()`/`saveReadings`), então `previousStatus` e as listas lidas no início da invocação são sempre o resultado da invocação anterior — elimina duplicação de alertas de reconexão e persistência fora de ordem. Complementos: (a) o estado inicial entra pela mesma fila (remove o caso "processado duas vezes" por caminhos diferentes); (b) manter os `emit` síncronos no começo do handler para a UI não atrasar atrás de I/O; (c) teste com rajada de 50 `historyReading` + `readingAvailable` verificando lista final e um único `saveReadings`.

### 🟠 P27 — Contratos de sync inconsistentes: replace-all não atômico e "limpar leituras" que ressuscita
**Local:** `backend/services/glucose-service/src/modules/carbs/carbs.repository.ts:58-59`, `alerts/alerts.repository.ts:25-26`, `insulin/insulin.repository.ts:62-63` (deleteMany + createMany **fora de transação**); `readings/readings.repository.ts` (POST é upsert-merge, sem delete); `patient_cubit.dart:106-111` (`clearReadings` salva lista vazia)
**Descrição:** (a) As coleções carb/insulin/alert são substituídas com dois statements não transacionais — falha entre o delete e o create apaga a coleção do paciente no servidor. (b) Readings têm semântica oposta: o POST só faz upsert; o app assume replace-all (`saveReadings(const [])` para limpar), então limpar leituras nunca chega ao servidor e o próximo `refreshFromRemote` **restaura tudo** localmente. O endpoint `DELETE /readings` existe mas o app nunca o chama.
**Impacto:** perda de coleção inteira numa falha no meio do replace; função "limpar leituras" (debug panel) inefetiva e confusa — dados voltam sozinhos.
**Solução proposta:**
1. **Atomicidade:** embrulhar cada replace-all em transação interativa — `prisma.$transaction(async (tx) => { await tx.carbEvent.deleteMany(...); await tx.carbEvent.createMany(...); })` — nos três `*.repository.ts` correspondentes. Mudança de três linhas por repositório; some quando o P2 aposentar o batch.
2. **Semântica de readings:** declarar readings **append-only** no contrato (`docs/architecture/backend.md`): o POST-upsert atual está correto para sync; "limpar" é operação explícita e separada. `PatientCubit.clearReadings` passa a chamar um novo `RemotePatientDataSource.deleteReadings()` (`DELETE /readings`, rota já existente) antes de zerar o local — ou, mais simples, restringir o clear ao modo mock/debug e removê-lo do caminho real (a feature só existe no debug panel).
3. Teste de contrato no backend: replace-all com payload que viola constraint no meio → coleção original intacta.

### 🟡 P28 — Race no mark-synced: edição durante o push perde a flag de pendência
**Local:** `patient_sync_service.dart:90-117` (`_pushPending` → load → POST → `mark*Synced`), `patient_local_datasource.dart:166-190` (`_markSyncedByKey` marca por chave, sem comparar valor)
**Descrição:** o push carrega o snapshot, envia ao backend e marca as linhas como `synced = 1` **por chave**. Se o usuário editar uma entrada (mesma chave `time_ms`, valor novo, `synced = 0`) entre o load e o mark, a linha editada é marcada como sincronizada sem que o valor novo tenha sido enviado.
**Impacto:** edição silenciosamente nunca espelhada no backend (até que outra escrita na mesma coleção reenfileire tudo). O comentário no código afirma a garantia oposta (`patient_local_datasource.dart:164-165`).
**Solução proposta:** versionar as linhas em vez de flag booleana:
1. Trocar `synced INTEGER` por `revision INTEGER NOT NULL DEFAULT 1` + `synced_revision INTEGER NOT NULL DEFAULT 0` (migração aditiva). Todo `save*` incrementa `revision` das linhas alteradas; "pendente" = `revision > synced_revision`.
2. O push captura `(chave, revision)` de cada linha no momento do `load()`; após o POST bem-sucedido, `UPDATE ... SET synced_revision = ? WHERE chave = ? AND revision = ?` — uma edição concorrente já incrementou `revision`, o `WHERE` não casa e a linha permanece pendente. Corrige a race sem locks.
3. Se o P2 (op-log) for implementado, este problema desaparece por construção (a op editada é uma entrada nova na fila) — P28 é a solução tática caso o op-log demore.
4. Corrigir o comentário mentiroso em `patient_local_datasource.dart:164-165` junto com a mudança.

### 🟡 P29 — Fluxo de registro de sensor: spinner sem saída, promessa de conexão automática e erro duplicado
**Local:** `sensor_link_page.dart:114-137` (step 2 = spinner incondicional), `:326-328` (tutorial: "vinculado automaticamente"), `SensorPlatformImpl.kt:79-125` + `android_sensor_repository.dart:44-56` + `sensor_cubit.dart:86-104` (erro chega por exceção **e** por evento)
**Descrição:** (a) Ao tocar "Registrar sensor" a tela vai para o passo 2 e mostra `CircularProgressIndicator` + "Aguardando conexão Bluetooth…" — se o registro falha, o texto de erro aparece em cima, mas o spinner fica para sempre (nenhum caminho volta `_tutorialStep`). (b) O tutorial promete detecção/vinculação automática, mas registrar **não** inicia monitoramento — o usuário cai na visão de sessão ativa e precisa achar o botão "Iniciar monitoramento". (c) O registro com falha lança `PlatformException` (capturada pelo cubit → emite `error`) e o Android também emite o evento `error` pelo EventChannel; o `AndroidSensorRepository` ainda faz `addError` no mesmo stream — três caminhos para o mesmo erro, com risco de UI piscando erro duplicado.
**Impacto:** estado visual inconsistente pós-falha; usuário não sabe que precisa de mais um passo; tratamento de erro redundante e frágil.
**Solução proposta:**
1. **Estado do passo derivado do cubit, não de variável local:** trocar `_tutorialStep` manual por derivação — `session != null` → fluxo ativo; `failure != null` → volta ao passo do formulário com o erro inline; registro em voo (novo flag `isRegistering` no `SensorUiState`, setado/limpo por `registerSensor`) → spinner. Um `BlocListener` que faz `setState(() => _tutorialStep = 1)` quando `failure` muda é o band-aid mínimo.
2. **Conexão automática:** `SensorCubit.registerSensor`, em caso de sucesso, chama `startMonitoring()` na sequência — passa a cumprir o que o tutorial promete ("detectado e vinculado automaticamente") e remove o passo manual escondido. O botão "Iniciar monitoramento" permanece para retomadas.
3. **Canal único de erro para operações request/response:** o resultado de `registerSensor` viaja **só** pelo MethodChannel (`PlatformException` → catch do cubit). No Android, `registerSensor` deixa de chamar `emitError` (o evento de erro fica para falhas assíncronas de conexão, onde EventChannel é o canal certo); no Dart, `AndroidSensorRepository` deixa de fazer `addError` + `rethrow` para métodos request/response — só `rethrow`.

### 🟡 P30 — Atalho de pareamento do monitor ignora a marca do sensor
**Local:** `monitoring_home_page.dart:178-188` (ícone Bluetooth → `SensorLinkPage()` com brand default Sibionics)
**✅ Resolvido (2026-08-20).** O ícone Bluetooth da home passou a abrir `SensorChoicePage` (`monitoring_home_page.dart:160-166`) em vez de `SensorLinkPage()` fixo — usuário de qualquer marca escolhe primeiro. A extração do helper `openSensorFlow` sugerida abaixo não foi feita (fix pontual, sem tocar `SensorChoicePage`/Configurações/Perfil, que já resolvem a marca corretamente cada um por conta própria); fica como melhoria futura se a duplicação incomodar. Regressão coberta por `monitoring_home_page_test.dart` ("P30: pairing icon opens brand selection, not a fixed brand flow").

**Histórico — Descrição:** o único atalho de pareamento da home abre sempre o fluxo Sibionics (copy, GS1, stepper). Usuário de Libre 2 (que precisa da página NFC) ou Accu-Chek recebe instruções erradas; a `SensorChoicePage` só é alcançável por Configurações/Perfil (e hoje crasha — P17).
**Solução proposta:** roteamento por estado da sessão no `onPressed` do ícone: sem sessão → `SensorChoicePage` (escolher marca); com sessão → página da marca ativa via `switch (sensorState.brand)` — `libre2` → `LibreNFCPage`, demais → `SensorLinkPage(brand: sensorState.brand)`. Extrair esse switch para um helper único (`openSensorFlow(context, state)`) e usá-lo também na `SensorChoicePage` e em Configurações/Perfil, para o mapeamento marca→página existir num lugar só. Depende do P17 para as rotas serem escopadas.

### 🟡 P31 — AuthCubit sinaliza erro com estado transiente duplo
**Local:** `auth_cubit.dart:53-54, 59-60, 63-64, 95-96, 101-102, 105-106`
**Descrição:** falha de login/registro emite `AuthStatus.failure` e imediatamente `AuthStatus.unauthenticated` no mesmo turno. O erro só é visível para quem usa `BlocConsumer.listener` (a `LoginPage` usa); qualquer consumidor baseado em `builder`/`buildWhen` nunca vê o estado de falha, e o `AuthGate` rebuilda duas vezes.
**Impacto:** padrão frágil e dependente de timing para comunicar erro; fácil de quebrar ao adicionar telas.
**Solução proposta:** remover o status transiente: falha de login/registro emite **um** estado — `AuthState(status: unauthenticated, error: AuthError.x)` — e cada ação nova (`login`, `register`, `checkAuthStatus`) limpa `error` ao emitir `loading` (o código já faz `error: null` nesse ponto). O enum `AuthStatus.failure` some. Consumo: `LoginPage` mostra o snackbar no `listenWhen: (p, n) => p.error != n.error && n.error != null` (ou renderiza o erro inline no builder — mais robusto que snackbar); `AuthGate` só distingue `authenticated`/`unauthenticated`/`loading` e rebuilda uma vez por falha em vez de duas.

### 🟡 P32 — Trabalho pesado (JNI + SQLite + BLE) na main thread via MethodChannel
**Local:** `MainActivity.kt:36-89` (todos os handlers síncronos, exceto `installAbbottLibrary`), `SensorPlatformImpl.kt:48-70, 152-204`, `CgmForegroundService.kt:64-85` (restart faz `restoreSession` + `startMonitoring` no main)
**Descrição:** `restoreSession`/`registerSensor`/`startMonitoring` executam chamadas JNI ao vendor blob, I/O SQLite e setup de scan BLE na UI thread do Android.
**Impacto:** jank/ANR em devices lentos ou quando o nativo demora (registro faz criptografia/parse no `libg.so`).
**Solução proposta:** executor único de sensor no `SensorCore`:
1. `private val sensorExecutor = Executors.newSingleThreadExecutor()` — thread única preserva a ordem das operações (mesma garantia da main hoje) e vira o "dono" das chamadas JNI/SQLite.
2. Handlers do MethodChannel viram submit + resposta assíncrona: `sensorExecutor.execute { val r = core.restoreSession(); mainHandler.post { result.success(r) } }` (com try/catch → `result.error`). O contrato Dart já é `Future`, nada muda no Flutter.
3. As chamadas que tocam estado do `BrandBleManager` (main-thread-only) continuam sendo postadas à main pelo próprio fluxo (`startSensorScan` é invocado via `bleManagerProvider` — envolver em `mainHandler.post` com `CountDownLatch`/callback, ou mover a fronteira: executor faz JNI/SQLite e posta só o `startSensorScan` final).
4. Mesmo tratamento no caminho de restart do `CgmForegroundService.onStartCommand` (`restoreSession`/`startMonitoring` → executor).
5. `StrictMode.enableDefaults()` em builds debug para pegar regressões de I/O na main.

### 🟡 P33 — Semântica de status de sessão enganosa no Android
**Local:** `SensorSessionManager.kt:52-58` (`startMonitoring` grava `CONNECTED` antes de qualquer conexão), `SensorCore.kt:145-147` (`hasConnectedSession` usa esse status para retomar após process kill), `SensorPlatformImpl.kt:206-211` (`stopMonitoring` emite `disconnected` mesmo sem nada conectado)
**Descrição:** o status persistido `CONNECTED` significa na prática "monitoramento solicitado". Um scan que nunca encontrou o sensor deixa o registro como CONNECTED; o restart do serviço "retoma" um monitoramento que nunca existiu. `stopMonitoring` sempre emite `disconnected`, mesmo chamado em idle — o Flutter troca `idle` por `disconnected` sem nenhuma transição real.
**Impacto:** decisões de lifecycle e UI baseadas num status que não reflete a realidade; dificulta debugging de reconexão.
**Solução proposta:**
1. `SessionStatus` ganha semântica real: `startMonitoring()` persiste `MONITORING` ("solicitado"); `CONNECTED` só é gravado quando a conexão de fato acontece — o `SensorCore` já observa todos os eventos no `dispatchEvent`, basta um listener interno que, ao ver `status == "connected"`, chama `sessionManager.markConnected()` (e `disconnected`/`error` → `DISCONNECTED`, preservando `MONITORING` como intenção).
2. Decisão de resume pós-kill: `hasConnectedSession()` renomeia para `shouldResumeMonitoring()` e checa `status == MONITORING || CONNECTED` — a intenção do usuário ("monitorando") é o critério correto para retomar, e o nome para de mentir.
3. `SensorPlatformImpl.stopMonitoring`: emitir `disconnected` apenas se havia manager ativo (`activeBleManager != null`) ou status ativo; caso contrário emitir `idle` — o Flutter para de ver transições fantasma.

### 🟡 P34 — Backlog antigo sem leitura recente deixa a UI presa em "Sincronizando histórico"
**Local:** `BrandBleManager.kt:679-694` (`scheduleCurrentPromotionIfRecent` só agenda promoção se a leitura tem <20 min), `sensor_link_page.dart:265-271` / `monitoring_home_page.dart:357-362`
**Descrição:** se o sensor entrega apenas backlog antigo (>20 min — ex.: sensor fora do corpo, fim de vida, ou reconexão após longa ausência sem leitura nova), nenhuma promoção a "current" é agendada e nenhum evento terminal é emitido; o status fica `syncingHistory` indefinidamente.
**Impacto:** UI presa em "Sincronizando histórico…" sem erro nem timeout.
**Solução proposta:**
1. Agendar o settle timer **sempre** (remover o early-return de `scheduleCurrentPromotionIfRecent` quando a leitura é antiga). No disparo: candidato recente → promove como hoje; candidato só antigo → emitir evento terminal `connected` (sem `reading`, `sync: null`), sinalizando "histórico concluído, aguardando leitura ao vivo". Opcional: incluir a última leitura antiga com flag `stale: true` para a UI mostrar "última leitura há Xh".
2. Watchdog do sync como rede de segurança: timer de inatividade (ex.: 60 s sem novo `historyReading`/`notifyHistoryStored`, rearmado a cada chegada) com a mesma emissão terminal — cobre também o caso de backlog interrompido no meio.
3. Flutter: `_NoSensorCard`/`_stateCard` tratam `connected` sem leitura como "Conectado — aguardando leitura" (copy própria), distinto de `syncingHistory`.

### ⚪ P35 — Métricas clínicas calculadas sobre janela errada
**Local:** `monitoring_home_page.dart:489` (GMI com `readings.length >= 14` — 14 *leituras* ≈ 70 min, não 14 dias), `history_page.dart:39` (`days.take(7)`) vs `patient_repository.dart:24` (`maxReadings = 288` ≈ 24 h — nunca haverá 7 dias), `_StatsRow` "Tempo no alvo" sem janela declarada
**Descrição:** o GMI (estimativa de HbA1c) é exibido com pouquíssimos dados; a tela de histórico promete até 7 dias mas o cap de 288 leituras limita a ~1 dia; o TIR mistura tudo que está em memória.
**Impacto:** números clínicos plausíveis porém enganosos para o paciente.
**Solução proposta:**
1. **GMI:** exibir somente quando o *span temporal* dos dados for suficiente — `readings.last.timestamp` a `readings.first.timestamp` ≥ 14 dias (padrão clínico), não contagem de leituras; abaixo disso, chip "GMI: dados insuficientes".
2. **Capacidade local:** subir `PatientRepository.maxReadings` para cobrir a retenção desejada (ex.: 4 032 = 14 dias × 288/dia — trivial para SQLite) e manter o teto de 288 apenas no espelhamento remoto se o backend precisar; alternativa: `HistoryPage` consulta o `LocalPatientDataSource` com query por faixa de datas em vez de depender da lista em memória do estado.
3. **Janelas explícitas:** todo agregado ganha rótulo de janela — TIR/média do `_StatsRow` calculados sobre as últimas 24 h (filtro por timestamp, não "tudo em memória") com label "últimas 24 h"; a `HistoryPage` mostra os dias que realmente existem ("últimos N dias com dados").

**Observações menores (sem número), com solução:**
- `_NoSensorCard` não mostra `failure.message` no erro (`monitoring_home_page.dart:369-374`) → passar `state.sensorState.failure?.message` como subtitle do caso `error` (fallback no texto genérico).
- Notificação real de "sensor desconectado" dispara em sessão mock (`patient_cubit.dart:208-216`) → guardar com `if (!isMock)` como já é feito para persistência.
- `LibreNFCPage.dispose` usa `context.read` (`libre_nfc_page.dart:32-37`) → capturar o `SensorCubit` em `initState` (campo `late final _cubit`) e usar no dispose.
- `CgmForegroundService.onSensorEvent` roda na thread do emissor (`SensorCore.dispatchEvent` pode ser a thread NFC) → `SensorCore.dispatchEvent` posta a notificação dos listeners na main (`mainHandler.post { listeners.forEach ... }`), unificando com a entrega ao sink; resolve junto com P25.
- Resultado de `startMonitoring` não chega ao Flutter (`MainActivity.kt:49-52`) → `result.success(core.startMonitoring())` retornando o booleano; o cubit só emite `scanning` otimista se `true` (senão aguarda o evento de erro).

---

## Seção A — Revisão da conexão com sensores (tarefa item 5)

Fluxo completo documentado em [architecture/sensor-pipeline.md](architecture/sensor-pipeline.md). Avaliação:

**O que está bem feito:**
- Sequência EU protocol correta e fiel ao caminho Juggluco (auth → time-sync → activation → ask-data → glucose), com dispatch por código de `SIprocessData`.
- Estratégia de conexão robusta: endereço salvo primeiro, scan filtrado por serviço, retry GATT 133 (3× + rescan), timeouts de scan (30 s) e conexão (20 s), `requestConnectionPriority(HIGH)`, reconexão automática com backoff.
- Guarda anti-SIGSEGV no restore (cache local antes do nativo).
- History sync bem separado da leitura atual (promoção com settle de 2 s + idade máxima de 20 min + descarte de out-of-order).
- **2026-07-07:** a extração do `BrandBleManager` (base brand-agnóstica com fila de escrita, confinamento de thread e fluxo compartilhado de history sync) é uma melhoria estrutural significativa; os managers Libre 2 e Accu-Chek seguem fielmente os fluxos do Juggluco (challenge/response gen2, bonding SIG CGM).

**Defeitos encontrados:** ~~P7 (lifecycle), P8 (fila de escrita), P9 (threading)~~ resolvidos; P16 residual (validação). Novos: P21 (permissões), P23 (race de inicialização/replay), P25 (thread NFC), P33 (semântica de status), P34 (sync preso).

**Legado/inutilizado no caminho do sensor:** fluxo transmitter e `WarmupPayload` BLE (P12). O `EverSenseClear` no connect é herança Juggluco necessária — manter.

---

## Seção B — Proposta de reorganização: HAL Android/iOS + app Flutter (tarefa item 4.2)

### Diagnóstico
Hoje a fronteira Flutter↔nativo é um contrato de Maps sem tipo (channels), o Android mistura papéis (Activity = dono do ciclo de vida do sensor) e não existe caminho para iOS. A dependência dura é `libg.so` (arm64 **Android-only**) — qualquer plano iOS precisa tratar isso como restrição de primeira classe.

> **Nota 2026-07-07:** os passos 2–4 abaixo foram essencialmente executados (SensorCore application-scoped + `BrandBleManager` como interface de marca + `CgmForegroundService` + offline-first). O passo 1 (Pigeon) segue pendente — o contrato de Maps sem tipo continua sendo a fronteira, e os novos bugs P23/P29 são da classe que ele eliminaria em parte.

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
1. **Pigeon** substitui os channels manuais — mata a classe de bugs "chave faltando no Map" e o parser permissivo (`platform-channels.md` vira código gerado). Baixo risco, alto ganho. **Pendente.**
2. **Extrair `:sensor-hal`** (módulo Gradle) com a interface acima. ✅ Feito na prática via `BrandBleManager`/`SensorCore` (ainda no módulo app, não em módulo Gradle separado).
3. **`CgmForegroundService`** dono do processo. ✅ Feito (resolve P7).
4. **Persistência offline-first.** ✅ Feito no lado Flutter (resolve P1/P3); a variante "o próprio serviço grava no DB local" não foi adotada — leituras em background ainda dependem do Flutter estar vivo para persistir.
5. **iOS**: começar por `LibreNfcHal` (CoreNFC — sem dependência vendor). Sibionics em iOS **só** com SDK oficial do fabricante ou reimplementação limpa do protocolo BLE; esforço alto, tratar como projeto próprio.

### Organização de pastas alvo (Flutter)
Manter feature-first atual. Ajustes: renomear datasource "Local" mentiroso restante do auth (P5); `features/sensor/data/platform/` vira `features/sensor/data/pigeon/` gerado; mock sai de `data/repositories` para `data/hal/mock/`.

---

*Fim do relatório. Correções não aplicadas. Plano de execução detalhado (fases, passos, critérios de aceite): [ARCHITECTURE_FIX_PLAN.md](ARCHITECTURE_FIX_PLAN.md).*
