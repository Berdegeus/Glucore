# Fases 3–5 do plano arquitetural — Specification

## Problem Statement

As Fases 0–2 do `docs/ARCHITECTURE_FIX_PLAN.md` estão fechadas e verificadas. Restam as Fases 3, 4 e 5, e o levantamento contra o código de 2026-08-27 mostra que elas não estão no estado que o plano descreve: da Fase 3, os itens 3.1 e 3.2 (offline-first, P1/P3) já foram entregues em 2026-07-07 e o que sobra são o rename do auth (P5), a camada `domain/` do feature `patient` (rubrica 37) e o dark mode (rubrica 35); a Fase 4 continua integralmente aberta e é onde mora o risco real de perda de dados do paciente (P4 — identidade por timestamp; P2 — sincronização replace-all, agravada por P27/P28); e a Fase 5 tem um item cuja base evaporou (5.1/P13 aponta para `MockSensorRepository` e `DebugPanel`, revertidos em `f91adea`). Enquanto a Fase 4 não sai, editar duas entradas do mesmo minuto corrompe o diário em silêncio e dois aparelhos logados na mesma conta apagam os dados um do outro.

## Goals

- [ ] Toda entrada de diário (carboidrato, insulina, alerta) passa a ter identidade própria e estável, imune a mudança de horário e a colisão de timestamp.
- [ ] Uma edição no app gera uma operação unitária no backend, não a recriação da coleção inteira; dois aparelhos na mesma conta deixam de se sobrescrever.
- [ ] O histórico deixa de ser truncado em 100 itens: o GET pagina e o banco preserva tudo.
- [ ] As rotas novas nascem em camadas, com índice de paginação verificado e testes automatizados (rubricas 33, 28, 25).
- [ ] O feature `patient` ganha `domain/` no mesmo padrão de `auth` e `sensor` (rubrica 37), e o app ganha tema claro/escuro com preferência persistida (rubrica 35, item a).
- [ ] O código morto catalogado em P12 sai da árvore, e o item 5.1 do plano deixa de apontar para código que não existe.

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Reason |
| ------- | ------ |
| Reintroduzir mock de sensor / painel de debug (P13, item 5.1 do plano) | Decisão do usuário nesta sessão: o item sai do plano por perda de base — `MockSensorRepository` e `DebugPanel` foram revertidos em `f91adea` e não existem em `lib/`. Fica só o registro documental (AD + plano + review). |
| Perfil Profissional de Saúde e dashboard agregado (rubricas 14/15) | Trabalho de produto, fora do plano arquitetural; vive em `docs/tcc-rubric-evolution-plan.md`. Puxa parte da rubrica 28 (agregações), que aqui fica restrita ao índice de paginação. |
| CI/CD (rubrica 39) | Retirado do escopo em 2026-08-20 com motivo técnico registrado (AD-007): os `.so` proprietários são gitignored e nenhum runner limpo produz APK funcional. |
| Prototipação em Figma (24), i18n (36), cobertura de testes frontend (34), acessibilidade (38), cloud/IaC/observabilidade (32/40/41) | Reserva ou trabalho de produto no plano de rubricas; nenhum deles é correção de arquitetura. |
| Itens (b) e (c) da rubrica 35 (build desktop, customização salva por tela) | Só o item (a) — tema claro/escuro — está comprometido; os outros dois são reserva declarada. |
| Leituras de glicose (`readings`) no fluxo por item | São append-only e nunca editadas pelo usuário; continuam no caminho de coleção com debounce, que já funciona. O op-log cobre carbs, insulin e alerts. |
| P20 (401 mata o sync em silêncio), P22 (alerta sem notificação), P23, P24, P26, P29–P35 | Problemas da revisão independente de 2026-07-07, fora do recorte das Fases 3–5. P27 e P28 são tocados apenas na parte que a Fase 4 resolve por consequência — o restante segue aberto no review. |
| Validação em device físico arm64 com sensor real | Exige hardware indisponível neste ambiente; segue como verificação manual pendente das Fases 1–2. |
| Migrar `readings` e `settings` para o op-log | Sem edição unitária, o ganho seria zero e o churn alto. |

---

## Assumptions & Open Questions

Toda ambiguidade está resolvida ou registrada aqui.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Branch de trabalho | `feat/arch-phases-3-5`, criada do HEAD atual de `feat/arch-phases-0-2-gaps` (15 commits à frente da `main`, sem push) | Decisão explícita do usuário nesta sessão. Criar da `main` faria o trabalho enxergar `CLAUDE.md` e docs desatualizados e conflitar no merge. Nenhum `push` sem autorização à parte | y |
| Escopo da iteração | Fases 3, 4 e 5 inteiras num único feature | Decisão explícita do usuário nesta sessão | y |
| Destino do item 5.1 (P13) | Removido do plano; vira AD no `STATE.md`, riscado no `ARCHITECTURE_FIX_PLAN.md` e marcado como resolvido-por-remoção no `ARCHITECTURE_REVIEW.md`. Zero código | Decisão explícita do usuário nesta sessão; o alvo do item não existe mais na árvore | y |
| Identidade das leituras de glicose | `GlucoseReadingItem` não ganha `id`; a PK segue `timestamp_ms` | Leitura é append-only, gerada pelo sensor e nunca editada; um UUID ali seria peso sem uso. O problema de identidade (P4) é de diário, não de leitura | n |
| Geração de UUID | Pacote `uuid` (v4) gerado no app no construtor de criação; entradas vindas do backend usam o id do servidor | É o desenho já registrado na Solução proposta do P4 no review, e o backend já preserva UUIDs enviados pelo cliente | n |
| Migração do SQLite local | Bump de `_dbVersion` com `onUpgrade` aditivo: `ALTER TABLE` para adicionar `id TEXT`, backfill com UUID v4 nas linhas existentes, e recriação da tabela para trocar a PK (`id TEXT PRIMARY KEY`, `time_ms` como coluna indexada) | Mesmo padrão aditivo já exigido no P15 do lado Android; DROP perderia diário do paciente | n |
| Fila de sincronização | Nova tabela `pending_ops(id, entity, entity_id, op, payload_json, created_at)` no `glucore_patient.db`, drenada em ordem de criação; a flag `synced` por linha continua existindo para readings e settings | É o desenho registrado na Solução proposta do P2 no review; op-log é o que torna delete sincronizável — linha apagada não tem onde carregar flag | n |
| Endpoints por item de alertas | Criados nesta iteração (`POST /alerts/item`, `PUT` e `DELETE /alerts/item/:id`), espelhando o que já existe em `/carbs` e `/insulin` | Hoje `alerts.ts` só tem `GET /` e `POST /` de coleção; sem os unitários, alerts não entra no op-log | n |
| Contrato de paginação | `GET` de carbs, insulin e alerts aceita `before` (epoch ms) e `limit`, com `limit` default 100 e máximo 500; chamada sem parâmetros preserva o comportamento atual de 100 mais recentes | Mantém o app atual funcionando durante a migração e evita quebrar o `refreshFromRemote` antes do cliente novo | n |
| Índice de paginação (rubrica 28) | Verificar os índices existentes (`CarbEvent` e `InsulinEvent` já têm `@@index([patientId, eventAt])`; `AlertEvent` tem `@@index([patientId, triggeredAt])`) e só criar migration se faltar algum; documentar a verificação | Inventar índice redundante para cumprir rubrica seria teatro; o critério é que a consulta de paginação seja coberta por índice, não que exista índice novo | n |
| Estrutura em camadas (rubrica 33) | `route → controller → service → repository` aplicada apenas às rotas de carbs, insulin e alerts; `auth`, `readings` e `settings` ficam como estão | O plano diz explicitamente "só nas rotas novas, sem refatorar o resto do backend"; mexer em auth reabriria superfície já verificada | n |
| Testes de rota sem Postgres (rubrica 25) | `supertest` sobre o router Express com o repositório Prisma substituído por um fake em memória, no runner `node:test` já usado pelo backend; cobertura medida com `node --test --experimental-test-coverage`, alvo de 75% de linhas nos módulos novos de carbs, insulin e alerts | Não há Postgres garantido neste ambiente e o backend já roda `node:test` — trazer jest só para isso duplicaria runner. Prometer 75% do backend inteiro incluiria código legado fora do escopo | n |
| Camada `domain/` do patient (rubrica 37) | Entidades saem de `presentation/models/patient_models.dart` para `domain/entities/`; o contrato do repositório vai para `domain/repositories/` com implementação em `data/`; um caso de uso por operação do cubit (adicionar, editar e apagar carboidrato e insulina, atualizar thresholds, limpar leituras, carregar e atualizar dados) | É o padrão já existente em `lib/features/auth/domain/` (entities, repositories, usecases); replicar mantém o app coerente em vez de inventar um terceiro estilo | n |
| Dark mode: como as cores viajam | `ThemeExtension` própria com uma instância clara e uma escura, resolvida por `Theme.of(context)`; as 167 referências estáticas a cores de `AppTheme` em 22 arquivos migram para o lookup por contexto. Os matizes das faixas clínicas são preservados nos dois temas; apenas variantes suaves, tintas de texto e superfícies são recalculadas para contraste | Um `ThemeMode.dark` sobre cores estáticas claras entregaria telas brancas dentro do tema escuro — pior que não ter dark mode. Preservar o matiz clínico é requisito de segurança: a cor da faixa é sinal, não decoração | n |
| Persistência da preferência de tema | `SharedPreferences`, chave `theme_mode` com valores `system`, `light` e `dark`, default `system` | É exatamente o mecanismo já usado para `onboarding_done` em `lib/app.dart:74`; o `SharedPreferences` segue restrito a preferência de UI | n |
| Rename do auth (P5) | `AuthLocalDataSource` passa a `AuthDataSource`, arquivo `auth_local_datasource.dart` passa a `auth_datasource.dart`, sem mudança de comportamento | Rename mecânico registrado na Solução proposta do P5; a interface é implementada só por `RemoteAuthDataSource`, então o nome atual mente | n |
| Poda do fluxo de transmissor (P12) | Remoção da pilha inteira (método de canal, cubit, repository, plataforma, validação de código de barras e estados de sessão correspondentes); a coluna `transmitter_id` do SQLite Android permanece, sem escrita | Nenhum dos três sensores suportados usa transmissor separado; manter a coluna evita migração de banco por causa de código que já não roda | n |
| Poda do payload de warmup (P12) | `WarmupPayload` sai do contrato Kotlin do caminho BLE; o status `warmingUp` do enum Dart e o caminho NFC do Libre 2 permanecem intactos | O payload nunca é emitido pelo BLE (contrato fantasma), mas o Libre 2 emite `warmingUp` de verdade via NFC | n |
| Tabelas Prisma aspiracionais (P12) | Mantidas, anotadas como roadmap no schema | Decisão já registrada no plano ("Manter — custo zero"); drop exigiria migration destrutiva sem ganho | n |
| Deprecação do POST em lote | `POST /carbs`, `/insulin` e `/alerts` de coleção permanecem funcionando e marcados deprecated nesta release, com o app já não os usando para essas três coleções | É o caminho de rollback previsto no item 4.2 do plano; remover no mesmo PR que migra o cliente deixaria a versão anterior do app sem servidor compatível | n |

**Dimensões de requisito implícito (varredura obrigatória — escopo Large/Complex):**

| Dimensão | Resolução |
| -------- | --------- |
| Validação e limites de entrada | SYNC-05 (payload de op ilegível), API-04 (validação de `limit` e `before`), IDENT-06 (id ausente ou malformado vindo do servidor) |
| Falha e falha parcial | SYNC-03 (op falha, fila preservada), SYNC-04 (falha no meio da drenagem não perde as ops seguintes) |
| Idempotência, retry e duplicata | SYNC-06 (reenvio da mesma op produz o mesmo estado final, sem duplicar linha) |
| Fronteiras de auth e rate limit | N/A porque as rotas novas herdam `verifyJwt` e `requireRole('PATIENT')` do router existente, e o rate limit vive só em `/auth` (Fase 0, já entregue); nenhuma rota nova muda fronteira de acesso |
| Concorrência e ordenação | SYNC-02 (ordem de criação), SYNC-07 (edição durante o push não perde a pendência — metade do P28) |
| Ciclo de vida e expiração de dados | API-03 (paginação preserva o histórico completo; nada é truncado nem apagado) |
| Observabilidade | SYNC-08 (op descartada por erro definitivo é logada com entidade, id e motivo) |
| Falha de dependência externa | SYNC-03 cobre o backend fora do ar: a op fica na fila e o app segue funcionando local-first |
| Integridade de transição de estado | IDENT-02 (mudar horário não muda identidade), DEAD-02 (remoção dos estados de transmissor não deixa transição órfã no enum) |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Entradas de diário com identidade estável ⭐ MVP

**User Story**: Como paciente, quero editar ou apagar exatamente a entrada que escolhi, mesmo que ela tenha o mesmo horário de outra, para que meu diário não seja corrompido em silêncio.

**Why P1**: É perda de dados clínicos hoje, não risco teórico: `time_ms` é PRIMARY KEY no SQLite local com `ConflictAlgorithm.replace`, então duas entradas no mesmo milissegundo se sobrescrevem, e a edição casa por timestamp — mudar o horário muda a identidade. Todo o resto da Fase 4 depende disso.

**Acceptance Criteria**:

1. The system SHALL atribuir um `id` UUID v4 a toda entrada de carboidrato, insulina e alerta criada no app.
2. WHEN o usuário edita o horário de uma entrada existente THEN the system SHALL preservar o `id` da entrada.
3. WHEN o usuário apaga uma entrada THEN the system SHALL localizar a linha pelo `id`, não pelo timestamp.
4. WHEN duas entradas de carboidrato são gravadas com o mesmo `time_ms` THEN the system SHALL persistir as duas linhas e mantê-las editáveis de forma independente.
5. WHEN o banco local é aberto numa versão anterior à migração THEN the system SHALL adicionar a coluna `id`, preencher as linhas existentes com UUID v4 e preservar todas as linhas do diário.
6. IF uma entrada chega do backend sem `id` ou com `id` fora do formato UUID THEN the system SHALL gerar um `id` local para ela e persistir a entrada.
7. WHEN o serviço de sincronização marca uma coleção como sincronizada THEN the system SHALL casar as linhas pelo `id`.

**Independent Test**: criar duas entradas de carboidrato com o mesmo horário, editar a primeira mudando o horário e apagar a segunda; o diário mostra exatamente a entrada editada e nenhuma outra some. Reabrir o app com um banco da versão anterior mantém o diário íntegro e com ids preenchidos.

---

### P1: Sincronização por item, sem replace-all

**User Story**: Como paciente com o app em mais de um aparelho, quero que uma edição minha viaje como uma operação isolada, para que um aparelho não apague o que o outro registrou.

**Why P1**: Hoje qualquer alteração dispara `deleteMany` + `createMany` da coleção inteira do paciente (P2), com truncamento em 100 itens; dois aparelhos ativos resultam em last-writer-wins da coleção inteira. É o segundo caminho de perda de dados clínicos.

**Acceptance Criteria**:

1. WHEN o usuário cria, edita ou apaga uma entrada de carboidrato, insulina ou alerta THEN the system SHALL enfileirar uma operação unitária de upsert ou delete na tabela `pending_ops` junto com a gravação local.
2. WHILE existem operações pendentes na fila the system SHALL drená-las em ordem de criação.
3. IF o envio de uma operação falha por rede ou erro do servidor THEN the system SHALL mantê-la na fila e reagendar o push com o backoff já existente.
4. IF uma operação falha no meio da drenagem THEN the system SHALL preservar na fila essa operação e todas as posteriores, sem enviá-las fora de ordem.
5. IF uma operação enfileirada tem entidade desconhecida ou payload ilegível THEN the system SHALL descartá-la e seguir para a próxima, sem travar a fila.
6. WHEN a mesma operação é reenviada após uma resposta perdida THEN the system SHALL produzir o mesmo estado final no backend, sem criar linha duplicada.
7. WHEN o usuário edita uma entrada enquanto um push está em andamento THEN the system SHALL manter a nova pendência enfileirada após o término do push.
8. WHEN uma operação é descartada por erro definitivo THEN the system SHALL registrar log com entidade, identificador da entrada e motivo.
9. WHEN uma operação recebe resposta 2xx THEN the system SHALL removê-la da fila.
10. The system SHALL continuar enviando leituras de glicose e thresholds pelo caminho de coleção existente.

**Independent Test**: em modo avião, criar, editar e apagar entradas; religar a rede e conferir no Postgres que só as linhas afetadas mudaram e que uma segunda sessão logada na mesma conta não perdeu suas entradas.

---

### P1: API por item com histórico paginado

**User Story**: Como paciente com meses de diário, quero que o servidor guarde e devolva tudo o que registrei, para que meu histórico não seja cortado em 100 itens.

**Why P1**: Sem os endpoints unitários de alerta e sem paginação, a história anterior não fecha: o GET trunca em 100 e o POST de coleção descarta o excedente.

**Acceptance Criteria**:

1. WHEN o app chama a criação, atualização ou remoção unitária de um alerta autenticado THEN the system SHALL criar, atualizar ou remover exatamente a linha correspondente do paciente autenticado.
2. IF uma atualização ou remoção unitária referencia um id que não pertence ao paciente autenticado THEN the system SHALL responder 404 sem alterar dado algum.
3. WHEN o app requisita uma página de carboidratos, insulina ou alertas com `before` e `limit` THEN the system SHALL devolver no máximo `limit` entradas anteriores a `before`, em ordem decrescente de horário.
4. IF `limit` não é inteiro entre 1 e 500 ou `before` não é um epoch em milissegundos THEN the system SHALL responder 400 com corpo contendo `error` e `code`.
5. WHEN uma listagem de carboidratos, insulina ou alertas chega sem parâmetros de paginação THEN the system SHALL preservar o comportamento atual de devolver as 100 entradas mais recentes.
6. The system SHALL manter os endpoints de coleção funcionando e marcados como deprecated nesta release.

**Independent Test**: com mais de 100 entradas semeadas, paginar até o fim e conferir que a soma das páginas é igual ao total no banco.

---

### P2: Rotas novas em camadas, indexadas e testadas

**User Story**: Como pessoa mantendo o backend, quero que as rotas por item tenham separação de responsabilidades, índice adequado e testes automatizados, para que a próxima mudança não precise ser verificada no olho.

**Why P2**: Não é MVP funcional — o app funciona sem isso —, mas é o que sustenta as rubricas 33, 28 e 25 e o que impede que a superfície nova envelheça como a antiga.

**Acceptance Criteria**:

1. The system SHALL organizar as rotas de carboidrato, insulina e alerta em rota, controller, service e repository, sem acesso direto ao client Prisma dentro do handler de rota.
2. The system SHALL cobrir criação, edição, remoção, paginação e o cenário de dois aparelhos com testes automatizados executáveis por `npm test`.
3. WHERE o relatório de cobertura é gerado the system SHALL reportar ao menos 75% de linhas cobertas nos módulos de controller, service e repository de carboidrato, insulina e alerta.
4. The system SHALL garantir que a consulta de paginação por paciente e horário seja atendida por índice declarado no schema Prisma.
5. IF a verificação mostrar que algum índice necessário não existe THEN the system SHALL incluir a migration versionada correspondente no mesmo commit.

**Independent Test**: `npm test` passa e o relatório de cobertura mostra os módulos novos acima do limiar.

---

### P2: Camada `domain/` no feature `patient`

**User Story**: Como pessoa desenvolvendo o app, quero que o `patient` tenha entidades e casos de uso como `auth` e `sensor`, para que a regra de negócio pare de morar em `presentation/`.

**Why P2**: Rubrica 37 e coerência arquitetural. Não muda comportamento visível, então não é MVP.

**Acceptance Criteria**:

1. The system SHALL manter as entidades do paciente em `lib/features/patient/domain/entities/`.
2. The system SHALL declarar o contrato do repositório do paciente em `lib/features/patient/domain/repositories/`, com a implementação em `data/`.
3. WHEN o `PatientCubit` executa uma operação de diário, de alerta ou de carga de dados THEN the system SHALL fazê-lo através de um caso de uso do `domain/`, sem chamar o repositório diretamente.
4. The system SHALL preservar o comportamento observável do app após a extração, com a suíte `flutter test` verde.

**Independent Test**: `flutter test` verde e nenhum import de `data/` dentro de `presentation/` para as operações cobertas.

---

### P2: Tema claro e escuro

**User Story**: Como paciente que confere a glicemia de madrugada, quero o app em tema escuro, para não levar um clarão na cara e para a leitura continuar legível.

**Why P2**: Rubrica 35 item (a). Melhora real de uso, mas não é o que impede perda de dados.

**Acceptance Criteria**:

1. WHEN o usuário escolhe o tema escuro nas configurações THEN the system SHALL aplicar o tema imediatamente, sem reiniciar o app.
2. WHEN o app é reaberto THEN the system SHALL restaurar a última preferência de tema escolhida.
3. WHILE a preferência está em `system` the system SHALL seguir o tema do sistema operacional.
4. The system SHALL preservar, no tema escuro, os matizes das faixas clínicas de glicemia usados no tema claro.
5. The system SHALL resolver as cores de superfície e de texto pelo tema ativo em todas as telas do app.

**Independent Test**: alternar para escuro e navegar por monitoramento, histórico, diário e configurações sem encontrar bloco de fundo claro; fechar e reabrir o app com a escolha preservada.

---

### P3: Nomes honestos e árvore sem código morto

**User Story**: Como pessoa lendo este repositório, quero que os nomes descrevam o que a classe faz e que caminhos mortos não existam, para não perder tempo investigando fluxo que nunca roda.

**Why P3**: Higiene. Fecha P5 e o restante de P12 sem alterar comportamento.

**Acceptance Criteria**:

1. The system SHALL nomear o contrato de dados de autenticação como `AuthDataSource`, no arquivo `auth_datasource.dart`, sem mudança de comportamento.
2. The system SHALL remover o fluxo de transmissor — método de canal, cubit, repository, plataforma, validação de código de barras e estados de sessão correspondentes — de todas as camadas.
3. The system SHALL remover `WarmupPayload` do contrato Kotlin do caminho BLE, preservando o status `warmingUp` do enum Dart e o caminho NFC do Libre 2.
4. The system SHALL remover os stubs nativos `saveMatchedDevice`, `getInitialWrite` e `handleNotification` do C++ e as declarações `external` correspondentes no Kotlin.
5. The system SHALL anotar as tabelas Prisma sem rota como roadmap no schema, sem removê-las.
6. WHEN a poda termina THEN the system SHALL manter `flutter analyze`, `flutter test` e o build Android limpos.

**Independent Test**: busca por `submitTransmitter`, `WarmupPayload`, `saveMatchedDevice`, `getInitialWrite` e `handleNotification` não retorna nada em `lib/` e `android/`; os gates continuam verdes.

---

### P3: Plano e review fiéis ao estado real

**User Story**: Como pessoa acompanhando o plano arquitetural, quero que ele não instrua a corrigir código que não existe mais, para que a próxima leitura não gere trabalho fantasma.

**Why P3**: Documentação, custo baixo, mas é o que impede a terceira reincidência do padrão P6.

**Acceptance Criteria**:

1. The system SHALL registrar no `STATE.md` a decisão de remover o item 5.1 (P13) por perda de base, citando o commit de reversão.
2. The system SHALL marcar P13 como resolvido-por-remoção no `ARCHITECTURE_REVIEW.md`, preservando o histórico do diagnóstico.
3. The system SHALL atualizar o `ARCHITECTURE_FIX_PLAN.md` para refletir o estado entregue das Fases 3, 4 e 5 ao fim desta iteração.
4. WHEN um contrato de canal, de API ou de modelo muda nesta iteração THEN the system SHALL atualizar o documento correspondente em `docs/reference/` no mesmo commit.

**Independent Test**: ler o plano do início ao fim sem encontrar item que aponte para código inexistente.

---

## Edge Cases

- IF a migração do banco local falha no meio THEN the system SHALL manter o banco na versão antiga, sem perder linhas do diário.
- IF a fila contém uma operação para uma entrada já apagada no backend THEN the system SHALL tratar 404 na remoção como sucesso e retirar a operação da fila.
- WHEN a paginação recebe `before` anterior à entrada mais antiga THEN the system SHALL responder lista vazia com status 200.
- IF o backend responde 401 durante a drenagem THEN the system SHALL interromper o push e preservar a fila intacta.
- WHEN o tema do sistema muda com o app aberto e a preferência está em `system` THEN the system SHALL acompanhar a mudança.
- WHEN duas operações consecutivas afetam a mesma entrada THEN the system SHALL enviá-las na ordem em que foram criadas.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| IDENT-01 | P1: Entradas com identidade estável | Design | Pending |
| IDENT-02 | P1: Entradas com identidade estável | Design | Pending |
| IDENT-03 | P1: Entradas com identidade estável | Design | Pending |
| IDENT-04 | P1: Entradas com identidade estável | Design | Pending |
| IDENT-05 | P1: Entradas com identidade estável | Design | Pending |
| IDENT-06 | P1: Entradas com identidade estável | Design | Pending |
| IDENT-07 | P1: Entradas com identidade estável | Design | Pending |
| SYNC-01 | P1: Sincronização por item | Design | Pending |
| SYNC-02 | P1: Sincronização por item | Design | Pending |
| SYNC-03 | P1: Sincronização por item | Design | Pending |
| SYNC-04 | P1: Sincronização por item | Design | Pending |
| SYNC-05 | P1: Sincronização por item | Design | Pending |
| SYNC-06 | P1: Sincronização por item | Design | Pending |
| SYNC-07 | P1: Sincronização por item | Design | Pending |
| SYNC-08 | P1: Sincronização por item | Design | Pending |
| SYNC-09 | P1: Sincronização por item | Design | Pending |
| SYNC-10 | P1: Sincronização por item | Design | Pending |
| API-01 | P1: API por item com histórico paginado | Design | Pending |
| API-02 | P1: API por item com histórico paginado | Design | Pending |
| API-03 | P1: API por item com histórico paginado | Design | Pending |
| API-04 | P1: API por item com histórico paginado | Design | Pending |
| API-05 | P1: API por item com histórico paginado | Design | Pending |
| API-06 | P1: API por item com histórico paginado | Design | Pending |
| QUAL-01 | P2: Rotas novas em camadas | Design | Pending |
| QUAL-02 | P2: Rotas novas em camadas | Design | Pending |
| QUAL-03 | P2: Rotas novas em camadas | Design | Pending |
| QUAL-04 | P2: Rotas novas em camadas | Design | Pending |
| QUAL-05 | P2: Rotas novas em camadas | Design | Pending |
| DOMAIN-01 | P2: Camada domain no patient | Design | Pending |
| DOMAIN-02 | P2: Camada domain no patient | Design | Pending |
| DOMAIN-03 | P2: Camada domain no patient | Design | Pending |
| DOMAIN-04 | P2: Camada domain no patient | Design | Pending |
| THEME-01 | P2: Tema claro e escuro | Design | Pending |
| THEME-02 | P2: Tema claro e escuro | Design | Pending |
| THEME-03 | P2: Tema claro e escuro | Design | Pending |
| THEME-04 | P2: Tema claro e escuro | Design | Pending |
| THEME-05 | P2: Tema claro e escuro | Design | Pending |
| DEAD-01 | P3: Nomes honestos e árvore sem código morto | Design | Pending |
| DEAD-02 | P3: Nomes honestos e árvore sem código morto | Design | Pending |
| DEAD-03 | P3: Nomes honestos e árvore sem código morto | Design | Pending |
| DEAD-04 | P3: Nomes honestos e árvore sem código morto | Design | Pending |
| DEAD-05 | P3: Nomes honestos e árvore sem código morto | Design | Pending |
| DEAD-06 | P3: Nomes honestos e árvore sem código morto | Design | Pending |
| PLAN-01 | P3: Plano e review fiéis ao estado real | Design | Pending |
| PLAN-02 | P3: Plano e review fiéis ao estado real | Design | Pending |
| PLAN-03 | P3: Plano e review fiéis ao estado real | Design | Pending |
| PLAN-04 | P3: Plano e review fiéis ao estado real | Design | Pending |

**ID format:** `[CATEGORY]-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 47 requisitos, todos mapeados a uma story; 0 mapeados a tarefas (fase Tasks ainda não executada).

---

## Rastro para o plano e para o review

| Origem | Requisitos |
| ------ | ---------- |
| P4 (review) e item 4.1 do plano | IDENT-01 a IDENT-07 |
| P2 (review) e item 4.2 do plano | SYNC-01 a SYNC-10, API-01 a API-06 |
| P28 (review), metade resolvida por consequência | IDENT-07, SYNC-07 |
| Rubricas 25, 28 e 33, item 4.3 do plano | QUAL-01 a QUAL-05 |
| Rubrica 37 e item 3.4 do plano | DOMAIN-01 a DOMAIN-04 |
| Rubrica 35 item (a) e item 3.5 do plano | THEME-01 a THEME-05 |
| P5 (review) e item 3.3 do plano | DEAD-01 |
| P12 (review) e item 5.2 do plano | DEAD-02 a DEAD-06 |
| P13 (review) e item 5.1 do plano, removido | PLAN-01, PLAN-02 |

---

## Success Criteria

- [ ] Duas entradas de diário criadas no mesmo milissegundo sobrevivem, e editar uma não afeta a outra.
- [ ] Uma edição no app gera exatamente uma requisição unitária ao backend, e nenhuma linha não relacionada é apagada no Postgres.
- [ ] Com duas sessões logadas na mesma conta, o registro de uma não desaparece após a sincronização da outra.
- [ ] Um diário com mais de 100 entradas é recuperável por completo via paginação.
- [ ] `flutter analyze`, `flutter test`, `./gradlew :app:testDebugUnitTest` e `npm test` verdes, com cobertura dos módulos novos do backend em 75% ou mais.
- [ ] O app alterna claro e escuro em tempo real e preserva a escolha entre execuções.
- [ ] `ARCHITECTURE_FIX_PLAN.md` e `ARCHITECTURE_REVIEW.md` descrevem o estado real ao fim da iteração, sem item apontando para código inexistente.
