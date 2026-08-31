# TCC I — Checklist de Aplicação: avaliação do Glucore

Data da auditoria original: 2026-08-03 · Branch `docs/v1.1.0` · Versão do app: v1.1.0

Reavaliação: 2026-08-16 · Branch `feat/tcc-checklist-compliance` (entrega da feature
`.specs/features/checklist-tcc-compliance/`) · Evidência com `arquivo:linha` real, conferida
nesta reavaliação — não copiada da rodada anterior.

Reavaliação 2 (pós fix round): 2026-08-17 · após o Verifier independente reportar FAIL na
primeira passagem (5 gaps + 2 mutantes sobreviventes, ver `.specs/features/checklist-tcc-compliance/validation.md`)
e a rodada de correção (T33–T37) fechar todos eles, confirmada por uma segunda verificação
independente (PASS). Item 1.4 e a ressalva de 1.1 abaixo refletem esse estado final.

Legenda: **OK** = atende · **PARCIAL** = atende em parte, falta cobertura · **NOK** = não atende · **N/A** = não se aplica ao domínio.

Resumo: **22 OK · 0 PARCIAL · 4 NOK · 1 N/A** (27 itens).

Atualização 2026-08-24: o item **1.2 regrediu de OK para NOK por decisão de produto** — o widget de identidade/logout foi removido do cabeçalho a pedido do usuário e o logout passou a existir apenas em Configurações. Não é lacuna técnica: é escopo retirado conscientemente, com a consequência registrada na linha do item.

---

## 1. Front End — Identidade visual única

| # | Requisito | Status | Evidência | Ação para virar OK |
|---|---|---|---|---|
| 1.1 | Mesmo padrão de cores, fontes, imagens e ícones | **OK** | `lib/core/theme/app_theme.dart` centraliza paleta, `ThemeData` Material 3, fonte via `google_fonts`. Os três arquivos apontados pela auditoria original foram migrados: `monitoring_home_page.dart` (41 usos de `l10n.*`, ex. `entryDeleteConfirmTitle`/`entryDeleteConfirmMessage` em `monitoring_home_page.dart:55-56,109-110`, cores por `AppTheme.zoneLowBg`/`zoneTargetBg` em `monitoring_home_page.dart:40,64,118,291,354,479`), `profile_page.dart` (l10n em `profile_page.dart:42,44,64,132…`) e `settings_page.dart` (l10n em `settings_page.dart:31,36,39,40…`). Após a rodada de correção (T37), a checagem foi ampliada de "3 arquivos" para "todo `lib/`": `grep -rn "Colors\.red\|Colors\.green" lib` retorna **zero ocorrências** em todo o app — as 14 ocorrências residuais em `carb_edit_page.dart`, `insulin_edit_page.dart`, `sensor_link_page.dart`, `glucose_chart.dart`, `libre_nfc_page.dart` e `lib/l10n/localized_values.dart` foram migradas para `AppTheme` (`zoneLowBg` para erro/destrutivo, `zoneTargetBg` para sucesso), preservando o significado semântico de cada uso — confirmado por reverificação independente. | — |
| 1.2 | Todas as telas exibem usuário logado (nome, perfil) e opção de logout | **NOK** | **Regrediu por decisão de produto em 2026-08-24.** O `UserAppBar` exibia o nome autenticado e um menu com "Sair da conta" nas 18 telas; o widget foi removido do cabeçalho a pedido do usuário, que considerou o componente fora do padrão estético do app. Hoje `user_app_bar.dart` só repassa `title`/`actions` da tela, sem identidade nem ação de conta. O logout continua funcionando, mas **apenas em Configurações** (`settings_page.dart:88-118`), com diálogo de confirmação e chamada a `AuthCubit.logout()` — cobertura movida para `settings_profile_l10n_test.dart` (caminhos confirmar e cancelar). O nome do usuário segue visível somente na aba Perfil (`profile_page.dart:39-40`). Guardas de regressão em `user_app_bar_test.dart`, `shell_tabs_user_app_bar_test.dart` e `stacked_pages_user_app_bar_test.dart` agora afirmam a **ausência** de ações de conta no cabeçalho. | Reintroduzir a identidade no cabeçalho (nome do usuário) e uma opção de logout acessível de qualquer tela — decisão de produto pendente, não lacuna técnica. |
| 1.3 | Todas as telas permitem algum grau de responsividade | **OK** | `GlucoreFormLayout` (`lib/features/patient/presentation/widgets/glucore_form_layout.dart:8-20`) centraliza formulários em 560 dp acima do breakpoint de 600 dp (`breakpoint = 600` em `glucore_form_layout.dart:11`) e é usado em login, cadastro, redefinição de senha, perfil e troca de senha. Diário e Relatórios ganharam layout de duas colunas acima de 600 dp (`diary_page.dart`, `reports_page.dart`, tarefa T29), mantendo coluna única abaixo do limite (limite testado como inclusivo — 600 dp exato ainda é coluna única). | — |
| 1.4 | Mensagens ao usuário no mesmo padrão (info / warning / error) | **OK** | `GlucoreMessenger` existe como fonte única com as 4 variantes (`lib/features/patient/presentation/widgets/glucore_messenger.dart:29-41`), diferenciadas por cor/ícone de `AppTheme`. Após T35 (rodada de correção), os 7 arquivos que ainda montavam `SnackBar` diretamente foram migrados: `alert_settings_page.dart:85,102`, `add_observation_sheet.dart:83,93`, `carb_entry_page.dart:116`, `carb_edit_page.dart:72,101`, `insulin_edit_page.dart:79,108`, `insulin_entry_page.dart:144` e `libre_nfc_page.dart:57`. `grep -rn "SnackBar(" lib` confirma que a única definição de `SnackBar(` em todo o app está dentro de `glucore_messenger.dart:52` — nenhuma tela monta `SnackBar` fora do helper. | — |

## 2. Front End — Validação de dados

| # | Requisito | Status | Evidência | Ação para virar OK |
|---|---|---|---|---|
| 2.1 | Campos de entrada orientam o preenchimento | **OK** | Dicas adicionadas: faixa alvo (`register_page.dart:184`, `profile_edit_page.dart:282`, `profileTargetRangeHelper`), peso em kg (`register_page.dart:170`, `profile_edit_page.dart:254`, `profileWeightHint`), telefone (`register_page.dart:141`, `profile_edit_page.dart:269`, `genericPhoneHint`), senha (`register_page.dart:200`, `forgot_password_page.dart:184`, `passwordPolicyHint`) e token de recuperação com validade de 6 h (`forgot_password_page.dart:170`, `forgotPasswordTokenHint`). Faixa alvo fora do formato `min-max` exibe `profileTargetRangeFormatError` ("Use o formato 80-180, com o valor mínimo menor que o máximo") — `register_page.dart:189`, `profile_edit_page.dart:286`. | — |
| 2.2 | Campos indicam se são ou não obrigatórios | **OK** | `fieldLabel()` (`lib/core/utils/field_label.dart`) sufixa `*`/"(opcional)" e é usado em 8 campos de `register_page.dart:103-206`. No backend, nascimento/peso/telefone continuam opcionais via `parseOptionalDate`/`parseOptionalNumber`/`optionalText` (`backend/src/routes/auth.ts:71,78,108`), persistindo `null` quando vazios (`auth.ts:144,149,151`). | — |
| 2.3 | Aceita apenas senhas fortes (≥8, maiúscula, minúscula, número, especial) | **OK** | Regra única em `lib/core/validation/password_policy.dart` (app) e `backend/src/lib/passwordPolicy.ts:23-29` (backend), ambas com as mesmas 5 regras e mesma tabela de casos. `POST /auth/register`, `POST /auth/reset-password` e `PUT /auth/profile` chamam `assertStrongPassword` (`backend/src/routes/auth.ts:203,377,564`), que lança `WeakPasswordError` (400, `code: 'WEAK_PASSWORD'`, `passwordPolicy.ts:37-47`) traduzido pelo `prismaErrorHandler`. Login continua exigindo só "não vazio" (contas legadas continuam entrando). | — |
| 2.4 | Não permite duplicação de dados únicos | **OK** | `email String @unique`, 409 `EMAIL_TAKEN` em `backend/src/routes/auth.ts:207,471`. Rede de segurança nova: qualquer `P2002` (constraint única) não capturado explicitamente numa rota cai no `prismaErrorHandler`, que responde 409 `DUPLICATE_RECORD` (`backend/src/middleware/prismaError.ts:54-60`), cobrindo a corrida entre requisições concorrentes citada na avaliação anterior. | — |
| 2.5 | Permite visualizar senha | **OK** | `PasswordField` (`lib/features/auth/presentation/widgets/password_field.dart`) tem `IconButton` de alternância visibilidade/ocultação, usado em `login_page.dart`, `register_page.dart:193,204`, `forgot_password_page.dart:177,191`, `change_password_page.dart` e — desde a rodada de correção (T34) — também em `profile_edit_page.dart:341` (campo de senha atual do bloco de troca de e-mail, que na primeira verificação ainda era um `TextFormField` cru sem alternância). Todos os campos de senha do app passam agora pelo mesmo widget. | — |
| 2.6 | *Desejável:* permite confirmar senha | **OK** | Confirmação presente em cadastro (`register_page.dart:205`, campo `_confirmPasswordController`), redefinição por token (`forgot_password_page.dart:191-195`) e troca de senha/perfil (já existia). Divergência exibe a mensagem única `profilePasswordMismatch` ("As senhas não coincidem."). | — |
| 2.7 | *Desejável:* máscaras (telefone, CPF, CNPJ, CEP) | **OK** | `BrazilianPhoneInputFormatter` (`lib/core/utils/phone_input.dart`) aplicado em `register_page.dart:134` e `profile_edit_page.dart`; envio ao backend usa `phoneDigitsOnly` (`register_page.dart:59,233`, `profile_edit_page.dart:124,177`) e exibição usa `formatBrazilianPhone` (`profile_edit_page.dart:81`). CPF/CNPJ/CEP continuam fora do domínio. | — |
| 2.8 | *Desejável:* obtém endereço a partir de CEP | **N/A** | Sem mudança — não há entidade de endereço no `schema.prisma`. | Fora de escopo — não há campo de endereço no domínio. |

## 3. Back End — Funcionalidades

| # | Requisito | Status | Evidência | Ação para virar OK |
|---|---|---|---|---|
| 3.1 | Login permite recuperação de usuário e de senha | **OK** | Recuperação de senha inalterada e completa (ver 2026-08-03). Recuperação de **usuário** documentada como não aplicável ao domínio: `docs/architecture/backend.md`, seção "Login é o e-mail (item 3.1 do checklist)" — o identificador de login é o e-mail, não há "nome de usuário" separado no modelo `User`, e uma consulta por dado alternativo foi descartada por abrir vetor de enumeração de contas. | — |
| 3.2 | *Desejável:* habilitar/desabilitar 2FA | **NOK** | Sem mudança nesta iteração. | **Fora do escopo desta iteração** — ver `.specs/features/checklist-tcc-compliance/spec.md` (seção "Out of Scope"): exige novas dependências (otplib/qrcode) e reescrita do fluxo de login; retirado do escopo pelo usuário. |

## 4. Back End — Persistência

| # | Requisito | Status | Evidência | Ação para virar OK |
|---|---|---|---|---|
| 4.1 | Senha criptografada no BD | **OK** | Sem mudança — `bcrypt.hash(password, 12)` em `auth.ts`. | — |
| 4.2 | Entidades fortes nomeadas como substantivos | **OK** | Sem mudança. | — |
| 4.3 | Entidades relacionadas (PK × FK) | **OK** | Sem mudança; ganhou o modelo `AuditLog` com FK `onDelete: SetNull` (ver 4.11). | — |
| 4.4 | Diagrama gerado por engenharia reversa do BD implementado | **NOK** | Sem mudança nesta iteração. | **Fora do escopo desta iteração** — ver `.specs/features/checklist-tcc-compliance/spec.md`; retirado do escopo pelo usuário. |
| 4.5 | Aplicação trata erros de BD e avisa o usuário | **OK** | `prismaErrorHandler` (`backend/src/middleware/prismaError.ts`, registrado em `backend/src/index.ts:35`) classifica `P2002`→409 `DUPLICATE_RECORD` (`prismaError.ts:54-60`), `P2003`→409 `RELATED_RECORD_MISSING` (`prismaError.ts:61-67`), `P2025`→404 `RECORD_NOT_FOUND` (`prismaError.ts:68-74`), `P1001`/`P1002`/erro de inicialização→503 `DATABASE_UNAVAILABLE` (`prismaError.ts:75-85`), e mantém 500 `INTERNAL` sem stack em produção para o resto (`prismaError.ts:31-35,110-117`). Log registra código Prisma + rota (`prismaError.ts:106-109`). No app, `AuthCubit._mapErrorCode` (`lib/features/auth/presentation/cubit/auth_cubit.dart:173-183`) mapeia `DATABASE_UNAVAILABLE` para `AuthError.serviceUnavailable`, exibindo `authServiceUnavailableError` ("Serviço temporariamente indisponível. Tente novamente em alguns minutos."). | — |
| 4.6 | DELETE solicita confirmação | **OK** | Sem mudança nos pontos de exclusão de dados de saúde (inalterado desde 2026-08-03). A observação anterior ("`debug_panel.dart:131` apaga sem confirmar") **não se aplica mais**: `lib/core/debug/` e `DebugPanel` não existem mais no código — o painel de debug e o `MockSensorRepository` foram introduzidos e revertidos antes desta branch existir (commits `cf36982`/`f91adea`), confirmado por `git log --all --diff-filter=D` e por grep de `DebugPanel`/`MockSensorRepository`/"Limpar dados" no repositório, todos vazios. Recriar o painel só para satisfazer uma observação sobre um recurso já removido está fora do pedido desta tarefa (T30 do plano foi descartada por esse motivo). | Observação obsoleta — sem ação pendente. Se o painel de debug for reintroduzido no futuro, reavaliar a confirmação antes de "Limpar dados". |
| 4.7 | UPDATE: formulários de edição preenchidos com os dados do BD | **OK** | Sem mudança. | — |
| 4.8 | Diferencia dados editáveis de não editáveis | **OK** | `profile_edit_page.dart:310-323` exibe, via `GlucoreSectionCard`, o e-mail atual (`_email`, carregado em `profile_edit_page.dart:84`) e a data de criação da conta (`_createdAt`, `profile_edit_page.dart:85`, formatada por `formatBrazilianDate`) em linhas somente leitura, visualmente distintas (seção própria "Conta") dos campos editáveis de dados de saúde. `AccountProfile.createdAt` foi adicionado em `lib/features/auth/data/datasources/account_service.dart` para suportar a exibição. | — |
| 4.9 | UPDATE de senha não apresenta a senha criptografada | **OK** | Sem mudança de comportamento; agora reforçado por `ChangePasswordPage`, que nasce com os 3 campos vazios (spec P2 AC5, `change_password_page.dart`). | — |
| 4.10 | *Desejável:* UPDATE de senha em tela exclusiva | **OK** | `ChangePasswordPage` (`lib/features/patient/presentation/pages/change_password_page.dart`) é rota dedicada, alcançada a partir do perfil; sucesso fecha a tela e mostra `profilePasswordUpdatedSuccess` ("Senha atualizada com sucesso.") na origem (`change_password_page.dart:62-63`); senha atual incorreta mantém a tela aberta com `profileCurrentPasswordIncorrect` ("Senha atual incorreta.") e a sessão ativa (`change_password_page.dart:64-71`). `ProfileEditPage` não contém mais formulário de senha. | — |
| 4.11 | *Desejável:* log para auditoria | **OK** | Modelo `AuditLog` em `backend/prisma/schema.prisma` (userId nulável, `onDelete: SetNull`) com migração `backend/prisma/migrations/20260816120000_add_audit_log/migration.sql`. `recordAudit` (`backend/src/lib/audit.ts:70-92`) grava best-effort (nunca lança, `audit.ts:88-91`) e sanitiza `password`/`token` em qualquer nível de aninhamento (`sanitizeMetadata`, `audit.ts:54-68`). Chamado nos caminhos de sucesso de cadastro/login/recuperação/redefinição/perfil (`backend/src/routes/auth.ts`) e nas escritas de `/carbs`, `/insulin`, `/alerts`, `/settings/alerts` e `DELETE /readings` (uma linha por requisição, ação `REPLACE`/`CREATE`/`UPDATE`/`DELETE`). | A migração ainda não foi aplicada em nenhum banco desta iteração (ambiente de desenvolvimento sem banco acessível) — rodar `npx prisma migrate deploy` antes de demonstrar a trilha na banca; instruções em `docs/architecture/backend.md`. Enquanto não aplicada, as rotas de negócio continuam funcionando normalmente (best-effort). |

## 5. Back End — Sessão

| # | Requisito | Status | Evidência | Ação para virar OK |
|---|---|---|---|---|
| 5.1 | Restrição de acesso por permissão, com redirecionamento | **OK** | `requireRole('PATIENT')` (`backend/src/middleware/auth.ts:49-76`) resolve o papel no banco a cada requisição e protege as 5 rotas de dados: `readings.ts:11`, `carbs.ts:11`, `insulin.ts:11`, `alerts.ts:12`, `settings.ts:11` (403 `FORBIDDEN_ROLE` para papel não permitido). `verifyJwt` agora responde 401 com `code: 'TOKEN_INVALID'` (`backend/src/middleware/auth.ts:13,22`). No app, o interceptor `onError` do `ApiClient` (`lib/core/api/api_client.dart:44-58`) chama `SessionExpiryNotifier.signal()` só para `TOKEN_INVALID` (`session_expiry_notifier.dart`); `app.dart:62-70` escuta o notifier, dá `popUntil` até a rota raiz e exibe `authSessionExpiredWarning` ("Sua sessão expirou. Entre novamente."). Erro de conexão sem resposta HTTP não sinaliza — preserva o comportamento offline do P18. | — |
| 5.2 | Expira sessão por inatividade (timeout) | **NOK** | Sem mudança nesta iteração — `AuthSession.expiresAt`/`isRevoked` continuam sem leitura e o TTL do JWT permanece 30 d. | **Fora do escopo desta iteração** — ver `.specs/features/checklist-tcc-compliance/spec.md`; retirado do escopo pelo usuário. Consequência aceita: nenhum relógio de inatividade nem refresh token. |

---

## Prioridade sugerida (o que resta)

Todos os itens de baixo risco/alto peso apontados nas duas rodadas de avaliação e nas duas
rodadas de verificação independente (ver `validation.md`) foram resolvidos. Resta apenas:

1. **4.11** — aplicar `npx prisma migrate deploy` no banco usado pela banca antes da
   demonstração, para a trilha de auditoria realmente persistir (a migração está escrita e
   validada, só não foi aplicada em nenhum banco real nesta iteração de desenvolvimento).
2. **3.2 2FA/TOTP**, **4.4 DER por engenharia reversa** e **5.2 timeout de inatividade** —
   fora de escopo por decisão explícita, ver `.specs/features/checklist-tcc-compliance/spec.md`.

**Observações não bloqueantes** (registradas como lições, não travam a nota):
- `Colors.orange` residual em 3 pontos (`glucose_chart.dart:65,128`, `sensor_link_page.dart:288`)
  nas mesmas condicionais já migradas em T37 — o AC medível (`Colors.red`/`Colors.green`) foi
  cumprido; a leitura mais ampla ("toda cor de `AppTheme`") nunca esteve no escopo declarado.
- Os testes que fecham 1.1/1.4 (T27/T28/T35) verificam por `grep` estrutural, sem guarda de
  regressão automática contra um literal/cor sendo reintroduzido depois.
