# Fases 0–2 — lacunas remanescentes — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/arch-phases-0-2-gaps/spec.md`
**Design**: não produzido — a única decisão de arquitetura (onde mora o gate de plausibilidade) está registrada nas Assumptions da spec; o restante é documentação e ajuste local.
**Status**: In Progress
**Pré-condição de execução**: `feat/tcc-checklist-compliance` mergeada em `main` (fast-forward local) e branch `feat/arch-phases-0-2-gaps` criada a partir dela. Bloqueada enquanto `docs/TCC_Acompanhamento_Bernardo_Eduardo.xlsx` estiver aberto no Excel.

---

## Test Coverage Matrix

> Gerada a partir do código, das diretrizes do projeto e da spec — confirmar antes do Execute. Diretrizes encontradas: `CLAUDE.md` (seção Commands), `docs/guides/setup-and-build.md`, `backend/package.json` (script `test`), `android/app/src/test/` (5 suítes JUnit puras), `test/` (suítes Flutter). Não há configuração de threshold de cobertura no repositório. Linha de base medida em 2026-08-20: 27 testes Kotlin verdes (`AccuChekProtocolTest` 4, `Libre2PacketAssemblerTest` 5, `LibreNfcProtocolTest` 5, `SensorBrandTest` 3, `SibionicsGlucoseDecoderTest` 10); resultados em `build/app/test-results/testDebugUnitTest/`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Kotlin puro (decoder/protocolo, sem import Android) | unit | Todos os ramos; 1:1 com as ACs da spec; todo edge case listado tem teste | `android/app/src/test/java/com/berdegeus/glucore/*Test.kt` | `cd android && ./gradlew :app:testDebugUnitTest` |
| Kotlin acoplado ao Android (`*BleManager`, `*Service`, `MainActivity`) | none | build gate apenas — o projeto não tem Robolectric nem testes instrumentados; a regra testável foi empurrada para o Kotlin puro justamente por isso | — | build gate |
| Dart (cubits, repositories, widgets) | unit | Não tocado por estas tarefas; suíte existente roda como regressão | `test/**/*_test.dart` | `flutter test --no-pub` |
| TypeScript (backend) | unit | Não tocado por estas tarefas; suíte existente roda como regressão | `backend/tests/**/*.test.ts` | `cd backend && npm test` |
| Markdown / documentação / `.gitignore` | none | build gate + verificação por `grep` descrita no `Done when` de cada tarefa | — | build gate |

## Gate Check Commands

> Gerada a partir do código — confirmar antes do Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Depois de tarefas com teste unitário Kotlin | `cd android && JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew :app:testDebugUnitTest` (o JDK do sistema não está no PATH; o JBR do Android Studio é o único disponível nesta máquina) |
| Full | Depois de tarefas que tocam código do app | `cd android && JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew :app:testDebugUnitTest && cd .. && flutter analyze && flutter test --no-pub` |
| Build | Depois de tarefas de documentação e ao fim de cada fase | `flutter analyze && flutter test --no-pub`, `cd android && JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew :app:testDebugUnitTest`, `cd backend && npx tsc --noEmit && npm test` (sem `--offline`: o cache Gradle não tem todos os artefatos Flutter) |

---

## Execution Plan

Fases ordenadas, executadas em sequência; tarefas dentro de uma fase executam em ordem.

### Phase 1: Blindagem do caminho de leitura (P16)

```
T1 → T2
```

### Phase 2: Registro técnico da arquitetura (P6 + rubrica 42)

```
T3 → T4
```

### Phase 3: Registro de backend e de processo (rubricas 26, 23, 27)

```
T5 → T6
```

### Phase 4: Rastreabilidade e higiene do versionamento

```
T7 → T8
```

---

## Task Breakdown

### T1: Regras de plausibilidade no `SibionicsGlucoseDecoder` ✅

**What**: Acrescentar ao decoder puro a rejeição por bits 56–63 sujos, a entrada `decodeUnsolicited` (que descarta valores `< 0x10000`, isto é, sem bits de rate/alarm) e a normalização de timestamp que sinaliza uso de fallback — tudo coberto por teste JVM.
**Where**: `android/app/src/main/kotlin/com/berdegeus/glucore/SibionicsGlucoseDecoder.kt`
**Depends on**: None
**Reuses**: `SibionicsGlucoseDecoder.decodePacked` e `normalizeTimestampMs` existentes; padrão de teste de `SibionicsGlucoseDecoderTest.kt`
**Requirement**: ARCH-05, ARCH-06

**Tools**:

- MCP: NONE
- Skill: `glucore-sensor-ble`

**Done when**:

- [x] `decodePacked` retorna `null` quando `(packed ushr 56) != 0`, mantendo a faixa aceita de 400 a 6000 décimos
- [x] `decodeUnsolicited(packed, timestampMs)` retorna `null` para todo valor `< 0x10000` e delega a `decodePacked` acima disso
- [x] A normalização de timestamp expõe se usou o fallback (ex.: `NormalizedTimestamp(valueMs, usedFallback)`), com a assinatura antiga preservada ou migrada junto com seus testes
- [x] Nenhum `import android.*` no arquivo
- [x] Testes novos: bits altos sujos rejeitados; `4` (código de protocolo) descartado por `decodeUnsolicited`; `0x10000 or 1043` aceito; fronteiras 399/400/6000/6001 preservadas; fallback sinalizado para `null`, `0` e negativo
- [x] Gate check passa: `cd android && JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew :app:testDebugUnitTest`
- [x] Contagem de testes: 27 Kotlin da linha de base preservados (10 no `SibionicsGlucoseDecoderTest`) + ≥6 novos, nenhum removido ou marcado como ignorado

**Tests**: unit
**Gate**: quick

**Commit**: `fix(ble): reject implausible packed glucose in the decoder`

---

### T2: Aplicar o gate e os logs no `SibionicsBleManager` ✅

**What**: Trocar a decodificação do caminho de código desconhecido do `SIprocessData` por `decodeUnsolicited`, logando o descarte com o valor bruto, e logar quando o timestamp cair no relógio do dispositivo.
**Where**: `android/app/src/main/kotlin/com/berdegeus/glucore/SibionicsBleManager.kt`
**Depends on**: T1
**Reuses**: `handleDirectGlucoseResult`, `handleGlucoseReady` e o `Log.w` com `tag` já usados no arquivo
**Requirement**: ARCH-04, ARCH-06

**Tools**:

- MCP: NONE
- Skill: `glucore-sensor-ble`

**Done when**:

- [x] `handleDirectGlucoseResult` usa `decodeUnsolicited`; valor descartado gera `Log.w` contendo o valor bruto
- [x] `handleGlucoseReady` continua usando `decodePacked` e emite `Log.w` identificando o uso do fallback de timestamp e o valor bruto recebido
- [x] Nenhuma outra mudança de comportamento no arquivo (a promoção de timestamp por `lastSyncedTimestampMs` segue como está)
- [x] Gate check passa: `flutter analyze && flutter test --no-pub && cd android && ./gradlew :app:testDebugUnitTest && cd ../backend && npx tsc --noEmit && npm test`
- [x] Contagem de testes: suítes Kotlin, Dart e backend com o mesmo total da T1, nenhuma removida

**Tests**: none (camada acoplada ao Android — matriz define build gate; a regra testável vive na T1)
**Gate**: build

**Commit**: `fix(ble): drop protocol codes on the unsolicited glucose path`

---

### T3: Documento de arquitetura multissensor ✅

**What**: Criar o documento de referência que descreve o contrato `BrandBleManager`, as três marcas suportadas e o ponto de escolha por marca, com citação de arquivo para cada afirmação estrutural.
**Where**: `docs/reference/multi-sensor-architecture.md`
**Depends on**: None
**Reuses**: Estrutura de `docs/reference/platform-channels.md`; código de `BrandBleManager.kt`, `SensorBrand.kt`, `SibionicsBleManager.kt`, `AccuChekBleManager.kt`, `Libre2BleManager.kt`, `LibreNfcHandler.kt`, `SensorCore.kt`
**Requirement**: ARCH-09

**Tools**:

- MCP: NONE
- Skill: `glucore-sensor-ble`

**Done when**:

- [x] O documento descreve o contrato comum e o que cada marca precisa implementar
- [x] Os três caminhos de aquisição estão descritos: Sibionics (BLE + JNI), Accu-Chek SmartGuide (BLE com PIN), Libre 2 (NFC + biblioteca Abbott)
- [x] Cada afirmação estrutural cita o arquivo Kotlin correspondente, e todo arquivo citado existe
- [x] `docs/README.md` lista o novo documento
- [x] Não duplica o protocolo Sibionics já descrito em `docs/architecture/sensor-pipeline.md` — referencia-o
- [x] Gate check passa: `flutter analyze && flutter test --no-pub && cd android && ./gradlew :app:testDebugUnitTest && cd ../backend && npx tsc --noEmit && npm test`

**Tests**: none (documentação — matriz define build gate)
**Gate**: build

**Commit**: `docs(sensor): document the brand-agnostic multi-sensor architecture`

---

### T4: Realinhar o `CLAUDE.md` com o código ✅

**What**: Reescrever as seções divergentes do `CLAUDE.md` (persistência local-first, camada Android multimarca), trocar detalhe volátil por ponteiro para `docs/` e preservar as invariantes nativas.
**Where**: `CLAUDE.md`
**Depends on**: T3
**Reuses**: `docs/README.md` como índice; documento criado na T3
**Requirement**: ARCH-01, ARCH-02, ARCH-03

**Tools**:

- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:

- [x] A descrição do `PatientCubit` cita `LocalPatientDataSource`, `PatientSyncService` e `refreshFromRemote`, e não afirma mais persistência REST direta
- [x] O mapa da camada Android mostra `GlucoreApp → SensorCore → SensorPlatformImpl → BrandBleManager` com as três implementações, mais `CgmForegroundService` e `LibreNfcHandler`
- [x] Todo detalhe volátil substituído aponta para o documento correspondente em `docs/`
- [x] As invariantes nativas seguem presentes: guarda de SIGSEGV, resolução JNI, `arm64-v8a`, layout de `getlastGlucose()`, lista de stubs `tk.glucodata`
- [x] Toda classe ou arquivo citado no `CLAUDE.md` existe no repositório (conferido um a um)
- [x] Gate check passa: `flutter analyze && flutter test --no-pub && cd android && ./gradlew :app:testDebugUnitTest && cd ../backend && npx tsc --noEmit && npm test`

**Tests**: none (documentação — matriz define build gate)
**Gate**: build

**Commit**: `docs: realign CLAUDE.md with the local-first, multi-brand stack`

---

### T5: README do backend com referência de rotas ✅

**What**: Criar o README do backend com setup, variáveis de ambiente, contrato de erro `{ error, code }`, limites de taxa e uma entrada por rota com exemplo de requisição e resposta.
**Where**: `backend/README.md`
**Depends on**: None
**Reuses**: `backend/src/index.ts`, `backend/src/routes/*.ts`, `backend/src/lib/env.ts`, `backend/prisma/schema.prisma`, `docs/architecture/backend.md`
**Requirement**: ARCH-07, ARCH-08

**Tools**:

- MCP: NONE
- Skill: `glucore-backend`

**Done when**:

- [x] Todo handler exportado em `backend/src/routes/*.ts` aparece no README com método, caminho e exigência de `Authorization`
- [x] Cada rota traz exemplo de corpo de requisição e de resposta cujos campos batem com o handler e com o `schema.prisma`
- [x] Setup documentado: `npm install`, `npx prisma migrate dev`, `npm run dev`, `npm test`, porta `3001`
- [x] Variáveis de ambiente listadas com obrigatoriedade e efeito: `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGIN`, `PORT`
- [x] Contrato de erro `{ error, code }` documentado com a lista de `code` que o backend emite hoje
- [x] Rotas com `rateLimit` declaram limite, janela e resposta `429`
- [x] Gate check passa: `flutter analyze && flutter test --no-pub && cd android && ./gradlew :app:testDebugUnitTest && cd ../backend && npx tsc --noEmit && npm test`

**Tests**: none (documentação — matriz define build gate)
**Gate**: build

**Commit**: `docs(backend): add README with route reference and setup`

---

### T6: Guia do processo de qualidade com caso real ✅

**What**: Criar o guia que descreve os gates em uso, o checklist de revisão de PR (incluindo o item anti-reincidência de P6 e a regra de migration da rubrica 27) e o caso real de reprovação em QA rastreável por commit.
**Where**: `docs/guides/qa-process.md`
**Depends on**: T5
**Reuses**: `.specs/features/checklist-tcc-compliance/validation.md` (rodadas 1 e 2), `docs/guides/versioning-and-branches.md`, `backend/README.md` da T5
**Requirement**: ARCH-10, ARCH-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Gates documentados com quando cada um roda: `flutter analyze`, `flutter test`, `./gradlew :app:testDebugUnitTest`, `npm test`, `npx tsc --noEmit`
- [x] Checklist de PR inclui o item "mudou camada ou fluxo? atualizou `CLAUDE.md`/`docs/`"
- [x] Regra da rubrica 27 registrada: mudança em `schema.prisma` acompanha migration versionada no mesmo PR
- [x] Caso real descrito com os 5 gaps da rodada 1, os commits do fix round (`19d67ed`, `ea7d107`, `12f98b8`, `b2da51f`, `0174cc0`) e o veredito PASS da rodada 2 — todos os hashes conferidos com `git cat-file -e`
- [x] `docs/README.md` lista o novo guia
- [x] Gate check passa: `flutter analyze && flutter test --no-pub && cd android && ./gradlew :app:testDebugUnitTest && cd ../backend && npx tsc --noEmit && npm test`

**Tests**: none (documentação — matriz define build gate)
**Gate**: build

**Commit**: `docs: record the QA process with a real rejected-task case`

---

### T7: Sincronizar revisão e plano com o estado entregue

**What**: Marcar P6 e o residual de P16 como resolvidos no review, com evidência `arquivo:linha`, e registrar no plano o corte do item 2.4 (CI/CD) com motivo e condição de retomada, além das verificações de device ainda pendentes.
**Where**: `docs/ARCHITECTURE_REVIEW.md` (e `docs/ARCHITECTURE_FIX_PLAN.md`)
**Depends on**: T2, T4, T6
**Reuses**: Formato de status já usado nos demais itens do review ("✅ Resolvido (data): evidência")
**Requirement**: ARCH-12

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] P6 marcado como resolvido citando as linhas do `CLAUDE.md` que sustentam a correção, sem apagar o histórico do item
- [ ] P16 marcado como resolvido citando `SibionicsGlucoseDecoder.kt` e `SibionicsBleManager.kt` com linha
- [ ] Item 2.4 do plano declara o corte, o motivo (binários proprietários fora do versionamento) e o que seria necessário para retomar
- [ ] Plano distingue o que foi fechado aqui do que segue pendente de device físico nas Fases 1 e 2
- [ ] Toda referência `arquivo:linha` conferida contra o arquivo real
- [ ] Gate check passa: `flutter analyze && flutter test --no-pub && cd android && ./gradlew :app:testDebugUnitTest && cd ../backend && npx tsc --noEmit && npm test`

**Tests**: none (documentação — matriz define build gate)
**Gate**: build

**Commit**: `docs(plan): sync review and fix plan with the delivered state`

---

### T8: Parar de versionar arquivos de lock do Office

**What**: Remover do versionamento o arquivo de lock `docs/~$TCC_Acompanhamento_Bernardo_Eduardo.xlsx`, commitado por engano, e ignorar o padrão `~$*`.
**Where**: `.gitignore`
**Depends on**: T7
**Reuses**: Seção de ignorados já existente no `.gitignore`
**Requirement**: — (higiene registrada nas Assumptions da spec)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `git rm --cached` aplicado ao arquivo de lock, sem apagar o arquivo local do usuário
- [ ] `.gitignore` ignora `~$*`
- [ ] `git ls-files docs/` não lista nenhum arquivo iniciado por `~$`
- [ ] A planilha `docs/TCC_Acompanhamento_Bernardo_Eduardo.xlsx` continua versionada
- [ ] Gate check passa: `flutter analyze && flutter test --no-pub && cd android && ./gradlew :app:testDebugUnitTest && cd ../backend && npx tsc --noEmit && npm test`

**Tests**: none (configuração — matriz define build gate)
**Gate**: build

**Commit**: `chore: stop tracking Office lock files`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 ------→ T2 ------→ T7
Phase 2:  T3 ------→ T4 ------→ T7
Phase 3:  T5 ------→ T6 ------→ T7
Phase 4:  T7 ------→ T8
```

Execução estritamente sequencial: 8 tarefas cabem em um único lote (~7 por worker), portanto o Execute roda inline, sem sub-agentes. O Verifier independente roda ao fim, como sempre.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Regras no decoder | 1 arquivo Kotlin + seu teste co-locado | ✅ Granular |
| T2: Gate e logs no manager | 1 arquivo Kotlin | ✅ Granular |
| T3: Doc multissensor | 1 documento novo (+1 linha de índice) | ✅ Granular |
| T4: `CLAUDE.md` | 1 arquivo | ✅ Granular |
| T5: README do backend | 1 documento novo | ✅ Granular |
| T6: Guia de QA | 1 documento novo (+1 linha de índice) | ✅ Granular |
| T7: Review + plano | 2 documentos, mesma entrega (rastreabilidade do plano) | ⚠️ Coeso — mantido junto de propósito |
| T8: Higiene de versionamento | 1 arquivo de config + 1 `git rm --cached` | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | — | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | None | — | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | None | — | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | T2, T4, T6 (fases anteriores) | T2 → T7, T4 → T7, T6 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Kotlin puro (decoder) | unit | unit | ✅ OK |
| T2 | Kotlin acoplado ao Android (`SibionicsBleManager`) | none (build gate) | none | ✅ OK |
| T3 | Markdown | none | none | ✅ OK |
| T4 | Markdown | none | none | ✅ OK |
| T5 | Markdown | none | none | ✅ OK |
| T6 | Markdown | none | none | ✅ OK |
| T7 | Markdown | none | none | ✅ OK |
| T8 | Configuração (`.gitignore`) | none | none | ✅ OK |
