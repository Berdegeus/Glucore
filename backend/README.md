# Glucore backend

API REST do Glucore: autenticação JWT por papel, CRUD dos dados do paciente (leituras de glicose, carboidratos, insulina, alertas e limiares), métricas do dashboard, consentimento paciente→profissional, carteira do profissional e visão do administrador. Node + Express + Prisma sobre PostgreSQL.

Dois clientes: o app Flutter (paciente) e o dashboard web em `web/` (paciente, profissional de saúde e administrador). Os dois falam só com o gateway.

> **Estado atual:** três serviços — `gateway` (:3000, único endereço público, prefixo `/api/v1`),
> `auth-service` (:3002) e `glucose-service` (:3001) — e dois bancos. Service Discovery por
> `ServiceRegistry` (env ou Consul) e `docker compose up --build` sobem tudo. O app Flutter fala só com o gateway
> (`<API_URL>/api/v1`): ver "Rotas do gateway".

O app Flutter é offline-first: escreve local primeiro e empurra para cá em background (`PatientSyncService`). Esta API é o destino desse push e a fonte de reconciliação, não o caminho crítico da UI.

## Arquitetura

O backend é um **monorepo npm workspaces** com três serviços.

```
backend/
  package.json                 # workspaces: packages/*, services/*
  tsconfig.base.json           # composite: true — project references, não `paths`
  vitest.config.ts             # opções de RAIZ (projects, coverage, paralelismo)
  packages/shared/src/         # sem dono de banco: errors/, http/, util/, audit/, auth/
  services/gateway/            # :3000, sem banco — entrada única, /api/v1
  services/auth-service/       # :3002, banco glucore_auth — identidade
  services/glucose-service/    # :3001, banco glucore_dev — dado clínico
```

### A fronteira: identidade, não domínio clínico

`User`, `AuthCredential`, `PasswordResetToken` e `AuthSession` vivem no `auth-service`. Todo o resto
— `Patient`, sensores, leituras, carboidratos, insulina, alertas, relatórios — fica no
`glucose-service`.

Das 20 FKs originais, **17 permanecem**: a cadeia sensor → binding → paciente → leitura continua
íntegra dentro do banco clínico e ainda cascateia. As três cortadas apontavam para `User`, e hoje
`Patient.userId`, `HealthProfessional.userId` e `Administrator.userId` são UUIDs soltos. O que
atravessa entre os serviços é o `userId` dentro do JWT, e nada mais.

**O que se perdeu:** o `ON DELETE CASCADE` de `User → Patient`. O banco já não previne paciente
órfão, o que torna `DELETE /api/v1/account` uma operação cross-service obrigatória — o gateway a orquestra (ver "Rotas do gateway").

### Dois clients Prisma

Cada serviço gera o seu. O do `auth-service` sai em `services/auth-service/generated/prisma`, e não
no `node_modules/.prisma/client` da raiz: aquele diretório é único no workspace e os dois serviços
rodam `prisma generate` no install, então o último venceria e o outro compilaria contra um schema
que não é o dele.

Consequência que morde em silêncio: **em `auth-service`, importar `Prisma` de `'@prisma/client'`
está errado**. São classes diferentes, todo `instanceof` seria falso, e todo `P2002` viraria 500.
Importe de `src/lib/prisma.ts` — o único arquivo que conhece o caminho gerado.

`packages/shared` **não depende de `@prisma/client`**: o contrato de erro é uma cadeia de
classifiers (`createErrorHandler`), e o link que conhece Prisma vive no serviço. É o que permitirá
ao gateway consumir o mesmo handler sem arrastar um cliente de banco que ele não usa.

Dentro do serviço, cada área de domínio é um módulo com camadas explícitas:

```
src/modules/<nome>/
  <nome>.routes.ts       Router, zero lógica
  <nome>.controller.ts   só req/res
  <nome>.service.ts      regra de negócio; lança AppError; sem express, sem prisma
  <nome>.repository.ts   I<Nome>Repository + Prisma<Nome>Repository
  <nome>.schema.ts       validação e tipos
  <nome>.mapper.ts       linha Prisma <-> DTO
```

Módulos do `glucose-service`: `readings`, `carbs`, `insulin`, `alerts`, `settings`, `patient`,
`dashboard`, `sharing` (convites e vínculos), `professional` (carteira do profissional),
`professionals` (perfil do profissional, só interno) e `admin` (estatísticas, só interno).
Do `auth-service`: `accounts`, `sessions`, `password`, `preferences` (layout do dashboard),
`admin` e `internal` — `accounts`, `sessions` e `password` são divididos por **o que cada um escreve**,
e não por forma de URL, e é por isso que `/register` e `/login` acabam em módulos diferentes apesar
de vizinhos no path.

As dependências são injetadas por construtor a partir do `src/container.ts` de cada serviço,
escrito à mão — nesse tamanho o wiring é três linhas por módulo e continua tipado, enquanto um
container com decorators custaria um passo de build de metadados e esconderia o grafo.

O container do `auth-service` é também onde as duas **Strategies** são escolhidas:
`BcryptPasswordHasher` (o custo é argumento de construtor, não uma pergunta sobre `NODE_ENV`) e o
`Mailer` (`SmtpMailer` ou `ConsoleMailer`, decidido por configuração e não por `catch`).

`buildApp(options)` monta o Express **sem** chamar `listen`, e aceita um `container` opcional — é o
que permite `request(buildApp())` no supertest e repositórios em memória nos testes de unidade.

## Setup

```bash
cd backend
npm install                   # instala o workspace e gera os dois clients Prisma

createdb glucore_dev && createdb glucore_auth_dev
cp services/glucose-service/.env.example services/glucose-service/.env
cp services/auth-service/.env.example     services/auth-service/.env
cp services/gateway/.env.example         services/gateway/.env
# os três .env precisam do MESMO JWT_SECRET (o auth assina, gateway e glucose verificam) e do
# MESMO INTERNAL_JWT_SECRET. Segredos diferentes fazem todo request autenticado responder 401.

npm run migrate:dev           # migra os dois serviços
npm run dev:glucose           # http://localhost:3001
npm run dev:auth              # http://localhost:3002 (outro terminal)
npm run dev:gateway           # http://localhost:3000 (outro terminal) — o endereço que o cliente usa
```

Outros comandos, todos a partir de `backend/`:

| Comando | O que faz |
|---|---|
| `npm run build` | `tsc -b` dos 3 projetos **e** typecheck dos dois `tests/` |
| `npm test` | Vitest nos três serviços. **Sempre da raiz** — ver abaixo |
| `npm run test:coverage` | Idem com cobertura v8; os thresholds reprovam numa queda |
| `npm run migrate:deploy` | Aplica migrations num ambiente já provisionado |

Não use `npx tsc --noEmit`: sem `tsconfig.json` na raiz ele não acha projeto, **imprime o texto de
ajuda e sai 0**. E `--noEmit` é incompatível com `composite: true`, que as project references
exigem. `npm run build` é a checagem de tipos.

Os testes de integração rodam contra um Postgres real, não contra um mock — é a única forma de
verificar as constraints e o SQL. **Um banco por serviço, no teste também:** `glucore_test` e
`glucore_auth_test`, cada URL vindo do `.env.test` do respectivo serviço (copiar do
`.env.test.example`; por máquina, não versionado). Apontar os dois para o mesmo banco deixaria um
fixture de um serviço mascarar uma tabela faltando no outro — exatamente o acoplamento que o split
existe para remover.

**Os nomes das variáveis de teste são diferentes:** `TEST_DATABASE_URL` no `glucose-service` e
`TEST_AUTH_DATABASE_URL` no `auth-service` (`services/auth-service/tests/helpers/testEnv.ts`, mesmos nomes
do CI em `.github/workflows/ci.yml`). Os dois `.env.test` são carregados no mesmo processo quando a
raiz roda as duas suítes, e o `dotenv` não sobrescreve variável já definida. Se o do auth também
definisse `TEST_DATABASE_URL`, o primeiro arquivo lido venceria nos dois projetos e as duas suítes
truncariam o mesmo banco.

**Rodar `npm test` sempre da raiz de `backend/`.** De dentro de um serviço, o Vitest lê só o config
daquele projeto e perde `fileParallelism: false` / `maxWorkers: 1`, que são opções de raiz. Aí dois
arquivos dão `TRUNCATE` concorrente no mesmo banco e a suíte falha de forma aleatória, num ponto que
não tem nada a ver com a causa.

Subir tudo de uma vez: `docker compose up --build` em `backend/` (Postgres, Consul, os três serviços; só o
gateway publica porta, `3000:3000`). Em dev sem Docker: `npm run dev:auth`, `dev:glucose` e `dev:gateway`.

O app lê `--dart-define=API_URL=http://<ip>:3000` (padrão `http://localhost:3000`): o host do gateway, **sem**
`/api/v1`, que o `ApiClient` acrescenta (`lib/core/api/api_client.dart`). Emulador Android: `http://10.0.2.2:3000`.

## Variáveis de ambiente

| Variável | Obrigatória | Efeito |
|---|---|---|
| `JWT_SECRET` | **sim** | Segredo de assinatura do JWT. Ausente ou vazio, `loadEnv()` lança `MissingEnvError` e o bootstrap sai com código 1 — o processo **não sobe** (`src/lib/env.ts` e `src/index.ts` de cada serviço). Não existe fallback de desenvolvimento. O `throw` é deliberado no lugar de `process.exit`: um `exit` alcançável por import derruba o worker do runner de teste sem falha reportada e sem saída. |
| `DATABASE_URL` | **sim** | String de conexão PostgreSQL usada pelo Prisma (`services/glucose-service/prisma/schema.prisma`). |
| `PORT` | não | Porta HTTP. Padrões: gateway `3000`, glucose `3001`, auth `3002`. |
| `CORS_ORIGIN` | em produção | Lista de origens separadas por vírgula. Definida, restringe o CORS a elas; ausente, fica permissivo em desenvolvimento, mas **em `NODE_ENV=production` o serviço não sobe sem ela**. |
| `INTERNAL_JWT_SECRET` | **sim** (gateway, auth, glucose) | Segredo do token interno de serviço→serviço (rotas `/internal/*`). Sem ele o processo não sobe. |
| `AUTH_SERVICE_URL` / `GLUCOSE_SERVICE_URL` | não (gateway) | Destinos usados quando `SERVICE_DISCOVERY=env`. Padrões `http://localhost:3002` / `:3001`. |
| `SERVICE_DISCOVERY` / `CONSUL_HTTP_ADDR` | não | `env` (padrão) ou `consul`; endereço do Consul (padrão `http://localhost:8500`). |
| `NODE_ENV` | não | Fora de `production`, o handler de erro imprime o stack trace no log. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | não | Envio do e-mail de recuperação de senha. Sem configuração, o token é impresso no console e a resposta ao cliente não muda. |
| `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` | em produção, no primeiro boot (auth) | Cria o primeiro `ADMINISTRATOR` no boot do auth-service (`services/auth-service/src/lib/adminSeed.ts`). É o **único** jeito de existir uma conta de administrador: nenhuma rota cria uma. Só age quando não existe nenhum administrador; depois disso nem lê as variáveis, nunca duplica e nunca redefine a senha. Ausentes: em desenvolvimento o seed é pulado com uma linha de log; em `NODE_ENV=production` o serviço não sobe. Presentes mas inválidas (senha fraca pela política de senha, e-mail malformado, e-mail de uma conta não administradora) o serviço não sobe em nenhum ambiente. A mensagem de erro cita a variável, nunca a senha. |

## Convenções

- **Autenticação**: `Authorization: Bearer <token>`. O token sai de `POST /auth/register` e `POST /auth/login` e vale 30 dias.
- **Autorização**: três papéis, lidos da claim `role` do JWT (não do banco): `PATIENT`, `HEALTH_PROFESSIONAL` e `ADMINISTRATOR`. Token sem `role` é rejeitado. As rotas de dados do paciente exigem `PATIENT`; `/professional/*` e `POST /sharing/redeem` exigem `HEALTH_PROFESSIONAL`; `/admin/*` exige `ADMINISTRATOR`. O token do paciente vale 30 dias; os dos dois papéis web valem 1 h (`packages/shared/src/auth/jwt.ts`), renovados por `POST /auth/refresh`, que lê `AuthSession.isRevoked`.
- **Erros**: toda falha de autenticação e de banco responde `{ "error": "...", "code": "..." }`. O app decide pelo `code`, nunca pelo status isolado — `401` significa coisas diferentes em "token inválido" e em "senha atual errada".
- **Tempo**: todo timestamp de entrada e saída é epoch em milissegundos (`timestampMs`, `timeMs`).
- **Senha forte**: mínimo 8 caracteres com maiúscula, minúscula, dígito e caractere não alfanumérico (`services/auth-service/src/lib/passwordPolicy.ts`). Vale em cadastro, redefinição e troca no perfil; **não** vale no login.

### Códigos de erro

| `code` | Status | Quando |
|---|---|---|
| `TOKEN_INVALID` | 401 | Header ausente, malformado ou token inválido/expirado. O app desloga. |
| `INVALID_CURRENT_PASSWORD` | 401 | Senha atual errada em `PUT /auth/profile`. O app **não** desloga. |
| `FORBIDDEN_ROLE` | 403 | Usuário autenticado sem o papel exigido pela rota. |
| `EMAIL_TAKEN` | 409 | E-mail já cadastrado (registro ou troca de e-mail). |
| `WEAK_PASSWORD` | 400 | Senha nova viola a política de força. |
| `DUPLICATE_RECORD` | 409 | Violação de unicidade no banco. |
| `RELATED_RECORD_MISSING` | 409 | Violação de chave estrangeira. |
| `RECORD_NOT_FOUND` | 404 | Registro exigido pela operação não existe. |
| `DATABASE_UNAVAILABLE` | 503 | Banco inacessível. |
| `INTERNAL` | 500 | Falha não classificada. |
| `INVALID_LAYOUT` | 400 | Corpo de `PUT /preferences/dashboard` inválido: widget fora do catálogo do papel, repetido, tamanho fora de `S`/`M`/`L` ou mais de 20 itens. Nada é gravado. |
| `INVALID_DASHBOARD_RANGE` | 400 | Período inválido: `from`/`to`/`bucket` de `/dashboard/summary` e do resumo de paciente do profissional, `days` fora de 7/14/30/90 na carteira ou fora de 7/30/90 em `/admin/overview`. |
| `INVALID_TIMEZONE` | 400 | `tz` malformado ou desconhecido do Postgres (`pg_timezone_names`). |
| `INVALID_INVITE` | 400 | Código de convite desconhecido, expirado, já usado ou substituído — uma resposta só para os quatro casos. |
| `NO_ACTIVE_GRANT` | 403 | Profissional sem vínculo ativo com o paciente (revogado, expirado ou nunca concedido dão a mesma resposta). |
| `PROFESSIONAL_PROFILE_MISSING` | 403 | `POST /sharing/redeem` por uma conta `HEALTH_PROFESSIONAL` sem perfil profissional no glucose-service. |
| `INVALID_FILTER` | 400 | `role`, `status` ou `q` inválido em `/admin/users`. |
| `INVALID_PAGINATION` | 400 | `limit`/`before` das listas do diário (ver **Paginação**); `page`/`limit` de `/professional/patients` e `/admin/users`. |
| `RATE_LIMITED` | 429 | Limite de `POST /sharing/redeem` excedido. |
| `PARTIAL_UPDATE` | 502 | `PUT /me`: a conta foi atualizada e o bloco de paciente falhou. |
| `UPSTREAM_UNAVAILABLE` | 503 | O gateway não alcançou o serviço de destino. |

### Limite de taxa

Vive no **gateway** (`services/gateway/src/middleware/rateLimiters.ts`), não nos serviços: atrás do
gateway o `req.ip` dos serviços é o do próprio gateway, e um limiter ali contaria todo mundo como um
único cliente. Desligado sob `NODE_ENV=test`.

| Rotas | Limite |
|---|---|
| `POST /api/v1/auth/login`, `/forgot-password`, `/reset-password` | 10 requisições / 15 min por IP |
| `POST /api/v1/auth/register` | 20 requisições / 15 min por IP |
| `POST /api/v1/auth/register/professional` | 20 requisições / 15 min por IP, contador próprio (não soma com o do registro de paciente) |
| `POST /api/v1/sharing/redeem` | 10 requisições / 15 min **por usuário** (o `userId` do token; sem ele, o IP) |

Excedido, a resposta é `429 Too Many Requests` com os headers padrão `RateLimit-*`. O de
`/sharing/redeem` responde `{ "error": "Too many requests", "code": "RATE_LIMITED" }`; ele conta por
usuário para que vários profissionais atrás da mesma rede de clínica não se bloqueiem, e para que um
usuário não fuja do limite trocando de IP.

### CORS

O gateway expõe `Retry-After` e `X-Degraded` (`exposedHeaders` em `services/gateway/src/app.ts`). Sem
isso o navegador esconde os dois do JavaScript da web. `X-Degraded` marca uma composição parcial:
`patient-profile`/`professional-profile` em `GET /me`, `professional-names` em `GET /sharing/grants` e
`patient-names` em `/professional/patients` e `/professional/cohort/summary`.

> **Restrição de deploy:** o `auth-service` **nunca** deve ser publicado diretamente — sem o gateway,
> `POST /auth/login` fica sem limite. No compose só o gateway tem porta publicada.

---

## Rotas do gateway — **gateway, porta 3000, prefixo `/api/v1`**

Único endereço que o cliente deve usar. Código: `services/gateway/src/app.ts`.

| Rota pública | Destino | Observação |
|---|---|---|
| `POST /api/v1/auth/register` | **saga** gateway | Cria a conta no auth-service e o `Patient` (com `birthDate`, `diabetesType`, `weightKg`, `targetRange`) no glucose-service; se a segunda perna falha, compensa apagando a conta. Falha da própria compensação é logada (`saga.compensation_failed`), não fechada. |
| `POST /api/v1/auth/register/professional` | **saga** gateway | Conta `HEALTH_PROFESSIONAL` no auth-service + perfil profissional no glucose-service, com a mesma compensação. Ver abaixo. |
| `/api/v1/auth/*` (login, status, profile, forgot/reset-password, refresh) | proxy → auth-service `/auth/*` | O caminho relativo é o mesmo da seção `/auth` abaixo. `profile` responde só o bloco de conta; para conta+perfil use `/me`. |
| `GET/PUT /api/v1/me` | **composição por papel** | Ver abaixo. |
| `DELETE /api/v1/account` | **orquestração por papel** | Apaga o perfil clínico do papel e depois a conta. Ver abaixo. |
| `GET /api/v1/sharing/grants` | **composição** | Vínculos do glucose-service + nomes dos profissionais do auth-service. |
| `GET /api/v1/professional/patients`, `GET /api/v1/professional/cohort/summary` | **composição** | Métricas do glucose-service + nomes dos pacientes do auth-service. |
| `GET /api/v1/admin/overview`, `GET /api/v1/admin/users` | **composição** | Só `ADMINISTRATOR`. Não existe proxy para `admin`: outro caminho sob o prefixo é 404. |
| `/api/v1/{readings,carbs,insulin,alerts,settings,dashboard,sharing,professional}` | proxy autenticado → glucose-service | JWT verificado no gateway; o caminho depois do prefixo é o das seções abaixo. As composições acima são montadas antes e ficam só com os métodos que declaram. |
| `/api/v1/preferences` | proxy autenticado → auth-service | O layout do dashboard é dado de identidade, por isso mora no auth. |

As seções a seguir descrevem as rotas **nos serviços**; via gateway, acrescente `/api/v1`. As rotas
`/internal/*` estão em "Rotas internas", no fim.

### `POST /api/v1/auth/register/professional` — cadastro de profissional

Sem autenticação. Corpo único, que o gateway divide por dono
(`services/gateway/src/modules/registerProfessional/registerProfessional.schema.ts`): `email`,
`password`, `fullName`, `phone` vão para a conta; `licenseNumber` e `specialty` para o perfil. Qualquer
outro campo, `role` incluído, é descartado: o papel é fixado pela rota no auth-service.

```json
{
  "fullName": "Dra. Ana Lima",
  "email": "ana@clinica.com",
  "password": "Senha123!",
  "phone": "(11) 97777-6666",
  "licenseNumber": "CRM-SP 123456",
  "specialty": "Endocrinologia"
}
```

`201 { "userId": "…", "token": "…" }`. Ordem: conta primeiro, perfil depois; se o perfil falha, o
gateway apaga a conta e devolve o erro original. `licenseNumber` (até 40 caracteres) e `specialty` (até
80, medidos depois do `trim`) são obrigatórios; ausentes, vazios ou longos demais, `400 Invalid input`
do glucose-service. Erros da conta: `400 WEAK_PASSWORD`, `409 EMAIL_TAKEN`. Limite de taxa próprio (ver
**Limite de taxa**). Conta de administrador não se cria por rota: ver `ADMIN_SEED_EMAIL`.

### `GET/PUT /api/v1/me` — perfil por papel

`GET` responde o bloco de conta (o mesmo de `GET /auth/profile`) mais um bloco do papel:

| Papel | Bloco | Se o bloco falhar |
|---|---|---|
| `PATIENT` | `patient`: `birthDate`, `diabetesType`, `weightKg`, `targetRangeMin`, `targetRangeMax` | Defaults (`null` e 80/180) e `X-Degraded: patient-profile` |
| `HEALTH_PROFESSIONAL` | `professional`: `userId`, `licenseNumber`, `specialty` | `professional: null` e `X-Degraded: professional-profile` |
| `ADMINISTRATOR` | nenhum | — |

A conta é obrigatória: se o auth-service falha, a resposta inteira falha. Só um `PATIENT` é consultado
em `patients`, porque aquela rota cria o `Patient` quando ele falta.

`PUT` aceita os campos de conta (`fullName`, `phone`, `newEmail`, `newPassword`, `currentPassword`) e,
só para `PATIENT`, os do bloco de paciente. Para os outros papéis os campos de paciente são
ignorados, não rejeitados. A conta é gravada primeiro; se o bloco de paciente falha depois, a resposta
é `502 PARTIAL_UPDATE`.

### `DELETE /api/v1/account` — exclusão por papel

Apaga o perfil clínico e depois a conta (`services/gateway/src/modules/account/account.controller.ts`):
`PATIENT` apaga o `Patient`; `HEALTH_PROFESSIONAL` apaga o `HealthProfessional`, e os vínculos dele
caem junto por FK com cascade; `ADMINISTRATOR` não tem perfil clínico, só a conta é apagada. `204`.
Toda perna é idempotente, então repetir depois de falha parcial é seguro.

## `/auth` — **auth-service, porta 3002**

> **Registro e perfil via gateway.** Chamado direto, `POST /auth/register` grava só a conta e
> `GET/PUT /auth/profile` respondem só o bloco de conta. A fatia de paciente é recuperada pela saga
> `POST /api/v1/auth/register` e por `GET/PUT /api/v1/me` (ver "Rotas do gateway").

### `POST /auth/register` — cria conta

Sem autenticação. Obrigatórios: `email` válido, `password` forte, `fullName` com 3+ caracteres. Opcionais: `phone`, `birthDate` (`YYYY-MM-DD` ou `DD/MM/YYYY`), `diabetesType`, `weightKg` (> 0), `targetRangeMin`/`targetRangeMax` (padrão 80/180, min < max) — **os quatro últimos só são persistidos pela saga do gateway** (`POST /api/v1/auth/register`); direto no auth-service são aceitos e descartados.

```json
{
  "fullName": "Maria Souza",
  "email": "maria@exemplo.com",
  "password": "Senha123!",
  "phone": "(11) 98888-7777",
  "birthDate": "1990-04-23",
  "diabetesType": "TYPE_1",
  "weightKg": 68.5,
  "targetRangeMin": 80,
  "targetRangeMax": 180
}
```

`201`:

```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

Erros: `400 Invalid input`, `400 WEAK_PASSWORD`, `409 EMAIL_TAKEN`.

### `POST /auth/login` — autentica

```json
{ "email": "maria@exemplo.com", "password": "Senha123!" }
```

`200`:

```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

Erros: `400 Invalid input` (campo vazio), `401 Invalid credentials`. A resposta é a mesma para e-mail inexistente e senha errada.

### `GET /auth/status` — valida o token

Bearer obrigatório. `200`:

```json
{ "loggedIn": true, "userId": "6f2a1c34-9e4b-4c21-8b77-2f0a5d6e1b90" }
```

O app usa esta rota no boot; erro de rede aqui **não** derruba a sessão, só `401`.

### `GET /auth/profile` — perfil completo

Bearer obrigatório. `200`:

```json
{
  "id": "6f2a1c34-9e4b-4c21-8b77-2f0a5d6e1b90",
  "email": "maria@exemplo.com",
  "fullName": "Maria Souza",
  "phone": "(11) 98888-7777",
  "status": "ACTIVE",
  "role": "PATIENT",
  "createdAt": "2026-05-03T19:08:32.000Z",
  "patient": {
    "birthDate": "1990-04-23",
    "diabetesType": "TYPE_1",
    "weightKg": 68.5,
    "targetRangeMin": 80,
    "targetRangeMax": 180
  }
}
```

Erro: `404 User not found`.

### `PUT /auth/profile` — atualiza perfil, e-mail ou senha

Bearer obrigatório. Todos os campos são opcionais; só os enviados mudam. Trocar `newEmail` ou `newPassword` exige `currentPassword`.

```json
{
  "currentPassword": "Senha123!",
  "newPassword": "OutraSenha456!",
  "fullName": "Maria S. Souza",
  "targetRangeMin": 90,
  "targetRangeMax": 170
}
```

`200`:

```json
{ "message": "Profile updated." }
```

Mudar a faixa alvo também atualiza os limiares de alerta. Erros: `400 Invalid input`, `400 Current password required`, `400 WEAK_PASSWORD`, `401 INVALID_CURRENT_PASSWORD`, `409 EMAIL_TAKEN`, `404 User not found`.

### `POST /auth/forgot-password` — envia token de redefinição

```json
{ "email": "maria@exemplo.com" }
```

`200` (idêntico para e-mail cadastrado ou não, para não permitir enumeração de contas):

```json
{ "message": "If the email is registered, instructions were sent." }
```

O token expira em 6 h e invalida tokens anteriores não usados. Sem SMTP configurado, ele aparece no log do servidor.

### `POST /auth/reset-password` — redefine com o token

```json
{ "token": "0f6a4d51-2c8e-4c0f-9a3b-71d2e8c4a915", "password": "OutraSenha456!" }
```

`200`:

```json
{ "message": "Password reset successful." }
```

Erros: `400 Invalid input`, `400 WEAK_PASSWORD`, `400 Invalid or expired token` (também para token já usado).

---

## `/readings` — **glucose-service, porta 3001**

Bearer + papel `PATIENT` em todas as rotas.

### `GET /readings` — últimas 288 leituras (24 h a cada 5 min)

`200`, ordenado da mais recente para a mais antiga:

```json
[
  { "value": 104, "timestampMs": 1751800200000, "trend": "steady", "rate": 0.021, "alarmCode": 0 },
  { "value": 98,  "timestampMs": 1751799900000, "trend": "falling", "rate": -1.5, "alarmCode": 0 }
]
```

### `POST /readings` — grava leituras (upsert por horário)

Corpo com no máximo 288 itens; itens além disso são descartados. A chave é `(paciente, recordedAt)`: reenviar a mesma leitura atualiza em vez de duplicar, o que torna o push do app seguro para repetir.

```json
{
  "readings": [
    { "value": 104, "timestampMs": 1751800200000, "trend": "steady", "rate": 0.021, "alarmCode": 0 }
  ]
}
```

`204` sem corpo. Erro: `400 readings must be array`.

### `DELETE /readings` — apaga todas as leituras do paciente

`204` sem corpo.

---

## `/carbs`

Bearer + papel `PATIENT`.

### `GET /carbs` — página de entradas, mais recentes primeiro

Aceita `before` e `limit` (ver **Paginação**). Sem parâmetros, devolve as 100 mais recentes.

```json
[
  { "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "grams": 45, "description": "almoço", "timeMs": 1751800000000 }
]
```

Percorrendo o histórico inteiro, uma página por vez:

```bash
curl -H "Authorization: Bearer $TOKEN" "$API/carbs?limit=200"
# a próxima página começa no timeMs da última entrada devolvida
curl -H "Authorization: Bearer $TOKEN" "$API/carbs?limit=200&before=1751800000000"
```

### `POST /carbs/item` — cria uma entrada

`id` é opcional e, quando enviado, precisa ser UUID: o app gera o id para que a entrada tenha identidade estável antes de sincronizar.

```json
{ "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "grams": 45, "description": "almoço", "timeMs": 1751800000000 }
```

`201`:

```json
{ "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d" }
```

Erros: `400` com a mensagem do campo inválido (`grams must be a number`, `description must be a string`, `timeMs must be a number (epoch ms)`, `id must be a UUID`).

### `PUT /carbs/item/:id` — atualiza uma entrada

```json
{ "grams": 60, "description": "jantar", "timeMs": 1751803600000 }
```

`204` sem corpo. Erros: `400 id must be a UUID`, `400` de campo, `404 not found` (inclusive quando a entrada é de outro paciente).

### `DELETE /carbs/item/:id` — remove uma entrada

`204` sem corpo. Erros: `400 id must be a UUID`, `404 not found`.

### `POST /carbs` — substituição em lote (**deprecated**)

Apaga todas as entradas do paciente e recria a lista enviada (máximo 100). Mantido só para compatibilidade com o app antigo; use as rotas `/item`.

```json
{ "carbs": [ { "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "grams": 45, "description": "almoço", "timeMs": 1751800000000 } ] }
```

`204` sem corpo. Erro: `400 carbs must be array`.

---

## `/insulin`

Bearer + papel `PATIENT`. Mesma estrutura de `/carbs`, com `units`, `type` e `dayOfWeek`.

### `GET /insulin` — página de entradas, mais recentes primeiro

Aceita `before` e `limit` (ver **Paginação**). Sem parâmetros, devolve as 100 mais recentes.

```json
[
  { "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", "units": 6, "type": "bolus", "timeMs": 1751800000000, "dayOfWeek": "MONDAY" }
]
```

### `POST /insulin/item` — cria uma entrada

```json
{ "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", "units": 6, "type": "bolus", "timeMs": 1751800000000, "dayOfWeek": "MONDAY" }
```

`201`:

```json
{ "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e" }
```

Erros `400`: `units must be a number`, `type must be a non-empty string`, `timeMs must be a number (epoch ms)`, `dayOfWeek must be a string`, `id must be a UUID`.

### `PUT /insulin/item/:id` — atualiza uma entrada

```json
{ "units": 8, "type": "basal", "timeMs": 1751803600000, "dayOfWeek": "TUESDAY" }
```

`204` sem corpo. Erros: `400`, `404 not found`.

### `DELETE /insulin/item/:id` — remove uma entrada

`204` sem corpo. Erros: `400 id must be a UUID`, `404 not found`.

### `POST /insulin` — substituição em lote (**deprecated**)

```json
{ "insulin": [ { "units": 6, "type": "bolus", "timeMs": 1751800000000, "dayOfWeek": "MONDAY" } ] }
```

`204` sem corpo. Erro: `400 insulin must be array`.

---

## `/alerts`

Bearer + papel `PATIENT`.

### `GET /alerts` — página de alertas, mais recentes primeiro

Aceita `before` e `limit` como `/carbs` e `/insulin` (ver **Paginação**). Sem parâmetros, devolve os 100 mais recentes. O tipo é traduzido para o vocabulário do app (`glucoseLow`, `glucoseHigh`, `sensorReconnected`, `syncFailure`):

```json
[
  { "id": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f", "type": "glucoseLow", "timestampMs": 1751800000000 }
]
```

### `POST /alerts/item` — cria um alerta

`id` é opcional e, quando enviado, precisa ser UUID.

```json
{ "id": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f", "type": "glucoseHigh", "timestampMs": 1751800000000 }
```

`201`:

```json
{ "id": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f" }
```

Erros: `400 type must be a non-empty string`, `400 timestampMs must be a number (epoch ms)`, `400 id must be a UUID`. Um `type` fora do vocabulário conhecido **não** é rejeitado: vira `SYNC_FAILURE`, como já fazia o endpoint em lote.

### `PUT /alerts/item/:id` — atualiza um alerta

```json
{ "type": "glucoseLow", "timestampMs": 1751803600000 }
```

`204` sem corpo. Erros: `400 id must be a UUID`, `400` de campo, `404 not found` (inclusive quando o alerta é de outro paciente).

### `DELETE /alerts/item/:id` — remove um alerta

`204` sem corpo. Erros: `400 id must be a UUID`, `404 not found`.

### `POST /alerts` — substituição em lote (**deprecated**)

Apaga os alertas do paciente e grava a lista enviada (máximo 100). Mantido só para compatibilidade com o app antigo; use as rotas `/item`. Preserva o `id` enviado pelo cliente. Aceita tanto o vocabulário do app quanto os nomes do enum do banco (`HYPO_RISK`, `HYPER_RISK`, `SENSOR_RECONNECTED`, `SYNC_FAILURE`, `FAST_DROP`, `FAST_RISE`); tipo desconhecido vira `SYNC_FAILURE`.

```json
{ "alerts": [ { "id": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f", "type": "glucoseHigh", "timestampMs": 1751800000000 } ] }
```

`204` sem corpo. Erro: `400 alerts must be array`.

---

## `/settings`

Bearer + papel `PATIENT`.

### `GET /settings/alerts` — limiares de alerta

Sem configuração salva, responde o padrão 80/180:

```json
{ "lowThreshold": 80, "highThreshold": 180 }
```

### `PUT /settings/alerts` — grava os limiares

```json
{ "lowThreshold": 75, "highThreshold": 190 }
```

`204` sem corpo.

---

## `/dashboard` — **glucose-service, porta 3001**

Bearer + papel `PATIENT`. Só leitura; agrega os dados do próprio paciente.

### `GET /dashboard/summary` — métricas do período

| Query | Padrão | Regra |
|---|---|---|
| `from`, `to` | últimos 14 dias até hoje (UTC) | `YYYY-MM-DD`, inclusivos; `from <= to`; intervalo máximo de 90 dias |
| `bucket` | `day` | só `day` está implementado |
| `tz` | `UTC` | nome IANA (`America/Sao_Paulo`); corta os dias e as horas no fuso do usuário. Malformado ou desconhecido do Postgres: `400 INVALID_TIMEZONE` |

Resposta (`DashboardSummaryDto`, `modules/dashboard/dashboard.mapper.ts`):

| Campo | Conteúdo |
|---|---|
| `from`, `to`, `tz` | O período e o fuso usados |
| `lastReadingAt` | Leitura mais recente do paciente, em qualquer período; `null` sem leituras |
| `totals` | Leituras, entradas de carboidrato, de insulina e alertas |
| `timeInRangePercent`, `gmiPercent`, `coefficientOfVariationPercent` | Métricas do período (`null` sem leituras) |
| `sensorUsePercent` | Leituras do período sobre as esperadas (uma a cada 5 min), limitado a 100 |
| `zoneDistribution` | `veryLow`, `low`, `target`, `high`, `veryHigh` em %, soma 100 |
| `byDay[]` | Por dia local: média, mín, máx, tempo no alvo, média móvel de 7 dias, `readingsCount`, `carbsGrams`, `insulinUnits` (0 quando não há registro) |
| `agp[]` | Perfil ambulatorial por hora local: `hour`, `p5`, `p25`, `p50`, `p75`, `p95`, `count` |
| `heatmap[]` | Média por dia da semana × hora local: `dayOfWeek` (0 = domingo), `hour`, `avgGlucose`, `count` |
| `insulinByType[]`, `alertsByType[]` | Agregados por tipo |
| `excursions[]` | Episódios `HYPO`/`HYPER` com início, fim, duração, mín e máx |

**Compatibilidade:** `tz`, `lastReadingAt`, `sensorUsePercent`, `zoneDistribution`, `agp`, `heatmap`,
`byDay[].carbsGrams` e `byDay[].insulinUnits` são aditivos. Sem `tz`, os dias continuam cortados em UTC,
como antes; nenhum campo antigo mudou de nome ou de tipo.

Faixa inválida responde `400 INVALID_DASHBOARD_RANGE`. As métricas vêm das stored functions
`glucose_metrics()` e `glucose_zones()` e de `groupBy`/window functions
(`modules/dashboard/dashboard.repository.ts`). As zonas usam os limiares do paciente:
muito baixo `< min(54, low)`, baixo até `low`, alvo de `low` a `high`, alto até `max(250, high)`, muito
alto acima disso (migration `20261004120000_add_glucose_zones_function`). A migration
`20260831232506_dashboard_metrics_and_constraints` também cria índices parciais e CHECK constraints
(inclusive `lowThreshold < highThreshold`, também validado em `PUT /settings/alerts`). Cliente: o
dashboard web do paciente.

---

## `/preferences` — **auth-service, porta 3002**

Bearer obrigatório, qualquer papel. O dono vem do token, nunca do corpo ou do caminho. Uma linha por
usuário em `DashboardLayout`.

### `GET /preferences/dashboard`

`200 { "widgets": [{ "id": "kpi-tir", "size": "M" }, …] }`, ou `{ "widgets": null }` quando o usuário
nunca salvou (ou resetou) um layout: a web aplica então o padrão do papel.

### `PUT /preferences/dashboard`

```json
{ "widgets": [ { "id": "kpi-tir", "size": "S" }, { "id": "chart-agp", "size": "L" } ] }
```

`200` com o layout gravado. A última escrita vence. Regras (`modules/preferences/preferences.schema.ts`):
`widgets` é array de no máximo 20 itens; cada `id` pertence ao catálogo do papel do token e aparece
uma vez; `size` é `S`, `M` ou `L`. Só `id` e `size` são lidos de cada item. Qualquer violação responde
`400 INVALID_LAYOUT` e nada é gravado.

O catálogo por papel tem como fonte `contracts/widget-catalog.json`, na raiz do repositório, que a web
também lê. O backend usa uma cópia em `packages/shared/src/dashboard/widgetCatalog.ts`; um teste do
auth-service falha se as duas divergirem.

### `DELETE /preferences/dashboard`

`204`. Idempotente: resetar sem layout salvo também é sucesso.

---

## `/sharing` — **glucose-service, porta 3001**

Consentimento: o paciente gera um código e o profissional o resgata, ganhando leitura dos dados do
paciente. Bearer obrigatório; o papel é checado por rota.

| Rota | Papel | Resposta |
|---|---|---|
| `POST /sharing/invites` | `PATIENT` | `201 { "code": "K7MP3QXA", "expiresAt": "…" }` |
| `GET /sharing/grants` | `PATIENT` | `200 { "grants": [...] }` (via gateway, com nomes) |
| `DELETE /sharing/grants/:id` | `PATIENT` | `204`; vínculo de outro paciente ou já revogado: `404` |
| `POST /sharing/redeem` | `HEALTH_PROFESSIONAL` | `201` (vínculo novo) ou `200` (já existia) `{ "patientId": "…", "grantId": "…" }` |

**Convite.** Código de 8 caracteres sem `0`, `O`, `1` e `I`, gerado por CSPRNG, válido por 24 h e de
uso único. Só o hash sha256 é guardado; o código em claro aparece uma vez, na resposta. Gerar um novo
invalida o pendente anterior: um paciente tem no máximo um convite pendente (índice único parcial).

**Resgate.** Corpo `{ "code": "K7MP-3QXA" }`; espaços e hífens são ignorados e a caixa é normalizada.
Código desconhecido, expirado, usado ou substituído: `400 INVALID_INVITE`, com a mesma mensagem nos
quatro casos. Profissional sem perfil: `403 PROFESSIONAL_PROFILE_MISSING`. Resgatar um código de um
paciente que o profissional já acompanha reaproveita o vínculo ativo (`200`). Limite de 10 tentativas
por usuário a cada 15 min, aplicado no gateway (`429 RATE_LIMITED`).

**Lista de vínculos via gateway** (`GET /api/v1/sharing/grants`), só os ativos:

```json
{
  "grants": [
    { "id": "…", "professional": { "fullName": "Dra. Ana Lima", "specialty": "Endocrinologia" }, "grantedAt": "…" }
  ]
}
```

Se o auth-service não responder os nomes, `fullName` vem `null` e a resposta traz
`X-Degraded: professional-names`. Chamado direto no glucose-service, cada item traz `professionalId` e
`specialty`, sem nome.

**Revogação.** Só o paciente revoga. O vínculo ganha `revokedAt` e fica como histórico; a checagem de
vínculo ativo é feita no banco a cada leitura do profissional, sem cache, então a revogação vale na
próxima requisição. Gerar, resgatar e revogar gravam auditoria com os ids, nunca o código.

---

## `/professional` — **glucose-service, porta 3001**

Bearer + papel `HEALTH_PROFESSIONAL`; token de paciente responde `403 FORBIDDEN_ROLE`. O profissional
só vê pacientes com vínculo ativo. Toda leitura grava auditoria (`READ`, `READ_LIST`, `READ_COHORT`) com
o profissional, o paciente quando há um e a rota, nunca valor de glicose ou nome.

### `GET /professional/patients` — carteira paginada

| Query | Padrão | Regra |
|---|---|---|
| `days` | `14` | `7`, `14`, `30` ou `90`; outro valor: `400 INVALID_DASHBOARD_RANGE` |
| `tz` | `UTC` | como em `/dashboard/summary` |
| `page` | `1` | inteiro ≥ 1; fora disso, `400 INVALID_PAGINATION` |
| `limit` | `50` | 1 a 200; fora disso, `400 INVALID_PAGINATION` |

Via gateway:

```json
{
  "items": [
    {
      "patientId": "…", "fullName": "Maria Souza", "initials": "MS",
      "lastReadingAt": "…", "timeInRangePercent": 71.5, "gmiPercent": 6.8, "cvPercent": 32.1,
      "sensorUsePercent": 94.2,
      "zoneDistribution": { "veryLow": 0.5, "low": 3, "target": 71.5, "high": 20, "veryHigh": 5 },
      "hypoEpisodes": 2, "alertsCount": 4
    }
  ],
  "page": 1, "limit": 50, "total": 1
}
```

O glucose-service responde sem `fullName` e `initials`; o gateway os acrescenta a partir do auth-service.
Se esse lookup falha, `fullName` vem `null`, `initials` sai do id (`P` + dois primeiros caracteres) e a
resposta traz `X-Degraded: patient-names`. Um paciente cuja conta não existe mais também vem sem nome,
mas isso não é resposta degradada.

### `GET /professional/patients/:id/summary` — resumo de um paciente

Mesmas queries e mesma resposta de `GET /dashboard/summary`, para o paciente `:id` (UUID, senão
`400 id must be a UUID`). Sem vínculo ativo: `403 NO_ACTIVE_GRANT`, a mesma resposta para paciente
inexistente. Passa pelo proxy do gateway, sem composição.

### `GET /professional/cohort/summary` — agregados da carteira

Queries `days` e `tz`, como na lista. Considera os 200 vínculos ativos mais antigos.

```json
{
  "patientCount": 12,
  "avgTimeInRangePercent": 64.3,
  "avgGmiPercent": 7.1,
  "patientsWithHypo": 5,
  "patientsStale": 2,
  "perPatient": [ { "patientId": "…", "fullName": "…", "initials": "MS", "timeInRangePercent": 71.5, "cvPercent": 32.1, "zoneDistribution": { "…": 0 } } ],
  "tirHistogram": [ { "bucket": "lt50", "count": 3 }, { "bucket": "50to70", "count": 4 }, { "bucket": "gte70", "count": 5 } ],
  "hypoByHour": [ { "hour": 0, "count": 1 } ]
}
```

`patientsStale` conta pacientes sem leitura nas últimas 24 h. `hypoByHour` sempre tem as 24 horas
(hora local do `tz`). `fullName`/`initials` em `perPatient` e o `X-Degraded: patient-names` seguem a
regra da lista.

---

## `/admin` — **gateway, só composição**

Bearer + papel `ADMINISTRATOR` no gateway; os serviços checam o papel de novo a partir do token
interno (`requireInternalRole`). Não existe `/admin` público nos serviços.

### `GET /api/v1/admin/overview`

Query `days`: `7`, `30` ou `90` (padrão `30`); outro valor, `400 INVALID_DASHBOARD_RANGE`. As duas
pernas são obrigatórias: se um serviço falha, a resposta falha (`503 UPSTREAM_UNAVAILABLE` quando ele
está fora), sem resposta degradada.

```json
{
  "accounts": { "total": 120, "byRole": [ { "role": "PATIENT", "count": 100 } ], "byStatus": [ { "status": "ACTIVE", "count": 118 } ] },
  "registrationsInPeriod": 14,
  "registrationsByDay": [ { "day": "2026-10-01", "count": 2 } ],
  "activePatients": { "last24h": 40, "last7d": 70, "registered": 100 },
  "readingsByDay": [ { "day": "2026-10-01", "count": 9800 } ],
  "grants": { "active": 30, "createdByWeek": [ { "weekStart": "2026-09-28", "count": 3 } ] },
  "alertsByType": [ { "alertType": "HYPO_RISK", "count": 12 } ]
}
```

`accounts` e `registrations*` vêm do auth-service; o resto, do glucose-service. Dias em UTC. O gateway
monta o corpo campo a campo: um campo novo num serviço só chega ao admin quando o gateway o lista.

### `GET /api/v1/admin/users`

| Query | Padrão | Regra |
|---|---|---|
| `role` | — | valor do enum `UserRole`; senão `400 INVALID_FILTER` |
| `status` | — | valor do enum `UserStatus`; senão `400 INVALID_FILTER` |
| `q` | — | texto buscado em nome e e-mail; repetido na query: `400 INVALID_FILTER` |
| `page` | `1` | inteiro ≥ 1; senão `400 INVALID_PAGINATION` |
| `limit` | `25` | 1 a 100; senão `400 INVALID_PAGINATION` |

`200 { "items": [ { "id", "fullName", "email", "role", "status", "createdAt" } ], "page", "limit", "total" }`,
mais recentes primeiro. Sem telefone e sem credencial. Cada consulta grava `ADMIN_LIST_USERS` na
auditoria do auth-service, com os filtros e a página, nunca as linhas devolvidas.

---

## Rotas internas — `/internal/*`

Não passam pelo gateway como rota pública e só o gateway as chama (`services/gateway/src/clients/`). Toda
chamada leva o header `x-internal-token`, um JWT de 60 s assinado com `INTERNAL_JWT_SECRET`
(`packages/shared/src/auth/internalToken.ts`). `requireInternalAuth` valida o token e põe a identidade
(`sub`, `role`) na requisição; `requireInternalRole` (`packages/shared/src/auth/requireInternalRole.ts`)
checa o papel a partir dessa identidade assinada, nunca de um header solto, e responde `403 FORBIDDEN_ROLE`.

**auth-service**

| Rota | Quem chama | O que faz |
|---|---|---|
| `POST /internal/accounts` | saga de registro de paciente | Cria a conta `PATIENT`, `201 { userId, token }` |
| `POST /internal/accounts/professional` | saga de registro de profissional | Cria a conta `HEALTH_PROFESSIONAL`; o papel é da rota, um `role` no corpo é ignorado |
| `GET/PUT /internal/accounts/me` | `GET/PUT /me` | Bloco de conta do `sub` do token |
| `POST /internal/accounts/lookup` | composições de nomes (vínculos, carteira) | Corpo `{ ids }`, até 200 UUIDs; responde `[{ id, fullName }]`, sem e-mail, telefone ou papel. Id sem conta some da resposta. O gateway divide listas maiores em lotes de 200 |
| `DELETE /internal/accounts/:id` | compensação das sagas, `DELETE /account` | Apaga a conta |
| `GET /internal/admin/stats?days=` | `GET /admin/overview` | Totais de contas e cadastros por dia; exige `ADMINISTRATOR` |
| `GET /internal/admin/users` | `GET /admin/users` | Página de contas, auditada contra o admin do token; exige `ADMINISTRATOR` |

**glucose-service**

| Rota | Quem chama | O que faz |
|---|---|---|
| `POST /internal/patients`, `GET/PUT /internal/patients/me`, `DELETE /internal/patients/:id` | registro de paciente, `/me`, `DELETE /account` | Perfil do paciente |
| `POST /internal/professionals` | saga de registro de profissional | Cria o `HealthProfessional` do `sub` (`licenseNumber`, `specialty`); token de outro papel: `403 FORBIDDEN_ROLE` |
| `GET /internal/professionals/me` | `GET /me` do profissional | `{ userId, licenseNumber, specialty }`; sem perfil, `404` |
| `DELETE /internal/professionals/:id` | compensação, `DELETE /account` | Apaga o perfil (idempotente); os vínculos caem por cascade |
| `GET /internal/admin/stats?days=` | `GET /admin/overview` | Pacientes ativos, leituras por dia, vínculos, alertas por tipo; exige `ADMINISTRATOR` |

Os mesmos serviços expõem rotas públicas que o gateway repassa com o token do usuário, não com o
interno: `GET /sharing/grants`, `GET /professional/patients` e `GET /professional/cohort/summary` são
consumidas assim pelas composições.

---

## Auditoria

Operações relevantes (login, registro, recuperação e troca de senha, alteração de perfil, escrita e remoção de dados clínicos) gravam uma linha em `AuditLog` com usuário, entidade, ação, id da entidade, IP e user agent. A gravação é best-effort: falha nela é logada e **não** aborta a operação de negócio — perder a trilha é menos grave que perder um registro de insulina do paciente.

A trilha nunca guarda senha, hash, token de redefinição nem valores de campo; em alteração de perfil registra apenas os **nomes** dos campos alterados.

**Uma tabela por serviço.** `glucore_auth.AuditLog` guarda `REGISTER`, `REGISTER_PROFESSIONAL`,
`LOGIN`, `FORGOT_PASSWORD`, `RESET_PASSWORD`, `UPDATE_PROFILE`, `SEED_ADMIN` e `ADMIN_LIST_USERS`, e **mantém** a FK `userId → User.id ON DELETE SET NULL` — as
duas tabelas estão no mesmo banco, e `SetNull` em vez de `Cascade` porque apagar uma conta não pode
apagar o registro do que ela fez. `glucore_dev.AuditLog` guarda as escritas clínicas, o
consentimento (`PatientInvite` `CREATE`/`INVALIDATE`/`REDEEM`, `DashboardAccessGrant` `CREATE`/`REVOKE`) e
as leituras do profissional (`READ`, `READ_LIST`, `READ_COHORT`), com `userId` solto: não existe `User`
naquele banco para referenciar.

## Paginação

`GET /carbs`, `GET /insulin` e `GET /alerts` compartilham o mesmo contrato de query string.

| Parâmetro | Tipo | Default | Regra |
| --------- | ---- | ------- | ----- |
| `limit` | inteiro | `100` | entre 1 e 500 |
| `before` | inteiro (epoch ms) | ausente | limite superior **exclusivo**; ausente significa "a partir da mais recente" |

As entradas voltam em ordem decrescente de horário. Uma chamada sem nenhum dos dois preserva o comportamento anterior — as 100 mais recentes —, então o app em campo continua funcionando enquanto o cliente novo é distribuído.

Para virar a página, use o horário da última entrada recebida como `before` da chamada seguinte. Como `before` é exclusivo, nenhuma entrada aparece em duas páginas; um `before` anterior à entrada mais antiga devolve `200` com lista vazia.

Fora da faixa, a resposta é `400` com `error` e `code`:

```json
{ "error": "limit must be an integer between 1 and 500", "code": "INVALID_PAGINATION" }
```

`before` não inteiro ou negativo responde `{ "error": "before must be an epoch in milliseconds", "code": "INVALID_PAGINATION" }`.

## Índices da paginação

As três listagens do diário rodam a mesma consulta: igualdade em `patientId`, faixa em
`< before` sobre a coluna de horário, ordenação decrescente por essa mesma coluna e `take`.
Um índice composto `(patientId, <coluna de horário>)` atende as três partes de uma vez —
filtra pelo prefixo, corta a faixa e já entrega as linhas ordenadas, sem sort adicional.

| Consulta | Índice que a atende | Onde é declarado |
| -------- | ------------------- | ---------------- |
| `GET /carbs` — `where { patientId, eventAt: { lt } }`, `orderBy eventAt desc` | `CarbEvent_patientId_eventAt_idx` | `schema.prisma`, `@@index([patientId, eventAt])` do `CarbEvent` |
| `GET /insulin` — `where { patientId, eventAt: { lt } }`, `orderBy eventAt desc` | `InsulinEvent_patientId_eventAt_idx` | `schema.prisma`, `@@index([patientId, eventAt])` do `InsulinEvent` |
| `GET /alerts` — `where { patientId, triggeredAt: { lt } }`, `orderBy triggeredAt desc` | `AlertEvent_patientId_triggeredAt_idx` | `schema.prisma`, `@@index([patientId, triggeredAt])` do `AlertEvent` |

Os três já existiam e são criados pela migration `20260517172000_domain_model_alignment`.
A verificação não encontrou índice faltando, então esta release não acrescenta migration de
índice. Índice novo só entra se uma consulta nova não for coberta por um destes.

## Modelos do dashboard web

**glucose-service** (`services/glucose-service/prisma/schema.prisma`):

- `HealthProfessional` (`userId`, `licenseNumber`, `specialty`) — perfil criado pela saga de cadastro
  de profissional. Saiu do roadmap.
- `DashboardAccessGrant` — o vínculo paciente→profissional, com `permissionLevel`, `expiresAt` e o novo
  `revokedAt`. Revogar preenche `revokedAt` e mantém a linha como histórico. Índice único parcial: no
  máximo um vínculo ativo por par paciente/profissional. Saiu do roadmap.
- `PatientInvite` (`codeHash` único, `expiresAt`, `usedAt`, `usedBy`, `revokedAt`) — o convite de uso
  único. Índice único parcial: no máximo um convite pendente por paciente. Migration
  `20261005152139_add_invite_and_grant_revocation`.
- Função `glucose_zones()` (migration `20261004120000_add_glucose_zones_function`), ao lado da
  `glucose_metrics()` já existente: as cinco zonas em %, com soma exata de 100.
- Índice BRIN `GlucoseReading_recordedAt_brin_idx` (migration
  `20261006090000_add_reading_recordedat_brin_index`): atende a contagem de leituras por dia de todos os
  pacientes em `/admin/overview`, que nenhum índice iniciado por `patientId` cobre.

**auth-service** (`services/auth-service/prisma/schema.prisma`): `DashboardLayout` (`userId` como chave,
`widgets` JSONB, `updatedAt`), FK para `User` com `ON DELETE CASCADE`. Migration
`20261004220354_add_dashboard_layout`.

## Tabelas de roadmap

Oito modelos do schema do glucose-service não têm rota nesta release e estão anotados com
`/// roadmap` em `services/glucose-service/prisma/schema.prisma`: `Administrator`, `SensorDevice`,
`SensorBinding`, `SensorSession`, `SensorStatusEvent`, `GlucosePrediction`, `ClinicalReport` e
`MetricsSnapshot`. Eles ficam no schema de propósito — descrevem o modelo de domínio planejado. A
anotação existe para que a próxima leitura não os confunda com tabela morta e tente removê-los.
O papel de administrador vive na conta (`User.role` no auth-service); a tabela `Administrator` segue sem uso.

## Migrations

Cada serviço tem o seu schema e o seu histórico. Toda mudança em
`services/<serviço>/prisma/schema.prisma` acompanha a migration versionada em
`services/<serviço>/prisma/migrations/`, no mesmo PR. Aplicar: `npm run migrate:dev` em
desenvolvimento (roda nos dois), `npm run migrate:deploy` em ambiente já provisionado.

A migration `split_identity_out` do `glucose-service` é a que tirou a identidade dali. Vale ler o
SQL dela antes de escrever outra destrutiva: **toda FK é removida antes de qualquer `DROP TABLE`**.
`Patient.userId` referenciava `User.id` com `ON DELETE CASCADE`, e essa cadeia segue até
`GlucoseReading` — derrubar `User` com a constraint de pé levaria o dado clínico junto.

CHECK constraints e índices parciais não são expressáveis no schema do Prisma 5: gerar com `prisma migrate dev --create-only`, editar o SQL à mão e então aplicar.

**Revise todo SQL gerado no `glucose-service`.** O Prisma não declara índice `DESC`, vê o
`GlucoseReading_patientId_recordedAt_desc_idx` (escrito à mão na migration
`20260831232506_dashboard_metrics_and_constraints`) como drift e o `migrate dev` propõe um
`DROP INDEX` dele ao gerar uma migration nova. Apague essa linha antes de aplicar. As migrations
`20261005152139_add_invite_and_grant_revocation` e `20261006090000_add_reading_recordedat_brin_index`
registram esse corte num comentário.
