# Dashboard Web Glucore — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/web-dashboard/design.md`
**Spec**: `.specs/features/web-dashboard/spec.md`
**Status**: Approved

**Tamanho**: 224 tarefas em 30 fases, cobrindo os 138 requisitos da spec (conferido por script: nenhum ID sem tarefa).

---

## Pré-requisitos (antes da T1)

- Branch de trabalho `feat/web-dashboard` criada a partir da `main` atual; nenhum commit direto na `main`.
- Postgres local rodando (serviço `postgresql-x64-18`) com os bancos `glucore_test` e `glucore_auth_test`.
- `backend/services/auth-service/.env.test` criado a partir de `.env.test.example` (hoje só o glucose-service tem `.env.test`). Arquivo gitignorado.
- Node 22+ e npm disponíveis (a máquina tem Node 24); Flutter disponível para as fases do app.
- **Ações do usuário, fora do alcance do agente**: criar o projeto na Vercel e conectar o repositório; acrescentar a origem da Vercel em `CORS_ORIGIN` na VM de produção. `git push`, deploy e mudança em banco de produção só com autorização explícita para cada ação.

## Marcos

| Marco | Fases | Tarefas | Entrega demonstrável |
| ----- | ----- | ------- | -------------------- |
| M1 — MVP: login, layout, dashboard do paciente, Vercel | 1–16 | T1–T127 (127) | Web publicada: paciente entra, vê 16 widgets com dados do app, personaliza e salva o layout |
| M2 — Profissional, consentimento e app móvel | 17–26 | T128–T192 (65) | Profissional se cadastra, resgata o código gerado no app, vê a carteira e o detalhe; paciente revoga |
| M3 — Administrador | 27–29 | T193–T219 (27) | Admin do seed vê a plataforma em agregados e a lista de contas |
| M4 — Evidência de arquitetura e docs | 30–30 | T220–T224 (5) | Documento de arquitetura verificado por teste; Lighthouse configurado; docs atualizados |

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `docs/guides/qa-process.md`, `backend/vitest.config.ts` (limiares 90/90/95/85), `.github/workflows/ci.yml`, `CLAUDE.md`, e os requisitos `ARQ-13`/`ARQ-16`/`ARQ-17` da spec para a web.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Web `domain` e `application` | unit | Todos os ramos; 1:1 com os ACs; fronteiras numéricas com amostra abaixo e no limite; cobertura de linhas ≥ 80 % (ARQ-13) | `web/src/**/{domain,application}/**/*.test.ts` | `cd web && npx vitest run <arquivo>` |
| Web `infrastructure` (repositórios, cliente HTTP) | integration (MSW) | Caminho feliz + cada código de erro do contrato + corpo malformado | `web/src/**/infrastructure/**/*.test.ts` | `cd web && npx vitest run <arquivo>` |
| Web `presentation` (widgets, páginas, hooks) | component (Testing Library + axe) | Dados, vazio, erro isolado, teclado e axe sem violações nas telas | `web/src/**/presentation/**/*.test.tsx` | `cd web && npx vitest run <arquivo>` |
| Web guardas de arquitetura e deploy | unit (fixtures) | Cada regra tem um fixture que viola e um que passa | `web/tests/{arch,deploy,docs}/*.test.ts` | `cd web && npx vitest run <arquivo>` |
| Web config, tipos, entidades | none | Build gate (typecheck, lint, lint:arch) | — | build gate |
| Backend serviço (lógica pura) | unit (fakes) | Todos os ramos; 1:1 com os ACs | `backend/services/*/tests/modules/*.test.ts` | `cd backend && npx vitest run <arquivo>` |
| Backend repositório e rotas | integration (Postgres real, supertest) | Todas as rotas: feliz + borda + erro + papel errado; garantias do schema | `backend/services/*/tests/{modules,routes}/*.test.ts` | `cd backend && npm run build && npm run test:coverage` |
| Backend migration e schema | none | Exercitado pelos testes de repositório; build gate | — | build gate |
| App Flutter domínio, dados e cubit | unit | Todos os ramos; falhas mapeadas | `test/features/sharing/**`, `test/features/patient/**` | `flutter test --no-pub <arquivo>` |
| App Flutter telas | component (widget test) | Estados visíveis e interação | `test/features/**/presentation/*_test.dart` | `flutter analyze && flutter test --no-pub` |
| Documentação | none (web/docs: unit) | `docs/architecture/web-dashboard.md` conferido por `web/tests/docs`; demais docs por build gate | — | build gate |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tarefa com teste unitário ou de componente | web: `cd web && npx vitest run <arquivo>` · backend: `cd backend && npx vitest run <arquivo>` · app: `flutter test --no-pub <arquivo>` |
| Full | Tarefa com teste de integração, ou que mexe em mais de uma camada | web: `cd web && npm run typecheck && npm run lint && npm run lint:arch && npm run test:coverage` · backend: `cd backend && npm run build && npm run test:coverage` · app: `flutter analyze && flutter test --no-pub` |
| Build | Fim de fase, ou tarefa só de config, schema ou docs | os gates `full` das pilhas tocadas, mais `cd web && npm run dup && npm run build && npm run size` quando a fase toca a web |

O backend roda sempre da raiz de `backend/` (opções de raiz do Vitest), nunca duas suítes ao mesmo tempo. Nenhum teste é apagado, pulado ou enfraquecido para passar.

**Tools (padrão de todas as tarefas)**: MCP: NONE · Skill: `glucore-backend` nas tarefas de backend, `glucore-flutter-state` e `glucore-patient-features` nas do app, nenhuma na web. Onde uma tarefa precisa de outra ferramenta, ela diz.

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Backend: catálogo de widgets e preferências de layout

Contrato do catálogo e persistência do layout no auth-service, mais o proxy e o CORS no gateway. Base de LAY-07..14 e DEP-07.

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9
```

### Phase 2: Web: esqueleto e guardas de arquitetura

Projeto `web/` com TypeScript estrito e as ferramentas que tornam a rubrica 37 verificável desde o primeiro commit.

```
T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17 → T18 → T19
```

### Phase 3: Web: infraestrutura compartilhada

Ports e adaptadores reutilizados por todas as features: HTTP, sessão, erros, fuso.

```
T20 → T21 → T22 → T23 → T24 → T25 → T26 → T27
```

### Phase 4: Web: feature auth (domínio, casos de uso, infraestrutura)

Login pelo mesmo gate do app, papel lido de `/me`, renovação e saída.

```
T28 → T29 → T30 → T31 → T32 → T33 → T34 → T35
```

### Phase 5: Web: apresentação da auth, tema e casca da aplicação

Login, guardas de rota, sessão expirada, tema claro/escuro e o cabeçalho comum.

```
T36 → T37 → T38 → T39 → T40 → T41 → T42 → T43 → T44 → T45
```

### Phase 6: Web: estrutura de layout e widgets

Domínio do layout, registro de widgets, grade responsiva e invólucro de widget.

```
T46 → T47 → T48 → T49 → T50 → T51 → T52 → T53 → T54
```

### Phase 7: Web: adaptadores de gráfico

Únicos arquivos que importam `recharts`; todos dentro de `ChartFrame`.

```
T55 → T56 → T57 → T58 → T59 → T60 → T61 → T62 → T63 → T64
```

### Phase 8: Backend: extensões do summary (parte 1)

Fuso, limites do período, zonas, uso do sensor, AGP, heatmap e última leitura.

```
T65 → T66 → T67 → T68 → T69 → T70 → T71 → T72
```

### Phase 9: Backend: extensões do summary (parte 2) e GMI único

Buckets com carbo/insulina, serviço reutilizável por paciente e profissional, testes de rota e a fórmula do GMI igual no app.

```
T73 → T74 → T75 → T76 → T77 → T78
```

### Phase 10: Web: dados e filtros do dashboard do paciente

Regras puras, repositório do summary, caso de uso, hook compartilhado e filtro de período.

```
T79 → T80 → T81 → T82 → T83 → T84 → T85 → T86 → T87
```

### Phase 11: Web: KPIs e frescor do paciente

Um widget por KPI, sobre um cartão compartilhado.

```
T88 → T89 → T90 → T91 → T92 → T93 → T94
```

### Phase 12: Web: gráficos do paciente

Um widget por gráfico do catálogo do paciente (exceto o dia detalhado).

```
T95 → T96 → T97 → T98 → T99 → T100 → T101 → T102 → T103
```

### Phase 13: Web: dia detalhado, página do paciente e rotas

Fecha o dashboard do paciente ponta a ponta.

```
T104 → T105 → T106 → T107 → T108 → T109 → T110 → T111 → T112
```

### Phase 14: Web: personalização do layout

Modo Personalizar com adicionar, remover, arrastar, mover por teclado, redimensionar, salvar e restaurar.

```
T113 → T114 → T115 → T116 → T117 → T118 → T119 → T120
```

### Phase 15: Publicação na Vercel

Configuração, orçamento de bundle, carregamento sob demanda e documentação. Conectar o projeto na Vercel é ação do usuário.

```
T121 → T122 → T123 → T124 → T125
```

### Phase 16: Refatoração do MVP

Duas refatorações reais sobre o código do MVP, em commits `refactor:` com testes verdes antes e depois (ARQ-19).

```
T126 → T127
```

### Phase 17: Backend: cadastro do profissional (serviços)

Conta com papel fixo na rota, perfil profissional no glucose-service.

```
T128 → T129 → T130 → T131 → T132
```

### Phase 18: Backend: cadastro do profissional (gateway) e seed do admin

Saga com compensação, rota pública com rate limit, `/me` e exclusão por papel, admin inicial.

```
T133 → T134 → T135 → T136 → T137 → T138 → T139
```

### Phase 19: Backend: consentimento (glucose-service)

Convite, resgate atômico, vínculo e revogação.

```
T140 → T141 → T142 → T143 → T144 → T145
```

### Phase 20: Backend: consentimento no gateway e nomes

Lookup de nomes, limitador por usuário, proxies novos e exclusão em cascata.

```
T146 → T147 → T148 → T149 → T150 → T151
```

### Phase 21: App móvel: compartilhar com profissional

Gerar o código, listar e revogar vínculos, no padrão `domain/data/presentation` do app.

```
T152 → T153 → T154 → T155 → T156 → T157 → T158 → T159
```

### Phase 22: Backend: carteira do profissional

Consultas por conjunto, serviço com política de vínculo e auditoria, rotas e composição de nomes.

```
T160 → T161 → T162 → T163 → T164 → T165 → T166
```

### Phase 23: Web: cadastro do profissional

Política de senha, caso de uso, repositório e tela.

```
T167 → T168 → T169 → T170
```

### Phase 24: Web: dados do profissional

Regra de risco, lista filtrável, repositórios, casos de uso e hooks.

```
T171 → T172 → T173 → T174 → T175 → T176 → T177
```

### Phase 25: Web: widgets do profissional

Um widget por KPI e por gráfico, mais a tabela e o resgate.

```
T178 → T179 → T180 → T181 → T182 → T183 → T184 → T185 → T186 → T187
```

### Phase 26: Web: páginas do profissional

Hipos por hora, catálogo, carteira e detalhe do paciente.

```
T188 → T189 → T190 → T191 → T192
```

### Phase 27: Backend: visão do administrador

Estatísticas só agregadas nos dois serviços e composição no gateway.

```
T193 → T194 → T195 → T196 → T197 → T198 → T199 → T200
```

### Phase 28: Web: dados e KPIs do administrador

Entidades, repositório, casos de uso, hooks, filtro e os quatro KPIs.

```
T201 → T202 → T203 → T204 → T205 → T206 → T207 → T208 → T209
```

### Phase 29: Web: gráficos e página do administrador

Seis gráficos, tabela de contas, catálogo, página e rota.

```
T210 → T211 → T212 → T213 → T214 → T215 → T216 → T217 → T218 → T219
```

### Phase 30: Documentação de arquitetura e fechamento

Evidência da rubrica 37 verificada por teste, Lighthouse e docs do repositório.

```
T220 → T221 → T222 → T223 → T224
```

---

## Task Breakdown

#### Phase 1: Backend: catálogo de widgets e preferências de layout

### T1: Criar o contrato do catálogo de widgets

**What**: Arquivo JSON com os ids e tamanhos dos widgets por papel e o limite de 20 itens por layout.
**Where**: `contracts/widget-catalog.json`
**Depends on**: None
**Reuses**: Seção "Catálogo de gráficos" da spec
**Requirement**: LAY-01, LAY-11

**Done when**:

- [x] `roles.PATIENT` com 16 ids, `roles.HEALTH_PROFESSIONAL` com 11, `roles.ADMINISTRATOR` com 11, `sizes: ["S","M","L"]` e `maxWidgets: 20`
- [x] Ids idênticos aos da seção Catálogo da spec, incluindo os KPIs individuais de profissional e admin
- [x] Gate `build` passa: `cd backend && npm run build && npm run test:coverage`

**Tests**: none
**Gate**: build
**Commit**: `feat(contracts): add the dashboard widget catalog`
**Status**: ✅ Done

---

### T2: Expor o catálogo no pacote compartilhado do backend

**What**: `WIDGET_IDS_BY_ROLE`, `WIDGET_SIZES` e `MAX_LAYOUT_WIDGETS` exportados por `@glucore/shared`, presos ao JSON por teste.
**Where**: `backend/packages/shared/src/dashboard/widgetCatalog.ts`
**Depends on**: T1
**Reuses**: `packages/shared/src/index.ts` (barrel), padrão de `util/pageQuery.ts`
**Requirement**: LAY-11

**Done when**:

- [x] Exportados pelo barrel `packages/shared/src/index.ts`
- [x] Teste em `backend/services/auth-service/tests/modules/widgetCatalog.test.ts` lê `contracts/widget-catalog.json` e falha se ids ou tamanhos divergirem
- [x] Teste confere 16/11/11 ids e o limite 20
- [x] Gate `quick` passa: `cd backend && npx vitest run services/auth-service/tests/modules/widgetCatalog.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(shared): expose the widget catalog to the services`
**Status**: ✅ Done

---

### T3: Criar a tabela DashboardLayout no auth-service

**What**: Model Prisma `DashboardLayout` (userId PK, widgets Json, updatedAt, FK para `User` com cascade) e a migration versionada.
**Where**: `backend/services/auth-service/prisma/schema.prisma`
**Depends on**: T2
**Reuses**: Models existentes do auth-service, padrão de migration do repositório
**Requirement**: LAY-07, LAY-14

**Done when**:

- [x] Migration em `prisma/migrations/` gerada com `prisma migrate dev --create-only` e aplicada no banco de teste
- [x] Relação `User.dashboardLayout` com `onDelete: Cascade`
- [x] Pré-requisito: `auth-service/.env.test` aponta para `glucore_auth_test` (ver Pré-requisitos)
- [x] Gate `build` passa: `cd backend && npm run build && npm run test:coverage`

**Tests**: none
**Gate**: build
**Commit**: `feat(auth-service): add the DashboardLayout table`
**Status**: ✅ Done

---

### T4: Validar o corpo do layout (INVALID_LAYOUT)

**What**: `parseLayout(body, role)` que aceita só ids do catálogo do papel, sem repetição, com tamanho válido e no máximo 20 itens.
**Where**: `backend/services/auth-service/src/modules/preferences/preferences.schema.ts`
**Depends on**: T3
**Reuses**: `BadRequestError` do shared, `WIDGET_IDS_BY_ROLE`
**Requirement**: LAY-11, LAY-12

**Done when**:

- [x] Teste 1:1: id fora do catálogo do papel, id repetido, tamanho fora de S/M/L, 20 itens passam e 21 falham, corpo não-objeto, `widgets` não-array
- [x] Toda rejeição é `400` com `code: "INVALID_LAYOUT"`
- [x] Campo de identificação de usuário no corpo é ignorado
- [x] Gate `quick` passa: `cd backend && npx vitest run services/auth-service/tests/modules/preferences.schema.test.ts`
- [x] Pelo menos 8 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(auth-service): validate dashboard layout payloads`
**Status**: ✅ Done

---

### T5: Repositório do layout

**What**: `PrismaPreferencesRepository` com `find`, `upsert` e `delete` por `userId`.
**Where**: `backend/services/auth-service/src/modules/preferences/preferences.repository.ts`
**Depends on**: T4
**Reuses**: Padrão de repositório dos módulos do auth-service
**Requirement**: LAY-07, LAY-08, LAY-09, LAY-14

**Done when**:

- [x] Integração com Postgres: `find` sem linha devolve `null`, `upsert` cria e atualiza, `delete` é idempotente
- [x] Apagar o `User` remove o layout (cascade)
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(auth-service): persist dashboard layouts`
**Status**: ✅ Done

---

### T6: Serviço de preferências

**What**: `PreferencesService` com `get`, `save` (valida pelo papel do token) e `reset`.
**Where**: `backend/services/auth-service/src/modules/preferences/preferences.service.ts`
**Depends on**: T5
**Reuses**: Padrão de serviço do auth-service
**Requirement**: LAY-07, LAY-08, LAY-09, LAY-12

**Done when**:

- [x] Teste com repositório falso: `get` sem layout devolve `{ widgets: null }`, `save` grava só para o `userId` recebido, `reset` apaga
- [x] `save` rejeita id de outro papel
- [x] Gate `quick` passa: `cd backend && npx vitest run services/auth-service/tests/modules/preferences.service.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(auth-service): add the preferences service`
**Status**: ✅ Done

---

### T7: Rotas /preferences/dashboard no auth-service

**What**: Controller e rotas `GET/PUT/DELETE /preferences/dashboard` (qualquer papel, `verifyJwt`), registrados no `container.ts` e montados no `app.ts`.
**Where**: `backend/services/auth-service/src/modules/preferences/`
**Depends on**: T6
**Reuses**: `me`/accounts routes, `createContainer`, `buildApp`
**Requirement**: LAY-07, LAY-08, LAY-09, LAY-11, LAY-12

**Done when**:

- [x] Supertest: sem token `401 TOKEN_INVALID`; `GET` sem layout `{ widgets: null }`; `PUT` e depois `GET` devolvem o mesmo layout; `PUT` inválido `400 INVALID_LAYOUT`; `DELETE` `204`
- [x] Usuário B não lê nem sobrescreve o layout do usuário A
- [x] Profissional não grava id de widget de paciente
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 7 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(auth-service): expose /preferences/dashboard`
**Status**: ✅ Done

---

### T8: Encaminhar /api/v1/preferences ao auth-service

**What**: O gateway passa a ter um mapa prefixo → serviço; `preferences` vai para `auth`, os prefixos clínicos continuam no `glucose`.
**Where**: `backend/services/gateway/src/app.ts`
**Depends on**: T7
**Reuses**: `createProxyRoute` em `routes/routingTable.ts`
**Requirement**: LAY-07, LAY-08

**Done when**:

- [x] Teste: sem token responde `401` no gateway; com token encaminha a um servidor stub registrado como `auth` e preserva o corpo do `PUT`
- [x] Os prefixos atuais seguem encaminhando ao `glucose`
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(gateway): route preferences to auth-service`
**Status**: ✅ Done

---

### T9: Teste de preflight CORS para a origem da web

**What**: Prova que o gateway responde o preflight com `Authorization` permitido para cada origem de `CORS_ORIGIN` e recusa as outras.
**Where**: `backend/services/gateway/tests/routes/cors.test.ts`
**Depends on**: T8
**Reuses**: `buildApp({ corsOrigins })`
**Requirement**: DEP-07

**Done when**:

- [x] `OPTIONS` com origem listada: `204`, `Access-Control-Allow-Origin` igual à origem e `authorization` em `Access-Control-Allow-Headers`
- [x] Origem fora da lista não recebe `Access-Control-Allow-Origin`
- [x] Lista com duas origens separadas por vírgula funciona
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `test(gateway): cover CORS preflight for the web origin`
**Status**: ✅ Done

---

#### Phase 2: Web: esqueleto e guardas de arquitetura

### T10: Criar o projeto web (Vite + React + TypeScript estrito)

**What**: Esqueleto em `web/` com scripts `dev`, `build`, `typecheck`, `lint`, `lint:arch`, `test`, `test:coverage`, `dup` e `size`, lendo `VITE_API_URL`.
**Where**: `web/`
**Depends on**: T9
**Reuses**: Convenções de `backend/` (npm, Node 22)
**Requirement**: ARQ-01, ARQ-12, DEP-01, DEP-04

**Done when**:

- [x] `tsconfig` com `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`; pastas `src/{app,composition,shared,features}`
- [x] `.env.example` com `VITE_API_URL`; `web/node_modules` e `web/dist` no `.gitignore`
- [x] Versões das bibliotecas fixadas no `package-lock.json` e listadas em `web/README.md`
- [x] `npm run typecheck` e `npm run build` passam
- [x] Gate `build` passa: `cd web && npm run typecheck && npm run lint && npm run lint:arch && npm run test:coverage && npm run dup && npm run build && npm run size`

**Tests**: none
**Gate**: build
**Commit**: `feat(web): scaffold the dashboard SPA`
**Status**: ✅ Done

---

### T11: ESLint com limites de legibilidade

**What**: Config com `typescript-eslint`, `react-hooks`, `jsx-a11y`, `react/no-danger` e os limites `complexity` 10, `max-depth` 3, `max-lines` 250 (fora dos testes), `max-params` 4.
**Where**: `web/eslint.config.js`
**Depends on**: T10
**Reuses**: —
**Requirement**: ARQ-12, ARQ-16

**Done when**:

- [x] Teste de fumaça usa a API do ESLint em arquivos virtuais: 251 linhas falha, complexidade 11 falha, aninhamento 4 falha, 5 parâmetros falha, `dangerouslySetInnerHTML` falha
- [x] Arquivo limpo passa; arquivo de teste com 300 linhas passa
- [x] `no-explicit-any` ligado; comentários `eslint-disable` sem justificativa reprovam
- [x] Gate `quick` passa: `cd web && npx vitest run tests/arch/eslintLimits.test.ts`
- [x] Pelo menos 7 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `chore(web): configure ESLint with readability limits`
**Status**: ✅ Done

---

### T12: dependency-cruiser: regra de camadas

**What**: Regras para `domain`, `application`, `infrastructure`, `presentation` e composition root.
**Where**: `web/.dependency-cruiser.cjs`
**Depends on**: T11
**Reuses**: Tabela de regras do design
**Requirement**: ARQ-02, ARQ-03

**Done when**:

- [x] Teste de fumaça roda `cruise()` sobre fixtures em `web/tests/arch/fixtures/`: domain importando pacote npm, domain importando application, application importando infrastructure, presentation importando infrastructure — cada um falha
- [x] Fixture conforme passa
- [x] `npm run lint:arch` roda sobre `src`
- [x] Gate `quick` passa: `cd web && npx vitest run tests/arch/layers.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `chore(web): enforce the layer rule with dependency-cruiser`
**Status**: ✅ Done

---

### T13: dependency-cruiser: bibliotecas isoladas, features e ciclos

**What**: Regras: `recharts` só em `shared/presentation/charts`, `@dnd-kit` só em `features/dashboard-layout/presentation`, feature só pelo `index.ts` público da outra, nenhum ciclo.
**Where**: `web/.dependency-cruiser.cjs`
**Depends on**: T12
**Reuses**: Fixtures da tarefa anterior
**Requirement**: ARQ-11, ARQ-15

**Done when**:

- [x] Fixtures violando cada regra falham (recharts fora, dnd-kit fora, import interno de outra feature, ciclo A→B→A)
- [x] Import pelo `index.ts` público passa
- [x] Gate `quick` passa: `cd web && npx vitest run tests/arch/isolation.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `chore(web): isolate libraries and feature boundaries`
**Status**: ✅ Done

---

### T14: Limite de duplicação com jscpd

**What**: Config do `jscpd` com limite de 3 % em `web/src` e script `npm run dup`.
**Where**: `web/.jscpd.json`
**Depends on**: T13
**Reuses**: —
**Requirement**: ARQ-17

**Done when**:

- [x] Teste de fumaça roda o jscpd sobre um fixture com dois arquivos duplicados e espera falha; sobre `src` passa
- [x] Gate `quick` passa: `cd web && npx vitest run tests/arch/duplication.test.ts`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `chore(web): cap code duplication with jscpd`
**Status**: ✅ Done

---

### T15: Configurar Vitest, Testing Library, MSW e axe

**What**: jsdom, setup com `@testing-library/jest-dom`, `vitest-axe` e servidor MSW; cobertura v8 com limite de 80 % de linhas para `src/**/domain/**` e `src/**/application/**`.
**Where**: `web/vitest.config.ts`
**Depends on**: T14
**Reuses**: Padrão de `backend/vitest.config.ts`
**Requirement**: ARQ-13

**Done when**:

- [x] Teste de fumaça confere que a config declara o limite de 80 % para os dois globs
- [x] Um teste de exemplo com MSW e axe roda verde
- [x] Gate `quick` passa: `cd web && npx vitest run tests/arch/coverageConfig.test.ts`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `chore(web): set up Vitest, MSW and axe`
**Status**: ✅ Done

---

### T16: Job web no CI

**What**: Job `web` no GitHub Actions: Node 22, `npm ci`, typecheck, lint, lint:arch, test:coverage, dup, build, size e `npm audit --omit=dev --audit-level=high`.
**Where**: `.github/workflows/ci.yml`
**Depends on**: T15
**Reuses**: Job `backend` existente
**Requirement**: DEP-05, ARQ-13, ARQ-16, ARQ-17

**Done when**:

- [x] YAML válido e o job espelha os comandos locais, com cobertura enviada como artefato
- [x] Nenhum job existente foi alterado
- [x] Gate `build` passa: `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))" && cd web && npm run build`

**Tests**: none
**Gate**: build
**Commit**: `ci: add the web job`
**Status**: ✅ Done

---

### T17: AppError do domínio

**What**: Erro único do app com `kind` (`unauthenticated`, `forbidden`, `invalid-credentials`, `rate-limited`, `unavailable`, `not-found`, `validation`, `conflict`, `unknown`), `code` e `retryAfterSeconds`.
**Where**: `web/src/shared/domain/appError.ts`
**Depends on**: T16
**Reuses**: —
**Requirement**: ARQ-04, ACC-05

**Done when**:

- [x] Teste: construção por kind, `code` opcional, `retryAfterSeconds`, guarda `isAppError`
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/domain/appError.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the domain AppError`
**Status**: ✅ Done

---

### T18: Papel e rota inicial

**What**: `Role`, `isRole` e `homePathFor(role)` que devolve `/paciente`, `/profissional` ou `/admin`.
**Where**: `web/src/shared/domain/role.ts`
**Depends on**: T17
**Reuses**: Enum `UserRole` do backend
**Requirement**: ACC-02, ARQ-04

**Done when**:

- [x] Teste 1:1 dos três papéis e rejeição de valor desconhecido
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/domain/role.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add role and home path rules`
**Status**: ✅ Done

---

### T19: Spike: @dnd-kit com React 19

**What**: Instalar `@dnd-kit/core` e `@dnd-kit/sortable` e provar que funcionam com a versão de React do projeto.
**Where**: `web/package.json`
**Depends on**: T18
**Reuses**: —
**Requirement**: LAY-04

**Done when**:

- [x] Teste de fumaça `src/features/dashboard-layout/presentation/sortable.smoke.test.tsx` renderiza um `SortableContext` com sensor de teclado e reordena 3 itens
- [x] Se a instalação falhar por peer dependency: trocar por Pragmatic Drag and Drop, registrar a decisão em `web/README.md` e manter o mesmo teste
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/presentation/sortable.smoke.test.tsx`
- [x] Pelo menos 1 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `chore(web): add drag-and-drop dependency`
**Status**: ✅ Done

---

#### Phase 3: Web: infraestrutura compartilhada

### T20: Ports compartilhados do domínio

**What**: Interfaces `TokenStore`, `SessionEvents`, `Clock` e `TimeZoneProvider`.
**Where**: `web/src/shared/domain/ports.ts`
**Depends on**: T19
**Reuses**: —
**Requirement**: ARQ-05

**Done when**:

- [x] Só tipos; `npm run typecheck` e `lint:arch` passam
- [x] Gate `build` passa: `cd web && npm run typecheck && npm run lint && npm run lint:arch && npm run test:coverage && npm run dup && npm run build && npm run size`

**Tests**: none
**Gate**: build
**Commit**: `feat(web): declare shared domain ports`
**Status**: ✅ Done

---

### T21: Barramento de expiração de sessão (Observer)

**What**: `SessionEventBus` que notifica assinantes de `expired` uma única vez até `reset()`.
**Where**: `web/src/shared/infrastructure/events/sessionEventBus.ts`
**Depends on**: T20
**Reuses**: Port `SessionEvents`
**Requirement**: ACC-09

**Done when**:

- [x] Teste: vários `emitExpired` geram uma notificação; `reset` permite nova; `unsubscribe` funciona
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/infrastructure/events/sessionEventBus.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the session event bus`
**Status**: ✅ Done

---

### T22: Armazenamento do token

**What**: `SessionTokenStore` sobre `sessionStorage`, com queda para memória quando o acesso lança.
**Where**: `web/src/shared/infrastructure/storage/sessionTokenStore.ts`
**Depends on**: T21
**Reuses**: Port `TokenStore`
**Requirement**: ACC-12

**Done when**:

- [x] Teste: grava e lê em `sessionStorage`; nunca chama `localStorage` (spy); acesso que lança cai para memória e expõe `persistent=false`; `clear` apaga
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/infrastructure/storage/sessionTokenStore.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): store the access token in sessionStorage`
**Status**: ✅ Done

---

### T23: Mapeamento de respostas HTTP em AppError

**What**: Função pura `(status, body, headers) → AppError` com as regras do contrato `{ error, code }`.
**Where**: `web/src/shared/infrastructure/http/apiErrorMapper.ts`
**Depends on**: T22
**Reuses**: Contrato de erros do `backend/README.md`
**Requirement**: ACC-05, ACC-07, ACC-08, ARQ-06

**Done when**:

- [x] Tabela de casos: 401 `TOKEN_INVALID`→`unauthenticated`; outro 401→`invalid-credentials`; 403→`forbidden` com `code`; 404→`not-found`; 400→`validation` com `code`; 409→`conflict`; 429→`rate-limited` com `Retry-After` em segundos (ausente→indefinido); 502/503/504→`unavailable`; outro 5xx→`unknown`
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/infrastructure/http/apiErrorMapper.test.ts`
- [x] Pelo menos 11 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): map HTTP failures to AppError`
**Status**: ✅ Done

---

### T24: Cliente HTTP (Adapter sobre fetch)

**What**: `FetchHttpClient` com URL base, `Authorization` do `TokenStore`, JSON, mapeamento de erro e expiração de sessão.
**Where**: `web/src/shared/infrastructure/http/fetchHttpClient.ts`
**Depends on**: T23
**Reuses**: `apiErrorMapper`, `SessionEventBus`, `SessionTokenStore`
**Requirement**: ACC-09, ARQ-06

**Done when**:

- [x] MSW: injeta `Authorization`; `204` sem corpo; falha de rede vira `unavailable`; corpo de erro não-JSON não quebra
- [x] Três requisições recebendo `401 TOKEN_INVALID` juntas limpam o token e notificam `expired` uma vez
- [x] `429` expõe `retryAfterSeconds`; `503` vira `unavailable`
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/infrastructure/http/fetchHttpClient.test.ts`
- [x] Pelo menos 7 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: quick
**Commit**: `feat(web): add the fetch HTTP client`
**Status**: ✅ Done

---

### T25: Leitor do exp do JWT

**What**: `JwtExpiryReader` que lê só o `exp` (base64url) para agendar renovação, sem validar assinatura nem autorizar nada.
**Where**: `web/src/shared/infrastructure/auth/jwtExpiryReader.ts`
**Depends on**: T24
**Reuses**: —
**Requirement**: ACC-10

**Done when**:

- [x] Teste: token válido devolve a data; token malformado ou sem `exp` devolve `null`
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/infrastructure/auth/jwtExpiryReader.test.ts`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): read token expiry for refresh scheduling`
**Status**: ✅ Done

---

### T26: Fuso do navegador e relógio

**What**: `BrowserTimeZoneProvider` (`Intl.DateTimeFormat().resolvedOptions().timeZone`) e `SystemClock`.
**Where**: `web/src/shared/infrastructure/env/browserEnvironment.ts`
**Depends on**: T25
**Reuses**: Ports `TimeZoneProvider` e `Clock`
**Requirement**: API-01, RSP-09

**Done when**:

- [x] Teste com `Intl` simulado devolve o fuso; ausência de fuso cai para `UTC`
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/infrastructure/env/browserEnvironment.test.ts`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): provide browser time zone and clock`
**Status**: ✅ Done

---

### T27: Validação de DTO na borda

**What**: `parseDto(schema, data, endpoint)` que converte falha do zod em `AppError('unknown')` nomeando o endpoint.
**Where**: `web/src/shared/infrastructure/http/parseDto.ts`
**Depends on**: T26
**Reuses**: zod
**Requirement**: ARQ-07

**Done when**:

- [x] Teste: dado válido passa tipado; dado inválido lança `AppError` com o endpoint na mensagem e sem vazar o corpo
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/infrastructure/http/parseDto.test.ts`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): validate API payloads at the boundary`
**Status**: ✅ Done

---

#### Phase 4: Web: feature auth (domínio, casos de uso, infraestrutura)

### T28: Domínio da autenticação

**What**: Entidades `Account` e `Session`, regra `needsRefresh(session, now, hadRecentActivity)` e ports `SessionRepository`/`AccountRepository`.
**Where**: `web/src/features/auth/domain/`
**Depends on**: T27
**Reuses**: `Role`, `AppError`
**Requirement**: ACC-10, ARQ-04, ARQ-05

**Done when**:

- [x] Teste de `needsRefresh`: só profissional/admin, só com menos de 5 min e atividade recente (fronteira 5:00 e 4:59)
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/auth/domain`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the auth domain`
**Status**: ✅ Done

---

### T29: Caso de uso: entrar

**What**: `createLogin` faz login, grava o token, lê o papel em `/me` e devolve a sessão.
**Where**: `web/src/features/auth/application/login.ts`
**Depends on**: T28
**Reuses**: Ports da auth
**Requirement**: ACC-01, ACC-07

**Done when**:

- [x] Teste com fakes: sucesso grava token e devolve papel de `/me`; `invalid-credentials` propaga sem gravar; falha em `/me` apaga o token; papel desconhecido é rejeitado
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/auth/application/login.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the login use case`
**Status**: ✅ Done

---

### T30: Caso de uso: restaurar sessão

**What**: `createRestoreSession` usa o token guardado, descarta expirado e relê `/me`.
**Where**: `web/src/features/auth/application/restoreSession.ts`
**Depends on**: T29
**Reuses**: `JwtExpiryReader` via port
**Requirement**: ACC-01, ACC-04

**Done when**:

- [x] Teste: sem token devolve anônimo; token expirado é apagado; `/me` `401` apaga e devolve anônimo
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/auth/application/restoreSession.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): restore sessions on load`
**Status**: ✅ Done

---

### T31: Caso de uso: sair

**What**: `createLogout` apaga o token e chama os limpadores registrados (cache de consultas).
**Where**: `web/src/features/auth/application/logout.ts`
**Depends on**: T30
**Reuses**: Port `TokenStore`
**Requirement**: ACC-11

**Done when**:

- [x] Teste: token apagado e limpadores chamados uma vez
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/auth/application/logout.test.ts`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the logout use case`
**Status**: ✅ Done

---

### T32: Caso de uso: renovar sessão

**What**: `createRefreshSession` renova por `POST /auth/refresh` quando `needsRefresh` é verdadeiro.
**Where**: `web/src/features/auth/application/refreshSession.ts`
**Depends on**: T31
**Reuses**: Regra `needsRefresh`
**Requirement**: ACC-10

**Done when**:

- [x] Teste: paciente nunca renova; profissional perto do fim renova e troca o token; falha propaga `unauthenticated`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/auth/application/refreshSession.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): refresh web-role sessions`
**Status**: ✅ Done

---

### T33: Repositório de sessão (HTTP)

**What**: `HttpSessionRepository` para `POST /auth/login` e `POST /auth/refresh`, com schema zod e mapper.
**Where**: `web/src/features/auth/infrastructure/httpSessionRepository.ts`
**Depends on**: T32
**Reuses**: `FetchHttpClient`, `parseDto`
**Requirement**: ACC-01, ACC-10, ARQ-06, ARQ-07

**Done when**:

- [x] MSW: `{ token }` vira sessão; `401` vira `invalid-credentials`; `429` vira `rate-limited`; corpo sem `token` vira `unknown`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/auth/infrastructure/httpSessionRepository.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: quick
**Commit**: `feat(web): add the HTTP session repository`
**Status**: ✅ Done

---

### T34: Repositório de conta (HTTP)

**What**: `HttpAccountRepository` para `GET /me`, tolerante aos blocos `patient`/`professional`.
**Where**: `web/src/features/auth/infrastructure/httpAccountRepository.ts`
**Depends on**: T33
**Reuses**: `FetchHttpClient`, `parseDto`
**Requirement**: ACC-01, ARQ-06

**Done when**:

- [x] MSW: resposta de paciente, de profissional e de admin viram `Account` com o papel certo; papel desconhecido vira `unknown`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/auth/infrastructure/httpAccountRepository.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: quick
**Commit**: `feat(web): add the HTTP account repository`
**Status**: ✅ Done

---

### T35: Composition root

**What**: `createContainer(env)` liga adaptadores e casos de uso da auth; único ponto que importa `infrastructure` junto com `application`.
**Where**: `web/src/composition/container.ts`
**Depends on**: T34
**Reuses**: Estilo do `createContainer` dos serviços
**Requirement**: ARQ-08

**Done when**:

- [x] Teste: o container expõe `useCases.auth.*` e um `SessionEventBus` único
- [x] `npm run lint:arch` passa sem exceções fora de `composition/`
- [x] Gate `quick` passa: `cd web && npx vitest run src/composition/container.test.ts`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the composition root`
**Status**: ✅ Done

---

#### Phase 5: Web: apresentação da auth, tema e casca da aplicação

### T36: Tokens de tema e contraste

**What**: Propriedades CSS de cor, espaço, tipografia e foco para os temas claro e escuro.
**Where**: `web/src/shared/presentation/theme/tokens.css`
**Depends on**: T35
**Reuses**: Paleta do app (`GlucoreColors`) como referência
**Requirement**: RSP-08, RSP-10, RSP-04

**Done when**:

- [x] Teste lê o CSS e calcula o contraste: texto ≥ 4,5:1 e elementos gráficos ≥ 3:1 nos dois temas
- [x] Controles têm `min-height`/`min-width` de 44 px abaixo de 1024 px
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/theme/tokens.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add theme tokens`
**Status**: ✅ Done

---

### T37: Formatação pt-BR

**What**: Formatadores de número, percentual, mg/dL, data e hora em pt-BR no fuso informado.
**Where**: `web/src/shared/presentation/format.ts`
**Depends on**: T36
**Reuses**: `Intl`
**Requirement**: RSP-09

**Done when**:

- [x] Teste: `1234,5`, `70,0 %`, `142 mg/dL`, data `05/08/2026`, hora no fuso `America/Sao_Paulo`, valor nulo vira `—`
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/format.test.ts`
- [x] Pelo menos 6 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add pt-BR formatters`
**Status**: ✅ Done

---

### T38: Tema claro, escuro e sistema

**What**: `ThemeProvider` que aplica `data-theme` no `<html>`, guarda a escolha com `try/catch` e segue `prefers-color-scheme` por padrão.
**Where**: `web/src/shared/presentation/theme/themeProvider.tsx`
**Depends on**: T37
**Reuses**: Tokens de tema
**Requirement**: RSP-10

**Done when**:

- [x] Teste: padrão segue o sistema; escolha aplica na hora e sobrevive ao remount; `localStorage` que lança não quebra
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/theme/themeProvider.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the theme provider`
**Status**: ✅ Done

---

### T39: Estados de carregamento, vazio, erro e acesso negado

**What**: Componentes `Skeleton`, `EmptyState`, `ErrorState` (com "Tentar novamente") e `Forbidden` ("Você não tem acesso a este conteúdo").
**Where**: `web/src/shared/presentation/ui/states.tsx`
**Depends on**: T38
**Reuses**: Tokens
**Requirement**: LAY-16, ACC-05, RSP-06

**Done when**:

- [x] Teste com axe sem violações; botão de tentar de novo acionável por teclado
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/ui/states.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add shared UI states`
**Status**: ✅ Done

---

### T40: Política de consultas e retentativas

**What**: Fábrica do `QueryClient`: sem retentativa para `forbidden`, `unauthenticated`, `validation`, `not-found`; até 2 para `unavailable`; espera o `Retry-After` em `rate-limited`.
**Where**: `web/src/shared/presentation/queryClient.ts`
**Depends on**: T39
**Reuses**: TanStack Query
**Requirement**: ACC-05, PAC-16

**Done when**:

- [x] Teste da função de retry com cada kind e do atraso a partir de `retryAfterSeconds`
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/queryClient.test.ts`
- [x] Pelo menos 6 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the query client retry policy`
**Status**: ✅ Done

---

### T41: AuthProvider

**What**: Contexto com estado da sessão, `login`, `logout`, restauração na montagem e assinatura da expiração.
**Where**: `web/src/features/auth/presentation/authProvider.tsx`
**Depends on**: T40
**Reuses**: Casos de uso da auth, `SessionEventBus`
**Requirement**: ACC-09, ACC-11

**Done when**:

- [x] Teste: expiração leva a anônimo e mostra "Sua sessão expirou. Entre novamente." uma vez
- [x] Sair e expirar limpam o cache de consultas, e outra pessoa no mesmo navegador não vê dados da anterior
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/auth/presentation/authProvider.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the auth provider`
**Status**: ✅ Done

---

### T42: Guarda de rota por papel

**What**: `RequireRole` e redirecionamentos: anônimo vai ao login com destino interno; papel errado vai ao próprio dashboard sem renderizar a rota pedida.
**Where**: `web/src/features/auth/presentation/requireRole.tsx`
**Depends on**: T41
**Reuses**: `homePathFor`
**Requirement**: ACC-02, ACC-03, ACC-04

**Done when**:

- [x] Teste: paciente em `/admin` vai a `/paciente` sem montar filhos; anônimo volta à rota pedida depois de entrar; destinos `//evil.com` e `https://x` são descartados
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/auth/presentation/requireRole.test.tsx`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): guard routes by role`
**Status**: ✅ Done

---

### T43: Tela de login

**What**: Formulário de e-mail e senha com as mensagens do contrato e acessível por teclado.
**Where**: `web/src/features/auth/presentation/loginPage.tsx`
**Depends on**: T42
**Reuses**: `AuthProvider`, `ui/states`
**Requirement**: ACC-01, ACC-07, ACC-08, RSP-06

**Done when**:

- [x] Teste: `401` mostra "E-mail ou senha incorretos" e mantém o e-mail; `429` mostra "Muitas tentativas. Tente novamente em alguns minutos."; aviso de sessão expirada aparece; envio desabilitado durante a requisição; axe sem violações
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/auth/presentation/loginPage.test.tsx`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the login page`
**Status**: ✅ Done

---

### T44: Renovação com atividade

**What**: `useSessionRefresh` que acompanha atividade (ponteiro, teclado) e agenda a renovação.
**Where**: `web/src/features/auth/presentation/useSessionRefresh.ts`
**Depends on**: T43
**Reuses**: `refreshSession`
**Requirement**: ACC-10

**Done when**:

- [x] Teste com timers falsos: renova a 4:59 do fim com atividade; não renova sem atividade; paciente nunca agenda
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/auth/presentation/useSessionRefresh.test.ts`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): refresh sessions on activity`
**Status**: ✅ Done

---

### T45: Casca da aplicação

**What**: Cabeçalho com nome e papel, alternador de tema, "Sair" e navegação recolhida em menu abaixo de 640 px.
**Where**: `web/src/app/appShell.tsx`
**Depends on**: T44
**Reuses**: `AuthProvider`, `ThemeProvider`
**Requirement**: ACC-11, RSP-03, RSP-06, RSP-10

**Done when**:

- [x] Teste: "Sair" volta ao login; menu abre e fecha por teclado; axe sem violações
- [x] CSS da casca recolhe a navegação abaixo de 640 px
- [x] Gate `quick` passa: `cd web && npx vitest run src/app/appShell.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the app shell`
**Status**: ✅ Done

---

#### Phase 6: Web: estrutura de layout e widgets

### T46: Domínio do layout

**What**: Tipos `DashboardLayout`, `LayoutItem`, `WidgetSize` e funções puras `addWidget`, `removeWidget`, `moveWidget`, `resizeWidget`.
**Where**: `web/src/features/dashboard-layout/domain/layout.ts`
**Depends on**: T45
**Reuses**: —
**Requirement**: LAY-03, LAY-04, LAY-05, LAY-06, ARQ-04

**Done when**:

- [x] Teste: adicionar além de 20 falha; id repetido falha; mover no início e no fim; tamanho fora dos permitidos falha
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/domain/layout.test.ts`
- [x] Pelo menos 8 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the layout domain`
**Status**: ✅ Done

---

### T47: Normalizar layout salvo

**What**: `normalizeLayout(layout, catalog, role)` que descarta id desconhecido, de outro papel ou repetido e corrige tamanho inválido.
**Where**: `web/src/features/dashboard-layout/domain/normalizeLayout.ts`
**Depends on**: T46
**Reuses**: Domínio do layout
**Requirement**: LAY-10

**Done when**:

- [x] Teste 1:1 de cada descarte e de layout já válido intacto
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/domain/normalizeLayout.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): normalize saved layouts`
**Status**: ✅ Done

---

### T48: Layout padrão por papel (Strategy)

**What**: `defaultLayoutFor(role)` e a lista `widgetIds` da web.
**Where**: `web/src/features/dashboard-layout/domain/`
**Depends on**: T47
**Reuses**: `contracts/widget-catalog.json`
**Requirement**: LAY-01, LAY-02

**Done when**:

- [x] Teste: o padrão de cada papel só tem ids do papel
- [x] Teste lê `contracts/widget-catalog.json` e falha se `widgetIds` divergir
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/domain`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add default layouts per role`
**Status**: ✅ Done

---

### T49: Registro de widgets (Registry + Factory)

**What**: `registerWidget(definition, loadComponent)`, `definitionFor(id)`, `componentFor(id)` (carregado sob demanda) e filtro por papel.
**Where**: `web/src/features/dashboard-layout/presentation/widgetRegistry.ts`
**Depends on**: T48
**Reuses**: Tipo `WidgetDefinition`
**Requirement**: LAY-01, ARQ-09, ARQ-10

**Done when**:

- [x] Teste: registrar e recuperar; id repetido lança; id desconhecido devolve `null`; filtro por papel
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/presentation/widgetRegistry.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the widget registry`
**Status**: ✅ Done

---

### T50: Repositório do layout (HTTP)

**What**: `HttpLayoutRepository` para `GET/PUT/DELETE /preferences/dashboard`.
**Where**: `web/src/features/dashboard-layout/infrastructure/httpLayoutRepository.ts`
**Depends on**: T49
**Reuses**: `FetchHttpClient`, `parseDto`
**Requirement**: LAY-07, LAY-08, LAY-09, LAY-11

**Done when**:

- [x] MSW: `null` e lista; corpo do `PUT`; `400 INVALID_LAYOUT` vira `validation`; `DELETE` `204`; item malformado vira `unknown`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/infrastructure/httpLayoutRepository.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: quick
**Commit**: `feat(web): add the HTTP layout repository`
**Status**: ✅ Done

---

### T51: Casos de uso do layout

**What**: `loadLayout` (normaliza e cai no padrão sem layout salvo ou com falha, marcando `degraded`), `saveLayout`, `resetLayout`.
**Where**: `web/src/features/dashboard-layout/application/layoutUseCases.ts`
**Depends on**: T50
**Reuses**: Domínio do layout
**Requirement**: LAY-02, LAY-07, LAY-08, LAY-09, LAY-10

**Done when**:

- [x] Teste com fakes de cada caminho, inclusive falha de rede no load
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/application/layoutUseCases.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add layout use cases`
**Status**: ✅ Done

---

### T52: Grade responsiva

**What**: `DashboardGrid` genérica: 1 coluna < 640 px, 2 de 640 a 1023, 4 a partir de 1024; S=1, M=2, L=largura total, limitados às colunas.
**Where**: `web/src/features/dashboard-layout/presentation/dashboardGrid.tsx`
**Depends on**: T51
**Reuses**: Tokens
**Requirement**: RSP-01, RSP-02, ARQ-10

**Done when**:

- [x] Teste: `data-size` por item; CSS contém os pontos 640 e 1024 e os spans; itens com `min-width: 0` para não estourar a largura
- [x] A grade não importa nenhum widget (verificado por `lint:arch`)
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/presentation/dashboardGrid.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the responsive dashboard grid`
**Status**: ✅ Done

---

### T53: Invólucro de widget

**What**: `WidgetShell` com título, esqueleto, erro com "Tentar novamente", estado vazio com a causa e `ErrorBoundary`.
**Where**: `web/src/features/dashboard-layout/presentation/widgetShell.tsx`
**Depends on**: T52
**Reuses**: `ui/states`
**Requirement**: LAY-15, LAY-16

**Done when**:

- [x] Teste: um widget que lança mostra erro só nele e os vizinhos continuam; carregando mostra esqueleto; vazio mostra a causa
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/presentation/widgetShell.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the widget shell`
**Status**: ✅ Done

---

### T54: Hook de layout

**What**: `useLayout(role)` com TanStack Query devolvendo layout normalizado, `isLoading` e `degraded`.
**Where**: `web/src/features/dashboard-layout/presentation/useLayout.ts`
**Depends on**: T53
**Reuses**: `layoutUseCases`
**Requirement**: LAY-02, LAY-08, LAY-10

**Done when**:

- [x] Teste com MSW: sem layout salvo usa o padrão; layout salvo é normalizado; falha marca `degraded`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/presentation/useLayout.test.ts`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the layout hook`
**Status**: ✅ Done

---

#### Phase 7: Web: adaptadores de gráfico

### T55: Paleta de séries

**What**: Cores de série por variável CSS e formas de marcador para não depender só de cor.
**Where**: `web/src/shared/presentation/charts/palette.ts`
**Depends on**: T54
**Reuses**: Tokens
**Requirement**: RSP-08

**Done when**:

- [x] Teste: cada cor de série tem contraste ≥ 3:1 contra o fundo nos dois temas
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/charts/palette.test.ts`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the chart palette`
**Status**: ✅ Done

---

### T56: ChartFrame

**What**: Título, resumo textual para leitor de tela (`role="img"` com `aria-label`) e alternância "Ver como tabela" (`aria-pressed`).
**Where**: `web/src/shared/presentation/charts/chartFrame.tsx`
**Depends on**: T55
**Reuses**: `ui/states`
**Requirement**: RSP-07, RSP-06

**Done when**:

- [x] Teste: alternar mostra uma `<table>` com as colunas e linhas recebidas; resumo presente; axe sem violações
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/charts/chartFrame.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the accessible chart frame`
**Status**: ✅ Done

---

### T57: Adaptador de linha com banda

**What**: `LineBandChart`: uma ou mais linhas, banda `[min,max]` opcional, faixa-alvo opcional, área preenchida opcional e marcadores opcionais.
**Where**: `web/src/shared/presentation/charts/lineBandChart.tsx`
**Depends on**: T56
**Reuses**: Recharts `ComposedChart`, `Area` com faixa, `ReferenceArea`
**Requirement**: ARQ-11, PAC-06

**Done when**:

- [x] Teste: séries e banda chegam ao Recharts; faixa-alvo usa os limites recebidos; marcadores renderizam; envolvido em `ResponsiveContainer`
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/charts/lineBandChart.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the line-band chart adapter`
**Status**: ✅ Done

---

### T58: Adaptador de barras

**What**: `BarChart` simples e agrupado.
**Where**: `web/src/shared/presentation/charts/barChart.tsx`
**Depends on**: T57
**Reuses**: Recharts `BarChart`
**Requirement**: ARQ-11, PAC-07, PAC-09

**Done when**:

- [x] Teste: uma e duas séries; eixo de categorias; `ResponsiveContainer`
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/charts/barChart.test.tsx`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the bar chart adapter`
**Status**: ✅ Done

---

### T59: Adaptador de barras empilhadas

**What**: `StackedBarChart` vertical ou horizontal, usado pelas zonas.
**Where**: `web/src/shared/presentation/charts/stackedBarChart.tsx`
**Depends on**: T58
**Reuses**: Recharts `BarChart` com `stackId`
**Requirement**: ARQ-11, PAC-10, PRO-10

**Done when**:

- [x] Teste: segmentos na ordem das zonas e orientação horizontal
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/charts/stackedBarChart.test.tsx`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the stacked bar chart adapter`
**Status**: ✅ Done

---

### T60: Adaptador de rosca

**What**: `DonutChart` com rótulos de percentual.
**Where**: `web/src/shared/presentation/charts/donutChart.tsx`
**Depends on**: T59
**Reuses**: Recharts `PieChart`
**Requirement**: ARQ-11, ADM-02

**Done when**:

- [x] Teste: fatias e rótulos; total zero mostra estado vazio
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/charts/donutChart.test.tsx`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the donut chart adapter`
**Status**: ✅ Done

---

### T61: Adaptador de faixas de percentil (AGP)

**What**: `RangeAreaChart` com duas faixas aninhadas (P5–P95, P25–P75) e a mediana.
**Where**: `web/src/shared/presentation/charts/rangeAreaChart.tsx`
**Depends on**: T60
**Reuses**: Recharts `Area` com `dataKey` de faixa
**Requirement**: ARQ-11, PAC-10

**Done when**:

- [x] Teste: as duas faixas e a mediana chegam ao Recharts com os pontos por hora
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/charts/rangeAreaChart.test.tsx`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the percentile band chart adapter`
**Status**: ✅ Done

---

### T62: Adaptador de dispersão com quadrantes

**What**: `ScatterQuadrantChart` com linhas de referência e quadrantes sombreados.
**Where**: `web/src/shared/presentation/charts/scatterQuadrantChart.tsx`
**Depends on**: T61
**Reuses**: Recharts `ScatterChart`, `ReferenceLine`, `ReferenceArea`
**Requirement**: ARQ-11, PRO-10

**Done when**:

- [x] Teste: pontos com rótulo; linhas nos limites recebidos (TIR 70, CV 36)
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/charts/scatterQuadrantChart.test.tsx`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the scatter quadrant chart adapter`
**Status**: ✅ Done

---

### T63: Heatmap em SVG próprio

**What**: `HeatmapChart` 7 × 24 com escala de cor sequencial e rótulos.
**Where**: `web/src/shared/presentation/charts/heatmapChart.tsx`
**Depends on**: T62
**Reuses**: Tokens de cor
**Requirement**: PAC-10

**Done when**:

- [x] Teste: 168 células no máximo, células sem dado vazias, `<title>` por célula com dia, hora e valor
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/charts/heatmapChart.test.tsx`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the SVG heatmap`
**Status**: ✅ Done

---

### T64: Redesenho por tamanho do contêiner

**What**: Teste que prova que todos os adaptadores redesenham quando o contêiner muda de largura.
**Where**: `web/src/shared/presentation/charts/chartResponsive.test.tsx`
**Depends on**: T63
**Reuses**: `ResizeObserver` simulado
**Requirement**: RSP-05

**Done when**:

- [x] Para cada adaptador, mudar a largura simulada gera nova renderização com a largura nova
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/charts/chartResponsive.test.tsx`
- [x] Pelo menos 7 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `test(web): cover chart redraw on container resize`
**Status**: ✅ Done

---

#### Phase 8: Backend: extensões do summary (parte 1)

### T65: Aceitar tz em /dashboard/summary

**What**: `parseDashboardQuery` aceita `tz` opcional (até 64 caracteres, padrão `UTC`).
**Where**: `backend/services/glucose-service/src/modules/dashboard/dashboard.schema.ts`
**Depends on**: T64
**Reuses**: Validações atuais do schema
**Requirement**: API-01, API-02

**Done when**:

- [x] Teste: ausente vira `UTC`; formato inválido `400 INVALID_TIMEZONE`; regras atuais de período intactas
- [x] Gate `quick` passa: `cd backend && npx vitest run services/glucose-service/tests/modules/dashboard.schema.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(glucose-service): accept a tz parameter on the summary`
**Status**: ✅ Done

---

### T66: Validar o fuso contra o banco

**What**: `TimeZoneValidator` que carrega `pg_timezone_names` uma vez e responde se o nome existe.
**Where**: `backend/services/glucose-service/src/modules/dashboard/dashboard.timezones.ts`
**Depends on**: T65
**Reuses**: Prisma `$queryRaw`
**Requirement**: API-02

**Done when**:

- [x] Integração: `America/Sao_Paulo` aceito; `Mars/Phobos` recusado; segunda chamada não consulta o banco
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): validate time zones against Postgres`
**Status**: ✅ Done

---

### T67: Limites do período no fuso

**What**: `resolveBounds(fromDate, toDate, tz)` no repositório devolve início e fim exclusivo em UTC naive.
**Where**: `backend/services/glucose-service/src/modules/dashboard/dashboard.repository.ts`
**Depends on**: T66
**Reuses**: Truque `AT TIME ZONE 'UTC'` já usado no repositório
**Requirement**: API-01, API-08

**Done when**:

- [x] Integração: `UTC` dá o mesmo resultado de hoje; `America/Sao_Paulo` começa às 03:00 UTC; um período com troca de horário (`America/New_York`) tem o tamanho certo
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): resolve period bounds in the caller's time zone`
**Status**: ✅ Done

---

### T68: Distribuição em 5 zonas

**What**: Função SQL `glucose_zones` numa migration nova e `getZoneDistribution` no repositório.
**Where**: `backend/services/glucose-service/src/modules/dashboard/dashboard.repository.ts`
**Depends on**: T67
**Reuses**: Função `glucose_metrics` e sua migration
**Requirement**: API-03

**Done when**:

- [x] Migration nova em `prisma/migrations/` com `CREATE FUNCTION glucose_zones` (muito baixa `< LEAST(54, low)`, muito alta `> GREATEST(250, high)`)
- [x] Integração: leituras em 53, 54, low-1, low, high, high+1, 250, 251 caem na zona certa; soma 100 ± 0,01; limiar baixo de 50 usa 50
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): add the five-zone distribution`
**Status**: ✅ Done

---

### T69: Uso do sensor

**What**: `sensorUsePercent(readingsCount, spanDays)` puro.
**Where**: `backend/services/glucose-service/src/modules/dashboard/dashboard.metrics.ts`
**Depends on**: T68
**Reuses**: —
**Requirement**: API-04

**Done when**:

- [x] Teste: 0 leituras, período completo (288 por dia) dá 100, acima de 100 é limitado, período de 1 dia
- [x] Gate `quick` passa: `cd backend && npx vitest run services/glucose-service/tests/modules/dashboard.metrics.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(glucose-service): compute sensor use`
**Status**: ✅ Done

---

### T70: AGP por hora local

**What**: `getAgp(patientId, bounds, tz)` com `percentile_cont` em P5, P25, P50, P75 e P95 por hora.
**Where**: `backend/services/glucose-service/src/modules/dashboard/dashboard.repository.ts`
**Depends on**: T69
**Reuses**: Mapper com `toNumber`
**Requirement**: API-05

**Done when**:

- [x] Integração: fixture com valores conhecidos devolve os percentis esperados; hora local respeita o fuso; hora sem dado não aparece
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): add the ambulatory glucose profile`
**Status**: ✅ Done

---

### T71: Heatmap dia da semana × hora

**What**: `getHeatmap(patientId, bounds, tz)` com média e contagem por `DOW` e hora locais.
**Where**: `backend/services/glucose-service/src/modules/dashboard/dashboard.repository.ts`
**Depends on**: T70
**Reuses**: Mapper com `toNumber`
**Requirement**: API-06

**Done when**:

- [x] Integração: domingo é 0; leitura às 22:00 BRT de sábado cai em sábado com `tz` e em domingo com `UTC`
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): add the weekday-hour heatmap`
**Status**: ✅ Done

---

### T72: Última leitura do paciente

**What**: `getLastReadingAt(patientId)` sem filtro de período.
**Where**: `backend/services/glucose-service/src/modules/dashboard/dashboard.repository.ts`
**Depends on**: T71
**Reuses**: Índice `(patientId, recordedAt)`
**Requirement**: PAC-12, PRO-03

**Done when**:

- [x] Integração: sem leituras devolve `null`; com leituras devolve a mais recente, mesmo fora do período pedido
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): expose the last reading time`
**Status**: ✅ Done

---

#### Phase 9: Backend: extensões do summary (parte 2) e GMI único

### T73: byDay no fuso com carboidrato e insulina

**What**: `getDailyBuckets` passa a agrupar no fuso e a trazer `carbsGrams` e `insulinUnits` por `FULL OUTER JOIN`.
**Where**: `backend/services/glucose-service/src/modules/dashboard/dashboard.repository.ts`
**Depends on**: T72
**Reuses**: Consulta Q1 atual
**Requirement**: API-01, API-07, API-08

**Done when**:

- [x] Integração: dia só com carboidrato aparece com glicose `null`; somas corretas; campos atuais idênticos aos de hoje com `UTC`
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): add carbs and insulin to daily buckets`
**Status**: ✅ Done

---

### T74: Serviço do summary reutilizável

**What**: `DashboardService.getSummary(patientId, query)` monta todos os campos novos; `getSummaryForUser` passa a delegar.
**Where**: `backend/services/glucose-service/src/modules/dashboard/dashboard.service.ts`
**Depends on**: T73
**Reuses**: `resolveThresholds` atual
**Requirement**: API-01, API-03, API-04, API-05, API-06, API-08

**Done when**:

- [x] Teste com fakes: campos novos presentes (`tz`, `lastReadingAt`, `zoneDistribution`, `sensorUsePercent`, `agp`, `heatmap`); campos antigos iguais; fuso desconhecido `400 INVALID_TIMEZONE`
- [x] Gate `quick` passa: `cd backend && npx vitest run services/glucose-service/tests/modules/dashboard.service.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(glucose-service): make the summary reusable by patient id`
**Status**: ✅ Done

---

### T75: Testes de rota do summary estendido

**What**: Amplia `tests/routes/dashboard.test.ts` com os campos novos, o fuso e a compatibilidade.
**Where**: `backend/services/glucose-service/tests/routes/dashboard.test.ts`
**Depends on**: T74
**Reuses**: Fixture atual do arquivo
**Requirement**: API-01, API-02, API-08, ACC-06

**Done when**:

- [x] Sem `tz` o JSON antigo é idêntico campo a campo; com `tz=America/Sao_Paulo` os dias mudam; `INVALID_TIMEZONE`; token de profissional recebe `403 FORBIDDEN_ROLE`
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `test(glucose-service): cover the extended summary route`
**Status**: ✅ Done

---

### T76: Contrato do GMI no backend

**What**: `contracts/gmi-cases.json` e teste que confere o GMI do `glucose_metrics` contra os casos.
**Where**: `backend/services/glucose-service/tests/modules/gmi.contract.test.ts`
**Depends on**: T75
**Reuses**: Função `glucose_metrics`
**Requirement**: API-09

**Done when**:

- [x] Casos com médias 80, 120, 154, 183, 250 e o GMI esperado `3,31 + 0,02392 × média` com 2 casas
- [x] O teste lê o JSON e passa contra o banco
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `test(glucose-service): pin GMI to the shared contract`
**Status**: ✅ Done

---

### T77: GMI no domínio do app

**What**: `gmiFromMean(mean)` puro no domínio do paciente.
**Where**: `lib/features/patient/domain/glucose_metrics.dart`
**Depends on**: T76
**Reuses**: `contracts/gmi-cases.json`
**Requirement**: API-09

**Done when**:

- [x] Teste em `test/features/patient/glucose_metrics_test.dart` lê o mesmo JSON e confere todos os casos
- [x] Gate `quick` passa: `flutter test --no-pub test/features/patient/glucose_metrics_test.dart`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(app): compute GMI with the shared formula`
**Status**: ✅ Done

---

### T78: Relatório do app usa o GMI único

**What**: `reports_page.dart` deixa a fórmula `0,0296 × média + 2,419` e chama `gmiFromMean`.
**Where**: `lib/features/patient/presentation/pages/reports_page.dart`
**Depends on**: T77
**Reuses**: `gmiFromMean`
**Requirement**: API-09

**Done when**:

- [x] Teste de widget com leituras fixas mostra o GMI esperado; a regra de mínimo de 14 leituras continua
- [x] Gate `full` passa: `flutter analyze && flutter test --no-pub`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: full
**Commit**: `fix(app): align the reports GMI with the backend`
**Status**: ✅ Done

---

#### Phase 10: Web: dados e filtros do dashboard do paciente

### T79: Zonas de glicose no domínio

**What**: `zoneOf(value, low, high)` e os limites da spec.
**Where**: `web/src/features/patient-dashboard/domain/zones.ts`
**Depends on**: T78
**Reuses**: Limites das Assumptions da spec
**Requirement**: ARQ-04, PAC-10

**Done when**:

- [x] Tabela de fronteira: 53, 54, low-1, low, high, high+1, 250, 251 e limiar baixo de 50
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/domain/zones.test.ts`
- [x] Pelo menos 9 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add glucose zone rules`
**Status**: ✅ Done

---

### T80: Período e validação

**What**: Presets 7/14/30/90, `toRange(preset, today)` e `validateCustom(from, to)`.
**Where**: `web/src/features/patient-dashboard/domain/period.ts`
**Depends on**: T79
**Reuses**: `AppError`
**Requirement**: PAC-02, PAC-03, PAC-04

**Done when**:

- [x] Teste: 90 dias passa, 91 falha; início depois do fim falha com "Escolha um período de até 90 dias"; presets calculados a partir de hoje
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/domain/period.test.ts`
- [x] Pelo menos 6 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add period rules`
**Status**: ✅ Done

---

### T81: Frescor dos dados

**What**: `isStale(lastReadingAt, now)` com limite de 60 minutos.
**Where**: `web/src/features/patient-dashboard/domain/freshness.ts`
**Depends on**: T80
**Reuses**: —
**Requirement**: PAC-12, PAC-13

**Done when**:

- [x] Teste: 60 min não é desatualizado, 61 é; sem leitura é desatualizado
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/domain/freshness.test.ts`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add data freshness rule`
**Status**: ✅ Done

---

### T82: Média ponderada e dados suficientes

**What**: `weightedMean(byDay)` (peso = leituras do dia) e `hasEnoughDaysForGmi(byDay)` (14 dias com leitura).
**Where**: `web/src/features/patient-dashboard/domain/metrics.ts`
**Depends on**: T81
**Reuses**: —
**Requirement**: PAC-05

**Done when**:

- [x] Teste: dias nulos ignorados; 13 dias com leitura não bastam, 14 bastam
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/domain/metrics.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add summary metric helpers`
**Status**: ✅ Done

---

### T83: Entidades do summary e port

**What**: Tipos `GlucoseSummary`, `DailyBucket`, `AgpPoint`, `HeatCell`, `Excursion` e o port `SummaryRepository`.
**Where**: `web/src/features/patient-dashboard/domain/summary.ts`
**Depends on**: T82
**Reuses**: Modelo do design
**Requirement**: ARQ-05, PAC-01

**Done when**:

- [x] Só tipos; `npm run typecheck` passa
- [x] Gate `build` passa: `cd web && npm run typecheck && npm run lint && npm run lint:arch && npm run test:coverage && npm run dup && npm run build && npm run size`

**Tests**: none
**Gate**: build
**Commit**: `feat(web): declare summary entities`
**Status**: ✅ Done

---

### T84: Repositório do summary (HTTP)

**What**: `HttpSummaryRepository` para `GET /dashboard/summary` e `GET /professional/patients/:id/summary`, com `from`, `to` e `tz`.
**Where**: `web/src/features/patient-dashboard/infrastructure/httpSummaryRepository.ts`
**Depends on**: T83
**Reuses**: `FetchHttpClient`, `parseDto`
**Requirement**: PAC-01, ARQ-06, ARQ-07, API-01

**Done when**:

- [x] MSW: resposta completa vira `GlucoseSummary`; campo obrigatório ausente vira `unknown`; `400 INVALID_DASHBOARD_RANGE` vira `validation`; `tz` sempre enviado
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/infrastructure/httpSummaryRepository.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: quick
**Commit**: `feat(web): add the HTTP summary repository`
**Status**: ✅ Done

---

### T85: Caso de uso: carregar summary

**What**: `createLoadPatientSummary` valida o período pelo domínio e envia o fuso do navegador; aceita `patientId` opcional.
**Where**: `web/src/features/patient-dashboard/application/loadPatientSummary.ts`
**Depends on**: T84
**Reuses**: `period.ts`, `TimeZoneProvider`
**Requirement**: PAC-01, PAC-02, PAC-03, PAC-04

**Done when**:

- [x] Teste com fakes: período inválido não chama o repositório; `patientId` muda o escopo
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/application/loadPatientSummary.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the load summary use case`
**Status**: ✅ Done

---

### T86: Hook useSummary compartilhado

**What**: `useSummary(range)` com TanStack Query, escopo vindo de `SummaryScopeProvider` (próprio paciente ou paciente vinculado), recarga de 5 min só com a aba visível.
**Where**: `web/src/features/patient-dashboard/presentation/useSummary.ts`
**Depends on**: T85
**Reuses**: `queryClient`, `loadPatientSummary`
**Requirement**: PAC-16, PAC-17

**Done when**:

- [x] MSW: dois widgets com o mesmo período fazem uma requisição
- [x] Timers falsos: com `visibilityState` visível recarrega após 5 min; oculta não recarrega
- [x] Escopo de paciente vinculado usa a rota do profissional
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/useSummary.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): share one summary query across widgets`
**Status**: ✅ Done

---

### T87: Filtro de período

**What**: Chips 7/14/30/90 e intervalo personalizado com validação inline.
**Where**: `web/src/features/patient-dashboard/presentation/periodFilter.tsx`
**Depends on**: T86
**Reuses**: `period.ts`, tokens
**Requirement**: PAC-02, PAC-03, PAC-04, RSP-04

**Done when**:

- [x] Teste: escolher preset dispara mudança; intervalo de 91 dias mostra "Escolha um período de até 90 dias" e não envia; axe sem violações
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/periodFilter.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the period filter`
**Status**: ✅ Done

---

#### Phase 11: Web: KPIs e frescor do paciente

### T88: Cartão de KPI

**What**: `KpiCard` com valor, unidade, meta e estado (ícone e texto, não só cor).
**Where**: `web/src/shared/presentation/ui/kpiCard.tsx`
**Depends on**: T87
**Reuses**: Tokens, `format.ts`
**Requirement**: PAC-05, RSP-08

**Done when**:

- [x] Teste: valor nulo mostra `—`; estado dentro e fora da meta com texto; axe sem violações
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/ui/kpiCard.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the KPI card`
**Status**: ✅ Done

---

### T89: Widget de tempo no alvo

**What**: Widget `kpi-tir`: o tempo no alvo em % com meta de 70 %.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/kpiTir.tsx`
**Depends on**: T88
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-05

**Done when**:

- [x] Exporta `WidgetDefinition` com id `kpi-tir`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza o tempo no alvo em % com meta de 70 % a partir de `summary.timeInRangePercent`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/kpiTir.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add kpi-tir widget`
**Status**: ✅ Done

---

### T90: Widget de GMI

**What**: Widget `kpi-gmi`: o GMI em %.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/kpiGmi.tsx`
**Depends on**: T89
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-05

**Done when**:

- [x] Exporta `WidgetDefinition` com id `kpi-gmi`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza o GMI em % a partir de `summary.gmiPercent`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Com menos de 14 dias de leitura mostra "Poucos dados no período"
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/kpiGmi.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add kpi-gmi widget`
**Status**: ✅ Done

---

### T91: Widget de glicose média

**What**: Widget `kpi-mean`: a glicose média em mg/dL.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/kpiMean.tsx`
**Depends on**: T90
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-05

**Done when**:

- [x] Exporta `WidgetDefinition` com id `kpi-mean`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza a glicose média em mg/dL a partir de `weightedMean(summary.byDay)`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/kpiMean.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add kpi-mean widget`
**Status**: ✅ Done

---

### T92: Widget de variabilidade (CV)

**What**: Widget `kpi-cv`: o CV em % com meta de até 36 %.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/kpiCv.tsx`
**Depends on**: T91
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-05

**Done when**:

- [x] Exporta `WidgetDefinition` com id `kpi-cv`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza o CV em % com meta de até 36 % a partir de `summary.coefficientOfVariationPercent`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/kpiCv.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add kpi-cv widget`
**Status**: ✅ Done

---

### T93: Widget de uso do sensor

**What**: Widget `kpi-sensor-use`: o uso do sensor em % com meta de 70 %.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/kpiSensorUse.tsx`
**Depends on**: T92
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-05, API-04

**Done when**:

- [x] Exporta `WidgetDefinition` com id `kpi-sensor-use`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza o uso do sensor em % com meta de 70 % a partir de `summary.sensorUsePercent`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/kpiSensorUse.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add kpi-sensor-use widget`
**Status**: ✅ Done

---

### T94: Widget de frescor dos dados

**What**: Widget `card-freshness`: o horário da última leitura sincronizada pelo app.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/cardFreshness.tsx`
**Depends on**: T93
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-12, PAC-13

**Done when**:

- [x] Exporta `WidgetDefinition` com id `card-freshness`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza o horário da última leitura sincronizada pelo app a partir de `summary.lastReadingAt`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Acima de 60 min mostra "Sem dados recentes. Abra o aplicativo para sincronizar."
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/cardFreshness.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add card-freshness widget`
**Status**: ✅ Done

---

#### Phase 12: Web: gráficos do paciente

### T95: Widget de tendência

**What**: Widget `chart-trend`: a média diária com banda mínimo-máximo, média móvel de 7 dias e a faixa-alvo.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/chartTrend.tsx`
**Depends on**: T94
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-06

**Done when**:

- [x] Exporta `WidgetDefinition` com id `chart-trend`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza a média diária com banda mínimo-máximo, média móvel de 7 dias e a faixa-alvo a partir de `summary.byDay` e os limiares
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Usa o adaptador `LineBandChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/chartTrend.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add chart-trend widget`
**Status**: ✅ Done

---

### T96: Widget de % no alvo por dia

**What**: Widget `chart-daily-tir`: o percentual no alvo por dia.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/chartDailyTir.tsx`
**Depends on**: T95
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-07

**Done when**:

- [x] Exporta `WidgetDefinition` com id `chart-daily-tir`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza o percentual no alvo por dia a partir de `summary.byDay`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Usa o adaptador `BarChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/chartDailyTir.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add chart-daily-tir widget`
**Status**: ✅ Done

---

### T97: Widget de zonas

**What**: Widget `chart-zones`: a distribuição em 5 zonas.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/chartZones.tsx`
**Depends on**: T96
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-10

**Done when**:

- [x] Exporta `WidgetDefinition` com id `chart-zones`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza a distribuição em 5 zonas a partir de `summary.zoneDistribution`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Usa o adaptador `StackedBarChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/chartZones.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add chart-zones widget`
**Status**: ✅ Done

---

### T98: Widget de AGP

**What**: Widget `chart-agp`: o perfil ambulatorial por hora.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/chartAgp.tsx`
**Depends on**: T97
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-10

**Done when**:

- [x] Exporta `WidgetDefinition` com id `chart-agp`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza o perfil ambulatorial por hora a partir de `summary.agp`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Usa o adaptador `RangeAreaChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/chartAgp.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add chart-agp widget`
**Status**: ✅ Done

---

### T99: Widget de heatmap

**What**: Widget `chart-heatmap`: o mapa de calor dia da semana × hora.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/chartHeatmap.tsx`
**Depends on**: T98
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-10

**Done when**:

- [x] Exporta `WidgetDefinition` com id `chart-heatmap`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza o mapa de calor dia da semana × hora a partir de `summary.heatmap`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Usa o adaptador `HeatmapChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/chartHeatmap.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add chart-heatmap widget`
**Status**: ✅ Done

---

### T100: Widget de episódios de hipo e hiper

**What**: Widget `table-excursions`: a tabela de episódios com início, duração, mínimo e máximo.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/tableExcursions.tsx`
**Depends on**: T99
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-08, RSP-03

**Done when**:

- [x] Exporta `WidgetDefinition` com id `table-excursions`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza a tabela de episódios com início, duração, mínimo e máximo a partir de `summary.excursions`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Tabela com rolagem horizontal interna abaixo de 640 px
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/tableExcursions.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add table-excursions widget`
**Status**: ✅ Done

---

### T101: Widget de insulina por tipo

**What**: Widget `chart-insulin-type`: o total de unidades e a contagem por tipo de insulina.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/chartInsulinType.tsx`
**Depends on**: T100
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-09

**Done when**:

- [x] Exporta `WidgetDefinition` com id `chart-insulin-type`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza o total de unidades e a contagem por tipo de insulina a partir de `summary.insulinByType`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Usa o adaptador `BarChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/chartInsulinType.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add chart-insulin-type widget`
**Status**: ✅ Done

---

### T102: Widget de alertas por tipo

**What**: Widget `chart-alerts-type`: os alertas por tipo.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/chartAlertsType.tsx`
**Depends on**: T101
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-09

**Done when**:

- [x] Exporta `WidgetDefinition` com id `chart-alerts-type`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza os alertas por tipo a partir de `summary.alertsByType`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Usa o adaptador `BarChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/chartAlertsType.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add chart-alerts-type widget`
**Status**: ✅ Done

---

### T103: Widget de carboidrato e insulina por dia

**What**: Widget `chart-carbs-insulin`: gramas de carboidrato e unidades de insulina por dia.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/chartCarbsInsulin.tsx`
**Depends on**: T102
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-10

**Done when**:

- [x] Exporta `WidgetDefinition` com id `chart-carbs-insulin`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza gramas de carboidrato e unidades de insulina por dia a partir de `summary.byDay`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Usa o adaptador `BarChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/chartCarbsInsulin.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add chart-carbs-insulin widget`
**Status**: ✅ Done

---

#### Phase 13: Web: dia detalhado, página do paciente e rotas

### T104: Entidades do diário e port

**What**: Tipos `Reading`, `CarbEntry`, `InsulinEntry` e o port `DiaryRepository`.
**Where**: `web/src/features/patient-dashboard/domain/diary.ts`
**Depends on**: T103
**Reuses**: DTOs atuais de `/readings`, `/carbs`, `/insulin`
**Requirement**: ARQ-05, PAC-11

**Done when**:

- [x] Só tipos; `npm run typecheck` passa
- [x] Gate `build` passa: `cd web && npm run typecheck && npm run lint && npm run lint:arch && npm run test:coverage && npm run dup && npm run build && npm run size`

**Tests**: none
**Gate**: build
**Commit**: `feat(web): declare diary entities`
**Status**: ✅ Done

---

### T105: Repositório do diário (HTTP)

**What**: `HttpDiaryRepository` só com `GET` em `/readings`, `/carbs` e `/insulin`.
**Where**: `web/src/features/patient-dashboard/infrastructure/httpDiaryRepository.ts`
**Depends on**: T104
**Reuses**: `FetchHttpClient`, `parseDto`
**Requirement**: PAC-11, ARQ-06

**Done when**:

- [x] MSW: os três recursos viram entidades; payload malformado vira `unknown`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/infrastructure/httpDiaryRepository.test.ts`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: quick
**Commit**: `feat(web): add the HTTP diary repository`
**Status**: ✅ Done

---

### T106: Caso de uso: dia detalhado

**What**: `createLoadDayDetail(day, tz)` filtra leituras, carboidratos e insulina do dia local.
**Where**: `web/src/features/patient-dashboard/application/loadDayDetail.ts`
**Depends on**: T105
**Reuses**: `DiaryRepository`
**Requirement**: PAC-11

**Done when**:

- [x] Teste: leitura às 23:30 BRT fica no dia certo; lista de dias disponíveis vem das leituras
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/application/loadDayDetail.test.ts`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the day detail use case`
**Status**: ✅ Done

---

### T107: Widget de dia detalhado

**What**: Widget `chart-day-detail`: a linha de leituras do dia escolhido com marcadores de carboidrato e insulina.
**Where**: `web/src/features/patient-dashboard/presentation/widgets/chartDayDetail.tsx`
**Depends on**: T106
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PAC-11

**Done when**:

- [x] Exporta `WidgetDefinition` com id `chart-day-detail`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza a linha de leituras do dia escolhido com marcadores de carboidrato e insulina a partir de `loadDayDetail`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Usa o adaptador `LineBandChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [x] O seletor só oferece dias com leituras disponíveis
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgets/chartDayDetail.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add chart-day-detail widget`
**Status**: ✅ Done

---

### T108: Catálogo de widgets do paciente

**What**: Registra os 16 widgets do paciente, uma linha por widget.
**Where**: `web/src/features/patient-dashboard/presentation/widgetCatalog.ts`
**Depends on**: T107
**Reuses**: `widgetRegistry`
**Requirement**: LAY-01, ARQ-10

**Done when**:

- [x] Teste: ids registrados iguais aos do papel `PATIENT` em `contracts/widget-catalog.json`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/widgetCatalog.test.ts`
- [x] Pelo menos 1 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): register the patient widgets`
**Status**: ✅ Done

---

### T109: Página do dashboard do paciente

**What**: Casca, filtro de período, botão "Atualizar" e grade montada a partir do layout.
**Where**: `web/src/features/patient-dashboard/presentation/patientDashboardPage.tsx`
**Depends on**: T108
**Reuses**: `useLayout`, `useSummary`, `DashboardGrid`
**Requirement**: PAC-01, PAC-14, PAC-15

**Done when**:

- [x] MSW: abre com 14 dias e uma requisição de summary; sem leituras mostra "Sem leituras no período" com a orientação de sincronizar; "Atualizar" recarrega mantendo filtro e layout
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/patientDashboardPage.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the patient dashboard page`
**Status**: ✅ Done

---

### T110: Garantia de somente leitura dos dados clínicos

**What**: Teste estrutural que varre `web/src` e falha se houver escrita em `/readings`, `/carbs`, `/insulin` ou `/alerts`.
**Where**: `web/src/features/patient-dashboard/readonly.test.ts`
**Depends on**: T109
**Reuses**: —
**Requirement**: PAC-18

**Done when**:

- [x] Nenhum `POST`, `PUT` ou `DELETE` para esses caminhos em todo `web/src`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/readonly.test.ts`
- [x] Pelo menos 1 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `test(web): guard clinical data as read-only`
**Status**: ✅ Done

---

### T111: Rotas e providers da aplicação

**What**: `App` com providers (tema, consultas, casos de uso, auth) e as rotas `/login` e `/paciente` protegidas.
**Where**: `web/src/app/routes.tsx`
**Depends on**: T110
**Reuses**: `RequireRole`, `AuthProvider`, container
**Requirement**: ACC-02, ACC-03, ACC-04

**Done when**:

- [x] Teste de navegação: login de paciente cai em `/paciente`; anônimo em `/paciente` vai ao login e volta
- [x] Gate `quick` passa: `cd web && npx vitest run src/app/routes.test.tsx`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): wire routes and providers`
**Status**: ✅ Done

---

### T112: Varredura de acessibilidade das páginas

**What**: Teste com axe sobre a tela de login e o dashboard do paciente renderizados com dados.
**Where**: `web/src/app/a11y.test.tsx`
**Depends on**: T111
**Reuses**: `vitest-axe`, MSW
**Requirement**: RSP-06, RSP-11

**Done when**:

- [x] Zero violações nas duas páginas; navegação por `Tab` alcança filtro, "Personalizar" e "Sair"
  - Nota: o botão "Personalizar" só existe na Fase 14; até lá o teste de teclado cobre o filtro, "Atualizar" e "Sair", e a Fase 14 deve estendê-lo com "Personalizar". Estendido na T119: o teste de teclado alcança "Personalizar" e há uma varredura axe com o modo ativo.
- [x] Gate `quick` passa: `cd web && npx vitest run src/app/a11y.test.tsx`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `test(web): scan pages for accessibility violations`
**Status**: ✅ Done

---

#### Phase 14: Web: personalização do layout

### T113: Estado do editor

**What**: `useLayoutEditor` com início, cancelamento, alterações pendentes e ações sobre o domínio do layout.
**Where**: `web/src/features/dashboard-layout/presentation/useLayoutEditor.ts`
**Depends on**: T112
**Reuses**: Domínio do layout
**Requirement**: LAY-03, LAY-04, LAY-05, LAY-06

**Done when**:

- [x] Teste com `renderHook`: cada ação altera o rascunho; cancelar descarta; limite de 20 respeitado
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/presentation/useLayoutEditor.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the layout editor state`
**Status**: ✅ Done

---

### T114: Adicionar e remover widgets

**What**: `WidgetPicker` com os widgets do catálogo do papel que não estão no layout e botão de remover em cada widget.
**Where**: `web/src/features/dashboard-layout/presentation/widgetPicker.tsx`
**Depends on**: T113
**Reuses**: `widgetRegistry`
**Requirement**: LAY-03

**Done when**:

- [x] Teste: só aparecem widgets do papel; adicionar e remover atualizam o rascunho; axe sem violações
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/presentation/widgetPicker.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the widget picker`
**Status**: ✅ Done

---

### T115: Reordenar arrastando

**What**: `SortableGrid` com `@dnd-kit` (ponteiro, toque e teclado) envolvendo a grade no modo Personalizar.
**Where**: `web/src/features/dashboard-layout/presentation/sortableGrid.tsx`
**Depends on**: T114
**Reuses**: Spike de dnd, `DashboardGrid`
**Requirement**: LAY-04

**Done when**:

- [x] Teste: reordenação pelo sensor de teclado muda a ordem do rascunho
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/presentation/sortableGrid.test.tsx`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): reorder widgets by drag and drop`
**Status**: ✅ Done

---

### T116: Mover por teclado

**What**: Botões "Mover para antes" e "Mover para depois" com anúncio em `aria-live`.
**Where**: `web/src/features/dashboard-layout/presentation/moveButtons.tsx`
**Depends on**: T115
**Reuses**: `useLayoutEditor`
**Requirement**: LAY-05

**Done when**:

- [x] Teste: `Tab` e `Enter` movem; primeiro não move para antes; último não move para depois; anúncio lido
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/presentation/moveButtons.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): move widgets with the keyboard`
**Status**: ✅ Done

---

### T117: Redimensionar

**What**: Controle S/M/L com só os tamanhos que o widget declara.
**Where**: `web/src/features/dashboard-layout/presentation/sizeControl.tsx`
**Depends on**: T116
**Reuses**: `WidgetDefinition.sizes`
**Requirement**: LAY-06

**Done when**:

- [x] Teste: tamanhos não declarados não aparecem; escolha altera o rascunho
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/presentation/sizeControl.test.tsx`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): resize widgets`
**Status**: ✅ Done

---

### T118: Barra de personalização

**What**: Personalizar, Salvar, Cancelar e Restaurar padrão (com confirmação).
**Where**: `web/src/features/dashboard-layout/presentation/layoutToolbar.tsx`
**Depends on**: T117
**Reuses**: `layoutUseCases`
**Requirement**: LAY-07, LAY-09, LAY-13

**Done when**:

- [x] MSW: salvar mostra "Layout salvo"; falha mantém o rascunho, mostra o erro e permite tentar de novo; restaurar pede confirmação e reaplica o padrão
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/presentation/layoutToolbar.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the layout toolbar`
**Status**: ✅ Done

---

### T119: Personalização integrada à página

**What**: A página do paciente ganha a barra e o modo Personalizar.
**Where**: `web/src/features/patient-dashboard/presentation/patientDashboardPage.tsx`
**Depends on**: T118
**Reuses**: Componentes do editor
**Requirement**: LAY-03, LAY-04, LAY-06, LAY-07, LAY-08

**Done when**:

- [x] MSW com armazenamento em memória: remover dois, mover um, salvar, remontar a aplicação e ver o mesmo layout
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/patient-dashboard/presentation/patientDashboardPage.test.tsx`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): enable layout customization on the patient page`
**Status**: ✅ Done

---

### T120: Prova de aberto/fechado dos widgets

**What**: Teste que registra um widget falso e o renderiza pela grade e pela página sem alterar nenhum dos dois.
**Where**: `web/src/features/dashboard-layout/presentation/openClosed.test.tsx`
**Depends on**: T119
**Reuses**: `widgetRegistry`, `DashboardGrid`
**Requirement**: ARQ-10

**Done when**:

- [x] O widget falso aparece com um módulo novo e uma linha de registro; nenhum arquivo de grade ou página é tocado
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/dashboard-layout/presentation/openClosed.test.tsx`
- [x] Pelo menos 1 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `test(web): prove widgets are open for extension`
**Status**: ✅ Done

---

#### Phase 15: Publicação na Vercel

### T121: Configuração da Vercel

**What**: `vercel.json` com fallback de SPA (sem reescrever assets e arquivos com extensão) e cabeçalhos de segurança.
**Where**: `web/vercel.json`
**Depends on**: T120
**Reuses**: Pesquisa do design
**Requirement**: DEP-02, DEP-03

**Done when**:

- [x] Teste `web/tests/deploy/vercelConfig.test.ts`: a regra casa `/paciente` e não casa `/assets/x.js`; CSP com `default-src 'self'`, `script-src 'self'`, `connect-src` só com a origem da API e `frame-ancestors 'none'`; `nosniff`, `Referrer-Policy` e `Permissions-Policy` presentes
- [x] Gate `quick` passa: `cd web && npx vitest run tests/deploy/vercelConfig.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add Vercel routing and security headers`
**Status**: ✅ Done

---

### T122: Rotas e gráficos sob demanda

**What**: Dashboards por `React.lazy` e um chunk separado para a biblioteca de gráficos.
**Where**: `web/vite.config.ts`
**Depends on**: T121
**Reuses**: `routes.tsx`
**Requirement**: DEP-06, ARQ-11

**Done when**:

- [x] O build gera chunk próprio para `recharts`, fora do carregamento inicial
- [x] Gate `build` passa: `cd web && npm run typecheck && npm run lint && npm run lint:arch && npm run test:coverage && npm run dup && npm run build && npm run size`

**Tests**: none
**Gate**: build
**Commit**: `perf(web): lazy-load dashboards and charts`
**Status**: ✅ Done

---

### T123: Orçamento de 250 kB

**What**: Script que soma o gzip do JavaScript carregado na rota inicial e falha acima de 250 kB.
**Where**: `web/scripts/checkBundleSize.mjs`
**Depends on**: T122
**Reuses**: —
**Requirement**: DEP-06

**Done when**:

- [x] Teste `web/tests/deploy/bundleSize.test.ts` com `dist` falso: abaixo passa, acima falha com o total na mensagem
- [x] `npm run size` passa no build real
- [x] Gate `quick` passa: `cd web && npx vitest run tests/deploy/bundleSize.test.ts`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `chore(web): enforce the 250 kB bundle budget`
**Status**: ✅ Done

---

### T124: CORS de produção com a origem da web

**What**: `.env.prod.example` documenta `CORS_ORIGIN` como lista com a origem da Vercel.
**Where**: `backend/deploy/.env.prod.example`
**Depends on**: T123
**Reuses**: Parser de lista do gateway
**Requirement**: DEP-07

**Done when**:

- [x] Exemplo com duas origens e comentário explicando que o app móvel não envia `Origin`
- [x] Gate `build` passa: `cd backend && npm run build && npm run test:coverage`

**Tests**: none
**Gate**: build
**Commit**: `docs(deploy): list the web origin in CORS_ORIGIN`
**Status**: ✅ Done

---

### T125: Guia de publicação da web

**What**: Seção Web em `docs/guides/deployment.md`: root `web`, preset Vite, build e saída, `VITE_API_URL`, branch de produção `main`, `ignoreCommand` e o ajuste de `CORS_ORIGIN`.
**Where**: `docs/guides/deployment.md`
**Depends on**: T124
**Reuses**: `backend/deploy/README.md`
**Requirement**: DEP-01, DEP-04, DEP-07

**Done when**:

- [x] Checklist do que o usuário faz no painel da Vercel, marcado como ação manual (o agente não conecta contas)
- [x] Cada arquivo citado existe
- [x] Gate `build` passa: `cd web && npm run test:coverage && cd ../backend && npm run build`

**Tests**: none
**Gate**: build
**Commit**: `docs: describe the Vercel deployment`
**Status**: ✅ Done

---

#### Phase 16: Refatoração do MVP

### T126: Refatorar o código repetido dos repositórios HTTP

**What**: Extrair a sequência requisição → `parseDto` → mapper repetida nos repositórios para um helper de infraestrutura.
**Where**: `web/src/shared/infrastructure/http/createRepository.ts`
**Depends on**: T125
**Reuses**: Repositórios de auth, layout, summary e diário
**Requirement**: ARQ-19, ARQ-17

**Done when**:

- [x] Antes de mexer, registrar a saída do `npm run dup` e a contagem de testes
- [x] Repositórios passam a usar o helper; nenhum teste é alterado e a contagem não cai
- [x] Se a duplicação real for outra, refatorar a mais relevante e registrar a escolha no commit
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/infrastructure/http/createRepository.test.ts`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(web): extract the HTTP repository helper`
**Status**: ✅ Done

---

### T127: Refatorar a montagem dos widgets de summary

**What**: Extrair a repetição "definição + `useSummary` + `WidgetShell` + `ChartFrame`" dos widgets do paciente para uma fábrica.
**Where**: `web/src/shared/presentation/widgets/defineSummaryWidget.tsx`
**Depends on**: T126
**Reuses**: Widgets do paciente
**Requirement**: ARQ-19, ARQ-10

**Done when**:

- [x] Widgets do paciente passam a usar a fábrica sem mudar comportamento; nenhum teste de widget é alterado
- [x] `npm run dup` mostra queda da duplicação em relação ao registro inicial
- [x] Gate `quick` passa: `cd web && npx vitest run src/shared/presentation/widgets/defineSummaryWidget.test.tsx`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `refactor(web): extract the summary widget factory`
**Status**: ✅ Done

---

#### Phase 17: Backend: cadastro do profissional (serviços)

### T128: Criar conta com papel informado pelo serviço

**What**: `AccountRepository.create` aceita `role` (`PATIENT` ou `HEALTH_PROFESSIONAL`); `ADMINISTRATOR` não é aceito por esse caminho.
**Where**: `backend/services/auth-service/src/modules/accounts/accounts.repository.ts`
**Depends on**: T127
**Reuses**: `create` atual (papel fixo na linha 90)
**Requirement**: REG-01, REG-06

**Done when**:

- [x] Integração: cria paciente e profissional; tentativa com `ADMINISTRATOR` lança
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(auth-service): let the service choose the account role`
**Status**: ✅ Done

---

### T129: Serviço: cadastrar profissional

**What**: `AccountsService.registerProfessional` com a mesma política de senha, conflito de e-mail, sessão, auditoria `REGISTER_PROFESSIONAL` e token com papel `HEALTH_PROFESSIONAL`.
**Where**: `backend/services/auth-service/src/modules/accounts/accounts.service.ts`
**Depends on**: T128
**Reuses**: `register` atual
**Requirement**: REG-01, REG-02, REG-03, REG-08

**Done when**:

- [x] Teste: `WEAK_PASSWORD`, `EMAIL_TAKEN`, linha de auditoria sem senha, token com papel certo e validade de 1 h
- [x] Cadastro de paciente inalterado
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(auth-service): register health professionals`
**Status**: ✅ Done

---

### T130: Rota interna de cadastro do profissional

**What**: `POST /internal/accounts/professional` no controller interno, com papel fixo e campo `role` do corpo ignorado.
**Where**: `backend/services/auth-service/src/modules/internal/internal.routes.ts`
**Depends on**: T129
**Reuses**: `register` interno
**Requirement**: REG-06

**Done when**:

- [x] Supertest: sem token interno `401`; com corpo contendo `"role":"ADMINISTRATOR"` cria profissional; resposta `201 { userId, token }`
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(auth-service): add the internal professional registration route`
**Status**: ✅ Done

---

### T131: Validar o perfil profissional

**What**: `parseProfessional`: número de registro de 1 a 40 caracteres e especialidade de 1 a 80, com `trim`.
**Where**: `backend/services/glucose-service/src/modules/professionals/professionals.schema.ts`
**Depends on**: T130
**Reuses**: `BadRequestError`
**Requirement**: REG-05

**Done when**:

- [x] Teste de fronteira: 40 passa, 41 falha; 80 passa, 81 falha; vazio e só espaços falham
- [x] Gate `quick` passa: `cd backend && npx vitest run services/glucose-service/tests/modules/professionals.schema.test.ts`
- [x] Pelo menos 6 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(glucose-service): validate professional profiles`
**Status**: ✅ Done

---

### T132: Módulo interno de profissionais

**What**: Repositório, serviço e rotas internas `POST /internal/professionals`, `GET /internal/professionals/me`, `DELETE /internal/professionals/:id`, registrados no container.
**Where**: `backend/services/glucose-service/src/modules/professionals/`
**Depends on**: T131
**Reuses**: Módulo `patient` (rotas internas)
**Requirement**: REG-01, REG-04, CON-11

**Done when**:

- [x] Integração: criação idempotente usando o `sub` do token interno; `me` devolve registro e especialidade; `DELETE` idempotente remove vínculos em cascata
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): add the internal professionals module`
**Status**: ✅ Done

---

#### Phase 18: Backend: cadastro do profissional (gateway) e seed do admin

### T133: Cliente do auth: cadastro profissional

**What**: `AuthClient.registerProfessional` chamando `/internal/accounts/professional`.
**Where**: `backend/services/gateway/src/clients/authClient.ts`
**Depends on**: T132
**Reuses**: `register` atual
**Requirement**: REG-01

**Done when**:

- [x] Teste com servidor stub: envia o corpo, devolve `{ userId, token }`, propaga erro do upstream
- [x] Gate `quick` passa: `cd backend && npx vitest run services/gateway/tests/clients/authClient.professional.test.ts`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(gateway): add professional registration to the auth client`
**Status**: ✅ Done

---

### T134: Cliente do glucose: perfil profissional

**What**: `GlucoseClient.createProfessional`, `getProfessional` e `deleteProfessional`.
**Where**: `backend/services/gateway/src/clients/glucoseClient.ts`
**Depends on**: T133
**Reuses**: Métodos de paciente
**Requirement**: REG-01, CON-11

**Done when**:

- [x] Teste com servidor stub dos três métodos e da identidade no token interno
- [x] Gate `quick` passa: `cd backend && npx vitest run services/gateway/tests/clients/glucoseClient.professional.test.ts`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(gateway): add professional calls to the glucose client`
**Status**: ✅ Done

---

### T135: Saga do cadastro profissional

**What**: `RegisterProfessionalSaga`: conta no auth, perfil no glucose, compensação apagando a conta se o perfil falhar.
**Where**: `backend/services/gateway/src/modules/registerProfessional/registerProfessional.saga.ts`
**Depends on**: T134
**Reuses**: `register.saga.ts`
**Requirement**: REG-04

**Done when**:

- [x] Teste: sucesso; falha do glucose apaga a conta e propaga; falha da compensação é registrada e o erro original propaga
- [x] Gate `quick` passa: `cd backend && npx vitest run services/gateway/tests/modules/registerProfessional.saga.test.ts`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(gateway): add the professional registration saga`
**Status**: ✅ Done

---

### T136: Rota pública de cadastro profissional

**What**: `POST /api/v1/auth/register/professional` montada antes do cadastro de paciente, com `registerLimiter`.
**Where**: `backend/services/gateway/src/modules/registerProfessional/registerProfessional.routes.ts`
**Depends on**: T135
**Reuses**: `register.routes.ts`
**Requirement**: REG-01, REG-02, REG-03, REG-06, REG-07

**Done when**:

- [x] Supertest com clientes falsos: `201`; `WEAK_PASSWORD` e `EMAIL_TAKEN` repassados; 21ª requisição em 15 min `429`; `role` no corpo não chega ao auth
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(gateway): expose professional registration`
**Status**: ✅ Done

---

### T137: /me por papel

**What**: `MeController.get` só chama o glucose para paciente; profissional recebe o bloco `professional`; admin só a conta.
**Where**: `backend/services/gateway/src/modules/me/me.controller.ts`
**Depends on**: T136
**Reuses**: Composição atual
**Requirement**: ACC-01, REG-01

**Done when**:

- [x] Teste: `getPatient` não é chamado para profissional nem admin (evita criar `Patient`); bloco `professional` presente; perna do perfil profissional falhando degrada com `X-Degraded`
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `fix(gateway): compose /me by role`
**Status**: ✅ Done

---

### T138: Excluir conta por papel

**What**: `AccountController.remove` apaga o perfil clínico conforme o papel antes da conta.
**Where**: `backend/services/gateway/src/modules/account/account.controller.ts`
**Depends on**: T137
**Reuses**: Ordem atual (glucose, depois auth)
**Requirement**: CON-11

**Done when**:

- [x] Teste: paciente chama `deletePatient`; profissional chama `deleteProfessional`; admin só apaga a conta; ordem preservada
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `fix(gateway): delete clinical profiles by role`
**Status**: ✅ Done

---

### T139: Seed do administrador

**What**: `ensureAdminSeed` chamado em `index.ts` antes de `listen`, a partir de `ADMIN_SEED_EMAIL` e `ADMIN_SEED_PASSWORD`.
**Where**: `backend/services/auth-service/src/lib/adminSeed.ts`
**Depends on**: T138
**Reuses**: `passwordPolicy`, `PasswordHasher`
**Requirement**: REG-09, REG-10

**Done when**:

- [x] Integração: cria quando não há admin; não duplica em nova subida; não cria quando já existe outro admin
- [x] Produção com variável faltando ou senha fraca lança erro que nomeia a variável; a senha nunca aparece em log (spy no console)
- [x] `.env.example` documenta as duas variáveis
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(auth-service): seed the first administrator`
**Status**: ✅ Done

---

#### Phase 19: Backend: consentimento (glucose-service)

### T140: Tabelas do consentimento

**What**: Model `PatientInvite`, coluna `DashboardAccessGrant.revokedAt` e, no SQL da migration, os índices únicos parciais.
**Where**: `backend/services/glucose-service/prisma/schema.prisma`
**Depends on**: T139
**Reuses**: Migration do dashboard (SQL à mão)
**Requirement**: CON-03, CON-07

**Done when**:

- [x] Migration com índice único parcial de convite pendente por paciente e de vínculo ativo por par
- [x] `npm run build` passa e a migration aplica no banco de teste; o comentário `roadmap` do grant sai
- [x] Gate `build` passa: `cd backend && npm run build && npm run test:coverage`

**Tests**: none
**Gate**: build
**Commit**: `feat(glucose-service): add invite and grant revocation tables`
**Status**: ✅ Done

---

### T141: Código de convite

**What**: `generateInviteCode`, `normalizeInviteCode` e `hashInviteCode` (sha256).
**Where**: `backend/services/glucose-service/src/modules/sharing/inviteCode.ts`
**Depends on**: T140
**Reuses**: `node:crypto`
**Requirement**: CON-02

**Done when**:

- [x] Teste: 8 caracteres de um alfabeto de 32 sem `0`, `O`, `1`, `I`; usa `crypto.randomInt` (spy); normaliza minúsculas, espaços e hífen; hash estável
- [x] Gate `quick` passa: `cd backend && npx vitest run services/glucose-service/tests/modules/inviteCode.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(glucose-service): generate invite codes`
**Status**: ✅ Done

---

### T142: Repositório do consentimento

**What**: Criar convite invalidando o pendente na mesma transação, resgatar de forma atômica, criar e revogar vínculo, listar vínculos ativos.
**Where**: `backend/services/glucose-service/src/modules/sharing/sharing.repository.ts`
**Depends on**: T141
**Reuses**: Prisma, índices parciais
**Requirement**: CON-03, CON-04, CON-07, CON-09

**Done when**:

- [x] Integração: dois convites seguidos deixam um pendente; dois resgates simultâneos do mesmo código: um vence; vínculo duplicado reaproveita o ativo; revogado sai da lista; `expiresAt` no passado conta como inativo
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 6 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): persist invites and grants`
**Status**: ✅ Done

---

### T143: Serviço do consentimento

**What**: `createInvite`, `redeem`, `listGrants` e `revoke`, com auditoria.
**Where**: `backend/services/glucose-service/src/modules/sharing/sharing.service.ts`
**Depends on**: T142
**Reuses**: `recordAudit`
**Requirement**: CON-01, CON-04, CON-05, CON-07, CON-10

**Done when**:

- [x] Teste com fakes: validade de 24 h; resgate novo `201`, existente `200`; desconhecido, expirado, usado e invalidado dão o mesmo `400 INVALID_INVITE`
- [x] Auditoria de gerar, resgatar, invalidar e revogar sem o código em claro nem dado clínico
- [x] Gate `quick` passa: `cd backend && npx vitest run services/glucose-service/tests/modules/sharing.service.test.ts`
- [x] Pelo menos 8 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(glucose-service): add the sharing service`
**Status**: ✅ Done

---

### T144: Política de vínculo ativo

**What**: `GrantPolicy.assertActive(professionalId, patientId)` com `403 NO_ACTIVE_GRANT`.
**Where**: `backend/services/glucose-service/src/modules/sharing/grantPolicy.ts`
**Depends on**: T143
**Reuses**: `ForbiddenError`
**Requirement**: CON-09, PRO-12

**Done when**:

- [x] Teste: ativo passa; revogado, expirado e inexistente lançam `NO_ACTIVE_GRANT`
- [x] Gate `quick` passa: `cd backend && npx vitest run services/glucose-service/tests/modules/grantPolicy.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(glucose-service): enforce active grants`
**Status**: ✅ Done

---

### T145: Rotas /sharing

**What**: Controller e rotas `POST /sharing/invites`, `GET /sharing/grants`, `DELETE /sharing/grants/:id` (PATIENT) e `POST /sharing/redeem` (HEALTH_PROFESSIONAL), registrados no container e montados no app.
**Where**: `backend/services/glucose-service/src/modules/sharing/`
**Depends on**: T144
**Reuses**: Padrão dos módulos do glucose-service
**Requirement**: CON-01, CON-04, CON-08, CON-09, ACC-06

**Done when**:

- [x] Supertest: fluxo completo gerar → resgatar → listar → revogar; papel errado `403 FORBIDDEN_ROLE`; leitura após revogar `403 NO_ACTIVE_GRANT`; revogar vínculo de outro paciente `404`
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 6 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): expose the sharing routes`
**Status**: ✅ Done

---

#### Phase 20: Backend: consentimento no gateway e nomes

### T146: Lookup de nomes no auth-service

**What**: `POST /internal/accounts/lookup` com até 200 ids devolvendo `[{ id, fullName }]`.
**Where**: `backend/services/auth-service/src/modules/internal/internal.controller.ts`
**Depends on**: T145
**Reuses**: Controller interno
**Requirement**: PRO-15, CON-08

**Done when**:

- [x] Supertest: devolve só id e nome; id inválido `400`; mais de 200 ids `400`; id desconhecido ausente da resposta
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(auth-service): resolve account names for the gateway`
**Status**: ✅ Done

---

### T147: Cliente do auth: lookup

**What**: `AuthClient.lookupAccounts(ids)`.
**Where**: `backend/services/gateway/src/clients/authClient.ts`
**Depends on**: T146
**Reuses**: `InternalHttpClient`
**Requirement**: PRO-15

**Done when**:

- [x] Teste com stub: envia os ids e devolve o mapa; lista vazia não chama o upstream
- [x] Gate `quick` passa: `cd backend && npx vitest run services/gateway/tests/clients/authClient.lookup.test.ts`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(gateway): add account lookup to the auth client`
**Status**: ✅ Done

---

### T148: Limitador de resgate por usuário

**What**: `redeemLimiter` com chave por `userId`, 10 por 15 min, montado em `/api/v1/sharing/redeem`.
**Where**: `backend/services/gateway/src/middleware/rateLimiters.ts`
**Depends on**: T147
**Reuses**: Limitadores atuais
**Requirement**: CON-06

**Done when**:

- [x] Supertest: 11ª tentativa do mesmo usuário `429`; outro usuário no mesmo IP não é afetado
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(gateway): rate-limit invite redemption per user`
**Status**: ✅ Done

---

### T149: Proxies de sharing e professional

**What**: Prefixos `sharing` e `professional` encaminhados ao glucose-service.
**Where**: `backend/services/gateway/src/app.ts`
**Depends on**: T148
**Reuses**: Mapa prefixo → serviço
**Requirement**: CON-04, PRO-11

**Done when**:

- [x] Teste com stub: os dois prefixos chegam ao glucose com o token; sem token `401`
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(gateway): route sharing and professional to glucose-service`
**Status**: ✅ Done

---

### T150: Vínculos do paciente com nomes

**What**: `GET /api/v1/sharing/grants` composto: lista do glucose mais nomes do auth; perna de nomes degradável.
**Where**: `backend/services/gateway/src/modules/sharing/grants.controller.ts`
**Depends on**: T149
**Reuses**: `me.controller.ts`
**Requirement**: CON-08

**Done when**:

- [x] Teste: nomes preenchidos; lookup falhando devolve `fullName: null` e `X-Degraded`; montado antes do proxy
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(gateway): compose grants with professional names`
**Status**: ✅ Done

---

### T151: Exclusão remove convites e vínculos

**What**: Teste de integração da exclusão de paciente e de profissional sobre o banco clínico.
**Where**: `backend/services/glucose-service/tests/routes/sharing.deletion.test.ts`
**Depends on**: T150
**Reuses**: Rotas internas de exclusão
**Requirement**: CON-11

**Done when**:

- [x] Apagar paciente remove seus convites e vínculos; apagar profissional remove seus vínculos
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `test(glucose-service): cover consent cleanup on account deletion`
**Status**: ✅ Done

---

#### Phase 21: App móvel: compartilhar com profissional

### T152: Domínio do compartilhamento

**What**: Entidades `InviteCode` e `Grant`, port `SharingRepository` e casos de uso `GenerateInvite`, `ListGrants`, `RevokeGrant`.
**Where**: `lib/features/sharing/domain/`
**Depends on**: T151
**Reuses**: `lib/features/patient/domain/`
**Requirement**: CON-01, CON-08

**Done when**:

- [x] Teste em `test/features/sharing/domain/`: cada caso de uso delega ao port e propaga falha
- [x] Gate `quick` passa: `flutter test --no-pub test/features/sharing/domain`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(app): add the sharing domain`
**Status**: ✅ Done

---

### T153: Fonte remota do compartilhamento

**What**: `SharingRemoteDataSource` com Dio para `POST /sharing/invites`, `GET /sharing/grants`, `DELETE /sharing/grants/:id`.
**Where**: `lib/features/sharing/data/sharing_remote_datasource.dart`
**Depends on**: T152
**Reuses**: `ApiClient`
**Requirement**: CON-01, CON-13

**Done when**:

- [x] Teste com adaptador Dio falso: `201` vira `InviteCode`; erro de conexão vira falha `offline`; `403` vira falha de acesso
- [x] Gate `quick` passa: `flutter test --no-pub test/features/sharing/data/sharing_remote_datasource_test.dart`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(app): add the sharing remote data source`
**Status**: ✅ Done

---

### T154: Repositório do compartilhamento

**What**: `SharingRepositoryImpl` que traduz exceções em falhas do domínio.
**Where**: `lib/features/sharing/data/sharing_repository_impl.dart`
**Depends on**: T153
**Reuses**: Padrão do `PatientRepository`
**Requirement**: CON-13

**Done when**:

- [x] Teste: cada exceção da fonte vira a falha certa
- [x] Gate `quick` passa: `flutter test --no-pub test/features/sharing/data/sharing_repository_impl_test.dart`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(app): add the sharing repository`
**Status**: ✅ Done

---

### T155: Cubit do compartilhamento

**What**: `SharingCubit` com estados `idle`, `loading`, `inviteReady`, `offline`, `error` e a lista de vínculos.
**Where**: `lib/features/sharing/presentation/cubit/sharing_cubit.dart`
**Depends on**: T154
**Reuses**: Cubits existentes
**Requirement**: CON-01, CON-08, CON-13

**Done when**:

- [x] Teste: gerar sem rede vai a `offline` sem código; revogar remove da lista; erro preserva a lista anterior
- [x] Gate `quick` passa: `flutter test --no-pub test/features/sharing/presentation/sharing_cubit_test.dart`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(app): add the sharing cubit`
**Status**: ✅ Done

---

### T156: Textos do compartilhamento

**What**: Chaves pt e pt-BR: explicação do que o profissional vê, rótulos, contagem regressiva, "Sem conexão. Conecte-se para gerar o código.".
**Where**: `lib/l10n/app_pt.arb`
**Depends on**: T155
**Reuses**: `app_pt_BR.arb` (mesmas chaves)
**Requirement**: CON-12, CON-13

**Done when**:

- [x] Mesmas chaves nos dois `.arb`; `flutter gen-l10n` regenera sem erro
- [x] Gate `build` passa: `flutter gen-l10n && flutter analyze && flutter test --no-pub`

**Tests**: none
**Gate**: build
**Commit**: `feat(app): add sharing strings`
**Status**: ✅ Done

---

### T157: Tela de compartilhamento

**What**: Texto do que o profissional vê antes do botão, código com contagem regressiva de 24 h e lista de vínculos com revogar (com confirmação).
**Where**: `lib/features/sharing/presentation/pages/sharing_page.dart`
**Depends on**: T156
**Reuses**: `GlucoreMessenger`, `AppLocalizations`
**Requirement**: CON-01, CON-08, CON-12, CON-13

**Done when**:

- [x] Teste de widget com cubit falso: explicação aparece antes de gerar; contagem regressiva diminui; offline mostra a mensagem e nenhum código; revogar pede confirmação
- [x] Gate `full` passa: `flutter analyze && flutter test --no-pub`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: full
**Commit**: `feat(app): add the sharing page`
**Status**: ✅ Done

---

### T158: Registrar o compartilhamento no DI

**What**: Registros da fonte, repositório, casos de uso e cubit no `injection_container.dart`.
**Where**: `lib/injection_container.dart`
**Depends on**: T157
**Reuses**: Registros existentes
**Requirement**: CON-01

**Done when**:

- [x] Teste: `sl<SharingCubit>()` resolve depois de `initDependencies()`
- [x] Gate `full` passa: `flutter analyze && flutter test --no-pub`
- [x] Pelo menos 1 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: full
**Commit**: `feat(app): register sharing dependencies`
**Status**: ✅ Done

---

### T159: Entrada nas configurações

**What**: Item "Compartilhar com profissional" em `settings_page.dart` abrindo a tela.
**Where**: `lib/features/patient/presentation/pages/settings_page.dart`
**Depends on**: T158
**Reuses**: Itens atuais
**Requirement**: CON-01

**Done when**:

- [x] Teste de widget: tocar no item abre a tela de compartilhamento
- [x] Gate `full` passa: `flutter analyze && flutter test --no-pub`
- [x] Pelo menos 1 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: full
**Commit**: `feat(app): link sharing from settings`
**Status**: ✅ Done

---

#### Phase 22: Backend: carteira do profissional

### T160: Métricas por paciente da carteira

**What**: `getPatientMetrics(ids, bounds, tz)` numa consulta com `LATERAL` sobre `glucose_metrics` e `glucose_zones`, episódios de hipo, alertas e última leitura.
**Where**: `backend/services/glucose-service/src/modules/professional/professional.repository.ts`
**Depends on**: T159
**Reuses**: Funções SQL e consulta de excursões
**Requirement**: PRO-03, PRO-11

**Done when**:

- [x] Integração com 3 pacientes: métricas de cada um conferem com o `summary` individual; uma consulta só (sem laço por paciente)
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): compute cohort metrics in one query`
**Status**: ✅ Done

---

### T161: Pacientes vinculados paginados

**What**: `listGrantedPatientIds(professionalId, page, limit)` com total.
**Where**: `backend/services/glucose-service/src/modules/professional/professional.listing.ts`
**Depends on**: T160
**Reuses**: `parsePageQuery`
**Requirement**: PRO-11, PRO-16

**Done when**:

- [x] Integração: só vínculos ativos; padrão 50, máximo 200; total correto
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): list granted patients`
**Status**: ✅ Done

---

### T162: Hipos da carteira por hora

**What**: `getHypoStartHours(ids, bounds, tz)` com a hora local de início de cada episódio.
**Where**: `backend/services/glucose-service/src/modules/professional/professional.hypo.ts`
**Depends on**: T161
**Reuses**: Consulta de excursões particionada por paciente
**Requirement**: PRO-10

**Done when**:

- [x] Integração: episódios de dois pacientes contados na hora local certa
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): bucket cohort hypo episodes by hour`
**Status**: ✅ Done

---

### T163: Serviço da carteira

**What**: `listPatients`, `patientSummary` (com `GrantPolicy` e `DashboardService.getSummary`) e `cohortSummary` (KPIs e histograma), todos com auditoria de leitura.
**Where**: `backend/services/glucose-service/src/modules/professional/professional.service.ts`
**Depends on**: T162
**Reuses**: `DashboardService`, `GrantPolicy`, `recordAudit`
**Requirement**: PRO-03, PRO-09, PRO-10, PRO-11, PRO-12, PRO-14

**Done when**:

- [x] Teste com fakes: histograma nas faixas < 50, 50–70, ≥ 70; pacientes sem leitura há mais de 24 h; paciente sem vínculo lança `NO_ACTIVE_GRANT`; auditoria sem valores de glicose
- [x] Gate `quick` passa: `cd backend && npx vitest run services/glucose-service/tests/modules/professional.service.test.ts`
- [x] Pelo menos 6 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(glucose-service): add the professional service`
**Status**: ✅ Done

---

### T164: Rotas /professional

**What**: Controller e rotas `GET /professional/patients`, `GET /professional/patients/:id/summary`, `GET /professional/cohort/summary` (HEALTH_PROFESSIONAL), no container e no app.
**Where**: `backend/services/glucose-service/src/modules/professional/`
**Depends on**: T163
**Reuses**: Padrão dos módulos
**Requirement**: PRO-11, PRO-12, PRO-14, PRO-16, ACC-06

**Done when**:

- [x] Supertest: profissional só vê vinculados; sem vínculo `403 NO_ACTIVE_GRANT`; paciente `403 FORBIDDEN_ROLE`; `:id` inválido `400`; leitura grava auditoria; limites de paginação
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 6 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): expose professional routes`
**Status**: ✅ Done

---

### T165: Carteira com nomes no gateway

**What**: `GET /api/v1/professional/patients` composto com `fullName` e iniciais.
**Where**: `backend/services/gateway/src/modules/professional/patients.controller.ts`
**Depends on**: T164
**Reuses**: Controller de vínculos compostos (`modules/sharing/grants.controller.ts`)
**Requirement**: PRO-03, PRO-15

**Done when**:

- [x] Teste: nomes e iniciais preenchidos; lookup falhando dá iniciais derivadas do id, `fullName: null` e `X-Degraded`
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(gateway): compose the patient list with names`
**Status**: ✅ Done

---

### T166: Resumo da carteira com nomes no gateway

**What**: `GET /api/v1/professional/cohort/summary` composto com nomes em `perPatient`.
**Where**: `backend/services/gateway/src/modules/professional/cohort.controller.ts`
**Depends on**: T165
**Reuses**: Controller da tarefa anterior
**Requirement**: PRO-10, PRO-15

**Done when**:

- [x] Teste: nomes em `perPatient`; degradação igual à da lista
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(gateway): compose the cohort summary with names`
**Status**: ✅ Done

---

#### Phase 23: Web: cadastro do profissional

### T167: Política de senha na web

**What**: `validatePassword` com a mesma tabela de casos do app e do backend (AD-001).
**Where**: `web/src/features/registration/domain/passwordPolicy.ts`
**Depends on**: T166
**Reuses**: Tabela de casos de `.specs/features/checklist-tcc-compliance/design.md`
**Requirement**: REG-02

**Done when**:

- [x] Teste com a tabela do AD-001, incluindo 7 e 8 caracteres e cada classe de caractere faltando
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/registration/domain/passwordPolicy.test.ts`
- [x] Pelo menos 8 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the password policy`
**Status**: ✅ Done

---

### T168: Caso de uso: cadastrar profissional

**What**: `createRegisterProfessional` valida senha e campos, cadastra e entra na sessão.
**Where**: `web/src/features/registration/application/registerProfessional.ts`
**Depends on**: T167
**Reuses**: `createLogin`
**Requirement**: REG-01, REG-02, REG-05

**Done when**:

- [x] Teste com fakes: senha fraca não chama o repositório; CRM com 41 caracteres falha; sucesso grava token e devolve sessão de profissional
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/registration/application/registerProfessional.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the professional registration use case`
**Status**: ✅ Done

---

### T169: Repositório do cadastro (HTTP)

**What**: `HttpRegistrationRepository` para `POST /auth/register/professional`.
**Where**: `web/src/features/registration/infrastructure/httpRegistrationRepository.ts`
**Depends on**: T168
**Reuses**: `createRepository`
**Requirement**: REG-01, REG-03, REG-07

**Done when**:

- [x] MSW: `201` vira `{ userId, token }`; `409 EMAIL_TAKEN` vira `conflict`; `400 WEAK_PASSWORD` vira `validation`; `429` vira `rate-limited`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/registration/infrastructure/httpRegistrationRepository.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: quick
**Commit**: `feat(web): add the HTTP registration repository`
**Status**: ✅ Done

---

### T170: Tela de cadastro do profissional

**What**: Formulário com nome, e-mail, senha, telefone opcional, CRM e especialidade, link a partir do login e rota `/cadastro-profissional`.
**Where**: `web/src/features/registration/presentation/registerProfessionalPage.tsx`
**Depends on**: T169
**Reuses**: `loginPage`, `ui/states`
**Requirement**: REG-01, REG-02, REG-03, REG-05, RSP-06

**Done when**:

- [x] Teste: regra de senha mostrada no campo; e-mail duplicado mostra mensagem própria; sucesso abre `/profissional`; axe sem violações
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/registration/presentation/registerProfessionalPage.test.tsx`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the professional registration page`
**Status**: ✅ Done

---

#### Phase 24: Web: dados do profissional

### T171: Regra de risco

**What**: `classifyRisk(metrics)` → `HIGH`, `ATTENTION`, `OK` ou `INSUFFICIENT`.
**Where**: `web/src/features/professional/domain/risk.ts`
**Depends on**: T170
**Reuses**: Assumptions da spec
**Requirement**: PRO-04

**Done when**:

- [x] Fronteiras: TIR 49,99/50 e 69,99/70; abaixo de 54 em 1,00/1,01 %; abaixo de 70 em 4,00/4,01 %; CV 36,00/36,01; uso do sensor 69,99/70
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/domain/risk.test.ts`
- [x] Pelo menos 11 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add the patient risk rule`
**Status**: ✅ Done

---

### T172: Filtro, busca e ordenação da carteira

**What**: `filterPatients` (risco, nome sem distinção de acento e caixa) e `sortPatients` (qualquer coluna, asc e desc).
**Where**: `web/src/features/professional/domain/patientList.ts`
**Depends on**: T171
**Reuses**: `classifyRisk`
**Requirement**: PRO-06, PRO-07

**Done when**:

- [x] Teste: busca "joao" encontra "João"; filtro ALTO; ordenação por TIR e por última leitura nos dois sentidos, nulos no fim
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/domain/patientList.test.ts`
- [x] Pelo menos 6 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): filter and sort the patient list`
**Status**: ✅ Done

---

### T173: Entidades e ports do profissional

**What**: Tipos `PatientRow`, `CohortSummary` e ports `ProfessionalRepository` e `RedeemRepository`.
**Where**: `web/src/features/professional/domain/cohort.ts`
**Depends on**: T172
**Reuses**: Contratos do design
**Requirement**: ARQ-05

**Done when**:

- [x] Só tipos; `npm run typecheck` passa
- [x] Gate `build` passa: `cd web && npm run typecheck && npm run lint && npm run lint:arch && npm run test:coverage && npm run dup && npm run build && npm run size`

**Tests**: none
**Gate**: build
**Commit**: `feat(web): declare professional entities`
**Status**: ✅ Done

---

### T174: Repositório do profissional (HTTP)

**What**: `HttpProfessionalRepository` para lista paginada e resumo da carteira.
**Where**: `web/src/features/professional/infrastructure/httpProfessionalRepository.ts`
**Depends on**: T173
**Reuses**: `createRepository`
**Requirement**: PRO-03, PRO-09, PRO-10, ARQ-06

**Done when**:

- [x] MSW: lista com `fullName: null` usa iniciais; resumo vira `CohortSummary`; `403 NO_ACTIVE_GRANT` vira `forbidden` com o código
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/infrastructure/httpProfessionalRepository.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: quick
**Commit**: `feat(web): add the HTTP professional repository`
**Status**: ✅ Done

---

### T175: Repositório do resgate (HTTP)

**What**: `HttpRedeemRepository` para `POST /sharing/redeem`.
**Where**: `web/src/features/professional/infrastructure/httpRedeemRepository.ts`
**Depends on**: T174
**Reuses**: `createRepository`
**Requirement**: CON-04, CON-05, CON-06

**Done when**:

- [x] MSW: `201` e `200` viram vínculo; `400 INVALID_INVITE` vira `validation` com o código; `429` vira `rate-limited`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/infrastructure/httpRedeemRepository.test.ts`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: quick
**Commit**: `feat(web): add the HTTP redeem repository`
**Status**: ✅ Done

---

### T176: Casos de uso do profissional

**What**: `loadPatients`, `loadCohort` e `redeemInvite` (normaliza maiúsculas e remove espaços).
**Where**: `web/src/features/professional/application/professionalUseCases.ts`
**Depends on**: T175
**Reuses**: Ports do profissional
**Requirement**: PRO-02, PRO-05, CON-04

**Done when**:

- [x] Teste: código " ab12 cd34 " vira "AB12CD34"; período inválido não chama o repositório
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/application/professionalUseCases.test.ts`
- [x] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add professional use cases`
**Status**: ✅ Done

---

### T177: Hooks da carteira

**What**: `usePatients` e `useCohort` com TanStack Query; `NO_ACTIVE_GRANT` remove o paciente do cache e avisa.
**Where**: `web/src/features/professional/presentation/useCohort.ts`
**Depends on**: T176
**Reuses**: `queryClient`
**Requirement**: PRO-05, PRO-13

**Done when**:

- [x] MSW: troca de período refaz as duas consultas; resposta `NO_ACTIVE_GRANT` remove o paciente e mostra "O paciente revogou o acesso"
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/useCohort.test.ts`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add professional query hooks`
**Status**: ✅ Done

---

#### Phase 25: Web: widgets do profissional

### T178: Widget de resgate de código

**What**: Widget `pro-redeem-code`: o campo de código com envio.
**Where**: `web/src/features/professional/presentation/widgets/proRedeemCode.tsx`
**Depends on**: T177
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PRO-01, PRO-02, CON-05

**Done when**:

- [x] Exporta `WidgetDefinition` com id `pro-redeem-code`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza o campo de código com envio a partir de `redeemInvite`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Código inválido mostra "Código inválido ou expirado"; sucesso inclui o paciente na lista sem recarregar
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/widgets/proRedeemCode.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add pro-redeem-code widget`
**Status**: ✅ Done

---

### T179: KPI de pacientes vinculados

**What**: Widget `pro-kpi-patients`: a quantidade de pacientes vinculados.
**Where**: `web/src/features/professional/presentation/widgets/proKpiPatients.tsx`
**Depends on**: T178
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PRO-09

**Done when**:

- [x] Exporta `WidgetDefinition` com id `pro-kpi-patients`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza a quantidade de pacientes vinculados a partir de `cohort.patientCount`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/widgets/proKpiPatients.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add pro-kpi-patients widget`
**Status**: ✅ Done

---

### T180: KPI de TIR médio

**What**: Widget `pro-kpi-tir`: o TIR médio da carteira com meta de 70 %.
**Where**: `web/src/features/professional/presentation/widgets/proKpiTir.tsx`
**Depends on**: T179
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PRO-09

**Done when**:

- [x] Exporta `WidgetDefinition` com id `pro-kpi-tir`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza o TIR médio da carteira com meta de 70 % a partir de `cohort.avgTimeInRangePercent`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/widgets/proKpiTir.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add pro-kpi-tir widget`
**Status**: ✅ Done

---

### T181: KPI de GMI médio

**What**: Widget `pro-kpi-gmi`: o GMI médio da carteira.
**Where**: `web/src/features/professional/presentation/widgets/proKpiGmi.tsx`
**Depends on**: T180
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PRO-09

**Done when**:

- [x] Exporta `WidgetDefinition` com id `pro-kpi-gmi`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza o GMI médio da carteira a partir de `cohort.avgGmiPercent`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/widgets/proKpiGmi.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add pro-kpi-gmi widget`
**Status**: ✅ Done

---

### T182: KPI de pacientes com hipo

**What**: Widget `pro-kpi-hypo`: quantos pacientes tiveram hipo no período.
**Where**: `web/src/features/professional/presentation/widgets/proKpiHypo.tsx`
**Depends on**: T181
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PRO-09

**Done when**:

- [x] Exporta `WidgetDefinition` com id `pro-kpi-hypo`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza quantos pacientes tiveram hipo no período a partir de `cohort.patientsWithHypo`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/widgets/proKpiHypo.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add pro-kpi-hypo widget`
**Status**: ✅ Done

---

### T183: KPI de pacientes sem dado recente

**What**: Widget `pro-kpi-stale`: quantos estão sem leitura há mais de 24 h.
**Where**: `web/src/features/professional/presentation/widgets/proKpiStale.tsx`
**Depends on**: T182
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PRO-09

**Done when**:

- [x] Exporta `WidgetDefinition` com id `pro-kpi-stale`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza quantos estão sem leitura há mais de 24 h a partir de `cohort.patientsStale`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/widgets/proKpiStale.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add pro-kpi-stale widget`
**Status**: ✅ Done

---

### T184: Tabela da carteira

**What**: Widget `pro-patients-table`: a tabela ordenável e filtrável com indicador de risco em texto e cor.
**Where**: `web/src/features/professional/presentation/widgets/proPatientsTable.tsx`
**Depends on**: T183
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PRO-03, PRO-06, PRO-07, PRO-16, RSP-03

**Done when**:

- [x] Exporta `WidgetDefinition` com id `pro-patients-table`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza a tabela ordenável e filtrável com indicador de risco em texto e cor a partir de `usePatients`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Filtro de risco, busca por nome, ordenação por coluna e página de 50
- [x] Linha leva a `/profissional/pacientes/:id`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/widgets/proPatientsTable.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add pro-patients-table widget`
**Status**: ✅ Done

---

### T185: Zonas por paciente

**What**: Widget `pro-tir-by-patient`: barras empilhadas de zonas por paciente.
**Where**: `web/src/features/professional/presentation/widgets/proTirByPatient.tsx`
**Depends on**: T184
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PRO-10

**Done when**:

- [x] Exporta `WidgetDefinition` com id `pro-tir-by-patient`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza barras empilhadas de zonas por paciente a partir de `cohort.perPatient`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Usa o adaptador `StackedBarChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/widgets/proTirByPatient.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add pro-tir-by-patient widget`
**Status**: ✅ Done

---

### T186: Dispersão TIR × CV

**What**: Widget `pro-risk-scatter`: a dispersão TIR × CV com quadrantes.
**Where**: `web/src/features/professional/presentation/widgets/proRiskScatter.tsx`
**Depends on**: T185
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PRO-10

**Done when**:

- [x] Exporta `WidgetDefinition` com id `pro-risk-scatter`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza a dispersão TIR × CV com quadrantes a partir de `cohort.perPatient`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Usa o adaptador `ScatterQuadrantChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/widgets/proRiskScatter.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add pro-risk-scatter widget`
**Status**: ✅ Done

---

### T187: Histograma de TIR

**What**: Widget `pro-tir-histogram`: pacientes por faixa de TIR.
**Where**: `web/src/features/professional/presentation/widgets/proTirHistogram.tsx`
**Depends on**: T186
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PRO-10

**Done when**:

- [x] Exporta `WidgetDefinition` com id `pro-tir-histogram`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [x] Renderiza pacientes por faixa de TIR a partir de `cohort.tirHistogram`
- [x] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [x] Usa o adaptador `BarChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [x] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/widgets/proTirHistogram.test.tsx`
- [x] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add pro-tir-histogram widget`
**Status**: ✅ Done

---

#### Phase 26: Web: páginas do profissional

### T188: Hipos por hora

**What**: Widget `pro-hypo-by-hour`: episódios de hipo por hora do dia.
**Where**: `web/src/features/professional/presentation/widgets/proHypoByHour.tsx`
**Depends on**: T187
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: PRO-10

**Done when**:

- [ ] Exporta `WidgetDefinition` com id `pro-hypo-by-hour`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [ ] Renderiza episódios de hipo por hora do dia a partir de `cohort.hypoByHour`
- [ ] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [ ] Usa o adaptador `BarChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/widgets/proHypoByHour.test.tsx`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add pro-hypo-by-hour widget`

---

### T189: Catálogo de widgets do profissional

**What**: Registra os 11 widgets do profissional, uma linha por widget.
**Where**: `web/src/features/professional/presentation/widgetCatalog.ts`
**Depends on**: T188
**Reuses**: `widgetRegistry`
**Requirement**: LAY-01, ARQ-10

**Done when**:

- [ ] Teste: ids iguais aos do papel `HEALTH_PROFESSIONAL` em `contracts/widget-catalog.json`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/widgetCatalog.test.ts`
- [ ] Pelo menos 1 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): register the professional widgets`

---

### T190: Página da carteira

**What**: `/profissional` com casca, filtro de período, barra de personalização e estado vazio sem vínculo.
**Where**: `web/src/features/professional/presentation/professionalDashboardPage.tsx`
**Depends on**: T189
**Reuses**: Página do paciente
**Requirement**: PRO-01, PRO-05, LAY-03, LAY-07

**Done when**:

- [ ] MSW: sem vínculo mostra a explicação e o campo de código; com vínculos mostra os widgets; período recalcula tudo
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/professionalDashboardPage.test.tsx`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the professional dashboard page`

---

### T191: Detalhe do paciente vinculado

**What**: `/profissional/pacientes/:id` com os widgets do paciente no escopo do paciente vinculado, layout padrão e volta à carteira.
**Where**: `web/src/features/professional/presentation/patientDetailPage.tsx`
**Depends on**: T190
**Reuses**: `SummaryScopeProvider`, catálogo do paciente
**Requirement**: PRO-08, PRO-13

**Done when**:

- [ ] MSW: carrega `/professional/patients/:id/summary`; `NO_ACTIVE_GRANT` volta à carteira com "O paciente revogou o acesso"
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/professional/presentation/patientDetailPage.test.tsx`
- [ ] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the linked patient detail page`

---

### T192: Rotas do profissional e do cadastro

**What**: `/cadastro-profissional`, `/profissional` e `/profissional/pacientes/:id` com guarda de papel.
**Where**: `web/src/app/routes.tsx`
**Depends on**: T191
**Reuses**: `RequireRole`
**Requirement**: ACC-02, ACC-03, PRO-08

**Done when**:

- [ ] Teste: profissional entra em `/profissional`; paciente em `/profissional` volta a `/paciente`; cadastro é público
- [ ] Gate `quick` passa: `cd web && npx vitest run src/app/routes.test.tsx`
- [ ] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): route the professional area`

---

#### Phase 27: Backend: visão do administrador

### T193: Papel nas rotas internas

**What**: `requireInternalRole(roles)` no pacote compartilhado, para rodar depois de `requireInternalAuth`.
**Where**: `backend/packages/shared/src/auth/requireInternalRole.ts`
**Depends on**: T192
**Reuses**: `requireRole`
**Requirement**: ADM-05

**Done when**:

- [ ] Teste em `auth-service/tests/lib/requireInternalRole.test.ts`: papel certo passa; outro papel `403 FORBIDDEN_ROLE`; sem identidade `401`
- [ ] Gate `quick` passa: `cd backend && npx vitest run services/auth-service/tests/lib/requireInternalRole.test.ts`
- [ ] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(shared): authorize internal routes by role`

---

### T194: Estatísticas de contas

**What**: Total, por papel, por status, cadastros por dia e no período.
**Where**: `backend/services/auth-service/src/modules/admin/admin.repository.ts`
**Depends on**: T193
**Reuses**: Prisma `groupBy`
**Requirement**: ADM-01, ADM-02

**Done when**:

- [ ] Integração: contagens conferem com o fixture; dias sem cadastro aparecem com zero
- [ ] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [ ] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(auth-service): compute account statistics`

---

### T195: Lista de contas

**What**: Filtro por papel e status, busca por nome ou e-mail (com escape), página de 25 e auditoria do acesso.
**Where**: `backend/services/auth-service/src/modules/admin/admin.service.ts`
**Depends on**: T194
**Reuses**: `parsePageQuery`, `recordAudit`
**Requirement**: ADM-04, ADM-06

**Done when**:

- [ ] Integração: filtros combinados; busca com `%` literal não vira curinga; auditoria `ADMIN_LIST_USERS` gravada
- [ ] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(auth-service): list accounts for administrators`

---

### T196: Rotas internas de admin no auth-service

**What**: `GET /internal/admin/stats` e `GET /internal/admin/users` com `requireInternalRole('ADMINISTRATOR')`.
**Where**: `backend/services/auth-service/src/modules/admin/admin.routes.ts`
**Depends on**: T195
**Reuses**: Rotas internas
**Requirement**: ADM-05

**Done when**:

- [ ] Supertest: identidade de admin `200`; de paciente `403`; sem token interno `401`
- [ ] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [ ] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(auth-service): expose internal admin routes`

---

### T197: Estatísticas clínicas agregadas

**What**: Migration com índice BRIN em `GlucoseReading.recordedAt` e repositório com pacientes ativos 24 h/7 d, pacientes cadastrados, leituras por dia, vínculos ativos e criados por semana e alertas por tipo.
**Where**: `backend/services/glucose-service/src/modules/admin/admin.repository.ts`
**Depends on**: T196
**Reuses**: Prisma `groupBy` e SQL cru
**Requirement**: ADM-01, ADM-02, ADM-03

**Done when**:

- [ ] Integração: contagens conferem; a resposta não tem nenhum `patientId` nem valor de glicose (varredura das chaves)
- [ ] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): compute platform statistics`

---

### T198: Rota interna de admin no glucose-service

**What**: `GET /internal/admin/stats` com `requireInternalRole('ADMINISTRATOR')`.
**Where**: `backend/services/glucose-service/src/modules/admin/admin.routes.ts`
**Depends on**: T197
**Reuses**: Rotas internas
**Requirement**: ADM-03, ADM-05

**Done when**:

- [ ] Supertest: admin `200` só com contagens; outro papel `403`
- [ ] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [ ] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(glucose-service): expose internal admin statistics`

---

### T199: Clientes de admin no gateway

**What**: `AuthClient.adminStats`, `AuthClient.adminUsers` e `GlucoseClient.adminStats` com identidade de administrador.
**Where**: `backend/services/gateway/src/clients/`
**Depends on**: T198
**Reuses**: `InternalHttpClient`
**Requirement**: ADM-01, ADM-04

**Done when**:

- [ ] Teste com stub: identidade com papel `ADMINISTRATOR` no token interno; parâmetros repassados
- [ ] Gate `quick` passa: `cd backend && npx vitest run services/gateway/tests/clients/admin.test.ts`
- [ ] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(gateway): add admin calls to the service clients`

---

### T200: Composição da visão do admin

**What**: `GET /api/v1/admin/overview` e `GET /api/v1/admin/users` com `requireRole('ADMINISTRATOR')`.
**Where**: `backend/services/gateway/src/modules/admin/admin.controller.ts`
**Depends on**: T199
**Reuses**: `me.controller.ts`
**Requirement**: ADM-01, ADM-04, ADM-05, ADM-07

**Done when**:

- [ ] Supertest: admin recebe o JSON combinado; paciente e profissional `403 FORBIDDEN_ROLE`; `days` 7/30/90 repassado; falha de um serviço responde `503`
- [ ] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [ ] Pelo menos 5 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `feat(gateway): compose the admin overview`

---

#### Phase 28: Web: dados e KPIs do administrador

### T201: Entidades e ports do admin

**What**: Tipos `AdminOverview`, `AccountRow` e port `AdminRepository`.
**Where**: `web/src/features/admin/domain/overview.ts`
**Depends on**: T200
**Reuses**: Contratos do design
**Requirement**: ARQ-05

**Done when**:

- [ ] Só tipos; `npm run typecheck` passa
- [ ] Gate `build` passa: `cd web && npm run typecheck && npm run lint && npm run lint:arch && npm run test:coverage && npm run dup && npm run build && npm run size`

**Tests**: none
**Gate**: build
**Commit**: `feat(web): declare admin entities`

---

### T202: Repositório do admin (HTTP)

**What**: `HttpAdminRepository` para `GET /admin/overview` e `GET /admin/users`.
**Where**: `web/src/features/admin/infrastructure/httpAdminRepository.ts`
**Depends on**: T201
**Reuses**: `createRepository`
**Requirement**: ADM-01, ADM-04, ARQ-06

**Done when**:

- [ ] MSW: os dois recursos viram entidades; `403` vira `forbidden`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/infrastructure/httpAdminRepository.test.ts`
- [ ] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: quick
**Commit**: `feat(web): add the HTTP admin repository`

---

### T203: Casos de uso do admin

**What**: `loadOverview(days)` (7, 30 ou 90) e `loadUsers(filtros)`.
**Where**: `web/src/features/admin/application/adminUseCases.ts`
**Depends on**: T202
**Reuses**: Port do admin
**Requirement**: ADM-04, ADM-07

**Done when**:

- [ ] Teste: período fora de 7/30/90 rejeitado; filtros repassados
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/application/adminUseCases.test.ts`
- [ ] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add admin use cases`

---

### T204: Hooks do admin

**What**: `useOverview(days)` compartilhado entre widgets e `useUsers(filtros)`.
**Where**: `web/src/features/admin/presentation/useOverview.ts`
**Depends on**: T203
**Reuses**: `queryClient`
**Requirement**: ADM-07

**Done when**:

- [ ] MSW: vários widgets fazem uma requisição de overview; trocar o período refaz a consulta
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/useOverview.test.ts`
- [ ] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add admin query hooks`

---

### T205: Filtro de período do admin

**What**: Chips 7, 30 e 90 dias.
**Where**: `web/src/features/admin/presentation/adminPeriodFilter.tsx`
**Depends on**: T204
**Reuses**: `periodFilter`
**Requirement**: ADM-07, RSP-04

**Done when**:

- [ ] Teste: cada chip troca o período; axe sem violações
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/adminPeriodFilter.test.tsx`
- [ ] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the admin period filter`

---

### T206: KPI de contas

**What**: Widget `adm-kpi-accounts`: o total de contas com a divisão por status.
**Where**: `web/src/features/admin/presentation/widgets/admKpiAccounts.tsx`
**Depends on**: T205
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: ADM-01

**Done when**:

- [ ] Exporta `WidgetDefinition` com id `adm-kpi-accounts`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [ ] Renderiza o total de contas com a divisão por status a partir de `overview.accounts`
- [ ] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/widgets/admKpiAccounts.test.tsx`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add adm-kpi-accounts widget`

---

### T207: KPI de cadastros

**What**: Widget `adm-kpi-registrations`: os cadastros no período.
**Where**: `web/src/features/admin/presentation/widgets/admKpiRegistrations.tsx`
**Depends on**: T206
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: ADM-01

**Done when**:

- [ ] Exporta `WidgetDefinition` com id `adm-kpi-registrations`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [ ] Renderiza os cadastros no período a partir de `overview.registrationsInPeriod`
- [ ] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/widgets/admKpiRegistrations.test.tsx`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add adm-kpi-registrations widget`

---

### T208: KPI de pacientes ativos

**What**: Widget `adm-kpi-active-patients`: pacientes ativos em 24 h e em 7 dias.
**Where**: `web/src/features/admin/presentation/widgets/admKpiActivePatients.tsx`
**Depends on**: T207
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: ADM-01

**Done when**:

- [ ] Exporta `WidgetDefinition` com id `adm-kpi-active-patients`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [ ] Renderiza pacientes ativos em 24 h e em 7 dias a partir de `overview.activePatients`
- [ ] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/widgets/admKpiActivePatients.test.tsx`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add adm-kpi-active-patients widget`

---

### T209: KPI de vínculos ativos

**What**: Widget `adm-kpi-grants`: os vínculos ativos.
**Where**: `web/src/features/admin/presentation/widgets/admKpiGrants.tsx`
**Depends on**: T208
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: ADM-01

**Done when**:

- [ ] Exporta `WidgetDefinition` com id `adm-kpi-grants`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [ ] Renderiza os vínculos ativos a partir de `overview.grants.active`
- [ ] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/widgets/admKpiGrants.test.tsx`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add adm-kpi-grants widget`

---

#### Phase 29: Web: gráficos e página do administrador

### T210: Contas por papel

**What**: Widget `adm-users-role`: a rosca de contas por papel.
**Where**: `web/src/features/admin/presentation/widgets/admUsersRole.tsx`
**Depends on**: T209
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: ADM-02

**Done when**:

- [ ] Exporta `WidgetDefinition` com id `adm-users-role`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [ ] Renderiza a rosca de contas por papel a partir de `overview.accounts.byRole`
- [ ] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [ ] Usa o adaptador `DonutChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/widgets/admUsersRole.test.tsx`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add adm-users-role widget`

---

### T211: Cadastros por dia

**What**: Widget `adm-registrations`: a linha de cadastros por dia.
**Where**: `web/src/features/admin/presentation/widgets/admRegistrations.tsx`
**Depends on**: T210
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: ADM-02

**Done when**:

- [ ] Exporta `WidgetDefinition` com id `adm-registrations`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [ ] Renderiza a linha de cadastros por dia a partir de `overview.registrationsByDay`
- [ ] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [ ] Usa o adaptador `LineBandChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/widgets/admRegistrations.test.tsx`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add adm-registrations widget`

---

### T212: Cadastrados × ativos

**What**: Widget `adm-active-patients`: barras de pacientes cadastrados e ativos.
**Where**: `web/src/features/admin/presentation/widgets/admActivePatients.tsx`
**Depends on**: T211
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: ADM-02

**Done when**:

- [ ] Exporta `WidgetDefinition` com id `adm-active-patients`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [ ] Renderiza barras de pacientes cadastrados e ativos a partir de `overview.activePatients`
- [ ] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [ ] Usa o adaptador `BarChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/widgets/admActivePatients.test.tsx`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add adm-active-patients widget`

---

### T213: Leituras por dia

**What**: Widget `adm-readings-volume`: a área de leituras ingeridas por dia.
**Where**: `web/src/features/admin/presentation/widgets/admReadingsVolume.tsx`
**Depends on**: T212
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: ADM-02

**Done when**:

- [ ] Exporta `WidgetDefinition` com id `adm-readings-volume`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [ ] Renderiza a área de leituras ingeridas por dia a partir de `overview.readingsByDay`
- [ ] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [ ] Usa o adaptador `LineBandChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/widgets/admReadingsVolume.test.tsx`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add adm-readings-volume widget`

---

### T214: Vínculos por semana

**What**: Widget `adm-grants`: a linha de vínculos criados por semana.
**Where**: `web/src/features/admin/presentation/widgets/admGrants.tsx`
**Depends on**: T213
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: ADM-02

**Done when**:

- [ ] Exporta `WidgetDefinition` com id `adm-grants`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [ ] Renderiza a linha de vínculos criados por semana a partir de `overview.grants.createdByWeek`
- [ ] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [ ] Usa o adaptador `LineBandChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/widgets/admGrants.test.tsx`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add adm-grants widget`

---

### T215: Alertas da plataforma

**What**: Widget `adm-alerts`: barras de alertas por tipo.
**Where**: `web/src/features/admin/presentation/widgets/admAlerts.tsx`
**Depends on**: T214
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: ADM-02

**Done when**:

- [ ] Exporta `WidgetDefinition` com id `adm-alerts`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [ ] Renderiza barras de alertas por tipo a partir de `overview.alertsByType`
- [ ] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [ ] Usa o adaptador `BarChart` (nunca importa `recharts`) e oferece "Ver como tabela" pelo `ChartFrame`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/widgets/admAlerts.test.tsx`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add adm-alerts widget`

---

### T216: Tabela de contas

**What**: Widget `adm-users-table`: a tabela paginada de contas com filtro de papel e status e busca.
**Where**: `web/src/features/admin/presentation/widgets/admUsersTable.tsx`
**Depends on**: T215
**Reuses**: `WidgetShell`, `ChartFrame`, adaptadores de gráfico, `useSummary`
**Requirement**: ADM-04, RSP-03

**Done when**:

- [ ] Exporta `WidgetDefinition` com id `adm-users-table`, papéis e tamanhos iguais aos de `contracts/widget-catalog.json`
- [ ] Renderiza a tabela paginada de contas com filtro de papel e status e busca a partir de `useUsers`
- [ ] Teste cobre dados normais, estado vazio com a causa e erro isolado no `WidgetShell`
- [ ] Página de 25; nenhum dado clínico na tabela
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/widgets/admUsersTable.test.tsx`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add adm-users-table widget`

---

### T217: Catálogo de widgets do admin

**What**: Registra os 11 widgets do admin, uma linha por widget.
**Where**: `web/src/features/admin/presentation/widgetCatalog.ts`
**Depends on**: T216
**Reuses**: `widgetRegistry`
**Requirement**: LAY-01, ARQ-10

**Done when**:

- [ ] Teste: ids iguais aos do papel `ADMINISTRATOR` em `contracts/widget-catalog.json`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/widgetCatalog.test.ts`
- [ ] Pelo menos 1 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): register the admin widgets`

---

### T218: Página do admin

**What**: `/admin` com casca, filtro de período, barra de personalização e grade.
**Where**: `web/src/features/admin/presentation/adminDashboardPage.tsx`
**Depends on**: T217
**Reuses**: Página do profissional
**Requirement**: ADM-01, ADM-07, LAY-03

**Done when**:

- [ ] MSW: abre com 30 dias; trocar para 90 recarrega todos os widgets; personalizar e salvar funciona
- [ ] Gate `quick` passa: `cd web && npx vitest run src/features/admin/presentation/adminDashboardPage.test.tsx`
- [ ] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): add the admin dashboard page`

---

### T219: Rota do admin

**What**: `/admin` com guarda de papel.
**Where**: `web/src/app/routes.tsx`
**Depends on**: T218
**Reuses**: `RequireRole`
**Requirement**: ACC-02, ACC-03

**Done when**:

- [ ] Teste: admin entra em `/admin`; profissional em `/admin` volta a `/profissional`
- [ ] Gate `quick` passa: `cd web && npx vitest run src/app/routes.test.tsx`
- [ ] Pelo menos 2 testes novos passam e a contagem total da suíte não cai

**Tests**: component
**Gate**: quick
**Commit**: `feat(web): route the admin area`

---

#### Phase 30: Documentação de arquitetura e fechamento

### T220: Documento de arquitetura da web

**What**: `docs/architecture/web-dashboard.md` com diagrama de camadas, padrões (arquivo:linha, problema, princípio, alternativa), as cinco letras do SOLID, as ADRs e o log das duas refatorações.
**Where**: `docs/architecture/web-dashboard.md`
**Depends on**: T219
**Reuses**: Design da feature, AD-013
**Requirement**: ARQ-09, ARQ-14, ARQ-18, ARQ-19

**Done when**:

- [ ] Seis ADRs: camadas, estado de servidor, biblioteca de gráficos, estilos e tema, armazenamento do token, arrastar e soltar
- [ ] Refatorações com motivo, o que mudou e o hash do commit `refactor:`
- [ ] Gate `build` passa: `cd web && npm run test:coverage && cd ../backend && npm run build`

**Tests**: none
**Gate**: build
**Commit**: `docs(web): document the dashboard architecture`

---

### T221: Teste da evidência de arquitetura

**What**: Teste que lê o documento e falha com referência quebrada ou seção faltando.
**Where**: `web/tests/docs/architectureDoc.test.ts`
**Depends on**: T220
**Reuses**: `git log` via `child_process`
**Requirement**: ARQ-09, ARQ-14, ARQ-18, ARQ-19

**Done when**:

- [ ] Cada `arquivo:linha` existe e a linha está dentro do arquivo; há 4 padrões, as 5 letras do SOLID e 6 ADRs; os hashes de refatoração existem no `git log` com prefixo `refactor`
- [ ] Gate `quick` passa: `cd web && npx vitest run tests/docs/architectureDoc.test.ts`
- [ ] Pelo menos 4 testes novos passam e a contagem total da suíte não cai

**Tests**: unit
**Gate**: quick
**Commit**: `test(web): verify the architecture document`

---

### T222: Configuração do Lighthouse

**What**: `lighthouserc.json` e script de login para medir acessibilidade na tela de login e no dashboard do paciente.
**Where**: `web/lighthouserc.json`
**Depends on**: T221
**Reuses**: —
**Requirement**: RSP-11

**Done when**:

- [ ] `npx lhci autorun` documentado em `web/README.md`; meta de acessibilidade ≥ 90 nas duas URLs (medida na validação)
- [ ] Gate `build` passa: `cd web && npm run typecheck && npm run lint && npm run lint:arch && npm run test:coverage && npm run dup && npm run build && npm run size`

**Tests**: none
**Gate**: build
**Commit**: `chore(web): configure Lighthouse CI`

---

### T223: Documentação da API

**What**: `backend/README.md` e `docs/architecture/backend.md` com as rotas novas, campos do summary, códigos de erro novos e as tabelas que saíram do roadmap.
**Where**: `backend/README.md`
**Depends on**: T222
**Reuses**: Seções atuais de rotas
**Requirement**: API-08, DEP-07

**Done when**:

- [ ] Rotas `/preferences`, `/sharing`, `/professional`, `/admin`, `/auth/register/professional` e internas descritas com exemplo
- [ ] Códigos `INVALID_LAYOUT`, `INVALID_TIMEZONE`, `INVALID_INVITE`, `NO_ACTIVE_GRANT` listados
- [ ] Nenhuma frase "sem rota nesta release" sobra para `HealthProfessional` e `DashboardAccessGrant`
- [ ] Gate `build` passa: `cd web && npm run test:coverage && cd ../backend && npm run build`

**Tests**: none
**Gate**: build
**Commit**: `docs(backend): document the dashboard routes`

---

### T224: Documentação do repositório

**What**: `CLAUDE.md` (camada web, comandos), `docs/README.md` (índice) e `CHANGELOG.md` (entrada da versão).
**Where**: `CLAUDE.md`
**Depends on**: T223
**Reuses**: Seções atuais
**Requirement**: DEP-01, ARQ-18

**Done when**:

- [ ] Comandos da web listados; mapa de camadas cita `web/`; cada arquivo citado existe
- [ ] Gate `build` passa: `cd web && npm run test:coverage && cd ../backend && npm run build`

**Tests**: none
**Gate**: build
**Commit**: `docs: describe the web dashboard in the repository docs`

---

## Tarefas adicionadas durante a execução

Achados da execução que viraram tarefa. Cada uma depende só de tarefas já concluídas e pode rodar fora da ordem das fases.

### T225: Expor Retry-After e X-Degraded no CORS do gateway

**What**: O CORS do gateway passa a expor os cabeçalhos `Retry-After` e `X-Degraded` ao navegador (`exposedHeaders`), para a web ler a espera do `429` e a marca de resposta degradada.
**Where**: `backend/services/gateway/src/app.ts`
**Depends on**: T9
**Reuses**: `cors({ origin })` já montado no gateway; teste de preflight da T9
**Requirement**: ACC-08, PRO-15, DEP-07

**Done when**:

- [x] Teste de integração: uma resposta cross-origin de origem listada traz `Access-Control-Expose-Headers` contendo `Retry-After` e `X-Degraded` (também com `CORS_ORIGIN` vazio, modo permissivo)
- [x] Origem não listada continua sem `Access-Control-Allow-Origin`
- [x] Gate `full` passa: `cd backend && npm run build && npm run test:coverage`
- [x] Pelo menos 3 testes novos passam e a contagem total da suíte não cai

**Tests**: integration
**Gate**: full
**Commit**: `fix(gateway): expose Retry-After and X-Degraded through CORS`
**Status**: ✅ Done

---

### T226: Estabilizar os testes de apresentação sob carga

**What**: Subir o timeout padrão das consultas assíncronas do Testing Library (`asyncUtilTimeout`) no setup da web, para os testes que falharam uma vez sob carga (`loginPage` "expiry notice once" e `openClosed` "page drawing the fake widget") deixarem de ser instáveis, sem tocar em nenhuma asserção.
**Where**: `web/src/test/setup.ts`
**Depends on**: T127
**Reuses**: `configure` do `@testing-library/react`; `testTimeout` de 15 s do projeto `dom`
**Requirement**: ARQ-13

**Done when**:

- [x] `asyncUtilTimeout` configurado (valor justificado em comentário, abaixo do `testTimeout`) e nenhum teste alterado
- [x] Os dois testes citados passam 5 vezes seguidas e dentro de `npm run test:coverage` completo
- [x] Gate `full` passa: `cd web && npm run typecheck && npm run lint && npm run lint:arch && npm run test:coverage`
- [x] A contagem total da suíte não cai

**Tests**: component
**Gate**: full
**Commit**: `test(web): raise the async query timeout for loaded machines`
**Status**: ✅ Done

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9 → Phase 10 → Phase 11 → Phase 12 → Phase 13 → Phase 14 → Phase 15 → Phase 16 → Phase 17 → Phase 18 → Phase 19 → Phase 20 → Phase 21 → Phase 22 → Phase 23 → Phase 24 → Phase 25 → Phase 26 → Phase 27 → Phase 28 → Phase 29 → Phase 30

Phase 1: T1..T9 (9)
Phase 2: T10..T19 (10)
Phase 3: T20..T27 (8)
Phase 4: T28..T35 (8)
Phase 5: T36..T45 (10)
Phase 6: T46..T54 (9)
Phase 7: T55..T64 (10)
Phase 8: T65..T72 (8)
Phase 9: T73..T78 (6)
Phase 10: T79..T87 (9)
Phase 11: T88..T94 (7)
Phase 12: T95..T103 (9)
Phase 13: T104..T112 (9)
Phase 14: T113..T120 (8)
Phase 15: T121..T125 (5)
Phase 16: T126..T127 (2)
Phase 17: T128..T132 (5)
Phase 18: T133..T139 (7)
Phase 19: T140..T145 (6)
Phase 20: T146..T151 (6)
Phase 21: T152..T159 (8)
Phase 22: T160..T166 (7)
Phase 23: T167..T170 (4)
Phase 24: T171..T177 (7)
Phase 25: T178..T187 (10)
Phase 26: T188..T192 (5)
Phase 27: T193..T200 (8)
Phase 28: T201..T209 (9)
Phase 29: T210..T219 (10)
Phase 30: T220..T224 (5)
```

Execution is strictly sequential - there is no intra-phase parallelism. A single agent (or batch worker) works one task at a time, in order.

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Criar o contrato do catálogo de widgets | 1 arquivo | ✅ Granular |
| T2: Expor o catálogo no pacote compartilhado do backend | 1 arquivo | ✅ Granular |
| T3: Criar a tabela DashboardLayout no auth-service | 1 arquivo | ✅ Granular |
| T4: Validar o corpo do layout (INVALID_LAYOUT) | 1 arquivo | ✅ Granular |
| T5: Repositório do layout | 1 arquivo | ✅ Granular |
| T6: Serviço de preferências | 1 arquivo | ✅ Granular |
| T7: Rotas /preferences/dashboard no auth-service | 1 diretório de módulo coeso | ✅ Granular |
| T8: Encaminhar /api/v1/preferences ao auth-service | 1 arquivo | ✅ Granular |
| T9: Teste de preflight CORS para a origem da web | 1 arquivo | ✅ Granular |
| T10: Criar o projeto web (Vite + React + TypeScript estrito) | 1 diretório de módulo coeso | ✅ Granular |
| T11: ESLint com limites de legibilidade | 1 arquivo | ✅ Granular |
| T12: dependency-cruiser: regra de camadas | 1 arquivo | ✅ Granular |
| T13: dependency-cruiser: bibliotecas isoladas, features e ciclos | 1 arquivo | ✅ Granular |
| T14: Limite de duplicação com jscpd | 1 arquivo | ✅ Granular |
| T15: Configurar Vitest, Testing Library, MSW e axe | 1 arquivo | ✅ Granular |
| T16: Job web no CI | 1 arquivo | ✅ Granular |
| T17: AppError do domínio | 1 arquivo | ✅ Granular |
| T18: Papel e rota inicial | 1 arquivo | ✅ Granular |
| T19: Spike: @dnd-kit com React 19 | 1 arquivo | ✅ Granular |
| T20: Ports compartilhados do domínio | 1 arquivo | ✅ Granular |
| T21: Barramento de expiração de sessão (Observer) | 1 arquivo | ✅ Granular |
| T22: Armazenamento do token | 1 arquivo | ✅ Granular |
| T23: Mapeamento de respostas HTTP em AppError | 1 arquivo | ✅ Granular |
| T24: Cliente HTTP (Adapter sobre fetch) | 1 arquivo | ✅ Granular |
| T25: Leitor do exp do JWT | 1 arquivo | ✅ Granular |
| T26: Fuso do navegador e relógio | 1 arquivo | ✅ Granular |
| T27: Validação de DTO na borda | 1 arquivo | ✅ Granular |
| T28: Domínio da autenticação | 1 diretório de módulo coeso | ✅ Granular |
| T29: Caso de uso: entrar | 1 arquivo | ✅ Granular |
| T30: Caso de uso: restaurar sessão | 1 arquivo | ✅ Granular |
| T31: Caso de uso: sair | 1 arquivo | ✅ Granular |
| T32: Caso de uso: renovar sessão | 1 arquivo | ✅ Granular |
| T33: Repositório de sessão (HTTP) | 1 arquivo | ✅ Granular |
| T34: Repositório de conta (HTTP) | 1 arquivo | ✅ Granular |
| T35: Composition root | 1 arquivo | ✅ Granular |
| T36: Tokens de tema e contraste | 1 arquivo | ✅ Granular |
| T37: Formatação pt-BR | 1 arquivo | ✅ Granular |
| T38: Tema claro, escuro e sistema | 1 arquivo | ✅ Granular |
| T39: Estados de carregamento, vazio, erro e acesso negado | 1 arquivo | ✅ Granular |
| T40: Política de consultas e retentativas | 1 arquivo | ✅ Granular |
| T41: AuthProvider | 1 arquivo | ✅ Granular |
| T42: Guarda de rota por papel | 1 arquivo | ✅ Granular |
| T43: Tela de login | 1 arquivo | ✅ Granular |
| T44: Renovação com atividade | 1 arquivo | ✅ Granular |
| T45: Casca da aplicação | 1 arquivo | ✅ Granular |
| T46: Domínio do layout | 1 arquivo | ✅ Granular |
| T47: Normalizar layout salvo | 1 arquivo | ✅ Granular |
| T48: Layout padrão por papel (Strategy) | 1 diretório de módulo coeso | ✅ Granular |
| T49: Registro de widgets (Registry + Factory) | 1 arquivo | ✅ Granular |
| T50: Repositório do layout (HTTP) | 1 arquivo | ✅ Granular |
| T51: Casos de uso do layout | 1 arquivo | ✅ Granular |
| T52: Grade responsiva | 1 arquivo | ✅ Granular |
| T53: Invólucro de widget | 1 arquivo | ✅ Granular |
| T54: Hook de layout | 1 arquivo | ✅ Granular |
| T55: Paleta de séries | 1 arquivo | ✅ Granular |
| T56: ChartFrame | 1 arquivo | ✅ Granular |
| T57: Adaptador de linha com banda | 1 arquivo | ✅ Granular |
| T58: Adaptador de barras | 1 arquivo | ✅ Granular |
| T59: Adaptador de barras empilhadas | 1 arquivo | ✅ Granular |
| T60: Adaptador de rosca | 1 arquivo | ✅ Granular |
| T61: Adaptador de faixas de percentil (AGP) | 1 arquivo | ✅ Granular |
| T62: Adaptador de dispersão com quadrantes | 1 arquivo | ✅ Granular |
| T63: Heatmap em SVG próprio | 1 arquivo | ✅ Granular |
| T64: Redesenho por tamanho do contêiner | 1 arquivo | ✅ Granular |
| T65: Aceitar tz em /dashboard/summary | 1 arquivo | ✅ Granular |
| T66: Validar o fuso contra o banco | 1 arquivo | ✅ Granular |
| T67: Limites do período no fuso | 1 arquivo | ✅ Granular |
| T68: Distribuição em 5 zonas | 1 arquivo | ✅ Granular |
| T69: Uso do sensor | 1 arquivo | ✅ Granular |
| T70: AGP por hora local | 1 arquivo | ✅ Granular |
| T71: Heatmap dia da semana × hora | 1 arquivo | ✅ Granular |
| T72: Última leitura do paciente | 1 arquivo | ✅ Granular |
| T73: byDay no fuso com carboidrato e insulina | 1 arquivo | ✅ Granular |
| T74: Serviço do summary reutilizável | 1 arquivo | ✅ Granular |
| T75: Testes de rota do summary estendido | 1 arquivo | ✅ Granular |
| T76: Contrato do GMI no backend | 1 arquivo | ✅ Granular |
| T77: GMI no domínio do app | 1 arquivo | ✅ Granular |
| T78: Relatório do app usa o GMI único | 1 arquivo | ✅ Granular |
| T79: Zonas de glicose no domínio | 1 arquivo | ✅ Granular |
| T80: Período e validação | 1 arquivo | ✅ Granular |
| T81: Frescor dos dados | 1 arquivo | ✅ Granular |
| T82: Média ponderada e dados suficientes | 1 arquivo | ✅ Granular |
| T83: Entidades do summary e port | 1 arquivo | ✅ Granular |
| T84: Repositório do summary (HTTP) | 1 arquivo | ✅ Granular |
| T85: Caso de uso: carregar summary | 1 arquivo | ✅ Granular |
| T86: Hook useSummary compartilhado | 1 arquivo | ✅ Granular |
| T87: Filtro de período | 1 arquivo | ✅ Granular |
| T88: Cartão de KPI | 1 arquivo | ✅ Granular |
| T89: Widget de tempo no alvo | 1 arquivo | ✅ Granular |
| T90: Widget de GMI | 1 arquivo | ✅ Granular |
| T91: Widget de glicose média | 1 arquivo | ✅ Granular |
| T92: Widget de variabilidade (CV) | 1 arquivo | ✅ Granular |
| T93: Widget de uso do sensor | 1 arquivo | ✅ Granular |
| T94: Widget de frescor dos dados | 1 arquivo | ✅ Granular |
| T95: Widget de tendência | 1 arquivo | ✅ Granular |
| T96: Widget de % no alvo por dia | 1 arquivo | ✅ Granular |
| T97: Widget de zonas | 1 arquivo | ✅ Granular |
| T98: Widget de AGP | 1 arquivo | ✅ Granular |
| T99: Widget de heatmap | 1 arquivo | ✅ Granular |
| T100: Widget de episódios de hipo e hiper | 1 arquivo | ✅ Granular |
| T101: Widget de insulina por tipo | 1 arquivo | ✅ Granular |
| T102: Widget de alertas por tipo | 1 arquivo | ✅ Granular |
| T103: Widget de carboidrato e insulina por dia | 1 arquivo | ✅ Granular |
| T104: Entidades do diário e port | 1 arquivo | ✅ Granular |
| T105: Repositório do diário (HTTP) | 1 arquivo | ✅ Granular |
| T106: Caso de uso: dia detalhado | 1 arquivo | ✅ Granular |
| T107: Widget de dia detalhado | 1 arquivo | ✅ Granular |
| T108: Catálogo de widgets do paciente | 1 arquivo | ✅ Granular |
| T109: Página do dashboard do paciente | 1 arquivo | ✅ Granular |
| T110: Garantia de somente leitura dos dados clínicos | 1 arquivo | ✅ Granular |
| T111: Rotas e providers da aplicação | 1 arquivo | ✅ Granular |
| T112: Varredura de acessibilidade das páginas | 1 arquivo | ✅ Granular |
| T113: Estado do editor | 1 arquivo | ✅ Granular |
| T114: Adicionar e remover widgets | 1 arquivo | ✅ Granular |
| T115: Reordenar arrastando | 1 arquivo | ✅ Granular |
| T116: Mover por teclado | 1 arquivo | ✅ Granular |
| T117: Redimensionar | 1 arquivo | ✅ Granular |
| T118: Barra de personalização | 1 arquivo | ✅ Granular |
| T119: Personalização integrada à página | 1 arquivo | ✅ Granular |
| T120: Prova de aberto/fechado dos widgets | 1 arquivo | ✅ Granular |
| T121: Configuração da Vercel | 1 arquivo | ✅ Granular |
| T122: Rotas e gráficos sob demanda | 1 arquivo | ✅ Granular |
| T123: Orçamento de 250 kB | 1 arquivo | ✅ Granular |
| T124: CORS de produção com a origem da web | 1 arquivo | ✅ Granular |
| T125: Guia de publicação da web | 1 arquivo | ✅ Granular |
| T126: Refatorar o código repetido dos repositórios HTTP | 1 arquivo | ✅ Granular |
| T127: Refatorar a montagem dos widgets de summary | 1 arquivo | ✅ Granular |
| T128: Criar conta com papel informado pelo serviço | 1 arquivo | ✅ Granular |
| T129: Serviço: cadastrar profissional | 1 arquivo | ✅ Granular |
| T130: Rota interna de cadastro do profissional | 1 arquivo | ✅ Granular |
| T131: Validar o perfil profissional | 1 arquivo | ✅ Granular |
| T132: Módulo interno de profissionais | 1 diretório de módulo coeso | ✅ Granular |
| T133: Cliente do auth: cadastro profissional | 1 arquivo | ✅ Granular |
| T134: Cliente do glucose: perfil profissional | 1 arquivo | ✅ Granular |
| T135: Saga do cadastro profissional | 1 arquivo | ✅ Granular |
| T136: Rota pública de cadastro profissional | 1 arquivo | ✅ Granular |
| T137: /me por papel | 1 arquivo | ✅ Granular |
| T138: Excluir conta por papel | 1 arquivo | ✅ Granular |
| T139: Seed do administrador | 1 arquivo | ✅ Granular |
| T140: Tabelas do consentimento | 1 arquivo | ✅ Granular |
| T141: Código de convite | 1 arquivo | ✅ Granular |
| T142: Repositório do consentimento | 1 arquivo | ✅ Granular |
| T143: Serviço do consentimento | 1 arquivo | ✅ Granular |
| T144: Política de vínculo ativo | 1 arquivo | ✅ Granular |
| T145: Rotas /sharing | 1 diretório de módulo coeso | ✅ Granular |
| T146: Lookup de nomes no auth-service | 1 arquivo | ✅ Granular |
| T147: Cliente do auth: lookup | 1 arquivo | ✅ Granular |
| T148: Limitador de resgate por usuário | 1 arquivo | ✅ Granular |
| T149: Proxies de sharing e professional | 1 arquivo | ✅ Granular |
| T150: Vínculos do paciente com nomes | 1 arquivo | ✅ Granular |
| T151: Exclusão remove convites e vínculos | 1 arquivo | ✅ Granular |
| T152: Domínio do compartilhamento | 1 diretório de módulo coeso | ✅ Granular |
| T153: Fonte remota do compartilhamento | 1 arquivo | ✅ Granular |
| T154: Repositório do compartilhamento | 1 arquivo | ✅ Granular |
| T155: Cubit do compartilhamento | 1 arquivo | ✅ Granular |
| T156: Textos do compartilhamento | 1 arquivo | ✅ Granular |
| T157: Tela de compartilhamento | 1 arquivo | ✅ Granular |
| T158: Registrar o compartilhamento no DI | 1 arquivo | ✅ Granular |
| T159: Entrada nas configurações | 1 arquivo | ✅ Granular |
| T160: Métricas por paciente da carteira | 1 arquivo | ✅ Granular |
| T161: Pacientes vinculados paginados | 1 arquivo | ✅ Granular |
| T162: Hipos da carteira por hora | 1 arquivo | ✅ Granular |
| T163: Serviço da carteira | 1 arquivo | ✅ Granular |
| T164: Rotas /professional | 1 diretório de módulo coeso | ✅ Granular |
| T165: Carteira com nomes no gateway | 1 arquivo | ✅ Granular |
| T166: Resumo da carteira com nomes no gateway | 1 arquivo | ✅ Granular |
| T167: Política de senha na web | 1 arquivo | ✅ Granular |
| T168: Caso de uso: cadastrar profissional | 1 arquivo | ✅ Granular |
| T169: Repositório do cadastro (HTTP) | 1 arquivo | ✅ Granular |
| T170: Tela de cadastro do profissional | 1 arquivo | ✅ Granular |
| T171: Regra de risco | 1 arquivo | ✅ Granular |
| T172: Filtro, busca e ordenação da carteira | 1 arquivo | ✅ Granular |
| T173: Entidades e ports do profissional | 1 arquivo | ✅ Granular |
| T174: Repositório do profissional (HTTP) | 1 arquivo | ✅ Granular |
| T175: Repositório do resgate (HTTP) | 1 arquivo | ✅ Granular |
| T176: Casos de uso do profissional | 1 arquivo | ✅ Granular |
| T177: Hooks da carteira | 1 arquivo | ✅ Granular |
| T178: Widget de resgate de código | 1 arquivo | ✅ Granular |
| T179: KPI de pacientes vinculados | 1 arquivo | ✅ Granular |
| T180: KPI de TIR médio | 1 arquivo | ✅ Granular |
| T181: KPI de GMI médio | 1 arquivo | ✅ Granular |
| T182: KPI de pacientes com hipo | 1 arquivo | ✅ Granular |
| T183: KPI de pacientes sem dado recente | 1 arquivo | ✅ Granular |
| T184: Tabela da carteira | 1 arquivo | ✅ Granular |
| T185: Zonas por paciente | 1 arquivo | ✅ Granular |
| T186: Dispersão TIR × CV | 1 arquivo | ✅ Granular |
| T187: Histograma de TIR | 1 arquivo | ✅ Granular |
| T188: Hipos por hora | 1 arquivo | ✅ Granular |
| T189: Catálogo de widgets do profissional | 1 arquivo | ✅ Granular |
| T190: Página da carteira | 1 arquivo | ✅ Granular |
| T191: Detalhe do paciente vinculado | 1 arquivo | ✅ Granular |
| T192: Rotas do profissional e do cadastro | 1 arquivo | ✅ Granular |
| T193: Papel nas rotas internas | 1 arquivo | ✅ Granular |
| T194: Estatísticas de contas | 1 arquivo | ✅ Granular |
| T195: Lista de contas | 1 arquivo | ✅ Granular |
| T196: Rotas internas de admin no auth-service | 1 arquivo | ✅ Granular |
| T197: Estatísticas clínicas agregadas | 1 arquivo | ✅ Granular |
| T198: Rota interna de admin no glucose-service | 1 arquivo | ✅ Granular |
| T199: Clientes de admin no gateway | 1 diretório de módulo coeso | ✅ Granular |
| T200: Composição da visão do admin | 1 arquivo | ✅ Granular |
| T201: Entidades e ports do admin | 1 arquivo | ✅ Granular |
| T202: Repositório do admin (HTTP) | 1 arquivo | ✅ Granular |
| T203: Casos de uso do admin | 1 arquivo | ✅ Granular |
| T204: Hooks do admin | 1 arquivo | ✅ Granular |
| T205: Filtro de período do admin | 1 arquivo | ✅ Granular |
| T206: KPI de contas | 1 arquivo | ✅ Granular |
| T207: KPI de cadastros | 1 arquivo | ✅ Granular |
| T208: KPI de pacientes ativos | 1 arquivo | ✅ Granular |
| T209: KPI de vínculos ativos | 1 arquivo | ✅ Granular |
| T210: Contas por papel | 1 arquivo | ✅ Granular |
| T211: Cadastros por dia | 1 arquivo | ✅ Granular |
| T212: Cadastrados × ativos | 1 arquivo | ✅ Granular |
| T213: Leituras por dia | 1 arquivo | ✅ Granular |
| T214: Vínculos por semana | 1 arquivo | ✅ Granular |
| T215: Alertas da plataforma | 1 arquivo | ✅ Granular |
| T216: Tabela de contas | 1 arquivo | ✅ Granular |
| T217: Catálogo de widgets do admin | 1 arquivo | ✅ Granular |
| T218: Página do admin | 1 arquivo | ✅ Granular |
| T219: Rota do admin | 1 arquivo | ✅ Granular |
| T220: Documento de arquitetura da web | 1 arquivo | ✅ Granular |
| T221: Teste da evidência de arquitetura | 1 arquivo | ✅ Granular |
| T222: Configuração do Lighthouse | 1 arquivo | ✅ Granular |
| T223: Documentação da API | 1 arquivo | ✅ Granular |
| T224: Documentação do repositório | 1 arquivo | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | None | ✅ Match |
| T2 | T1 | T1 | ✅ Match |
| T3 | T2 | T2 | ✅ Match |
| T4 | T3 | T3 | ✅ Match |
| T5 | T4 | T4 | ✅ Match |
| T6 | T5 | T5 | ✅ Match |
| T7 | T6 | T6 | ✅ Match |
| T8 | T7 | T7 | ✅ Match |
| T9 | T8 | T8 | ✅ Match |
| T10 | T9 | início da fase | ✅ Match |
| T11 | T10 | T10 | ✅ Match |
| T12 | T11 | T11 | ✅ Match |
| T13 | T12 | T12 | ✅ Match |
| T14 | T13 | T13 | ✅ Match |
| T15 | T14 | T14 | ✅ Match |
| T16 | T15 | T15 | ✅ Match |
| T17 | T16 | T16 | ✅ Match |
| T18 | T17 | T17 | ✅ Match |
| T19 | T18 | T18 | ✅ Match |
| T20 | T19 | início da fase | ✅ Match |
| T21 | T20 | T20 | ✅ Match |
| T22 | T21 | T21 | ✅ Match |
| T23 | T22 | T22 | ✅ Match |
| T24 | T23 | T23 | ✅ Match |
| T25 | T24 | T24 | ✅ Match |
| T26 | T25 | T25 | ✅ Match |
| T27 | T26 | T26 | ✅ Match |
| T28 | T27 | início da fase | ✅ Match |
| T29 | T28 | T28 | ✅ Match |
| T30 | T29 | T29 | ✅ Match |
| T31 | T30 | T30 | ✅ Match |
| T32 | T31 | T31 | ✅ Match |
| T33 | T32 | T32 | ✅ Match |
| T34 | T33 | T33 | ✅ Match |
| T35 | T34 | T34 | ✅ Match |
| T36 | T35 | início da fase | ✅ Match |
| T37 | T36 | T36 | ✅ Match |
| T38 | T37 | T37 | ✅ Match |
| T39 | T38 | T38 | ✅ Match |
| T40 | T39 | T39 | ✅ Match |
| T41 | T40 | T40 | ✅ Match |
| T42 | T41 | T41 | ✅ Match |
| T43 | T42 | T42 | ✅ Match |
| T44 | T43 | T43 | ✅ Match |
| T45 | T44 | T44 | ✅ Match |
| T46 | T45 | início da fase | ✅ Match |
| T47 | T46 | T46 | ✅ Match |
| T48 | T47 | T47 | ✅ Match |
| T49 | T48 | T48 | ✅ Match |
| T50 | T49 | T49 | ✅ Match |
| T51 | T50 | T50 | ✅ Match |
| T52 | T51 | T51 | ✅ Match |
| T53 | T52 | T52 | ✅ Match |
| T54 | T53 | T53 | ✅ Match |
| T55 | T54 | início da fase | ✅ Match |
| T56 | T55 | T55 | ✅ Match |
| T57 | T56 | T56 | ✅ Match |
| T58 | T57 | T57 | ✅ Match |
| T59 | T58 | T58 | ✅ Match |
| T60 | T59 | T59 | ✅ Match |
| T61 | T60 | T60 | ✅ Match |
| T62 | T61 | T61 | ✅ Match |
| T63 | T62 | T62 | ✅ Match |
| T64 | T63 | T63 | ✅ Match |
| T65 | T64 | início da fase | ✅ Match |
| T66 | T65 | T65 | ✅ Match |
| T67 | T66 | T66 | ✅ Match |
| T68 | T67 | T67 | ✅ Match |
| T69 | T68 | T68 | ✅ Match |
| T70 | T69 | T69 | ✅ Match |
| T71 | T70 | T70 | ✅ Match |
| T72 | T71 | T71 | ✅ Match |
| T73 | T72 | início da fase | ✅ Match |
| T74 | T73 | T73 | ✅ Match |
| T75 | T74 | T74 | ✅ Match |
| T76 | T75 | T75 | ✅ Match |
| T77 | T76 | T76 | ✅ Match |
| T78 | T77 | T77 | ✅ Match |
| T79 | T78 | início da fase | ✅ Match |
| T80 | T79 | T79 | ✅ Match |
| T81 | T80 | T80 | ✅ Match |
| T82 | T81 | T81 | ✅ Match |
| T83 | T82 | T82 | ✅ Match |
| T84 | T83 | T83 | ✅ Match |
| T85 | T84 | T84 | ✅ Match |
| T86 | T85 | T85 | ✅ Match |
| T87 | T86 | T86 | ✅ Match |
| T88 | T87 | início da fase | ✅ Match |
| T89 | T88 | T88 | ✅ Match |
| T90 | T89 | T89 | ✅ Match |
| T91 | T90 | T90 | ✅ Match |
| T92 | T91 | T91 | ✅ Match |
| T93 | T92 | T92 | ✅ Match |
| T94 | T93 | T93 | ✅ Match |
| T95 | T94 | início da fase | ✅ Match |
| T96 | T95 | T95 | ✅ Match |
| T97 | T96 | T96 | ✅ Match |
| T98 | T97 | T97 | ✅ Match |
| T99 | T98 | T98 | ✅ Match |
| T100 | T99 | T99 | ✅ Match |
| T101 | T100 | T100 | ✅ Match |
| T102 | T101 | T101 | ✅ Match |
| T103 | T102 | T102 | ✅ Match |
| T104 | T103 | início da fase | ✅ Match |
| T105 | T104 | T104 | ✅ Match |
| T106 | T105 | T105 | ✅ Match |
| T107 | T106 | T106 | ✅ Match |
| T108 | T107 | T107 | ✅ Match |
| T109 | T108 | T108 | ✅ Match |
| T110 | T109 | T109 | ✅ Match |
| T111 | T110 | T110 | ✅ Match |
| T112 | T111 | T111 | ✅ Match |
| T113 | T112 | início da fase | ✅ Match |
| T114 | T113 | T113 | ✅ Match |
| T115 | T114 | T114 | ✅ Match |
| T116 | T115 | T115 | ✅ Match |
| T117 | T116 | T116 | ✅ Match |
| T118 | T117 | T117 | ✅ Match |
| T119 | T118 | T118 | ✅ Match |
| T120 | T119 | T119 | ✅ Match |
| T121 | T120 | início da fase | ✅ Match |
| T122 | T121 | T121 | ✅ Match |
| T123 | T122 | T122 | ✅ Match |
| T124 | T123 | T123 | ✅ Match |
| T125 | T124 | T124 | ✅ Match |
| T126 | T125 | início da fase | ✅ Match |
| T127 | T126 | T126 | ✅ Match |
| T128 | T127 | início da fase | ✅ Match |
| T129 | T128 | T128 | ✅ Match |
| T130 | T129 | T129 | ✅ Match |
| T131 | T130 | T130 | ✅ Match |
| T132 | T131 | T131 | ✅ Match |
| T133 | T132 | início da fase | ✅ Match |
| T134 | T133 | T133 | ✅ Match |
| T135 | T134 | T134 | ✅ Match |
| T136 | T135 | T135 | ✅ Match |
| T137 | T136 | T136 | ✅ Match |
| T138 | T137 | T137 | ✅ Match |
| T139 | T138 | T138 | ✅ Match |
| T140 | T139 | início da fase | ✅ Match |
| T141 | T140 | T140 | ✅ Match |
| T142 | T141 | T141 | ✅ Match |
| T143 | T142 | T142 | ✅ Match |
| T144 | T143 | T143 | ✅ Match |
| T145 | T144 | T144 | ✅ Match |
| T146 | T145 | início da fase | ✅ Match |
| T147 | T146 | T146 | ✅ Match |
| T148 | T147 | T147 | ✅ Match |
| T149 | T148 | T148 | ✅ Match |
| T150 | T149 | T149 | ✅ Match |
| T151 | T150 | T150 | ✅ Match |
| T152 | T151 | início da fase | ✅ Match |
| T153 | T152 | T152 | ✅ Match |
| T154 | T153 | T153 | ✅ Match |
| T155 | T154 | T154 | ✅ Match |
| T156 | T155 | T155 | ✅ Match |
| T157 | T156 | T156 | ✅ Match |
| T158 | T157 | T157 | ✅ Match |
| T159 | T158 | T158 | ✅ Match |
| T160 | T159 | início da fase | ✅ Match |
| T161 | T160 | T160 | ✅ Match |
| T162 | T161 | T161 | ✅ Match |
| T163 | T162 | T162 | ✅ Match |
| T164 | T163 | T163 | ✅ Match |
| T165 | T164 | T164 | ✅ Match |
| T166 | T165 | T165 | ✅ Match |
| T167 | T166 | início da fase | ✅ Match |
| T168 | T167 | T167 | ✅ Match |
| T169 | T168 | T168 | ✅ Match |
| T170 | T169 | T169 | ✅ Match |
| T171 | T170 | início da fase | ✅ Match |
| T172 | T171 | T171 | ✅ Match |
| T173 | T172 | T172 | ✅ Match |
| T174 | T173 | T173 | ✅ Match |
| T175 | T174 | T174 | ✅ Match |
| T176 | T175 | T175 | ✅ Match |
| T177 | T176 | T176 | ✅ Match |
| T178 | T177 | início da fase | ✅ Match |
| T179 | T178 | T178 | ✅ Match |
| T180 | T179 | T179 | ✅ Match |
| T181 | T180 | T180 | ✅ Match |
| T182 | T181 | T181 | ✅ Match |
| T183 | T182 | T182 | ✅ Match |
| T184 | T183 | T183 | ✅ Match |
| T185 | T184 | T184 | ✅ Match |
| T186 | T185 | T185 | ✅ Match |
| T187 | T186 | T186 | ✅ Match |
| T188 | T187 | início da fase | ✅ Match |
| T189 | T188 | T188 | ✅ Match |
| T190 | T189 | T189 | ✅ Match |
| T191 | T190 | T190 | ✅ Match |
| T192 | T191 | T191 | ✅ Match |
| T193 | T192 | início da fase | ✅ Match |
| T194 | T193 | T193 | ✅ Match |
| T195 | T194 | T194 | ✅ Match |
| T196 | T195 | T195 | ✅ Match |
| T197 | T196 | T196 | ✅ Match |
| T198 | T197 | T197 | ✅ Match |
| T199 | T198 | T198 | ✅ Match |
| T200 | T199 | T199 | ✅ Match |
| T201 | T200 | início da fase | ✅ Match |
| T202 | T201 | T201 | ✅ Match |
| T203 | T202 | T202 | ✅ Match |
| T204 | T203 | T203 | ✅ Match |
| T205 | T204 | T204 | ✅ Match |
| T206 | T205 | T205 | ✅ Match |
| T207 | T206 | T206 | ✅ Match |
| T208 | T207 | T207 | ✅ Match |
| T209 | T208 | T208 | ✅ Match |
| T210 | T209 | início da fase | ✅ Match |
| T211 | T210 | T210 | ✅ Match |
| T212 | T211 | T211 | ✅ Match |
| T213 | T212 | T212 | ✅ Match |
| T214 | T213 | T213 | ✅ Match |
| T215 | T214 | T214 | ✅ Match |
| T216 | T215 | T215 | ✅ Match |
| T217 | T216 | T216 | ✅ Match |
| T218 | T217 | T217 | ✅ Match |
| T219 | T218 | T218 | ✅ Match |
| T220 | T219 | início da fase | ✅ Match |
| T221 | T220 | T220 | ✅ Match |
| T222 | T221 | T221 | ✅ Match |
| T223 | T222 | T222 | ✅ Match |
| T224 | T223 | T223 | ✅ Match |

A primeira tarefa de cada fase depende da última da fase anterior (dependência para trás, fora do diagrama da fase).

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1: Criar o contrato do catálogo de widgets | config, tipos, schema ou docs (backend) | none | none | ✅ OK |
| T2: Expor o catálogo no pacote compartilhado do backend | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T3: Criar a tabela DashboardLayout no auth-service | config, tipos, schema ou docs (backend) | none | none | ✅ OK |
| T4: Validar o corpo do layout (INVALID_LAYOUT) | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T5: Repositório do layout | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T6: Serviço de preferências | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T7: Rotas /preferences/dashboard no auth-service | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T8: Encaminhar /api/v1/preferences ao auth-service | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T9: Teste de preflight CORS para a origem da web | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T10: Criar o projeto web (Vite + React + TypeScript estrito) | config, tipos, schema ou docs (web) | none | none | ✅ OK |
| T11: ESLint com limites de legibilidade | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T12: dependency-cruiser: regra de camadas | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T13: dependency-cruiser: bibliotecas isoladas, features e ciclos | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T14: Limite de duplicação com jscpd | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T15: Configurar Vitest, Testing Library, MSW e axe | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T16: Job web no CI | config, tipos, schema ou docs (ci) | none | none | ✅ OK |
| T17: AppError do domínio | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T18: Papel e rota inicial | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T19: Spike: @dnd-kit com React 19 | apresentação (web) | component | component | ✅ OK |
| T20: Ports compartilhados do domínio | config, tipos, schema ou docs (web) | none | none | ✅ OK |
| T21: Barramento de expiração de sessão (Observer) | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T22: Armazenamento do token | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T23: Mapeamento de respostas HTTP em AppError | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T24: Cliente HTTP (Adapter sobre fetch) | repositório, rota ou adaptador HTTP (web) | integration | integration | ✅ OK |
| T25: Leitor do exp do JWT | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T26: Fuso do navegador e relógio | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T27: Validação de DTO na borda | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T28: Domínio da autenticação | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T29: Caso de uso: entrar | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T30: Caso de uso: restaurar sessão | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T31: Caso de uso: sair | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T32: Caso de uso: renovar sessão | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T33: Repositório de sessão (HTTP) | repositório, rota ou adaptador HTTP (web) | integration | integration | ✅ OK |
| T34: Repositório de conta (HTTP) | repositório, rota ou adaptador HTTP (web) | integration | integration | ✅ OK |
| T35: Composition root | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T36: Tokens de tema e contraste | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T37: Formatação pt-BR | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T38: Tema claro, escuro e sistema | apresentação (web) | component | component | ✅ OK |
| T39: Estados de carregamento, vazio, erro e acesso negado | apresentação (web) | component | component | ✅ OK |
| T40: Política de consultas e retentativas | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T41: AuthProvider | apresentação (web) | component | component | ✅ OK |
| T42: Guarda de rota por papel | apresentação (web) | component | component | ✅ OK |
| T43: Tela de login | apresentação (web) | component | component | ✅ OK |
| T44: Renovação com atividade | apresentação (web) | component | component | ✅ OK |
| T45: Casca da aplicação | apresentação (web) | component | component | ✅ OK |
| T46: Domínio do layout | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T47: Normalizar layout salvo | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T48: Layout padrão por papel (Strategy) | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T49: Registro de widgets (Registry + Factory) | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T50: Repositório do layout (HTTP) | repositório, rota ou adaptador HTTP (web) | integration | integration | ✅ OK |
| T51: Casos de uso do layout | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T52: Grade responsiva | apresentação (web) | component | component | ✅ OK |
| T53: Invólucro de widget | apresentação (web) | component | component | ✅ OK |
| T54: Hook de layout | apresentação (web) | component | component | ✅ OK |
| T55: Paleta de séries | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T56: ChartFrame | apresentação (web) | component | component | ✅ OK |
| T57: Adaptador de linha com banda | apresentação (web) | component | component | ✅ OK |
| T58: Adaptador de barras | apresentação (web) | component | component | ✅ OK |
| T59: Adaptador de barras empilhadas | apresentação (web) | component | component | ✅ OK |
| T60: Adaptador de rosca | apresentação (web) | component | component | ✅ OK |
| T61: Adaptador de faixas de percentil (AGP) | apresentação (web) | component | component | ✅ OK |
| T62: Adaptador de dispersão com quadrantes | apresentação (web) | component | component | ✅ OK |
| T63: Heatmap em SVG próprio | apresentação (web) | component | component | ✅ OK |
| T64: Redesenho por tamanho do contêiner | apresentação (web) | component | component | ✅ OK |
| T65: Aceitar tz em /dashboard/summary | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T66: Validar o fuso contra o banco | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T67: Limites do período no fuso | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T68: Distribuição em 5 zonas | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T69: Uso do sensor | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T70: AGP por hora local | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T71: Heatmap dia da semana × hora | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T72: Última leitura do paciente | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T73: byDay no fuso com carboidrato e insulina | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T74: Serviço do summary reutilizável | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T75: Testes de rota do summary estendido | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T76: Contrato do GMI no backend | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T77: GMI no domínio do app | lógica pura / guarda (app) | unit | unit | ✅ OK |
| T78: Relatório do app usa o GMI único | apresentação (app) | component | component | ✅ OK |
| T79: Zonas de glicose no domínio | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T80: Período e validação | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T81: Frescor dos dados | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T82: Média ponderada e dados suficientes | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T83: Entidades do summary e port | config, tipos, schema ou docs (web) | none | none | ✅ OK |
| T84: Repositório do summary (HTTP) | repositório, rota ou adaptador HTTP (web) | integration | integration | ✅ OK |
| T85: Caso de uso: carregar summary | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T86: Hook useSummary compartilhado | apresentação (web) | component | component | ✅ OK |
| T87: Filtro de período | apresentação (web) | component | component | ✅ OK |
| T88: Cartão de KPI | apresentação (web) | component | component | ✅ OK |
| T89: Widget de tempo no alvo | apresentação (web) | component | component | ✅ OK |
| T90: Widget de GMI | apresentação (web) | component | component | ✅ OK |
| T91: Widget de glicose média | apresentação (web) | component | component | ✅ OK |
| T92: Widget de variabilidade (CV) | apresentação (web) | component | component | ✅ OK |
| T93: Widget de uso do sensor | apresentação (web) | component | component | ✅ OK |
| T94: Widget de frescor dos dados | apresentação (web) | component | component | ✅ OK |
| T95: Widget de tendência | apresentação (web) | component | component | ✅ OK |
| T96: Widget de % no alvo por dia | apresentação (web) | component | component | ✅ OK |
| T97: Widget de zonas | apresentação (web) | component | component | ✅ OK |
| T98: Widget de AGP | apresentação (web) | component | component | ✅ OK |
| T99: Widget de heatmap | apresentação (web) | component | component | ✅ OK |
| T100: Widget de episódios de hipo e hiper | apresentação (web) | component | component | ✅ OK |
| T101: Widget de insulina por tipo | apresentação (web) | component | component | ✅ OK |
| T102: Widget de alertas por tipo | apresentação (web) | component | component | ✅ OK |
| T103: Widget de carboidrato e insulina por dia | apresentação (web) | component | component | ✅ OK |
| T104: Entidades do diário e port | config, tipos, schema ou docs (web) | none | none | ✅ OK |
| T105: Repositório do diário (HTTP) | repositório, rota ou adaptador HTTP (web) | integration | integration | ✅ OK |
| T106: Caso de uso: dia detalhado | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T107: Widget de dia detalhado | apresentação (web) | component | component | ✅ OK |
| T108: Catálogo de widgets do paciente | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T109: Página do dashboard do paciente | apresentação (web) | component | component | ✅ OK |
| T110: Garantia de somente leitura dos dados clínicos | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T111: Rotas e providers da aplicação | apresentação (web) | component | component | ✅ OK |
| T112: Varredura de acessibilidade das páginas | apresentação (web) | component | component | ✅ OK |
| T113: Estado do editor | apresentação (web) | component | component | ✅ OK |
| T114: Adicionar e remover widgets | apresentação (web) | component | component | ✅ OK |
| T115: Reordenar arrastando | apresentação (web) | component | component | ✅ OK |
| T116: Mover por teclado | apresentação (web) | component | component | ✅ OK |
| T117: Redimensionar | apresentação (web) | component | component | ✅ OK |
| T118: Barra de personalização | apresentação (web) | component | component | ✅ OK |
| T119: Personalização integrada à página | apresentação (web) | component | component | ✅ OK |
| T120: Prova de aberto/fechado dos widgets | apresentação (web) | component | component | ✅ OK |
| T121: Configuração da Vercel | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T122: Rotas e gráficos sob demanda | config, tipos, schema ou docs (web) | none | none | ✅ OK |
| T123: Orçamento de 250 kB | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T124: CORS de produção com a origem da web | config, tipos, schema ou docs (backend) | none | none | ✅ OK |
| T125: Guia de publicação da web | config, tipos, schema ou docs (docs) | none | none | ✅ OK |
| T126: Refatorar o código repetido dos repositórios HTTP | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T127: Refatorar a montagem dos widgets de summary | apresentação (web) | component | component | ✅ OK |
| T128: Criar conta com papel informado pelo serviço | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T129: Serviço: cadastrar profissional | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T130: Rota interna de cadastro do profissional | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T131: Validar o perfil profissional | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T132: Módulo interno de profissionais | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T133: Cliente do auth: cadastro profissional | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T134: Cliente do glucose: perfil profissional | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T135: Saga do cadastro profissional | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T136: Rota pública de cadastro profissional | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T137: /me por papel | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T138: Excluir conta por papel | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T139: Seed do administrador | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T140: Tabelas do consentimento | config, tipos, schema ou docs (backend) | none | none | ✅ OK |
| T141: Código de convite | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T142: Repositório do consentimento | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T143: Serviço do consentimento | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T144: Política de vínculo ativo | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T145: Rotas /sharing | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T146: Lookup de nomes no auth-service | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T147: Cliente do auth: lookup | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T148: Limitador de resgate por usuário | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T149: Proxies de sharing e professional | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T150: Vínculos do paciente com nomes | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T151: Exclusão remove convites e vínculos | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T152: Domínio do compartilhamento | lógica pura / guarda (app) | unit | unit | ✅ OK |
| T153: Fonte remota do compartilhamento | lógica pura / guarda (app) | unit | unit | ✅ OK |
| T154: Repositório do compartilhamento | lógica pura / guarda (app) | unit | unit | ✅ OK |
| T155: Cubit do compartilhamento | lógica pura / guarda (app) | unit | unit | ✅ OK |
| T156: Textos do compartilhamento | config, tipos, schema ou docs (app) | none | none | ✅ OK |
| T157: Tela de compartilhamento | apresentação (app) | component | component | ✅ OK |
| T158: Registrar o compartilhamento no DI | lógica pura / guarda (app) | unit | unit | ✅ OK |
| T159: Entrada nas configurações | apresentação (app) | component | component | ✅ OK |
| T160: Métricas por paciente da carteira | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T161: Pacientes vinculados paginados | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T162: Hipos da carteira por hora | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T163: Serviço da carteira | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T164: Rotas /professional | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T165: Carteira com nomes no gateway | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T166: Resumo da carteira com nomes no gateway | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T167: Política de senha na web | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T168: Caso de uso: cadastrar profissional | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T169: Repositório do cadastro (HTTP) | repositório, rota ou adaptador HTTP (web) | integration | integration | ✅ OK |
| T170: Tela de cadastro do profissional | apresentação (web) | component | component | ✅ OK |
| T171: Regra de risco | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T172: Filtro, busca e ordenação da carteira | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T173: Entidades e ports do profissional | config, tipos, schema ou docs (web) | none | none | ✅ OK |
| T174: Repositório do profissional (HTTP) | repositório, rota ou adaptador HTTP (web) | integration | integration | ✅ OK |
| T175: Repositório do resgate (HTTP) | repositório, rota ou adaptador HTTP (web) | integration | integration | ✅ OK |
| T176: Casos de uso do profissional | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T177: Hooks da carteira | apresentação (web) | component | component | ✅ OK |
| T178: Widget de resgate de código | apresentação (web) | component | component | ✅ OK |
| T179: KPI de pacientes vinculados | apresentação (web) | component | component | ✅ OK |
| T180: KPI de TIR médio | apresentação (web) | component | component | ✅ OK |
| T181: KPI de GMI médio | apresentação (web) | component | component | ✅ OK |
| T182: KPI de pacientes com hipo | apresentação (web) | component | component | ✅ OK |
| T183: KPI de pacientes sem dado recente | apresentação (web) | component | component | ✅ OK |
| T184: Tabela da carteira | apresentação (web) | component | component | ✅ OK |
| T185: Zonas por paciente | apresentação (web) | component | component | ✅ OK |
| T186: Dispersão TIR × CV | apresentação (web) | component | component | ✅ OK |
| T187: Histograma de TIR | apresentação (web) | component | component | ✅ OK |
| T188: Hipos por hora | apresentação (web) | component | component | ✅ OK |
| T189: Catálogo de widgets do profissional | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T190: Página da carteira | apresentação (web) | component | component | ✅ OK |
| T191: Detalhe do paciente vinculado | apresentação (web) | component | component | ✅ OK |
| T192: Rotas do profissional e do cadastro | apresentação (web) | component | component | ✅ OK |
| T193: Papel nas rotas internas | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T194: Estatísticas de contas | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T195: Lista de contas | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T196: Rotas internas de admin no auth-service | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T197: Estatísticas clínicas agregadas | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T198: Rota interna de admin no glucose-service | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T199: Clientes de admin no gateway | lógica pura / guarda (backend) | unit | unit | ✅ OK |
| T200: Composição da visão do admin | repositório, rota ou adaptador HTTP (backend) | integration | integration | ✅ OK |
| T201: Entidades e ports do admin | config, tipos, schema ou docs (web) | none | none | ✅ OK |
| T202: Repositório do admin (HTTP) | repositório, rota ou adaptador HTTP (web) | integration | integration | ✅ OK |
| T203: Casos de uso do admin | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T204: Hooks do admin | apresentação (web) | component | component | ✅ OK |
| T205: Filtro de período do admin | apresentação (web) | component | component | ✅ OK |
| T206: KPI de contas | apresentação (web) | component | component | ✅ OK |
| T207: KPI de cadastros | apresentação (web) | component | component | ✅ OK |
| T208: KPI de pacientes ativos | apresentação (web) | component | component | ✅ OK |
| T209: KPI de vínculos ativos | apresentação (web) | component | component | ✅ OK |
| T210: Contas por papel | apresentação (web) | component | component | ✅ OK |
| T211: Cadastros por dia | apresentação (web) | component | component | ✅ OK |
| T212: Cadastrados × ativos | apresentação (web) | component | component | ✅ OK |
| T213: Leituras por dia | apresentação (web) | component | component | ✅ OK |
| T214: Vínculos por semana | apresentação (web) | component | component | ✅ OK |
| T215: Alertas da plataforma | apresentação (web) | component | component | ✅ OK |
| T216: Tabela de contas | apresentação (web) | component | component | ✅ OK |
| T217: Catálogo de widgets do admin | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T218: Página do admin | apresentação (web) | component | component | ✅ OK |
| T219: Rota do admin | apresentação (web) | component | component | ✅ OK |
| T220: Documento de arquitetura da web | config, tipos, schema ou docs (docs) | none | none | ✅ OK |
| T221: Teste da evidência de arquitetura | lógica pura / guarda (web) | unit | unit | ✅ OK |
| T222: Configuração do Lighthouse | config, tipos, schema ou docs (web) | none | none | ✅ OK |
| T223: Documentação da API | config, tipos, schema ou docs (docs) | none | none | ✅ OK |
| T224: Documentação do repositório | config, tipos, schema ou docs (docs) | none | none | ✅ OK |
