# Glucore backend

API REST do app Glucore: autenticação JWT e CRUD dos dados do paciente (leituras de glicose, carboidratos, insulina, alertas e limiares). Node + Express + Prisma sobre PostgreSQL.

> **Estado atual:** dois serviços, dois bancos, **sem gateway ainda**. O cadastro e o login estão em
> `:3002` e o resto em `:3001`, então não existe um endereço único — o app Flutter está fora de
> escopo até o gateway chegar. Ver "Arquitetura" e a issue de microserviços.

O app Flutter é offline-first: escreve local primeiro e empurra para cá em background (`PatientSyncService`). Esta API é o destino desse push e a fonte de reconciliação, não o caminho crítico da UI.

## Arquitetura

O backend é um **monorepo npm workspaces**. Dois dos três serviços do alvo existem; falta o
`gateway`.

```
backend/
  package.json                 # workspaces: packages/*, services/*
  tsconfig.base.json           # composite: true — project references, não `paths`
  vitest.config.ts             # opções de RAIZ (projects, coverage, paralelismo)
  packages/shared/src/         # sem dono de banco: errors/, http/, util/, audit/, auth/
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
órfão, o que torna `DELETE /account` uma operação cross-service obrigatória — ainda não construída.

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

Módulos do `glucose-service`: `readings`, `carbs`, `insulin`, `alerts`, `settings`, `patient`.
Do `auth-service`: `accounts`, `sessions`, `password` — divididos por **o que cada um escreve**, e
não por forma de URL, e é por isso que `/register` e `/login` acabam em módulos diferentes apesar de
vizinhos no path.

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
# os dois .env precisam do MESMO JWT_SECRET: o auth assina, o glucose verifica.
# Segredos diferentes fazem todo request autenticado responder 401.

npm run migrate:dev           # migra os dois serviços
npm run dev:glucose           # http://localhost:3001
npm run dev:auth              # http://localhost:3002 (outro terminal)
```

Outros comandos, todos a partir de `backend/`:

| Comando | O que faz |
|---|---|
| `npm run build` | `tsc -b` dos 3 projetos **e** typecheck dos dois `tests/` |
| `npm test` | Vitest, 337 testes nos dois serviços. **Sempre da raiz** — ver abaixo |
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

**Rodar `npm test` sempre da raiz de `backend/`.** De dentro de um serviço, o Vitest lê só o config
daquele projeto e perde `fileParallelism: false` / `maxWorkers: 1`, que são opções de raiz. Aí dois
arquivos dão `TRUNCATE` concorrente no mesmo banco e a suíte falha de forma aleatória, num ponto que
não tem nada a ver com a causa.

O app conecta com `--dart-define=API_URL=http://<ip-da-máquina>:3001`. Sem esse define, o padrão é `http://localhost:3001` (`lib/core/api/api_client.dart`) — que só funciona em emulador, não em device físico.

## Variáveis de ambiente

| Variável | Obrigatória | Efeito |
|---|---|---|
| `JWT_SECRET` | **sim** | Segredo de assinatura do JWT. Ausente ou vazio, `loadEnv()` lança `MissingEnvError` e o bootstrap sai com código 1 — o processo **não sobe** (`services/glucose-service/src/lib/env.ts`, `src/index.ts`). Não existe fallback de desenvolvimento. O `throw` é deliberado no lugar de `process.exit`: um `exit` alcançável por import derruba o worker do runner de teste sem falha reportada e sem saída. |
| `DATABASE_URL` | **sim** | String de conexão PostgreSQL usada pelo Prisma (`services/glucose-service/prisma/schema.prisma`). |
| `PORT` | não | Porta HTTP. Padrão `3001`. |
| `CORS_ORIGIN` | não | Lista de origens separadas por vírgula. Definida, restringe o CORS a elas; ausente, o CORS fica permissivo (conveniente em desenvolvimento, **defina em produção**). |
| `NODE_ENV` | não | Fora de `production`, o handler de erro imprime o stack trace no log. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | não | Envio do e-mail de recuperação de senha. Sem configuração, o token é impresso no console e a resposta ao cliente não muda. |

## Convenções

- **Autenticação**: `Authorization: Bearer <token>`. O token sai de `POST /auth/register` e `POST /auth/login` e vale 30 dias.
- **Autorização**: as rotas de dados do paciente exigem papel `PATIENT`, lido do banco a cada requisição (não do JWT), então um rebaixamento vale na hora.
- **Erros**: toda falha de autenticação e de banco responde `{ "error": "...", "code": "..." }`. O app decide pelo `code`, nunca pelo status isolado — `401` significa coisas diferentes em "token inválido" e em "senha atual errada".
- **Tempo**: todo timestamp de entrada e saída é epoch em milissegundos (`timestampMs`, `timeMs`).
- **Senha forte**: mínimo 8 caracteres com maiúscula, minúscula, dígito e caractere não alfanumérico (`services/glucose-service/src/lib/passwordPolicy.ts`). Vale em cadastro, redefinição e troca no perfil; **não** vale no login.

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

### Limite de taxa

| Rotas | Limite |
|---|---|
| `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password` | 10 requisições / 15 min por IP |
| `POST /auth/register` | 20 requisições / 15 min por IP |

Excedido, a resposta é `429 Too Many Requests` com os headers padrão `RateLimit-*`.

---

## `/auth` — **auth-service, porta 3002**

> **Duas regressões conhecidas até o gateway existir**, ambas por a fatia de paciente estar em outro
> banco:
> 1. **`POST /auth/register` grava só a conta.** `birthDate`, `diabetesType`, `weightKg` e
>    `targetRange` são aceitos no corpo mas não têm destino: o `Patient` nasce com os defaults
>    80/180 na primeira requisição de dados ao `glucose-service` (`ensurePatient`). A saga de
>    registro no gateway é o que recupera esses campos.
> 2. **`GET/PUT /auth/profile` respondem só o bloco de conta.** O bloco `patient` volta quando o
>    gateway compuser as duas metades.

### `POST /auth/register` — cria conta

Sem autenticação. Obrigatórios: `email` válido, `password` forte, `fullName` com 3+ caracteres. Opcionais: `phone`, `birthDate` (`YYYY-MM-DD` ou `DD/MM/YYYY`), `diabetesType`, `weightKg` (> 0), `targetRangeMin`/`targetRangeMax` (padrão 80/180, min < max) — **os quatro últimos não são persistidos hoje**.

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

### `GET /carbs` — últimas 100 entradas

```json
[
  { "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "grams": 45, "description": "almoço", "timeMs": 1751800000000 }
]
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

### `GET /insulin` — últimas 100 entradas

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

### `GET /alerts` — últimos 100 alertas

O tipo é traduzido para o vocabulário do app (`glucoseLow`, `glucoseHigh`, `sensorReconnected`, `syncFailure`):

```json
[
  { "type": "glucoseLow", "timestampMs": 1751800000000 }
]
```

### `POST /alerts` — substituição em lote

Apaga os alertas do paciente e grava a lista enviada (máximo 100). Aceita tanto o vocabulário do app quanto os nomes do enum do banco (`HYPO_RISK`, `HYPER_RISK`, `SENSOR_RECONNECTED`, `SYNC_FAILURE`, `FAST_DROP`, `FAST_RISE`); tipo desconhecido vira `SYNC_FAILURE`.

```json
{ "alerts": [ { "type": "glucoseHigh", "timestampMs": 1751800000000 } ] }
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

## Auditoria

Operações relevantes (login, registro, recuperação e troca de senha, alteração de perfil, escrita e remoção de dados clínicos) gravam uma linha em `AuditLog` com usuário, entidade, ação, id da entidade, IP e user agent. A gravação é best-effort: falha nela é logada e **não** aborta a operação de negócio — perder a trilha é menos grave que perder um registro de insulina do paciente.

A trilha nunca guarda senha, hash, token de redefinição nem valores de campo; em alteração de perfil registra apenas os **nomes** dos campos alterados.

**Uma tabela por serviço.** `glucore_auth.AuditLog` guarda `REGISTER`, `LOGIN`, `FORGOT_PASSWORD`,
`RESET_PASSWORD` e `UPDATE_PROFILE`, e **mantém** a FK `userId → User.id ON DELETE SET NULL` — as
duas tabelas estão no mesmo banco, e `SetNull` em vez de `Cascade` porque apagar uma conta não pode
apagar o registro do que ela fez. `glucore_dev.AuditLog` guarda as escritas clínicas com `userId`
solto: não existe `User` naquele banco para referenciar.

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
