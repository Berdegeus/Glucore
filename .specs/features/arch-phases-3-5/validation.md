# Verificação independente — `arch-phases-3-5`

Rodada única. Autor ≠ verificador. Regra aplicada: **evidência-ou-zero** — nenhum item foi aceito pelo relato dos cinco workers de lote; tudo abaixo foi re-derivado por leitura própria do código e por execução própria dos gates. A árvore real foi tratada como read-only; as mutações rodaram num `git worktree --detach` fora do repositório.

**Result**: PASS — 44 de 47 ACs com evidência direta que casa com o desfecho da spec, 3 registrados abaixo (1 sem teste direto, 1 meio-coberto, 1 desvio de processo), nenhum bloqueante. Sensor de discriminação 11/11 mortos. (Linha de veredito legível por `validate_state.py`.)

| Campo | Valor |
| --- | --- |
| Data | 2026-08-29 |
| Spec | `.specs/features/arch-phases-3-5/spec.md` (47 requisitos) |
| Branch | `feat/arch-phases-3-5` |
| HEAD verificado | `94a2afbdf0ae792724d6a6a0dfab9ade58b5a555` |
| Range do diff | `037a8bc..94a2afb` — 34 commits de tarefa + 3 de planejamento/handoff |
| Superfície | 143 arquivos, +10442 / −1794 linhas |
| Verificador | sub-agente independente (autor ≠ verificador) |

**Por que PASS:** os dois caminhos de perda de dados clínicos que motivaram a iteração estão fechados e — o que importa mais — estão *discriminados por teste*. As onze mutações injetadas cobrem cada ponto onde uma falha silenciosa custaria uma entrada de diário (migração v2→v3, drenagem do op-log, atomicidade linha+operação, 404 no delete, escopo por paciente no backend, limites de paginação, paleta escura), e todas as onze morreram. Os três pontos registrados abaixo custam cobertura de regressão ou fidelidade de processo, não integridade do diário do paciente.

---

## Gates — executados nesta rodada, não relatados

| Gate | Comando | Resultado | Confere com o relato? |
| --- | --- | --- | --- |
| Flutter analyze | `flutter analyze` | `No issues found!` — exit 0 | ✅ |
| Flutter test | `flutter test --no-pub` | **340 passaram, 0 falharam** — exit 0 | ✅ (relato: 340) |
| Backend typecheck | `npx tsc --noEmit` | exit 0, sem diagnóstico | ✅ |
| Backend test | `npm test` | **146 passaram, 0 falharam, 0 pulados**, 28 suítes | ✅ (relato: 146) |
| Backend coverage | `npm run test:coverage` | ver tabela abaixo | ✅ |
| Android JVM | `./gradlew :app:testDebugUnitTest` | **34 testes, 0 falhas, 0 pulados** | ✅ (relato: 34) |

**Nota sobre o gate Android — armadilha que quase virou falso positivo.** A primeira execução saiu `BUILD SUCCESSFUL` com `> Task :app:testDebugUnitTest UP-TO-DATE`: **nenhum teste rodou**. Um "verde" lido daí seria vazio. Repeti com `--rerun-tasks` e contei os testes nos XML de resultado, não na saída do Gradle:

| Suíte | Testes |
| --- | --- |
| `AccuChekProtocolTest` | 4 |
| `Libre2PacketAssemblerTest` | 5 |
| `LibreNfcProtocolTest` | 5 |
| `SensorBrandTest` | 3 |
| `SibionicsGlucoseDecoderTest` | 17 |
| **Total** | **34**, com `failures="0" errors="0" skipped="0"` em todos |

JDK usado: `JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"`. O gate é runnable neste ambiente.

### Cobertura do backend — a afirmação de 100% nos doze módulos novos, conferida

QUAL-03 exige ≥75% de linhas nos módulos de controller, service e repository das três coleções. Os autores afirmaram 100%. Executei `npm run test:coverage` e conferi linha a linha:

| Camada | Módulo | Linhas | Branches | Funções |
| --- | --- | --- | --- | --- |
| controllers | `alertController.ts` | 100,00 | 100,00 | 100,00 |
| controllers | `carbController.ts` | 100,00 | 100,00 | 100,00 |
| controllers | `insulinController.ts` | 100,00 | 100,00 | 100,00 |
| services | `alertService.ts` | 100,00 | 89,74 | 100,00 |
| services | `carbService.ts` | 100,00 | 75,68 | 100,00 |
| services | `insulinService.ts` | 100,00 | 82,50 | 100,00 |
| repositories | `alertRepository.ts` | 100,00 | 100,00 | 100,00 |
| repositories | `carbRepository.ts` | 100,00 | 100,00 | 100,00 |
| repositories | `insulinRepository.ts` | 100,00 | 100,00 | 100,00 |
| routes | `alerts.ts` | 100,00 | 100,00 | 100,00 |
| routes | `carbs.ts` | 100,00 | 100,00 | 100,00 |
| routes | `insulin.ts` | 100,00 | 100,00 | 100,00 |

**Doze módulos, 100,00% de linhas em todos.** Afirmação confirmada. `pagination.ts` (100,00) e `result.ts` (100,00) também fecharam cheios. Total do projeto: 99,00% de linhas / 92,80% de branches.

---

## Evidência por AC

Cada linha traz `arquivo:linha` mais a expressão asserida. Onde a spec fixa um valor, confiro se a asserção mira **aquele** valor — não apenas se existe asserção.

### P1 — Entradas de diário com identidade estável (IDENT-01..07)

| AC | Desfecho definido pela spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| IDENT-01 | todo carb/insulina/alerta criado no app recebe UUID v4 | `test/features/patient/patient_entry_identity_test.dart:20` — `expect(first.id, matches(uuidV4))` + `expect(first.id, isNot(second.id))` para as três entidades (`:15`, `:25`, `:44`); implementação `lib/features/patient/domain/entities/entry_id.dart:11` | ✅ |
| IDENT-02 | editar o horário preserva o `id` | `test/features/patient/patient_entry_identity_test.dart:57` — `copyWith` muda horário e gramas e o `id` é asserido igual, nas três entidades (`:57`, `:69`, `:86`); ponta a ponta em `diary_entry_identity_test.dart:93` | ✅ |
| IDENT-03 | apagar localiza a linha pelo `id`, não pelo timestamp | `test/features/patient/diary_entry_identity_test.dart:113` — duas entradas no mesmo `t0`, apaga a primeira, `expect(cubit.state.carbs.single.id, second.id)`; implementação `patient_local_datasource.dart:355` — `where: 'id = ?'` | ✅ |
| IDENT-04 | duas entradas com o mesmo `time_ms` persistem as duas, editáveis de forma independente | `test/features/patient/pending_ops_test.dart:260` — `expect((await dataSource.load()).carbs, hasLength(2))`; schema `patient_local_datasource.dart:104` (`id TEXT PRIMARY KEY`, `time_ms` só indexado) conferido por `local_datasource_migration_test.dart:128` | ✅ |
| IDENT-05 | migração adiciona `id`, preenche UUID v4 e preserva **todas** as linhas | `test/features/patient/local_datasource_migration_test.dart:225-256` — `hasLength(2)`/`hasLength(1)`/`hasLength(2)` por tabela, `everyElement(matches(uuidV4))`, ids distintos, e cada coluna carregada conferida (`grams`=30, `units`=4.5, `day_of_week`, `synced`) | ✅ |
| IDENT-06 | id ausente ou fora do formato UUID → gera id local e persiste | `test/features/patient/patient_entry_identity_test.dart:154` e `:166` (`fromJson` sem id e com id inválido → `matches(uuidV4)`); no transporte, `remote_patient_datasource_test.dart:304` e `:329` | ✅ |
| IDENT-07 | marcação de sincronizado casa as linhas pelo `id` | `test/features/patient/patient_repository_items_test.dart:196` e `:221` — a linha com op na fila sobrevive ao snapshot do servidor e a versão local vence; `pending_ops_test.dart:317` para `pendingEntityIds`; implementação `patient_local_datasource.dart:456-462` (`_markSyncedByKey(..., 'id', ...)`) | ✅ |

### P1 — Sincronização por item (SYNC-01..10)

| AC | Desfecho definido pela spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| SYNC-01 | mutação enfileira op unitária **junto com** a gravação local | `test/features/patient/pending_ops_test.dart:157` — payload conferido campo a campo (`payload['id']`, `payload['grams']`, `payload['timeMs']`); atomicidade em `:290` — sabota `pending_ops`, a transação desfaz e `expect(rows, isEmpty)` no diário | ✅ |
| SYNC-02 | drenar em ordem de criação | `test/features/patient/pending_ops_test.dart:86` — `expect(queued.map((o) => o.seq!).toList(), [1, 2, 3])`; `:89` prova que a ordem **não** depende do `created_at` (relógio para trás não reordena); ponta a ponta em `patient_sync_service_test.dart:232` | ✅ |
| SYNC-03 | falha de rede/servidor mantém na fila e reagenda com o backoff | `test/features/patient/patient_sync_service_test.dart:170` — `expect(pushed, isFalse)` e `expect((await local.pendingOps()).single.entityId, entry.id)`; retomada em `:282` | ✅ |
| SYNC-04 | falha no meio preserva **essa e todas as posteriores**, sem enviar fora de ordem | `test/features/patient/patient_sync_service_test.dart:272-279` — `expect(queued.map((o) => o.entityId).toList(), [second.id, third.id])` **e** `expect(remote.itemCalls.where((c) => c.endsWith(third.id)), isEmpty)`. A segunda asserção é a que fecha "sem enviar fora de ordem" | ✅ |
| SYNC-05 | entidade desconhecida ou payload ilegível é descartada e a fila segue | `test/features/patient/patient_sync_service_test.dart:339` e `:365` — `expect(await local.pendingOps(), isEmpty)` **e** `expect(remote.itemCalls, ['upsert:carbs:${entry.id}'])` (a op seguinte de fato subiu) | ✅ |
| SYNC-06 | reenvio produz o mesmo estado final, sem linha duplicada | `test/features/patient/patient_sync_service_test.dart:405` — `expect(remote.carbRows.keys.toList(), [entry.id])` (uma chave só) + `expect(remote.carbRows[entry.id]!.description, 'Café')`; mecanismo `PUT`→404→`POST` em `remote_patient_datasource_test.dart:237` | ✅ |
| SYNC-07 | edição durante um push em andamento mantém a nova pendência enfileirada | **sem teste direto** — nenhum teste da suíte executa uma escrita concorrente a um push em voo. Ver Gap 1 | ⚠️ sem evidência direta |
| SYNC-08 | op descartada por erro definitivo loga entidade, id e motivo | `test/features/patient/patient_sync_service_test.dart:355` — `expect(logged.single, allOf(contains('fantasmas'), contains('ghost-1'), contains('entidade desconhecida')))`. Os três campos exigidos pela AC são asseridos um a um, não "houve log" | ✅ |
| SYNC-09 | resposta 2xx remove a op da fila | `test/features/patient/pending_ops_test.dart:126` — `deleteOp` tira só o `seq` informado (`expect(remaining..., ['a', 'c'])`); ponta a ponta em `patient_sync_service_test.dart:238` | ✅ |
| SYNC-10 | leituras e thresholds seguem pelo caminho de coleção | `test/features/patient/patient_sync_service_test.dart:426-428` — `expect(remote.savedReadings, hasLength(1))` e `expect(remote.itemCalls, ['upsert:carbs:${entry.id}'])` na mesma execução; a contraprova (`expect(remote.savedCarbs, isEmpty)`) está em `:150` | ✅ |

### P1 — API por item com histórico paginado (API-01..06)

| AC | Desfecho definido pela spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| API-01 | criar/atualizar/remover alerta unitário afeta **exatamente** a linha do paciente autenticado | `backend/tests/routes/alerts.test.ts:228`, `:266` (e os pares em `carbs.test.ts`/`insulin.test.ts`) — status e estado da linha asseridos juntos | ✅ |
| API-02 | id de outro paciente → 404 **sem alterar dado algum** | `backend/tests/routes/alerts.test.ts:238-240` — `assert.equal(res.status, 404)` **mais** `assert.equal(rows[0].alertType, AlertType.HYPO_RISK)` e `assert.equal((rows[0].triggeredAt as Date).getTime(), 1_000)`. O DELETE em `:273` assere `rows.length === 1`. Regra payload/conjunção satisfeita: o estado, não só o status | ✅ |
| API-03 | no máximo `limit` entradas anteriores a `before`, em ordem decrescente | `backend/tests/routes/carbs.test.ts` / `insulin.test.ts` / `alerts.test.ts` — "paginates to the end … covers the whole history (API-03)": pagina até o fim e compara a soma das páginas com o total semeado; local, `patient_repository_items_test.dart:164` grava 150 entradas inteiras | ✅ |
| API-04 | `limit` fora de 1..500 ou `before` não-epoch → 400 com `error` e `code` | `backend/tests/routes/carbs.test.ts:96-97` — `assert.equal(res.status, 400)` **e** `assert.equal(res.body.code, 'INVALID_PAGINATION')`. Limite superior coberto por carbs/insulin (`limit: 501`), inferior por alerts (`limit: 0`, `alerts.test.ts:119`) | ✅ |
| API-05 | listagem sem parâmetros preserva as 100 mais recentes | `backend/tests/routes/carbs.test.ts:67-68` — semeia 120, `assert.equal(res.body.length, 100)` **e** `assert.equal(res.body[0].timeMs, 1_000 + 119)` (a mais recente primeiro, não uma fatia qualquer) | ✅ |
| API-06 | endpoints de coleção seguem funcionando, marcados deprecated | `backend/tests/routes/alerts.test.ts:277` (`POST /alerts` ainda substitui a coleção); marca em `backend/src/routes/carbs.ts:55` — comentário `Deprecated: replace-all em lote` e o KDoc do arquivo | ✅ |

### P2 — Rotas novas em camadas (QUAL-01..05)

| AC | Desfecho definido pela spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| QUAL-01 | rota → controller → service → repository, sem Prisma no handler | `backend/src/routes/carbs.ts:50-56` — os cinco handlers são `asyncHandler(controller.X)`; `prisma` só aparece em `:37`, dentro de `defaultController()` (composição, não handler). Idem `insulin.ts:37`, `alerts.ts:38`. Guarda de comportamento: `backend/tests/routes/carbs.test.ts:223` — falha do repositório vira 500, não 200 silencioso | ✅ |
| QUAL-02 | criação, edição, remoção, paginação e o cenário de dois aparelhos, executáveis por `npm test` | `backend/tests/routes/carbs.test.ts` / `insulin.test.ts` / `alerts.test.ts` — inclui "two devices on the same account edit distinct entries independently" nas três coleções; `npm test` roda 146 e passa | ✅ |
| QUAL-03 | ≥75% de linhas nos módulos novos | Medido por execução: **100,00% em todos os doze** (tabela acima) | ✅ |
| QUAL-04 | consulta de paginação atendida por índice declarado no schema Prisma | `backend/prisma/schema.prisma:258` — `@@index([patientId, eventAt])` (CarbEvent), `:271` (InsulinEvent), `:246` — `@@index([patientId, triggeredAt])` (AlertEvent). Casa com o `where`/`orderBy` de `carbRepository.ts:68-71`. AC declarativa satisfeita pela própria declaração; ver Nota 1 | ✅ (por inspeção) |
| QUAL-05 | se faltasse índice, migration versionada no mesmo commit | Condicional vacuamente satisfeita: os três índices já existiam, então nenhuma migration era devida. Conferi `backend/prisma/migrations/` — nenhuma migration nova, coerente com o achado | ✅ |

### P2 — Camada `domain/` no patient (DOMAIN-01..04)

| AC | Desfecho definido pela spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| DOMAIN-01 | entidades em `domain/entities/` | `test/features/patient/domain_layering_test.dart:18` (o modelo de tela não existe mais) e `:27` (nenhum arquivo de `lib` importa `presentation/models`); entidades em `lib/features/patient/domain/entities/carb_entry.dart` etc. | ✅ |
| DOMAIN-02 | contrato em `domain/repositories/`, implementação em `data/` | `test/features/patient/domain_layering_test.dart:56` e `:72` (o domain não importa a camada de dados) e `:84` (o DI registra a interface); `lib/features/patient/domain/repositories/patient_repository.dart` × `data/repositories/patient_repository_impl.dart` | ✅ |
| DOMAIN-03 | o cubit opera **através de caso de uso**, sem chamar o repositório | `test/features/patient/domain_layering_test.dart:99` — `expect(repositoryCalls, isEmpty)` **e** `expect(cubit, isNot(contains('PatientRepositoryImpl')))`; `:115` assere a injeção `PatientCubit(useCases: sl())`. Os doze casos de uso têm teste próprio em `patient_usecases_test.dart:33-146` | ✅ |
| DOMAIN-04 | comportamento observável preservado, suíte verde | `flutter test` 340/340 verde nesta rodada; `domain_layering_test.dart:111` fecha o import de `data/` no cubit | ✅ |

### P2 — Tema claro e escuro (THEME-01..05)

| AC | Desfecho definido pela spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| THEME-01 | escolher escuro aplica **imediatamente, sem reiniciar** | `test/features/patient/settings_theme_selector_test.dart:107` — assere `Brightness.light` antes, toca a opção, e depois `expect(themeInUse(tester).brightness, Brightness.dark)` **mais** `expect(find.byType(SettingsPage), findsOneWidget)` — a mesma tela continua montada, que é a metade "sem reiniciar" da AC | ✅ |
| THEME-02 | reabrir restaura a última preferência | `test/core/theme/theme_cubit_test.dart:66` — modo escolhido numa execução é restaurado na seguinte; escrita conferida em `settings_theme_selector_test.dart:167` e a chave `theme_mode` em `theme_cubit_test.dart:40` | ✅ |
| THEME-03 | com a preferência em `system`, seguir o tema do SO | `test/core/theme/theme_cubit_test.dart:81` assere que o modo **permanece** `ThemeMode.system`; a delegação está em `lib/app.dart:107` (`themeMode: themeMode` sobre `theme:`/`darkTheme:`). A metade "segue o SO" não tem asserção. Ver Gap 2 | ⚠️ meio coberto |
| THEME-04 | matizes das faixas clínicas preservados no escuro | `test/core/theme/glucore_colors_test.dart:8` e `:12` — cada faixa comparada campo a campo entre `GlucoreColors.light` e `.dark`; `:23` prova o contrário para variantes suaves/tintas/superfícies (recalculadas); `auth_dark_theme_test.dart:183` cobre os alertas | ✅ |
| THEME-05 | cores de superfície e texto resolvidas pelo tema ativo em **todas** as telas | `test/features/auth/auth_dark_theme_test.dart:208` — varre `lib/` inteiro e falha se qualquer `AppTheme.<x>` fora de `{light, dark, monoStyle}` sobreviver; complementado pelas varreduras de pixel por página em `patient_dark_theme_test.dart:162/178/191` e `auth_dark_theme_test.dart:104/121` | ✅ |

**Afirmação dos autores conferida — "zero referências estáticas de cor a `AppTheme` em `lib/`":** `grep -rn "AppTheme\." lib/` devolve exatamente 3 ocorrências, e nenhuma é cor — `lib/app.dart:105` e `:106` (`AppTheme.light()` / `.dark()`, montagem de tema) e `lib/features/patient/presentation/pages/history_page.dart:133` (`AppTheme.monoStyle`, fábrica de fonte cuja `color:` vem de `zone.chartLine(context)`, resolvida por contexto). **Afirmação verdadeira.**

### P3 — Nomes honestos e árvore sem código morto (DEAD-01..06)

| AC | Desfecho definido pela spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| DEAD-01 | contrato de auth vira `AuthDataSource` em `auth_datasource.dart`, sem mudar comportamento | Arquivo `lib/features/auth/data/datasources/auth_datasource.dart` presente; `grep` por `AuthLocalDataSource` e `auth_local_datasource` em `lib/` e `test/` → **0 ocorrências**; `flutter test` verde comprova o "sem mudança de comportamento" | ✅ |
| DEAD-02 | fluxo de transmissor removido de **todas** as camadas, sem estado órfão no enum | `test/features/sensor/dead_code_pruning_test.dart:14` — varre `lib/` e falha se qualquer `.dart`/`.arb` mencionar `transmitter`; `:31` confere as quatro camadas nominalmente; `:50` assere que o enum não tem estado de transmissor **e** `expect(names, contains('warmingUp'))` | ✅ |
| DEAD-03 | `WarmupPayload` sai do contrato Kotlin do BLE, `warmingUp` e o NFC do Libre 2 preservados | `grep -rn "WarmupPayload" android/ lib/` → só um match em `android/.gradle/.../executionHistory.bin` (cache binário do Gradle, não fonte). Preservação conferida em `lib/features/sensor/domain/models.dart:27` e `android/.../LibreNfcHandler.kt:78,95,104` | ✅ |
| DEAD-04 | stubs `saveMatchedDevice`, `getInitialWrite`, `handleNotification` fora do C++ e as `external` correspondentes fora do Kotlin | Fonte: `grep` nos três nomes em `android/` e `lib/` → **0**. **Conferido também no binário** (ver abaixo) | ✅ |
| DEAD-05 | tabelas Prisma sem rota anotadas como roadmap, sem remover | `backend/prisma/schema.prisma:84, 93, 130, 143, 158, 174, 217, 274, 289, 305` — dez modelos com `/// roadmap: … Sem rota nesta release`; nenhum `model` removido | ✅ |
| DEAD-06 | `flutter analyze`, `flutter test` e o build Android limpos após a poda | Os três executados nesta rodada: analyze `No issues found!`, 340/340, Gradle `BUILD SUCCESSFUL` com 34/34 | ✅ |

**Afirmação dos autores conferida — "os stubs removidos sumiram do `.so` construído e as `external fun` sobreviventes ainda resolvem".** Não aceitei a busca em fonte como prova; abri o binário com o `llvm-nm` do NDK 28.2.13676358:

```
llvm-nm -D --defined-only build/app/intermediates/cxx/debug/.../arm64-v8a/libglucore-sibionics-bridge.so
```

Exporta **exatamente quatro** símbolos JNI: `..._getLastError`, `..._init`, `..._registerSensor`, `..._restoreActiveSensor`. Os três nomes removidos não aparecem nem como símbolo nem como string no binário (`grep -c` → 0). E as quatro `external fun` que restam em `android/.../GlucoreSibionicsBridge.kt:30, 35, 44, 51` casam **1:1** com esses quatro símbolos — nenhuma declaração órfã, nenhum símbolo sem declaração. **Afirmação verdadeira nos dois sentidos.**

### P3 — Plano e review fiéis ao estado real (PLAN-01..04)

| AC | Desfecho definido pela spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| PLAN-01 | decisão de remover o item 5.1 registrada no `STATE.md`, citando o commit de reversão | `.specs/STATE.md:53` — `AD-009`; a remoção do 5.1 por perda de base está registrada com a citação de `f91adea` | ✅ |
| PLAN-02 | P13 marcado como resolvido-por-remoção no review, preservando o diagnóstico | `docs/ARCHITECTURE_REVIEW.md:5` — "P13 fechou na mesma data **por remoção** — `MockSensorRepository` e `DebugPanel` foram revertidos em `f91adea`"; a seção `:112` (⚪ P13) preserva o diagnóstico original | ✅ |
| PLAN-03 | plano atualizado para refletir o estado entregue das Fases 3, 4 e 5 | `docs/ARCHITECTURE_FIX_PLAN.md:22` — bloco "Estado em 2026-08-29" com as fases concluídas e a exceção explícita do 5.1; `:166`, `:171`, `:184`, `:200`, `:211` trazem o "Entregue" por item; `:221` marca 5.1 como ⛔ Retirado do plano | ✅ |
| PLAN-04 | contrato de canal, API ou modelo que mudou → doc de `docs/reference/` atualizado **no mesmo commit** | Conteúdo entregue e correto: `docs/reference/data-models.md:26, 38, 48` documentam paginação `before`/`limit` (1..500), os três verbos unitários por coleção e a marca deprecated; `docs/reference/platform-channels.md` acompanha a remoção do transmissor. A cláusula "no mesmo commit" **não** foi honrada. Ver Gap 3 | ⚠️ desvio de processo |

---

## Casos de borda da spec

| Caso de borda | Evidência | Resultado |
| --- | --- | --- |
| Migração local falha no meio → banco fica na versão antiga, sem perder linhas | `test/features/patient/local_datasource_migration_test.dart:261` — força `carbs_new` ocupado, e depois assere `userVersion == 2`, `carbs hasLength(2)`, `carbs.first.containsKey('id') == false`, insulin 1 e alerts 2. Cobre "fica na v2" **e** "não perde linha" | ✅ |
| Op de remoção para entrada já apagada no backend → 404 é sucesso e a op sai da fila | `test/features/patient/remote_patient_datasource_test.dart:260` (`DELETE com 404 é sucesso e não tenta criar nada`) e `:268` (insulin e alerts idem); a saída da fila decorre de `patient_sync_service.dart:151`. Contraprova em `:284` — erro que não é 404 propaga | ✅ |
| `before` anterior à entrada mais antiga → lista vazia com 200 | `backend/tests/routes/alerts.test.ts:107` e `insulin.test.ts:106`. **Não há o par em `carbs.test.ts`** — caminho de código compartilhado (`parsePageQuery` + `findPage`), risco cosmético. Ver Nota 2 | ✅ (com nota) |
| 401 durante a drenagem → interrompe o push e preserva a fila intacta | `test/features/patient/patient_sync_service_test.dart:315-321` — `expect(pushed, isFalse)`, fila com os dois ids **na ordem**, e `expect(remote.itemCalls, ['upsert:carbs:${first.id}'])` provando que não houve retry | ✅ |
| Tema do sistema muda com o app aberto e a preferência em `system` → acompanha | Sem teste. Nenhum teste manipula `platformBrightnessTestValue`. Mesmo Gap 2 | ❌ não coberto |
| Duas operações consecutivas na mesma entrada → enviadas na ordem de criação | `test/features/patient/patient_sync_service_test.dart:249-253` — `expect(remote.itemCalls, ['upsert:carbs:${entry.id}', 'upsert:carbs:${entry.id}'])` **e** `expect(remote.carbRows[entry.id]!.grams, 60)` (o estado final é o da segunda op, não o da primeira) | ✅ |

---

## Sensor de discriminação

**Tiering: P0-full.** A feature mexe em dado clínico do paciente — o critério de escolha das mutações foi "onde uma falha silenciosa custa uma entrada de diário", não cobertura uniforme. Onze mutações, acima do mínimo de cinco.

**Isolamento.** Baseline de `git status --porcelain` capturado antes de qualquer mutação. Scratch = `git worktree add --detach 94a2afb` num diretório fora do repositório, com `flutter pub get` próprio e `node_modules` do backend por junction. Nenhum `git stash` em momento algum. Cada mutação foi revertida com `git checkout --` **dentro do worktree**; ao fim, `git worktree remove --force` + `git worktree prune`.

| # | `file:line` | Fault injetado | Testes que rodaram | Resultado |
| --- | --- | --- | --- | --- |
| 1 | `lib/.../patient_local_datasource.dart:190` | `_rebuildWithUuidKey` descarta uma linha na v2→v3 (`legacyRows` → `legacyRows.skip(1)`) | `local_datasource_migration_test.dart` | ✅ Morto — `Expected: length of <2> / Actual: [1 CarbEntry]` (`:225`) |
| 2 | `lib/.../patient_local_datasource.dart:192` | mesmo UUID reutilizado em todas as linhas migradas | `local_datasource_migration_test.dart` | ✅ Morto — 2 testes IDENT-05 falham |
| 3 | `lib/.../patient_sync_service.dart:149-152` | drenagem segue para a próxima op depois de uma falha, em vez de parar | `patient_sync_service_test.dart` | ✅ Morto — 5 falhas, entre elas SYNC-03/SYNC-04 e o teste de 401 |
| 4 | `lib/.../patient_local_datasource.dart:343-344` | `_writeWithOp` grava a linha **sem** enfileirar a op | `pending_ops_test.dart`, `patient_repository_items_test.dart`, `patient_sync_service_test.dart` | ✅ Morto — 28 falhas |
| 5 | `lib/.../patient_remote_datasource.dart:147-155` | 404 no DELETE deixa de ser sucesso e propaga como falha | `remote_patient_datasource_test.dart` | ✅ Morto — 2 falhas (os dois testes de 404 no delete) |
| 6 | `backend/src/repositories/carbRepository.ts:100, 111` | `patientId` retirado do `where` de `update` e `remove` | `npm test` | ✅ Morto — 146 testes, **4 falhas** (os pares cross-patient de rota e de repositório) |
| 7 | `backend/src/services/pagination.ts:41` | `parsePageQuery` aceita `limit` acima do máximo (`parsed > MAX_PAGE_LIMIT` removido) | `npm test` | ✅ Morto — 2 falhas (carbs e insulin, ambos com `limit: 501`) |
| 8 | `lib/core/theme/app_theme.dart:63` | `AppTheme.dark()` devolve a paleta **clara** | suítes de tema (`test/core/theme/`, `patient_dark_theme`, `auth_dark_theme`, `settings_theme_selector`) | ✅ Morto — 19 falhas |
| 9 | `lib/.../patient_local_datasource.dart:270` | `deleteOp` apaga a fila inteira em vez da op do `seq` | `test/features/patient/` completo | ✅ Morto — 3 falhas |
| 10 | `lib/.../patient_local_datasource.dart:495` | reconciliação ignora o conjunto de ids pendentes (servidor sobrescreve o pendente) | `patient_repository_items_test.dart` | ✅ Morto — 3 falhas (IDENT-07) |
| 11 | `lib/.../domain/entities/entry_id.dart:19` | `entryIdFrom` devolve o candidato cru, aceitando id malformado | `patient_entry_identity_test.dart`, `remote_patient_datasource_test.dart` | ✅ Morto — 6 falhas |

**Resultado: 11/11 mortos.** Nenhum sobrevivente, logo nenhuma tarefa de correção por asserção fraca.

**Achado colateral da mutação 7 (não é gap).** Só 2 das 3 suítes de rota mataram o mutante do limite superior. A causa é boa, não má: `alerts.test.ts:119` usa `limit: 0` e carbs/insulin usam `limit: 501` — as duas bordas do intervalo estão asseridas, em suítes diferentes. Cobertura complementar, não buraco.

**Verificação de isolamento (pós-sensor).** `git status --porcelain` na árvore real, depois de remover o worktree:

```
 M .claude/settings.local.json
 M .specs/features/checklist-tcc-compliance/spec.md
 M .specs/features/checklist-tcc-compliance/tasks.md
 M CHANGELOG.md
 D "TCC I - Checklist - Avaliacao.md"
?? .agents/
?? .cursor/
?? .windsurf/
```

**Idêntico ao baseline pré-sensor**, e `git rev-parse HEAD` segue `94a2afb…`. Nenhuma mutação vazou. (Os dois arquivos de tema que apareciam como untracked no snapshot inicial da sessão — `theme_cubit.dart` e `theme_preference_store.dart` — estão commitados em `8baddaa`/`20045bc`, por isso não constam mais; é a diferença esperada, não contaminação.)

---

## Pontos registrados

### Gap 1 (🟡 não bloqueante) — SYNC-07 sem teste direto

A AC pede: "WHEN o usuário edita uma entrada enquanto um push está em andamento THEN the system SHALL manter a nova pendência enfileirada após o término do push." Procurei por `SYNC-07`, por concorrência (`Future.wait`, `unawaited`, "durante o push", "em voo") em `test/` inteiro: **nenhum teste executa uma escrita concorrente a um push em voo.** Evidência-ou-zero: a AC não está coberta.

O que atenua, e por que não bloqueia:

- **O mecanismo está certo e eu o li.** `pushNow()` serializa os pushes numa cadeia de `Future` (`patient_sync_service.dart:75-79`), e a drenagem remove **por `seq` individual** (`:151`), nunca por lote nem por entidade. Uma op enfileirada durante o push recebe um `seq` maior (`AUTOINCREMENT`, `patient_local_datasource.dart:131`) e simplesmente não está no lote lido em `:145`. Não há caminho pelo qual ela seja apagada.
- **A classe de falha está discriminada.** A mutação 9 é exatamente o fault que quebraria SYNC-07 — trocar a remoção por `seq` por uma limpeza da fila inteira — e morreu em 3 testes. Ou seja: se alguém regredir esse mecanismo, a suíte grita; só não grita citando SYNC-07.

Custa cobertura nominal, não integridade. Um teste que dispara `pushNow()` sem `await`, faz `upsertCarb` no meio e assere que a op sobrevive fecharia isso em poucas linhas.

### Gap 2 (🟡 não bloqueante) — THEME-03 meio coberto e o caso de borda do tema do SO

`theme_cubit_test.dart:81` prova que a preferência **permanece** em `ThemeMode.system` quando nada foi gravado. Não prova a outra metade — que, nesse estado, o app siga o tema do SO. E o caso de borda declarado na spec ("o tema do sistema muda com o app aberto e a preferência está em `system`") não tem teste algum: nenhum teste toca `platformBrightnessTestValue`.

A entrega delega a `MaterialApp(themeMode:)` em `lib/app.dart:107`, com `theme:`/`darkTheme:` corretamente populados — comportamento do framework Flutter, não código da feature. É defensável, e por isso não bloqueia. Mas é testável em três linhas com `tester.platformDispatcher.platformBrightnessTestValue`, e enquanto não for, a AC vale por leitura.

### Gap 3 (⚪ cosmético) — PLAN-04 e a cláusula "no mesmo commit"

A AC diz: "WHEN um contrato de canal, de API ou de modelo muda nesta iteração THEN the system SHALL atualizar o documento correspondente em `docs/reference/` **no mesmo commit**." Rastreei quem tocou `docs/reference/`:

```
edeebb0 docs: update the channel, data-model and API contracts
  docs/reference/data-models.md
  docs/reference/platform-channels.md
```

Um único commit no fim, separado dos commits que de fato mudaram os contratos: `bf66a4c`/`f3c5d71` (canal — remoção do transmissor), `e47ac89`/`ed1777c` (API — paginação e verbos unitários de alerta), `8e9ee64`/`3375943` (modelo — `id` nas entradas de diário). **O conteúdo está completo e correto** (conferi `data-models.md:26, 38, 48` contra as rotas reais); só a cláusula temporal foi violada. Desvio de processo, custo zero para quem lê a documentação hoje.

### Nota 1 — QUAL-04 vale por inspeção, sem guarda de regressão

Os três índices existem e casam com a consulta (`schema.prisma:246, 258, 271` × `carbRepository.ts:68-71`). A AC é declarativa e está satisfeita pela declaração. Só observo a assimetria: DEAD-02, que também é uma AC estrutural, ganhou um teste que varre a árvore (`dead_code_pruning_test.dart:14`); QUAL-04 ficou por documentação. Apagar um `@@index` hoje não quebra nenhum gate — a paginação continuaria correta, só lenta.

### Nota 2 — caso de borda de paginação sem o par em carbs

`before` anterior à entrada mais antiga tem teste em `alerts.test.ts:107` e `insulin.test.ts:106`, não em `carbs.test.ts`. As três rotas compartilham `parsePageQuery` e o mesmo formato de `findPage`, então o risco real é nulo; é assimetria de suíte.

### Nota 3 — `AppTheme` guarda 27 constantes de cor que `lib/` não usa mais

`lib/core/theme/app_theme.dart:8-48` ainda declara as constantes estáticas. Nenhum código de `lib/` as referencia (confirmado acima); o único consumidor é `test/core/theme/glucore_colors_test.dart:54`, que assere que a instância clara reproduz cada constante — ou seja, elas sobrevivem de propósito, como **âncora de fidelidade** da migração. É uma escolha defensável e documentada no próprio teste. Registro só porque convive com uma story de remoção de código morto: quem passar por ali depois pode achar que são sobra.

### Nota 4 — o corte de 100 em alertas, e por que não é o truncamento que a spec matou

`patient_repository_impl.dart:64` (`saveAlerts`) e `patient_cubit.dart:277` (`_prependAlert`) ainda aplicam `take(PatientRepository.maxAlerts)` = 100. Investiguei antes de chamar de gap, e não é:

- O diário do paciente — carboidrato e insulina — **não** é mais truncado: `patient_repository_impl.dart:73-84` grava a lista inteira, com o comentário explicando o motivo, e `patient_repository_items_test.dart:164/178` assere 150 entradas gravadas inteiras.
- O corte que resta é sobre **alertas gerados pelo próprio app** (limiar de glicemia, reconexão, falha de sync), não entradas escritas pelo paciente. É uma janela rolante de exibição: `_prependAlert` limita a lista em memória, mas as linhas continuam no SQLite (escritas por `upsertAlert`), e `patient_cubit.dart:36` e `:62` recarregam o snapshot **sem** truncar. Reabrir o app devolve tudo.

A afirmação dos autores de que "o diário local não é mais truncado em 100 entradas" é, portanto, **verdadeira** no sentido que a spec cobra.

---

## Qualidade de código

| Princípio | Status | Base |
| --- | --- | --- |
| Código mínimo | ✅ | Os casos de uso são de uma linha; nenhuma abstração especulativa. `PendingOp` guarda `entity`/`op` como texto cru de propósito, com o motivo escrito em `pending_op.dart:20-24` |
| Mudanças cirúrgicas | ✅ | A camada de backend parou onde a spec mandou: `auth`, `readings` e `settings` intocados (conferido — só `carbs.ts`, `insulin.ts`, `alerts.ts` mudaram de forma) |
| Sem scope creep | ✅ | Nada do "Out of Scope" apareceu: nenhum mock de sensor, nenhuma migration destrutiva nas tabelas aspiracionais, `readings`/`settings` continuam no caminho de coleção |
| Casa com os padrões existentes | ✅ | `domain/entities` + `domain/repositories` + `domain/usecases` replica `lib/features/auth/domain/`, como a spec previu |
| Checagem ancorada na spec (valor asserido = desfecho da spec) | ✅ | Aplicado AC a AC nas tabelas acima; 3 pontos registrados, nenhum "existe asserção, logo passa" |
| Expectativa de cobertura por camada | ✅ | Domínio 1:1 com as ACs; rotas com happy + borda + erro (incluindo 500 de falha do repositório e 401 de auth) nas três coleções |
| Todo teste mapeia a um requisito — sem teste órfão | ✅ | Suítes nomeadas pelo ID (`SYNC-02/SYNC-09: …`); as poucas sem ID (`P19: troca de conta esvazia a fila`) mapeiam a requisitos de features anteriores, declaradamente |
| Diretriz documentada seguida | ✅ | `docs/guides/qa-process.md` — os quatro gates dela foram executados nesta rodada |

---

## Traceability

Os 47 requisitos passam de `Implementing` para `Verified`, com as três ressalvas anotadas:

| Requisito | Novo status |
| --- | --- |
| IDENT-01..07 | ✅ Verified |
| SYNC-01..06, SYNC-08..10 | ✅ Verified |
| SYNC-07 | ✅ Verified com ressalva — mecanismo verificado por leitura e discriminado pela mutação 9; sem teste direto (Gap 1) |
| API-01..06 | ✅ Verified |
| QUAL-01..03, QUAL-05 | ✅ Verified |
| QUAL-04 | ✅ Verified por inspeção — sem guarda de regressão (Nota 1) |
| DOMAIN-01..04 | ✅ Verified |
| THEME-01, THEME-02, THEME-04, THEME-05 | ✅ Verified |
| THEME-03 | ✅ Verified com ressalva — metade "segue o SO" sem asserção (Gap 2) |
| DEAD-01..06 | ✅ Verified |
| PLAN-01..03 | ✅ Verified |
| PLAN-04 | ✅ Verified com ressalva — conteúdo correto, cláusula "no mesmo commit" não honrada (Gap 3) |

---

## Sumário

**Geral: ✅ Pronto.**

**Checagem ancorada na spec**: 44/47 ACs com evidência direta que casa com o desfecho definido; 1 sem evidência direta (SYNC-07), 1 meio coberto (THEME-03), 1 desvio de processo (PLAN-04).
**Sensor**: 11/11 mutantes mortos, tier P0-full.
**Gates**: analyze limpo · 340 Flutter · 146 backend (tsc limpo) · 34 Android · 100,00% de linhas nos doze módulos novos do backend.

**O que funciona, verificado e não relatado:** duas entradas no mesmo milissegundo sobrevivem e são editáveis de forma independente; mudar o horário não muda a identidade; a migração v2→v3 preserva o diário e, se falhar no meio, deixa o banco na v2 sem perder linha; uma edição vira uma requisição unitária e a drenagem para na primeira falha recuperável preservando a ordem; 401 interrompe o push sem tocar na fila; 404 no delete conta como sucesso; uma conta nova não empurra as operações do dono anterior; o histórico pagina até o fim e o cliente não corta mais o diário; o tema alterna em tempo real, persiste entre execuções e preserva os matizes clínicos; os três stubs JNI sumiram do binário e as quatro `external fun` restantes casam 1:1 com os símbolos exportados.

**Pendências registradas (nenhuma bloqueante):**
1. SYNC-07 sem teste direto — fechável com um teste de escrita concorrente a um `pushNow()` não aguardado.
2. THEME-03 e o caso de borda do tema do SO — fecháveis com `platformBrightnessTestValue`.
3. PLAN-04 — cláusula "no mesmo commit"; conteúdo já correto, nada a corrigir no produto.

**Próximo passo:** nada bloqueia o fechamento da feature. As três pendências cabem como tarefas de acabamento numa próxima iteração, e a verificação em device físico arm64 com sensor real segue pendente pelo mesmo motivo das Fases 1–2 (hardware indisponível), como a própria spec declara em Out of Scope.
