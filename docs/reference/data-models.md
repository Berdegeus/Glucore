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
| `grams int` | `grams` | `carbsGrams Decimal(10,2)` |
| `description String` | `description` | `description String` |
| `time DateTime` | `timeMs` | `eventAt DateTime` |

`GET/POST /carbs` (POST replace-all, máx 100). Sem `id` exposto na API — identidade no app é o `time` (§P4).

## InsulinEntry

| Flutter | API | Prisma `InsulinEvent` |
|---|---|---|
| `units double` | `units` | `doseUnits Decimal(10,2)` |
| `type InsulinType {bolus,basal,correction}` | `type` (string livre) | `insulinType String` |
| `time DateTime` | `timeMs` | `eventAt DateTime` |
| `dayOfWeek String` (valores de `kDaysOfWeek`, PT) | `dayOfWeek` | `dayOfWeek String @default("")` |

`GET/POST /insulin` (replace-all, máx 100). `kDaysOfWeek` definido em `patient_models.dart` ("Segunda-feira"…"Domingo").

## AppAlertItem

| Flutter | API | Prisma `AlertEvent` |
|---|---|---|
| `type AppAlertType {glucoseLow,glucoseHigh,sensorReconnected,syncFailure}` | `type` | `alertType AlertType` (enum DB: HYPO_RISK, HYPER_RISK, SENSOR_RECONNECTED, SYNC_FAILURE, FAST_DROP, FAST_RISE) |
| `timestamp DateTime` | `timestampMs` | `triggeredAt DateTime` |

Mapeamento app↔DB (padrão Adapter) em `backend/services/glucose-service/src/modules/alerts/alerts.mapper.ts`; FAST_DROP/FAST_RISE não têm equivalente no app (viram `syncFailure` no GET — lossy na volta, e travado por teste de caracterização de propósito).

## AlertSettingsModel

| Flutter | API | Prisma `AlertThresholdConfig` |
|---|---|---|
| `lowThreshold int` (default 80) | `lowThreshold` | `lowGlucoseMgDl Int @default(80)` |
| `highThreshold int` (default 180) | `highThreshold` | `highGlucoseMgDl Int @default(180)` |

`GET/PUT /settings/alerts`.

## Sensor (só local Android — não vai ao backend)

`SibionicsSessionRecord` (SQLite `glucore_session.db`, linha única): `sensorId`, `transmitterId?`, `status enum {REGISTERED, AWAITING_TRANSMITTER, TRANSMITTER_ASSIGNED, CONNECTED, MONITORING, DISCONNECTED, ERROR}`, `connectedAtMs?`. Snapshot pro Flutter: `{sensorId, transmitterId, connected}` (connected = CONNECTED ou MONITORING). As tabelas Prisma `SensorDevice`/`SensorSession`/etc. existem no schema mas não recebem dados.

## Arquivos-chave

| Arquivo | Papel |
|---|---|
| `lib/features/patient/presentation/models/patient_models.dart` | Todos os modelos Flutter + `kDaysOfWeek` |
| `lib/features/patient/data/datasources/patient_remote_datasource.dart` | Mappers Dart↔JSON (fonte do contrato do app) |
| `lib/features/patient/data/datasources/patient_local_datasource.dart` | Tabelas sqflite locais (`glucore_patient.db`, mesmas colunas + flag `synced`) |
| `backend/services/glucose-service/src/modules/*/*.mapper.ts` | Mappers JSON↔Prisma (fonte do contrato do servidor) |
| `backend/services/glucose-service/src/modules/*/*.schema.ts` | Validação e parse do body de entrada |
| `backend/services/glucose-service/prisma/schema.prisma` | Colunas e tipos |

## Armadilhas

- Convenção de tempo: **epoch ms** na API (`timestampMs`/`timeMs`), `DateTime` no Prisma. Nunca enviar ISO string nos endpoints de dados.
- `toJson/fromJson` dos modelos Flutter existem além dos mappers do datasource — mantê-los sincronizados (usados como formato canônico).
- Campos novos precisam de default nos dois lados (Prisma `@default`, Dart `?? valor`) para não quebrar dados antigos.
