# Verificação independente — `arch-phases-0-2-gaps`

Duas rodadas. A rodada 1 reprovou; o fix round foi aplicado em `b8ecf9a`; a rodada 2 aprova. O registro da rodada 1 fica preservado abaixo para rastreabilidade, no mesmo formato do relatório da feature `checklist-tcc-compliance`.

| Rodada | HEAD | Range | Veredito |
| --- | --- | --- | --- |
| 1 | `34802b5` | `7b09e5f..34802b5` (9 commits) | **FAIL** — 1 gap bloqueante, 3 não bloqueantes |
| 2 | `b8ecf9a` | `7b09e5f..b8ecf9a` (10 commits) | **PASS** — 0 bloqueantes, 2 residuais registrados |

**Result**: PASS — veredito vigente, rodada 2, HEAD `b8ecf9a`. (Linha de veredito legível por `validate_state.py`; o registro da rodada 1 abaixo é histórico.)

---

# Rodada 2 — 2026-08-20 — **PASS**

Autor ≠ verificador. Regra aplicada: **evidência-ou-zero**. Tudo abaixo foi re-derivado por execução própria nesta rodada — nenhum item foi aceito pelo relato do fix round. Árvore real read-only; mutações em `git worktree --detach` fora do repo.

| Campo | Valor |
| --- | --- |
| Branch | `feat/arch-phases-0-2-gaps` |
| HEAD verificado | `b8ecf9a7d2ccb99143c674aa344899da9b54bd1e` |
| Commit do fix round | `b8ecf9a` — `fix(docs): undo the review paste error and correct the JNI stub inventory` |
| Superfície do fix round | 5 arquivos, +23/−21 linhas — `CLAUDE.md`, `docs/ARCHITECTURE_REVIEW.md`, `docs/README.md`, `docs/reference/multi-sensor-architecture.md`, `docs/reference/native-stubs.md`. **Nenhum arquivo de código ou de teste foi tocado** (`git diff --stat 34802b5 b8ecf9a`) |

**Por que PASS:** os três gaps que exigiam correção foram fechados e reconferidos por execução; os 5 gates seguem verdes com as mesmas contagens; o sensor de discriminação repetiu 4/4 mutantes mortos. Sobram dois pontos registrados — um resíduo de fidelidade no sumário do review e o risco de log sem teste que o coordenador aceitou conscientemente —, nenhum deles capaz de deixar uma leitura falsa chegar ao paciente nem de marcar trabalho aberto como fechado.

## Reconferência dos gaps da rodada 1

### Gap 1 (🔴 bloqueante) — parágrafo de P16 colado em P2, P5 e P11 → **CORRIGIDO**

Os três itens pedidos pelo coordenador, verificados um a um:

| Item | Como conferi | Resultado |
| --- | --- | --- |
| (a) só duas marcas `Resolvido (2026-08-20)`, uma em P6 e uma em P16 | `grep -n "Resolvido (2026-08-20)" docs/ARCHITECTURE_REVIEW.md` → exatamente **2 ocorrências**: `:54` e `:106`. Confrontado com os cabeçalhos: P6 ocupa `52-61` e P16 ocupa `104-117`, logo `:54` está dentro de P6 e `:106` dentro de P16 | ✅ confirmado |
| (b) P2, P5 e P11 textualmente idênticos a `7b09e5f` | Script que extrai cada seção `### … Pn —` até o próximo `### ` em `git show 7b09e5f:docs/ARCHITECTURE_REVIEW.md` e no arquivo atual, e faz `difflib.unified_diff`. Resultado: **a única diferença nas três seções é 1 linha em branco a mais** (1910→1911, 945→946, 924→925 caracteres). Nenhuma palavra alterada; o status voltou a ser `**🟡 Parcial (2026-07-07):**` nas três, com "Solução proposta" intacta | ✅ confirmado (com nota) |
| (c) sumário do topo não ficou contraditório | `sed -n '5p'` → o sumário **continua** dizendo "**4 parciais** (P2, P5, P11, P16) e **4 abertos** (P4, P6, P12, P13)" | ❌ **não confirmado** — ver Resíduo 1 |

Nota sobre (b): a linha em branco extra é o espaço onde o parágrafo colado estava. Em P2 ela separa o bloco `Local/Descrição/Impacto` do bloco de status, virando dois parágrafos onde antes havia um. Efeito puramente cosmético de renderização; nenhuma afirmação mudou. Não é gap.

Evidência de que o conteúdo restaurado é o correto: P2 volta a dizer "**o app continua usando exclusivamente o replace-all em lote** (`patient_remote_datasource.dart:73-86`). O risco multi-device permanece integral"; P5 volta a dizer "Permanece a mentira no auth"; P11 volta a dizer "Rate-limit em `/auth/login`/forgot-password continua ausente". Os três são de novo status parcial, como eram antes da feature.

O parágrafo de P16 (`:106`) ganhou duas mudanças na reescrita, ambas conferidas: a âncora `SibionicsBleManager.kt:259-264` virou `:258-264` (correção do Gap 4) e foi acrescentada a frase "as quatro mutações do sensor de discriminação … são todas mortas por teste". **Essa nova afirmação foi verificada por execução própria** nesta rodada — ver a seção do sensor: 4/4 mortas, confere.

### Gap 2 (🟡) — stubs e diretório inexistentes citados como existentes → **CORRIGIDO**

Conferido contra `android/app/src/main/java/tk/glucodata/`, que contém exatamente: `Applic.java`, `EverSense.java`, `GlucoseCurve.java`, `Libreview.java`, `MessageSender.java`, `Natives.java`.

| Afirmação nova | Verificação | Resultado |
| --- | --- | --- |
| `CLAUDE.md:94-98` lista 5 stubs presentes no APK: `GlucoseCurve`, `Applic`, `EverSense`, `Libreview`, `MessageSender` | Casa 1:1 com os 5 `.java` de stub do diretório. `Natives.java` corretamente **não** aparece na lista (não é stub; `native-stubs.md` o trata em seção própria) | ✅ |
| `CLAUDE.md:100` — Juggluco declara mais três (`strGlucose`, `nums.item`, `NightPost`) que este app **não** embarca | `grep -rl "class strGlucose" android/` → nada; `grep -rl "class NightPost" android/` → nada; `ls android/app/src/main/java/tk/glucodata/nums` → não existe | ✅ |
| `CLAUDE.md:145` / `docs/README.md:37` / `native-stubs.md` — `Juggluco/` **não está neste working tree**, nunca commitado | `ls -d Juggluco` → não existe; `git ls-files \| grep -c "^Juggluco/"` → **0** | ✅ |
| `native-stubs.md` separa "Presentes no APK hoje" (5) de "Declaradas pelo Juggluco e ausentes aqui" (3), preservando os layouts de campo dos 3 ausentes | Leitura do arquivo: duas tabelas, os 3 ausentes mantêm `strGlucose` (6 campos), `nums.item` (4 campos), `NightPost` (—) | ✅ |

Ganho extra sobre o pedido: `CLAUDE.md:100` agora instrui a **ler o nome que falta no log** em vez de tratar a lista como exaustiva — isso remove a afirmação falsa sem introduzir uma nova (o app pode de fato precisar de um stub novo num caminho ainda não exercitado). É a redação mais honesta possível sem device.

### Gap 3 (🟡) — os dois `Log.w` sem teste → **ACEITO, NÃO CORRIGIDO** (registrado como risco conhecido)

Decisão do coordenador, coerente com a Test Coverage Matrix da `tasks.md`, que classifica `*BleManager` como "Kotlin acoplado ao Android → nenhum teste, build gate apenas", justificada pela ausência de Robolectric e de testes instrumentados no projeto.

Fato reconfirmado nesta rodada: apagar `SibionicsBleManager.kt:283` (log de descarte) e `:258-264` (log de fallback) deixa os 34 testes verdes. As duas ACs que exigem literalmente "SHALL registrar um log" (ARCH-04 AC1, ARCH-06 AC4) continuam cobertas **por leitura, não por asserção**.

Risco conhecido, com o impacto delimitado: o que protege o paciente é o *descarte*, e esse está discriminado por teste (mutação b morre). O log é diagnóstico de campo — perdê-lo silenciosamente custa observabilidade, não segurança clínica. Se um dia entrar Robolectric, ou se o decoder passar a receber um `logger: (String) -> Unit` injetado, isso vira testável sem redesenho.

### Gap 4 (⚪) — âncoras off-by-one → **CORRIGIDO**

| Âncora corrigida | Conteúdo real (`sed -n`) | Resultado |
| --- | --- | --- |
| `multi-sensor-architecture.md` → `LibreNfcHandler.kt:19` (era `:18`) | `class LibreNfcHandler(` | ✅ |
| `multi-sensor-architecture.md` → `SensorBrand.kt:12-27` (era `:11-27`) | `:12` = `enum class SensorBrand(val wireName: String, val libreVersionCode: Int?) {`, `:27` = `}` de fechamento | ✅ |
| `multi-sensor-architecture.md` → `SensorCore.kt:37-47` (era `:35-47`) | `:37` = `private fun bleManagerFor(brand: SensorBrand): BrandBleManager? =`, `:47` = fecha o `when` | ✅ |
| `ARCHITECTURE_REVIEW.md:106` → `SibionicsBleManager.kt:258-264` (era `:259-264`) | `:258` = `if (normalized.usedFallback) {`, `:264` = `}` — o bloco inteiro do `Log.w` | ✅ |

Varredura completa de regressão: script que resolve as **36 referências** `arquivo:linha` do doc multissensor (incluindo as `:N` abreviadas que herdam o último arquivo nomeado) → **0 arquivos inexistentes, 0 linhas fora de faixa**.

Observação mantida da rodada 1, não corrigida e não exigida: a frase "0x40 = Dexcom, 3 = Libre 3" reproduz o KDoc de `SensorBrand.kt:8-10`; o `enum` tem só `SIBIONICS/ACCUCHEK/LIBRE2` e `fromLibreVersion` não ramifica para esses dois códigos. Fiel à fonte citada, mas um leitor apressado pode achar que o `enum` os trata.

## Evidência por AC — rodada 2

Todas as ACs foram reconferidas por execução nesta rodada. `✅` = asserção de teste com `arquivo:linha`; `📄` = evidência documental verificada por `grep`/script/`git cat-file`, não por leitura do relato do autor.

| Req | AC | Evidência re-executada em `b8ecf9a` | Status |
| --- | --- | --- | --- |
| ARCH-01 | Persistência local-first nomeando `LocalPatientDataSource`, `PatientSyncService`, `refreshFromRemote` | `CLAUDE.md:44` (writes locally first), `:45` (`refreshFromRemote()`), `:46` (`LocalPatientDataSource`, sqflite), `:48` (`PatientSyncService`, debounce ~2 s) — inalterados por `b8ecf9a`. Código: `patient_local_datasource.dart:22` (`glucore_patient.db`), `:47` (coluna `synced`), `patient_sync_service.dart:25` (`Duration(seconds: 2)`), `patient_repository.dart:83` (`refreshFromRemote`) | 📄 |
| ARCH-02 | Mapa Android multimarca | `CLAUDE.md:74-85`; as 14 classes citadas existem em `android/app/src/main/kotlin/com/berdegeus/glucore/` | 📄 |
| ARCH-03 | Detalhe volátil vira ponteiro; invariantes nativas preservadas | Regra em `CLAUDE.md:15`; ponteiros em `:13`, `:68`, `:87`, `:100` (novo, para `native-stubs.md`). Invariantes: `:106` (SIGSEGV), `:108` (JNI), `:110` (arm64), `:112` (layout `getlastGlucose`, faixa 400..6000), `:94-100` (stubs, agora com inventário correto) | 📄 |
| ARCH-04 | Descarte de `< 0x10000` no caminho direto, com log | Gate `SibionicsGlucoseDecoder.kt:80-82` (const em `:33`). Asserções: `Test.kt:201-208` (`1043` → `assertNull`), `:191-198` (`4` → `assertNull`). Log em `SibionicsBleManager.kt:283`. Mutação (b) morre | ✅ ⚠️ log sem teste |
| ARCH-05 | Bits 56–63 sujos rejeitados; faixa 400..6000 preservada | Gate `SibionicsGlucoseDecoder.kt:51-53`; asserção `Test.kt:160-172`. Faixa: `:28-29` + `:58-60`; asserções `Test.kt:36-45` (400→40.0), `:47-57` (6000→600.0), `:59-68` (399→null), `:70-79` (6001→null), `:174-186`. Mutações (a) e (d) morrem | ✅ |
| ARCH-06 | Log do fallback de timestamp; decoder puro | `normalizeTimestamp` em `:96-101`; asserções `Test.kt:142-156` (`true` para `null`/`0`/`-5`) e `:104-124` (`false` para s e ms). Log em `SibionicsBleManager.kt:258-264`. Pureza: `grep -n "^import"` no decoder → **nenhum import**. Mutação (c) morre | ✅ ⚠️ log sem teste |
| ARCH-07 | Todas as rotas com exemplo real e contrato de erro | Script re-executado: **24 handlers extraídos de `backend/src/routes/*.ts`, 24 casados no README, 0 faltando**. Códigos de erro: os 9 `code:` emitidos em `backend/src/` estão todos na tabela do README, mais `WEAK_PASSWORD` (via `WeakPasswordError`, coberto por teste). Rate-limit: README diz 10/15 min e 20/15 min; `auth.ts:23-29` (`limit: 10`, aplicado em `:263`, `:328`, `:370`) e `:31-37` (`limit: 20`, aplicado em `:177`) confirmam | 📄 |
| ARCH-08 | Setup, porta e variáveis de ambiente | Seção "Setup" (`npm install`, `npx prisma migrate dev`, `npm run dev`, `npm test`, porta 3001) e tabela de env (`JWT_SECRET`, `DATABASE_URL` obrigatórias; `PORT`, `CORS_ORIGIN`, `NODE_ENV`, SMTP opcionais, com efeito) | 📄 |
| ARCH-09 | Doc multissensor + referências | Doc presente; **36 âncoras resolvidas, 0 quebradas**; referenciado em `docs/README.md:20` e `CLAUDE.md:13`/`:87` | 📄 |
| ARCH-10 | Doc de QA: gates, checklist de PR, regra de migration | `docs/guides/qa-process.md`: tabela dos 5 gates com "quando roda"; checklist item 3 ("Mudou camada ou fluxo? Atualizou `CLAUDE.md` e/ou `docs/`") e item 4 (migration no mesmo PR); linkado em `docs/README.md:17` | 📄 |
| ARCH-11 | Caso real rastreável por commit | `git cat-file -e <h>^{commit}` para os 6 hashes → **todos existem**, e as mensagens no doc batem com as reais: `19d67ed`, `ea7d107`, `12f98b8`, `b2da51f`, `0174cc0`, `19dd86e` | 📄 |
| ARCH-12 | Review e plano fiéis: P6/P16 resolvidos com `arquivo:linha`, 2.4 cortado, device pendente | P6 em `:54` cita `CLAUDE.md:44-48`, `:74-85`, `:15` — **os três conferem**. P16 em `:106` cita `SibionicsGlucoseDecoder.kt:51`, `:79-84`, `:97-98` e `SibionicsBleManager.kt:278-284`, `:258-264` — **todos conferem** (`:51` = gate de bits altos, `:79` = `fun decodeUnsolicited`, `:97-98` = os dois `usedFallback = true`, `:278` = chamada a `decodeUnsolicited`, `:258-264` = bloco do `Log.w`). Histórico preservado em `:56` e `:108`. Plano: 2.4 marcado ⛔ com motivo e condição de retomada, citando `.gitignore:58` = `/android/app/src/main/jniLibs/**/*.so` (confere); Fases 1 e 2 com `⬜ pendente de device físico` | 📄 ⚠️ sumário estagnado |

## Sensor de discriminação — rodada 2

Ambiente: `git worktree add --detach <scratch> HEAD` (cópia isolada fora do repo, `b8ecf9a`), com `gradlew` + wrapper, `local.properties`, `flutter pub get` e `jniLibs/arm64-v8a` copiados. Baseline no worktree: **BUILD SUCCESSFUL**. `git stash` não foi usado em momento algum.

| # | Mutação em `SibionicsGlucoseDecoder.kt` | R1 | R2 | Teste que morreu (R2) |
| --- | --- | --- | --- | --- |
| a | Remover `if ((packedReading ushr 56) != 0L) return null` | ☠️ | ☠️ **Morreu** | `decodePacked_rejectsPayloadWithNonZeroHighBits` |
| b | `MIN_UNSOLICITED_PACKED` `0x10000L` → `0L` | ☠️ | ☠️ **Morreu** | `decodeUnsolicited_discardsBareGlucosePayloadWithoutRateOrAlarmBits` |
| c | `usedFallback = true` → `false` (2 ocorrências) | ☠️ | ☠️ **Morreu** | `normalizeTimestamp_flagsFallbackForNullZeroAndNegative` |
| d | `MIN_GLUCOSE_TENTHS = 0L`, `MAX_GLUCOSE_TENTHS = 100_000L` | ☠️ | ☠️ **Morreu** (3 testes) | `decodeUnsolicited_stillRejectsImplausibleGlucoseAboveTheBitThreshold`, `decodePacked_rejectsJustAboveUpperBound`, `decodePacked_rejectsJustBelowLowerBound` |

**Resultado: 4/4 mortos, nenhum sobrevivente.** Restauração do arquivo original ao fim → **BUILD SUCCESSFUL**, confirmando que os óbitos vieram das mutações e não de contaminação do worktree.

Isso valida por execução própria a nova afirmação inserida em `ARCHITECTURE_REVIEW.md:106` ("as quatro mutações do sensor de discriminação … são todas mortas por teste").

Observação de rodada 1 **reconfirmada**: na mutação (b) morre um único teste. `decodeUnsolicited_discardsProtocolCode` (valor `4`) **sobrevive**, porque `4` já é barrado pela faixa 400..6000. Ver a recomendação de spec abaixo.

Limpeza: `git worktree remove --force` + `git worktree prune` executados; `git worktree list` mostra apenas a árvore principal; diretório de scratch apagado.

## Gates — rodada 2 (árvore real, `b8ecf9a`)

| Gate | Comando | Resultado | R1 | Base | Δ vs base |
| --- | --- | --- | --- | --- | --- |
| Kotlin | `cd android && JAVA_HOME=… ./gradlew :app:testDebugUnitTest --rerun-tasks` | **BUILD SUCCESSFUL**, 174 tasks executadas · **34 testes**, 0 falhas, 0 erros, **0 pulados** | 34 | 27 | **+7** |
| Kotlin (por suíte) | XML de `build/app/test-results/testDebugUnitTest/` | `AccuChekProtocolTest` 4 · `Libre2PacketAssemblerTest` 5 · `LibreNfcProtocolTest` 5 · `SensorBrandTest` 3 · `SibionicsGlucoseDecoderTest` **17** | idem | 4/5/5/3/10 | +7 no decoder |
| Flutter (análise) | `flutter analyze` | **No issues found!** (13,5 s) | limpo | limpo | 0 |
| Flutter (testes) | `flutter test --no-pub` | **All tests passed!** — **177** testes | 177 | 177 | 0 |
| Backend (tipos) | `cd backend && npx tsc --noEmit` | `TSC_EXIT=0`, sem diagnóstico | limpo | limpo | 0 |
| Backend (testes) | `cd backend && npm test` | `tests 43 · suites 12 · pass 43 · fail 0 · cancelled 0 · **skipped 0** · todo 0` | 43 | 43 | 0 |

Nenhuma contagem caiu entre a rodada 1 e a 2, e nenhuma caiu em relação à linha de base. Nenhum teste apagado, pulado ou marcado `@Ignore`/`skip`. Coerente com o fato de `b8ecf9a` não tocar em nenhum `.kt`, `.dart` ou `.ts` — o que também explica por que os números são idênticos aos da rodada 1.

Higiene de versionamento (T8) reconferida: `git ls-files docs/ | grep '~\$'` → vazio; `docs/TCC_Acompanhamento_Bernardo_Eduardo.xlsx` segue versionado; `.gitignore:72` = `~$*`.

## Resíduos registrados (nenhum bloqueante)

### Resíduo 1 — 🟡 O sumário do `ARCHITECTURE_REVIEW.md` não acompanhou o corpo

**Onde:** `docs/ARCHITECTURE_REVIEW.md:5`.

**O quê:** o sumário continua declarando "**8 resolvidos** (P1, P3, P7, P8, P9, P10, P14, P15), **4 parciais** (P2, P5, P11, P16) e **4 abertos** (P4, P6, P12, P13)". O corpo, corretamente, marca **P6** como resolvido (`:54`) e **P16** como resolvido (`:106`). Ou seja: quem lê só o sumário conclui que P6 segue aberto e P16 segue parcial, exatamente o trabalho que esta feature entregou.

**Por que não bloqueia:** o erro é conservador — subdeclara progresso em vez de declarar trabalho aberto como fechado, que era o defeito perigoso da rodada 1. As três ACs de ARCH-12 falam do estado dos itens P6 e P16 no review, e essas estão cumpridas com evidência `arquivo:linha` conferida. O custo máximo é releitura redundante, não trabalho pulado.

**Por que fica registrado:** contraria o Goal 4 da spec ("deixar `ARCHITECTURE_REVIEW.md` e `ARCHITECTURE_FIX_PLAN.md` fiéis ao estado real ao fim do trabalho") e foi apontado na rodada 1 como agravante do Gap 1. A correção é uma linha: passar para "**10 resolvidos** (… P6, P16), **3 parciais** (P2, P5, P11) e **3 abertos** (P4, P12, P13)".

### Resíduo 2 — 🟡 Os dois `Log.w` exigidos textualmente por AC continuam sem discriminador

Aceito conscientemente pelo coordenador; ver Gap 3 acima. Registrado aqui como risco conhecido, não como pendência: `SibionicsBleManager.kt:283` e `:258-264` podem ser removidos sem quebrar nenhum dos 34 testes. A Test Coverage Matrix cobre a decisão; a AC pede "SHALL registrar um log" e a evidência é por leitura.

### Trivialidade (não é gap)

`docs/README.md:21` ainda descreve `native-stubs.md` como "Classes stub **exigidas** por `libg.so`". Depois do split entre "presentes" e "declaradas e ausentes", o verbo ficou frouxo. O documento apontado está correto; só o rótulo de índice envelheceu.

## Resposta à pergunta sobre a imprecisão da spec

**Sim, isso deve virar correção de spec** — pontual, no Independent Test da história "P1: Leitura implausível não chega ao Flutter", não nas ACs.

A AC1 está certa e não é ambígua: "IF o valor bruto entregue pelo caminho de código desconhecido do `SIprocessData` for menor que `0x10000` THEN o app SHALL descartar o valor". O defeito está na linha de verificação, que diz que `./gradlew :app:testDebugUnitTest` cobre "valor `4` (código de protocolo) descartado no caminho direto" e apresenta esse caso como a prova do gate.

Ele não prova. `4` também é rejeitado pela faixa 400..6000 dentro de `decodePacked`, então o teste `decodeUnsolicited_discardsProtocolCode` passa igual com o gate `0x10000` **removido** — confirmado nas duas rodadas: na mutação (b), esse teste sobrevive. Um verificador futuro que tomasse o Independent Test ao pé da letra aprovaria um build sem o gate. Quem discrimina é `decodeUnsolicited_discardsBareGlucosePayloadWithoutRateOrAlarmBits`, com `1043` — um valor **dentro** da faixa plausível e **sem** bits de rate/alarm, que é o único ponto onde o gate é a única coisa em pé entre o código de protocolo e uma glicemia falsa. O autor acrescentou esse teste por conta própria; a spec não o pedia.

Correção recomendada (não bloqueia o PASS, e não muda comportamento):

- Manter `4` no Independent Test como regressão de código de protocolo.
- **Acrescentar** o caso discriminante: "valor `1043` (payload de glicose plausível, sem bits de rate/alarm) descartado no caminho direto — este é o caso que morre se o gate `0x10000` for removido".
- Registrar a lição na camada de lessons: **um caso de teste só vale como prova de um gate se o valor escolhido não for barrado por outro gate a montante.** É a mesma lição da rodada 1 da feature `checklist-tcc-compliance` ("teste verde não é teste que discrimina"), agora numa variante mais sutil: o teste era verde, era relevante, e ainda assim não media a regra que dizia medir.

Uma segunda fragilidade da suíte, menor e sem AC associada: não há teste que exercite bits altos sujos **através** de `decodeUnsolicited`; a cobertura vem por delegação a `decodePacked` (`SibionicsGlucoseDecoder.kt:83-87`). Uma refatoração que trocasse a delegação por decodificação inline não seria pega. Uma linha de teste resolveria, se alguém quiser fechar isso.

## O que está sólido (para não ser reaberto sem motivo)

- **P16 bem discriminado**: 4/4 mutações de comportamento morrem, com teste nominal para cada uma, em duas rodadas independentes. O decoder é puro (zero imports), como a spec exigia.
- **Backend documentado de verdade**: 24/24 handlers no README; 4 rotas amostradas na rodada 1 (`POST /readings`, `PUT /carbs/item/:id`, `GET /settings/alerts`, `GET /auth/profile`) batendo campo a campo com o handler e com `schema.prisma`; limites de taxa e lista de `code` conferindo com o código.
- **Caso real de QA rastreável**: 6/6 hashes existem, mensagens conferem.
- **Cinco gates verdes** com contagens preservadas (34 / 177 / 43, `analyze` e `tsc` limpos), zero testes pulados.
- **Causa-raiz de P6 tratada**: `CLAUDE.md` deixou de ser gitignored e passou a ser versionado, então divergência agora aparece em diff de PR, com item de checklist correspondente em `docs/guides/qa-process.md`.
- **Inventário JNI honesto**: a documentação parou de afirmar que 3 classes inexistentes são obrigatórias, sem cair no erro oposto de garantir que 5 bastam para sempre.

## Nota de estado da árvore

`git status --porcelain` ao fim da rodada 2 traz, além do baseline desta sessão, `M .specs/STATE.md` — alteração **não commitada feita pelo lado do autor** enquanto esta verificação corria (acrescenta AD-006/007/008 e atualiza o Handoff). Não foi produzida por esta verificação: a única escrita autorizada e realizada aqui é este `validation.md`. `HEAD` permanece em `b8ecf9a` e nenhum arquivo rastreado da feature foi modificado pelo verificador.

---
---

# Rodada 1 — 2026-08-20 — **FAIL** (preservada para rastreabilidade)

**Veredito da época: FAIL** (1 gap bloqueante, 3 não bloqueantes)

| Campo | Valor |
| --- | --- |
| HEAD verificado | `34802b5a82f1dfe64a2c0901430d6dc4ea502e02` |
| Range do diff | `7b09e5f..34802b5` (9 commits) |

**Por que FAIL:** o código entregue estava correto e discriminado por teste (4/4 mutantes mortos, todos os gates verdes, contagens preservadas). O bloqueio era documental e grave: o commit `127d289` colou o parágrafo de resolução de **P16** dentro de **P2, P5 e P11** do `ARCHITECTURE_REVIEW.md`, marcando três problemas não resolvidos como "✅ Resolvido (2026-08-20)".

## Gaps da rodada 1

### Gap 1 — 🔴 Bloqueante · `ARCHITECTURE_REVIEW.md` marcava P2, P5 e P11 como resolvidos com evidência alheia

**Onde:** `docs/ARCHITECTURE_REVIEW.md:22` (§P2), `:49` (§P5), `:78` (§P11). Introduzido em `127d289`.

**O quê:** o parágrafo de resolução de P16 — palavra por palavra — aparecia **quatro vezes** no arquivo (`:22`, `:49`, `:78`, `:108`). Só a ocorrência em `:108` estava no item certo. Nas outras três virava o novo status do item:

- **P2** (🔴 "Sincronização replace-all") passava a constar como resolvido, enquanto o texto logo abaixo dizia "**o app continua usando exclusivamente o replace-all em lote**. O risco multi-device permanece integral".
- **P5** (🟠 "Nomes que mentem sobre a arquitetura") idem, com "Permanece a mentira no auth" logo abaixo.
- **P11** (🟡 "Segurança do backend") idem.

**Agravante:** o sumário (`:5`) continuava dizendo "**4 parciais** (P2, P5, P11, P16)", contradizendo os quatro "✅ Resolvido" do corpo.

**Status na rodada 2:** corrigido em `b8ecf9a` (parte principal). O agravante do sumário **não** foi corrigido — virou o Resíduo 1.

### Gap 2 — 🟡 `CLAUDE.md` citava dois stubs e um diretório inexistentes

**Onde:** `CLAUDE.md:96` (`tk.glucodata.nums.item`), `:101` (`tk.glucodata.NightPost`), `:103` e `:148` (`Juggluco/`).

**O quê:** o arquivo afirmava que `libg.so` aborta se qualquer um dos 8 stubs faltar no APK, mas só 5 dos 8 existiam em `android/app/src/main/java/tk/glucodata/`, e o diretório `Juggluco/` não existia no working tree nem no índice. Replicado em `docs/reference/native-stubs.md` e `docs/README.md`.

**Status na rodada 2:** corrigido em `b8ecf9a`, verificado.

### Gap 3 — 🟡 Regras exigidas em texto pelas ACs vivem em código sem teste

**Onde:** `SibionicsBleManager.kt:283` (log de descarte, ARCH-04 AC1) e `:258-264` (log de fallback, ARCH-06 AC4).

**Status na rodada 2:** aceito conscientemente pelo coordenador, com base na Test Coverage Matrix. Virou o Resíduo 2.

### Gap 4 — ⚪ Imprecisões de âncora

**Onde:** `multi-sensor-architecture.md` (`LibreNfcHandler.kt:18`, `SensorBrand.kt:11-27`, `SensorCore.kt:35-47`) e `ARCHITECTURE_REVIEW.md` (`SibionicsBleManager.kt:259-264`).

**Status na rodada 2:** as quatro corrigidas e verificadas.

## Gates da rodada 1

| Gate | Resultado | Base | Δ |
| --- | --- | --- | --- |
| Kotlin `--rerun-tasks` | BUILD SUCCESSFUL — **34** testes, 0 falhas, **0 pulados** | 27 | +7 |
| `flutter analyze` | No issues found! (11,6 s) | limpo | 0 |
| `flutter test --no-pub` | All tests passed — **177** | 177 | 0 |
| `npx tsc --noEmit` | exit 0 | limpo | 0 |
| `npm test` | tests 43 · pass 43 · fail 0 · **skipped 0** | 43 | 0 |

## Sensor da rodada 1

| # | Mutação | Resultado | Teste que morreu |
| --- | --- | --- | --- |
| a | Remover gate de bits 56–63 | ☠️ Morreu | `decodePacked_rejectsPayloadWithNonZeroHighBits` |
| b | `MIN_UNSOLICITED_PACKED` → `0L` | ☠️ Morreu | `decodeUnsolicited_discardsBareGlucosePayloadWithoutRateOrAlarmBits` |
| c | `usedFallback` sempre `false` | ☠️ Morreu | `normalizeTimestamp_flagsFallbackForNullZeroAndNegative` |
| d | Faixa alargada | ☠️ Morreu (3 testes) | `decodePacked_rejectsJustBelowLowerBound`, `decodePacked_rejectsJustAboveUpperBound`, `decodeUnsolicited_stillRejectsImplausibleGlucoseAboveTheBitThreshold` |

**4/4 mortos.** Observação levantada na rodada 1 e reconfirmada na rodada 2: o caso `4` citado pelo Independent Test da spec **sobrevive** à mutação (b) — ver a recomendação de correção de spec na rodada 2.

## Verificações documentais da rodada 1 (mantidas válidas na rodada 2)

- **24/24 handlers** de `backend/src/routes/*.ts` presentes no `backend/README.md`, por script.
- Amostragem campo a campo contra handler e `schema.prisma`: `POST /readings` (`readings.ts:36-69` ↔ `schema.prisma:181-198`), `PUT /carbs/item/:id` (`carbs.ts:105-135` ↔ `schema.prisma:243-252`), `GET /settings/alerts` (`settings.ts:14-27` ↔ `schema.prisma:200-209`), mais `GET /auth/profile` (`auth.ts:123-155`).
- Rate-limit: README (10/15 min e 20/15 min) ↔ `auth.ts:23-37`, aplicado em `:177`, `:263`, `:328`, `:370`.
- Códigos de erro: os 9 emitidos em `backend/src/` + `WEAK_PASSWORD` todos documentados.
- **6/6 hashes** do caso real de QA existem (`git cat-file -e`), com mensagens conferindo.
- `grep -rn "MockSensorRepository\|DebugPanel\|isMock\|activateMock\|PatientMockStore\|FakeSensorRepository\|SensorController" lib/` → **zero ocorrências**, confirmando a seção "Debug panel / mock sensor" do `CLAUDE.md`.
