# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
o projeto segue versionamento semântico (ver [docs/guides/versioning-and-branches.md](docs/guides/versioning-and-branches.md)).

## [Unreleased] — auth-service extraído, Fase 3 (branch `refactor/auth-service`)

A fronteira deixa de ser de pastas e passa a ser de **banco**: identidade sai do serviço clínico e
vira `auth-service`, com schema, migrations e banco próprios. É o passo mais arriscado do plano de
microserviços (issue #30), porque a migration é destrutiva e porque desfaz um `ON DELETE CASCADE`.

### Added
- **`services/auth-service`** (:3002, banco `glucore_auth`) com `User`, `AuthCredential`,
  `PasswordResetToken`, `AuthSession` e a sua própria `AuditLog` — esta **mantendo** a FK
  `userId → User.id ON DELETE SET NULL`, já que as duas tabelas ficam no mesmo banco.
- Três módulos em camadas — `accounts`, `sessions`, `password` — divididos por **o que cada um
  escreve**, não por forma de URL. É por isso que `/register` e `/login` acabam em módulos
  diferentes apesar de vizinhos no path.
- **`packages/shared/src/auth/`**: `claims`, `jwt` (assinatura e verificação) e o middleware
  `verifyJwt`/`requireRole`, agora compartilhado pelos dois serviços.
- **Duas Strategies**, que fecham o padrão para o critério de padrões de projeto:
  `BcryptPasswordHasher` (o custo é argumento de construtor) e `Mailer` (`SmtpMailer` ou
  `ConsoleMailer`, escolhido por configuração).
- 25 testes novos no `auth-service` mais os portados: **337 no total**, 95,88% de statements.

### Changed
- **O papel passa a viajar na claim do JWT** (`{sub, role}`) em vez de ser lido do banco a cada
  requisição. A decisão anterior existia para que rebaixar um usuário valesse na hora; ela deixou de
  pagar quando a identidade foi para trás de uma fronteira de rede, porque a consulta viraria um
  round-trip por request — inclusive no sync de leituras, a rota de maior volume — para proteger um
  caso que quase não existe (o app só tem contas `PATIENT`). Os perfis web saem ganhando: token de
  1 h com revogação, contra 30 dias sem revogação nenhuma.
- **Um token sem `role` é rejeitado, não assumido como paciente.** Todo token emitido antes desta
  versão tem essa forma. Assumir `PATIENT` rebaixaria uma conta privilegiada em silêncio; assumir
  qualquer outra coisa daria acesso por token malformado.
- `toProfileDto` compunha conta e paciente num payload só e não cabia mais em um serviço: virou
  `toAccountDto` no `auth-service` e `toPatientDto` no `glucose-service`. O gateway recompõe.
- Os fixtures das cinco suítes de rota do `glucose-service` deixaram de registrar via
  `POST /auth/register` — rota que aquele serviço não serve mais — e passaram a semear o `Patient` e
  assinar o token. **Nenhuma asserção dos 225 testes de caracterização mudou.**
- O job de backend no CI cria um segundo banco (`glucore_auth_test`): um banco por serviço, também
  no teste.

### Fixed
- `prismaClassifier` do `auth-service` importava `Prisma` de `'@prisma/client'` — o client que o
  `glucose-service` gera, não o dele. São classes diferentes, então todo `instanceof` era falso e
  todo `P2002` teria virado 500 em produção. Pego pelo teste de unidade na primeira execução.

### Removed
- `services/glucose-service/src/routes/auth.ts` (537 linhas), `lib/passwordPolicy.ts` e os models de
  identidade do schema clínico, pela migration `split_identity_out`.

### Known gaps
- **O cadastro perde a fatia de paciente.** `birthDate`, `weightKg` e `targetRange` enviados no
  register não têm destino; o `Patient` nasce com os defaults 80/180 na primeira requisição de
  dados. A saga de registro no gateway recupera isso.
- **`GET/PUT /auth/profile` respondem só a fatia de conta.**
- **Não há endereço único**: cadastro e login em :3002, resto em :3001. Sem gateway, o app Flutter
  não funciona ponta a ponta — está fora de escopo por decisão até a Fase 4.
- **Órfãos passaram a ser possíveis.** Sem o cascade `User → Patient`, apagar uma conta deixa a
  cadeia clínica para trás. `DELETE /account` cross-service deixa de ser opcional.

### Notes
- Verificado com os dois serviços de pé: um token emitido em :3002 contra `glucore_auth_dev` é
  aceito em :3001 contra `glucore_dev`, o `ensurePatient` cria o paciente a partir dele e uma
  escrita de carboidrato passa. Os dois ids batem entre bancos, sem FK entre eles.
- A migration destrutiva foi conferida contra o banco de desenvolvimento, não presumida: 627
  leituras, 5 pacientes, 3 carboidratos, 10 aplicações de insulina e 4 alertas antes e depois.
- **`npm test` tem que rodar da raiz de `backend/`.** De dentro de um serviço o Vitest perde
  `fileParallelism: false`/`maxWorkers: 1`, que são opções de raiz, e as suítes truncam o mesmo
  banco em paralelo.

## [Unreleased] — backend-microservices, Fases 0–2 (branch `refactor/backend-microservices`, PR #31)

Trabalho preparatório para o split em microserviços (issue #30): rede de segurança, workspace
npm e camadas — tudo **antes** de qualquer fronteira de rede. Nenhuma resposta do servidor
mudou; o contrato HTTP é idêntico ao de `main`. Plano completo em `docs/ARCHITECTURE_FIX_PLAN.md`
e na issue #30.

### Added
- **Workspace npm** em `backend/`: `packages/*` + `services/*`, com `tsconfig.base.json`
  (`composite: true`) e project references. `npm run build` = `tsc -b` dos dois projetos mais
  o typecheck de `tests/`.
- **`packages/shared`**: `errors/` (`AppError` abstrata, cinco subclasses HTTP e
  `createErrorHandler(classifiers)`), `http/asyncHandler`, `util/{optionalText,uuid}` e
  `audit/audit` — sem depender de `@prisma/client`, que é o que permite reusá-lo nos serviços
  que ainda não existem.
- **Seis módulos em camadas** em `services/glucose-service/src/modules/<nome>/`
  (`readings`, `carbs`, `insulin`, `alerts`, `settings`, `patient`), cada um com
  `routes · controller · service · repository · schema · mapper`, e `src/container.ts` como
  composition root.
- **225 testes de caracterização** contra Postgres real, escritos **antes** da refatoração para
  servirem de oráculo, mais 87 de unidade contra fakes tipados. Total: 312 testes, 97,16% de
  statements, com thresholds que reprovam o job de CI numa queda.
- `services/glucose-service/tsconfig.test.json`, para que `tests/` também seja typechecked — o
  projeto de build emite com `rootDir: src` e deixava os fakes tipados sem garantia nenhuma.

### Changed
- **Suíte migrada de `node:test` para Vitest 3.2.7** com coverage v8; `tsResolve.mjs` removido.
- **`buildApp()`** separado do bootstrap (`src/app.ts` monta o Express, `src/index.ts` só lê o
  ambiente e liga a porta), o que deixa o supertest exercitar o pipeline real em processo.
- **`lib/env.ts` lança `MissingEnvError`** em vez de chamar `process.exit(1)`. `process.exit`
  era alcançável por qualquer módulo que importasse esse arquivo: sob um test runner, derrubava
  o worker inteiro sem falha reportada e sem saída.
- **Contrato de erro vira Chain of Responsibility**:
  `createErrorHandler([prismaClassifier, appErrorClassifier, httpContractClassifier])`, com o
  comportamento no pacote shared e a ordem decidida pelo serviço.
- **CI**: o job de backend roda `npm run build` no lugar de `npx tsc --noEmit`. Sem
  `tsconfig.json` na raiz de `backend/`, `npx tsc` não acha projeto nenhum, imprime o texto de
  ajuda e **sai 0** — um erro de tipo passava batido. `--noEmit` não era alternativa: é
  incompatível com `composite: true`.
- **Documentação realinhada** ao layout novo em 9 arquivos, incluindo três afirmações que
  estavam factualmente erradas: o fallback `'dev-secret'` do `JWT_SECRET` (não existe mais), a
  ausência de rate-limit nas rotas de auth (existe desde agosto) e a alegação de que
  `npm test` no backend não precisa de banco (precisa — é Vitest contra Postgres real).

### Fixed
- `packages/shared` importava tipos de `express` sem declarar a dependência, compilando só por
  hoisting do `node_modules` da raiz. Sem efeito em runtime (os imports são type-only), mas
  quebraria no `npm ci --omit=dev` dos Dockerfiles.

### Known gaps
- **`PUT /auth/profile` continua monolítica**, por decisão: escreve `User`, `Patient` e
  `AuthCredential` numa `$transaction` só, e parti-la agora mudaria a atomicidade sem que
  houvesse para onde mover as pernas. Resolve-se na extração do auth-service.
- **Três comportamentos travados por teste de propósito**, porque os testes de caracterização
  registram o comportamento atual (bugs incluídos): `FAST_DROP`/`FAST_RISE` voltam como
  `syncFailure`; `PUT /settings/alerts` aceita faixa invertida; o replace-all descarta id
  não-UUID em vez de rejeitar o lote. Mudar qualquer um é decisão de produto — muda o teste e o
  código no mesmo commit.
- **Job Kotlin do CI vermelho** desde 25/08, independente deste trabalho (`main` falha igual):
  `subosito/flutter-action@v2` roda `channel: stable` sem versão pinada, o stable passou a
  exigir Gradle ≥ 8.14.0 e o wrapper está em 8.12.

### Notes
- Fases 3–8 (auth-service, gateway, token interno, Consul, `docker-compose.yml`, dashboard, CD)
  não começaram.
- A suíte do backend precisa de Postgres com o banco `glucore_test`; a URL sai de
  `backend/services/glucose-service/.env.test` (untracked, copiar de `.env.test.example`).

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
