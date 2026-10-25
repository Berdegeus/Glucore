# Evidências da rubrica do TCC

> Medido em **2026-10-25** sobre a `main` em `f3e10a9` (PR #50). Fonte da rubrica: aba **Rubricas** de
> [`TCC_Acompanhamento_Bernardo_Eduardo.xlsx`](TCC_Acompanhamento_Bernardo_Eduardo.xlsx) (a planilha é de 20/08 e seus
> "Sim/Não" estão defasados). Plano de escopo: [`tcc-rubric-evolution-plan.md`](tcc-rubric-evolution-plan.md).
>
> **Como ler.** Cada critério traz o veredito, a evidência (arquivo, número ou comando para reproduzir) e a lacuna.
> A faixa de nota é **estimativa da equipe**; quem decide é o professor. O que não dá para provar com o repositório
> aparece como **não evidenciável aqui**, com o que falta entregar.

## Resumo

| Grupo | Critério | Veredito |
|---|---|---|
| Obrigatório | 9 Escopo ≥ 80% | Não evidenciável aqui |
| Obrigatório | 10 Processo ágil e sprints | Parcial |
| Obrigatório | 11 Frontend acabado | Atendido |
| Obrigatório | 12 REST + JSON | Atendido |
| Obrigatório | 13 Persistência | Atendido |
| Obrigatório | 14 Dois ou mais perfis | Atendido |
| Obrigatório | 15 Dashboard gerencial | Atendido |
| Obrigatório | 16 Git | Atendido |
| Opcional comprometido | 23 Qualidade | Parcial |
| Opcional comprometido | 24 Prototipação | Sem evidência |
| Opcional comprometido | 25 Cobertura backend | Completo |
| Opcional comprometido | 26 Documentação backend | Completo |
| Opcional comprometido | 27 Migrations | Parcial |
| Opcional comprometido | 28 Banco avançado | Completo |
| Opcional comprometido | 33 Padrões e arquitetura (back) | Completo |
| Opcional comprometido | 35 Responsivo e customizável | Completo |
| Opcional comprometido | 37 Padrões e arquitetura (front) | Completo |
| Opcional comprometido | 39 CI/CD | Parcial baixa |
| Opcional comprometido | 42 Livre (stack de sensores) | Implementado; acordo é externo |
| Extra | 30 Microsserviços | Parcial |
| Extra | 31 Discovery e gateway | Parcial |
| Extra | 34 Cobertura frontend | Completo (web) |
| Extra | 38 Acessibilidade | Parcial (a, b sem estudo) |

---

## Obrigatórios

### 9 — Pelo menos 80% do escopo acordado
**Não evidenciável aqui.** O acordo com os professores é externo. O que existe: a especificação funcional
[`glucore-functional-spec.md`](glucore-functional-spec.md) e o acompanhamento de requisitos
[`sprint1_tracking.md`](sprint1_tracking.md).
**Falta entregar:** o registro escrito do que foi acordado, com data, e a conta de quanto do escopo está pronto.

### 10 — Processo ágil e sprints documentadas (TDE)
**Parcial.**
- Board Kanban no GitHub Projects, descrito em [`guides/kanban-board.md`](guides/kanban-board.md).
- Acompanhamento da sprint 1 em [`sprint1_tracking.md`](sprint1_tracking.md).
- 21 PRs mergeados; fluxo de branches em [`guides/versioning-and-branches.md`](guides/versioning-and-branches.md).

**Lacuna:** não existe `docs/sprints/` com review e retrospectiva por sprint. O formato exigido pelo TDE não está no repositório.

### 11 — Frontend acabado, com mensagens e reação a erro
**Atendido (por código).**
- Estados de carregando, vazio e erro com "Tentar novamente": `web/src/shared/presentation/ui/states.tsx`.
- Login e cadastro com mensagens de erro por campo e aviso de serviço indisponível.
- 30 arquivos de teste de acessibilidade com axe (`grep -rl axe web/src --include=*.test.tsx | wc -l`).
- Visual alinhado ao app mobile (PR #50); layout sem rolagem horizontal em 320, 375, 768 e 1440 px (medido à mão, não automatizado).
- App: mensagens unificadas por `glucore_messenger.dart`, validado em `.specs/features/checklist-tcc-compliance/validation.md`.

**Lacuna:** "bem acabado" é julgamento; vale uma demonstração ao vivo.

### 12 — Backend REST com JSON
**Atendido.**
- Entrada única em `/api/v1` (gateway): `backend/services/gateway/src/app.ts`.
- Contrato OpenAPI: `backend/services/gateway/openapi.yaml` (669 linhas, 20 caminhos), servido com Swagger UI pelo gateway.
- Erros padronizados com código (`FORBIDDEN_ROLE`, `INVALID_*`), descritos em `backend/README.md`.

### 13 — Dados persistidos em banco
**Atendido.**
- Dois bancos PostgreSQL (`glucore_auth_*` com 6 modelos e `glucore_dev` com 19) via Prisma.
- Cliente móvel com SQLite local e sincronização (`glucore_patient.db`), documentado em `CLAUDE.md`.

### 14 — Dois ou mais perfis, validados no front e no back
**Atendido** (3 perfis: `PATIENT`, `HEALTH_PROFESSIONAL`, `ADMINISTRATOR`).
- Backend: `requireRole('ADMINISTRATOR')` em `backend/services/gateway/src/modules/admin/admin.routes.ts:15`;
  `requireRole('PATIENT')` em `.../alerts/alerts.routes.ts:11`; `requireRole('HEALTH_PROFESSIONAL')` em
  `.../professional/professional.routes.ts:16`. O papel vem da claim do JWT (ADR 0003).
- Frontend web: guarda por papel em `web/src/features/auth/presentation/requireRole.tsx` e `web/src/app/routes.tsx`
  (quem tem outro papel é redirecionado para a própria home).
- Testes de 403 `FORBIDDEN_ROLE`: `backend/services/gateway/tests/routes/admin.test.ts`,
  `professional.patients.test.ts`, `professional.cohort.test.ts`, `glucose-service/tests/middleware/auth.test.ts`.

### 15 — Dashboard com informações, filtros e gráficos
**Atendido.** Um painel por papel; catálogo em `contracts/widget-catalog.json`.
- Paciente: 16 widgets (indicadores de tempo no alvo, GMI, glicose média, variabilidade e uso do sensor; gráficos de tendência, AGP, mapa de calor, zonas, carboidrato e insulina, alertas; tabela de excursões); filtro de 7, 14, 30 e 90 dias e período personalizado.
- Profissional: carteira de pacientes com risco, filtros, coorte e detalhe por paciente.
- Administrador: 4 indicadores e 7 gráficos (contas por papel, cadastros, pacientes ativos, leituras por dia, vínculos por semana, alertas por tipo) e tabela de contas; filtro de 7, 30 e 90 dias.
- Arquitetura: [`architecture/web-dashboard.md`](architecture/web-dashboard.md).

### 16 — Git organizado, com participação de todos
**Atendido** (dados de `git log` em 2026-10-25):

| Pessoa (nomes no git) | Commits | Período |
|---|---|---|
| Berdegeus / Bernardo Roorda | 131 | 2026-05-02 a 2026-10-12 |
| schneider-edu / Eduardo Schneider | 117 | 2026-05-17 a 2026-10-25 |

- 219 de 228 commits sem merge seguem Conventional Commits (`git log --no-merges --format=%s main | grep -cE '^(feat|fix|docs|refactor|test|chore|ci|style|perf|build)(\(.+\))?!?: '`).
- Branches por feature, 21 PRs mergeados, `dev` para integração e `main` para releases.

**Lacuna:** existem dois commits antigos de outras identidades (março/2026); se o grupo tem mais de dois alunos, a participação dos demais precisa de evidência.

---

## Opcionais comprometidos

### 23 — Processo de qualidade
**Parcial.** Evidências em [`guides/qa-process.md`](guides/qa-process.md):
- Gates automatizados e checklist de revisão de PR.
- Verificação independente por feature, com um caso real de **rodada 1 reprovada e rodada 2 aprovada**
  (`.specs/features/checklist-tcc-compliance/validation.md`): 5 gaps e 2 mutantes sobreviventes.
- CI em todo PR: 45 execuções do `ci.yml` (31 sucessos, 12 falhas, 2 canceladas), as falhas viram correções.

**Lacuna:** o critério mede a fração de sprints com o processo; falta o mapa por sprint e o registro no board.

### 24 — Prototipação de telas
**Sem evidência no repositório.** Não há Figma, checklist de usabilidade nem teste filmado.
**Falta entregar:** link do Figma, checklist aplicado e ao menos um teste filmado com usuário.

### 25 — Cobertura de testes do backend acima de 75%
**Completo.** Medido com `cd backend && npm run test:coverage`:

| Linhas | Statements | Funções | Branches | Testes |
|---|---|---|---|---|
| 97,82% | 97,82% | 98,13% | 93,32% | 1386 em 97 arquivos |

- O CI publica o relatório: etapa `npm run test:coverage` e artefato `backend-coverage` em `.github/workflows/ci.yml` (job `backend`).

### 26 — Documentação do backend
**Completo** (a, b e c).
- a) Sumário e descrições: `openapi.yaml` (20 caminhos com descrição) servido em Swagger UI pelo gateway.
- b) Exemplos de payload reais: `backend/README.md` (1115 linhas, 24 seções).
- c) README: [`README.md`](../README.md) (554 linhas) e [`guides/setup-and-build.md`](guides/setup-and-build.md) cobrem o que é, como montar o ambiente e executar.
- Decisões de arquitetura: 7 ADRs em [`adr/`](adr/).

### 27 — Migrações profissionais
**Parcial.** Prisma Migrate nos dois serviços: 14 migrations no glucose-service e 2 no auth-service, todas versionadas.

| Mês | Migrations |
|---|---|
| Maio | 5 |
| Junho | 1 |
| Agosto | 4 (3 glucose e 1 auth) |
| Outubro | 6 (5 glucose e 1 auth) |

- Migrations escritas à mão quando preciso (função de métricas, índice BRIN, backfill de buckets).
- Regra registrada em `CLAUDE.md`: nunca aceitar o `DROP INDEX` do `migrate dev`; usar `migrate deploy`.

**Lacuna:** a faixa depende do percentual de sprints com migration; falta mapear datas para sprints.

### 28 — Banco de dados avançado
**Completo** (a, b e c).
- a) Consultas agrupadas no dashboard: `groupBy` em `backend/services/glucose-service/src/modules/dashboard/dashboard.repository.ts:148` e `:159`; agregados do admin em `.../admin/admin.repository.ts`.
- b) Índices que reforçam regra de negócio: únicos como `GlucoseReading_userId_timestampMs_key` (sem leitura duplicada), `SensorDevice_serialNum...`, mais o índice BRIN por `recordedAt` (`20261006090000_add_reading_recordedat_brin_index`).
- c) Recursos do banco: funções `glucose_metrics()` e `glucose_zones()` em migrations (`20260831232506`, `20261004120000`, `20261012130000`), chamadas por `SELECT * FROM glucose_metrics(...)` em `dashboard.repository.ts:181` e `:200`.

### 33 — Padrões de projeto e arquitetura limpa (backend)
**Completo (estimado).**
- Camadas por módulo: `routes · controller · service · repository · schema · mapper` ([ADR 0004](adr/0004-camadas-repository-e-di-manual.md)).
- Padrões aplicados e justificados nos ADRs: Repository e injeção manual de dependências (0004), API Gateway (0001), Service Registry (0005), Saga com compensação (0006), token interno entre serviços (0007).
- Raiz de composição por serviço: `src/container.ts`.

### 35 — Responsivo e customizável
**Completo** (a, b e c).
- a) Temas claro, escuro e do sistema: `web/src/shared/presentation/theme/themeProvider.tsx` (`'light' | 'dark' | 'system'`); no app, `AppTheme.dark()`.
- b) Desktop e celular: breakpoints em 640 e 1024 px, grade de 1, 1, 2 e 4 colunas, alvos de toque de 44 px (`tokens.css`); sem rolagem horizontal em 320 a 1440 px.
- c) Customização com salvamento: widgets adicionados, removidos, redimensionados e reordenados; layout salvo no servidor por `PUT /preferences/dashboard` (`auth-service`, `preferences.schema.ts`).

### 37 — Padrões e arquitetura limpa (frontend)
**Completo (estimado).**
- Quatro camadas por feature (`domain`, `application`, `infrastructure`, `presentation`) com raiz de composição em `web/src/composition/container.ts`.
- Regras **aplicadas por ferramenta**, não por convenção: 12 regras em `web/.dependency-cruiser.cjs` (`npm run lint:arch`), no CI.
- Padrões: Repository (porta e adaptador), Registry de widgets e Composition Root.
- Limites de ESLint (complexidade 10, profundidade 3, 250 linhas) e duplicação máxima de 3% (`npm run dup`).

### 39 — CI/CD por ambiente
**Parcial baixa.**
- CI (`.github/workflows/ci.yml`): Flutter, Kotlin, backend e web em todo PR.
- Publicação (`.github/workflows/publish-images.yml`): imagens no GHCR depois do CI verde na `main`; 13 sucessos.
- Deploy: a VM busca as imagens por `backend/deploy/update.sh`, com cron diário às 23:59 (Brasília), conforme [`guides/deployment.md`](guides/deployment.md); a web é publicada na Vercel.

**Lacuna:** existe **um único ambiente (produção)**; não há dev e test separados, que o critério exige para a faixa alta.

### 42 — Livre: stack de conexão de sensores
**Implementado; o acordo é externo.**
- Protocolo GATT proprietário Sibionics, NFC mais biblioteca Abbott para o Libre 2 e PIN do Accu-Chek, unificados por `BrandBleManager.kt`, com ponte JNI e C++ para bibliotecas arm64.
- Documentação: [`reference/multi-sensor-architecture.md`](reference/multi-sensor-architecture.md) (121 linhas), [`architecture/sensor-pipeline.md`](architecture/sensor-pipeline.md) (134 linhas), [`reference/native-stubs.md`](reference/native-stubs.md).

**Falta entregar:** a confirmação escrita dos professores de que o item foi acordado até a terceira sprint.

---

## Critérios fora do compromisso que o projeto hoje atende em parte

### 30 e 31 — Microsserviços, discovery e gateway
**Parcial.**
- Três serviços (gateway, auth-service e glucose-service) com **bancos separados**: [ADR 0001](adr/0001-tres-servicos-e-gateway.md) e [ADR 0002](adr/0002-banco-por-servico-e-fronteira-de-identidade.md).
- Gateway é a única porta pública; chamadas internas com token de serviço.
- Discovery: `ServiceRegistry` por variável de ambiente ou Consul ([ADR 0005](adr/0005-service-registry-strategy.md)); **em produção usa variável de ambiente**, sem Consul.

**Lacunas:** não há fluxo assíncrono relevante (a saga de registro é síncrona); o discovery de produção não é um registro dinâmico.

### 34 — Cobertura de testes do frontend
**Completo na web:** `cd web && npm run test:coverage` dá 99,23% de statements, 95,39% de branches, 99,58% de funções e 99,75% de linhas, com 1994 testes passando e 4 pulados (169 arquivos).
**Lacuna:** a cobertura do Flutter é publicada pelo CI (`flutter test --coverage`), mas não foi medida neste levantamento.

### 38 — Acessibilidade
**Parcial (só a parte técnica).** Contraste verificado por teste (`tokens.test.ts`: 4,5:1 para texto, 3:1 para elementos gráficos), foco visível, alvos de 44 px, alternativa em tabela para cada gráfico, 30 arquivos de teste com axe.
**Falta:** público escolhido, estudo de acessibilidade e teste com esse público.

### Não se aplicam ou não existem
- **29 NoSQL:** o produto é relacional.
- **32 Cloud:** Vercel, GHCR e uma VM não bastam para "serviços cloud relevantes".
- **36 i18n:** decisão de produto (pt e pt-BR).
- **40 IaC e 41 monitoramento:** não há Terraform nem métricas, só `healthcheck` do compose.

---

## Como reproduzir as medições

```bash
cd backend && npm ci && npm run test:coverage     # item 25 (criado com Postgres local de teste)
cd web && npm ci && npm run test:coverage         # item 34
cd web && npm run lint:arch && npm run dup        # item 37
git log --no-merges --format=%s main | grep -cE '^(feat|fix|docs|refactor|test|chore|ci|style|perf|build)(\(.+\))?!?: '   # item 16
```
