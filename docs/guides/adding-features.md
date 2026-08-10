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
4. **Schema Prisma** — `backend/prisma/schema.prisma`: coluna (com `@default` para linhas existentes) → `npx prisma migrate dev --name add_x`.
5. **Rota backend** — `backend/src/routes/<x>.ts`: incluir campo no map do GET e no `createMany` do POST.
6. **UI** — páginas entry/edit correspondentes (`insulin_entry_page.dart`, `insulin_edit_page.dart` etc.).

Exemplo real completo: campo `dayOfWeek` de `InsulinEntry` (commit `dcfaf84` + migração `20260608232021_add_day_of_week_to_insulin_event`).

## Nova rota backend

Padrão (copiar de `backend/src/routes/carbs.ts`):
```ts
router.use(verifyJwt);
router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const patientId = await ensurePatient(req.userId!);
  // prisma + res.json(rows.map(toApiShape))
}));
```
Registrar em `backend/src/index.ts` (`app.use('/x', xRouter)`). Sempre `asyncHandler` + `ensurePatient`; formato de resposta camelCase com `timestampMs`/`timeMs` em epoch ms (ver [reference/data-models.md](../reference/data-models.md)).

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
