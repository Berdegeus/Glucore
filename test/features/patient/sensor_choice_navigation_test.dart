import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/l10n/l10n.dart';

import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/repositories/patient_repository.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/presentation/cubit/patient_cubit.dart';
import 'package:glucore/features/patient/presentation/models/patient_models.dart';
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
void main() {
  testWidgets('brand pages pushed on the root Navigator resolve the cubits',
      (tester) async {
    final sensorCubit = _FakeSensorCubit();
    final patientCubit = _FakePatientCubit();
    addTearDown(sensorCubit.close);
    addTearDown(patientCubit.close);

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        // Mirrors app.dart: providers live ABOVE the root Navigator.
        builder: (context, child) => MultiBlocProvider(
          providers: [
            BlocProvider<SensorCubit>.value(value: sensorCubit),
            BlocProvider<PatientCubit>.value(value: patientCubit),
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
                  MaterialPageRoute(
                      builder: (_) => const SensorChoicePage()),
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
      expect(tester.takeException(), isNull,
          reason: 'tapping "$label" must not throw ProviderNotFoundException');
      expect(find.byType(destination), findsOneWidget);
      Navigator.of(tester.element(find.byType(destination))).pop();
      await tester.pumpAndSettle();
    }

    await tapCardAndReturn('Sibionics', SensorLinkPage);
    await tapCardAndReturn('Accu-Chek SmartGuide', SensorLinkPage);
    await tapCardAndReturn('FreeStyle Libre 2', LibreNFCPage);
  });
}

// ── Fakes ─────────────────────────────────────────────────────────────────
// initialize() is overridden to a no-op so the fake cubits never touch their
// repositories or platform channels; the brand pages only READ cubit state.

class _FakeSensorCubit extends SensorCubit {
  _FakeSensorCubit() : super(repository: _FakeSensorRepository());

  @override
  Future<void> initialize() async {}
}

class _FakePatientCubit extends PatientCubit {
  _FakePatientCubit._(PatientRepository repository)
      : super(repository: repository);

  factory _FakePatientCubit() {
    final local = LocalPatientDataSource();
    final remote = _FakePatientRemote();
    final sync = PatientSyncService(
      local: local,
      remote: remote,
      connectivityChanges: const Stream.empty(),
    );
    return _FakePatientCubit._(
      PatientRepository(local: local, remote: remote, syncService: sync),
    );
  }

  @override
  Future<void> initialize(SensorCubit sensorCubit) async {}
}

class _FakeSensorRepository implements SensorRepository {
  @override
  Future<SensorSession?> restoreSession() async => null;

  @override
  Future<SensorSession?> registerSensor(String barcode,
          {SensorBrand brand = SensorBrand.sibionics}) async =>
      null;

  @override
  Future<void> submitTransmitter(String transmitterBarcode) async {}

  @override
  Future<void> startMonitoring() async {}

  @override
  Future<void> stopMonitoring() async {}

  @override
  Stream<SensorEvent> observeSessionEvents() => const Stream.empty();

  @override
  Future<void> clearSession() async {}

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

class _FakePatientRemote implements PatientDataSource {
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
}
