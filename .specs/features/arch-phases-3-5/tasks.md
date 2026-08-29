# Fases 3–5 do plano arquitetural — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/arch-phases-3-5/design.md`
**Status**: Draft
**Branch**: `feat/arch-phases-3-5`, criada do HEAD atual de `feat/arch-phases-0-2-gaps`

---

## Test Coverage Matrix

> Gerada a partir do código, das diretrizes do projeto e da spec. Diretrizes encontradas: `docs/guides/qa-process.md` (tabela de gates por camada, regra "teste não se enfraquece"), `CLAUDE.md` (comandos), `backend/package.json` (runner `node:test`), `pubspec.yaml` (`sqflite_common_ffi` para sqflite em memória). Não há limiar de cobertura configurado em ferramenta; o alvo de 75% vem da spec (QUAL-03) e vale para os módulos novos do backend.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Entidades e mappers Dart (`lib/features/patient/domain`, modelos) | unit | Todos os ramos; 1:1 com as ACs de IDENT; casos-limite listados na spec | `test/features/patient/*_test.dart` | `flutter test --no-pub` |
| Dados Dart (datasource local, remoto, sync, repository) | unit | Todos os ramos; 1:1 com ACs de IDENT/SYNC; toda edge case listada (migração, 404, 401, payload ilegível, ordem) | `test/features/patient/*_test.dart` | `flutter test --no-pub` |
| Cubit / casos de uso Dart | unit | Todos os ramos das operações tocadas; 1:1 com ACs de IDENT/SYNC/DOMAIN | `test/features/patient/*_test.dart` | `flutter test --no-pub` |
| UI Flutter (páginas, tema, widgets) | widget | Caminho feliz de cada tela tocada + o estado de tema escuro | `test/features/**/*_test.dart` | `flutter test --no-pub` |
| Backend repository | unit | Caminhos de consulta principais (paginação, escopo por paciente) + erro | `backend/tests/repositories/*.test.ts` | `cd backend && npm test` |
| Backend service | unit | Todos os ramos; 1:1 com ACs de API/QUAL; validação e 404 lógico | `backend/tests/services/*.test.ts` | `cd backend && npm test` |
| Backend controller/rota | integration (supertest) | Toda rota tocada: feliz + edge + erro (400/404) + dois aparelhos | `backend/tests/routes/*.test.ts` | `cd backend && npm test` |
| Schema Prisma, config, anotações | none | — (gate de build) | — | gate de build |
| Kotlin / C++ (remoções da poda) | none | — (gate de build; a suíte JVM existente não pode regredir) | `android/app/src/test/**` | `cd android && ./gradlew :app:testDebugUnitTest` |

## Gate Check Commands

> Extraídos de `docs/guides/qa-process.md` e do `CLAUDE.md`.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (Dart) | Tarefas com testes unitários/widget em `lib/` | `flutter test --no-pub` |
| Quick (backend) | Tarefas com testes unitários em `backend/src` | `cd backend && npm test` |
| Full (Dart) | Fim de tarefa que muda contrato ou várias camadas Dart | `flutter analyze && flutter test --no-pub` |
| Full (backend) | Tarefas com supertest / mudança de rota | `cd backend && npx tsc --noEmit && npm test` |
| Build | Fim de fase, tarefas de schema/config e a poda nativa | `flutter analyze && flutter test --no-pub` + `cd backend && npx tsc --noEmit && npm test` + `cd android && ./gradlew :app:testDebugUnitTest` |

---

## Execution Plan

Fases rodam em sequência; dentro da fase, as tarefas rodam em ordem.

### Phase 1: Identidade no app (IDENT)

```
T1 → T2 → T3 → T4 → T5
```

### Phase 2: Backend em camadas — carbs e insulin (API, QUAL)

```
T6 → T7 → T8 → T9
```

### Phase 3: Backend — alerts unitários, índice e cobertura (API, QUAL)

```
T10 → T11 → T12 → T13
```

### Phase 4: Op-log e sincronização por item (SYNC)

```
T14 → T15 → T16 → T17 → T18 → T19
```

### Phase 5: Camada domain/ no patient (DOMAIN)

```
T20 → T21 → T22 → T23
```

### Phase 6: Tema claro e escuro (THEME)

```
T24 → T25 → T26 → T27 → T28
```

### Phase 7: Poda, renames e documentação (DEAD, PLAN)

```
T29 → T30 → T31 → T32 → T33 → T34
```

---

## Task Breakdown

### T1: `id` UUID nas entradas de diário

**What**: adicionar `uuid` ao `pubspec.yaml` e o campo `id` (com factory de criação, `copyWith` e serialização) a `CarbEntry`, `InsulinEntry` e `AppAlertItem`.
**Where**: `lib/features/patient/presentation/models/patient_models.dart`
**Depends on**: None
**Reuses**: `toJson`/`fromJson` já existentes nas três classes
**Requirement**: IDENT-01, IDENT-02, IDENT-06

**Tools**:

- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:

- [x] As três classes têm `final String id`, factory de criação que gera UUID v4 e `copyWith` que preserva o `id`
- [x] `fromJson` usa o `id` do servidor quando ele é UUID válido e gera um local quando ausente ou malformado
- [x] `toJson` inclui `id`
- [x] Teste novo cobre: geração v4, `copyWith` preservando id ao mudar horário, `fromJson` sem id e com id inválido
- [x] Gate: `flutter test --no-pub` verde (194 testes, 13 novos)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(patient): give diary entries a stable uuid`
**Status**: ✅ Complete

---

### T2: SQLite local versão 3 — coluna `id`, troca de PK e migração

**What**: subir `_dbVersion` para 3, criar as três tabelas do diário com `id TEXT PRIMARY KEY` + índice de horário, e escrever a migração v2 → v3 que preserva as linhas existentes com backfill de UUID.
**Where**: `lib/features/patient/data/datasources/patient_local_datasource.dart`
**Depends on**: T1
**Reuses**: padrão aditivo do `onUpgrade` atual (`patient_local_datasource.dart:85`)
**Requirement**: IDENT-04, IDENT-05

**Tools**:

- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:

- [x] `onCreate` cria `carbs`, `insulin` e `alerts` com `id TEXT PRIMARY KEY` e índice sobre a coluna de horário
- [x] `onUpgrade` migra v2 → v3 dentro de uma transação, gerando UUID por linha, sem perder nenhuma
- [x] Teste abre um banco v2 semeado, migra e confere contagem de linhas preservada e ids válidos
- [x] Teste cobre falha no meio da migração deixando o banco utilizável na v2
- [x] Gate: `flutter test --no-pub` verde (197 testes, 3 novos)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(patient): migrate the local diary tables to uuid keys`
**Status**: ✅ Complete

---

### T3: Leitura, escrita e marcação de sincronizado por `id`

**What**: atualizar mappers linha↔modelo para carregar `id` e trocar `markCarbsSynced`/`markInsulinSynced`/`markAlertsSynced` para casar por `id`.
**Where**: `lib/features/patient/data/datasources/patient_local_datasource.dart`
**Depends on**: T2
**Reuses**: `_markSyncedByKey` (generalizado para chave textual)
**Requirement**: IDENT-04, IDENT-07

**Tools**:

- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:

- [x] `_rowToCarb`/`_carbToRow` e equivalentes de insulin e alerts levam `id`
- [x] `mark*Synced` casam por `id`
- [x] Teste grava duas entradas com o mesmo `time_ms` e confere que as duas persistem e são atualizáveis de forma independente
- [x] Gate: `flutter test --no-pub` verde (204 testes, 7 novos)

**Tests**: unit
**Gate**: quick
**Commit**: `fix(patient): key local diary rows by id instead of timestamp`
**Status**: ✅ Complete

---

### T4: `id` no datasource remoto

**What**: incluir `id` nos payloads enviados e lidos de carbs, insulin e alerts.
**Where**: `lib/features/patient/data/datasources/patient_remote_datasource.dart`
**Depends on**: T3
**Reuses**: mappers `_carbToRow`, `_insulinToRow`, `_alertToRow` do próprio arquivo
**Requirement**: IDENT-06

**Tools**:

- MCP: NONE
- Skill: `glucore-backend`

**Done when**:

- [x] Envio e leitura das três coleções carregam `id`
- [x] Entrada remota sem `id` válido recebe um id local ao ser materializada
- [x] Teste cobre round-trip com id e resposta sem id
- [x] Gate: `flutter test --no-pub` verde (211 testes, 7 novos)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(patient): carry entry ids over the remote datasource`
**Status**: ✅ Complete

---

### T5: Edição e remoção casando por `id`

**What**: trocar o casamento por timestamp em `editCarbEntry`, `deleteCarbEntry`, `editInsulinEntry` e `deleteInsulinEntry` por casamento por `id`, ajustando as telas de edição para preservar o id.
**Where**: `lib/features/patient/presentation/cubit/patient_cubit.dart`
**Depends on**: T4
**Reuses**: `copyWith` criado em T1
**Requirement**: IDENT-02, IDENT-03

**Tools**:

- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:

- [x] As quatro operações casam por `id`
- [x] `carb_edit_page.dart` e `insulin_edit_page.dart` devolvem a entrada editada com o id original (as duas telas passaram a usar `copyWith` em T1, quando o `id` virou obrigatório; aqui ganharam teste de widget)
- [x] Teste de cubit: duas entradas no mesmo milissegundo, editar a primeira mudando o horário e apagar a segunda deixa exatamente a esperada
- [x] Gate: `flutter analyze && flutter test --no-pub` verde (219 testes, 8 novos)

**Tests**: unit
**Gate**: full
**Commit**: `fix(patient): match diary edits and deletes by entry id`
**Status**: ✅ Complete

---

### T6: Repository de carbs com Prisma injetado

**What**: extrair o acesso a dados de carbs para um repository que recebe o client Prisma por parâmetro, com `findPage`, `create`, `update` e `remove`.
**Where**: `backend/src/repositories/carbRepository.ts`
**Depends on**: None
**Reuses**: consultas já escritas em `backend/src/routes/carbs.ts`
**Requirement**: QUAL-01, API-03

**Tools**:

- MCP: NONE
- Skill: `glucore-backend`

**Done when**:

- [x] `findPage({ patientId, before, limit })` devolve em ordem decrescente, respeitando `before` e `limit`
- [x] `update` e `remove` são escopados por `patientId` e devolvem booleano
- [x] Teste unitário com client Prisma falso cobre paginação, escopo por paciente e caminho de erro
- [x] Gate: `cd backend && npm test` verde (56 testes, 13 novos)

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(backend): extract the carb repository from the route`
**Status**: ✅ Complete

---

### T7: Service, controller e rota de carbs

**What**: mover validação, auditoria e tradução HTTP de carbs para service + controller, deixando a rota como fiação, e acrescentar os parâmetros de paginação.
**Where**: `backend/src/routes/carbs.ts`
**Depends on**: T6
**Reuses**: `asyncHandler`, `ensurePatient`, `recordAudit`, validadores já escritos na rota
**Requirement**: QUAL-01, API-03, API-04, API-05, API-06

**Tools**:

- MCP: NONE
- Skill: `glucore-backend`

**Done when**:

- [x] `carbService.ts` e `carbController.ts` existem e a rota não toca `prisma` diretamente
- [x] `GET /carbs` aceita `before` e `limit` (1–500), responde 400 com `{ error, code }` fora da faixa e mantém o default de 100 mais recentes sem parâmetros
- [x] Contrato dos endpoints unitários preservado (201 com id, 204, 404)
- [x] Testes supertest cobrem feliz, 400, 404, paginação até o fim e dois aparelhos editando entradas distintas
- [x] Gate: `cd backend && npx tsc --noEmit && npm test` verde (70 testes, 0 falhas)

**Tests**: integration
**Gate**: full
**Commit**: `refactor(backend): layer the carb routes and add pagination`
**Status**: ✅ Complete

---

### T8: Repository de insulin com Prisma injetado

**What**: mesmo recorte de T6 para insulin.
**Where**: `backend/src/repositories/insulinRepository.ts`
**Depends on**: T7
**Reuses**: `carbRepository.ts` como forma
**Requirement**: QUAL-01, API-03

**Tools**:

- MCP: NONE
- Skill: `glucore-backend`

**Done when**:

- [x] `findPage`, `create`, `update` e `remove` implementados e escopados por paciente
- [x] Teste unitário com client falso cobre paginação, escopo e erro
- [x] Gate: `cd backend && npm test` verde (84 testes, 14 novos)

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(backend): extract the insulin repository from the route`
**Status**: ✅ Complete

---

### T9: Service, controller e rota de insulin

**What**: mesmo recorte de T7 para insulin.
**Where**: `backend/src/routes/insulin.ts`
**Depends on**: T8
**Reuses**: `carbService.ts`/`carbController.ts` como forma
**Requirement**: QUAL-01, API-03, API-04, API-05, API-06

**Tools**:

- MCP: NONE
- Skill: `glucore-backend`

**Done when**:

- [x] `insulinService.ts` e `insulinController.ts` existem e a rota não toca `prisma`
- [x] Paginação e validação idênticas às de carbs
- [x] Testes supertest cobrem feliz, 400, 404 e paginação
- [x] Gate: `cd backend && npx tsc --noEmit && npm test` verde (103 testes, 19 novos)

**Tests**: integration
**Gate**: full
**Commit**: `refactor(backend): layer the insulin routes and add pagination`
**Status**: ✅ Complete

---

### T10: Repository de alerts com `id` exposto

**What**: repository de alerts com Prisma injetado, devolvendo `id` junto de tipo e horário.
**Where**: `backend/src/repositories/alertRepository.ts`
**Depends on**: None
**Reuses**: mapeamento `toDbAlertType`/`toAppAlertType` de `backend/src/routes/alerts.ts:14-48`
**Requirement**: QUAL-01, API-01, API-03

**Tools**:

- MCP: NONE
- Skill: `glucore-backend`

**Done when**:

- [x] `findPage`, `create`, `update` e `remove` implementados, escopados por paciente
- [x] Linhas devolvidas incluem `id`
- [x] Teste unitário com client falso cobre paginação, escopo, ida e volta do mapeamento de tipo
- [x] Gate: `cd backend && npm test` verde (123 testes, 20 novos)

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(backend): extract the alert repository from the route`
**Status**: ✅ Complete

---

### T11: Endpoints unitários de alerts

**What**: service, controller e rota de alerts com `POST /alerts/item`, `PUT /alerts/item/:id`, `DELETE /alerts/item/:id`, paginação e `id` no `GET`.
**Where**: `backend/src/routes/alerts.ts`
**Depends on**: T10
**Reuses**: `carbService.ts`/`carbController.ts` como forma; `recordAudit` como nas outras rotas
**Requirement**: API-01, API-02, API-04, API-05, API-06, QUAL-01

**Tools**:

- MCP: NONE
- Skill: `glucore-backend`

**Done when**:

- [x] Os três verbos unitários existem, com 201/204/404 e validação de UUID
- [x] `PUT`/`DELETE` de id de outro paciente respondem 404 sem alterar dado
- [x] `GET /alerts` devolve `id` e aceita `before`/`limit`
- [x] O `POST /alerts` de coleção continua funcionando, marcado deprecated — e passou a preservar o `id` do cliente, que antes era descartado
- [x] Testes supertest cobrem feliz, 400, 404 de outro paciente e paginação
- [x] Gate: `cd backend && npx tsc --noEmit && npm test` verde (143 testes, 20 novos)

**Tests**: integration
**Gate**: full
**Commit**: `feat(backend): add per-item alert endpoints`
**Status**: ✅ Complete

---

### T12: Índices de paginação verificados e tabelas de roadmap anotadas

**What**: conferir que a consulta de paginação das três entidades é coberta por índice, criando migration só se faltar, e anotar como roadmap as tabelas Prisma sem rota.
**Where**: `backend/prisma/schema.prisma`
**Depends on**: T11
**Reuses**: `@@index([patientId, eventAt])` e `@@index([patientId, triggeredAt])` já existentes
**Requirement**: QUAL-04, QUAL-05, DEAD-05

**Tools**:

- MCP: NONE
- Skill: `glucore-backend`

**Done when**:

- [x] Verificação registrada no `backend/README.md` com o nome do índice que atende cada consulta (`CarbEvent_patientId_eventAt_idx`, `InsulinEvent_patientId_eventAt_idx`, `AlertEvent_patientId_triggeredAt_idx`)
- [x] Migration versionada incluída apenas se algum índice faltar — nenhum faltava, os três vêm de `20260517172000_domain_model_alignment`, então nenhuma migration foi criada
- [x] Tabelas sem rota anotadas com `/// roadmap`, sem remoção (10 modelos; diff do schema é 10 inserções, 0 remoções)
- [x] Gate: `cd backend && npx tsc --noEmit && npm test` verde (143 testes, 0 falhas)

**Tests**: none
**Gate**: build
**Commit**: `chore(backend): verify pagination indexes and mark roadmap tables`
**Status**: ✅ Complete

---

### T13: Cobertura dos módulos novos do backend

**What**: adicionar o script de cobertura e fechar 75% de linhas nos controllers, services e repositories novos.
**Where**: `backend/package.json`
**Depends on**: T12
**Reuses**: runner `node:test` já configurado em `backend/package.json`
**Requirement**: QUAL-02, QUAL-03

**Tools**:

- MCP: NONE
- Skill: `glucore-backend`

**Done when**:

- [x] Script `test:coverage` roda `node --test --experimental-test-coverage`
- [x] Relatório mostra ≥ 75% de linhas nos módulos de carbs, insulin e alerts criados nas fases 2 e 3 — os doze (repository, service, controller e rota das três entidades) ficaram em 100,00% de linhas
- [x] Lacunas fechadas com teste de comportamento, nunca afrouxando asserção existente — 3 testes novos (lote inválido de carbs, `type` vazio em alerts, `dayOfWeek` não-string em insulin); nenhum teste alterado ou removido
- [x] Gate: `cd backend && npx tsc --noEmit && npm test` verde (146 testes, 3 novos)

**Tests**: integration
**Gate**: full
**Commit**: `test(backend): cover the new diary modules to the coverage target`
**Status**: ✅ Complete

---

### T14: Tabela `pending_ops` e modelo da operação

**What**: criar a tabela do op-log na versão 3 do banco e o modelo `PendingOp` com enfileirar, listar em ordem e remover.
**Where**: `lib/features/patient/data/sync/pending_op.dart`
**Depends on**: None
**Reuses**: transação e `batch` já usados em `_replaceTable`
**Requirement**: SYNC-01, SYNC-02

**Tools**:

- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:

- [x] Tabela criada no `onCreate` e na migração da v3
- [x] `enqueueOp`, `pendingOps` (ordem crescente de `seq`) e `deleteOp` implementados
- [x] Teste cobre ordem de saída e remoção por `seq`
- [x] `wipeAllData` também esvazia a fila — sem isso a troca de conta empurraria a operação do dono anterior sob o novo login (P19)
- [x] Gate: `flutter test --no-pub` verde (229 testes, 10 novos)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(patient): add a local pending-operations log`
**Status**: ✅ Complete

---

### T15: Escritas unitárias no datasource local

**What**: `upsertCarb`, `deleteCarb`, `upsertInsulin`, `deleteInsulin` e `upsertAlert` gravando linha e operação pendente na mesma transação.
**Where**: `lib/features/patient/data/datasources/patient_local_datasource.dart`
**Depends on**: T14
**Reuses**: mappers com `id` de T3
**Requirement**: SYNC-01, SYNC-07

**Tools**:

- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:

- [x] As cinco operações existem e são atômicas (linha + op na mesma transação)
- [x] `pendingEntityIds(entity)` devolve os ids com operação pendente
- [x] Teste cobre atomicidade e o conjunto de ids pendentes — a atomicidade é provada derrubando `pending_ops` por outra conexão: a escrita lança e a linha do diário não fica órfã
- [x] Gate: `flutter test --no-pub` verde (239 testes, 10 novos)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(patient): write diary rows and their pending op atomically`
**Status**: ✅ Complete

---

### T16: Chamadas unitárias no datasource remoto

**What**: `upsertCarb`/`deleteCarb` e equivalentes, com fallback `PUT` → 404 → `POST` e 404 de remoção tratado como sucesso.
**Where**: `lib/features/patient/data/datasources/patient_remote_datasource.dart`
**Depends on**: T15
**Reuses**: instância Dio e mappers do próprio arquivo
**Requirement**: SYNC-06, API-01

**Tools**:

- MCP: NONE
- Skill: `glucore-backend`

**Done when**:

- [x] As seis chamadas unitárias existem para carbs, insulin e alerts
- [x] `PUT` que devolve 404 cai para `POST` com o mesmo id
- [x] `DELETE` que devolve 404 é tratado como sucesso
- [x] Teste cobre os três caminhos com Dio dublê, mais a guarda de que um erro não-404 propaga em vez de virar sucesso
- [x] Contrato `PatientRemoteApi` declarado em `patient_datasource.dart` — é o tipo que a drenagem do T17 consome
- [x] Gate: `flutter test --no-pub` verde (246 testes, 7 novos)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(patient): talk to the per-item diary API`
**Status**: ✅ Complete

---

### T17: Drenagem da fila no serviço de sincronização

**What**: substituir o push de coleção de carbs, insulin e alerts pela drenagem ordenada do op-log, com parada no primeiro erro, descarte de op ilegível e log.
**Where**: `lib/features/patient/data/sync/patient_sync_service.dart`
**Depends on**: T16
**Reuses**: `_pushWithRetry`, debounce, listener de conectividade e guarda de dono já existentes
**Requirement**: SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-08, SYNC-09, SYNC-10

**Tools**:

- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:

- [ ] Ops drenadas em ordem de `seq`; op confirmada sai da fila
- [ ] Falha recuperável interrompe a drenagem preservando a op e as posteriores
- [ ] 401 interrompe o push e preserva a fila
- [ ] Op com entidade desconhecida ou payload ilegível é descartada com log e a fila continua
- [ ] Readings e settings continuam pelo caminho de coleção
- [ ] Testes cobrem ordem, parada no erro, 401, descarte e reenvio idempotente
- [ ] Gate: `flutter analyze && flutter test --no-pub` verde

**Tests**: unit
**Gate**: full
**Commit**: `feat(patient): drain diary changes as ordered per-item operations`

---

### T18: Repository por item e fim do truncamento

**What**: expor operações por entrada no `PatientRepository`, remover o corte em 100 entradas e passar a reconciliação a preservar linhas com operação pendente.
**Where**: `lib/features/patient/data/repositories/patient_repository.dart`
**Depends on**: T17
**Reuses**: `replaceWithServerSnapshot` e `ensureOwner` existentes
**Requirement**: SYNC-01, API-03, IDENT-07

**Tools**:

- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:

- [ ] `addCarb`/`updateCarb`/`removeCarb` e equivalentes de insulin e alerts existem e agendam o push
- [ ] `maxEntries` deixa de truncar o diário
- [ ] `replaceWithServerSnapshot` preserva linhas citadas em `pending_ops`
- [ ] Testes cobrem diário acima de 100 entradas e reconciliação com pendência
- [ ] Gate: `flutter test --no-pub` verde

**Tests**: unit
**Gate**: quick
**Commit**: `feat(patient): expose per-entry repository writes without truncation`

---

### T19: Cubit escrevendo por entrada

**What**: trocar as chamadas de coleção do `PatientCubit` pelas operações por entrada.
**Where**: `lib/features/patient/presentation/cubit/patient_cubit.dart`
**Depends on**: T18
**Reuses**: estrutura de estado e dedupe de alertas já existentes
**Requirement**: SYNC-01, SYNC-07

**Tools**:

- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:

- [ ] Adicionar, editar e apagar carboidrato e insulina chamam a operação unitária
- [ ] Alerta novo gerado pelo cubit é gravado por item
- [ ] Leituras continuam pela gravação de coleção com debounce
- [ ] Teste cobre uma edição gerando exatamente uma operação pendente
- [ ] Gate: `flutter analyze && flutter test --no-pub` verde

**Tests**: unit
**Gate**: full
**Commit**: `feat(patient): route diary mutations through per-entry writes`

---

### T20: Entidades do paciente em `domain/entities`

**What**: mover as entidades e enums para `lib/features/patient/domain/entities/`, com barrel, e atualizar os imports do app.
**Where**: `lib/features/patient/domain/entities/patient_entities.dart`
**Depends on**: None
**Reuses**: forma de `lib/features/auth/domain/entities/user_entity.dart`
**Requirement**: DOMAIN-01

**Tools**:

- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:

- [ ] Entidades e enums vivem em `domain/entities/`, exportados por um barrel
- [ ] Nenhum arquivo importa mais `presentation/models/patient_models.dart`
- [ ] Testes existentes atualizados e verdes, sem mudança de asserção
- [ ] Gate: `flutter analyze && flutter test --no-pub` verde

**Tests**: unit
**Gate**: full
**Commit**: `refactor(patient): move patient entities into domain`

---

### T21: Contrato do repositório no domain

**What**: declarar `PatientRepository` abstrato em `domain/repositories/`, renomear a implementação para `PatientRepositoryImpl` em `data/` e ajustar o DI.
**Where**: `lib/features/patient/domain/repositories/patient_repository.dart`
**Depends on**: T20
**Reuses**: `lib/features/auth/domain/repositories/auth_repository.dart` como forma
**Requirement**: DOMAIN-02

**Tools**:

- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:

- [ ] Interface no domain com a assinatura completa usada pelo cubit
- [ ] Implementação em `data/repositories/patient_repository_impl.dart`
- [ ] `injection_container.dart` registra a interface
- [ ] Gate: `flutter analyze && flutter test --no-pub` verde

**Tests**: unit
**Gate**: full
**Commit**: `refactor(patient): declare the repository contract in domain`

---

### T22: Casos de uso do paciente

**What**: criar os casos de uso do diário, das leituras, dos alertas e da carga de dados em `domain/usecases/`.
**Where**: `lib/features/patient/domain/usecases/`
**Depends on**: T21
**Reuses**: `lib/features/auth/domain/usecases/login_usecase.dart` como forma
**Requirement**: DOMAIN-03

**Tools**:

- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:

- [ ] Um caso de uso por operação hoje chamada no repositório pelo cubit
- [ ] Cada um recebe o repositório por construtor e expõe `call`
- [ ] Teste unitário por caso de uso com repositório dublê
- [ ] Gate: `flutter test --no-pub` verde

**Tests**: unit
**Gate**: quick
**Commit**: `feat(patient): add patient use cases in the domain layer`

---

### T23: Cubit dependendo de casos de uso

**What**: trocar a dependência direta do repositório no `PatientCubit` pelos casos de uso e ajustar o DI.
**Where**: `lib/features/patient/presentation/cubit/patient_cubit.dart`
**Depends on**: T22
**Reuses**: registro do `AuthCubit` em `injection_container.dart` como forma
**Requirement**: DOMAIN-03, DOMAIN-04

**Tools**:

- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:

- [ ] O cubit não referencia mais a implementação do repositório
- [ ] `injection_container.dart` injeta os casos de uso
- [ ] Comportamento observável preservado — suíte existente verde sem asserção alterada
- [ ] Gate: `flutter analyze && flutter test --no-pub` verde

**Tests**: unit
**Gate**: full
**Commit**: `refactor(patient): drive the cubit through domain use cases`

---

### T24: Paleta em `ThemeExtension` e tema escuro

**What**: criar a extensão de cores com instâncias clara e escura e o `AppTheme.dark()`.
**Where**: `lib/core/theme/glucore_colors.dart`
**Depends on**: None
**Reuses**: constantes e `ThemeData` de `lib/core/theme/app_theme.dart:59`
**Requirement**: THEME-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Extensão com todas as cores hoje estáticas, em instância clara e escura
- [ ] Matizes das faixas clínicas idênticos nos dois temas; variantes suaves, tintas e superfícies recalculadas
- [ ] `AppTheme.dark()` monta o `ThemeData` escuro com a extensão registrada
- [ ] Teste confere que as faixas clínicas têm o mesmo matiz nos dois temas
- [ ] Gate: `flutter test --no-pub` verde

**Tests**: unit
**Gate**: quick
**Commit**: `feat(theme): add a dark palette behind a theme extension`

---

### T25: Preferência de tema persistida

**What**: criar o armazenamento da preferência e o cubit de tema, e ligá-los na raiz do app.
**Where**: `lib/core/theme/theme_cubit.dart`
**Depends on**: T24
**Reuses**: leitura/escrita de `onboarding_done` em `lib/app.dart:74-86`
**Requirement**: THEME-01, THEME-02, THEME-03

**Tools**:

- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:

- [ ] Preferência lida e gravada em `SharedPreferences` na chave `theme_mode`, default `system`
- [ ] `MaterialApp` recebe `theme`, `darkTheme` e `themeMode` do cubit
- [ ] Teste cobre persistência entre execuções e o modo `system` seguindo a plataforma
- [ ] Gate: `flutter analyze && flutter test --no-pub` verde

**Tests**: unit
**Gate**: full
**Commit**: `feat(theme): persist the light and dark preference`

---

### T26: Seletor de tema nas configurações

**What**: acrescentar o controle de tema (sistema, claro, escuro) na tela de configurações, com textos em `.arb`.
**Where**: `lib/features/patient/presentation/pages/settings_page.dart`
**Depends on**: T25
**Reuses**: padrão de linha de configuração já existente na página
**Requirement**: THEME-01

**Tools**:

- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:

- [ ] Três opções disponíveis, refletindo o estado atual
- [ ] Textos vindos do l10n, com `flutter gen-l10n` rodado
- [ ] Teste de widget troca para escuro e confere a mudança imediata
- [ ] Gate: `flutter analyze && flutter test --no-pub` verde

**Tests**: widget
**Gate**: full
**Commit**: `feat(settings): let the user pick the app theme`

---

### T27: Cores por contexto nas telas do paciente

**What**: trocar as referências estáticas de cor por lookup da extensão nas páginas e widgets do feature `patient`.
**Where**: `lib/features/patient/presentation/`
**Depends on**: T26
**Reuses**: extensão criada em T24
**Requirement**: THEME-05

**Tools**:

- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:

- [ ] Nenhuma cor de superfície ou de texto resolvida por constante estática nas telas do paciente
- [ ] Teste de widget renderiza monitoramento, histórico e diário no tema escuro e falha se a superfície resolvida for a clara
- [ ] Gate: `flutter analyze && flutter test --no-pub` verde

**Tests**: widget
**Gate**: full
**Commit**: `refactor(patient): resolve screen colors from the active theme`

---

### T28: Cores por contexto no restante do app

**What**: mesma troca nas telas de auth, nos widgets compartilhados e no core.
**Where**: `lib/features/auth/presentation/`
**Depends on**: T27
**Reuses**: extensão criada em T24
**Requirement**: THEME-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Nenhuma referência estática de superfície ou texto restante fora da definição da paleta
- [ ] Teste de widget cobre login e onboarding no tema escuro
- [ ] Gate: `flutter analyze && flutter test --no-pub` verde

**Tests**: widget
**Gate**: full
**Commit**: `refactor(auth): resolve screen colors from the active theme`

---

### T29: `AuthDataSource` com nome honesto

**What**: renomear a interface e o arquivo do datasource de autenticação, sem mudança de comportamento.
**Where**: `lib/features/auth/data/datasources/auth_datasource.dart`
**Depends on**: None
**Reuses**: registro atual em `lib/injection_container.dart:39-41`
**Requirement**: DEAD-01

**Tools**:

- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:

- [ ] Interface `AuthDataSource` no arquivo `auth_datasource.dart`
- [ ] Imports e DI ajustados; nenhuma referência ao nome antigo
- [ ] Suíte existente verde sem asserção alterada
- [ ] Gate: `flutter analyze && flutter test --no-pub` verde

**Tests**: unit
**Gate**: full
**Commit**: `refactor(auth): rename the auth datasource to match what it does`

---

### T30: Fluxo de transmissor fora do Dart

**What**: remover `submitTransmitter` e o estado de transmissor das camadas Dart.
**Where**: `lib/features/sensor/`
**Depends on**: T29
**Reuses**: —
**Requirement**: DEAD-02

**Tools**:

- MCP: NONE
- Skill: `glucore-sensor-ble`

**Done when**:

- [ ] Método removido de plataforma, repositório, contrato de domínio e cubit
- [ ] Estados de sessão ligados a transmissor removidos do enum
- [ ] Testes existentes atualizados e verdes
- [ ] Gate: `flutter analyze && flutter test --no-pub` verde

**Tests**: unit
**Gate**: full
**Commit**: `refactor(sensor)!: drop the unused transmitter flow from the app`

---

### T31: Fluxo de transmissor e payload de warmup fora do Kotlin

**What**: remover o método de canal, a validação de código de barras de transmissor, os estados correspondentes e o `WarmupPayload` do caminho BLE.
**Where**: `android/app/src/main/kotlin/com/berdegeus/glucore/`
**Depends on**: T30
**Reuses**: —
**Requirement**: DEAD-02, DEAD-03

**Tools**:

- MCP: NONE
- Skill: `glucore-sensor-ble`

**Done when**:

- [ ] Canal, `SensorPlatformImpl`, `SensorCore`, `SibionicsBarcode` e o registro de sessão sem referência a transmissor
- [ ] `WarmupPayload` removido; `warmingUp` e o caminho NFC do Libre 2 intactos
- [ ] Gate: `cd android && ./gradlew :app:testDebugUnitTest` verde
- [ ] Gate de build completo verde

**Tests**: none
**Gate**: build
**Commit**: `refactor(android)!: remove the transmitter flow and the ghost warmup payload`

---

### T32: Stubs nativos sem uso removidos

**What**: apagar `saveMatchedDevice`, `getInitialWrite` e `handleNotification` do C++ e as declarações `external` correspondentes.
**Where**: `android/app/src/main/cpp/glucore_sibionics_bridge.cpp`
**Depends on**: T31
**Reuses**: —
**Requirement**: DEAD-04

**Tools**:

- MCP: NONE
- Skill: `glucore-native-bridge`

**Done when**:

- [ ] As três funções JNI e suas declarações Kotlin não existem mais
- [ ] Build nativo continua ligando `libg.so` sem símbolo faltando
- [ ] Gate de build completo verde

**Tests**: none
**Gate**: build
**Commit**: `refactor(native): drop the unmapped bridge stubs`

---

### T33: Documentos de contrato atualizados

**What**: refletir nos documentos de referência o canal sem transmissor, o modelo de dados com `id` e op-log, e a API por item com paginação.
**Where**: `docs/reference/`
**Depends on**: T32
**Reuses**: `backend/README.md` já existente
**Requirement**: PLAN-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `platform-channels.md` sem `submitTransmitter` e sem `warmup` no caminho BLE
- [ ] `data-models.md` descreve `id`, `pending_ops` e o novo significado de `synced`
- [ ] `backend/README.md` cobre os endpoints de alerts e a paginação, com exemplos reais
- [ ] Gate: leitura conferida contra o código, sem afirmação não verificada

**Tests**: none
**Gate**: build
**Commit**: `docs: update the channel, data-model and API contracts`

---

### T34: Plano, review e memória do projeto

**What**: registrar a decisão do op-log, fechar P13 por remoção e atualizar o estado das Fases 3–5.
**Where**: `docs/ARCHITECTURE_FIX_PLAN.md`
**Depends on**: T33
**Reuses**: formato dos registros anteriores no próprio arquivo
**Requirement**: PLAN-01, PLAN-02, PLAN-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `AD-009` registrado no `.specs/STATE.md` com o desenho do op-log
- [ ] P13 marcado como resolvido-por-remoção no `ARCHITECTURE_REVIEW.md`, citando `f91adea`, com o diagnóstico preservado
- [ ] Itens 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 5.1 e 5.2 do plano refletindo o estado entregue
- [ ] Gate de build completo verde

**Tests**: none
**Gate**: build
**Commit**: `docs(plan): close phases 3-5 and record the op-log decision`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

Phase 1:  T1 → T2 → T3 → T4 → T5
Phase 2:  T6 → T7 → T8 → T9
Phase 3:  T10 → T11 → T12 → T13
Phase 4:  T14 → T15 → T16 → T17 → T18 → T19
Phase 5:  T20 → T21 → T22 → T23
Phase 6:  T24 → T25 → T26 → T27 → T28
Phase 7:  T29 → T30 → T31 → T32 → T33 → T34
```

Execução estritamente sequencial: uma tarefa por vez, em ordem.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 arquivo de modelo (3 classes irmãs) | ✅ coeso |
| T2, T3 | 1 arquivo, recortes distintos (schema/migração e mappers) | ✅ granular |
| T4, T5 | 1 arquivo cada | ✅ granular |
| T6, T8, T10 | 1 repository cada | ✅ granular |
| T7, T9, T11 | 1 rota + seus service/controller (unidade de entrega da camada) | ✅ coeso |
| T12, T13 | 1 arquivo cada | ✅ granular |
| T14–T19 | 1 arquivo cada | ✅ granular |
| T20–T23 | 1 recorte de camada cada | ✅ granular |
| T24–T26 | 1 arquivo cada | ✅ granular |
| T27, T28 | migração mecânica por diretório | ✅ coeso |
| T29–T32 | 1 recorte de remoção cada | ✅ granular |
| T33, T34 | documentação por conjunto | ✅ coeso |

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama mostra | Status |
| ---- | ------------------ | --------------- | ------ |
| T1 | None | — | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T4 | T4 → T5 | ✅ |
| T6 | None | — | ✅ |
| T7 | T6 | T6 → T7 | ✅ |
| T8 | T7 | T7 → T8 | ✅ |
| T9 | T8 | T8 → T9 | ✅ |
| T10 | None | — | ✅ |
| T11 | T10 | T10 → T11 | ✅ |
| T12 | T11 | T11 → T12 | ✅ |
| T13 | T12 | T12 → T13 | ✅ |
| T14 | None | — | ✅ |
| T15 | T14 | T14 → T15 | ✅ |
| T16 | T15 | T15 → T16 | ✅ |
| T17 | T16 | T16 → T17 | ✅ |
| T18 | T17 | T17 → T18 | ✅ |
| T19 | T18 | T18 → T19 | ✅ |
| T20 | None | — | ✅ |
| T21 | T20 | T20 → T21 | ✅ |
| T22 | T21 | T21 → T22 | ✅ |
| T23 | T22 | T22 → T23 | ✅ |
| T24 | None | — | ✅ |
| T25 | T24 | T24 → T25 | ✅ |
| T26 | T25 | T25 → T26 | ✅ |
| T27 | T26 | T26 → T27 | ✅ |
| T28 | T27 | T27 → T28 | ✅ |
| T29 | None | — | ✅ |
| T30 | T29 | T29 → T30 | ✅ |
| T31 | T30 | T30 → T31 | ✅ |
| T32 | T31 | T31 → T32 | ✅ |
| T33 | T32 | T32 → T33 | ✅ |
| T34 | T33 | T33 → T34 | ✅ |

Fases rodam em sequência, então uma tarefa da fase N sempre começa depois de toda a fase N−1; por isso a primeira tarefa de cada fase não declara dependência explícita.

## Test Co-location Validation

| Task | Camada tocada | Matriz exige | Tarefa diz | Status |
| ---- | ------------- | ------------ | ---------- | ------ |
| T1 | entidades Dart | unit | unit | ✅ |
| T2, T3 | dados Dart | unit | unit | ✅ |
| T4 | dados Dart | unit | unit | ✅ |
| T5 | cubit Dart | unit | unit | ✅ |
| T6, T8, T10 | backend repository | unit | unit | ✅ |
| T7, T9, T11 | backend controller/rota | integration | integration | ✅ |
| T12 | schema Prisma | none | none | ✅ |
| T13 | testes do backend | integration | integration | ✅ |
| T14, T15 | dados Dart | unit | unit | ✅ |
| T16 | dados Dart | unit | unit | ✅ |
| T17, T18 | dados Dart | unit | unit | ✅ |
| T19 | cubit Dart | unit | unit | ✅ |
| T20 | entidades Dart | unit | unit | ✅ |
| T21, T22, T23 | domain/cubit Dart | unit | unit | ✅ |
| T24 | tema (core) | unit | unit | ✅ |
| T25 | tema + raiz do app | unit | unit | ✅ |
| T26, T27, T28 | UI Flutter | widget | widget | ✅ |
| T29 | dados Dart | unit | unit | ✅ |
| T30 | sensor Dart | unit | unit | ✅ |
| T31, T32 | Kotlin / C++ | none | none | ✅ |
| T33, T34 | documentação | none | none | ✅ |
