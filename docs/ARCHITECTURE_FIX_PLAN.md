# Plano de correção arquitetural — Glucore

> **Plano de execução, sem código aplicado.** Companheiro de [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) (problemas P1–P16). Cada fase é entregável isolada, com critério de aceite e verificação. Ordem pensada para: estabilizar antes de rodar em background, ter storage local antes de mudar API, e nunca quebrar o app entre fases.

Data: 2026-07-05 · Branch base sugerida: uma branch por fase a partir de `main`.

> **Rubrica do TCC (2026-08-20):** este plano também fecha os itens opcionais **comprometidos** da rubrica (aba `Rubricas` de `docs/TCC_Acompanhamento_Bernardo_Eduardo.xlsx`, colunas **K**/**L** — commitment "Sim") que caem na mesma área de código já em escopo aqui — cada um entrou como item novo, marcado "Rubrica N", sem alterar os itens já existentes. Ficam **fora deste documento**, por serem trabalho de produto/processo e não correção de arquitetura: negociação de escopo com os professores (crit. 9), formato de documentação de sprint (crit. 10), a feature de 2º perfil de acesso + dashboard do profissional (crit. 14/15, obrigatórios) e a prototipação em Figma com teste de usuário (crit. 24). Esses seguem detalhados em [tcc-rubric-evolution-plan.md](tcc-rubric-evolution-plan.md).

## Visão geral das fases

| Fase | Problemas | Tema | Esforço | Depende de | Rubrica (opcional) |
|---|---|---|---|---|---|
| 0 | P6, P11, P3(quick-fix), P12(parcial), P14 | Higiene rápida + segurança mínima | ~1 dia | — | 23, 26, 27, 42 |
| 1 | P9, P8, P16 | Estabilidade BLE | 1–2 dias | — | — |
| 2 | P7, P10, P15 | Background + fronteira Flutter↔Android | 2–3 dias | Fase 1 | 39 |
| 3 | P1, P3(definitivo), P5 | Offline-first | 3–5 dias | — (melhor após 2) | 35 (parcial), 37 |
| 4 | P4, P2 | Identidade + API por item | 2–3 dias | Fase 3 | 25, 28, 33 |
| 5 | P13, P12(restante) | Mock via DI + poda final | ~½ dia | — | — |

> **Estado em 2026-08-20:** Fases 0, 1 e 2 **concluídas**. Duas exceções, ambas explícitas: o item 2.4 (CI/CD, rubrica 39) foi **cortado do escopo** com motivo técnico registrado na seção 2.4, e as verificações em **device físico** das Fases 1 e 2 seguem pendentes por exigirem hardware arm64 com sensor real. Rastro da entrega: `.specs/features/arch-phases-0-2-gaps/`.
>
> **Atualização 2026-08-24:** o item 2.4 deixou de ser corte total — os estágios analyze/test/lint (que não dependem do `.so` vendor) foram retomados via GitHub Actions; só o artefato de build/deploy segue bloqueado. Ver seção 2.4.

Racional da ordem dos críticos: **P8/P9 antes de P7** — colocar BLE instável num ForegroundService 24/7 só amplia os bugs de fila/threading. **P1 antes de P2/P4** — offline-first muda quem é a fonte de verdade; redesenhar a API antes disso geraria retrabalho.

---

## Fase 0 — Higiene rápida (~1 dia)

### 0.1 · P6 — Atualizar CLAUDE.md — ✅ **Feito (2026-08-20)**
Corrigir as 5 afirmações desatualizadas (persistência, auth, SQLite, decode de glicose, mock) e apontar `docs/` como fonte detalhada.
**Aceite:** nenhuma afirmação do CLAUDE.md contradiz o código; link para `docs/README.md`.

### 0.2 · P11 — Segurança mínima do backend
Security — written plainly:
- `backend/services/glucose-service/src/middleware/auth.ts` e `routes/auth.ts`: remove the `?? 'dev-secret'` fallback; read `JWT_SECRET` once at boot and `process.exit(1)` with a clear message if it is missing. ✅ feito — `lib/env.ts` lança `MissingEnvError` e `index.ts` traduz em exit 1.
- Add `express-rate-limit` on `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` (e.g., 10 req / 15 min per IP).
- `backend/services/glucose-service/src/app.ts`: `cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true })` — permissive in dev, restrictable in prod.
**Aceite:** boot sem `JWT_SECRET` falha; 429 após exceder limite; app continua funcionando em dev.

### 0.3 · P3 quick-fix — Debounce de persistência no history sync
`patient_cubit.dart:121-129`: durante `syncingHistory`, atualizar estado em memória **sem** `saveReadings`; persistir uma única vez quando chegar `readingAvailable` (fim do sync). ~5 linhas.
**Aceite:** reconexão com N leituras de backlog gera 1 POST /readings, não N.
**Nota:** paliativo; a solução definitiva é a Fase 3.

### 0.4 · P12 parcial — Mortos triviais
Deletar: `lib/features/auth/presentation/pages/home_page.dart`; `parseJsonResult` + `sealed class Result` de `GlucoreSibionicsBridge.kt`.
**Aceite:** `flutter analyze` limpo; `grep` sem referências.

### 0.5 · P14 — Deduplicar mapeamento de eventos
`sensor_cubit.dart`: extrair `SensorUiState _mapEventToState(SensorEvent event, {required bool isMock})`; usar nos dois listeners.
**Aceite:** um único ponto de mapeamento; comportamento idêntico (testar mock + real).

### 0.6 · Rubrica 26 — README + doc de rotas do backend — ✅ **Feito (2026-08-20)**
`backend/README.md`: sumário de todos os serviços (`/auth`, `/readings`, `/carbs`, `/insulin`, `/alerts`, `/settings/alerts`) com descrição, exemplo real de payload de request/response, e passo a passo de setup (`npm install`, `npm run migrate:dev`, `npm run dev`).
**Aceite:** todo endpoint documentado com exemplo real; README cobre instalação e env vars. → `backend/README.md`, 24/24 handlers.

### 0.7 · Rubrica 42 — Documentar a arquitetura multissensor já implementada — ✅ **Feito (2026-08-20)**
A stack multi-sensor (Sibionics BLE + Accu-Chek SmartGuide PIN + Libre 2 NFC/Abbott, unificada em `BrandBleManager`) já está implementada e em produção; falta só o registro técnico formal. Aproveitar a atualização do CLAUDE.md (0.1) para produzir um doc curto em `docs/reference/` descrevendo a arquitetura brand-agnostic.
**Aceite:** doc técnico existe, referenciado no CLAUDE.md/`docs/README.md`. → `docs/reference/multi-sensor-architecture.md`.

### 0.8 · Rubrica 23 — Registrar o processo de qualidade já praticado — ✅ **Feito (2026-08-20)**
Doc curto em `docs/` descrevendo o processo de QA em uso (checklist de PR review, critério de aceite por fase já usado neste plano) + registrar no board de sprint pelo menos 1 exemplo real de tarefa reprovada em QA e corrigida.
**Aceite:** doc existe; exemplo real referenciado. → `docs/guides/qa-process.md`, caso da rodada 1 reprovada da feature `checklist-tcc-compliance`.

**Verificação da fase:** `flutter analyze && flutter test`; backend: boot com/sem env, login manual; smoke em device (conectar sensor, ver 1 POST no morgan); README do backend revisado com um endpoint testado manualmente a partir dos exemplos.

---

## Fase 1 — Estabilidade BLE (1–2 dias)

Tudo em `SibionicsBleManager.kt`. Ordem interna obrigatória: P9 → P8 → P16 (confinamento primeiro simplifica a fila; testes por último cobrem o resultado).

### 1.1 · P9 — Confinamento de thread
Todos os overrides GATT despacham imediatamente para `mainHandler`, copiando payload antes do post:
```kotlin
override fun onCharacteristicChanged(gatt: BluetoothGatt, ch: BluetoothGattCharacteristic) {
    val data = ch.value?.copyOf() ?: return   // cópia ANTES do post (payload é reusado pelo stack)
    mainHandler.post { handleNotification(ch.uuid, data) }
}
```
Estado do manager passa a ser tocado só no main looper — sem locks.
**Aceite:** nenhum campo mutável acessado fora do main thread (revisão + `StrictMode`/asserts `Looper.myLooper()==mainLooper` nos handlers em debug).

### 1.2 · P8 — Fila de escrita GATT + APIs modernas
- Fila: `ArrayDeque<ByteArray>` + flag `writeInFlight`; `writeToSensor` vira `enqueueWrite`; `onCharacteristicWrite` (já confinado) despacha o próximo; falha de write → 1 retry → erro/disconnect.
- API 33+: `gatt.writeCharacteristic(char, bytes, WRITE_TYPE_DEFAULT)` e `writeDescriptor(cccd, ENABLE_NOTIFICATION_VALUE)`; fallback via `Build.VERSION.SDK_INT` para o caminho antigo. Callback novo de notificação `onCharacteristicChanged(gatt, ch, value)` (o `value` já chega copiado) mantendo o antigo para < 33.
**Aceite:** sequência código 4→5 (re-auth + time-sync) nunca perde a segunda escrita (log de fila); zero uso de `characteristic.value =` em API ≥ 33.

### 1.3 · P16 — Validação + testes do decode — ✅ **Feito (2026-08-20)**
- Extrair `decodePackedGlucose` para objeto puro testável (ex.: `SibionicsGlucoseDecoder` sem dependência Android).
- Faixa aceita: 400..6000 décimos (40–600 mg/dL); fora disso rejeita e loga. Códigos desconhecidos de `SIprocessData`: logar e **não** decodificar por padrão (decodificação direta só quando `lastSyncedTimestampMs != null`, i.e., sync em andamento).
- Testes JUnit: packing/unpacking (valores limite, rate negativa, alarm), `normalizeTimestampMs` (s vs ms), out-of-order.
**Aceite:** testes passam no `./gradlew test`; leitura implausível não chega ao Flutter.

**Verificação da fase:** ✅ `./gradlew :app:testDebugUnitTest` verde (34 testes em 2026-08-20). ⬜ **pendente de device físico**: sessão real de sensor ≥ 1 h sem queda e reconexão forçada (afastar o telefone) com re-auth completo nos logs.

---

## Fase 2 — Background + fronteira (2–3 dias)

### 2.1 · P7 — ForegroundService dono do sensor
Reorganização de propriedade (extração, não rewrite):
```
GlucoreApp (Application)
  └─ SensorCore (singleton): SensorSessionManager + SibionicsNativeBridgeAdapter
       + SibionicsBleManager + último evento + fluxo de eventos
CgmForegroundService (foregroundServiceType="connectedDevice")
  └─ start/stopMonitoring movem-se para cá; notificação persistente com última glicose
MainActivity
  └─ só channels; delega tudo ao SensorCore; não possui mais nada
```
Passos:
1. Criar `SensorCore` agregando o trio atual; `MainActivity` passa a delegar (comportamento idêntico — commit isolado).
2. Criar `CgmForegroundService`: `startMonitoring` → `startForegroundService`; `stopMonitoring`/`clearSession` → `stopSelf`. Notificação: canal próprio, mostra último valor + status.
3. Manifest: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_CONNECTED_DEVICE`, `POST_NOTIFICATIONS` (runtime, API 33+); service `android:foregroundServiceType="connectedDevice"`.
4. Reconexão fora do app: no `onConnectionStateChange` DISCONNECTED sem `isStopping`, agendar rescan com backoff (30 s → 2 min → 5 min, cap).
**Aceite:** app removido dos recentes → leituras continuam chegando (verificar por notificação atualizando e POSTs no backend); Doze/battery-optimization documentado (pedir isenção é opt-in do usuário).

### 2.2 · P10 — Resposta síncrona + replay de evento
- `registerSensor` no MethodChannel retorna o snapshot (ou lança `PlatformException`) em vez de `null` — a operação nativa já é síncrona. Flutter: `SensorPlatform.registerSensor` passa a retornar `SensorSessionSnapshot`.
- `SensorCore` guarda o último evento; `onListen` do EventChannel reemite-o imediatamente (elimina a janela de eventos perdidos).
**Aceite:** registrar sensor com stream ainda não assinado → UI recebe resultado mesmo assim.

### 2.3 · P15 — Migração aditiva do SQLite de sessão
`SessionDbHelper.onUpgrade`: trocar DROP por `ALTER TABLE` incremental por versão (padrão `when (oldVersion) { ... }`).
**Aceite:** upgrade simulado de DB_VERSION preserva a sessão registrada.

### 2.4 · Rubrica 39 — CI/CD (build + test + deploy) — ⚠️ **Parcial (2026-08-24)**
Retirado do escopo o artefato de build/deploy, por decisão do usuário, com motivo técnico: os `.so` proprietários (`libg.so`, bibliotecas Abbott) são gitignored (`.gitignore:58`) e não estão no repositório, então **nenhum runner limpo consegue produzir um APK funcional** — o job de artefato de build da rubrica não teria como existir de forma honesta, e o `./gradlew` do projeto depende desses binários para o link nativo.
**Já retomado (2026-08-24):** os três estágios que não dependem do `.so` — `flutter analyze && flutter test`, `./gradlew :app:testDebugUnitTest`, `npm run build && npm run test:coverage` — rodam automatizados em `.github/workflows/ci.yml`, disparados em PR e push para `main`/`dev`. Essa é agora a referência de review: um PR só é considerado pronto com o CI verde.
**Condição para retomar o resto (build + deploy):** um caminho autorizado de distribuição dos `.so` para o CI (secret/artifact store privado com licença que permita, ou runner self-hosted com os binários já provisionados).

**Verificação da fase:** ⬜ **pendente de device físico** — teste manual de background (tela desligada 30 min, app swipado), `adb shell dumpsys activity services` mostrando o service, e registro de sensor com app recém-aberto. O código de 2.1–2.3 está entregue e verificado por leitura/teste; o que falta é exclusivamente a regressão em hardware arm64 com sensor real.

---

## Fase 3 — Offline-first (3–5 dias)

### 3.1 · P1 — Storage local como fonte primária
Stack: ~~drift~~ **sqflite** (SQL cru, sem codegen — desvio aprovado: menos uma dependência pesada/build_runner para 5 tabelas simples) + `connectivity_plus`. **✅ Implementado (2026-07-06).**
```
PatientCubit → PatientRepository
                 ├─ LocalPatientDataSource (sqflite)    ← fonte primária (novo)
                 ├─ RemotePatientDataSource (Dio)       ← já existe
                 └─ PatientSyncService                  ← novo: fila de pendências
```
- Tabelas sqflite (`glucore_patient.db`): readings, alerts, carbs, insulin, settings — colunas espelhando `data-models.md` + flag `synced INTEGER` (0 = pendente).
- Escrita: sempre local primeiro (síncrono do ponto de vista da UI); marca pendente; `PatientSyncService` empurra em background (retry exponencial; dispara em reconexão de rede e em app resume).
- Leitura: `load()` devolve local imediatamente; refresh remoto em background reconcilia (server wins para dados que só o server muda; local wins para pendências).
- `initialize` do PatientCubit deixa de depender de rede.

### 3.2 · P3 definitivo — **✅ Implementado (2026-07-06)**
Com 3.1, cada leitura BLE grava local (barato, sem rede no caminho); o sync job empurra as coleções pendentes (`synced = 0`) com debounce — o quick-fix 0.3 (batch único no `readingAvailable`) foi mantido, agora persistindo no sqflite. Push ainda usa o replace-all do backend; envio unitário/delta chega com a Fase 4.

### 3.3 · P5 — Renames verdadeiros — **✅ Parcial (2026-07-06)**
Junto com a introdução do datasource local real (evita churn duplo):
- ✅ `PatientLocalDataSource` (interface) → `PatientDataSource` (+ `PatientLocalSnapshot` → `PatientSnapshot`), em `patient_datasource.dart`; arquivo `patient_local_datasource.dart` → `patient_remote_datasource.dart` (classe remota) + `patient_local_datasource.dart` (sqflite, agora com nome honesto).
- ✅ `PatientLocalRepository` → `PatientRepository` (`patient_repository.dart`).
- ⬜ `AuthLocalDataSource` → `AuthDataSource` (pendente — fora do escopo do PR da Fase 3).
**Aceite da fase:** modo avião → registrar carbo/insulina, receber leituras mock → tudo visível e persistido; religar rede → backend converge (verificar linhas no Postgres); app reiniciado offline mostra dados.

### 3.4 · Rubrica 37 — Camada `domain/` no feature `patient`
`auth` e `sensor` já têm `domain/`; `patient` não. Aproveitando a reorganização 3.1/3.3 (que já separa `PatientRepository`/`PatientDataSource`), extrair entidades e casos de uso para `lib/features/patient/domain/`, no mesmo padrão dos outros dois features.
**Aceite:** `PatientCubit` passa a depender de casos de uso do `domain/`, não direto do repository.

### 3.5 · Rubrica 35 (parcial) — Dark mode / light mode
Escopo restrito ao item (a) do critério (temas claro/escuro); customização salva por tela e otimização de desktop ficam de reserva. `ThemeMode` + `AppTheme.light()`/`AppTheme.dark()`, toggle nas configurações, preferência persistida (mesmo mecanismo do `onboarding_done`).
**Aceite:** app alterna tema em tempo real; preferência sobrevive a restart.

**Verificação:** testes de unidade do sync service (fila, retry, reconciliação); cenário avião manual; `flutter test`; alternar tema e reabrir o app mantém a escolha.

---

## Fase 4 — Identidade + API por item (2–3 dias)

### 4.1 · P4 — UUID em toda entrada
- `CarbEntry`/`InsulinEntry`/`AppAlertItem` ganham `id String` (uuid v4 gerado no app na criação; pacote `uuid`).
- Drift/JSON/mappers incluem `id`; edit/delete no `PatientCubit` casam por `id` (fim do match por timestamp).
- Entradas legadas: no primeiro load, itens sem `id` recebem um (migração drift).

### 4.2 · P2 — Endpoints por item
Backend (Prisma já tem `id` uuid — aceitar id gerado pelo cliente):
```
POST   /carbs/item        { id, grams, description, timeMs }   → 201
PUT    /carbs/item/:id                                          → 204
DELETE /carbs/item/:id                                          → 204
(idem /insulin/item, /alerts/item)
GET    inalterado (agora inclui id)
```
- `PatientSyncService` (Fase 3) passa a enviar operações unitárias da fila (create/update/delete por id) em vez de coleção.
- POST batch antigo: manter 1 release marcado deprecated (rollback path), depois remover junto do `deleteMany`.
- Limite de 100 itens deixa de truncar dados: GET pagina (`?before=timeMs&limit=100`); histórico completo preservado no banco.
**Aceite:** editar 1 entrada gera 1 PUT; IDs estáveis entre saves (verificar no Postgres); duas entradas no mesmo minuto são editáveis independentemente; dois devices simultâneos não se apagam.

### 4.3 · Rubrica 25, 28, 33 — Qualidade dos novos endpoints
Ao construir os endpoints de 4.2:
- Estruturar em camadas (route → controller → service → repository Prisma) em vez de handlers direto na rota — só nas rotas novas, sem refatorar o resto do backend (rubrica 33).
- Índice Prisma (`@@index`) na coluna usada por `?before=timeMs`, pra paginação não degradar (rubrica 28).
- Cobrir os endpoints novos com testes supertest (create/update/delete/paginação/2-devices), mirando 75%+ de cobertura no backend (rubrica 25).
**Aceite:** rotas novas seguem a estrutura em camadas; migration inclui o índice; `npm test` cobre os cenários acima.

**Verificação:** testes de rota (supertest ou curl scriptado); cenário 2 clientes; migração de dados legados testada com dump real; `npm test` sem falhas.

---

## Fase 5 — Mock via DI + poda final (~½ dia)

### 5.1 · P13 — Mock atrás da abstração
`injection_container.dart`: em debug, registrar `SensorRepository` trocável (`sl.unregister + register` via helper `swapSensorRepository(useMock:)` chamado pelo DebugPanel). `SensorCubit` perde o import de `mock_sensor_repository.dart` e os métodos `activateMock/deactivateMock` viram troca de repositório + re-`initialize`.
**Aceite:** cubit sem referência a implementação concreta; DebugPanel funciona igual.

### 5.2 · P12 restante — Decisões de produto documentadas
| Item | Decisão proposta |
|---|---|
| Fluxo `submitTransmitter` (canal→SQLite, sem UI, sem nativo) | **Remover** da pilha inteira (Sibionics GS1 não usa transmissor separado) |
| Payload `warmup` nunca emitido | Remover do contrato Kotlin; manter `warmingUp` no enum Dart (sensor tem warmup real; implementável depois) |
| Stubs C++ `saveMatchedDevice`/`getInitialWrite`/`handleNotification` | Remover (C++ + `external fun` Kotlin) |
| `LibreNFCPage` placeholder | Desabilitar card como o Dexcom ("em breve") até existir CoreNFC/nfc_manager real |
| Tabelas Prisma aspiracionais | **Manter** (custo zero; documentadas em backend.md) |
**Aceite:** `flutter analyze` + build Android limpos; contrato em `platform-channels.md` atualizado.

---

## Regras transversais

1. **Uma fase = uma branch/PR**; `main` sempre sai buildável (`flutter analyze`, `flutter test`, `./gradlew test`, boot do backend).
2. Toda mudança de contrato (channels, API, modelos) atualiza o doc correspondente em `docs/reference/` **no mesmo PR**.
3. Nada de rewrite do caminho vendor/JNI — as fases só movem propriedade e adicionam camadas em volta do trio BLE existente.
4. Fases 1–2 exigem device arm64 físico com sensor para verificação final; fases 3–5 verificáveis com mock.
5. Ao concluir cada P, marcar como resolvido no [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) (não apagar — histórico).
6. **Rubrica 27:** toda mudança de schema Prisma (qualquer fase que toque `backend/services/*/prisma/`) inclui a migration versionada no mesmo PR — já é a prática atual, aqui só formalizada.

## Fora do plano (registrado, sem ação)
- HAL multiplataforma completo + Pigeon (Seção B do review): fazer **depois** da Fase 2 — o `SensorCore` da Fase 2 já é o embrião do HAL; Pigeon vira candidato natural quando o contrato estabilizar.
- iOS: bloqueado por `libg.so` (arm64 Android). Primeiro alvo viável: Libre via CoreNFC, projeto separado.

## Reserva de rubrica — só se sobrar tempo (registrado, sem compromisso)
Itens opcionais da rubrica marcados como reserva na aba `Rubricas` (coluna L = "Reserva"). Não fazem parte do escopo comprometido; ficam aqui só para o caso de sobrar tempo depois das fases acima — ver [tcc-rubric-evolution-plan.md](tcc-rubric-evolution-plan.md) para o racional completo.
- **39** (CI/CD) — só o artefato de build/deploy segue reservado/bloqueado: sem os `.so` proprietários no repositório, não há build reproduzível em runner limpo (ver 2.4). Analyze/test/lint já rodam em CI, fora da reserva.
- **22** (BDD/UML/diagramas de requisitos) — documentação extra, sem tocar código.
- **32** (cloud services), **40** (IaC) — fora do escopo deste plano (não há infra cloud hoje).
- **34** (cobertura de testes frontend 75%+) — se entrar, encaixa como extensão da Fase 3 (`flutter test` já roda ali).
- **41** (monitoramento/observabilidade) — se entrar, encaixa na Fase 2 (logging estruturado do backoff de reconexão do `CgmForegroundService`).
- **38** (acessibilidade) — reaproveitaria a sessão de teste de usuário da prototipação (fora deste documento, ver `tcc-rubric-evolution-plan.md`).
