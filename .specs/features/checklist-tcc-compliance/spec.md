# Conformidade com o Checklist de Avaliação TCC I — Specification

## Problem Statement

A auditoria de 2026-08-03 (`TCC I - Checklist - Avaliacao.md`) avaliou o Glucore v1.1.0 contra os 27 itens do checklist da banca e encontrou 7 itens NOK e 11 PARCIAL. As lacunas concentram-se em higiene de formulário (senha forte, visualizar/confirmar senha, obrigatório vs. opcional), consistência de identidade visual e mensagens, tratamento de erros de banco e autorização por papel. São itens de baixo risco técnico e alto peso na avaliação, e hoje custam nota sem trazer benefício de produto ao usuário.

## Goals

- [ ] Levar a OK os itens 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 3.1, 4.5, 4.8, 4.10, 4.11 e 5.1 do checklist, cada um com evidência rastreável em código.
- [ ] Unificar as regras de senha e as mensagens de usuário em um único ponto por camada (um validador compartilhado no app, o mesmo no backend; um helper de mensagens), eliminando as três formas divergentes de comunicar erro.
- [ ] Não regredir os comportamentos já entregues em v1.1.0: sessão tolerante a offline (P18), isolamento de dados por usuário (P19) e providers de navegação acima do Navigator raiz (P17).

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Reason |
| ------- | ------ |
| 3.2 — 2FA/TOTP (`/auth/mfa/enable\|disable`, segredo, QR code, login em 2 etapas) | Retirado do escopo pelo usuário. Único item que exige novas dependências (otplib/qrcode) e reescrita do fluxo de login; é apenas desejável no checklist. |
| 4.4 — DER por engenharia reversa | Retirado do escopo pelo usuário nesta iteração. |
| 5.2 — Expiração de sessão por inatividade / refresh token | Retirado do escopo pelo usuário nesta iteração. Consequência: `AuthSession.expiresAt`/`isRevoked` continuam sem leitura e o TTL do JWT permanece 30 d. |
| 2.8 — Endereço a partir de CEP | N/A no domínio: não há entidade de endereço no `schema.prisma`. |
| Dashboard web do profissional de saúde | Fora do MVP; `requireRole` é criado e aplicado, mas nenhuma tela de profissional é construída. |
| Trilha de auditoria com UI de consulta | 4.11 pede gravação da trilha; visualizar auditoria no app não é pedido. |

---

## Assumptions & Open Questions

Toda ambiguidade está resolvida ou registrada aqui.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Força de senha exigida | ≥8 caracteres com ao menos 1 maiúscula, 1 minúscula, 1 dígito e 1 caractere não alfanumérico | É a regra escrita no próprio item 2.3 do checklist; nenhuma regra mais estrita foi pedida | y |
| Onde a força é validada | Somente onde a senha é **definida** (cadastro, redefinição por token, troca no perfil), no app e no backend. No login o campo apenas não pode estar vazio | Aplicar força no login bloquearia contas legadas criadas com senha fraca sem oferecer caminho de correção | y |
| Campos opcionais do cadastro | Data de nascimento, peso e telefone são opcionais (espelham `birthDate DateTime?`, `weightKg Decimal?`, `phone String?`); nome, e-mail, senha e faixa alvo são obrigatórios | Item 2.2 exige alinhar a UI à opcionalidade real do modelo; faixa alvo tem default 80–180 e é usada nos alertas | y |
| Máscara de telefone | `(00) 00000-0000`, aceitando 10 ou 11 dígitos, implementada como `TextInputFormatter` local em `lib/core/utils/` | O projeto já resolve máscara de data com `BrazilianDateInputFormatter`; evita nova dependência | y |
| 401 que **não** deve derrubar a sessão | O backend passa a devolver `code` no corpo dos erros de autenticação; o interceptor do Dio só força logout quando `code` é `TOKEN_INVALID`. `PUT /auth/profile` com senha atual errada devolve `INVALID_CURRENT_PASSWORD` | Sem essa distinção, errar a senha atual na troca de senha deslogaria o usuário — regressão pior que o bug corrigido | y |
| Onde `requireRole` é aplicado | Nas rotas de dados do paciente (`/readings`, `/carbs`, `/insulin`, `/alerts`, `/settings`), exigindo papel `PATIENT`; papel lido do banco a cada requisição | Middleware sem uso é código morto e não vira evidência para a banca; ler do banco evita token com papel obsoleto | y |
| Migração da tabela `AuditLog` | SQL de migração escrito à mão em `backend/prisma/migrations/`, no formato do Prisma, aplicável por `prisma migrate deploy`/`dev` | `prisma migrate dev` exige banco acessível, o que não se pode garantir no ambiente de desenvolvimento desta iteração | y |
| Conteúdo gravado na auditoria | `userId`, `entity`, `action`, `entityId?`, `metadata` (JSON sem dados sensíveis), `ipAddress?`, `userAgent?`, `createdAt` | Auditoria nunca pode registrar senha, hash ou token — regra explícita do item 4.1 | y |
| Falha ao gravar auditoria | Não aborta a requisição de negócio: registra `console.error` e segue | Perder a trilha é menos grave que perder um registro de insulina do paciente | y |
| Breakpoint de responsividade | 600 dp: acima disso Diário e Relatórios usam duas colunas e os formulários de auth/perfil ficam centralizados com largura máxima de 560 dp | Valor citado no próprio item 1.3 e alinhado ao limiar tablet do Material | y |
| Item 3.1 (recuperação de usuário) | Resolvido por documentação: registrar em `docs/` que o identificador de login é o e-mail, logo "esqueci meu login" não se aplica | Alternativa (consulta de login por dado alternativo) criaria vetor de enumeração de contas sem benefício ao usuário | y |
| Tabela de status do checklist | O arquivo `TCC I - Checklist - Avaliacao.md` é atualizado no fim, refletindo o novo status de cada item implementado | O checklist é o artefato de avaliação; deixá-lo desatualizado invalida a evidência | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Formulários de senha seguros e legíveis ⭐ MVP

**User Story**: Como paciente criando ou redefinindo minha senha, quero enxergar o que digito, confirmar a senha e receber a regra de força explícita, para não ficar travado num erro genérico nem escolher uma senha frágil.

**Why P1**: Concentra três dos sete itens NOK (2.3, 2.5, 2.6) e é a primeira prioridade da própria auditoria. Uma senha frágil aceita pela API é a falha mais grave da lista.

**Acceptance Criteria**:

1. The system SHALL aceitar como senha nova apenas valores com no mínimo 8 caracteres contendo ao menos uma letra maiúscula, uma minúscula, um dígito e um caractere não alfanumérico.
2. WHEN o usuário submete cadastro, redefinição por token ou troca de senha no perfil com uma senha que viola a regra de força THEN o app SHALL bloquear o envio e exibir a mensagem da regra violada sem chamar a API.
3. IF uma requisição a `POST /auth/register`, `POST /auth/reset-password` ou `PUT /auth/profile` chega com senha que viola a regra de força THEN o backend SHALL responder `400` com corpo `{ "error": "Weak password", "code": "WEAK_PASSWORD" }`.
4. WHEN o usuário toca o ícone de visibilidade de um campo de senha THEN o app SHALL alternar entre texto oculto e texto visível naquele campo, sem afetar os demais campos de senha da tela.
5. The system SHALL apresentar todos os campos de senha do app (login, cadastro, redefinição por token, troca de e-mail e troca de senha) através do mesmo widget `PasswordField`, iniciando ocultos.
6. WHEN o usuário submete cadastro ou redefinição por token com o campo de confirmação diferente do campo de senha THEN o app SHALL bloquear o envio e exibir "As senhas não coincidem".
7. WHILE o campo de senha de definição está em foco ou preenchido, o app SHALL exibir a regra de força como texto auxiliar do campo.
8. IF o usuário submete o login com senha vazia THEN o app SHALL exibir "Campo obrigatório" e não SHALL aplicar a regra de força ao login.

**Independent Test**: Cadastrar com `senha123` é recusado no app com a mensagem da regra; `Senha123!` passa; `curl` com `{"password":"senha123"}` em `/auth/register` devolve 400 `WEAK_PASSWORD`; o ícone de olho revela cada campo isoladamente.

---

### P1: Identidade do usuário e saída visíveis em todas as telas ⭐ MVP

**User Story**: Como paciente, quero ver em qualquer tela do app quem está logado e conseguir sair da conta dali mesmo, para saber que estou na minha conta e encerrar a sessão sem caçar o botão.

**Why P1**: Item 1.2 é NOK — hoje nome só na aba Perfil e logout só em Configurações. É exigência direta do checklist da banca ("todas as telas").

**Acceptance Criteria**:

1. WHILE o usuário está autenticado, o shell do paciente SHALL exibir um cabeçalho com o nome do usuário logado nas quatro abas (Monitor, Diário, Relatórios, Perfil).
2. The system SHALL oferecer, no mesmo cabeçalho, um menu com a ação "Sair da conta".
3. WHEN o usuário aciona "Sair da conta" pelo cabeçalho THEN o app SHALL pedir confirmação em diálogo e, confirmando, chamar `AuthCubit.logout()`.
4. WHILE as páginas empilhadas (histórico, alertas, sensor, configurações, perfil, edição de registros) estão visíveis, cada uma SHALL exibir o nome do usuário logado e a ação de sair na sua própria `AppBar`.
5. IF o nome do usuário ainda não foi carregado do backend THEN o cabeçalho SHALL exibir o rótulo padrão "Paciente Glucore" em vez de espaço vazio.
6. The system SHALL buscar o nome do usuário uma única vez por sessão autenticada e reaproveitá-lo em todas as telas.

**Independent Test**: Logar, percorrer as quatro abas e as páginas empilhadas — em todas o nome aparece no topo e o menu tem "Sair da conta"; acionar a saída em Relatórios volta ao login.

---

### P1: Obrigatório vs. opcional coerente com o modelo ⭐ MVP

**User Story**: Como paciente preenchendo cadastro ou perfil, quero saber quais campos são obrigatórios antes de submeter, e não quero ser barrado num campo que o sistema aceita vazio.

**Why P1**: Item 2.2 é NOK e há divergência real entre camadas: nascimento e peso são opcionais no Prisma e obrigatórios na UI.

**Acceptance Criteria**:

1. The system SHALL sufixar com `*` o rótulo de todo campo obrigatório e com "(opcional)" o rótulo de todo campo opcional nos formulários de cadastro e de perfil.
2. WHEN o usuário submete o cadastro com data de nascimento, peso ou telefone vazios THEN o app SHALL aceitar o envio e o backend SHALL persistir `null` nesses campos.
3. IF a data de nascimento está preenchida com valor não conversível para data válida THEN o app SHALL exibir "Data inválida" e bloquear o envio.
4. IF o peso está preenchido com valor menor ou igual a zero ou não numérico THEN o app SHALL exibir "Informe um valor numérico" e bloquear o envio.
5. The system SHALL tratar nome completo, e-mail, senha e faixa alvo como obrigatórios no app e no backend.
6. WHEN o usuário limpa a data de nascimento, o peso ou o telefone no perfil e salva THEN o backend SHALL gravar `null` no campo correspondente.

**Independent Test**: Cadastrar preenchendo só nome, e-mail, senha e faixa alvo conclui com sucesso e `GET /auth/profile` devolve `birthDate: null` e `weightKg: null`; os rótulos mostram `*` e "(opcional)".

---

### P2: Mensagens de usuário padronizadas

**User Story**: Como paciente, quero que sucesso, aviso e erro tenham sempre a mesma aparência, para reconhecer a gravidade da mensagem sem ler tudo.

**Why P2**: Item 1.4 é PARCIAL — erro é comunicado de três formas diferentes e não existe "warning". Não bloqueia uso, mas é inconsistência visível na banca.

**Acceptance Criteria**:

1. The system SHALL expor um único helper `GlucoreMessenger` com as variantes `info`, `warning`, `error` e `success`.
2. WHEN qualquer tela precisa comunicar informação, aviso, erro ou sucesso ao usuário THEN ela SHALL usar `GlucoreMessenger`, e nenhuma tela SHALL montar `SnackBar` diretamente.
3. The system SHALL diferenciar as variantes por cor de fundo e ícone, usando exclusivamente cores de `AppTheme`.
4. The system SHALL substituir os textos de erro inline vermelhos da tela de recuperação de senha por `GlucoreMessenger.error`.

**Independent Test**: `grep -r "SnackBar(" lib` só encontra a definição dentro de `GlucoreMessenger`; disparar as quatro variantes mostra ícone e cor distintos.

---

### P2: Orientação de preenchimento nos campos

**User Story**: Como paciente, quero uma dica de formato no campo, para não descobrir o formato aceito por tentativa e erro.

**Why P2**: Item 2.1 é PARCIAL — faixa alvo aceita `80-180` sem nenhuma dica na tela.

**Acceptance Criteria**:

1. The system SHALL exibir em faixa alvo o texto auxiliar com o formato aceito e o exemplo `80-180`.
2. The system SHALL exibir a unidade `kg` como dica no campo de peso e `(00) 00000-0000` no campo de telefone.
3. The system SHALL exibir no campo de token de recuperação a dica de que o código chega por e-mail e expira em 6 horas.
4. IF a faixa alvo é submetida fora do formato `min-max` com `min < max` THEN o app SHALL exibir "Use o formato 80-180, com o valor mínimo menor que o máximo".

**Independent Test**: Abrir cadastro e perfil e ler as dicas nos quatro campos; digitar `180-80` na faixa alvo exibe a mensagem de formato.

---

### P2: Telefone com máscara

**User Story**: Como paciente, quero cadastrar meu telefone com máscara, para o valor sair formatado e sem depender de eu digitar pontuação.

**Why P2**: Item 2.7 é PARCIAL — `phone` existe no modelo e na API, mas não tem campo na UI, então não há máscara.

**Acceptance Criteria**:

1. WHILE o usuário digita no campo de telefone, o app SHALL formatar progressivamente a entrada como `(00) 00000-0000`, descartando caracteres não numéricos.
2. The system SHALL enviar ao backend apenas os dígitos do telefone e SHALL exibir o valor recebido do backend já formatado.
3. IF o telefone é submetido preenchido com menos de 10 dígitos THEN o app SHALL exibir "Telefone incompleto" e bloquear o envio.
4. WHEN o telefone é submetido vazio THEN o app SHALL enviar `null` e o backend SHALL aceitar.

**Independent Test**: Digitar `11987654321` no cadastro produz `(11) 98765-4321` na tela; `GET /auth/profile` devolve `11987654321`; reabrir o perfil mostra o valor formatado.

---

### P2: Erros de banco com mensagem específica

**User Story**: Como paciente, quero saber se o problema foi "esse dado já existe" ou "o servidor está indisponível", para saber se devo corrigir o formulário ou tentar mais tarde.

**Why P2**: Item 4.5 é PARCIAL — nenhuma rota mapeia códigos do Prisma; constraint violada e banco fora do ar chegam com a mesma mensagem vaga.

**Acceptance Criteria**:

1. IF uma rota lança `PrismaClientKnownRequestError` com código `P2002` THEN o backend SHALL responder `409` com `{ "error": "Duplicate record", "code": "DUPLICATE_RECORD" }`.
2. IF uma rota lança `PrismaClientKnownRequestError` com código `P2003` ou `P2025` THEN o backend SHALL responder `409` com código `RELATED_RECORD_MISSING` e `404` com código `RECORD_NOT_FOUND`, respectivamente.
3. IF uma rota lança `PrismaClientInitializationError` ou erro `P1001`/`P1002` THEN o backend SHALL responder `503` com `{ "error": "Database unavailable", "code": "DATABASE_UNAVAILABLE" }`.
4. The system SHALL manter a resposta `500` genérica, sem stack em produção, para qualquer erro não classificado.
5. WHEN o app recebe `503` com código `DATABASE_UNAVAILABLE` THEN SHALL exibir "Serviço temporariamente indisponível. Tente novamente em alguns minutos." em vez da mensagem genérica de servidor.
6. The system SHALL registrar em log o código Prisma e a rota de origem de todo erro classificado.

**Independent Test**: Chamar `/auth/register` duas vezes com o mesmo e-mail em corrida devolve 409 `DUPLICATE_RECORD`; subir o backend com `DATABASE_URL` inválida e chamar `/readings` devolve 503 `DATABASE_UNAVAILABLE`, e o app mostra a mensagem de indisponibilidade.

---

### P2: Tela dedicada de troca de senha

**User Story**: Como paciente, quero trocar a senha numa tela só disso, para não confundir o botão de salvar dados de saúde com o de salvar senha.

**Why P2**: Itens 4.10 (PARCIAL) e 4.8 (PARCIAL) — hoje três formulários convivem em `ProfileEditPage` e nenhum dado é apresentado como imutável.

**Acceptance Criteria**:

1. The system SHALL oferecer a troca de senha em uma rota dedicada `ChangePasswordPage`, alcançada a partir do perfil.
2. WHEN a troca de senha é concluída com sucesso THEN o app SHALL fechar a tela dedicada e exibir "Senha atualizada com sucesso." na tela de origem.
3. IF a senha atual informada está incorreta THEN o app SHALL permanecer na tela dedicada, exibir "Senha atual incorreta." e manter a sessão ativa.
4. The system SHALL exibir na tela de perfil, em modo somente leitura e visualmente distinto dos campos editáveis, o e-mail atual da conta e a data de criação da conta.
5. The system SHALL manter os três campos de senha vazios ao abrir a tela dedicada.
6. The system SHALL remover o formulário de senha de `ProfileEditPage`, deixando lá apenas dados de saúde e troca de e-mail.

**Independent Test**: Perfil → "Alterar senha" abre tela própria; senha atual errada mantém o usuário logado na tela com o erro; sucesso volta ao perfil com a mensagem; e-mail e data de criação aparecem como somente leitura.

---

### P2: Autorização por papel e sessão inválida tratada

**User Story**: Como paciente, quero ser levado de volta ao login quando meu token não vale mais, em vez de ver um erro solto na tela; e como responsável pelo sistema, quero que rotas de dados só aceitem o papel correto.

**Why P2**: Item 5.1 é PARCIAL — `UserRole` existe mas nenhuma rota verifica papel, e não há interceptor de 401 no Dio.

**Acceptance Criteria**:

1. The system SHALL expor um middleware `requireRole(...roles)` que resolve o papel do usuário autenticado no banco a cada requisição.
2. IF um token válido de usuário cujo papel não está na lista permitida chama uma rota protegida por `requireRole` THEN o backend SHALL responder `403` com `{ "error": "Forbidden", "code": "FORBIDDEN_ROLE" }`.
3. The system SHALL proteger `/readings`, `/carbs`, `/insulin`, `/alerts` e `/settings` com `requireRole('PATIENT')`.
4. IF `verifyJwt` rejeita a requisição por token ausente, inválido ou expirado THEN o backend SHALL responder `401` com `{ "error": ..., "code": "TOKEN_INVALID" }`.
5. WHEN o `ApiClient` recebe uma resposta `401` com código `TOKEN_INVALID` THEN SHALL apagar o token armazenado e sinalizar expiração de sessão uma única vez, ainda que várias requisições falhem juntas.
6. WHEN a expiração de sessão é sinalizada THEN o app SHALL voltar para a tela de login exibindo o aviso "Sua sessão expirou. Entre novamente.".
7. IF a resposta `401` traz o código `INVALID_CURRENT_PASSWORD` THEN o app SHALL manter a sessão ativa e apenas exibir o erro na tela atual.
8. WHILE o backend está inacessível (erro de conexão, sem resposta HTTP), o app SHALL manter a sessão, preservando o comportamento offline do P18.

**Independent Test**: Adulterar o token no secure storage e abrir o app: cai no login com o aviso de sessão expirada; errar a senha atual na troca de senha mantém a sessão; desligar o backend mantém o usuário logado.

---

### P3: Trilha de auditoria persistida

**User Story**: Como responsável pelo sistema, quero um registro de quem alterou o quê e quando, para auditar mudanças em dados clínicos.

**Why P3**: Item 4.11 é PARCIAL — existe rastro só em `console.log`; nada é gravado para carboidrato, insulina ou limiares. Não afeta o usuário final.

**Acceptance Criteria**:

1. The system SHALL persistir uma tabela `AuditLog` com `id`, `userId`, `entity`, `action`, `entityId?`, `metadata?`, `ipAddress?`, `userAgent?` e `createdAt`.
2. WHEN uma rota de escrita de `/carbs`, `/insulin`, `/alerts` ou `/settings/alerts` conclui com sucesso THEN o backend SHALL gravar um registro de auditoria com o `userId` autenticado, a entidade e a ação executada.
3. WHEN cadastro, login, pedido de recuperação de senha, redefinição de senha ou atualização de perfil concluem com sucesso THEN o backend SHALL gravar o registro de auditoria correspondente.
4. The system SHALL NUNCA gravar senha, hash de senha ou token de recuperação em `metadata`.
5. IF a gravação da auditoria falha THEN o backend SHALL registrar o erro em log e SHALL concluir a requisição de negócio normalmente.

**Independent Test**: Salvar uma insulina e consultar `AuditLog` no banco: existe linha com `entity='InsulinEvent'`, `action='REPLACE'` e o `userId` correto; nenhuma linha contém campo de senha.

---

### P3: Identidade visual e responsividade consistentes

**User Story**: Como avaliador, quero ver cores, textos e layout vindos de fontes únicas e o app se adaptando a telas maiores, para confirmar que existe um padrão e não decisões pontuais por tela.

**Why P3**: Itens 1.1 e 1.3 são PARCIAL — restam textos e cores hardcoded, e não há nenhum breakpoint no app.

**Acceptance Criteria**:

1. The system SHALL obter de `AppLocalizations` todo texto exibido ao usuário nos três arquivos apontados pela auditoria (`monitoring_home_page.dart`, `profile_page.dart`, `settings_page.dart`) e em todo texto novo introduzido por esta feature.
2. The system SHALL obter toda cor usada em UI de `AppTheme`, sem nenhuma ocorrência de `Colors.red` ou `Colors.green` em `lib/`.
3. WHILE a largura disponível é maior que 600 dp, Diário e Relatórios SHALL dispor seu conteúdo em duas colunas.
4. WHILE a largura disponível é maior que 600 dp, os formulários de login, cadastro, perfil e troca de senha SHALL ficar centralizados com largura máxima de 560 dp.
5. WHILE a largura disponível é de 600 dp ou menos, todas as telas SHALL manter o layout de coluna única atual.
6. The system SHALL pedir confirmação antes da ação destrutiva "Limpar dados" do painel de debug.

**Independent Test**: `flutter analyze` limpo; rodar em landscape/tablet mostra Diário e Relatórios em duas colunas e formulários centralizados; em telefone retrato nada muda; "Limpar dados" abre confirmação.

---

## Edge Cases

- IF o usuário já cadastrado tem senha fraca (criada antes desta mudança) THEN o sistema SHALL permitir o login normalmente e SHALL exigir a regra de força somente quando ele definir uma nova senha.
- IF o nome do usuário não pode ser carregado por falha de rede THEN o cabeçalho SHALL exibir "Paciente Glucore" e SHALL manter a ação de sair funcional.
- IF várias requisições recebem `401 TOKEN_INVALID` simultaneamente THEN o app SHALL executar o logout uma única vez, sem empilhar telas de login.
- WHEN o telefone recebido do backend tem 10 dígitos THEN o app SHALL formatá-lo como `(00) 0000-0000`.
- IF o campo de confirmação de senha é preenchido antes do campo de senha THEN a validação SHALL comparar os valores no submit, não durante a digitação do primeiro campo.
- IF a coluna `AuditLog` ainda não existe no banco (migração não aplicada) THEN a rota de negócio SHALL concluir com sucesso e o erro de auditoria SHALL aparecer apenas em log.
- WHEN a faixa alvo é enviada com espaços (`80 - 180`) THEN o app SHALL aceitar e normalizar.

---

## Requirement Traceability

| Requirement ID | Story | Checklist | Phase | Status |
| -------------- | ----- | --------- | ----- | ------ |
| TCC-01 | P1: Formulários de senha seguros | 2.3 | Tasks | Verified (limite de 8 asserido nos dois lados — Fix 1, T33) |
| TCC-02 | P1: Formulários de senha seguros | 2.5 | Tasks | Verified (campo de troca de e-mail migrado — Fix 3, T34) |
| TCC-03 | P1: Formulários de senha seguros | 2.6 | Tasks | Verified |
| TCC-04 | P1: Identidade do usuário e saída | 1.2 | Tasks | Verified (ressalva: `libre_nfc_page.dart` — Fix 5) |
| TCC-05 | P1: Obrigatório vs. opcional | 2.2 | Tasks | Verified |
| TCC-06 | P2: Mensagens padronizadas | 1.4 | Tasks | ❌ Needs Fix (P2 AC2 — Fix 2) |
| TCC-07 | P2: Orientação de preenchimento | 2.1 | Tasks | Verified |
| TCC-08 | P2: Telefone com máscara | 2.7 | Tasks | Verified |
| TCC-09 | P2: Erros de banco específicos | 4.5 | Tasks | Verified |
| TCC-10 | P2: Tela dedicada de troca de senha | 4.10 | Tasks | Verified |
| TCC-11 | P2: Tela dedicada de troca de senha | 4.8 | Tasks | Verified |
| TCC-12 | P2: Autorização por papel | 5.1 | Tasks | Verified |
| TCC-13 | P3: Trilha de auditoria | 4.11 | Tasks | Verified |
| TCC-14 | P3: Identidade visual e responsividade | 1.1 | Tasks | ❌ Needs Fix (P3 AC1 texto novo — Fix 4; AC2 global — Fix 5) |
| TCC-15 | P3: Identidade visual e responsividade | 1.3 | Tasks | Verified |
| TCC-16 | P3: Identidade visual e responsividade | 4.6 (obs) | Tasks | Descoped |
| TCC-17 | P2: Erros de banco específicos | 2.4 (rede de segurança) | Tasks | Verified |
| TCC-18 | Documentação | 3.1 | Tasks | Verified |

**ID format:** `TCC-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified · Descoped (requisito cujo alvo deixou de existir no código, ver T30 em `tasks.md`)

**Coverage (após verificação independente, 2026-08-17 — ver `validation.md`):** 18 total · 12 verified · 2 verified com ressalva (TCC-01, TCC-04) · **3 needs fix (TCC-02, TCC-06, TCC-14)** · 1 descoped (TCC-16 — target file removed by an earlier revert). Todas as 32 tarefas concluídas (T30 descoped), mas 3 ACs não cumpridos e 2 mutantes sobreviventes. Verdict: **FAIL** — 5 fix tasks em `validation.md`.

\* **TCC-06 (item 1.4):** `GlucoreMessenger` existe como fonte única (`lib/features/patient/presentation/widgets/glucore_messenger.dart:29-41`) e está em uso em login, cadastro, redefinição de senha por token e troca de senha/perfil. AC2 do spec ("nenhuma tela SHALL montar `SnackBar` diretamente") não está 100% cumprido: `insulin_entry_page.dart`, `carb_entry_page.dart`, `insulin_edit_page.dart`, `carb_edit_page.dart`, `alert_settings_page.dart`, `add_observation_sheet.dart` e `libre_nfc_page.dart` ainda chamam `ScaffoldMessenger`/`SnackBar` diretamente — essas telas nunca fizeram parte do escopo de T15–T29 (que tocaram apenas telas de autenticação e perfil). Ver checklist item 1.4 para o detalhe.

† **TCC-14 (item 1.1):** os três arquivos apontados pela auditoria original (`monitoring_home_page.dart`, `profile_page.dart`, `settings_page.dart`) estão livres de `Colors.red`/`Colors.green` e de texto hardcoded (T27, T28). O AC2 do spec, mais amplo ("sem nenhuma ocorrência de `Colors.red` ou `Colors.green` em `lib/`"), não é atingido globalmente: `carb_edit_page.dart:96,193`, `insulin_edit_page.dart:89,159`, `sensor_link_page.dart:68,280,376,426`, `glucose_chart.dart:62,66,121`, `libre_nfc_page.dart:115,154` e `lib/l10n/localized_values.dart:87` ainda usam essas cores — fora do escopo desta iteração, que mirava só os três arquivos citados pela banca.

---

## Success Criteria

- [ ] `flutter analyze` sem novos avisos e `flutter test --no-pub` verde.
- [ ] `npx tsc --noEmit` e a suíte de testes do backend verdes.
- [ ] Os 16 itens em escopo do checklist passam a **OK**, com o arquivo `TCC I - Checklist - Avaliacao.md` atualizado e evidência apontando arquivo:linha.
- [ ] Nenhuma senha que viole a regra de força é aceita por `/auth/register`, `/auth/reset-password` ou `PUT /auth/profile`.
- [ ] Nome do usuário e ação de sair alcançáveis em 100% das telas autenticadas.
- [ ] Os testes de regressão de P17/P18/P19 existentes continuam passando.
