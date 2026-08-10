# Backend (Express + Prisma + PostgreSQL)

> Quando usar: mudanças em API, schema, autenticação ou sincronização app↔servidor.

## Stack e boot

`backend/src/index.ts`: Express na porta `PORT` (default **3001**), `cors()` aberto, `morgan('dev')`, JSON body. Handler global de erro → 500. Prisma client singleton em `src/lib/prisma.ts`. Env: `DATABASE_URL`, `JWT_SECRET` (fallback inseguro `'dev-secret'`), SMTP para reset de senha.

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
npm install
npx prisma migrate dev        # aplica migrações + gera client
npm run dev                   # ts-node-dev --respawn src/index.ts
```

App físico → backend na máquina: `flutter run --dart-define=API_URL=http://<ip-da-maquina>:3001`.

## Arquivos-chave

| Arquivo | Papel |
|---|---|
| `backend/prisma/schema.prisma` | Schema completo (inclui tabelas futuras) |
| `backend/src/routes/auth.ts` | Registro/login/perfil/reset (523 linhas, maior rota) |
| `backend/src/routes/{readings,carbs,insulin,alerts,settings}.ts` | CRUD de dados |
| `backend/src/middleware/auth.ts` | `verifyJwt` |
| `backend/src/middleware/asyncHandler.ts` | Wrapper de erro async |
| `backend/src/lib/patient.ts` | `ensurePatient` (upsert) |

## Armadilhas

- Migração `add_day_of_week_to_insulin_event` pode não estar aplicada no banco local — rodar `prisma migrate dev` antes de testar insulina.
- `JWT_SECRET` sem env cai em `'dev-secret'` — nunca subir assim (§P11).
- Enum `AlertType` do DB ≠ enum `AppAlertType` do app; o mapeamento vive só em `routes/alerts.ts` (FAST_DROP/FAST_RISE viram `syncFailure` na volta — lossy).
- `GlucoseReading` tem unique `[patientId, recordedAt]` — dois posts com mesmo timestamp sobrescrevem, não duplicam.
