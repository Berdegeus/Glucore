# Receitas: adicionando funcionalidades

> Quando usar: implementar página nova, campo persistido novo, rota nova ou texto novo. Siga os padrões existentes — não invente estruturas paralelas.

## Nova página no fluxo do paciente

1. Criar em `lib/features/patient/presentation/pages/`.
2. Navegação a partir do shell: os cubits vivem acima do `PatientShellPage`; para rota empurrada use `buildPatientScopedRoute(context, page, withSensorCubit: ...)` (em `patient_widgets.dart`) ou `BlocProvider.value` manual — `Navigator.push` puro perde acesso aos cubits.
3. Strings via `context.l10n` (adicionar nos dois `.arb` + `flutter gen-l10n`).
4. Ler estado com `BlocBuilder<PatientCubit, PatientState>`; mutações só via métodos do cubit.

## Novo campo persistido (ex.: campo em InsulinEntry) — 6 pontos de toque

1. **Modelo Flutter** — `lib/features/patient/presentation/models/patient_models.dart`: campo + `toJson`/`fromJson` (com default para retrocompatibilidade).
2. **Tabela local (sqflite)** — `lib/features/patient/data/datasources/patient_local_datasource.dart`: coluna no `CREATE TABLE` + mappers `_rowToX`/`_xToRow`; **bump de `_dbVersion` + `onUpgrade` com `ALTER TABLE ADD COLUMN ... DEFAULT ...`** para bancos existentes.
3. **Datasource remoto** — `lib/features/patient/data/datasources/patient_remote_datasource.dart`: mappers `_rowToX`/`_xToRow` (contrato JSON).
4. **Schema Prisma** — `backend/services/glucose-service/prisma/schema.prisma`: coluna (com `@default` para linhas existentes) → `cd backend && npm run migrate:dev -- --name add_x`.
5. **Backend em camadas** — em `backend/services/glucose-service/src/modules/<x>/`: campo no `<x>.schema.ts` (parse/validação do body), no `<x>.mapper.ts` (JSON↔Prisma, nos dois sentidos) e no `<x>.repository.ts` (select/create). Controller e service normalmente não mudam.
6. **UI** — páginas entry/edit correspondentes (`insulin_entry_page.dart`, `insulin_edit_page.dart` etc.).

Exemplo real completo: campo `dayOfWeek` de `InsulinEntry` (commit `dcfaf84` + migração `20260608232021_add_day_of_week_to_insulin_event`).

## Nova rota backend

Um módulo por domínio em `backend/services/glucose-service/src/modules/<x>/` — copiar a forma de `modules/carbs/`, que tem os seis arquivos:

| Arquivo | Responsabilidade |
|---|---|
| `<x>.routes.ts` | `createXRouter(service)`; `router.use(verifyJwt)` + `router.use(requireRole('PATIENT'))`, depois um `asyncHandler` por endpoint |
| `<x>.controller.ts` | Lê o request, chama o service, escolhe status/corpo. Sem Prisma. |
| `<x>.service.ts` | Regra de negócio; resolve `patientId` via `ensurePatient`. Sem Express. |
| `<x>.repository.ts` | Interface + implementação Prisma. É o único arquivo que importa `prisma`. |
| `<x>.schema.ts` | Parse/validação do body; erros de entrada como 400 |
| `<x>.mapper.ts` | JSON↔Prisma nos dois sentidos |

Registrar em dois lugares: instanciar repositório e service em `src/container.ts`, e montar em `src/app.ts` (`app.use('/x', createXRouter(container.x))`). Sempre `asyncHandler` + `ensurePatient`; formato de resposta camelCase com `timestampMs`/`timeMs` em epoch ms (ver [reference/data-models.md](../reference/data-models.md)).

O teste vem em dois níveis: unidade do service contra os fakes tipados de `tests/helpers/fakes.ts`, e integração da rota contra Postgres real em `tests/routes/`.

## Novo evento do sensor (Android → Flutter)

1. Emitir map no Android com **todas** as chaves do contrato (ausentes = null): ver [reference/platform-channels.md](../reference/platform-channels.md).
2. Se status novo: adicionar em `SensorConnectionStatus` (`lib/features/sensor/domain/models.dart`) — o parser usa `firstWhere(byName, orElse: idle)`, então status desconhecido degrada para `idle` silenciosamente.
3. Parse em `SensorPlatformEvent.fromMap` (`sensor_platform.dart`).
4. Tratar em `SensorCubit._listenToEvents` **e** no listener do mock (duplicado hoje).
5. Reagir em `PatientCubit._handleSensorState` se afetar dados.

## Novo texto (l10n)

`app_pt.arb` + `app_pt_BR.arb` → `flutter gen-l10n` → `context.l10n.suaChave`. Chaves ausentes num dos arquivos quebram o build do gen-l10n.

## Arquivos-chave

| Arquivo | Papel |
|---|---|
| `lib/features/patient/presentation/widgets/patient_widgets.dart` | `buildPatientScopedRoute` + widgets compartilhados |
| `lib/features/patient/presentation/widgets/glucore_widgets.dart` | Widgets de UI genéricos |
| `lib/features/patient/presentation/widgets/glucose_chart.dart` | Gráfico fl_chart |
| `lib/features/patient/presentation/pages/add_observation_sheet.dart` | Sheet do FAB (atalho carbo/insulina) |

## Armadilhas

- Identidade de carb/insulin é o timestamp — dois registros no mesmo minuto se sobrescrevem no edit/delete (§P4). Se sua feature depende de identidade, resolva §P4 antes.
- POST de coleções é replace-all no backend — adicionar item = regravar lista inteira. Não fazer chamadas concorrentes de save da mesma coleção.
- Não usar `SharedPreferences` para dados de paciente novos — o padrão é sqflite local (`LocalPatientDataSource`) com espelho no backend via `PatientSyncService` (§P1 resolvido).
- Saves passam pelo `PatientRepository` (local-first + `schedulePush()`); não chamar o `RemotePatientDataSource` direto de UI/cubit.
