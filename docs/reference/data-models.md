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

Endpoints: `GET/POST/DELETE /readings` (GET devolve as 5.000 mais recentes, ou uma página com `from`/`before`/`limit`; POST = batch upsert de até 500, lote maior = 400).

**O aparelho e o servidor não têm as mesmas linhas.** O aparelho guarda tudo o que o sensor entrega (até 1/min, retenção de 14 dias) e é a fonte dos gráficos e relatórios. O servidor recebe **uma leitura por intervalo de 5 min**: a mais antiga do intervalo, com o `timestampMs` trocado pelo início dele (`domain/reading_decimation.dart`), e só de intervalos já fechados. A resolução cheia chega ao servidor pelos blocos de 15 min (abaixo), como **contagens por valor**: o servidor não tem a série ordenada de 1/min, só o aparelho. O servidor também não apaga leituras (decisão para treino de ML; ver `backend/README.md`, "Retenção das leituras e dados para ML").

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
| `dayOfWeek String` (valores de `kDaysOfWeek`, PT; preenchido por `dayOfWeekFor(time)`, sem seletor na tela desde 2026-10-04) | `dayOfWeek` | `dayOfWeek String @default("")` |

Mesma superfície de carbs: `GET /insulin?before=&limit=`, `POST /insulin/item`, `PUT`/`DELETE /insulin/item/:id`, e o `POST /insulin` de coleção deprecated. `kDaysOfWeek` definido em `lib/features/patient/domain/entities/insulin_entry.dart` ("Segunda-feira"…"Domingo").

## AppAlertItem

| Flutter | API | Prisma `AlertEvent` |
|---|---|---|
| `id String` (UUID v4) | `id` | `id String @id @db.Uuid` |
| `type AppAlertType {glucoseLow,glucoseHigh,sensorReconnected,syncFailure}` | `type` | `alertType AlertType` (enum DB: HYPO_RISK, HYPER_RISK, SENSOR_RECONNECTED, SYNC_FAILURE, FAST_DROP, FAST_RISE) |
| `timestamp DateTime` | `timestampMs` | `triggeredAt DateTime` |

Mapeamento app↔DB (padrão Adapter) em `backend/services/glucose-service/src/modules/alerts/alerts.mapper.ts`; FAST_DROP/FAST_RISE não têm equivalente no app (viram `syncFailure` no GET — lossy na volta, e travado por teste de caracterização de propósito). Superfície igual à de carbs: `GET /alerts?before=&limit=`, `POST /alerts/item`, `PUT`/`DELETE /alerts/item/:id`, mais o `POST /alerts` de coleção deprecated — que passou a preservar o `id` enviado pelo cliente, em vez de descartá-lo.

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
| `readings`, `settings` | `synced = 0` — continuam no caminho de coleção (com debounce). Em `readings`, o intervalo de 5 min **em curso** fica pendente até fechar, e marcar uma linha enviada marca todas as leituras locais que ela representa | `PatientSyncService` via `pendingCollections()` + `markReadingKeysSynced`/`markSettingsSynced` |
| `glucose_buckets` | `synced = 0` — um bloco recalculado e ainda não confirmado | `PatientSyncService`, `markGlucoseBucketsSynced` (só se o conteúdo guardado ainda for o enviado) |
| `carbs`, `insulin`, `alerts` | a linha correspondente em `pending_ops` | a drenagem do op-log, que apaga a op ao receber 2xx |

Nas três tabelas do diário a flag sobrevive só como marca de origem do dado (`1` = veio do servidor, `0` = nasceu no aparelho) e **não** é consultada para decidir o que falta enviar. Quem decide é o op-log. As duas metades da reconciliação em `replaceWithServerSnapshot` são diferentes por isso:

- `readings`: **incorpora, não substitui, e não apaga nada**. Uma leitura do servidor entra com `synced = 1` só se o aparelho não tiver nenhuma no mesmo intervalo de 5 min (o servidor tem a versão rala, o aparelho a de 1/min). O snapshot é só o delta desde a marca d'água (`meta.readings_watermark_ms`, a leitura mais nova do servidor já incorporada; a primeira sincronização pede a janela de 14 dias). A poda é a retenção de 14 dias, não a reconciliação.
- diário: apaga toda linha cujo `id` **não** está em `pending_ops` para aquela entidade, e insere as do servidor com `ConflictAlgorithm.ignore` — a entrada com operação na fila mantém a versão local e vence o servidor até ser empurrada (IDENT-07).

`pendingCollections()` ainda reporta as três tabelas do diário quando existe linha `synced = 0`, mas o `PatientSyncService` filtra o resultado para `readings` e `settings`; o diário nunca é empurrado por esse caminho.

## Blocos de glicose (`glucose_buckets`, banco local v4)

O servidor não tem as leituras de minuto, então o aparelho agrupa as leituras em **blocos de 15 minutos
alinhados a UTC**, contadas por mg/dL inteiro, e os envia com `PUT /readings/buckets`. Forma em
`contracts/glucose-histogram.json`, lida pelo app, pelo backend e pelos testes dos dois.

Alinhado a UTC e não ao fuso do paciente de propósito: um dia cortado num fuso não pode ser recortado em
outro, e o painel pede o fuso de quem olha. Todo deslocamento de fuso real é múltiplo de 15 minutos, então um
bloco nunca atravessa uma meia-noite local e o servidor monta o dia em qualquer fuso, exatamente. O app não
sabe nem guarda fuso nenhum para isso.

| Coluna / campo | Significado |
|---|---|
| `start_ms` / `startMs` | início do bloco, em ms de época; múltiplo de 15 min |
| `readings_count` | leituras que o sensor entregou no bloco |
| `covered_slots` | intervalos de 5 min do bloco com ao menos uma leitura (1–3): o uso do sensor, seja qual for a cadência |
| `mg_dl` / `mgDl` | valores distintos em mg/dL, crescentes, de 40 a 600; fora da faixa conta no extremo mais próximo |
| `counts` | quantas leituras teve cada valor de `mgDl`, na mesma ordem |

`bucket_dirty` guarda os blocos cujas leituras mudaram. `saveReadings` marca o bloco de cada leitura que
insere ou altera, e **não** o de uma que só saiu do conjunto (a poda de 14 dias): um bloco não encolhe porque o
aparelho esqueceu os minutos dele. O `PatientSyncService` recalcula só os blocos **fechados** (o em curso fica
sujo até fechar, senão seria um PUT por minuto), com **todas** as leituras locais do bloco, guarda o resultado
e envia os pendentes, até 288 por requisição. **Um bloco só cresce**, localmente e no servidor. Uma falha no
envio é logada e o bloco fica pendente: nunca falha o push nem impede o pull de leituras.

## Arquivos-chave

| Arquivo | Papel |
|---|---|
| `lib/features/patient/domain/entities/` | Entidades Flutter + `kDaysOfWeek`, atrás do barrel `patient_entities.dart` |
| `lib/features/patient/data/datasources/patient_remote_datasource.dart` | Mappers Dart↔JSON (fonte do contrato do app) |
| `lib/features/patient/data/datasources/patient_local_datasource.dart` | Tabelas sqflite locais (`glucore_patient.db` v4, mesmas colunas + `id` + flag `synced`, `meta.readings_watermark_ms`, `glucose_buckets` e `bucket_dirty`) |
| `lib/features/patient/data/sync/pending_op.dart` | Modelo da operação enfileirada (`entity`, `op`, `payload_json`) |
| `backend/services/glucose-service/src/modules/*/*.mapper.ts` | Mappers JSON↔Prisma (fonte do contrato do servidor) |
| `backend/services/glucose-service/src/modules/*/*.schema.ts` | Validação e parse do body de entrada |
| `backend/services/glucose-service/src/modules/*/*.routes.ts` | Fiação das rotas por módulo |
| `backend/services/glucose-service/prisma/schema.prisma` | Colunas e tipos |

## Armadilhas

- Convenção de tempo: **epoch ms** na API (`timestampMs`/`timeMs`), `DateTime` no Prisma. Nunca enviar ISO string nos endpoints de dados.
- O `id` nasce no app (UUID v4) e o backend preserva o que o cliente mandou. Entrada que chega do servidor sem `id` ou com `id` fora do formato UUID ganha um id local ao ser materializada — não é descartada.
- `toJson/fromJson` dos modelos Flutter existem além dos mappers do datasource — mantê-los sincronizados (usados como formato canônico).
- Campos novos precisam de default nos dois lados (Prisma `@default`, Dart `?? valor`) para não quebrar dados antigos.
