import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/l10n/l10n.dart';

import 'package:glucore/core/api/auth_token_store.dart';
import 'package:glucore/features/auth/data/datasources/account_service.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/repositories/patient_repository_impl.dart';
import 'package:glucore/features/patient/domain/repositories/patient_repository.dart';
import 'package:glucore/features/patient/domain/usecases/patient_usecases.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/presentation/cubit/patient_cubit.dart';
import 'package:glucore/features/patient/presentation/cubit/user_identity_cubit.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/presentation/pages/libre_nfc_page.dart';
import 'package:glucore/features/patient/presentation/pages/sensor_choice_page.dart';
import 'package:glucore/features/patient/presentation/pages/sensor_link_page.dart';
import 'package:glucore/features/sensor/domain/events.dart';
import 'package:glucore/features/sensor/domain/models.dart';
import 'package:glucore/features/sensor/domain/sensor_repository.dart';
import 'package:glucore/features/sensor/presentation/cubit/sensor_cubit.dart';

/// Regression guard for P17: `SensorChoicePage` and the brand pages it pushes
/// must be able to resolve `SensorCubit`/`PatientCubit` even when reached
/// through a route pushed on the ROOT Navigator (as Settings/Profile do). The
/// fix injects both cubits above the Navigator via `MaterialApp.builder`; this
/// test fails with `ProviderNotFoundException` if that wiring regresses.
///
/// `UserIdentityCubit` is provided too (T24): both pages now render
/// `UserAppBar`, which watches it unconditionally.
void main() {
  testWidgets('brand pages pushed on the root Navigator resolve the cubits', (
    tester,
  ) async {
    final sensorCubit = _FakeSensorCubit();
    final patientCubit = _FakePatientCubit();
    final identityCubit = UserIdentityCubit(
      accountService: _NoopAccountService(),
    );
    addTearDown(sensorCubit.close);
    addTearDown(patientCubit.close);
    addTearDown(identityCubit.close);

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        // Mirrors app.dart: providers live ABOVE the root Navigator.
        builder: (context, child) => MultiBlocProvider(
          providers: [
            BlocProvider<SensorCubit>.value(value: sensorCubit),
            BlocProvider<PatientCubit>.value(value: patientCubit),
            BlocProvider<UserIdentityCubit>.value(value: identityCubit),
          ],
          child: child!,
        ),
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                // Raw MaterialPageRoute on the root Navigator — the exact
                // push pattern that used to crash from Settings/Profile.
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const SensorChoicePage()),
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.byType(SensorChoicePage), findsOneWidget);

    Future<void> tapCardAndReturn(String label, Type destination) async {
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();
      expect(
        tester.takeException(),
        isNull,
        reason: 'tapping "$label" must not throw ProviderNotFoundException',
      );
      expect(find.byType(destination), findsOneWidget);
      Navigator.of(tester.element(find.byType(destination))).pop();
      await tester.pumpAndSettle();
    }

    await tapCardAndReturn('Sibionics', SensorLinkPage);
    await tapCardAndReturn('Accu-Chek SmartGuide', SensorLinkPage);
    await tapCardAndReturn('FreeStyle Libre 2', LibreNFCPage);
  });

  Future<void> pumpChoicePage(
    WidgetTester tester,
    _FakeSensorCubit sensorCubit,
  ) async {
    final patientCubit = _FakePatientCubit();
    final identityCubit = UserIdentityCubit(
      accountService: _NoopAccountService(),
    );
    addTearDown(sensorCubit.close);
    addTearDown(patientCubit.close);
    addTearDown(identityCubit.close);
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<SensorCubit>.value(value: sensorCubit),
          BlocProvider<PatientCubit>.value(value: patientCubit),
          BlocProvider<UserIdentityCubit>.value(value: identityCubit),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const SensorChoicePage(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('without a linked sensor the brand list is shown', (
    tester,
  ) async {
    await pumpChoicePage(tester, _FakeSensorCubit());

    expect(find.text('Sibionics'), findsOneWidget);
    expect(find.byType(SensorLinkPage), findsNothing);
    expect(find.byType(LibreNFCPage), findsNothing);
  });

  testWidgets('a linked Sibionics sensor skips the brand list', (tester) async {
    final sensorCubit = _FakeSensorCubit()
      ..setState(
        SensorUiState(
          status: SensorConnectionStatus.connected,
          session: SensorSession(sensorId: 'S1'),
        ),
      );
    await pumpChoicePage(tester, sensorCubit);

    expect(find.byType(SensorLinkPage), findsOneWidget);
    expect(find.text('Accu-Chek SmartGuide'), findsNothing);
  });

  testWidgets('a linked Libre 2 sensor opens the Libre panel', (tester) async {
    final sensorCubit = _FakeSensorCubit()
      ..setState(
        SensorUiState(
          status: SensorConnectionStatus.connected,
          session: SensorSession(sensorId: 'L1', brand: SensorBrand.libre2),
        ),
      );
    await pumpChoicePage(tester, sensorCubit);

    expect(find.byType(LibreNFCPage), findsOneWidget);
    expect(find.text('Accu-Chek SmartGuide'), findsNothing);
  });
}

// ── Fakes ─────────────────────────────────────────────────────────────────
// initialize() is overridden to a no-op so the fake cubits never touch their
// repositories or platform channels; the brand pages only READ cubit state.

class _FakeSensorCubit extends SensorCubit {
  _FakeSensorCubit() : super(repository: _FakeSensorRepository());

  @override
  Future<void> initialize() async {}

  void setState(SensorUiState state) => emit(state);
}

class _FakePatientCubit extends PatientCubit {
  _FakePatientCubit._(PatientRepository repository)
    : super(useCases: PatientUseCases.fromRepository(repository));

  factory _FakePatientCubit() {
    final local = LocalPatientDataSource();
    final remote = _FakePatientRemote();
    final sync = PatientSyncService(
      local: local,
      remote: remote,
      connectivityChanges: const Stream.empty(),
    );
    return _FakePatientCubit._(
      PatientRepositoryImpl(
        local: local,
        remote: remote,
        syncService: sync,
        tokenStore: const AuthTokenStore(FlutterSecureStorage()),
      ),
    );
  }

  @override
  Future<void> initialize(SensorCubit sensorCubit) async {}
}

class _FakeSensorRepository implements SensorRepository {
  @override
  Future<SensorSession?> restoreSession() async => null;

  @override
  Future<SensorSession?> registerSensor(
    String barcode, {
    SensorBrand brand = SensorBrand.sibionics,
  }) async => null;

  @override
  Future<void> startMonitoring() async {}

  @override
  Future<void> stopMonitoring() async {}

  @override
  Stream<SensorEvent> observeSessionEvents() => const Stream.empty();

  @override
  Future<void> clearSession() async {}

  @override
  Future<SensorLife?> getSensorLife() async => null;
  @override
  Future<List<StoredSensorReading>> getStoredReadings(DateTime since) async =>
      const [];
  @override
  Future<AbbottLibraryStatus> getAbbottLibraryStatus() async =>
      const AbbottLibraryStatus(installed: false, libraryName: '');

  @override
  Future<void> installAbbottLibrary(String path) async {}

  @override
  Future<void> startNfcScan() async {}

  @override
  Future<void> stopNfcScan() async {}
}

class _FakePatientRemote implements PatientRemoteApi {
  @override
  Future<PatientSnapshot> load() async =>
      throw UnimplementedError('not used in this test');

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

// `identityCubit.load()` is never called in this test — it only checks that
// the page tree builds without ProviderNotFoundException, not what the name
// renders as — so this is never actually invoked.
class _NoopAccountService extends AccountService {
  _NoopAccountService() : super(Dio());

  @override
  Future<AccountProfile> fetchProfile() =>
      throw UnimplementedError('not used in this test');
}
