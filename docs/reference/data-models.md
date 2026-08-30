# Modelos de dados: Flutter ↔ API ↔ Prisma

> Quando usar: adicionar/alterar campo de dados em qualquer camada. Cada linha abaixo é um campo que precisa existir nas três camadas.

## GlucoseReading

| Flutter `GlucoseReadingItem` | API (JSON) | Prisma `GlucoseReading` |
|---|---|---|
| `value double` | `value` | `valueMgDl Int` (arredondado no POST) |
| `timestamp DateTime` | `timestampMs` (epoch ms) | `recordedAt DateTime` — unique com patientId |
| `trend GlucoseTrend {rising,stable,falling}` | `trend` (string) | `trend String @default("stable")` |
| `rate double` | `rate` | `trendRate Float` |
| `alarmCode int?` | `alarmCode` | `alarmCode Int?` |

Endpoints: `GET/POST/DELETE /readings` (GET limita 288; POST = batch upsert).

## CarbEntry

| Flutter | API | Prisma `CarbEvent` |
|---|---|---|
| `id String` (UUID v4) | `id` | `id String @id @db.Uuid` |
| `grams int` | `grams` | `carbsGrams Decimal(10,2)` |
| `description String` | `description` | `description String` |
| `time DateTime` | `timeMs` | `eventAt DateTime` |

`GET /carbs?before=<epoch ms>&limit=<1..500>` (mais recentes primeiro; sem parâmetros, as 100 mais recentes). Unitários: `POST /carbs/item` → 201 `{id}`, `PUT /carbs/item/:id` → 204|404, `DELETE /carbs/item/:id` → 204|404. `POST /carbs` de coleção continua funcionando, **deprecated** nesta release como caminho de rollback.

## InsulinEntry

| Flutter | API | Prisma `InsulinEvent` |
|---|---|---|
| `id String` (UUID v4) | `id` | `id String @id @db.Uuid` |
| `units double` | `units` | `doseUnits Decimal(10,2)` |
| `type InsulinType {bolus,basal,correction}` | `type` (string livre) | `insulinType String` |
| `time DateTime` | `timeMs` | `eventAt DateTime` |
| `dayOfWeek String` (valores de `kDaysOfWeek`, PT) | `dayOfWeek` | `dayOfWeek String @default("")` |

Mesma superfície de carbs: `GET /insulin?before=&limit=`, `POST /insulin/item`, `PUT`/`DELETE /insulin/item/:id`, e o `POST /insulin` de coleção deprecated. `kDaysOfWeek` definido em `lib/features/patient/domain/entities/insulin_entry.dart` ("Segunda-feira"…"Domingo").

## AppAlertItem

| Flutter | API | Prisma `AlertEvent` |
|---|---|---|
| `id String` (UUID v4) | `id` | `id String @id @db.Uuid` |
| `type AppAlertType {glucoseLow,glucoseHigh,sensorReconnected,syncFailure}` | `type` | `alertType AlertType` (enum DB: HYPO_RISK, HYPER_RISK, SENSOR_RECONNECTED, SYNC_FAILURE, FAST_DROP, FAST_RISE) |
| `timestamp DateTime` | `timestampMs` | `triggeredAt DateTime` |

Mapeamento app↔DB em `backend/src/repositories/alertRepository.ts`; FAST_DROP/FAST_RISE não têm equivalente no app (viram `syncFailure` no GET). Superfície igual à de carbs: `GET /alerts?before=&limit=`, `POST /alerts/item`, `PUT`/`DELETE /alerts/item/:id`, mais o `POST /alerts` de coleção deprecated — que passou a preservar o `id` enviado pelo cliente, em vez de descartá-lo.

## AlertSettingsModel

| Flutter | API | Prisma `AlertThresholdConfig` |
|---|---|---|
| `lowThreshold int` (default 80) | `lowThreshold` | `lowGlucoseMgDl Int @default(80)` |
| `highThreshold int` (default 180) | `highThreshold` | `highGlucoseMgDl Int @default(180)` |

`GET/PUT /settings/alerts`.

## Sensor (só local Android — não vai ao backend)

`SibionicsSessionRecord` (SQLite `glucore_session.db`, linha única): `sensorId`, `status enum {REGISTERED, CONNECTED, MONITORING, DISCONNECTED, ERROR}`, `connectedAtMs?`, `brand`. Snapshot pro Flutter: `{sensorId, connected, brand}` (connected = CONNECTED ou MONITORING).

A coluna `transmitter_id` continua na tabela, nunca escrita: nenhum dos três sensores usa transmissor separado, e derrubar a coluna custaria migração de schema por causa de um fluxo que já não roda. As tabelas Prisma sem rota (`SensorDevice`, `SensorSession` e outras) existem no schema anotadas com `/// roadmap` e não recebem dados.

## Persistência local do paciente (`glucore_patient.db`, v3)

Cinco tabelas de coleção (`readings`, `alerts`, `carbs`, `insulin`, `settings`) mais o op-log `pending_ops`.

As três tabelas do diário têm `id TEXT PRIMARY KEY` (UUID v4) e índice sobre a coluna de horário. A PK deixou de ser o timestamp: duas entradas no mesmo milissegundo se sobrescreviam, e mudar o horário de uma entrada mudava a identidade dela (§P4). A migração v2 → v3 recria as tabelas preenchendo um UUID por linha existente, dentro da transação do `onUpgrade` — falha no meio deixa o banco na v2, íntegro.

```
pending_ops(
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,  -- ordem total de drenagem
  entity     TEXT NOT NULL,                      -- 'carbs' | 'insulin' | 'alerts'
  entity_id  TEXT NOT NULL,                      -- id da entrada afetada
  op         TEXT NOT NULL,                      -- 'upsert' | 'delete'
  payload_json TEXT,                             -- estado completo no upsert; null no delete
  created_at INTEGER NOT NULL
)
```

`seq` dá a ordem de envio e é imune ao relógio do aparelho. `entity` e `op` são texto cru de propósito: uma linha gravada por uma versão futura do app volta legível e é descartada pela drenagem em vez de estourar na leitura.

**`synced` significa duas coisas diferentes, dependendo da coleção.** Toda tabela tem a flag, mas:

| Coleção | O que é "pendente" | Quem limpa |
|---|---|---|
| `readings`, `settings` | `synced = 0` — continuam no caminho de coleção (replace-all com debounce) | `PatientSyncService` via `pendingCollections()` + `markReadingsSynced`/`markSettingsSynced` |
| `carbs`, `insulin`, `alerts` | a linha correspondente em `pending_ops` | a drenagem do op-log, que apaga a op ao receber 2xx |

Nas três tabelas do diário a flag sobrevive só como marca de origem do dado (`1` = veio do servidor, `0` = nasceu no aparelho) e **não** é consultada para decidir o que falta enviar. Quem decide é o op-log. As duas metades da reconciliação em `replaceWithServerSnapshot` são diferentes por isso:

- `readings`: apaga as linhas `synced = 1` e reinsere o snapshot, preservando o que foi gravado localmente e ainda não subiu.
- diário: apaga toda linha cujo `id` **não** está em `pending_ops` para aquela entidade, e insere as do servidor com `ConflictAlgorithm.ignore` — a entrada com operação na fila mantém a versão local e vence o servidor até ser empurrada (IDENT-07).

`pendingCollections()` ainda reporta as três tabelas do diário quando existe linha `synced = 0`, mas o `PatientSyncService` filtra o resultado para `readings` e `settings`; o diário nunca é empurrado por esse caminho.

## Arquivos-chave

| Arquivo | Papel |
|---|---|
| `lib/features/patient/domain/entities/` | Entidades Flutter + `kDaysOfWeek`, atrás do barrel `patient_entities.dart` |
| `lib/features/patient/data/datasources/patient_remote_datasource.dart` | Mappers Dart↔JSON (fonte do contrato do app) |
| `lib/features/patient/data/datasources/patient_local_datasource.dart` | Tabelas sqflite locais (`glucore_patient.db` v3, mesmas colunas + `id` + flag `synced`) |
| `lib/features/patient/data/sync/pending_op.dart` | Modelo da operação enfileirada (`entity`, `op`, `payload_json`) |
| `backend/src/repositories/*.ts` | Mappers JSON↔Prisma das rotas em camadas (carbs, insulin, alerts) |
| `backend/src/routes/*.ts` | Fiação; contrato das rotas ainda não migradas (auth, readings, settings) |
| `backend/prisma/schema.prisma` | Colunas e tipos |

## Armadilhas

- Convenção de tempo: **epoch ms** na API (`timestampMs`/`timeMs`), `DateTime` no Prisma. Nunca enviar ISO string nos endpoints de dados.
- O `id` nasce no app (UUID v4) e o backend preserva o que o cliente mandou. Entrada que chega do servidor sem `id` ou com `id` fora do formato UUID ganha um id local ao ser materializada — não é descartada.
- `toJson/fromJson` dos modelos Flutter existem além dos mappers do datasource — mantê-los sincronizados (usados como formato canônico).
- Campos novos precisam de default nos dois lados (Prisma `@default`, Dart `?? valor`) para não quebrar dados antigos.
