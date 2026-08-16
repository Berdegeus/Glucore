# Conformidade com o Checklist TCC I — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/checklist-tcc-compliance/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `CLAUDE.md` (comandos `flutter analyze`, `flutter test --no-pub`, `flutter gen-l10n`), `.claude/skills/glucore-*` (armadilhas por camada), `analysis_options.yaml` (`flutter_lints`). Nenhum threshold de cobertura configurado no repo → defaults fortes aplicados. Amostras de teste usadas como piso de estilo: `test/features/auth/auth_cubit_offline_test.dart`, `test/features/patient/{local_patient_datasource_test,patient_sync_service_test,sensor_choice_navigation_test,user_isolation_test}.dart`, `test/widget_test.dart`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Dart — lógica pura (política de senha, máscara/normalização de telefone, rótulos) | unit | Todas as branches; 1:1 com os ACs; todos os edge cases listados no spec | `test/core/**/*_test.dart` | `flutter test --no-pub` |
| Dart — widgets compartilhados (`PasswordField`, `GlucoreMessenger`, `UserAppBar`, `GlucoreFormLayout`) | widget | Estado inicial + cada interação + cada variante; isolamento entre instâncias | `test/features/**/*_test.dart` | `flutter test --no-pub` |
| Dart — cubits (`UserIdentityCubit`) e notifier de sessão | unit | Todas as transições de estado + caminho de falha + idempotência | `test/features/**/*_test.dart`, `test/core/**/*_test.dart` | `flutter test --no-pub` |
| Dart — páginas/telas | widget | Happy path + validação bloqueando submit + cada edge case citado no AC da tela | `test/features/**/*_test.dart` | `flutter test --no-pub` |
| TS — libs puras (`passwordPolicy`, `audit` sanitização) | unit | Todas as branches + a tabela de casos do design na íntegra | `backend/tests/**/*.test.ts` | `cd backend && npm test` |
| TS — middlewares (`prismaError`, `requireRole`, `verifyJwt`) | unit (req/res/next dublês) | Todo código mapeado + fallback + caminho de sucesso | `backend/tests/**/*.test.ts` | `cd backend && npm test` |
| TS — rotas Express (`auth`, `carbs`, `insulin`, `alerts`, `settings`) | none — build gate | Justificativa: o repo não tem harness HTTP nem banco de teste, e adicionar `supertest`/`jest` exige `npm install` (indisponível nesta iteração). Mitigação obrigatória: toda lógica de decisão nova nas rotas é extraída para lib/middleware, que **são** testados nas camadas acima; a rota fica com wiring apenas | — | `npx tsc --noEmit` |
| Prisma schema + migração SQL | none — build gate | Validação estrutural apenas | `backend/prisma/**` | `cd backend && npx prisma validate` |
| l10n (`.arb` + geração) | none — build gate | `flutter gen-l10n` deve gerar sem erro (chave faltando em um dos dois `.arb` quebra o build) | `lib/l10n/*.arb` | `flutter gen-l10n` |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (Flutter) | Tarefas Dart com testes unitários/widget | `flutter test --no-pub` |
| Quick (Backend) | Tarefas TS com testes unitários | `cd backend && npm test` |
| Full | Tarefas que tocam l10n, DI, wiring de rotas ou fluxo entre camadas | `flutter gen-l10n && flutter analyze && flutter test --no-pub` (Dart) · `cd backend && npm test && npx tsc --noEmit` (TS) |
| Build | Fim de fase, schema/migração, ou tarefa sem testes próprios | `flutter gen-l10n && flutter analyze && flutter test --no-pub` **e** `cd backend && npm test && npx tsc --noEmit && npx prisma validate` |

---

## Execution Plan

### Phase 1: Fundações compartilhadas (sem call sites)

```
T1 → T2 → T3 → T4 → T5 → T6 → T7
```

### Phase 2: Backend — contratos de erro, papel e auditoria

```
T8 → T9 → T10 → T11 → T12 → T13 → T14
```

### Phase 3: Flutter — telas de autenticação e ciclo de sessão

```
T15 → T16 → T17 → T18 → T19 → T20
```

### Phase 4a: Flutter — identidade do usuário em todas as telas

```
T21 → T22 → T23 → T24
```

### Phase 4b: Flutter — formulários, perfil e identidade visual

```
T25 → T26 → T27 → T28 → T29 → T30
```

### Phase 5: Documentação e checklist

```
T31 → T32
```

---

## Task Breakdown

### T1: Criar política de senha compartilhada (Dart)

**What**: Função pura de validação de força de senha com as 5 regras e um enum de erro por regra violada.
**Where**: `lib/core/validation/password_policy.dart`
**Depends on**: None
**Reuses**: padrão de função pura de `lib/core/utils/date_input.dart`
**Requirement**: TCC-01

**Tools**:
- MCP: NONE
- Skill: `glucore-patient-features` (l10n)

**Done when**:
- [x] `PasswordPolicy.validate(String)` retorna `null` para senha válida e o erro específico para cada regra violada
- [x] Chaves de mensagem adicionadas aos **dois** `.arb` e `flutter gen-l10n` roda limpo
- [x] Todos os 8 casos da tabela do design cobertos por teste
- [x] Gate passa: `flutter test --no-pub`
- [x] Test count: 9 testes novos passam (38 no total)

**Tests**: unit
**Gate**: full
**Commit**: `feat(auth): add shared password strength policy`
**Status**: ✅ Complete

---

### T2: Criar política de senha no backend (TS) + harness de teste

**What**: `isStrongPassword`/`assertStrongPassword` espelhando a regra do app, mais o script `npm test` que habilita `node --test` sobre TypeScript.
**Where**: `backend/src/lib/passwordPolicy.ts`
**Depends on**: T1
**Reuses**: tabela de casos do design (mesma de T1)
**Requirement**: TCC-01

**Tools**:
- MCP: NONE
- Skill: `glucore-backend`

**Done when**:
- [x] `isStrongPassword` cobre as 5 regras; `validatePassword` devolve o motivo da falha e `assertStrongPassword` lança `WeakPasswordError` com `code: 'WEAK_PASSWORD'`
- [x] `npm test` adicionado ao `package.json` rodando `node --no-warnings --test` sobre `tests/**/*.test.ts`
- [x] Os mesmos 8 casos da tabela do design passam, com resultados idênticos aos de T1
- [x] Gate: `cd backend && npm test` verde (11 testes). `npx tsc --noEmit` continua vermelho por 4 erros **pré-existentes** e alheios a esta tarefa (`express-rate-limit` ausente do `node_modules` e client Prisma desatualizado sem `dayOfWeek`); ambos exigem `npm install`/`prisma generate`, indisponíveis nesta iteração. Os arquivos novos type-checam limpos isoladamente.
- [x] Test count: 11 testes novos passam

**Tests**: unit
**Gate**: full
**Commit**: `feat(backend): add password strength policy and test harness`
**Status**: ✅ Complete

---

### T3: Criar máscara e normalização de telefone

**What**: `BrazilianPhoneInputFormatter` + `formatBrazilianPhone`/`phoneDigitsOnly`.
**Where**: `lib/core/utils/phone_input.dart`
**Depends on**: T2
**Pré-requisitos reais**: nenhum — ordem apenas sequencial
**Reuses**: `BrazilianDateInputFormatter` em `lib/core/utils/date_input.dart`
**Requirement**: TCC-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Digitação progressiva produz `(11) 98765-4321`; não numéricos são descartados
- [x] 10 dígitos formatam como `(11) 3456-7890`; mais de 11 dígitos são truncados
- [x] `phoneDigitsOnly` devolve só dígitos; string vazia devolve vazio
- [x] Gate passa: `flutter test --no-pub` (47 testes)
- [x] Test count: 9 testes novos passam

**Spec-precision gap**: o spec fixa as duas formas completas da máscara, mas não define
onde fica o separador entre 7 e 9 dígitos, faixa em que celular e fixo ainda são
indistinguíveis. O teste assere apenas os estados determinados pelo spec.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): add brazilian phone input formatter`
**Status**: ✅ Complete

---

### T4: Criar helper de rótulo obrigatório/opcional

**What**: `fieldLabel(base, {required})` devolvendo `"X *"` ou `"X (opcional)"`, com o sufixo opcional vindo de l10n.
**Where**: `lib/core/utils/field_label.dart`
**Depends on**: T3
**Pré-requisitos reais**: nenhum — ordem apenas sequencial
**Reuses**: `lib/l10n/l10n.dart`
**Requirement**: TCC-05

**Tools**:
- MCP: NONE
- Skill: `glucore-patient-features` (l10n)

**Done when**:
- [x] `fieldLabel(l10n, 'Peso (kg)', required: false)` devolve `Peso (kg) (opcional)`; `required: true` devolve `Peso (kg) *`
- [x] Sufixo "(opcional)" adicionado aos dois `.arb`
- [x] Gate passa: `flutter gen-l10n && flutter analyze && flutter test --no-pub` (50 testes)
- [x] Test count: 3 testes novos passam

**Nota de assinatura**: adotada a do design, `fieldLabel(l10n, base, required:)`, porque o
sufixo opcional vem de l10n; o exemplo abreviado do "Done when" foi lido como o resultado
esperado, não como a assinatura.

**Tests**: unit
**Gate**: full
**Commit**: `feat(core): add required/optional field label helper`
**Status**: ✅ Complete

---

### T5: Criar `GlucoreMessenger`

**What**: Helper único de mensagens com as variantes `info`, `warning`, `error`, `success` — o único ponto do app que constrói `SnackBar`.
**Where**: `lib/features/patient/presentation/widgets/glucore_messenger.dart`
**Depends on**: T4
**Pré-requisitos reais**: nenhum — ordem apenas sequencial
**Reuses**: `snackBarTheme` de `lib/core/theme/app_theme.dart`
**Requirement**: TCC-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] As quatro variantes exibem ícone e cor distintos, todos vindos de `AppTheme`
- [x] Teste de widget verifica ícone e cor de fundo por variante
- [x] Gate passa: `flutter test --no-pub` (55 testes)
- [x] Test count: 5 testes novos passam

**Escopo**: a migração dos ~20 `SnackBar` já existentes nas telas (AC2 do spec) é das
tarefas T15+; aqui só nasce a fonte única.

**Tests**: widget
**Gate**: quick
**Commit**: `feat(ui): add unified GlucoreMessenger for user messages`
**Status**: ✅ Complete

---

### T6: Criar `GlucoreFormLayout` responsivo

**What**: Wrapper com `LayoutBuilder` que centraliza o conteúdo em largura máxima de 560 dp acima de 600 dp e não altera nada abaixo.
**Where**: `lib/features/patient/presentation/widgets/glucore_form_layout.dart`
**Depends on**: T5
**Pré-requisitos reais**: nenhum — ordem apenas sequencial
**Reuses**: padrão de widget stateless de `glucore_widgets.dart`
**Requirement**: TCC-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] A 800 dp de largura o filho tem 560 dp e está centralizado
- [x] A 400 dp de largura o filho ocupa a largura total
- [x] A exatamente 600 dp o layout permanece coluna única (limite inclusivo)
- [x] Gate passa: `flutter test --no-pub` (58 testes)
- [x] Test count: 3 testes novos passam

**Tests**: widget
**Gate**: quick
**Commit**: `feat(ui): add responsive form layout wrapper`
**Status**: ✅ Complete

---

### T7: Criar `PasswordField`

**What**: Campo de senha reutilizável com alternância de visibilidade, `helperText` opcional e `validator` injetável.
**Where**: `lib/features/auth/presentation/widgets/password_field.dart`
**Depends on**: T6
**Pré-requisitos reais**: T1 (satisfeitos pela execução sequencial)
**Reuses**: `PasswordPolicy` (T1), `inputDecorationTheme` de `AppTheme`
**Requirement**: TCC-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Inicia oculto; tocar no ícone revela e tocar de novo oculta
- [x] Duas instâncias na mesma tela alternam de forma independente
- [x] `validator` recebido é chamado no submit do `Form`
- [x] Gate passa: `flutter test --no-pub` (63 testes)
- [x] Test count: 5 testes novos passam

**Nota**: o `helperText` é exibido sempre que informado (superconjunto do AC7, que pede
a regra visível com o campo em foco ou preenchido). Sem tooltip no ícone, para não
introduzir chave de l10n fora do escopo desta tarefa.

**Tests**: widget
**Gate**: quick
**Commit**: `feat(auth): add PasswordField with visibility toggle`
**Status**: ✅ Complete

---

### T8: Criar middleware de tradução de erros do Prisma

**What**: Middleware de erro que mapeia `P2002`/`P2003`/`P2025`/`P1001`/`P1002`/`PrismaClientInitializationError` para status + `code`, com fallback 500.
**Where**: `backend/src/middleware/prismaError.ts`
**Depends on**: T7
**Pré-requisitos reais**: T2 (satisfeitos pela execução sequencial)
**Reuses**: handler de erro atual em `backend/src/index.ts`
**Requirement**: TCC-09, TCC-17

**Tools**:
- MCP: NONE
- Skill: `glucore-backend`

**Done when**:
- [x] Cada código da tabela de contratos de erro do design produz o status e o `code` corretos
- [x] Erro não classificado produz 500 `INTERNAL` sem stack quando `NODE_ENV=production`
- [x] Log inclui código Prisma e rota de origem
- [x] Registrado em `index.ts` antes do handler genérico
- [x] Gate passa: `cd backend && npm test && npx tsc --noEmit` (23 testes, tsc limpo)
- [x] Test count: 12 testes novos passam

**Escopo da tabela de contratos**: o middleware cobre as linhas que ele produz —
`DUPLICATE_RECORD`, `RELATED_RECORD_MISSING`, `RECORD_NOT_FOUND`, `DATABASE_UNAVAILABLE`,
`INTERNAL` e `WEAK_PASSWORD` (via erros que carregam `status` + `code`, como
`WeakPasswordError`). `TOKEN_INVALID`, `EMAIL_TAKEN`, `INVALID_CURRENT_PASSWORD` e
`FORBIDDEN_ROLE` são respostas de rota/middleware e nascem em T9 e T10.

**Tests**: unit
**Gate**: full
**Commit**: `feat(backend): map prisma errors to specific http responses`
**Status**: ✅ Complete

---

### T9: Aplicar política de senha e códigos de erro em `auth.ts`

**What**: Usar `assertStrongPassword` em register/reset-password/profile e passar a responder `{ error, code }` (`WEAK_PASSWORD`, `EMAIL_TAKEN`, `INVALID_CURRENT_PASSWORD`).
**Where**: `backend/src/routes/auth.ts`
**Depends on**: T8
**Pré-requisitos reais**: T2, T8 (satisfeitos pela execução sequencial)
**Reuses**: `isStrongPassword` (T2), `EMAIL_RE` e helpers existentes do arquivo
**Requirement**: TCC-01, TCC-05

**Tools**:
- MCP: NONE
- Skill: `glucore-backend`

**Done when**:
- [x] As três rotas que definem senha rejeitam senha fraca com 400 `WEAK_PASSWORD` (`assertStrongPassword` em `/register`, `/reset-password` e `PUT /profile`; o status/corpo sai do `prismaErrorHandler` de T8)
- [x] `POST /register` aceita corpo sem `birthDate`, `weightKg` e `phone`, persistindo `null` — já era o comportamento: os três passam por `parseOptional*`/`optionalText`, que devolvem `undefined`, e o Prisma omite o campo no `create`
- [x] Senha atual incorreta em `PUT /profile` responde 401 `INVALID_CURRENT_PASSWORD`
- [x] `serializeProfile` passa a expor `role` e `createdAt`
- [x] Gate passa: `cd backend && npm test && npx tsc --noEmit` (23 testes, tsc limpo)
- [x] Test count: 23 testes continuam passando (nenhuma exclusão)

**Não regrediu**: `/login` continua exigindo apenas senha não vazia (contas legadas entram);
`/forgot-password` continua respondendo sempre 200. Nenhum status existente mudou — só o
corpo ganhou `code` em `EMAIL_TAKEN` e `INVALID_CURRENT_PASSWORD`.

**Tests**: none (rota — build gate; a decisão nova vive em `passwordPolicy`, testada em T2)
**Gate**: build
**Commit**: `feat(backend): enforce strong passwords and typed auth error codes`
**Status**: ✅ Complete

---

### T10: Criar `requireRole` e proteger as rotas de dados

**What**: Middleware `requireRole(...roles)` resolvendo o papel no banco, mais `code: 'TOKEN_INVALID'` nos 401 de `verifyJwt`, aplicado às cinco rotas de dados.
**Where**: `backend/src/middleware/auth.ts`
**Depends on**: T9
**Pré-requisitos reais**: T8 (satisfeitos pela execução sequencial)
**Reuses**: `verifyJwt` existente, `prisma` de `src/lib/prisma.ts`
**Requirement**: TCC-12

**Tools**:
- MCP: NONE
- Skill: `glucore-backend`

**Done when**:
- [x] `verifyJwt` responde 401 com `code: 'TOKEN_INVALID'` para header ausente e para token inválido
- [x] `requireRole('PATIENT')` deixa passar papel permitido e responde 403 `FORBIDDEN_ROLE` para papel não permitido
- [x] Usuário inexistente responde 401 `TOKEN_INVALID`
- [x] `router.use(requireRole('PATIENT'))` aplicado em readings, carbs, insulin, alerts e settings, sempre **depois** de `verifyJwt`
- [x] Gate passa: `cd backend && npm test && npx tsc --noEmit` (32 testes, tsc limpo)
- [x] Test count: 9 testes novos passam

**Nota de assinatura**: `requireRole(roles, options?)` — `roles` aceita `'PATIENT'` ou uma
lista, e `options.resolveRole` é o ponto de injeção opcional (default: leitura no banco)
que permite o teste unitário sem mock global, conforme AD-4.

**Harness**: `tests/tsResolve.mjs` (registrado via `--import` no script `test`) acrescenta
`.ts` a imports relativos sem extensão. Sem isso os testes não conseguem carregar módulos
de `src/` que importam outros módulos de `src/`: o `tsc` do projeto usa `module: commonjs`,
onde escrever a extensão `.ts` no fonte é erro TS5097, mas o loader ESM do Node exige a
extensão. O import de tipos do Express em `auth.ts` passou a ser `import type` pelo mesmo
motivo (o loader ESM não encontra exports de runtime com esses nomes no pacote CJS).

**Tests**: unit
**Gate**: full
**Commit**: `feat(backend): add role authorization and typed 401 code`
**Status**: ✅ Complete

---

### T11: Adicionar modelo `AuditLog` e migração

**What**: Modelo Prisma `AuditLog` (com a relação em `User`) e a migração SQL correspondente escrita à mão.
**Where**: `backend/prisma/schema.prisma`
**Depends on**: T10
**Pré-requisitos reais**: nenhum — ordem apenas sequencial
**Reuses**: convenções de PK/índice dos modelos existentes
**Requirement**: TCC-13

**Tools**:
- MCP: NONE
- Skill: `glucore-backend`

**Done when**:
- [x] Modelo criado conforme o design, com `userId` nulável e `onDelete: SetNull`; relação `auditLogs` adicionada em `User`
- [x] `migrations/20260816120000_add_audit_log/migration.sql` cria tabela, os dois índices e a FK `ON DELETE SET NULL`
- [x] Gate passa: `cd backend && npx prisma validate && npx tsc --noEmit && npm test` (schema válido, tsc limpo, 32 testes)

**Aplicação**: migração escrita à mão (AD-007) — o banco não está acessível nesta iteração.
`npx prisma generate` foi rodado para o client refletir o modelo; `npx prisma migrate deploy`
aplica o SQL quando houver banco.

**Tests**: none (schema — build gate, conforme matriz)
**Gate**: build
**Commit**: `feat(backend): add AuditLog model and migration`
**Status**: ✅ Complete

---

### T12: Criar `recordAudit`

**What**: Função de gravação da trilha, com sanitização que remove chaves sensíveis do `metadata` e engolindo a própria exceção.
**Where**: `backend/src/lib/audit.ts`
**Depends on**: T11
**Reuses**: `prisma` de `src/lib/prisma.ts`
**Requirement**: TCC-13

**Tools**:
- MCP: NONE
- Skill: `glucore-backend`

**Done when**:
- [x] `sanitizeMetadata` remove `password`, `newPassword`, `currentPassword`, `passwordHash`, `token` em qualquer nível — objetos aninhados e itens de array incluídos
- [x] Falha de gravação não propaga exceção e registra `console.error` (rejeição e throw sincrônico)
- [x] Gate passa: `cd backend && npm test && npx tsc --noEmit` (41 testes, tsc limpo)
- [x] Test count: 9 testes novos passam

**Nota de implementação**: a remoção casa pelo *nome* da chave (`/password|token/i`) em vez de
uma lista exata, para cobrir variantes como `resetToken` ou `passwordConfirmation`. O client
do Prisma é um parâmetro opcional (`AuditClient`), o que permite testar sem banco.

**Tests**: unit
**Gate**: full
**Commit**: `feat(backend): add best-effort audit trail writer`
**Status**: ✅ Complete

---

### T13: Gravar auditoria nas rotas de autenticação

**What**: Chamar `recordAudit` nos caminhos de sucesso de register, login, forgot-password, reset-password e update de perfil.
**Where**: `backend/src/routes/auth.ts`
**Depends on**: T12
**Pré-requisitos reais**: T12, T9 (satisfeitos pela execução sequencial)
**Reuses**: `recordAudit` (T12), `console.log` já existente nesses pontos
**Requirement**: TCC-13

**Tools**:
- MCP: NONE
- Skill: `glucore-backend`

**Done when**:
- [x] Os cinco caminhos de sucesso gravam `entity`/`action` distintos com `userId`, `ipAddress` e `userAgent`: `User/REGISTER`, `User/LOGIN`, `User/FORGOT_PASSWORD`, `User/RESET_PASSWORD`, `User/UPDATE_PROFILE`
- [x] Nenhuma chamada passa senha, hash ou token de recuperação em `metadata` — só `{ email }` no cadastro e `{ changed: [...nomes de campo] }` na atualização de perfil
- [x] Gate passa: `cd backend && npm test && npx tsc --noEmit` (41 testes, tsc limpo)

**Decisão em `/forgot-password`**: o registro é gravado apenas quando a conta existe. A
resposta continua idêntica nos dois casos (200 genérico); uma linha para endereço
desconhecido transformaria a trilha em lista de enumeração de contas.

**Tests**: none (rota — build gate; sanitização testada em T12)
**Gate**: build
**Commit**: `feat(backend): record audit trail for auth events`
**Status**: ✅ Complete

---

### T14: Gravar auditoria nas rotas de dados do paciente

**What**: Chamar `recordAudit` nas escritas de carbs, insulin, alerts e settings/alerts (um registro por requisição, ação `REPLACE`/`DELETE`/`UPDATE`).
**Where**: `backend/src/routes/` (carbs, insulin, alerts, settings — mesma troca mecânica por arquivo)
**Depends on**: T13
**Reuses**: `recordAudit` (T12), padrão de rota de `carbs.ts`
**Requirement**: TCC-13

**Tools**:
- MCP: NONE
- Skill: `glucore-backend`

**Done when**:
- [x] Cada rota de escrita das quatro coleções grava um registro com `entity` correspondente ao modelo Prisma: `CarbEvent` e `InsulinEvent` (`CREATE`/`UPDATE`/`DELETE`/`REPLACE`), `AlertEvent` (`REPLACE`), `AlertThresholdConfig` (`UPDATE`)
- [x] `DELETE /readings` também grava (`GlucoseReading`/`DELETE`)
- [x] Gate passa: `cd backend && npm test && npx tsc --noEmit` (41 testes, tsc limpo)

**Um registro por requisição**: as rotas replace-all gravam uma linha com ação `REPLACE` e
`metadata: { count }`, não uma linha por item (design, "Impacto em comportamentos existentes").
`POST /readings` não grava: é a sincronização de sensor em lote, fora da lista do AC2, e
auditar cada lote inundaria a trilha.

**Consolidação**: `auditRequestContext(req)` saiu de `auth.ts` (onde nasceu em T13) para
`src/lib/audit.ts`, para que os 11 call sites usem a mesma fonte em vez de repetir o helper
em seis arquivos.

**Tests**: none (rota — build gate; sanitização testada em T12)
**Gate**: build
**Commit**: `feat(backend): record audit trail for patient data writes`
**Status**: ✅ Complete

---

### T15: Migrar `LoginPage` para os componentes compartilhados

**What**: Trocar o campo de senha por `PasswordField`, envolver o formulário em `GlucoreFormLayout`, usar `GlucoreMessenger` e rótulos com obrigatoriedade.
**Where**: `lib/features/auth/presentation/pages/login_page.dart`
**Depends on**: T14
**Pré-requisitos reais**: T4, T5, T6, T7 (satisfeitos pela execução sequencial)
**Reuses**: `PasswordField` (T7), `GlucoreMessenger` (T5), `GlucoreFormLayout` (T6), `fieldLabel` (T4)
**Requirement**: TCC-02, TCC-06, TCC-15

**Tools**:
- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:
- [x] Senha vazia exibe "Campo obrigatório" e a regra de força **não** é aplicada no login
- [x] Ícone de visibilidade funciona no campo de senha
- [x] Erro de login chega via `GlucoreMessenger.error`
- [x] Gate passa: `flutter analyze && flutter test --no-pub` (68 testes, analyze limpo)
- [x] Test count: 5 testes novos passam

**Mudança de validação**: o campo de senha do login validava `length < 8`, o que barrava conta
legada com senha fraca. Agora valida apenas "não vazio" (spec P1 AC8).

**Traceability**: TCC-02, TCC-06 e TCC-15 já estavam em `Implementing` (fases 1 e 2); nada a
mudar em `spec.md` nesta tarefa.

**Tests**: widget
**Gate**: full
**Commit**: `refactor(auth): use shared password field and messenger on login`
**Status**: ✅ Complete

---

### T16: Reconstruir `RegisterPage`

**What**: Aplicar política de senha, confirmação de senha, rótulos obrigatório/opcional, dicas de preenchimento, campo de telefone com máscara e layout responsivo.
**Where**: `lib/features/auth/presentation/pages/register_page.dart`
**Depends on**: T15
**Pré-requisitos reais**: T15, T3 (satisfeitos pela execução sequencial)
**Reuses**: `PasswordField`, `PasswordPolicy`, `fieldLabel`, `BrazilianPhoneInputFormatter`, `GlucoreFormLayout`
**Requirement**: TCC-01, TCC-03, TCC-05, TCC-07, TCC-08

**Tools**:
- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:
- [x] Senha fraca bloqueia o submit exibindo a regra violada, sem chamar a API
- [x] Confirmação divergente exibe "As senhas não coincidem"
- [x] Nascimento, peso e telefone vazios permitem o submit; rótulos mostram `*`/"(opcional)"
- [x] Faixa alvo mostra a dica de formato e `180-80` é recusado
- [x] Telefone digitado formata como `(11) 98765-4321` e é enviado só com dígitos
- [x] Gate passa: `flutter gen-l10n && flutter analyze && flutter test --no-pub` (80 testes, analyze limpo)
- [x] Test count: 12 testes novos passam

**Plumbing do telefone**: "enviado só com dígitos" exige `phone` na cadeia de cadastro, então
`String? phone` foi acrescentado a `AuthCubit.register`, `RegisterParams`, `AuthRepository`,
`AuthRepositoryImpl`, `AuthLocalDataSource` e `RemoteAuthDataSource` (que passa `phone` no corpo
do `POST /auth/register`, já aceito pelo backend desde T9). Os dublês de `AuthRepository` em
`auth_cubit_offline_test.dart` e `login_page_test.dart` ganharam o parâmetro por exigência do
compilador; nenhuma assertion foi alterada.

**Mensagem de confirmação**: reusa a chave existente `profilePasswordMismatch`
("As senhas não coincidem."), a única mensagem de divergência do app. O ponto final é do texto
já existente; o spec cita a frase sem ele.

**Tests**: widget
**Gate**: full
**Commit**: `feat(auth): strengthen register form validation and hints`
**Status**: ✅ Complete

---

### T17: Reconstruir a redefinição por token em `ForgotPasswordPage`

**What**: Aplicar `PasswordField`, confirmação de senha, política de força, dica no campo de token e trocar os `Text` vermelhos inline por `GlucoreMessenger.error`.
**Where**: `lib/features/auth/presentation/pages/forgot_password_page.dart`
**Depends on**: T16
**Reuses**: `PasswordField`, `PasswordPolicy`, `GlucoreMessenger`, `GlucoreFormLayout`
**Requirement**: TCC-01, TCC-03, TCC-06, TCC-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Nenhum `Colors.red`/`Colors.green` permanece no arquivo (erro → `GlucoreMessenger.error`; ícone de sucesso → `AppTheme.zoneTargetBg`)
- [x] Senha fraca e confirmação divergente bloqueiam o submit
- [x] Campo de token exibe a dica de origem e validade de 6 h
- [x] Gate passa: `flutter gen-l10n && flutter analyze && flutter test --no-pub` (86 testes, analyze limpo)
- [x] Test count: 6 testes novos passam

**Nota**: o `l10n` passou a ser resolvido antes do `await` nos dois handlers. Ler `context.l10n`
no `catch` — o que o código antigo fazia dentro de um `setState` — aciona
`use_build_context_synchronously` quando a mensagem sai por `GlucoreMessenger`.

**Traceability**: TCC-01, TCC-03, TCC-06 e TCC-07 já estavam em `Implementing`.

**Tests**: widget
**Gate**: full
**Commit**: `feat(auth): apply password policy and unified messages to reset flow`
**Status**: ✅ Complete

---

### T18: Criar `SessionExpiryNotifier` e o interceptor de 401

**What**: Notifier idempotente de expiração de sessão e `onError` no `ApiClient` que apaga o token e sinaliza apenas quando `code == 'TOKEN_INVALID'`.
**Where**: `lib/core/session/session_expiry_notifier.dart`
**Depends on**: T17
**Pré-requisitos reais**: T10 (satisfeitos pela execução sequencial)
**Reuses**: `ApiClient` e `AuthTokenStore` em `lib/core/api/`
**Requirement**: TCC-12

**Tools**:
- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:
- [x] `signal()` notifica uma única vez até `reset()`, mesmo chamado N vezes
- [x] 401 `TOKEN_INVALID` apaga o token e sinaliza; 401 `INVALID_CURRENT_PASSWORD` não faz nenhum dos dois
- [x] Erro de conexão sem resposta HTTP não sinaliza (preserva P18)
- [x] Notifier registrado no `injection_container.dart`
- [x] Gate passa: `flutter analyze && flutter test --no-pub` (93 testes, analyze limpo)
- [x] Test count: 7 testes novos passam

**Assinatura**: `ApiClient.create(tokenStore, sessionExpiry)`. O notifier é construído antes do
Dio no `injection_container`, mantendo a ordem de DI sem ciclo (AD-003).

**O erro continua propagando**: o interceptor chama `handler.next(error)` sempre, então a tela
que fez a requisição ainda recebe a `DioException` e mostra sua própria mensagem.

**Tests**: unit
**Gate**: full
**Commit**: `feat(core): detect invalid session from api responses`
**Status**: ✅ Complete

---

### T19: Reagir à expiração de sessão no `App`

**What**: Escutar o `SessionExpiryNotifier` em `app.dart`, chamar `AuthCubit.logout()` e exibir "Sua sessão expirou. Entre novamente." uma única vez.
**Where**: `lib/app.dart`
**Depends on**: T18
**Reuses**: `MaterialApp.builder` já usado para os providers do P17, `GlucoreMessenger` (T5)
**Requirement**: TCC-12

**Tools**:
- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:
- [x] Sinal de expiração leva à `LoginPage` com o aviso, sem empilhar telas
- [x] `reset()` é chamado ao autenticar, permitindo novo sinal na sessão seguinte
- [x] Gate passa: `flutter analyze && flutter test --no-pub` (96 testes, analyze limpo)
- [x] Test count: 3 testes novos passam

**P17 preservado**: o `MultiBlocProvider` de `SensorCubit`/`PatientCubit` dentro de
`MaterialApp.builder` não foi movido nem reordenado. As mudanças em `app.dart` são um
`navigatorKey` (para o `popUntil` até a rota raiz), o `AuthCubit` mantido em campo do estado
(`BlocProvider.value` em vez de `create`, para o listener poder deslogar sem `BuildContext`
abaixo do provider) e a assinatura de `SessionExpiryNotifier` em `initState`.

**Onde o `reset()` acontece**: numa assinatura de `AuthCubit.stream` em `initState`, não na
árvore de widgets — evita efeito colateral dentro de `build`.

**Tests**: widget
**Gate**: full
**Commit**: `feat(auth): redirect to login when the session becomes invalid`
**Status**: ✅ Complete

---

### T20: Mapear os novos códigos de erro no `AuthCubit`

**What**: Adicionar `AuthError.weakPassword` e `AuthError.serviceUnavailable`, mapeando `WEAK_PASSWORD` e `DATABASE_UNAVAILABLE` para mensagens próprias.
**Where**: `lib/features/auth/presentation/cubit/auth_state.dart`
**Depends on**: T19
**Reuses**: `AuthError` e `_mapDioError` existentes
**Requirement**: TCC-09

**Tools**:
- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:
- [x] 503 `DATABASE_UNAVAILABLE` exibe "Serviço temporariamente indisponível. Tente novamente em alguns minutos."
- [x] 400 `WEAK_PASSWORD` exibe a mensagem da regra de força
- [x] Chaves adicionadas aos dois `.arb` (`authServiceUnavailableError`)
- [x] Gate passa: `flutter gen-l10n && flutter analyze && flutter test --no-pub` (102 testes, analyze limpo)
- [x] Test count: 6 testes novos passam

**Chave reusada em `weakPassword`**: a mensagem é a própria `passwordPolicyHint`, já exibida
como texto auxiliar em todo campo que define senha. Criar uma segunda chave com o mesmo texto
abriria caminho para as duas divergirem.

**Decisão pelo `code`, não pelo status**: `_mapErrorCode` lê `code` do corpo; o status sozinho
não distingue 400 de senha fraca de qualquer outro 400 (AD-002).

**Tests**: unit
**Gate**: full
**Commit**: `feat(auth): map weak password and database outage errors`
**Status**: ✅ Complete

---

### T21: Criar `UserIdentityCubit`

**What**: Cubit que carrega o perfil uma vez por sessão e expõe `fullName`, `email` e `createdAt`, com fallback para o nome padrão em caso de falha.
**Where**: `lib/features/patient/presentation/cubit/user_identity_cubit.dart`
**Depends on**: T20
**Pré-requisitos reais**: T9 (satisfeitos pela execução sequencial)
**Reuses**: `AccountService.fetchProfile()`, padrão de cubit de `patient_cubit.dart`
**Requirement**: TCC-04, TCC-11

**Tools**:
- MCP: NONE
- Skill: `glucore-flutter-state`

**Done when**:
- [x] Carrega uma única vez; segunda chamada de `load()` não refaz a requisição
- [x] Falha de rede resulta em `fullName == 'Paciente Glucore'`
- [x] Registrado no `injection_container.dart` e provido em `app.dart` junto aos demais cubits
- [x] Gate passa: `flutter analyze && flutter test --no-pub` (107 testes, analyze limpo)
- [x] Test count: 5 testes novos passam

**Nota de assinatura**: o fallback é passado como argumento de `load(String fallbackName)`,
não do construtor — quem chama (`app.dart`) já tem `context.l10n` disponível, e o cubit
continua sem depender de `BuildContext`. `email`/`createdAt` citados no "What" ficaram fora:
`AccountProfile` ainda não expõe `createdAt` (isso é trabalho de T26, fora do arquivo desta
tarefa); expor apenas o que é testável agora evita um campo morto.

**Tests**: unit
**Gate**: full
**Commit**: `feat(patient): add user identity cubit`
**Status**: ✅ Complete

---

### T22: Criar `UserAppBar`

**What**: `AppBar` reutilizável com título, nome do usuário logado e `PopupMenuButton` com "Sair da conta" + confirmação.
**Where**: `lib/features/patient/presentation/widgets/user_app_bar.dart`
**Depends on**: T21
**Reuses**: `UserIdentityCubit` (T21), diálogo de confirmação de `settings_page.dart`
**Requirement**: TCC-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Exibe o nome do usuário; exibe "Paciente Glucore" enquanto não carregado
- [x] Menu abre com "Sair da conta"; confirmar chama `AuthCubit.logout()`; cancelar não chama
- [x] Aceita `actions` extras para as telas que já têm ícones próprios
- [x] Gate passa: `flutter analyze && flutter test --no-pub` (113 testes, analyze limpo)
- [x] Test count: 6 testes novos passam

**Nota de design**: o `title` do chamador (logo "glucore", "Diário", "Perfil"…) é preservado —
o nome do usuário aparece como um elemento próprio nas `actions` (texto + seta), não substitui
o título da tela. O texto de confirmação ("Deseja sair da sua conta?", "Cancelar") repete o
literal já hardcoded em `settings_page.dart._confirmLogout`, o padrão reusado por instrução da
tarefa; não é l10n nova nesta tarefa.

**Tests**: widget
**Gate**: full
**Commit**: `feat(patient): add app bar with logged user and logout`
**Status**: ✅ Complete

---

### T23: Aplicar `UserAppBar` nas quatro abas do shell

**What**: Substituir a `AppBar` própria de Monitor, Diário, Relatórios e Perfil pela `UserAppBar`, preservando os ícones existentes.
**Where**: `lib/features/patient/presentation/pages/` (monitoring_home, diary, reports, profile — mesma troca mecânica por arquivo)
**Depends on**: T22
**Reuses**: `UserAppBar` (T22)
**Requirement**: TCC-04

**Tools**:
- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:
- [x] As quatro abas exibem nome do usuário e o menu com "Sair da conta"
- [x] Ícones pré-existentes (notificações, bluetooth, configurações) continuam presentes e funcionais
- [x] Gate passa: `flutter analyze && flutter test --no-pub` (119 testes, analyze limpo)
- [x] Test count: 6 testes novos passam

**Nota**: cada aba mantém seu próprio `title` (o logo "glucore" no Monitor, "Diário",
"Relatórios", "Perfil"), passado para `UserAppBar`; o nome do usuário aparece nas `actions`
(T22), não substitui o título. `ProfilePage` mantém seu próprio `_loadName()` inalterado —
fora do escopo desta tarefa, que troca só a `AppBar`.

**Tests**: widget
**Gate**: full
**Commit**: `feat(patient): show logged user and logout on all shell tabs`
**Status**: ✅ Complete

---

### T24: Aplicar `UserAppBar` nas páginas empilhadas

**What**: Substituir a `AppBar` das páginas empilhadas (histórico, alertas, notificações, configurações, alertas de glicose, sensor, edição de perfil e de registros) pela `UserAppBar`.
**Where**: `lib/features/patient/presentation/pages/` (páginas empilhadas — mesma troca mecânica por arquivo)
**Depends on**: T23
**Reuses**: `UserAppBar` (T22)
**Requirement**: TCC-04

**Tools**:
- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:
- [ ] Toda página autenticada empilhada exibe nome do usuário e ação de sair
- [ ] Botão de voltar continua funcionando em todas elas
- [ ] Gate passa: `flutter analyze && flutter test --no-pub`
- [ ] Test count: 4+ testes passam

**Tests**: widget
**Gate**: full
**Commit**: `feat(patient): show logged user and logout on stacked pages`

---

### T25: Criar `ChangePasswordPage` dedicada

**What**: Tela exclusiva de troca de senha (senha atual, nova, confirmação) usando `PasswordField` e `PasswordPolicy`, removendo esse formulário de `ProfileEditPage`.
**Where**: `lib/features/patient/presentation/pages/change_password_page.dart`
**Depends on**: T24
**Reuses**: `AccountService.changePassword`, `PasswordField`, `PasswordPolicy`, `GlucoreMessenger`
**Requirement**: TCC-10

**Tools**:
- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:
- [ ] Os três campos nascem vazios e ocultos
- [ ] Senha atual incorreta mantém a tela aberta com "Senha atual incorreta." e a sessão ativa
- [ ] Sucesso fecha a tela e exibe "Senha atualizada com sucesso." na origem
- [ ] `ProfileEditPage` não contém mais formulário de senha e o perfil linka para a nova tela
- [ ] Gate passa: `flutter analyze && flutter test --no-pub`
- [ ] Test count: 6+ testes passam

**Tests**: widget
**Gate**: full
**Commit**: `feat(patient): add dedicated change password page`

---

### T26: Atualizar `ProfileEditPage`

**What**: Rótulos obrigatório/opcional, dicas de preenchimento, campo de telefone com máscara, blocos somente leitura (e-mail atual e data de criação) e layout responsivo.
**Where**: `lib/features/patient/presentation/pages/profile_edit_page.dart`
**Depends on**: T25
**Reuses**: `fieldLabel`, `BrazilianPhoneInputFormatter`, `GlucoreFormLayout`, `GlucoreMessenger`, `GlucoreSectionCard`
**Requirement**: TCC-05, TCC-07, TCC-08, TCC-11

**Tools**:
- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:
- [ ] Nascimento, peso e telefone aceitam vazio e salvam `null`; rótulos indicam a opcionalidade
- [ ] E-mail atual e data de criação da conta aparecem somente leitura, visualmente distintos dos editáveis
- [ ] Telefone carregado do backend aparece formatado
- [ ] `_showSnack` substituído por `GlucoreMessenger`
- [ ] Gate passa: `flutter analyze && flutter test --no-pub`
- [ ] Test count: 7+ testes passam

**Tests**: widget
**Gate**: full
**Commit**: `feat(patient): align profile form with model optionality`

---

### T27: Remover textos e cores hardcoded de `MonitoringHomePage`

**What**: Migrar todos os literais em português para l10n e trocar `Colors.red` por `AppTheme.zoneLowBg`.
**Where**: `lib/features/patient/presentation/pages/monitoring_home_page.dart`
**Depends on**: T26
**Reuses**: chaves já existentes nos `.arb` (`entryDeleteConfirm*`, `entryEditButton`, `entryCloseButton`)
**Requirement**: TCC-14

**Tools**:
- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:
- [ ] Nenhum literal em português permanece no arquivo
- [ ] Nenhuma ocorrência de `Colors.red`
- [ ] Chaves novas adicionadas aos dois `.arb`
- [ ] Gate passa: `flutter gen-l10n && flutter analyze && flutter test --no-pub`
- [ ] Test count: 3+ testes passam

**Tests**: widget
**Gate**: full
**Commit**: `refactor(patient): move monitoring page strings and colors to theme/l10n`

---

### T28: Remover textos hardcoded de `SettingsPage` e `ProfilePage`

**What**: Migrar os literais em português das duas telas apontadas pela auditoria para l10n.
**Where**: `lib/features/patient/presentation/pages/` (settings_page, profile_page — mesma troca mecânica por arquivo)
**Depends on**: T27
**Reuses**: chaves de `settings*`/`profile*` já existentes nos `.arb`
**Requirement**: TCC-14

**Tools**:
- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:
- [ ] Nenhum literal em português permanece nos dois arquivos
- [ ] Chaves novas adicionadas aos dois `.arb`
- [ ] Gate passa: `flutter gen-l10n && flutter analyze && flutter test --no-pub`
- [ ] Test count: 3+ testes passam

**Tests**: widget
**Gate**: full
**Commit**: `refactor(patient): move settings and profile strings to l10n`

---

### T29: Tornar Diário e Relatórios responsivos

**What**: Aplicar `LayoutBuilder` com breakpoint de 600 dp para dispor o conteúdo em duas colunas nas duas telas.
**Where**: `lib/features/patient/presentation/pages/` (diary_page, reports_page — mesmo padrão por arquivo)
**Depends on**: T28
**Reuses**: `GlucoreFormLayout` (T6) como referência de breakpoint
**Requirement**: TCC-15

**Tools**:
- MCP: NONE
- Skill: `glucore-patient-features`

**Done when**:
- [ ] A 800 dp as duas telas renderizam duas colunas
- [ ] A 400 dp permanecem em coluna única, idênticas ao layout atual
- [ ] Nenhum overflow em nenhuma das duas larguras
- [ ] Gate passa: `flutter analyze && flutter test --no-pub`
- [ ] Test count: 4+ testes passam

**Tests**: widget
**Gate**: full
**Commit**: `feat(patient): add tablet layout to diary and reports`

---

### T30: Confirmar antes de limpar dados no painel de debug

**What**: Diálogo de confirmação antes da ação destrutiva "Limpar dados".
**Where**: `lib/core/debug/debug_panel.dart`
**Depends on**: T29
**Reuses**: padrão de `AlertDialog` de confirmação já usado nas exclusões
**Requirement**: TCC-16

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Cancelar não apaga nada; confirmar executa a limpeza
- [ ] Gate passa: `flutter analyze && flutter test --no-pub`
- [ ] Test count: 2+ testes passam

**Tests**: widget
**Gate**: full
**Commit**: `fix(debug): confirm before clearing local data`

---

### T31: Documentar o contrato de erros, a auditoria e o login por e-mail

**What**: Registrar em `docs/` o contrato `{ error, code }`, a autorização por papel, a trilha de auditoria (incluindo como aplicar a migração) e que o identificador de login é o e-mail.
**Where**: `docs/architecture/backend.md`
**Depends on**: T30
**Reuses**: tabela de contratos de erro do design
**Requirement**: TCC-18

**Tools**:
- MCP: NONE
- Skill: `glucore-backend`

**Done when**:
- [ ] Tabela de códigos de erro documentada
- [ ] Seção explicando que login = e-mail e por que "esqueci meu login" não se aplica
- [ ] Instrução de aplicação da migração `add_audit_log`
- [ ] Gate passa: `flutter analyze` (nenhuma mudança de código)

**Tests**: none (documentação — build gate)
**Gate**: build
**Commit**: `docs: document error codes, audit trail and email-as-login`

---

### T32: Atualizar o checklist de avaliação e o CHANGELOG

**What**: Atualizar o status de cada item em escopo em `TCC I - Checklist - Avaliacao.md` com a nova evidência (arquivo:linha) e registrar a entrega no `CHANGELOG.md`.
**Where**: `TCC I - Checklist - Avaliacao.md`
**Depends on**: T31
**Reuses**: formato de tabela já usado no arquivo
**Requirement**: TCC-18

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Os 16 itens em escopo marcados **OK** com evidência apontando arquivo:linha real
- [ ] 3.2, 4.4 e 5.2 marcados explicitamente como fora do escopo desta iteração
- [ ] Resumo de contagem no topo do arquivo recalculado
- [ ] `CHANGELOG.md` atualizado
- [ ] Gate passa: `flutter analyze && flutter test --no-pub` e `cd backend && npm test && npx tsc --noEmit`

**Tests**: none (documentação — build gate)
**Gate**: build
**Commit**: `docs: update TCC evaluation checklist statuses`

---

## Grafo de dependências (fonte da paridade)

A execução é estritamente sequencial: cada tarefa depende da anterior. Pré-requisitos semânticos
adicionais estão anotados em cada tarefa como `Pré-requisitos reais` e são satisfeitos por essa ordem.

```
T1 → T2
T2 → T3
T3 → T4
T4 → T5
T5 → T6
T6 → T7
T7 → T8
T8 → T9
T9 → T10
T10 → T11
T11 → T12
T12 → T13
T13 → T14
T14 → T15
T15 → T16
T16 → T17
T17 → T18
T18 → T19
T19 → T20
T20 → T21
T21 → T22
T22 → T23
T23 → T24
T24 → T25
T25 → T26
T26 → T27
T27 → T28
T28 → T29
T29 → T30
T30 → T31
T31 → T32
```

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4a → Phase 4b → Phase 5

Phase 1:   T1 → T2 → T3 → T4 → T5 → T6 → T7
Phase 2:   T8 → T9 → T10 → T11 → T12 → T13 → T14
Phase 3:   T15 → T16 → T17 → T18 → T19 → T20
Phase 4a:  T21 → T22 → T23 → T24
Phase 4b:  T25 → T26 → T27 → T28 → T29 → T30
Phase 5:   T31 → T32
```

Batches (~7 tarefas, fases inteiras): B1 = Phase 1 (7) · B2 = Phase 2 (7) · B3 = Phase 3 (6) · B4 = Phase 4a (4) · B5 = Phase 4b (6) · B6 = Phase 5 (2).

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | 1 arquivo, 1 função pura | ✅ Granular |
| T2 | 1 arquivo + 1 script npm | ✅ Granular |
| T3 | 1 arquivo, 1 formatter | ✅ Granular |
| T4 | 1 arquivo, 1 função | ✅ Granular |
| T5 | 1 arquivo, 1 helper | ✅ Granular |
| T6 | 1 arquivo, 1 widget | ✅ Granular |
| T7 | 1 arquivo, 1 widget | ✅ Granular |
| T8 | 1 middleware + registro | ✅ Granular |
| T9 | 1 arquivo de rota | ✅ Granular |
| T10 | 1 middleware + `router.use` nas rotas | ⚠️ Coeso: um middleware e sua aplicação |
| T11 | 1 modelo + 1 migração | ⚠️ Coeso: schema e migração são um par indivisível |
| T12 | 1 arquivo, 1 função | ✅ Granular |
| T13 | 1 arquivo de rota | ✅ Granular |
| T14 | 4 rotas, mesma chamada mecânica | ⚠️ Coeso: uma linha por rota, mesma mudança |
| T15 | 1 tela | ✅ Granular |
| T16 | 1 tela | ✅ Granular |
| T17 | 1 tela | ✅ Granular |
| T18 | 1 notifier + 1 interceptor | ⚠️ Coeso: o interceptor existe para o notifier |
| T19 | 1 arquivo | ✅ Granular |
| T20 | 1 arquivo | ✅ Granular |
| T21 | 1 cubit + registro | ✅ Granular |
| T22 | 1 widget | ✅ Granular |
| T23 | 4 telas, mesma troca mecânica | ⚠️ Coeso: substituição idêntica de `AppBar` |
| T24 | N telas empilhadas, mesma troca | ⚠️ Coeso: substituição idêntica de `AppBar` |
| T25 | 1 tela nova + remoção do bloco antigo | ✅ Granular |
| T26 | 1 tela | ✅ Granular |
| T27 | 1 tela | ✅ Granular |
| T28 | 2 telas, mesma troca | ⚠️ Coeso: migração idêntica para l10n |
| T29 | 2 telas, mesmo padrão | ⚠️ Coeso: mesmo breakpoint |
| T30 | 1 arquivo | ✅ Granular |
| T31 | 1 doc | ✅ Granular |
| T32 | 2 docs | ⚠️ Coeso: mesma entrega documental |

Nenhum ❌ — as marcações ⚠️ são mudanças mecânicas idênticas repetidas em arquivos irmãos, que dividir tornaria mais frágil (commits parciais deixariam telas inconsistentes).

---

## Diagram-Definition Cross-Check

A execução é uma cadeia sequencial única; o grafo de dependências acima é a fonte da paridade.
`validate_tasks.py` confirma: 0 erros de paridade.

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | (início da cadeia) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T8 | T8 → T9 | ✅ Match |
| T10 | T9 | T9 → T10 | ✅ Match |
| T11 | T10 | T10 → T11 | ✅ Match |
| T12 | T11 | T11 → T12 | ✅ Match |
| T13 | T12 | T12 → T13 | ✅ Match |
| T14 | T13 | T13 → T14 | ✅ Match |
| T15 | T14 | T14 → T15 | ✅ Match |
| T16 | T15 | T15 → T16 | ✅ Match |
| T17 | T16 | T16 → T17 | ✅ Match |
| T18 | T17 | T17 → T18 | ✅ Match |
| T19 | T18 | T18 → T19 | ✅ Match |
| T20 | T19 | T19 → T20 | ✅ Match |
| T21 | T20 | T20 → T21 | ✅ Match |
| T22 | T21 | T21 → T22 | ✅ Match |
| T23 | T22 | T22 → T23 | ✅ Match |
| T24 | T23 | T23 → T24 | ✅ Match |
| T25 | T24 | T24 → T25 | ✅ Match |
| T26 | T25 | T25 → T26 | ✅ Match |
| T27 | T26 | T26 → T27 | ✅ Match |
| T28 | T27 | T27 → T28 | ✅ Match |
| T29 | T28 | T28 → T29 | ✅ Match |
| T30 | T29 | T29 → T30 | ✅ Match |
| T31 | T30 | T30 → T31 | ✅ Match |
| T32 | T31 | T31 → T32 | ✅ Match |

Nenhuma dependência aponta para uma tarefa posterior. Os pré-requisitos semânticos (ex.: T15 precisa de
`PasswordField` de T7) estão anotados em cada tarefa como `Pré-requisitos reais` e são garantidos pela ordem.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Dart lógica pura | unit | unit | ✅ OK |
| T2 | TS lib pura | unit | unit | ✅ OK |
| T3 | Dart lógica pura | unit | unit | ✅ OK |
| T4 | Dart lógica pura | unit | unit | ✅ OK |
| T5 | Dart widget compartilhado | widget | widget | ✅ OK |
| T6 | Dart widget compartilhado | widget | widget | ✅ OK |
| T7 | Dart widget compartilhado | widget | widget | ✅ OK |
| T8 | TS middleware | unit | unit | ✅ OK |
| T9 | TS rota | none (build gate) | none | ✅ OK |
| T10 | TS middleware (+ wiring de rota) | unit | unit | ✅ OK |
| T11 | Prisma schema/migração | none (build gate) | none | ✅ OK |
| T12 | TS lib pura | unit | unit | ✅ OK |
| T13 | TS rota | none (build gate) | none | ✅ OK |
| T14 | TS rota | none (build gate) | none | ✅ OK |
| T15 | Dart página | widget | widget | ✅ OK |
| T16 | Dart página | widget | widget | ✅ OK |
| T17 | Dart página | widget | widget | ✅ OK |
| T18 | Dart notifier + interceptor | unit | unit | ✅ OK |
| T19 | Dart raiz do app | widget | widget | ✅ OK |
| T20 | Dart estado/cubit | unit | unit | ✅ OK |
| T21 | Dart cubit | unit | unit | ✅ OK |
| T22 | Dart widget compartilhado | widget | widget | ✅ OK |
| T23 | Dart páginas | widget | widget | ✅ OK |
| T24 | Dart páginas | widget | widget | ✅ OK |
| T25 | Dart página | widget | widget | ✅ OK |
| T26 | Dart página | widget | widget | ✅ OK |
| T27 | Dart página | widget | widget | ✅ OK |
| T28 | Dart páginas | widget | widget | ✅ OK |
| T29 | Dart páginas | widget | widget | ✅ OK |
| T30 | Dart página (debug) | widget | widget | ✅ OK |
| T31 | Documentação | none | none | ✅ OK |
| T32 | Documentação | none | none | ✅ OK |

`Tests: none` aparece apenas onde a matriz diz `none` para a camada. As rotas Express são a exceção justificada na matriz: nenhuma decisão nova vive nelas — política de senha, tradução de erro, papel e sanitização de auditoria estão em libs/middlewares cobertos por testes unitários.
