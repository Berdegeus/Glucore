# Backend (Express + Prisma + PostgreSQL)

> Quando usar: mudanças em API, schema, autenticação ou sincronização app↔servidor.

## Layout do workspace

`backend/` é um workspace npm com **dois serviços**, cada um com o seu banco:

```
backend/
  packages/shared/src/         # errors/ http/ util/ audit/ auth/ — sem dependência de Prisma
  services/auth-service/       # :3002, banco glucore_auth — identidade
    prisma/schema.prisma       #   User, AuthCredential, PasswordResetToken, AuthSession, AuditLog
    generated/prisma/          #   client próprio (gitignored) — ver "Dois clients Prisma"
    src/modules/{accounts,sessions,password}/
  services/glucose-service/    # :3001, banco glucore_dev — dado clínico
    prisma/schema.prisma       #   Patient, sensores, leituras, carbs, insulina, alertas, AuditLog
    src/modules/{readings,carbs,insulin,alerts,settings,patient}/
```

Cada módulo tem a mesma forma: `routes · controller · service · repository · schema · mapper`,
montados por um `src/container.ts` que é o composition root do serviço.

**A fronteira é identidade, não domínio clínico.** Das 20 FKs originais, 17 permanecem dentro do
banco glucose — a cadeia sensor → binding → paciente → leitura continua íntegra e ainda cascateia.
As três cortadas apontavam para `User`: `Patient.userId`, `HealthProfessional.userId` e
`Administrator.userId` são hoje UUIDs soltos. O que atravessa entre os serviços é o `userId` dentro
do JWT, e nada mais.

**O que se perdeu:** o `ON DELETE CASCADE` de `User → Patient`. O banco já não previne paciente
órfão, o que torna `DELETE /account` uma operação cross-service obrigatória (ainda não construída).

O gateway (:3001 no desenho final), o Service Discovery e o token interno são as fases seguintes —
ver [ARCHITECTURE_FIX_PLAN.md](../ARCHITECTURE_FIX_PLAN.md) e a issue de microserviços. **Enquanto
não existem, não há um endereço único**: o cliente falaria com duas portas, e por isso o app Flutter
está fora de escopo até lá.

### Dois clients Prisma

`auth-service` gera o client em `services/auth-service/generated/prisma`, não no
`node_modules/.prisma/client` da raiz. Aquele diretório é único no workspace e os dois serviços
rodam `prisma generate` no install: o último a rodar venceria, e o outro passaria a compilar contra
um client de um schema que não é o seu — uma falha que depende da ordem de instalação.

Consequência prática: **em `auth-service`, importar `Prisma` de `'@prisma/client'` está errado**.
São classes diferentes, então todo `instanceof` seria falso e todo `P2002` viraria 500. Importe de
`src/lib/prisma.ts`, que é o único arquivo que conhece o caminho gerado.

## Stack e boot

Os dois serviços têm a mesma estrutura: `src/index.ts` só lê o ambiente e sobe o listener; quem
monta o Express é `buildApp()` em `src/app.ts` — é essa separação que deixa o supertest exercitar o
pipeline real em processo, sem porta. `cors()` (restrito quando `CORS_ORIGIN` está setado),
`express.json()`, `morgan('dev')` só fora de teste, `prismaErrorHandler` e, por último, um handler
genérico → 500.

Env comum: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`. Só o `auth-service` usa
`BCRYPT_ROUNDS` e as variáveis SMTP.

**`JWT_SECRET` não tem fallback**: `loadEnv()`/`getJwtSecret()` lançam `MissingEnvError` e o
bootstrap traduz isso em exit 1. **Os dois serviços precisam do mesmo segredo** enquanto não houver
gateway — o auth-service assina e o glucose-service verifica; segredos diferentes fazem todo request
autenticado responder 401.

## Rotas implementadas (estado real)

**auth-service (:3002)** — módulos `accounts`, `sessions`, `password`:

| Rota | Métodos | Comportamento |
|---|---|---|
| `/auth/register` | POST | cria **User+AuthCredential** e abre sessão, retorna `{token}` (201); 409 e-mail duplicado. **Já não cria o `Patient`** — ver "Regressões conhecidas" |
| `/auth/login` | POST | valida bcrypt, retorna `{token}`; 401 credencial inválida |
| `/auth/status` | GET (JWT) | `{loggedIn, userId}` |
| `/auth/profile` | GET/PUT (JWT) | **só a fatia de conta** (id, email, fullName, phone, status, role, createdAt) + troca de e-mail/senha |
| `/auth/forgot-password`, `/auth/reset-password` | POST | token por e-mail, expira 6 h |

**glucose-service (:3001)** — módulos `readings`, `carbs`, `insulin`, `alerts`, `settings`, `patient`:

| Rota | Métodos | Comportamento |
|---|---|---|
| `/readings` | GET (últimas 288) / POST (batch upsert por `[patientId, recordedAt]`) / DELETE (tudo) |
| `/carbs` | GET (100, inclui `id`) / POST — **replace-all (deprecated)**: `deleteMany` + `createMany`, preserva `id` enviado |
| `/carbs/item` | POST — cria 1 entrada, aceita `id` UUID do cliente, retorna `{id}` (201) |
| `/carbs/item/:id` | PUT / DELETE — escopo `{id, patientId}`; 404 se não pertencer ao paciente |
| `/insulin` | GET (100, inclui `id`) / POST — **replace-all (deprecated)**, preserva `id` enviado; campo `dayOfWeek` (migração `20260608232021_add_day_of_week_to_insulin_event`) |
| `/insulin/item` | POST — cria 1 entrada, aceita `id` UUID do cliente, retorna `{id}` (201) |
| `/insulin/item/:id` | PUT / DELETE — escopo `{id, patientId}`; 404 se não pertencer ao paciente |
| `/alerts` | GET (100) / POST — **replace-all**; mapeia enums app↔DB (`glucoseLow`↔`HYPO_RISK` etc.) |
| `/settings/alerts` | GET / PUT — thresholds em `AlertThresholdConfig` (defaults 80/180) |

Todas as rotas de dados usam `verifyJwt` + `requireRole('PATIENT')` + `ensurePatient` (upsert do
registro `Patient` na hora). Depois do split, `ensurePatient` deixou de ser uma rede de segurança e
passou a ser **o** caminho pelo qual o `Patient` nasce: o cadastro não o cria mais.

### Regressões conhecidas, até o gateway existir

1. **O cadastro perde a fatia de paciente.** `birthDate`, `weightKg` e `targetRange` enviados no
   register não têm destino; o `Patient` nasce com os defaults 80/180 na primeira requisição de
   dados. A saga de registro no gateway recupera isso.
2. **`GET/PUT /auth/profile` respondem só a conta.** A composição das duas metades é do gateway.
3. **Não há endereço único.** Um cliente precisaria falar com :3002 e :3001.

Contrato de payloads exato: ver [reference/data-models.md](../reference/data-models.md).

## Contrato de erros (`{ error, code }`)

Toda resposta de erro do backend traz `{ "error": "<mensagem>", "code": "<CODE>" }`. O app decide sempre pelo `code`, nunca pelo status sozinho — é o que separa "token inválido" (deve deslogar) de "senha atual incorreta" (não deve), ambos `401`.

`prismaErrorHandler` (`.../src/middleware/prismaError.ts`), registrado em `app.ts` antes do handler genérico, é uma **Chain of Responsibility**: `createErrorHandler([prismaClassifier, appErrorClassifier, httpContractClassifier])`, com o comportamento em `packages/shared/src/errors/errorHandler.ts` e a ordem decidida no serviço. Traduz exceções do Prisma, os `AppError` da camada de serviço e erros estrangeiros que já carregam `status`/`code` (como `WeakPasswordError`, `MissingEnvError`) nesta tabela:

Nota de contrato: **`code` é opcional no corpo**. As rotas respondem em duas formas — `{error, code}` onde existe código legível por máquina, e `{error}` puro onde nunca existiu. Padronizar tudo em `{error, code}` é mudança de contrato, não limpeza.

| Situação | Status | `code` | Onde nasce |
|---|---|---|---|
| Token ausente/inválido/expirado | 401 | `TOKEN_INVALID` | `verifyJwt` (`backend/services/glucose-service/src/middleware/auth.ts:13,22`) |
| Papel não autorizado | 403 | `FORBIDDEN_ROLE` | `requireRole` (`backend/services/glucose-service/src/middleware/auth.ts:69`) |
| Senha atual incorreta (`PUT /auth/profile`) | 401 | `INVALID_CURRENT_PASSWORD` | `backend/services/auth-service/src/modules/accounts/accounts.service.ts` |
| Senha fraca | 400 | `WEAK_PASSWORD` | `assertStrongPassword` (`backend/services/auth-service/src/lib/passwordPolicy.ts`) → `httpContractClassifier` |
| E-mail já cadastrado | 409 | `EMAIL_TAKEN` | `backend/services/auth-service/src/modules/accounts/accounts.service.ts` |
| Constraint única violada (Prisma `P2002`) | 409 | `DUPLICATE_RECORD` | `prismaClassifier` (`backend/services/glucose-service/src/middleware/prismaClassifier.ts:33`) |
| FK inexistente (`P2003`) | 409 | `RELATED_RECORD_MISSING` | `prismaClassifier` (`backend/services/glucose-service/src/middleware/prismaClassifier.ts:40`) |
| Registro não encontrado (`P2025`) | 404 | `RECORD_NOT_FOUND` | `prismaClassifier` (`backend/services/glucose-service/src/middleware/prismaClassifier.ts:47`) |
| Banco indisponível (`P1001`/`P1002`/erro de inicialização) | 503 | `DATABASE_UNAVAILABLE` | `prismaClassifier` (`backend/services/glucose-service/src/middleware/prismaClassifier.ts:21-23,53,62`) |
| Não classificado | 500 | `INTERNAL` | `prismaClassifier` (`backend/services/glucose-service/src/middleware/prismaClassifier.ts:17`), sem stack quando `NODE_ENV=production` |

O app lê `code` em `AuthCubit._mapErrorCode` (`lib/features/auth/presentation/cubit/auth_cubit.dart:173-183`) e no interceptor de sessão `ApiClient`/`SessionExpiryNotifier` (`lib/core/session/session_expiry_notifier.dart`, `lib/core/api/api_client.dart`): só `TOKEN_INVALID` apaga o token e sinaliza logout; `INVALID_CURRENT_PASSWORD` mantém a sessão e mostra o erro na tela atual.

## Autorização por papel (`requireRole`)

`verifyJwt` e `requireRole` vivem em `backend/packages/shared/src/auth/middleware.ts` e são os
mesmos nos dois serviços; cada um injeta o seu `getJwtSecret`.

**O papel vem da claim, não do banco.** O desenho anterior lia `User.role` a cada requisição para
que rebaixar um usuário valesse na hora. Isso deixou de pagar quando a identidade foi para trás de
uma fronteira de rede: a consulta viraria um round-trip ao auth-service em cada request — inclusive
no sync de leituras, a rota de maior volume — para proteger um caso que quase não existe, já que o
app só tem contas `PATIENT`. Os perfis web saem ganhando: token de 1 h com revogação, em vez de 30
dias sem revogação nenhuma.

Um token **sem** `role` — todo token emitido antes dessa mudança — é rejeitado, não assumido como
paciente. Aplicado em `router.use(requireRole('PATIENT'))` nos cinco módulos de dados.

## Trilha de auditoria (`AuditLog`)

`recordAudit` grava em `AuditLog` (`backend/services/glucose-service/prisma/schema.prisma`, modelo `AuditLog`) o `userId`, a entidade, a ação, `entityId`, `metadata` sanitizado, `ipAddress` e `userAgent`. O comportamento vive em `backend/packages/shared/src/audit/audit.ts:86`, que recebe o `AuditClient` por parâmetro para não depender de um `PrismaClient` específico; `backend/services/glucose-service/src/lib/audit.ts:17` amarra a esse serviço, mantendo a assinatura no ponto de chamada. É best-effort: nunca lança para o chamador — uma falha de auditoria não pode derrubar a gravação de um registro de insulina — e nunca persiste senha, hash ou token: `sanitizeMetadata` (`backend/packages/shared/src/audit/audit.ts:72`) remove qualquer chave cujo nome combine com `/password|token/i`, em qualquer nível de aninhamento.

**Uma tabela por serviço.** `glucore_auth.AuditLog` grava `REGISTER`, `LOGIN`, `FORGOT_PASSWORD`,
`RESET_PASSWORD` e `UPDATE_PROFILE`, e **mantém** a FK `userId → User.id ON DELETE SET NULL`, já que
as duas tabelas estão no mesmo banco. `glucore_dev.AuditLog` grava as escritas clínicas
(`/carbs`, `/insulin`, `/alerts`, `/settings/alerts`) com `userId` solto — não existe `User` nesse
banco para referenciar.

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
npm install                   # instala o workspace inteiro; gera os dois clients Prisma
npm run build                 # tsc -b dos 3 projetos + typecheck dos 2 tests/
npm test                      # vitest, os dois serviços — SEMPRE da raiz (ver Armadilhas)
npm run migrate:dev           # migra os dois serviços
npm run dev:glucose           # :3001
npm run dev:auth              # :3002
```

Quatro bancos: `glucore_dev` / `glucore_test` (glucose) e `glucore_auth_dev` / `glucore_auth_test`
(auth). Os de teste vêm de `.env.test` de cada serviço (untracked; copiar do `.env.test.example`).

App físico → backend na máquina: `flutter run --dart-define=API_URL=http://<ip-da-maquina>:3001`.
**O app não funciona ponta a ponta hoje**: o cadastro e o login estão em :3002 e o resto em :3001,
e é o gateway que vai unificar isso.

## Arquivos-chave

Tudo abaixo é relativo a `backend/`.

| Arquivo | Papel |
|---|---|
| `services/auth-service/prisma/schema.prisma` | Identidade: User, AuthCredential, PasswordResetToken, AuthSession |
| `services/auth-service/src/container.ts` | Composition root; escolhe hasher e mailer |
| `services/auth-service/src/lib/{passwordHasher,mailer}.ts` | As duas Strategies |
| `services/auth-service/src/lib/prisma.ts` | Único arquivo que conhece o caminho do client gerado |
| `packages/shared/src/auth/` | claims, jwt (assinatura/verificação), middleware |
| `services/glucose-service/prisma/schema.prisma` | Clínico: Patient, sensores, leituras, eventos |
| `services/glucose-service/src/app.ts` | `buildApp()` — monta o Express, sem porta |
| `services/glucose-service/src/container.ts` | Composition root: instancia repositórios e serviços |
| `services/glucose-service/src/modules/<nome>/` | CRUD de dados em camadas (`routes · controller · service · repository · schema · mapper`) |
| `services/auth-service/src/modules/{accounts,sessions,password}/` | Registro/login/perfil/reset, em camadas |
| `services/glucose-service/src/middleware/auth.ts` | `verifyJwt`, `requireRole` |
| `services/glucose-service/src/middleware/prismaClassifier.ts` | Traduz erro do Prisma em `{status, code}` |
| `services/glucose-service/src/lib/patient.ts` | `ensurePatient` (upsert) |
| `packages/shared/src/errors/` | `AppError`, subclasses HTTP, `createErrorHandler(classifiers)` |
| `packages/shared/src/http/asyncHandler.ts` | Wrapper de erro async |

## Armadilhas

- Migração `add_day_of_week_to_insulin_event` pode não estar aplicada no banco local — rodar `npm run migrate:dev` antes de testar insulina.
- **Rodar `npm test` sempre da raiz de `backend/`.** De dentro de um serviço, o Vitest usa só o
  config daquele projeto e perde `fileParallelism: false` / `maxWorkers: 1`, que são opções de raiz
  — dois arquivos passam a dar `TRUNCATE` concorrente no mesmo banco e a suíte falha de forma
  aleatória.
- **Em `auth-service`, nunca importar de `'@prisma/client'`.** Esse é o client do glucose; o deste
  serviço está em `generated/prisma` e é reexportado por `src/lib/prisma.ts`. Misturar os dois faz
  todo `instanceof` falhar em silêncio — na prática, todo erro do Prisma vira 500.
- **Os dois serviços precisam do mesmo `JWT_SECRET`** enquanto não houver gateway.
- `JWT_SECRET` sem env **não** tem fallback: `loadEnv()` lança `MissingEnvError` e o processo sai 1. (A antiga queda em `'dev-secret'` do §P11 não existe mais.)
- Enum `AlertType` do DB ≠ enum `AppAlertType` do app; o mapeamento (padrão Adapter) vive em `services/glucose-service/src/modules/alerts/alerts.mapper.ts` (FAST_DROP/FAST_RISE viram `syncFailure` na volta — lossy, e travado por teste de caracterização de propósito).
- `GlucoseReading` tem unique `[patientId, recordedAt]` — dois posts com mesmo timestamp sobrescrevem, não duplicam.
