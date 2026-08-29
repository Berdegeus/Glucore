import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/api/auth_token_store.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/repositories/patient_repository_impl.dart';
import 'package:glucore/features/patient/domain/repositories/patient_repository.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/presentation/cubit/patient_cubit.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/presentation/pages/carb_edit_page.dart';
import 'package:glucore/features/patient/presentation/pages/insulin_edit_page.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// IDENT-02 e IDENT-03: editar e apagar uma entrada de diário casam pelo `id`.
/// Duas entradas no mesmo milissegundo continuam sendo duas, e mudar o horário
/// de uma não muda a identidade dela nem atinge a outra.
void main() {
  sqfliteFfiInit();

  final t0 = DateTime.fromMillisecondsSinceEpoch(1700000000000);
  final t1 = DateTime.fromMillisecondsSinceEpoch(1700003600000);

  late LocalPatientDataSource local;
  late PatientCubit cubit;

  PatientRepository buildRepository(LocalPatientDataSource local) {
    final remote = _FakeRemote();
    return PatientRepositoryImpl(
      local: local,
      remote: remote,
      syncService: PatientSyncService(
        local: local,
        remote: remote,
        connectivityChanges: const Stream<List<ConnectivityResult>>.empty(),
        debounce: const Duration(milliseconds: 5),
        retryDelays: const [Duration.zero],
      ),
      tokenStore: _FakeTokenStore(),
    );
  }

  setUp(() {
    local = LocalPatientDataSource(
      databaseFactory: databaseFactoryFfi,
      databasePath: inMemoryDatabasePath,
    );
    cubit = PatientCubit(repository: buildRepository(local));
  });

  tearDown(() async {
    await cubit.close();
    await local.close();
  });

  group('IDENT-02/IDENT-03: carboidrato', () {
    test(
        'editar a primeira mudando o horário e apagar a segunda deixa só a '
        'entrada esperada', () async {
      final first =
          CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      final second =
          CarbEntry.create(grams: 60, description: 'Jantar', time: t0);
      await cubit.addCarbEntry(first);
      await cubit.addCarbEntry(second);
      expect(cubit.state.carbs, hasLength(2));

      await cubit.editCarbEntry(first.copyWith(time: t1, grams: 35));
      await cubit.deleteCarbEntry(second);

      expect(cubit.state.carbs, hasLength(1));
      final survivor = cubit.state.carbs.single;
      expect(survivor.id, first.id);
      expect(survivor.time, t1);
      expect(survivor.grams, 35);
      expect(survivor.description, 'Lanche');

      // O banco local espelha exatamente o mesmo estado.
      final persisted = await local.load();
      expect(persisted.carbs, hasLength(1));
      expect(persisted.carbs.single.id, first.id);
      expect(persisted.carbs.single.time, t1);
      expect(persisted.carbs.single.grams, 35);
    });

    test('editar casa pelo id, não pelo horário da entrada gravada', () async {
      final first =
          CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      final second =
          CarbEntry.create(grams: 60, description: 'Jantar', time: t0);
      await cubit.addCarbEntry(first);
      await cubit.addCarbEntry(second);

      await cubit.editCarbEntry(first.copyWith(time: t1, grams: 35));

      expect(cubit.state.carbs, hasLength(2));
      final edited = cubit.state.carbs.firstWhere((c) => c.id == first.id);
      final untouched = cubit.state.carbs.firstWhere((c) => c.id == second.id);
      expect(edited.time, t1);
      expect(edited.grams, 35);
      expect(untouched.time, t0);
      expect(untouched.grams, 60);
      expect(untouched.description, 'Jantar');
    });

    test('apagar remove apenas a entrada do id, no mesmo milissegundo',
        () async {
      final first =
          CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      final second =
          CarbEntry.create(grams: 60, description: 'Jantar', time: t0);
      await cubit.addCarbEntry(first);
      await cubit.addCarbEntry(second);

      await cubit.deleteCarbEntry(first);

      expect(cubit.state.carbs, hasLength(1));
      expect(cubit.state.carbs.single.id, second.id);
      expect(cubit.state.carbs.single.description, 'Jantar');
    });
  });

  group('IDENT-02/IDENT-03: insulina', () {
    InsulinEntry entry(double units, String day) => InsulinEntry.create(
          units: units,
          type: InsulinType.bolus,
          time: t0,
          dayOfWeek: day,
        );

    test(
        'editar a primeira mudando o horário e apagar a segunda deixa só a '
        'entrada esperada', () async {
      final first = entry(4, kDaysOfWeek[0]);
      final second = entry(6, kDaysOfWeek[1]);
      await cubit.addInsulinEntry(first);
      await cubit.addInsulinEntry(second);
      expect(cubit.state.insulin, hasLength(2));

      await cubit.editInsulinEntry(first.copyWith(time: t1, units: 5));
      await cubit.deleteInsulinEntry(second);

      expect(cubit.state.insulin, hasLength(1));
      final survivor = cubit.state.insulin.single;
      expect(survivor.id, first.id);
      expect(survivor.time, t1);
      expect(survivor.units, 5);
      expect(survivor.dayOfWeek, kDaysOfWeek[0]);

      final persisted = await local.load();
      expect(persisted.insulin, hasLength(1));
      expect(persisted.insulin.single.id, first.id);
      expect(persisted.insulin.single.time, t1);
      expect(persisted.insulin.single.units, 5);
    });

    test('editar casa pelo id, não pelo horário da entrada gravada', () async {
      final first = entry(4, kDaysOfWeek[0]);
      final second = entry(6, kDaysOfWeek[1]);
      await cubit.addInsulinEntry(first);
      await cubit.addInsulinEntry(second);

      await cubit.editInsulinEntry(first.copyWith(time: t1, units: 5));

      expect(cubit.state.insulin, hasLength(2));
      final untouched =
          cubit.state.insulin.firstWhere((i) => i.id == second.id);
      expect(untouched.time, t0);
      expect(untouched.units, 6);
      expect(untouched.dayOfWeek, kDaysOfWeek[1]);
    });

    test('apagar remove apenas a entrada do id, no mesmo milissegundo',
        () async {
      final first = entry(4, kDaysOfWeek[0]);
      final second = entry(6, kDaysOfWeek[1]);
      await cubit.addInsulinEntry(first);
      await cubit.addInsulinEntry(second);

      await cubit.deleteInsulinEntry(first);

      expect(cubit.state.insulin, hasLength(1));
      expect(cubit.state.insulin.single.id, second.id);
      expect(cubit.state.insulin.single.units, 6);
    });
  });

  group('IDENT-02: telas de edição devolvem a entrada com o id original', () {
    late _RecordingPatientCubit recording;

    setUp(() {
      recording = _RecordingPatientCubit(buildRepository(local));
    });

    tearDown(() => recording.close());

    Future<void> pumpPage(WidgetTester tester, Widget page) async {
      await tester.pumpWidget(
        BlocProvider<PatientCubit>.value(
          value: recording,
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Builder(
              builder: (context) => Scaffold(
                body: Center(
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => page),
                    ),
                    child: const Text('open'),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
    }

    testWidgets('CarbEditPage salva com o id da entrada recebida',
        (tester) async {
      final entry =
          CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      await pumpPage(tester, CarbEditPage(entry: entry));

      await tester.enterText(find.byType(TextFormField).first, '42');
      await tester.tap(find.widgetWithText(FilledButton, 'Salvar registro'));
      await tester.pumpAndSettle();

      expect(recording.editedCarbs, hasLength(1));
      expect(recording.editedCarbs.single.id, entry.id);
      expect(recording.editedCarbs.single.grams, 42);
      expect(recording.editedCarbs.single.description, 'Lanche');
    });

    testWidgets('InsulinEditPage salva com o id da entrada recebida',
        (tester) async {
      final entry = InsulinEntry.create(
        units: 4,
        type: InsulinType.bolus,
        time: t0,
        dayOfWeek: kDaysOfWeek[0],
      );
      await pumpPage(tester, InsulinEditPage(entry: entry));

      await tester.enterText(find.byType(TextFormField).first, '7');
      await tester.tap(find.widgetWithText(FilledButton, 'Salvar aplicação'));
      await tester.pumpAndSettle();

      expect(recording.editedInsulin, hasLength(1));
      expect(recording.editedInsulin.single.id, entry.id);
      expect(recording.editedInsulin.single.units, 7);
    });
  });
}

class _RecordingPatientCubit extends PatientCubit {
  _RecordingPatientCubit(PatientRepository repository)
      : super(repository: repository);

  final editedCarbs = <CarbEntry>[];
  final editedInsulin = <InsulinEntry>[];

  @override
  Future<void> editCarbEntry(CarbEntry entry) async => editedCarbs.add(entry);

  @override
  Future<void> editInsulinEntry(InsulinEntry entry) async =>
      editedInsulin.add(entry);
}

class _FakeTokenStore extends AuthTokenStore {
  _FakeTokenStore() : super(const FlutterSecureStorage());

  @override
  Future<String?> readUserId() async => null;
}

class _FakeRemote implements PatientRemoteApi {
  @override
  Future<PatientSnapshot> load() => throw UnimplementedError();
  @override
  Future<void> saveReadings(List<GlucoseReadingItem> readings) async {}
  @override
  Future<void> saveAlerts(List<AppAlertItem> alerts) async {}
  @override
  Future<void> saveCarbs(List<CarbEntry> carbs) async {}
  @override
  Future<void> saveInsulin(List<InsulinEntry> insulin) async {}
  @override
  Future<void> saveAlertSettings(AlertSettingsModel settings) async {}

  @override
  Future<void> upsertCarb(CarbEntry entry) async {}

  @override
  Future<void> deleteCarb(String id) async {}

  @override
  Future<void> upsertInsulin(InsulinEntry entry) async {}

  @override
  Future<void> deleteInsulin(String id) async {}

  @override
  Future<void> upsertAlert(AppAlertItem alert) async {}

  @override
  Future<void> deleteAlert(String id) async {}
}
