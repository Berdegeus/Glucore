import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/api/auth_token_store.dart';
import 'package:glucore/features/auth/data/datasources/account_service.dart';
import 'package:glucore/features/auth/domain/repositories/auth_repository.dart';
import 'package:glucore/features/auth/domain/usecases/get_auth_status_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/login_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/logout_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/register_usecase.dart';
import 'package:glucore/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/repositories/patient_repository.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/presentation/cubit/patient_cubit.dart';
import 'package:glucore/features/patient/presentation/cubit/user_identity_cubit.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/presentation/pages/alert_settings_page.dart';
import 'package:glucore/features/patient/presentation/pages/carb_edit_page.dart';
import 'package:glucore/features/patient/presentation/pages/carb_entry_page.dart';
import 'package:glucore/features/patient/presentation/pages/history_page.dart';
import 'package:glucore/features/patient/presentation/pages/insulin_edit_page.dart';
import 'package:glucore/features/patient/presentation/pages/insulin_entry_page.dart';
import 'package:glucore/features/patient/presentation/pages/notifications_page.dart';
import 'package:glucore/features/patient/presentation/pages/profile_edit_page.dart';
import 'package:glucore/features/patient/presentation/pages/sensor_choice_page.dart';
import 'package:glucore/features/patient/presentation/pages/sensor_link_page.dart';
import 'package:glucore/features/patient/presentation/pages/settings_page.dart';
import 'package:glucore/features/sensor/domain/events.dart';
import 'package:glucore/features/sensor/domain/models.dart';
import 'package:glucore/features/sensor/domain/sensor_repository.dart';
import 'package:glucore/features/sensor/presentation/cubit/sensor_cubit.dart';
import 'package:glucore/l10n/l10n.dart';

/// Spec: TCC-04 — spec.md P1 "Identidade do usuário e saída visíveis em todas
/// as telas" AC4 ("as páginas empilhadas... cada uma SHALL exibir o nome do
/// usuário logado e a ação de sair na sua própria AppBar") and its Independent
/// Test ("acionar a saída em Relatórios volta ao login" implies the identity
/// menu and normal back navigation coexist on every stacked screen).
void main() {
  late _FakeAuthRepository authRepo;
  late AuthCubit authCubit;
  late UserIdentityCubit identity;
  late PatientCubit patientCubit;
  late _FakeSensorCubit sensorCubit;

  setUp(() {
    authRepo = _FakeAuthRepository();
    authCubit = AuthCubit(
      loginUseCase: LoginUseCase(authRepo),
      logoutUseCase: LogoutUseCase(authRepo),
      getAuthStatusUseCase: GetAuthStatusUseCase(authRepo),
      registerUseCase: RegisterUseCase(authRepo),
      connectivityChanges: const Stream.empty(),
    );
    identity = UserIdentityCubit(
      accountService: _FakeAccountService(fullName: 'Ana Silva'),
    );
    patientCubit = _FakePatientCubit();
    sensorCubit = _FakeSensorCubit();
  });

  tearDown(() async {
    await authCubit.close();
    await identity.close();
    await patientCubit.close();
    await sensorCubit.close();
  });

  /// Pushes [page] on a Navigator (not `home:`), so a back button actually
  /// has somewhere to return to — the same shape every real stacked page is
  /// reached in (Settings/Profile push these with `Navigator.of(context).push`).
  Future<void> pumpStacked(WidgetTester tester, Widget page) async {
    await identity.load('Paciente Glucore');
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<AuthCubit>.value(value: authCubit),
          BlocProvider<UserIdentityCubit>.value(value: identity),
          BlocProvider<PatientCubit>.value(value: patientCubit),
          BlocProvider<SensorCubit>.value(value: sensorCubit),
        ],
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

  final pages = <String, Widget>{
    'HistoryPage': const HistoryPage(),
    'NotificationsPage': const NotificationsPage(),
    'SettingsPage': const SettingsPage(),
    'AlertSettingsPage': const AlertSettingsPage(),
    'SensorChoicePage': const SensorChoicePage(),
    'SensorLinkPage': const SensorLinkPage(),
    'ProfileEditPage': const ProfileEditPage(),
    'CarbEditPage': CarbEditPage(
      entry: CarbEntry.create(grams: 30, description: 'x', time: DateTime(2026, 1, 1)),
    ),
    'InsulinEditPage': InsulinEditPage(
      entry: InsulinEntry.create(
        units: 4,
        type: InsulinType.bolus,
        time: DateTime(2026, 1, 1),
        dayOfWeek: 'Segunda',
      ),
    ),
    'CarbEntryPage': const CarbEntryPage(),
    'InsulinEntryPage': const InsulinEntryPage(),
  };

  for (final entry in pages.entries) {
    // The identity chip and its "Sair da conta" menu were removed from the
    // header by product decision (2026-08-24); logout lives only in Settings.
    testWidgets('${entry.key} keeps the header free of account actions',
        (tester) async {
      await pumpStacked(tester, entry.value);

      expect(find.byType(PopupMenuButton<String>), findsNothing);
      // Scoped to the AppBar on purpose: SettingsPage still offers logout in
      // its BODY, which is where it now lives.
      expect(
        find.descendant(
          of: find.byType(AppBar),
          matching: find.text('Sair da conta'),
        ),
        findsNothing,
      );
    });

    testWidgets('${entry.key} keeps a working back button', (tester) async {
      await pumpStacked(tester, entry.value);

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();

      expect(find.text('open'), findsOneWidget);
    });
  }
}

class _FakeAccountService extends AccountService {
  _FakeAccountService({required this.fullName}) : super(Dio());

  final String fullName;

  @override
  Future<AccountProfile> fetchProfile() async => AccountProfile(
        email: 'ana@glucore.app',
        fullName: fullName,
        birthDate: null,
        diabetesType: null,
        weightKg: null,
        targetRangeMin: 80,
        targetRangeMax: 180,
      );
}

class _FakeAuthRepository implements AuthRepository {
  int logoutCalls = 0;

  @override
  Future<AuthSessionStatus> isLoggedIn() async => AuthSessionStatus.invalid;

  @override
  Future<bool> login({required String email, required String password}) async =>
      true;

  @override
  Future<bool> register({
    required String fullName,
    required String email,
    required String password,
    String? phone,
    DateTime? birthDate,
    double? weightKg,
    int? targetRangeMin,
    int? targetRangeMax,
  }) async =>
      true;

  @override
  Future<void> logout() async {
    logoutCalls++;
  }
}

// initialize() is overridden to a no-op so the fake never touches its
// repository — these tests only exercise the AppBar around a fixed empty
// PatientState, mirroring sensor_choice_navigation_test.dart's fake.
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
      PatientRepository(
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

class _FakeSensorCubit extends SensorCubit {
  _FakeSensorCubit() : super(repository: _FakeSensorRepository());

  @override
  Future<void> initialize() async {}
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
