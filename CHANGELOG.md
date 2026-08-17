# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
o projeto segue versionamento semântico (ver [docs/guides/versioning-and-branches.md](docs/guides/versioning-and-branches.md)).

## [Unreleased] — checklist-tcc-compliance (branch `feat/tcc-checklist-compliance`)

Fecha 16 das 27 lacunas apontadas pela auditoria do checklist da banca de 2026-08-03
(`TCC I - Checklist - Avaliacao.md`), concentradas em higiene de formulário, identidade
visual/mensagens, tratamento de erros de banco e autorização por papel. Detalhe completo
em `.specs/features/checklist-tcc-compliance/` e no checklist atualizado.

### Added
- **Política de senha forte compartilhada**: `lib/core/validation/password_policy.dart`
  (app) e `backend/src/lib/passwordPolicy.ts` (backend), mesma regra e mesma tabela de
  casos dos dois lados; aplicada em cadastro, redefinição por token e troca de senha.
- **`PasswordField`**: campo de senha único com alternância de visibilidade, usado nos
  7 pontos de senha do app.
- **Confirmação de senha** no cadastro e na redefinição por token (já existia na troca
  de senha do perfil).
- **`GlucoreMessenger`**: helper único de mensagens (`info`/`warning`/`error`/`success`)
  com cor e ícone de `AppTheme`; em uso nas telas de autenticação e perfil.
- **`UserAppBar`**: nome do usuário logado + "Sair da conta" em todas as 4 abas do shell
  e em 11 páginas empilhadas, via `UserIdentityCubit`.
- **`GlucoreFormLayout`**: formulários de auth/perfil centralizados em 560 dp acima de
  600 dp; Diário e Relatórios ganharam layout de duas colunas no mesmo breakpoint.
- **Telefone com máscara**: `BrazilianPhoneInputFormatter`, campo exposto em cadastro e
  perfil, enviado ao backend só com dígitos.
- **`ChangePasswordPage`**: troca de senha em rota dedicada, fora de `ProfileEditPage`.
- **Dados imutáveis visíveis**: e-mail atual e data de criação da conta em modo somente
  leitura no perfil.
- **Contrato de erro `{ error, code }`**: `prismaErrorHandler`
  (`backend/src/middleware/prismaError.ts`) traduz `P2002`/`P2003`/`P2025`/`P1001`/`P1002`
  em `DUPLICATE_RECORD`/`RELATED_RECORD_MISSING`/`RECORD_NOT_FOUND`/`DATABASE_UNAVAILABLE`;
  `TOKEN_INVALID`/`INVALID_CURRENT_PASSWORD`/`WEAK_PASSWORD`/`FORBIDDEN_ROLE` nas rotas e
  middlewares de auth. App decide pelo `code`, nunca pelo status sozinho.
- **`requireRole`**: autorização por papel (`PATIENT`) nas rotas `/readings`, `/carbs`,
  `/insulin`, `/alerts`, `/settings`, papel resolvido no banco a cada requisição.
- **`SessionExpiryNotifier`**: 401 `TOKEN_INVALID` desloga e redireciona ao login com
  aviso; erro de conexão sem resposta HTTP não afeta a sessão (preserva o P18 offline).
- **Trilha de auditoria (`AuditLog`)**: `recordAudit` best-effort, sanitiza senha/token do
  `metadata`, gravado em cadastro/login/recuperação/perfil e nas escritas de
  carboidrato/insulina/alertas/limiares. Migração `20260816120000_add_audit_log` escrita
  à mão (aplicar com `prisma migrate deploy`).
- **l10n/tema**: `monitoring_home_page.dart`, `settings_page.dart` e `profile_page.dart`
  migrados para `AppLocalizations`/`AppTheme`, sem `Colors.red`/`Colors.green` nem texto
  hardcoded.
- **Documentação**: `docs/architecture/backend.md` ganhou o contrato de erros, a
  autorização por papel, a trilha de auditoria (com instrução de migração) e a explicação
  de por que "esqueci meu login" não se aplica a um sistema onde o login é o e-mail.

### Known gaps (registrados no checklist atualizado)
- Item 1.4 (mensagens padronizadas) fica **PARCIAL**: 7 telas de carboidrato/insulina/
  alertas ainda constroem `SnackBar` diretamente em vez de `GlucoreMessenger`.
- Migração `add_audit_log` ainda não aplicada em nenhum banco desta iteração — aplicar
  antes de demonstrar a trilha de auditoria.
- 2FA/TOTP (3.2), DER por engenharia reversa (4.4) e timeout de sessão por inatividade
  (5.2) seguem fora de escopo por decisão do usuário.

### Notes
- 173 testes Flutter e 41 testes de backend passando; `flutter analyze` e
  `npx tsc --noEmit` limpos.

## [1.1.0] — 2026-07-30

Integração multi-sensor + correção dos 3 problemas críticos abertos no relatório
de arquitetura (P17, P18, P19). Pendente de teste regressivo em hardware real
antes do release em `main`.

### Added
- **Accu-Chek SmartGuide**: protocolo e BLE manager próprios, pareamento com PIN.
- **FreeStyle Libre 2**: ativação por NFC, instalador da biblioteca de algoritmos
  da Abbott (extraída de um APK LibreLink) e streaming por BLE.
- **Base BLE brand-agnostic** (`BrandBleManager`): fila de escrita GATT serializada;
  marca resolvida via `getLibreVersion`.
- **Persistência offline-first**: SQLite local como fonte primária + sincronização
  em background (debounce/retry, reagenda com a conectividade).
- **Pilha de sensor com escopo de app**: `SensorCore` + `CgmForegroundService`
  (sobrevive à morte da Activity).
- **Versionamento**: `dev` = branch de integração; `main` = releases com tag.

### Fixed
- **P17 — navegação multi-marca** (`3ab0025`): `SensorCubit`/`PatientCubit`
  providos acima do Navigator raiz (`MaterialApp.builder`); abrir a escolha de
  sensor por Configurações/Perfil não lança mais `ProviderNotFoundException`.
- **P18 — login offline** (`5004f9f`): abrir o app sem rede não desloga mais.
  `isLoggedIn()` distingue `authenticated`/`invalid`/`unreachable`; o token só é
  apagado em 401/403; sessão offline é revalidada quando a rede volta.
- **P19 — isolamento por usuário** (`75c416a`): dados locais amarrados ao dono
  (`meta.owner_user_id`, `sub` do JWT); trocar de conta faz wipe + encerra a
  sessão do sensor; o sync nunca faz push entre contas.

### Security
- Endurecimento do backend: `JWT_SECRET` obrigatório (fail-fast), CORS restringível
  por `CORS_ORIGIN`, validação de entrada nas rotas.

### Notes
- Somente `arm64-v8a` (restrição dos `.so` do fornecedor).
- 29 testes passando; `flutter analyze` limpo; `assembleDebug` OK.

## [1.0.0] — baseline

Conexão BLE Sibionics viva, protocolo EU completo, shell Flutter com Bloc/Cubit,
backend com auth JWT e CRUD de carboidrato/insulina, painel de debug com sensor mock.

[1.1.0]: https://github.com/Berdegeus/Glucore/pull/7
