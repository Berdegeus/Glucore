# Glucore backend

API REST do app Glucore: autenticação JWT e CRUD dos dados do paciente (leituras de glicose, carboidratos, insulina, alertas e limiares). Node + Express + Prisma sobre PostgreSQL.

O app Flutter é offline-first: escreve local primeiro e empurra para cá em background (`PatientSyncService`). Esta API é o destino desse push e a fonte de reconciliação, não o caminho crítico da UI.

## Setup

```bash
cd backend
npm install
cp .env.example .env          # preencha DATABASE_URL e JWT_SECRET
npx prisma migrate dev        # cria/atualiza o schema e gera o client
npm run dev                   # sobe em http://localhost:3001
```

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run build` | Compila TypeScript para `dist/` |
| `npm start` | Roda o build de `dist/index.js` |
| `npm test` | Suíte do runner nativo do Node (`node --test`), sem banco |
| `npx tsc --noEmit` | Checagem de tipos isolada |

O app conecta com `--dart-define=API_URL=http://<ip-da-máquina>:3001`. Sem esse define, o padrão é `http://localhost:3001` (`lib/core/api/api_client.dart`) — que só funciona em emulador, não em device físico.

## Variáveis de ambiente

| Variável | Obrigatória | Efeito |
|---|---|---|
| `JWT_SECRET` | **sim** | Segredo de assinatura do JWT. Ausente ou vazio, o processo **aborta no boot** com mensagem explícita (`src/lib/env.ts`). Não existe fallback de desenvolvimento. |
| `DATABASE_URL` | **sim** | String de conexão PostgreSQL usada pelo Prisma (`prisma/schema.prisma:3`). |
| `PORT` | não | Porta HTTP. Padrão `3001`. |
| `CORS_ORIGIN` | não | Lista de origens separadas por vírgula. Definida, restringe o CORS a elas; ausente, o CORS fica permissivo (conveniente em desenvolvimento, **defina em produção**). |
| `NODE_ENV` | não | Fora de `production`, o handler de erro imprime o stack trace no log. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | não | Envio do e-mail de recuperação de senha. Sem configuração, o token é impresso no console e a resposta ao cliente não muda. |

## Convenções

- **Autenticação**: `Authorization: Bearer <token>`. O token sai de `POST /auth/register` e `POST /auth/login` e vale 30 dias.
- **Autorização**: as rotas de dados do paciente exigem papel `PATIENT`, lido do banco a cada requisição (não do JWT), então um rebaixamento vale na hora.
- **Erros**: toda falha de autenticação e de banco responde `{ "error": "...", "code": "..." }`. O app decide pelo `code`, nunca pelo status isolado — `401` significa coisas diferentes em "token inválido" e em "senha atual errada".
- **Tempo**: todo timestamp de entrada e saída é epoch em milissegundos (`timestampMs`, `timeMs`).
- **Senha forte**: mínimo 8 caracteres com maiúscula, minúscula, dígito e caractere não alfanumérico (`src/lib/passwordPolicy.ts`). Vale em cadastro, redefinição e troca no perfil; **não** vale no login.

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

## `/auth`

### `POST /auth/register` — cria conta

Sem autenticação. Obrigatórios: `email` válido, `password` forte, `fullName` com 3+ caracteres. Opcionais: `phone`, `birthDate` (`YYYY-MM-DD` ou `DD/MM/YYYY`), `diabetesType`, `weightKg` (> 0), `targetRangeMin`/`targetRangeMax` (padrão 80/180, min < max).

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

## `/readings`

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

## Tabelas de roadmap

Dez modelos do schema não têm rota nesta release e estão anotados com `/// roadmap` em
`prisma/schema.prisma`: `HealthProfessional`, `Administrator`, `SensorDevice`,
`SensorBinding`, `SensorSession`, `SensorStatusEvent`, `GlucosePrediction`,
`ClinicalReport`, `MetricsSnapshot` e `DashboardAccessGrant`. Eles ficam no schema de
propósito — descrevem o modelo de domínio planejado. A anotação existe para que a próxima
leitura não os confunda com tabela morta e tente removê-los.

## Migrations

Toda mudança em `prisma/schema.prisma` acompanha a migration versionada em `prisma/migrations/`, no mesmo PR. Aplicar: `npx prisma migrate dev` em desenvolvimento, `npx prisma migrate deploy` em ambiente já provisionado.
