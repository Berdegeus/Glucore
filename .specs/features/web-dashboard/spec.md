# Dashboard Web Glucore — Specification

**Gathered:** 2026-10-04
**Escopo:** Complex (nova aplicação web, três perfis, consentimento, novos endpoints, mudança no app móvel)
**Rubricas atendidas:** 15 (dashboard gerencial, obrigatório), 14 (2 perfis, obrigatório), 37 (arquitetura limpa no frontend), 35 (responsivo e customizável) e 28 (agregações no banco).

## Problem Statement

O backend já agrega os dados do paciente (`GET /dashboard/summary`), mas nenhum cliente o consome, e só existe o perfil `PATIENT`. A rubrica 15 exige um dashboard com informações, filtros e gráficos para apoiar decisões gerenciais, e a 14 exige dois perfis com permissões validadas no front e no back. Hoje o profissional de saúde não consegue ver um paciente e o administrador não enxerga a plataforma.

Esta feature entrega uma aplicação web (Vite + React + TypeScript), publicada na Vercel, que lê os dados sincronizados pelo aplicativo móvel e mostra um dashboard por papel (paciente, profissional de saúde, administrador), com widgets que cada pessoa pode reorganizar e salvar.

## Goals

- [ ] Uma SPA publicada na Vercel autentica pelo mesmo `POST /api/v1/auth/login` do app e abre o dashboard do papel da pessoa, e só dele.
- [ ] Pelo menos 8 widgets distintos para o paciente, 6 para o profissional e 5 para o administrador, todos alimentados por dados reais do backend.
- [ ] Cada pessoa adiciona, remove, reordena, redimensiona e salva widgets, e o layout volta igual em outro dispositivo.
- [ ] O frontend tem camadas `domain`, `application`, `infrastructure` e `presentation`, com a regra de dependência verificada por ferramenta no CI (rubrica 37).
- [ ] O frontend atinge o tier máximo da rubrica 37: 3 ou mais padrões com princípios de design consistentes, arquitetura limpa com camadas claras, e código legível, modular, refatorado e bem justificado, cada elemento com evidência mensurável (tabela da história "Arquitetura limpa verificável").
- [ ] Nenhuma tela produz rolagem horizontal de 320 px a 2560 px, e os fluxos principais funcionam só com teclado.
- [ ] O profissional só lê dados de pacientes que geraram um código de convite no app, e o paciente revoga o acesso a qualquer momento.

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Reason |
| ------- | ------ |
| Escrita de dados clínicos pela web (leituras, carboidratos, insulina, alertas) | O app móvel é a única fonte; a web é somente leitura para dados clínicos. |
| Bloquear ou desativar usuário pelo admin | O login ignora `User.status` hoje e não há revogação de token; exigiria mexer na autenticação (feature própria). |
| Validação do CRM em órgão oficial (CFM) | Sem integração disponível; a barreira é o consentimento do paciente, não o cadastro. |
| Relatório clínico em PDF e uso de `ClinicalReport`/`MetricsSnapshot` | Fora do pedido; as tabelas continuam como roadmap. |
| Predição de glicemia | `GlucosePrediction` não tem fonte de dados. |
| Tempo real (WebSocket/SSE) | A sincronização do app já é em lote; a web atualiza por polling. |
| SSR, SEO e Next.js | Área autenticada, sem conteúdo público a indexar. |
| Outros idiomas | Produto trava em pt-BR (rubrica 36 fora do plano). |
| 2FA, login social, SSO | Mesmo gate de login existente, sem novos fatores. |
| Granularidade de permissão do vínculo além de leitura | `permissionLevel` fica fixo em `READ`. |
| Expiração automática do vínculo | Revogação pelo paciente basta na v1 (ver Assumptions). |
| Deploys de preview da Vercel chamando a API | A origem de preview não entra no CORS; só produção e `localhost`. |

---

## Assumptions & Open Questions

Toda ambiguidade está resolvida ou registrada aqui. `Confirmed? y` = decidido pelo usuário; `n` = default do agente.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Stack web | Vite + React + TypeScript (SPA) | Escolhida pelo usuário; camadas ficam explícitas para o critério 37. | y |
| Hospedagem | Vercel, projeto com root em `web/`, deploy a partir da `main` | Pedido do usuário. | y |
| Como a SPA chega à API | Chamadas diretas do navegador ao gateway com CORS (`CORS_ORIGIN` ganha a origem da Vercel), sem rewrite/proxy da Vercel | O rate limit do gateway é por IP (`rateLimiters.ts`); um proxy da Vercel faria todos os usuários compartilharem o IP e o limite de 10 logins/15 min. | n |
| Armazenamento do token | `sessionStorage`, nunca `localStorage`, cookie legível ou URL; CSP restritiva mitiga XSS | Sem BFF não há cookie `httpOnly`; `sessionStorage` morre com a aba e sobrevive ao reload. | n |
| Fonte de verdade do papel | `GET /api/v1/me` após o login; o claim do JWT não é usado para autorizar na web | O backend decide por claim; a web só reflete, e `/me` é o contrato estável. | n |
| Cadastro do profissional | Auto-cadastro público na web, com nome, e-mail, senha, telefone opcional, CRM e especialidade, sem validar o CRM | Decisão do usuário. O risco (qualquer um vira "profissional") é contido porque sem código de convite do paciente o profissional não vê nenhum dado. | y |
| Papel nunca vem do cliente | O cadastro de paciente continua criando `PATIENT`; `HEALTH_PROFESSIONAL` só nasce na rota própria; `ADMINISTRATOR` só via seed | Evita escalonamento de privilégio por corpo de requisição. | n |
| Admin inicial | Criado por seed (`ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`) quando não existe nenhum `ADMINISTRATOR` | Decisão do usuário (admin via seed). | y |
| O que o admin enxerga | Somente agregados da plataforma e a lista de contas (nome, e-mail, papel, status, data); nenhum dado clínico individual | Princípio do menor privilégio e LGPD. | n |
| Consentimento | O paciente gera um código de convite no **app móvel**; o profissional o informa na web | Decisão do usuário. | y |
| Formato do código | 8 caracteres de um alfabeto sem ambiguidade (sem `0`, `O`, `1`, `I`), validade de 24 h, uso único, no máximo 1 código pendente por paciente | 32^8 combinações mais rate limit tornam força bruta inviável; validade curta limita vazamento. | n |
| Vínculo sem expiração automática | `DashboardAccessGrant.expiresAt` fica nulo; só o paciente revoga | Expirar sozinho cortaria acompanhamento sem aviso; revogação imediata cobre a LGPD. | n |
| Persistência do layout | No servidor, por usuário (`GET/PUT/DELETE /api/v1/preferences/dashboard`) | Decisão do usuário; cobre a rubrica 35c e o uso em vários dispositivos. | y |
| Concorrência do layout | Última escrita vence, sem versionamento | Um layout por pessoa; conflito entre dois dispositivos é raro e de baixo custo. | n |
| Tema | Claro, escuro e sistema; preferência no `localStorage` do navegador | Conveniência por dispositivo; rubrica 35a. | n |
| Biblioteca de gráficos | Escolhida no Design, atrás de um adaptador | Critérios: tamanho de bundle, acessibilidade, suporte a banda/percentil/heatmap. | n |
| Limites das zonas de glicose | `< 54` muito baixa, `54` a `< baixo` baixa, alvo, `> alto` a `250` alta, `> 250` muito alta; o limite inferior de "muito baixa" é `min(54, baixo)` | Consenso internacional de CGM (Battelino 2019); `baixo`/`alto` vêm do limiar do paciente. | n |
| Regra de risco do paciente | ALTO se TIR < 50 % ou tempo `< 54` > 1 %; ATENÇÃO se TIR < 70 %, ou tempo `< 70` > 4 %, ou CV > 36 %; senão OK; "dados insuficientes" se uso do sensor < 70 % | Metas do consenso; regra pura no `domain`, testável. | n |
| Dado desatualizado | Aviso quando a última leitura tem mais de 60 min | CGM envia a cada 5 min; 60 min indica app sem sincronizar. | n |
| Atualização automática | A cada 5 min, só com a aba visível, mais botão "Atualizar" | Evita consumo com aba em segundo plano. | n |
| Fuso dos buckets diários | `tz` opcional na API; sem `tz`, UTC (contrato atual); a web sempre envia o fuso do navegador | Mudança aditiva, sem quebrar clientes existentes; hoje a noite de um paciente em BRT cai no dia seguinte. | n |
| Fórmula do GMI | `3,31 + 0,02392 × média` em todos os clientes; o relatório do app (`0,0296 × média + 2,419`) é corrigido | Backend e app mostram o mesmo paciente com GMIs diferentes. | n |
| Nome do paciente na lista do profissional | Composição no gateway com a auth-service; se a perna falha, mostra iniciais e marca `X-Degraded` | Mesmo padrão de `/me`; os bancos são separados. | n |
| "Dados do aplicativo móvel" | A web só lê o que o app já sincronizou com o backend; não fala com o app | O app empurra por `POST /readings`, `/carbs`, `/insulin`, `/alerts`; a frescura depende da sincronização. | y |
| Limites de qualidade do código da web | Arquivo até 250 linhas, complexidade ciclomática até 10, aninhamento até 3, até 4 parâmetros, duplicação até 3 % | Valores usuais de lint que forçam funções pequenas e coesas sem travar componentes React normais; ajustáveis no Design se algum se mostrar impraticável | n |
| Layout do detalhe do paciente | O detalhe do profissional (`/profissional/pacientes/:id`) usa o layout padrão do paciente e não é personalizável na v1; o layout salvo do profissional vale só para `/profissional` | Um layout salvo por usuário mantém a API simples; personalizar o detalhe pediria uma chave de layout por tela. | n |
| Dia detalhado | Limitado às últimas 14 leituras-dias disponíveis em `GET /readings` (teto de 5000 linhas) | O endpoint devolve as mais recentes (~17 dias); períodos maiores usam só o agregado. | n |
| Sessão do profissional e do admin | Token de 1 h (já é assim); a web renova com `POST /auth/refresh` quando faltam menos de 5 min e há atividade | Evita deslogar a cada hora; paciente mantém 30 dias. | n |

**Open questions:** none - all resolved or logged above.

---

## Catálogo de gráficos (levantamento)

Cada widget é um módulo com `id`, papéis permitidos, tamanhos (S/M/L) e fonte de dados. "Hoje" = o backend já entrega; "Novo" = exige a API de `API-*`.

Regra do catálogo: um widget responde a uma pergunta. Cada KPI é um widget próprio (nunca um grupo de cartões), e todo gráfico é um widget só, mesmo com várias séries. Telas inteiras, como o detalhe de um paciente, são rotas e não entram no catálogo.

Os widgets do paciente (`kpi-*`, `card-freshness`, `chart-*`, `table-excursions`) permitem o papel `PATIENT` e, na rota de detalhe do paciente, o papel `HEALTH_PROFESSIONAL`.

### Paciente (`/paciente`)

| Widget (`id`) | Visual | Pergunta que responde | Fonte | Disponível |
| ------------- | ------ | --------------------- | ----- | ---------- |
| `kpi-tir` | Cartão com meta de 70 % | Quanto tempo no alvo? | `summary.timeInRangePercent` | Hoje |
| `kpi-gmi` | Cartão | Qual o GMI? | `summary.gmiPercent` | Hoje |
| `kpi-mean` | Cartão | Qual a glicose média? | `summary` (média) | Hoje (média via `byDay`) |
| `kpi-cv` | Cartão com meta ≤ 36 % | Quão variável? | `summary.coefficientOfVariationPercent` | Hoje |
| `kpi-sensor-use` | Cartão com meta ≥ 70 % | Há dados suficientes? | `sensorUsePercent` | Novo |
| `card-freshness` | Cartão de status | Os dados estão atualizados? | última leitura | Hoje |
| `chart-trend` | Linha da média diária, banda mín-máx, média móvel de 7 dias, faixa-alvo sombreada | A tendência está melhorando? | `summary.byDay` | Hoje |
| `chart-daily-tir` | Barras de % no alvo por dia | Em que dias saiu do alvo? | `summary.byDay` | Hoje |
| `chart-zones` | Barra empilhada de 5 zonas | Quanto tempo em cada zona? | `zoneDistribution` | Novo |
| `chart-agp` | Perfil ambulatorial: mediana, P25-P75, P5-P95 por hora | Qual o padrão típico do dia? | `agp[]` | Novo |
| `chart-heatmap` | Mapa de calor dia da semana × hora | Quando ocorrem os desvios? | `heatmap[]` | Novo |
| `table-excursions` | Tabela de episódios HIPO/HIPER | Quais episódios sustentados? | `summary.excursions` | Hoje |
| `chart-insulin-type` | Barras (total de U) e contagem por tipo | Quanta insulina e de que tipo? | `summary.insulinByType` | Hoje |
| `chart-alerts-type` | Barras por tipo de alerta | Que alertas mais disparam? | `summary.alertsByType` | Hoje |
| `chart-carbs-insulin` | Barras agrupadas g de carbo e U de insulina por dia | Carbo e insulina andam juntos? | `byDay.carbsGrams/insulinUnits` | Novo |
| `chart-day-detail` | Linha de leituras do dia com marcadores de carbo e insulina | O que aconteceu neste dia? | `/readings`, `/carbs`, `/insulin` | Hoje |

### Profissional de saúde (`/profissional`)

| Widget (`id`) | Visual | Pergunta que responde | Fonte |
| ------------- | ------ | --------------------- | ----- |
| `pro-redeem-code` | Campo de código | Como vinculo um paciente? | `redeem` |
| `pro-kpi-patients` | Cartão | Quantos pacientes acompanho? | `cohort/summary` |
| `pro-kpi-tir` | Cartão com meta de 70 % | Qual o TIR médio da carteira? | `cohort/summary` |
| `pro-kpi-gmi` | Cartão | Qual o GMI médio da carteira? | `cohort/summary` |
| `pro-kpi-hypo` | Cartão | Quantos pacientes tiveram hipo no período? | `cohort/summary` |
| `pro-kpi-stale` | Cartão | Quantos estão sem leitura há mais de 24 h? | `cohort/summary` |
| `pro-patients-table` | Tabela ordenável e filtrável com indicador de risco | Quem precisa de atenção primeiro? | `patients` |
| `pro-tir-by-patient` | Barras empilhadas de zonas por paciente | Como cada paciente se distribui? | `cohort/summary` |
| `pro-risk-scatter` | Dispersão TIR × CV com quadrantes | Quem está fora de meta e instável? | `cohort/summary` |
| `pro-tir-histogram` | Histograma de pacientes por faixa de TIR (< 50, 50-70, ≥ 70) | Quantos estão na meta? | `cohort/summary` |
| `pro-hypo-by-hour` | Barras de episódios de hipo por hora do dia | Quando a carteira tem hipo? | `cohort/summary` |

### Administrador (`/admin`)

| Widget (`id`) | Visual | Pergunta que responde | Fonte |
| ------------- | ------ | --------------------- | ----- |
| `adm-kpi-accounts` | Cartão com o total e a divisão por status | Quantas contas existem? | `admin/overview` |
| `adm-kpi-registrations` | Cartão | Quantos cadastros no período? | `admin/overview` |
| `adm-kpi-active-patients` | Cartão com 24 h e 7 d | Quantos pacientes sincronizam? | `admin/overview` |
| `adm-kpi-grants` | Cartão | Quantos vínculos estão ativos? | `admin/overview` |
| `adm-users-role` | Rosca por papel | Quem usa o sistema? | `admin/overview` |
| `adm-registrations` | Linha de cadastros por dia/semana | A base cresce? | `admin/overview` |
| `adm-active-patients` | Barras cadastrados × ativos | Quantos sincronizam de fato? | `admin/overview` |
| `adm-readings-volume` | Área de leituras ingeridas por dia | Qual o volume de dados? | `admin/overview` |
| `adm-grants` | Linha de vínculos criados por semana | O consentimento está sendo usado? | `admin/overview` |
| `adm-alerts` | Barras de alertas por tipo na plataforma | Que alertas dominam? | `admin/overview` |
| `adm-users-table` | Tabela paginada de contas com filtro de papel e status | Quem são as contas? | `admin/users` |

**Candidatos descartados nesta versão** (ficam registrados, não são requisitos): resposta pós-prandial (exige janelas carbo→pico), comparação entre dois períodos, trilha de auditoria navegável, mapa de adesão por sensor (a sessão do sensor vive só no app).

---

## User Stories

### P1: Login único e acesso por papel ⭐ MVP

**User Story**: Como paciente, profissional ou administrador, quero entrar pelo mesmo formulário e ver só o dashboard do meu papel, para não acessar o que não é meu.

**Why P1**: É o gate do critério 14 (permissões validadas no front e no back) e a base de tudo.

**Acceptance Criteria**:

1. WHEN a pessoa envia e-mail e senha válidos no formulário de login THEN the system SHALL autenticar por `POST /api/v1/auth/login` e ler o papel em `GET /api/v1/me`. `ACC-01`
2. WHEN o papel resolvido é `PATIENT`, `HEALTH_PROFESSIONAL` ou `ADMINISTRATOR` THEN the system SHALL abrir `/paciente`, `/profissional` ou `/admin`, respectivamente. `ACC-02`
3. IF a pessoa abre a rota de dashboard de outro papel THEN the system SHALL redirecionar para o dashboard do seu papel sem renderizar nenhum widget da rota pedida. `ACC-03`
4. WHEN uma pessoa não autenticada abre uma rota de dashboard THEN the system SHALL levar ao login e, após entrar, voltar à rota pedida somente se for um caminho interno da aplicação. `ACC-04`
5. IF a API responde `403` com `code: "FORBIDDEN_ROLE"` THEN the system SHALL exibir "Você não tem acesso a este conteúdo" e não SHALL repetir a chamada. `ACC-05`
6. The system SHALL responder `403 FORBIDDEN_ROLE` em toda rota de dashboard chamada com token de outro papel, independentemente do que a web esconda. `ACC-06`
7. IF o login responde `401` THEN the system SHALL exibir "E-mail ou senha incorretos" e manter o e-mail digitado. `ACC-07`
8. IF o login responde `429` THEN the system SHALL exibir "Muitas tentativas. Tente novamente em alguns minutos." `ACC-08`
9. IF qualquer chamada autenticada responde `401` com `code: "TOKEN_INVALID"` THEN the system SHALL apagar a sessão e voltar ao login com o aviso "Sua sessão expirou. Entre novamente." uma única vez, ainda que várias chamadas falhem juntas. `ACC-09`
10. WHILE a sessão é de `HEALTH_PROFESSIONAL` ou `ADMINISTRATOR`, WHEN faltam menos de 5 minutos para o token expirar e houve interação nos últimos 5 minutos THEN the system SHALL renovar o token por `POST /api/v1/auth/refresh`. `ACC-10`
11. WHEN a pessoa aciona "Sair" THEN the system SHALL apagar o token e todos os dados em memória e voltar ao login. `ACC-11`
12. The system SHALL guardar o token apenas em `sessionStorage`, nunca em `localStorage`, cookie legível por script ou URL. `ACC-12`

**Independent Test**: Entrar com um paciente abre `/paciente`; digitar `/admin` na barra redireciona de volta; `curl` em `/api/v1/dashboard/summary` com token de profissional devolve `403 FORBIDDEN_ROLE`.

---

### P1: Arquitetura limpa verificável (rubrica 37) ⭐ MVP

**User Story**: Como avaliador e como mantenedor, quero ver camadas, padrões e princípios aplicados e checados por ferramenta, para confirmar que o frontend evolui sem acoplamento.

**Why P1**: É a rubrica 37 e condiciona a estrutura de todo o código da web; refatorar depois custa mais.

**Rubrica 37 (frontend).** Critério: "O sistema aplica padrões de projeto, princípios de design e conceitos de arquitetura limpa, promovendo separação de responsabilidades, baixo acoplamento, alta coesão e evolução sustentável do software." Tier máximo: "Aplica 3+ padrões com princípios de design consistentes. Arquitetura alinhada à arquitetura limpa, com separação clara de camadas. Código legível, modular, refatorado e bem justificado." O frontend SHALL cumprir o tier máximo, e cada parte dele tem requisitos mensuráveis:

| Elemento do tier máximo | Evidência exigida | Requisitos |
| ----------------------- | ----------------- | ---------- |
| 3+ padrões com princípios de design consistentes | Quatro padrões nomeados, cada um ligado ao princípio que serve, e as cinco letras do SOLID com ocorrência concreta | `ARQ-09`, `ARQ-10`, `ARQ-14` |
| Arquitetura alinhada à arquitetura limpa, com separação clara de camadas | Quatro camadas, regra de dependência e ciclos checados por ferramenta, composition root único, acoplamento entre features só por interface pública | `ARQ-01` a `ARQ-08`, `ARQ-11`, `ARQ-15` |
| Código legível e modular | Limites de complexidade, profundidade, tamanho de arquivo e parâmetros que falham o CI; TypeScript estrito | `ARQ-12`, `ARQ-16` |
| Código refatorado | Duplicação limitada por ferramenta e refatorações registradas com motivo e commit | `ARQ-17`, `ARQ-19` |
| Código bem justificado | Uma decisão de arquitetura registrada (ADR) para cada escolha estrutural, com alternativas descartadas | `ARQ-18` |
| Evolução sustentável | Teste que acrescenta um widget sem tocar no resto; cobertura mínima nas camadas centrais | `ARQ-10`, `ARQ-13` |

**Acceptance Criteria**:

1. The system SHALL organizar o código de `web/src` em quatro camadas, `domain`, `application`, `infrastructure` e `presentation`, agrupadas por funcionalidade. `ARQ-01`
2. The system SHALL falhar `npm run lint:arch` e o job de CI quando `domain` importar outra camada ou qualquer biblioteca (React, DOM, cliente HTTP, biblioteca de gráficos). `ARQ-02`
3. The system SHALL falhar `npm run lint:arch` quando `application` importar `infrastructure` ou `presentation`, ou quando `presentation` importar `infrastructure` fora do composition root. `ARQ-03`
4. The system SHALL manter em `domain` as entidades e regras puras (papel, layout, definição de widget, zonas de glicose, regra de risco) com testes unitários que rodam sem DOM. `ARQ-04`
5. The system SHALL expor a lógica de aplicação como casos de uso (entrar, carregar dashboard, salvar layout, vincular paciente) que dependem só de interfaces (ports) declaradas em `domain`. `ARQ-05`
6. The system SHALL implementar os ports em `infrastructure` com adaptadores (cliente HTTP, armazenamento de sessão, repositórios por área da API) e converter cada DTO da API em objeto de domínio por um mapper. `ARQ-06`
7. The system SHALL validar em tempo de execução o formato de cada resposta da API na borda de `infrastructure`, de modo que um contrato quebrado falhe ali e não dentro de um componente. `ARQ-07`
8. The system SHALL compor todas as dependências em um único composition root, sem service locator global. `ARQ-08`
9. The system SHALL aplicar e documentar pelo menos quatro padrões nomeados (Repository, Adapter, Registry com Factory para widgets, Strategy para layout padrão por papel) em `docs/architecture/web-dashboard.md`, e para cada um SHALL registrar o arquivo e a linha, o problema que resolve, o princípio de design que serve e a alternativa descartada. `ARQ-09`
10. The system SHALL permitir acrescentar um widget com um módulo novo e uma linha no registro, sem alterar a grade, a página ou outro widget, e SHALL provar isso com um teste que registra um widget falso e o renderiza. `ARQ-10`
11. The system SHALL importar a biblioteca de gráficos somente nos componentes genéricos de gráfico da camada `presentation`. `ARQ-11`
12. The system SHALL compilar com TypeScript em modo `strict`, sem `any` implícito, e passar ESLint sem avisos. `ARQ-12`
13. The system SHALL exigir cobertura de linhas de pelo menos 80 % em `domain` e `application` e falhar o CI abaixo disso. `ARQ-13`
14. The system SHALL documentar em `docs/architecture/web-dashboard.md` uma ocorrência concreta, com `arquivo:linha`, de cada um dos cinco princípios SOLID (responsabilidade única, aberto/fechado, substituição de Liskov, segregação de interfaces, inversão de dependência). `ARQ-14`
15. The system SHALL falhar `npm run lint:arch` quando uma feature importar um arquivo interno de outra feature em vez do seu `index.ts` público, e quando houver dependência circular entre módulos. `ARQ-15`
16. The system SHALL falhar `npm run lint` e o CI quando um arquivo de código (fora dos testes) passar de 250 linhas, ou uma função passar de complexidade ciclomática 10, profundidade de aninhamento 3 ou 4 parâmetros. `ARQ-16`
17. The system SHALL falhar o CI quando a duplicação de código em `web/src` passar de 3 %, medida por `jscpd`. `ARQ-17`
18. The system SHALL registrar em `docs/architecture/web-dashboard.md` uma decisão de arquitetura (contexto, decisão, alternativas descartadas, consequência) para cada escolha estrutural: camadas, estado de servidor, biblioteca de gráficos, estilos e tema, armazenamento do token, arrastar e soltar. `ARQ-18`
19. The system SHALL registrar em `docs/architecture/web-dashboard.md` pelo menos duas refatorações feitas durante a construção, cada uma com o motivo, o que mudou e o hash do commit `refactor:` que a fez com os testes verdes antes e depois. `ARQ-19`

**Independent Test**: Importar `axios`/`react` em um arquivo de `domain/` faz `npm run lint:arch` sair com erro; um arquivo de 251 linhas faz `npm run lint` falhar; `docs/architecture/web-dashboard.md` lista os quatro padrões e as cinco letras do SOLID com `arquivo:linha` válidos, as decisões de arquitetura e as duas refatorações com hash existente no `git log`.

---

### P1: Layout customizável por widgets ⭐ MVP

**User Story**: Como usuário, quero escolher, ordenar, redimensionar e salvar os widgets do meu dashboard, para ver primeiro o que importa para mim.

**Why P1**: Pedido explícito do usuário e rubrica 35c (customização com salvamento).

**Acceptance Criteria**:

1. The system SHALL renderizar cada dashboard a partir de um catálogo tipado em que cada widget declara `id`, título, papéis permitidos, tamanhos permitidos (S, M, L) e fonte de dados. `LAY-01`
2. WHEN a pessoa abre o dashboard sem layout salvo THEN the system SHALL aplicar o layout padrão do seu papel. `LAY-02`
3. WHEN a pessoa ativa "Personalizar" THEN the system SHALL permitir adicionar e remover widgets do catálogo do seu papel. `LAY-03`
4. WHILE o modo "Personalizar" está ativo, WHEN a pessoa arrasta um widget THEN the system SHALL reordená-lo. `LAY-04`
5. WHILE o modo "Personalizar" está ativo, the system SHALL oferecer botões "Mover para antes" e "Mover para depois" operáveis por teclado, equivalentes ao arrastar. `LAY-05`
6. WHILE o modo "Personalizar" está ativo, WHEN a pessoa escolhe um tamanho THEN the system SHALL redimensionar o widget entre os tamanhos que ele declara. `LAY-06`
7. WHEN a pessoa confirma "Salvar" THEN the system SHALL gravar o layout por `PUT /api/v1/preferences/dashboard` e confirmar com "Layout salvo". `LAY-07`
8. WHEN a pessoa entra em outro navegador ou dispositivo THEN the system SHALL carregar o último layout salvo por `GET /api/v1/preferences/dashboard`. `LAY-08`
9. WHEN a pessoa confirma "Restaurar padrão" THEN the system SHALL apagar o layout salvo por `DELETE /api/v1/preferences/dashboard` e reaplicar o padrão do papel. `LAY-09`
10. IF o layout salvo cita um widget que não existe no catálogo ou não pertence ao papel THEN the system SHALL ignorar esse item e renderizar os demais. `LAY-10`
11. IF o `PUT` traz widget fora do catálogo do papel, `id` repetido, tamanho inválido ou mais de 20 widgets THEN the system SHALL responder `400` com `code: "INVALID_LAYOUT"` e não gravar nada. `LAY-11`
12. The system SHALL ler e gravar somente o layout do usuário do token, sem aceitar identificador de usuário no caminho ou no corpo. `LAY-12`
13. IF o salvamento falha THEN the system SHALL manter o layout editado na tela, exibir o erro e permitir tentar de novo. `LAY-13`
14. WHEN a conta é excluída THEN the system SHALL apagar o layout salvo. `LAY-14`
15. IF a fonte de dados de um widget falha THEN the system SHALL mostrar nesse widget uma mensagem de erro com "Tentar novamente" e continuar renderizando os outros. `LAY-15`
16. WHILE um widget carrega, the system SHALL mostrar um esqueleto do tamanho do widget, e WHEN não há dados no período THEN SHALL mostrar o estado vazio com a causa. `LAY-16`

**Independent Test**: Remover dois widgets, mover um, salvar, abrir em outro navegador e ver o mesmo layout; `PUT` com `id` repetido devolve `400 INVALID_LAYOUT`.

---

### P1: Responsivo, acessível e com tema ⭐ MVP

**User Story**: Como usuário de celular, tablet ou desktop, quero o dashboard legível e operável no meu dispositivo, para consultar em qualquer lugar.

**Why P1**: Pedido explícito (responsivo) e rubrica 35b.

**Acceptance Criteria**:

1. The system SHALL dispor a grade de widgets em 1 coluna abaixo de 640 px, 2 colunas de 640 a 1023 px e 4 colunas a partir de 1024 px, com S ocupando 1 coluna, M ocupando 2 e L ocupando a largura total, limitados às colunas disponíveis. `RSP-01`
2. The system SHALL NOT produzir rolagem horizontal da página em larguras de 320 px a 2560 px. `RSP-02`
3. WHILE a largura é menor que 640 px, the system SHALL recolher a navegação em um menu e exibir tabelas com rolagem horizontal interna ao componente. `RSP-03`
4. WHILE a largura é menor que 1024 px, the system SHALL oferecer alvos de toque de pelo menos 44 × 44 px em botões, links e controles de período. `RSP-04`
5. WHEN o contêiner de um gráfico muda de tamanho (rotação, redimensionamento, mudança de tamanho do widget) THEN the system SHALL redesenhar o gráfico para a nova largura. `RSP-05`
6. The system SHALL permitir operar login, filtros, personalização e navegação só com teclado, com foco visível em todo controle. `RSP-06`
7. The system SHALL oferecer em cada gráfico a alternativa "Ver como tabela" com os mesmos dados e um rótulo textual que resume o gráfico para leitores de tela. `RSP-07`
8. The system SHALL manter contraste de pelo menos 4,5:1 para texto e 3:1 para elementos gráficos nos temas claro e escuro. `RSP-08`
9. The system SHALL exibir datas, números e unidades em pt-BR e no fuso do navegador. `RSP-09`
10. WHEN a pessoa escolhe tema claro, escuro ou sistema THEN the system SHALL aplicá-lo na hora e lembrar a escolha no navegador, usando `prefers-color-scheme` como padrão. `RSP-10`
11. The system SHALL atingir pontuação de acessibilidade de pelo menos 90 no Lighthouse para a tela de login e o dashboard do paciente. `RSP-11`

**Independent Test**: Abrir o dashboard em 320, 768 e 1440 px sem barra de rolagem horizontal; percorrer todo o fluxo de personalização com `Tab`/`Enter`/`Espaço`.

---

### P1: Dashboard do paciente com os dados do app ⭐ MVP

**User Story**: Como paciente, quero ver na web o que meu sensor e meus registros do app mostram, em gráficos filtráveis, para entender meu controle glicêmico.

**Why P1**: É o primeiro dashboard completo e cobre os dados que o backend já agrega, fechando a ligação app, API, web.

**Acceptance Criteria**:

1. WHEN o paciente abre o dashboard THEN the system SHALL carregar `GET /api/v1/dashboard/summary` dos últimos 14 dias e renderizar os widgets de KPI e de gráfico. `PAC-01`
2. WHEN o paciente escolhe 7, 14, 30 ou 90 dias THEN the system SHALL recarregar todos os widgets para o período. `PAC-02`
3. WHEN o paciente informa um intervalo personalizado de até 90 dias THEN the system SHALL recarregar todos os widgets para ele. `PAC-03`
4. IF o intervalo personalizado tem início depois do fim ou mais de 90 dias THEN the system SHALL bloquear o envio e exibir "Escolha um período de até 90 dias". `PAC-04`
5. The system SHALL exibir os KPIs de tempo no alvo (meta 70 %), GMI, glicose média e CV (meta até 36 %), cada um com valor e meta. `PAC-05`
6. The system SHALL exibir o gráfico de tendência com média diária, banda mínimo-máximo, média móvel de 7 dias e a faixa-alvo do paciente. `PAC-06`
7. The system SHALL exibir o gráfico de percentual no alvo por dia. `PAC-07`
8. The system SHALL exibir a tabela de episódios de hipo e hiper com início, duração, mínimo e máximo. `PAC-08`
9. The system SHALL exibir insulina total e contagem por tipo, e alertas por tipo. `PAC-09`
10. The system SHALL exibir a distribuição em 5 zonas de glicose, o perfil ambulatorial (AGP) por hora, o mapa de calor dia da semana × hora e os gramas de carboidrato com as unidades de insulina por dia. `PAC-10`
11. WHEN o paciente seleciona um dia dentro das leituras disponíveis THEN the system SHALL exibir a linha de leituras do dia com marcadores de carboidrato e insulina. `PAC-11`
12. The system SHALL exibir o horário da última leitura sincronizada pelo app. `PAC-12`
13. IF a última leitura tem mais de 60 minutos THEN the system SHALL exibir "Sem dados recentes. Abra o aplicativo para sincronizar." `PAC-13`
14. IF não há leituras no período THEN the system SHALL exibir "Sem leituras no período" com a orientação de sincronizar pelo aplicativo. `PAC-14`
15. WHEN o paciente aciona "Atualizar" THEN the system SHALL recarregar os dados mantendo filtro e layout. `PAC-15`
16. WHILE a aba está visível, the system SHALL recarregar os dados a cada 5 minutos, e WHILE a aba está oculta SHALL NOT recarregar. `PAC-16`
17. The system SHALL compartilhar uma única requisição `summary` entre todos os widgets do mesmo período e atualização. `PAC-17`
18. The system SHALL NOT criar, alterar ou apagar leituras, carboidratos, insulina ou alertas. `PAC-18`

**Independent Test**: Com um paciente que sincronizou 14 dias pelo app, abrir `/paciente` e conferir que KPIs, tendência e tabelas batem com o que o app mostra no mesmo período.

---

### P1: Publicação na Vercel ⭐ MVP

**User Story**: Como equipe, queremos a web publicada e protegida na Vercel a partir da `main`, para apresentar e usar o dashboard.

**Why P1**: Sem URL pública a rubrica 15 não tem evidência navegável.

**Acceptance Criteria**:

1. The system SHALL publicar `web/` na Vercel com `npm run build` e saída `dist`, em produção a partir da `main`. `DEP-01`
2. WHEN a URL de qualquer rota da SPA é aberta diretamente THEN the system SHALL servir `index.html` com `200` (rewrite de fallback em `vercel.json`). `DEP-02`
3. The system SHALL enviar cabeçalhos de segurança em todas as respostas: `Content-Security-Policy` (`default-src 'self'`, `connect-src` apenas a origem da API, `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `Permissions-Policy`. `DEP-03`
4. The system SHALL ler a URL da API de `VITE_API_URL` no build e SHALL NOT embutir segredo no bundle. `DEP-04`
5. WHEN uma PR altera `web/` THEN the system SHALL rodar typecheck, ESLint, `lint:arch`, testes com cobertura e build no CI, e a PR SHALL não fundir com qualquer um deles falhando. `DEP-05`
6. The system SHALL manter o JavaScript inicial em até 250 kB comprimido (gzip), com as rotas de dashboard e a biblioteca de gráficos carregadas sob demanda. `DEP-06`
7. WHEN o gateway recebe uma requisição da origem da Vercel THEN the system SHALL responder o preflight permitindo o cabeçalho `Authorization` e as origens listadas em `CORS_ORIGIN`. `DEP-07`

**Independent Test**: A URL de produção abre `/paciente` direto (sem 404), o cabeçalho CSP aparece em `curl -I`, e uma requisição de origem não listada falha no CORS.

---

### P2: Ajustes de backend para os gráficos novos

**User Story**: Como cliente da API, quero zonas, AGP, mapa de calor, uso do sensor e dias no fuso certo, para a web e o app mostrarem os mesmos números.

**Why P2**: Os gráficos novos do catálogo e a consistência com o app dependem disso; o P1 funciona sem eles.

**Acceptance Criteria**:

1. WHERE o parâmetro `tz` (nome IANA) é enviado THEN the system SHALL agrupar `byDay` e o mapa de calor pelo dia local desse fuso, e WHERE `tz` é omitido SHALL usar UTC. `API-01`
2. IF `tz` não é um fuso IANA válido THEN the system SHALL responder `400` com `code: "INVALID_TIMEZONE"`. `API-02`
3. The system SHALL devolver em `summary` o campo `zoneDistribution` com percentuais de muito baixa, baixa, alvo, alta e muito alta, somando 100 com tolerância de 0,01. `API-03`
4. The system SHALL devolver `sensorUsePercent` como leituras ÷ (dias do período × 288) × 100, limitado a 100. `API-04`
5. The system SHALL devolver `agp` com, para cada hora local de 0 a 23, os percentis 5, 25, 50, 75 e 95 e a contagem de leituras, calculados no banco. `API-05`
6. The system SHALL devolver `heatmap` com a glicose média e a contagem para cada par dia da semana × hora local, calculada no banco. `API-06`
7. The system SHALL acrescentar a cada item de `byDay` os campos `carbsGrams` e `insulinUnits`. `API-07`
8. The system SHALL manter todos os campos atuais de `summary` com o mesmo nome e significado, de modo que os novos campos sejam apenas aditivos. `API-08`
9. The system SHALL calcular o GMI como `3,31 + 0,02392 × média` no backend e no relatório do app móvel, com um teste em cada lado sobre a mesma tabela de casos. `API-09`

**Independent Test**: `GET /dashboard/summary?tz=America/Sao_Paulo` coloca uma leitura de 22:00 BRT no dia certo; o GMI do app e da web coincidem para o mesmo paciente.

---

### P2: Cadastro do profissional de saúde

**User Story**: Como profissional de saúde, quero criar minha conta pela web, para começar a acompanhar pacientes sem depender de ninguém.

**Why P2**: Sem conta de profissional não existe o segundo perfil (rubrica 14).

**Acceptance Criteria**:

1. WHEN o profissional envia nome, e-mail, senha, telefone opcional, número de registro (CRM) e especialidade válidos THEN the system SHALL criar a conta com papel `HEALTH_PROFESSIONAL` e o perfil profissional, e responder `201`. `REG-01`
2. The system SHALL exigir senha com 8 ou mais caracteres, com maiúscula, minúscula, dígito e símbolo, na web e no backend, respondendo `400` com `code: "WEAK_PASSWORD"` quando violada. `REG-02`
3. IF o e-mail já existe THEN the system SHALL responder `409` com `code: "EMAIL_TAKEN"`. `REG-03`
4. IF a criação do perfil profissional falha depois de criada a conta THEN the system SHALL remover a conta e responder erro, sem deixar conta sem perfil. `REG-04`
5. IF o número de registro ou a especialidade está vazio, ou passa de 40 e 80 caracteres respectivamente THEN the system SHALL responder `400` e não criar nada. `REG-05`
6. The system SHALL ignorar qualquer campo `role` enviado no corpo; o cadastro público de paciente SHALL continuar criando `PATIENT`. `REG-06`
7. The system SHALL limitar o cadastro profissional a 20 requisições por IP a cada 15 minutos. `REG-07`
8. WHEN uma conta profissional é criada THEN the system SHALL gravar o evento `REGISTER_PROFESSIONAL` na trilha de auditoria, sem senha. `REG-08`
9. WHEN o serviço de identidade sobe e não existe nenhum `ADMINISTRATOR` THEN the system SHALL criá-lo a partir de `ADMIN_SEED_EMAIL` e `ADMIN_SEED_PASSWORD`, sem duplicar em novas subidas. `REG-09`
10. IF a senha do seed não cumpre a política ou as variáveis do seed estão incompletas em produção THEN the system SHALL falhar a subida com mensagem que nomeia a variável, sem registrar a senha em log. `REG-10`

**Independent Test**: Cadastrar profissional na web, entrar e cair em `/profissional`; `curl` de cadastro com `"role":"ADMINISTRATOR"` cria só um `PATIENT` ou um profissional.

---

### P2: Consentimento do paciente pelo app (código de convite)

**User Story**: Como paciente, quero gerar no app um código para meu profissional e poder revogá-lo, para controlar quem vê meus dados.

**Why P2**: É a barreira de privacidade do perfil profissional e o requisito LGPD.

**Acceptance Criteria**:

1. WHEN o paciente toca "Compartilhar com profissional" no app THEN the system SHALL gerar um código de uso único, mostrá-lo com a validade de 24 horas e uma contagem regressiva. `CON-01`
2. The system SHALL gerar o código com 8 caracteres de um alfabeto sem `0`, `O`, `1` e `I`, usando fonte criptograficamente segura. `CON-02`
3. WHEN o paciente gera um novo código THEN the system SHALL invalidar o código pendente anterior, mantendo no máximo um pendente por paciente. `CON-03`
4. WHEN o profissional informa um código válido THEN the system SHALL criar o vínculo com permissão `READ`, marcar o código como usado e responder com o paciente vinculado. `CON-04`
5. IF o código é desconhecido, expirado, já usado ou invalidado THEN the system SHALL responder `400` com `code: "INVALID_INVITE"` e a mesma mensagem "Código inválido ou expirado" em todos os casos. `CON-05`
6. The system SHALL limitar o resgate a 10 tentativas por usuário a cada 15 minutos, respondendo `429` depois disso. `CON-06`
7. IF o profissional resgata um código de um paciente que ele já acompanha THEN the system SHALL responder `200` com o vínculo existente, sem criar outro. `CON-07`
8. The system SHALL listar no app os profissionais vinculados (nome, especialidade, data do vínculo) e permitir revogar cada um. `CON-08`
9. WHEN o paciente revoga um vínculo THEN the system SHALL bloquear de imediato toda leitura desse paciente pelo profissional, com `403` e `code: "NO_ACTIVE_GRANT"`. `CON-09`
10. WHEN um código é gerado, resgatado ou invalidado, ou um vínculo é criado ou revogado THEN the system SHALL gravar o evento na trilha de auditoria com os dois identificadores e sem dado clínico. `CON-10`
11. WHEN a conta do paciente ou do profissional é excluída THEN the system SHALL apagar os códigos pendentes e os vínculos dela. `CON-11`
12. The system SHALL mostrar no app, antes de gerar o código, o que o profissional passa a ver. `CON-12`
13. IF o app está sem rede ao gerar o código THEN the system SHALL exibir "Sem conexão. Conecte-se para gerar o código." e não SHALL exibir código. `CON-13`

**Independent Test**: Gerar o código no app, resgatar na web, ver o paciente na lista, revogar no app e receber `403 NO_ACTIVE_GRANT` na próxima leitura; digitar o mesmo código de novo devolve `INVALID_INVITE`.

---

### P2: Dashboard do profissional de saúde

**User Story**: Como profissional, quero ver minha carteira de pacientes vinculados, com filtros e gráficos que mostrem quem precisa de atenção, para decidir onde agir primeiro.

**Why P2**: É o dashboard gerencial da rubrica 15 e reaproveita os agregados do módulo `dashboard`.

**Acceptance Criteria**:

1. IF o profissional não tem vínculo ativo THEN the system SHALL exibir o estado vazio que explica como obter o código e o campo para informá-lo. `PRO-01`
2. WHEN o resgate do código tem sucesso THEN the system SHALL incluir o paciente na lista sem recarregar a página. `PRO-02`
3. The system SHALL listar cada paciente vinculado com nome, horário da última leitura, TIR, GMI, CV, quantidade de episódios de hipo, quantidade de alertas e indicador de risco no período. `PRO-03`
4. The system SHALL classificar o risco pela regra das Assumptions (ALTO, ATENÇÃO, OK ou dados insuficientes) em uma função pura de `domain` coberta por testes de fronteira. `PRO-04`
5. WHEN o profissional escolhe 7, 14, 30 ou 90 dias THEN the system SHALL recalcular lista e gráficos para o período. `PRO-05`
6. WHEN o profissional filtra por nível de risco ou busca por nome THEN the system SHALL mostrar só os pacientes que atendem ao filtro. `PRO-06`
7. WHEN o profissional ordena por uma coluna THEN the system SHALL reordenar a lista por ela, ascendente e descendente. `PRO-07`
8. WHEN o profissional abre um paciente THEN the system SHALL navegar para `/profissional/pacientes/:id`, que renderiza os widgets do paciente com os dados dele e oferece a volta à carteira. `PRO-08`
9. The system SHALL oferecer como widgets individuais os KPIs da carteira: pacientes vinculados, TIR médio, GMI médio, pacientes com hipo e pacientes sem leitura há mais de 24 horas. `PRO-09`
10. The system SHALL exibir barras empilhadas de zonas por paciente, dispersão TIR × CV com quadrantes, histograma de pacientes por faixa de TIR e episódios de hipo por hora do dia. `PRO-10`
11. The system SHALL calcular os agregados da carteira no banco, restritos aos pacientes com vínculo ativo do profissional do token. `PRO-11`
12. IF o profissional pede dados de um paciente sem vínculo ativo THEN the system SHALL responder `403` com `code: "NO_ACTIVE_GRANT"`. `PRO-12`
13. IF uma chamada responde `NO_ACTIVE_GRANT` para um paciente da lista THEN the system SHALL removê-lo da lista e avisar "O paciente revogou o acesso". `PRO-13`
14. WHEN o profissional lê dados de um paciente THEN the system SHALL gravar na trilha de auditoria o profissional, o paciente e a rota, sem valores de glicose. `PRO-14`
15. IF a busca dos nomes na auth-service falha THEN the system SHALL listar os pacientes com iniciais e marcar a resposta com `X-Degraded`. `PRO-15`
16. The system SHALL paginar a lista de pacientes com 50 por página por padrão e no máximo 200. `PRO-16`

**Independent Test**: Com três pacientes vinculados (um com TIR 40 %), abrir `/profissional`, filtrar por risco ALTO e ver só o de TIR 40 %; revogar um vínculo no app e vê-lo sair da lista.

---

### P3: Dashboard do administrador

**User Story**: Como administrador, quero ver a saúde da plataforma em agregados, para acompanhar adoção e volume sem ver dado clínico de ninguém.

**Why P3**: Completa o terceiro perfil pedido, mas não bloqueia os critérios 14 e 15.

**Acceptance Criteria**:

1. WHEN o administrador abre o dashboard THEN the system SHALL oferecer como widgets individuais as contas totais com a divisão por status, os cadastros no período, os pacientes ativos em 24 h e em 7 dias e os vínculos ativos. `ADM-01`
2. The system SHALL exibir rosca de contas por papel, linha de cadastros por dia ou semana, barras de pacientes cadastrados × ativos, área de leituras ingeridas por dia, linha de vínculos criados por semana e barras de alertas por tipo. `ADM-02`
3. The system SHALL NOT devolver, em nenhuma rota de administrador, leitura, carboidrato, insulina ou alerta de uma pessoa identificável. `ADM-03`
4. WHEN o administrador abre a lista de contas THEN the system SHALL mostrar nome, e-mail, papel, status e data de criação, com filtro por papel e status, busca por nome ou e-mail e página de 25 itens. `ADM-04`
5. The system SHALL responder `403 FORBIDDEN_ROLE` em toda rota de administrador chamada por outro papel. `ADM-05`
6. WHEN o administrador abre a lista de contas THEN the system SHALL gravar o acesso na trilha de auditoria. `ADM-06`
7. WHEN o administrador escolhe 7, 30 ou 90 dias THEN the system SHALL recalcular todos os widgets do período. `ADM-07`

**Independent Test**: Entrar com o admin do seed, ver os contadores batendo com o banco; `curl` em `/api/v1/admin/overview` com token de paciente devolve `403`.

---

## Edge Cases

- IF o gateway está fora do ar ou devolve `503` THEN the system SHALL exibir "Serviço indisponível. Tente novamente em instantes." e manter os dados já carregados na tela.
- IF a API devolve `429` fora do login THEN the system SHALL exibir "Muitas requisições. Aguarde um instante." e SHALL esperar o tempo indicado em `Retry-After` antes de repetir.
- IF a aba fica aberta além da validade do token do profissional sem atividade THEN the system SHALL tratar como sessão expirada no próximo pedido, sem renovar sozinha.
- WHEN o paciente tem milhares de leituras no período de 90 dias THEN the system SHALL desenhar os gráficos a partir de agregados do backend e SHALL NOT baixar todas as leituras.
- IF o período tem menos de 14 dias de dados THEN the system SHALL exibir o GMI com o aviso "Poucos dados no período".
- WHEN duas pessoas diferentes usam o mesmo navegador em sequência THEN the system SHALL NOT mostrar o layout, o cache ou os dados da pessoa anterior.
- IF o paciente muda o limiar de alerta no app THEN the system SHALL refletir os novos limites na faixa-alvo e nas zonas na próxima atualização.
- WHEN o código de convite é digitado em minúsculas ou com espaços THEN the system SHALL normalizar para maiúsculas sem espaços antes de enviar.
- IF a resposta da API não bate com o formato esperado THEN the system SHALL mostrar o erro no widget afetado e SHALL NOT quebrar a página inteira.
- IF um navegador não suporta `sessionStorage` THEN the system SHALL manter a sessão só em memória e avisar que ela se perde ao recarregar.

---

## Requirement Traceability

Cada requisito tem um ID único, citado ao fim do critério correspondente.

<!-- TRACE:BEGIN -->
| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| ACC-01 | P1: Login único e acesso por papel | T29, T30, T33, T34, T43 | Implementing |
| ACC-02 | P1: Login único e acesso por papel | T18, T42 | Implementing |
| ACC-03 | P1: Login único e acesso por papel | T42 | Implementing |
| ACC-04 | P1: Login único e acesso por papel | T30, T42 | Implementing |
| ACC-05 | P1: Login único e acesso por papel | T17, T23, T39, T40 | Implementing |
| ACC-06 | P1: Login único e acesso por papel | - | Pending |
| ACC-07 | P1: Login único e acesso por papel | T23, T29, T43 | Implementing |
| ACC-08 | P1: Login único e acesso por papel | T23, T225, T43 | Implementing |
| ACC-09 | P1: Login único e acesso por papel | T21, T24, T41 | Implementing |
| ACC-10 | P1: Login único e acesso por papel | T25, T28, T32, T33, T44 | Implementing |
| ACC-11 | P1: Login único e acesso por papel | T31, T41, T45 | Implementing |
| ACC-12 | P1: Login único e acesso por papel | T22 | Implementing |
| ARQ-01 | P1: Arquitetura limpa verificável (rubrica 37) | T10 | Implementing |
| ARQ-02 | P1: Arquitetura limpa verificável (rubrica 37) | T12 | Implementing |
| ARQ-03 | P1: Arquitetura limpa verificável (rubrica 37) | T12 | Implementing |
| ARQ-04 | P1: Arquitetura limpa verificável (rubrica 37) | T17, T18, T28, T46 | Implementing |
| ARQ-05 | P1: Arquitetura limpa verificável (rubrica 37) | T20, T28 | Implementing |
| ARQ-06 | P1: Arquitetura limpa verificável (rubrica 37) | T23, T24, T33, T34 | Implementing |
| ARQ-07 | P1: Arquitetura limpa verificável (rubrica 37) | T27, T33 | Implementing |
| ARQ-08 | P1: Arquitetura limpa verificável (rubrica 37) | T35 | Implementing |
| ARQ-09 | P1: Arquitetura limpa verificável (rubrica 37) | T49 | Implementing |
| ARQ-10 | P1: Arquitetura limpa verificável (rubrica 37) | T49, T52 | Implementing |
| ARQ-11 | P1: Arquitetura limpa verificável (rubrica 37) | T13, T57, T58, T59, T60, T61, T62 | Implementing |
| ARQ-12 | P1: Arquitetura limpa verificável (rubrica 37) | T10, T11 | Implementing |
| ARQ-13 | P1: Arquitetura limpa verificável (rubrica 37) | T15, T16 | Implementing |
| ARQ-14 | P1: Arquitetura limpa verificável (rubrica 37) | - | Pending |
| ARQ-15 | P1: Arquitetura limpa verificável (rubrica 37) | T13 | Implementing |
| ARQ-16 | P1: Arquitetura limpa verificável (rubrica 37) | T11, T16 | Implementing |
| ARQ-17 | P1: Arquitetura limpa verificável (rubrica 37) | T14, T16 | Implementing |
| ARQ-18 | P1: Arquitetura limpa verificável (rubrica 37) | - | Pending |
| ARQ-19 | P1: Arquitetura limpa verificável (rubrica 37) | - | Pending |
| LAY-01 | P1: Layout customizável por widgets | T1, T48, T49 | Implementing |
| LAY-02 | P1: Layout customizável por widgets | T48, T51, T54 | Implementing |
| LAY-03 | P1: Layout customizável por widgets | T46 | Implementing |
| LAY-04 | P1: Layout customizável por widgets | T19, T46 | Implementing |
| LAY-05 | P1: Layout customizável por widgets | T46 | Implementing |
| LAY-06 | P1: Layout customizável por widgets | T46 | Implementing |
| LAY-07 | P1: Layout customizável por widgets | T3, T5, T6, T7, T8, T50, T51 | Implementing |
| LAY-08 | P1: Layout customizável por widgets | T5, T6, T7, T8, T50, T51, T54 | Implementing |
| LAY-09 | P1: Layout customizável por widgets | T5, T6, T7, T50, T51 | Implementing |
| LAY-10 | P1: Layout customizável por widgets | T47, T51, T54 | Implementing |
| LAY-11 | P1: Layout customizável por widgets | T1, T2, T4, T7, T50 | Implementing |
| LAY-12 | P1: Layout customizável por widgets | T4, T6, T7 | Implementing |
| LAY-13 | P1: Layout customizável por widgets | - | Pending |
| LAY-14 | P1: Layout customizável por widgets | T3, T5 | Implementing |
| LAY-15 | P1: Layout customizável por widgets | T53 | Implementing |
| LAY-16 | P1: Layout customizável por widgets | T39, T53 | Implementing |
| RSP-01 | P1: Responsivo, acessível e com tema | T52 | Implementing |
| RSP-02 | P1: Responsivo, acessível e com tema | T52 | Implementing |
| RSP-03 | P1: Responsivo, acessível e com tema | T45 | Implementing |
| RSP-04 | P1: Responsivo, acessível e com tema | T36 | Implementing |
| RSP-05 | P1: Responsivo, acessível e com tema | T64 | Implementing |
| RSP-06 | P1: Responsivo, acessível e com tema | T39, T43, T45, T56 | Implementing |
| RSP-07 | P1: Responsivo, acessível e com tema | T56 | Implementing |
| RSP-08 | P1: Responsivo, acessível e com tema | T36, T55 | Implementing |
| RSP-09 | P1: Responsivo, acessível e com tema | T26, T37 | Implementing |
| RSP-10 | P1: Responsivo, acessível e com tema | T36, T38, T45 | Implementing |
| RSP-11 | P1: Responsivo, acessível e com tema | - | Pending |
| PAC-01 | P1: Dashboard do paciente com os dados do app | - | Pending |
| PAC-02 | P1: Dashboard do paciente com os dados do app | - | Pending |
| PAC-03 | P1: Dashboard do paciente com os dados do app | - | Pending |
| PAC-04 | P1: Dashboard do paciente com os dados do app | - | Pending |
| PAC-05 | P1: Dashboard do paciente com os dados do app | - | Pending |
| PAC-06 | P1: Dashboard do paciente com os dados do app | T57 | Implementing |
| PAC-07 | P1: Dashboard do paciente com os dados do app | T58 | Implementing |
| PAC-08 | P1: Dashboard do paciente com os dados do app | - | Pending |
| PAC-09 | P1: Dashboard do paciente com os dados do app | T58 | Implementing |
| PAC-10 | P1: Dashboard do paciente com os dados do app | T59, T61, T63 | Implementing |
| PAC-11 | P1: Dashboard do paciente com os dados do app | - | Pending |
| PAC-12 | P1: Dashboard do paciente com os dados do app | T72 | Implementing |
| PAC-13 | P1: Dashboard do paciente com os dados do app | - | Pending |
| PAC-14 | P1: Dashboard do paciente com os dados do app | - | Pending |
| PAC-15 | P1: Dashboard do paciente com os dados do app | - | Pending |
| PAC-16 | P1: Dashboard do paciente com os dados do app | T40 | Implementing |
| PAC-17 | P1: Dashboard do paciente com os dados do app | - | Pending |
| PAC-18 | P1: Dashboard do paciente com os dados do app | - | Pending |
| DEP-01 | P1: Publicação na Vercel | T10 | Implementing |
| DEP-02 | P1: Publicação na Vercel | - | Pending |
| DEP-03 | P1: Publicação na Vercel | - | Pending |
| DEP-04 | P1: Publicação na Vercel | T10 | Implementing |
| DEP-05 | P1: Publicação na Vercel | T16 | Implementing |
| DEP-06 | P1: Publicação na Vercel | - | Pending |
| DEP-07 | P1: Publicação na Vercel | T9, T225 | Implementing |
| API-01 | P2: Ajustes de backend para os gráficos novos | T26, T65, T67, T73 | Implementing |
| API-02 | P2: Ajustes de backend para os gráficos novos | T65, T66 | Implementing |
| API-03 | P2: Ajustes de backend para os gráficos novos | T68 | Implementing |
| API-04 | P2: Ajustes de backend para os gráficos novos | T69 | Implementing |
| API-05 | P2: Ajustes de backend para os gráficos novos | T70 | Implementing |
| API-06 | P2: Ajustes de backend para os gráficos novos | T71 | Implementing |
| API-07 | P2: Ajustes de backend para os gráficos novos | T73 | Implementing |
| API-08 | P2: Ajustes de backend para os gráficos novos | T67, T73 | Implementing |
| API-09 | P2: Ajustes de backend para os gráficos novos | - | Pending |
| REG-01 | P2: Cadastro do profissional de saúde | - | Pending |
| REG-02 | P2: Cadastro do profissional de saúde | - | Pending |
| REG-03 | P2: Cadastro do profissional de saúde | - | Pending |
| REG-04 | P2: Cadastro do profissional de saúde | - | Pending |
| REG-05 | P2: Cadastro do profissional de saúde | - | Pending |
| REG-06 | P2: Cadastro do profissional de saúde | - | Pending |
| REG-07 | P2: Cadastro do profissional de saúde | - | Pending |
| REG-08 | P2: Cadastro do profissional de saúde | - | Pending |
| REG-09 | P2: Cadastro do profissional de saúde | - | Pending |
| REG-10 | P2: Cadastro do profissional de saúde | - | Pending |
| CON-01 | P2: Consentimento do paciente pelo app (código de convite) | - | Pending |
| CON-02 | P2: Consentimento do paciente pelo app (código de convite) | - | Pending |
| CON-03 | P2: Consentimento do paciente pelo app (código de convite) | - | Pending |
| CON-04 | P2: Consentimento do paciente pelo app (código de convite) | - | Pending |
| CON-05 | P2: Consentimento do paciente pelo app (código de convite) | - | Pending |
| CON-06 | P2: Consentimento do paciente pelo app (código de convite) | - | Pending |
| CON-07 | P2: Consentimento do paciente pelo app (código de convite) | - | Pending |
| CON-08 | P2: Consentimento do paciente pelo app (código de convite) | - | Pending |
| CON-09 | P2: Consentimento do paciente pelo app (código de convite) | - | Pending |
| CON-10 | P2: Consentimento do paciente pelo app (código de convite) | - | Pending |
| CON-11 | P2: Consentimento do paciente pelo app (código de convite) | - | Pending |
| CON-12 | P2: Consentimento do paciente pelo app (código de convite) | - | Pending |
| CON-13 | P2: Consentimento do paciente pelo app (código de convite) | - | Pending |
| PRO-01 | P2: Dashboard do profissional de saúde | - | Pending |
| PRO-02 | P2: Dashboard do profissional de saúde | - | Pending |
| PRO-03 | P2: Dashboard do profissional de saúde | T72 | Implementing |
| PRO-04 | P2: Dashboard do profissional de saúde | - | Pending |
| PRO-05 | P2: Dashboard do profissional de saúde | - | Pending |
| PRO-06 | P2: Dashboard do profissional de saúde | - | Pending |
| PRO-07 | P2: Dashboard do profissional de saúde | - | Pending |
| PRO-08 | P2: Dashboard do profissional de saúde | - | Pending |
| PRO-09 | P2: Dashboard do profissional de saúde | - | Pending |
| PRO-10 | P2: Dashboard do profissional de saúde | T59, T62 | Implementing |
| PRO-11 | P2: Dashboard do profissional de saúde | - | Pending |
| PRO-12 | P2: Dashboard do profissional de saúde | - | Pending |
| PRO-13 | P2: Dashboard do profissional de saúde | - | Pending |
| PRO-14 | P2: Dashboard do profissional de saúde | - | Pending |
| PRO-15 | P2: Dashboard do profissional de saúde | - | Pending |
| PRO-16 | P2: Dashboard do profissional de saúde | - | Pending |
| ADM-01 | P3: Dashboard do administrador | - | Pending |
| ADM-02 | P3: Dashboard do administrador | T60 | Implementing |
| ADM-03 | P3: Dashboard do administrador | - | Pending |
| ADM-04 | P3: Dashboard do administrador | - | Pending |
| ADM-05 | P3: Dashboard do administrador | - | Pending |
| ADM-06 | P3: Dashboard do administrador | - | Pending |
| ADM-07 | P3: Dashboard do administrador | - | Pending |

**Coverage:** 138 total, 0 mapped to tasks, 138 unmapped ⚠️
<!-- TRACE:END -->

**ID format:** `[CATEGORY]-[NUMBER]` (`ACC` acesso, `ARQ` arquitetura, `LAY` layout, `RSP` responsivo, `PAC` paciente, `DEP` deploy, `API` backend, `REG` cadastro, `CON` consentimento, `PRO` profissional, `ADM` admin)

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

---

## Success Criteria

- [ ] A URL de produção na Vercel abre o dashboard certo para cada um dos três papéis e recusa os outros dois.
- [ ] `npm run lint:arch` falha em uma violação injetada e passa no código entregue; os 4 padrões estão documentados com `arquivo:linha`.
- [ ] Um layout salvo em um navegador aparece idêntico em outro.
- [ ] Nenhuma largura de 320 a 2560 px gera rolagem horizontal, e o fluxo de personalização funciona só com teclado.
- [ ] Para um paciente que sincronizou 14 dias pelo app, KPIs e gráficos da web coincidem com os do app no mesmo período, GMI inclusive.
- [ ] Um vínculo revogado no app derruba o acesso do profissional na leitura seguinte.
- [ ] CI verde: typecheck, ESLint, `lint:arch`, testes com cobertura (domain/application ≥ 80 %), build, e os testes do backend e do app afetados.
