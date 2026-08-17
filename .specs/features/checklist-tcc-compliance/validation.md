# Conformidade com o Checklist de Avaliação TCC I — Validation

## Validation: rodada 2 (re-verificação após Fix round 1) — PASS ✅

**Date**: 2026-08-17
**Spec**: `.specs/features/checklist-tcc-compliance/spec.md`
**Diff range**: `d65dbb0..HEAD` (`0174cc0`, branch `feat/tcc-checklist-compliance`) — 39 commits; Fix round 1 = `19d67ed`, `ea7d107`, `12f98b8`, `b2da51f`, `0174cc0`
**Verifier**: sub-agente independente da rodada 2 (autor ≠ verificador ≠ verificador da rodada 1), evidência-ou-zero

**Veredito**: aprovado. Os **5 gaps** da rodada 1 estão fechados e os **2 mutantes sobreviventes** foram **reinjetados por mim** e agora morrem. Gate integralmente verde. Nenhum gap novo bloqueante; duas observações não bloqueantes registradas no fim (escolha de escopo do usuário, não defeito).

Nada foi aceito por relato: cada item abaixo foi reconferido com grep/leitura/execução própria nesta rodada.

---

## 1. Gaps da rodada 1 — reconferidos um por um

| # | Gap da rodada 1 | Fix | Evidência **nova** desta rodada | Resultado |
| - | --------------- | --- | ------------------------------- | --------- |
| 1 | Mutantes 4 e 5 — limite de 8 caracteres não asserido em nenhuma das duas linguagens (P1 AC1 / TCC-01) | T33 (`19d67ed`) | `test/core/validation/password_policy_test.dart:66-77` — `expect(PasswordPolicy.validate('Senha1!'), PasswordPolicyError.tooShort)` e `expect(PasswordPolicy.validate('Senha12!'), isNull)`; `backend/tests/lib/passwordPolicy.test.ts:54-60` — `assert.equal(validatePassword('Senha1!'), 'tooShort')` e `assert.equal(validatePassword('Senha12!'), null)`. **Mutação reinjetada por mim** (seção 2) — ambos morrem. `design.md:103-104` acrescentou as duas linhas de borda à tabela de casos | ✅ **Fechado** |
| 2 | P2 AC2 (TCC-06) — 7 telas montavam `SnackBar` direto | T35 (`12f98b8`) | `grep -rn "SnackBar(" lib` rodado nesta rodada devolve **3 linhas, todas em `glucore_messenger.dart`**: `:50 ..hideCurrentSnackBar()`, `:51 ..showSnackBar(`, `:52 SnackBar(`. Zero ocorrências fora do helper. Semântica preservada na migração: sucesso→`success`, erro→`error`, "em breve"→`info` (diff de `12f98b8`) | ✅ **Fechado** |
| 3 | P1 AC5 (TCC-02) — campo de senha da troca de e-mail sem `PasswordField` | T34 (`ea7d107`) | `lib/features/patient/presentation/pages/profile_edit_page.dart:341-347` — `PasswordField(controller: _emailCurrentPassController, label: l10n.profileCurrentPasswordLabel, validator: … genericRequiredFieldError)`. Grep de `obscureText` no arquivo: nenhuma ocorrência crua. Teste específico do campo: `test/features/patient/profile_edit_page_test.dart:250-268` — começa `obscureText: isTrue`, após tocar `Icons.visibility_outlined` vira `isFalse`. **Discriminação comprovada por mutação minha** (mutação 3 da seção 2) | ✅ **Fechado** |
| 4 | P3 AC1 (TCC-14) — texto novo hardcoded em `UserAppBar` | T36 (`b2da51f`) | Leitura integral de `lib/features/patient/presentation/widgets/user_app_bar.dart` (109 linhas): nenhum `Text('…')` com literal em português. `:90 l10n.settingsLogoutTile`, `:91 l10n.settingsLogoutConfirmMessage`, `:95 l10n.genericCancelButton`, `:103 l10n.settingsLogoutTile`. Chaves conferidas nos dois `.arb` (`lib/l10n/app_pt.arb:196`, `lib/l10n/app_pt_BR.arb:196`) — reuso, sem chave nova nem duplicação. Encerra a "nota de duplicação evitável" da rodada 1 | ✅ **Fechado** |
| 5 | P3 AC2 (TCC-14) — 14 ocorrências de `Colors.red`/`Colors.green` em `lib/` | T37 (`0174cc0`) | `grep -rn "Colors\.red\|Colors\.green" lib` rodado nesta rodada: **"No matches found"**. Semântica conferida caso a caso contra `lib/core/theme/app_theme.dart:10,15` — `zoneTargetBg = #05B169` (verde) e `zoneLowBg = #CF202F` (vermelho): erro/destrutivo continua vermelho, sucesso/concluído continua verde (tabela na seção 4) | ✅ **Fechado** |

---

## 2. Discrimination Sensor — reinjeção independente

**Isolamento.** Baseline `git status --porcelain` do repositório real capturado antes de qualquer trabalho. Nenhum `git stash`, nenhum `rd /s /q`. Duas técnicas:

- **Backend**: cópia de arquivos para um diretório de scratch fora do repositório (`scratchpad/be-mut/`) com a estrutura mínima (`src/lib/passwordPolicy.ts`, `tests/lib/passwordPolicy.test.ts`, `tests/tsResolve.mjs`). Essa suíte só importa builtins do Node, então **não precisou de `node_modules`** — nenhuma junction foi criada, evitando por construção o incidente da rodada 1. Baseline no scratch: 13/13 verdes.
- **Flutter**: `git worktree add --detach <scratchpad>/dart-wt HEAD` + `flutter pub get --offline`; removido com **`git worktree remove --force`** (nunca deleção manual do diretório).

| # | File:line | Mutação | Resultado |
| - | --------- | ------- | --------- |
| 1 | `lib/core/validation/password_policy.dart:22` | `minLength` 8 → 6 (mutante 4 da rodada 1, **reinjetado**) | ✅ **Killed** — `password_policy_test.dart` → `Senha1! is rejected for being 7 characters` falha com `Expected: PasswordPolicyError.tooShort / Actual: <null>` (10 pass, 1 fail) |
| 2 | `backend/src/lib/passwordPolicy.ts:20` | `PASSWORD_MIN_LENGTH` 8 → 6 (mutante 5 da rodada 1, **reinjetado**) | ✅ **Killed** — `Senha1! is rejected for being 7 characters — below the minimum` falha (12 pass, 1 fail) |
| 3 | `lib/features/patient/presentation/pages/profile_edit_page.dart:341` | `PasswordField` revertido para `TextFormField(obscureText: true)` — reintroduz exatamente o gap 3 da rodada 1 | ✅ **Killed** — `profile_edit_page_test.dart:265` → `the email-change current password field starts obscured and its icon reveals only that field` falha (11 pass, 1 fail) |

**Sensor depth**: dirigido aos itens da rodada 1 (3 mutações; as 5 mortas da rodada 1 não foram re-executadas porque o código correspondente não foi tocado pelo fix round — ver seção 5).
**Result**: **3/3 killed** — PASS ✅. Os dois mutantes que sobreviveram na rodada 1 agora morrem, comprovado por reprodução própria e não pelo relato de T33.

**Verificação de isolamento**: `git status --porcelain` do repositório real após remover o worktree e apagar o scratch é **idêntico ao baseline** (diff vazio, `IDENTICAL`). `backend/node_modules/@prisma/` intacto (`client`, `engines`, `debug`, `fetch-engine`, `get-platform`, `engines-version`).

---

## 3. Gate Check

| Command | Result |
| ------- | ------ |
| `flutter analyze` | ✅ **No issues found!** (exit 0) |
| `flutter test --no-pub` | ✅ **176 passed, 0 failed, 0 skipped** (exit 0) |
| `cd backend && npm test` | ✅ **43 passed, 0 failed, 0 skipped** (12 suites, exit 0) |
| `cd backend && npx tsc --noEmit` | ✅ **clean** (exit 0) |

**Test Integrity Check** — nenhuma queda, nenhum teste deletado, nenhum `skip`:

| Marco | Flutter | Backend |
| ----- | ------- | ------- |
| Rodada 1 (pré-fix, `5929b7d`) | 173 | 41 |
| Baseline pós-fix informado ao verificador | 176 | 43 |
| **Medido por mim agora** | **176** | **43** |

Delta do fix round: **+3 Flutter** (2 bordas de senha em `password_policy_test.dart` + 1 teste de visibilidade em `profile_edit_page_test.dart`) e **+2 backend** (as duas bordas em `passwordPolicy.test.ts`). Confere com o diff (`git diff --stat 5ad0fad..HEAD`: `+13` linhas em `password_policy_test.dart`, `+22` em `profile_edit_page_test.dart`, `+8` em `passwordPolicy.test.ts`).

---

## 4. Semântica das cores migradas (T37) — conferida uma a uma

`AppTheme.zoneLowBg = Color(0xFFCF202F)` (`lib/core/theme/app_theme.dart:15`) é vermelho; `AppTheme.zoneTargetBg = Color(0xFF05B169)` (`:10`) é verde. Logo a migração preserva a leitura visual, não só a compilação:

| Arquivo:linha | Uso | Antes → depois | Significado preservado? |
| ------------- | --- | -------------- | ----------------------- |
| `carb_edit_page.dart:89` | fundo do botão de confirmar exclusão | `Colors.red` → `zoneLowBg` | ✅ destrutivo continua vermelho |
| `carb_edit_page.dart:157` | texto do botão "excluir" | `Colors.red` → `zoneLowBg` | ✅ |
| `insulin_edit_page.dart:96,191` | idem (confirmar exclusão / botão excluir) | `Colors.red` → `zoneLowBg` | ✅ |
| `libre_nfc_page.dart:114` | mensagem de falha do sensor | `Colors.red` → `zoneLowBg` | ✅ erro continua vermelho |
| `libre_nfc_page.dart:153` | ícone "biblioteca Abbott instalada" | `Colors.green` → `zoneTargetBg` | ✅ sucesso continua verde |
| `sensor_link_page.dart:68` | erro inline do pareamento | `Colors.red` → `zoneLowBg` | ✅ |
| `sensor_link_page.dart:280` | estado `SensorConnectionStatus.error` | `Colors.red` → `zoneLowBg` | ✅ |
| `sensor_link_page.dart:376,426` | etapa concluída do tutorial (texto e círculo) | `Colors.green` → `zoneTargetBg` | ✅ |
| `glucose_chart.dart:63` | linha do gráfico abaixo do limiar baixo | `Colors.red` → `zoneLowBg` | ✅ |
| `glucose_chart.dart:67` | linha dentro da faixa alvo | `Colors.green` → `zoneTargetBg` | ✅ |
| `glucose_chart.dart:122` | linha tracejada do limiar baixo (alpha 0.6) | `Colors.red` → `zoneLowBg` | ✅ alpha preservado |
| `localized_values.dart:87` | cor do alerta `syncFailure` | `Colors.red` → `zoneLowBg` | ✅ |

14/14 conferidas. Nenhuma inversão de significado (nada que era erro virou verde nem o contrário).

---

## 5. Varredura de não-regressão

O fix round tocou **15 arquivos** (`git diff --stat 5ad0fad..HEAD -- lib backend test`): 2 de política de senha (testes), `profile_edit_page.dart`, `user_app_bar.dart`, 7 páginas do paciente, `sensor_link_page.dart`, `glucose_chart.dart`, `localized_values.dart` e 2 arquivos de teste. **Não tocou** `lib/app.dart`, `lib/injection_container.dart`, `lib/core/api/api_client.dart` nem `lib/features/auth/**` — exatamente os arquivos onde vivem as garantias P17/P18/P19. Por isso a re-verificação profunda dos 52 ACs da rodada 1 não foi repetida; o que foi reconferido por execução:

| Guarda | Arquivo | Resultado |
| ------ | ------- | --------- |
| **P18** — sessão tolerante a offline | `test/features/auth/auth_cubit_offline_test.dart` | ✅ verde |
| **P17** — providers acima do Navigator raiz | `test/features/patient/sensor_choice_navigation_test.dart` | ✅ verde |
| **P19** — isolamento por usuário | `test/features/patient/user_isolation_test.dart` | ✅ verde |

Os três rodados juntos: **14 testes, 0 falhas**. Somados à suíte completa verde (176/43) e ao diff que não encosta nesses arquivos, nenhuma regressão nas garantias de v1.1.0.

Os itens **não bloqueantes** herdados da rodada 1 continuam como estavam (nenhum piorou):

- **P3-auditoria AC3** — ⚠️ spec-precision gap mantido: as 5 gravações de auditoria em rotas Express (`register`/`login`/`forgot`/`reset`/`update-profile`) não têm harness HTTP; a evidência segue sendo inspeção + gate. Justificado na matriz de testes, inalterado pelo fix round.
- **P1-identidade AC4** — `lib/features/patient/presentation/pages/libre_nfc_page.dart:78` mantém `AppBar(title: const Text('Libre 2 — Parear sensor'))` cru, sem `UserAppBar`. A página **não** está na lista nomeada pelo AC4 ("histórico, alertas, sensor, configurações, perfil, edição de registros"), então o AC como escrito continua cumprido; segue como ressalva de TCC-04, não como gap.

---

## 6. Achados novos desta rodada (não bloqueantes)

Nenhum defeito novo. Duas observações, ambas de **escopo/garantia**, nenhuma invalidando um AC como escrito:

1. **`Colors.orange` sobrou nas mesmas condicionais que T37 migrou.** `glucose_chart.dart:65` e `:128` e `sensor_link_page.dart:288` usam `Colors.orange` para a zona alta / estado de aviso, enquanto as linhas vizinhas do **mesmo `if/else`** passaram a usar `AppTheme.zoneLowBg`/`zoneTargetBg`. `AppTheme.zoneHighBg = Color(0xFFE58A1F)` já existe e é exatamente essa cor semântica. A cláusula medível do AC2 ("nenhuma ocorrência de `Colors.red` ou `Colors.green` em `lib/`") está **cumprida**; a cláusula ampla ("obter toda cor usada em UI de `AppTheme`") não está — e nunca esteve, já que `Colors.white`/`Colors.grey` aparecem em ~30 pontos pré-existentes fora do escopo desta feature. Recomendação: migrar as 3 ocorrências de `Colors.orange` para `AppTheme.zoneHighBg` (barato, deixa o trio low/target/high coerente) **ou** estreitar a redação do AC2. Decisão do usuário, não bloqueio.
2. **Os ACs de higiene fechados por grep não têm guarda de regressão.** T35 (`SnackBar`), T36 (l10n de `UserAppBar`) e T37 (cores) foram fechados por inspeção/grep e não por teste: `grep -rln "user_app_bar" test/` mostra que nenhum teste faz varredura estrutural sobre `user_app_bar.dart` — e o teste estrutural que existe (`test/features/patient/settings_profile_l10n_test.dart:211-244`) lê apenas `settings_page.dart` e `profile_page.dart`. Como o valor l10n é idêntico ao literal antigo, um `const Text('Deseja sair da sua conta?')` reintroduzido amanhã passaria a suíte inteira. Mesmo raciocínio para `SnackBar(` e `Colors.red`. Estado atual está correto; o que falta é o cinto de segurança. Lição registrada em `.specs/lessons.json` (L-005).

---

## 7. Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ — fix round: +100/−69 linhas em 15 arquivos, todas dentro dos 5 gaps |
| Surgical changes | ✅ — nenhum arquivo fora dos gaps foi tocado |
| No scope creep | ✅ — `Colors.orange` deliberadamente não tocado e a decisão documentada em T37 |
| Matches patterns | ✅ — `GlucoreMessenger.success/error/info` como nas telas de auth; `PasswordField` como nos outros 4 formulários |
| No features beyond what was asked | ✅ |
| Spec-anchored outcome check | ✅ — 52/52 ACs; os 3 gaps de AC da rodada 1 fecharam com asserção sobre o valor exato do spec; 1 spec-precision gap remanescente (P3-auditoria AC3) declarado |
| Per-layer Coverage Expectation met | ✅ — domínio 1:1 com ACs; rotas Express com `none` justificado |
| Every test maps to a spec requirement | ✅ — os 5 testes novos citam `TCC-01`/`TCC-02` no cabeçalho ou no nome |
| Documented guidelines followed | ✅ — `CLAUDE.md` (nunca editar `lib/l10n/generated/`; chaves nos dois `.arb`), `analysis_options.yaml` |

**Nota sobre `context.mounted`.** T35 trocou `mounted` por `context.mounted` em `alert_settings_page.dart`, `carb_entry_page.dart` e `insulin_entry_page.dart`. Conferido: nesses três pontos o `onPressed` roda dentro de `build(BuildContext context)`, o `context` é o do widget, e as duas expressões devolvem o mesmo booleano — troca de lint, não de comportamento. `flutter analyze` limpo confirma.

---

## 8. Requirement Traceability Update

| Requirement | Status rodada 1 | Status rodada 2 |
| ----------- | --------------- | --------------- |
| TCC-01 | ⚠️ Verified com ressalva | ✅ **Verified** — limite de 8 asserido nos dois lados, mutantes reinjetados morrem |
| TCC-02 | ⚠️ Needs Fix | ✅ **Verified** — `PasswordField` no formulário de troca de e-mail, com teste discriminante |
| TCC-03 | ✅ Verified | ✅ Verified |
| TCC-04 | ⚠️ Verified com ressalva | ✅ **Verified** (ressalva mantida: `libre_nfc_page.dart:78` fora do `UserAppBar`, fora da lista do AC4) |
| TCC-05 | ✅ Verified | ✅ Verified |
| TCC-06 | ❌ Needs Fix | ✅ **Verified** — `grep -rn "SnackBar(" lib` só acha `glucore_messenger.dart:50-52` |
| TCC-07 … TCC-13 | ✅ Verified | ✅ Verified (código intocado pelo fix round) |
| TCC-14 | ❌ Needs Fix | ✅ **Verified** — l10n em `UserAppBar` e zero `Colors.red`/`Colors.green` em `lib/` (observação 1 da seção 6 fica como escolha de escopo) |
| TCC-15 | ✅ Verified | ✅ Verified |
| TCC-16 | ⚪ Descoped | ⚪ Descoped — alvo confirmado inexistente na rodada 1 |
| TCC-17, TCC-18 | ✅ Verified | ✅ Verified |

**Coverage**: 18 requisitos · **17 verified** · 1 descoped legítimo · 0 needs fix.

---

## 9. Summary

**Overall**: ✅ **Ready** — a feature pode ser fechada.

**Gaps da rodada 1**: **5/5 fechados**, cada um com evidência nova produzida nesta rodada
**Mutantes reinjetados**: **2/2 agora morrem** (+1 mutação nova sobre o fix de T34, também morre) → 3/3
**Gate**: Flutter 176/176 · `analyze` limpo · backend 43/43 · `tsc` limpo
**Isolamento do sensor**: worktree removido com `git worktree remove --force`, scratch de arquivos sem `node_modules`; porcelain final idêntico ao baseline; `@prisma/client` intacto

**Issues remanescentes**: nenhuma bloqueante. Duas decisões de escopo opcionais (seção 6): migrar 3 `Colors.orange` para `AppTheme.zoneHighBg`, e adicionar guardas estruturais para os ACs de higiene fechados por grep.

**Next steps**: fechar a feature. As duas observações da seção 6 são candidatas a uma iteração futura, não a uma rodada 3.

---
---

# Anexo — Rodada 1 (histórico, 2026-08-17, `5929b7d`)

Veredito da rodada 1: **reprovado** — 5 gaps + 2 mutantes sobreviventes. O relatório completo daquela rodada foi substituído por este; o essencial está preservado abaixo para rastreabilidade. Todos os itens abaixo foram **fechados** e reconferidos na rodada 2 (seções 1 e 2 deste documento).

**Gaps apontados** (numeração do sumário da rodada 1):

1. P2 AC2 (TCC-06) — 7 telas montavam `SnackBar` direto → Fix 2 / T35
2. Mutantes 4 e 5 — limite de 8 caracteres não asserido em Dart nem em TS → Fix 1 / T33
3. P1 AC5 (TCC-02) — campo de senha da troca de e-mail sem `PasswordField` → Fix 3 / T34
4. P3 AC1 (TCC-14) — texto novo de `UserAppBar` hardcoded → Fix 4 / T36
5. P3 AC2 (TCC-14) — 14 ocorrências de `Colors.red`/`Colors.green` em `lib/` → Fix 5 / T37

**Sensor da rodada 1**: 7 mutações, 5 mortas, 2 sobreviventes (as duas do limite de 8, mesma causa-raiz: a tabela de casos de `design.md` não tinha amostra de 6 ou 7 caracteres). As 5 mortas cobriram `requireRole` (`backend/src/middleware/auth.ts:68-71`), a regra de caractere especial (`backend/src/lib/passwordPolicy.ts:28`), a discriminação de `TOKEN_INVALID` no interceptor 401 (`lib/core/api/api_client.dart:62-66`, guarda de P18), a sanitização recursiva da auditoria (`backend/src/lib/audit.ts:63`) e o breakpoint inclusivo de 600 dp (`lib/features/patient/presentation/widgets/glucore_form_layout.dart:20`).

**Gate da rodada 1**: Flutter 173/173 · backend 41/41 · `analyze` e `tsc` limpos · `prisma validate` OK.

**ACs plenamente cobertos na rodada 1**: 46 de 52, com evidência `file:line` por critério, incluindo os 7 edge cases do spec e as 3 guardas de regressão v1.1.0 (P17/P18/P19). A rodada 2 fecha os 6 restantes (3 gaps de AC + 1 parcial reclassificada + os 2 mutantes), mantendo 1 spec-precision gap declarado (P3-auditoria AC3).

**Incidente de ambiente da rodada 1** (registrado para não repetir): a limpeza do worktree do sensor com `rd /s /q` recursou por uma junction de `node_modules` e destruiu `@prisma/client`, `@prisma/engines` e `.prisma` reais; reparado com `npm ci` + `prisma generate`. Na rodada 2 o problema foi eliminado por construção: `git worktree remove --force` para o worktree Flutter e um scratch de arquivos **sem** `node_modules` para o backend.
