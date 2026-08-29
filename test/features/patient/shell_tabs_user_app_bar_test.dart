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
import 'package:glucore/features/patient/presentation/pages/diary_page.dart';
import 'package:glucore/features/patient/presentation/pages/monitoring_home_page.dart';
import 'package:glucore/features/patient/presentation/pages/profile_page.dart';
import 'package:glucore/features/patient/presentation/pages/reports_page.dart';
import 'package:glucore/features/sensor/presentation/cubit/sensor_cubit.dart';
import 'package:glucore/l10n/l10n.dart';

/// Spec: TCC-04 — spec.md P1 "Identidade do usuário e saída visíveis em todas
/// as telas" AC1, AC2, AC4 and its Independent Test ("percorrer as quatro
/// abas... em todas o nome aparece no topo e o menu tem 'Sair da conta'").
void main() {
  late _FakeAuthRepository authRepo;
  late AuthCubit authCubit;
  late UserIdentityCubit identity;
  late PatientCubit patientCubit;

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
  });

  tearDown(() async {
    await authCubit.close();
    await identity.close();
    await patientCubit.close();
  });

  Future<void> pumpTab(WidgetTester tester, Widget page) async {
    await identity.load('Paciente Glucore');
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<AuthCubit>.value(value: authCubit),
          BlocProvider<UserIdentityCubit>.value(value: identity),
          BlocProvider<PatientCubit>.value(value: patientCubit),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: page,
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  final tabs = <String, Widget>{
    'Monitor': const MonitoringHomePage(),
    'Diário': const DiaryPage(),
    'Relatórios': const ReportsPage(),
    'Perfil': const ProfilePage(),
  };

  for (final entry in tabs.entries) {
    // The identity chip and its "Sair da conta" menu were removed from the
    // header by product decision (2026-08-24); logout lives only in Settings.
    // What the header must still NOT do is offer account actions.
    testWidgets('${entry.key} keeps the header free of account actions',
        (tester) async {
      await pumpTab(tester, entry.value);

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
  }

  testWidgets('Monitor keeps its notification and bluetooth icons',
      (tester) async {
    await pumpTab(tester, const MonitoringHomePage());

    expect(find.byIcon(Icons.notifications_none_rounded), findsOneWidget);
    expect(find.byIcon(Icons.bluetooth_searching), findsOneWidget);
  });

  testWidgets('Profile keeps its settings gear icon', (tester) async {
    await pumpTab(tester, const ProfilePage());

    expect(find.byIcon(Icons.settings_outlined), findsOneWidget);
  });
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
