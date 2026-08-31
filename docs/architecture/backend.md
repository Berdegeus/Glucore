# Backend (Express + Prisma + PostgreSQL)

> Quando usar: mudanças em API, schema, autenticação ou sincronização app↔servidor.

## Layout do workspace

`backend/` é um workspace npm (`packages/*`, `services/*`), não mais uma pasta `src/` única:

```
backend/
  packages/shared/src/         # errors/ http/ util/ audit/ — sem dependência de @prisma/client
  services/glucose-service/    # o serviço de hoje; todas as rotas abaixo vivem aqui
    prisma/schema.prisma
    src/{index,app,container}.ts
    src/modules/<nome>/        # routes · controller · service · repository · schema · mapper
    src/{middleware,lib,routes}/
```

A extração de `auth-service` e do gateway ainda não aconteceu — ver [ARCHITECTURE_FIX_PLAN.md](../ARCHITECTURE_FIX_PLAN.md) e a issue de microserviços. Enquanto isso, `glucose-service` responde por tudo, inclusive `/auth`.

## Stack e boot

`services/glucose-service/src/index.ts` só lê o ambiente e sobe o listener; quem monta o Express é `buildApp()` em `src/app.ts` — é essa separação que deixa o supertest exercitar o pipeline real em processo, sem porta. `cors()` (restrito quando `CORS_ORIGIN` está setado), `express.json()`, `morgan('dev')` só fora de teste, `prismaErrorHandler` e, por último, um handler genérico → 500. Prisma client singleton em `src/lib/prisma.ts`; wiring das dependências em `src/container.ts`.

Env: `DATABASE_URL`, `JWT_SECRET`, `PORT` (default **3001**), `CORS_ORIGIN`, SMTP para reset de senha. **`JWT_SECRET` não tem fallback**: `loadEnv()`/`getJwtSecret()` (`src/lib/env.ts`) lançam `MissingEnvError` e o bootstrap traduz isso em exit 1 — um servidor mal configurado se recusa a subir em vez de assinar token com segredo conhecido.

## Rotas implementadas (estado real)

| Rota | Métodos | Comportamento |
|---|---|---|
| `/auth/register` | POST | cria User+AuthCredential+Patient, retorna `{token}` (201); 409 e-mail duplicado |
| `/auth/login` | POST | valida bcrypt, retorna `{token}`; 401 credencial inválida |
| `/auth/status` | GET (JWT) | `{loggedIn, userId}` |
| `/auth/profile` | GET/PUT (JWT) | perfil + troca de e-mail/senha |
| `/auth/forgot-password`, `/auth/reset-password` | POST | token por e-mail (nodemailer), expira 6 h |
| `/readings` | GET (últimas 288) / POST (batch upsert por `[patientId, recordedAt]`) / DELETE (tudo) |
| `/carbs` | GET (100, inclui `id`) / POST — **replace-all (deprecated)**: `deleteMany` + `createMany`, preserva `id` enviado |
| `/carbs/item` | POST — cria 1 entrada, aceita `id` UUID do cliente, retorna `{id}` (201) |
| `/carbs/item/:id` | PUT / DELETE — escopo `{id, patientId}`; 404 se não pertencer ao paciente |
| `/insulin` | GET (100, inclui `id`) / POST — **replace-all (deprecated)**, preserva `id` enviado; campo `dayOfWeek` (migração `20260608232021_add_day_of_week_to_insulin_event`) |
| `/insulin/item` | POST — cria 1 entrada, aceita `id` UUID do cliente, retorna `{id}` (201) |
| `/insulin/item/:id` | PUT / DELETE — escopo `{id, patientId}`; 404 se não pertencer ao paciente |
| `/alerts` | GET (100) / POST — **replace-all**; mapeia enums app↔DB (`glucoseLow`↔`HYPO_RISK` etc.) |
| `/settings/alerts` | GET / PUT — thresholds em `AlertThresholdConfig` (defaults 80/180) |

Todas as rotas de dados usam `verifyJwt` (Bearer, `payload.sub` = userId) + `ensurePatient` (upsert do registro `Patient` na hora — usuário sem Patient nunca dá 404).

Contrato de payloads exato: ver [reference/data-models.md](../reference/data-models.md).

## Contrato de erros (`{ error, code }`)

Toda resposta de erro do backend traz `{ "error": "<mensagem>", "code": "<CODE>" }`. O app decide sempre pelo `code`, nunca pelo status sozinho — é o que separa "token inválido" (deve deslogar) de "senha atual incorreta" (não deve), ambos `401`.

`prismaErrorHandler` (`.../src/middleware/prismaError.ts`), registrado em `app.ts` antes do handler genérico, é uma **Chain of Responsibility**: `createErrorHandler([prismaClassifier, appErrorClassifier, httpContractClassifier])`, com o comportamento em `packages/shared/src/errors/errorHandler.ts` e a ordem decidida no serviço. Traduz exceções do Prisma, os `AppError` da camada de serviço e erros estrangeiros que já carregam `status`/`code` (como `WeakPasswordError`, `MissingEnvError`) nesta tabela:

Nota de contrato: **`code` é opcional no corpo**. As rotas respondem em duas formas — `{error, code}` onde existe código legível por máquina, e `{error}` puro onde nunca existiu. Padronizar tudo em `{error, code}` é mudança de contrato, não limpeza.

| Situação | Status | `code` | Onde nasce |
|---|---|---|---|
| Token ausente/inválido/expirado | 401 | `TOKEN_INVALID` | `verifyJwt` (`backend/services/glucose-service/src/middleware/auth.ts:13,22`) |
| Papel não autorizado | 403 | `FORBIDDEN_ROLE` | `requireRole` (`backend/services/glucose-service/src/middleware/auth.ts:69`) |
| Senha atual incorreta (`PUT /auth/profile`) | 401 | `INVALID_CURRENT_PASSWORD` | `backend/services/glucose-service/src/routes/auth.ts:374` |
| Senha fraca | 400 | `WEAK_PASSWORD` | `assertStrongPassword` (`backend/services/glucose-service/src/lib/passwordPolicy.ts`) → `httpContractClassifier` |
| E-mail já cadastrado | 409 | `EMAIL_TAKEN` | `backend/services/glucose-service/src/routes/auth.ts:146,410` |
| Constraint única violada (Prisma `P2002`) | 409 | `DUPLICATE_RECORD` | `prismaClassifier` (`backend/services/glucose-service/src/middleware/prismaClassifier.ts:33`) |
| FK inexistente (`P2003`) | 409 | `RELATED_RECORD_MISSING` | `prismaClassifier` (`backend/services/glucose-service/src/middleware/prismaClassifier.ts:40`) |
| Registro não encontrado (`P2025`) | 404 | `RECORD_NOT_FOUND` | `prismaClassifier` (`backend/services/glucose-service/src/middleware/prismaClassifier.ts:47`) |
| Banco indisponível (`P1001`/`P1002`/erro de inicialização) | 503 | `DATABASE_UNAVAILABLE` | `prismaClassifier` (`backend/services/glucose-service/src/middleware/prismaClassifier.ts:21-23,53,62`) |
| Não classificado | 500 | `INTERNAL` | `prismaClassifier` (`backend/services/glucose-service/src/middleware/prismaClassifier.ts:17`), sem stack quando `NODE_ENV=production` |

O app lê `code` em `AuthCubit._mapErrorCode` (`lib/features/auth/presentation/cubit/auth_cubit.dart:173-183`) e no interceptor de sessão `ApiClient`/`SessionExpiryNotifier` (`lib/core/session/session_expiry_notifier.dart`, `lib/core/api/api_client.dart`): só `TOKEN_INVALID` apaga o token e sinaliza logout; `INVALID_CURRENT_PASSWORD` mantém a sessão e mostra o erro na tela atual.

## Autorização por papel (`requireRole`)

`requireRole(...roles)` (`backend/services/glucose-service/src/middleware/auth.ts:49`) resolve `user.role` no banco a cada requisição (não confia em claim do JWT — rebaixar um usuário vale imediatamente) e responde 403 `FORBIDDEN_ROLE` quando o papel não está na lista permitida. Aplicado, sempre depois de `verifyJwt`, em `router.use(requireRole('PATIENT'))` nos cinco módulos de dados do paciente, todos na linha 11 do respectivo `<nome>.routes.ts`: `backend/services/glucose-service/src/modules/{readings,carbs,insulin,alerts,settings}/*.routes.ts`.

## Trilha de auditoria (`AuditLog`)

`recordAudit` grava em `AuditLog` (`backend/services/glucose-service/prisma/schema.prisma`, modelo `AuditLog`) o `userId`, a entidade, a ação, `entityId`, `metadata` sanitizado, `ipAddress` e `userAgent`. O comportamento vive em `backend/packages/shared/src/audit/audit.ts:86`, que recebe o `AuditClient` por parâmetro para não depender de um `PrismaClient` específico; `backend/services/glucose-service/src/lib/audit.ts:17` amarra a esse serviço, mantendo a assinatura no ponto de chamada. É best-effort: nunca lança para o chamador — uma falha de auditoria não pode derrubar a gravação de um registro de insulina — e nunca persiste senha, hash ou token: `sanitizeMetadata` (`backend/packages/shared/src/audit/audit.ts:72`) remove qualquer chave cujo nome combine com `/password|token/i`, em qualquer nível de aninhamento.

Chamado no caminho de sucesso de cadastro, login, esqueci-senha, redefinição de senha e atualização de perfil (`backend/services/glucose-service/src/routes/auth.ts`), e nas escritas de `/carbs`, `/insulin`, `/alerts` e `/settings/alerts` (um registro por requisição, ação `REPLACE`/`CREATE`/`UPDATE`/`DELETE` conforme a rota).

**Aplicar a migração:** a tabela é criada pela migração `backend/services/glucose-service/prisma/migrations/20260816120000_add_audit_log/`, escrita à mão porque o ambiente de desenvolvimento desta iteração não tinha banco acessível para `prisma migrate dev`. Para aplicar:

```bash
cd backend
npm run migrate:deploy      # aplica as migrações pendentes, incluindo add_audit_log
npm run -w @glucore/glucose-service exec -- prisma generate
```

Se a migração ainda não estiver aplicada em algum ambiente, as rotas de negócio continuam funcionando normalmente: `recordAudit` engole a exceção e registra `console.error`, sem afetar a resposta ao usuário.

## Login é o e-mail (item 3.1 do checklist)

O identificador de login do Glucore é o e-mail (`POST /auth/login` recebe `email` + `password`; não existe "nome de usuário" separado no modelo `User`). Por isso não existe — e não é necessário — um fluxo de "esqueci meu login": quem esqueceu o e-mail com que se cadastrou não tem, no domínio atual, nenhum outro identificador de conta para recuperá-lo. Um fluxo de "encontre sua conta" por um dado alternativo (nome, telefone) foi descartado por criar um vetor de enumeração de contas sem benefício real ao usuário. A recuperação de **senha** já existe e é completa: `POST /auth/forgot-password` + `POST /auth/reset-password`, ambas descritas na tabela de rotas acima.

## Schema Prisma: usado vs planejado

**Usados hoje:** `User`, `AuthCredential`, `Patient`, `PasswordResetToken`, `GlucoseReading`, `AlertEvent`, `CarbEvent`, `InsulinEvent`, `AlertThresholdConfig`.

**Definidos mas sem nenhuma rota/uso (planejamento futuro):** `AuthSession`, `HealthProfessional`, `Administrator`, `SensorDevice`, `SensorBinding`, `SensorSession`, `SensorStatusEvent`, `GlucosePrediction`, `ClinicalReport`, `MetricsSnapshot`, `DashboardAccessGrant`. Não assumir que existam endpoints para eles.

## Modelo de sincronização atual

O app trata o backend como storage de listas: cada mudança local regrava a coleção inteira (POST com array completo). Consequências (detalhes em [ARCHITECTURE_REVIEW.md](../ARCHITECTURE_REVIEW.md) §P2/§P3):
- carbs/insulin/alerts: IDs regenerados a cada save; sem edição/remoção item a item na API.
- readings: POST re-upserta até 288 linhas a cada leitura nova.

Ao evoluir a API, preferir endpoints por item (abaixo) e mudar o app junto.

### Endpoints por item (carbs / insulin)

Resolvem o §P2 para carbs e insulin: IDs estáveis (UUID gerado no cliente ou pelo banco), edição/remoção unitária, sem apagar a coleção. O POST batch antigo continua funcionando (marcado `// Deprecated:` na rota) e agora preserva `id` quando enviado. Alerts permanecem batch-only (uso append-only).

| Endpoint | Body | Resposta |
|---|---|---|
| `POST /carbs/item` | `{id?, grams, description, timeMs}` | 201 `{id}` |
| `PUT /carbs/item/:id` | `{grams, description, timeMs}` | 204 / 404 |
| `DELETE /carbs/item/:id` | — | 204 / 404 |
| `POST /insulin/item` | `{id?, units, type, timeMs, dayOfWeek?}` | 201 `{id}` |
| `PUT /insulin/item/:id` | `{units, type, timeMs, dayOfWeek?}` | 204 / 404 |
| `DELETE /insulin/item/:id` | — | 204 / 404 |

Regras: `id` opcional no POST deve ser UUID (senão 400); validação básica de tipos retorna 400 `{error}`; PUT/DELETE usam `updateMany`/`deleteMany` com `where: {id, patientId}` — um paciente nunca alcança linhas de outro (404).

```bash
# criar (id gerado no cliente, opcional)
curl -X POST http://localhost:3001/carbs/item \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"id":"a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d","grams":45,"description":"almoço","timeMs":1751800000000}'
# → 201 {"id":"a1b2c3d4-..."}

curl -X PUT http://localhost:3001/insulin/item/$ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"units":8,"type":"basal","timeMs":1751803600000,"dayOfWeek":"TUESDAY"}'

curl -X DELETE http://localhost:3001/carbs/item/$ID -H "Authorization: Bearer $TOKEN"
```

## Comandos

```bash
cd backend
npm install                   # instala o workspace inteiro
npm run build                 # tsc -b dos dois projetos + typecheck de tests/
npm test                      # vitest; precisa de Postgres com o banco glucore_test
npm run migrate:dev           # delega ao glucose-service
npm run dev                   # idem — ts-node-dev no glucose-service
```

App físico → backend na máquina: `flutter run --dart-define=API_URL=http://<ip-da-maquina>:3001`.

## Arquivos-chave

Tudo abaixo é relativo a `backend/`.

| Arquivo | Papel |
|---|---|
| `services/glucose-service/prisma/schema.prisma` | Schema completo (inclui tabelas futuras) |
| `services/glucose-service/src/app.ts` | `buildApp()` — monta o Express, sem porta |
| `services/glucose-service/src/container.ts` | Composition root: instancia repositórios e serviços |
| `services/glucose-service/src/modules/<nome>/` | CRUD de dados em camadas (`routes · controller · service · repository · schema · mapper`) |
| `services/glucose-service/src/routes/auth.ts` | Registro/login/perfil/reset (537 linhas — **única rota ainda não modularizada**) |
| `services/glucose-service/src/middleware/auth.ts` | `verifyJwt`, `requireRole` |
| `services/glucose-service/src/middleware/prismaClassifier.ts` | Traduz erro do Prisma em `{status, code}` |
| `services/glucose-service/src/lib/patient.ts` | `ensurePatient` (upsert) |
| `packages/shared/src/errors/` | `AppError`, subclasses HTTP, `createErrorHandler(classifiers)` |
| `packages/shared/src/http/asyncHandler.ts` | Wrapper de erro async |

## Armadilhas

- Migração `add_day_of_week_to_insulin_event` pode não estar aplicada no banco local — rodar `npm run migrate:dev` antes de testar insulina.
- `JWT_SECRET` sem env **não** tem fallback: `loadEnv()` lança `MissingEnvError` e o processo sai 1. (A antiga queda em `'dev-secret'` do §P11 não existe mais.)
- Enum `AlertType` do DB ≠ enum `AppAlertType` do app; o mapeamento (padrão Adapter) vive em `services/glucose-service/src/modules/alerts/alerts.mapper.ts` (FAST_DROP/FAST_RISE viram `syncFailure` na volta — lossy, e travado por teste de caracterização de propósito).
- `GlucoseReading` tem unique `[patientId, recordedAt]` — dois posts com mesmo timestamp sobrescrevem, não duplicam.
