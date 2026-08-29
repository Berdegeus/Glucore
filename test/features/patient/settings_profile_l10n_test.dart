import 'dart:io';

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
import 'package:glucore/features/patient/presentation/cubit/patient_state.dart';
import 'package:glucore/features/patient/presentation/cubit/user_identity_cubit.dart';
import 'package:glucore/features/patient/presentation/models/patient_models.dart';
import 'package:glucore/features/patient/presentation/pages/profile_page.dart';
import 'package:glucore/features/patient/presentation/pages/settings_page.dart';
import 'package:glucore/features/sensor/domain/models.dart';
import 'package:glucore/features/sensor/presentation/cubit/sensor_cubit.dart';
import 'package:glucore/l10n/l10n.dart';

/// Spec: TCC-14 / spec.md P3 "Identidade visual e responsividade consistentes"
/// AC1 — every user-facing string in `settings_page.dart` and
/// `profile_page.dart` comes from `AppLocalizations`.
void main() {
  late AppLocalizations l10n;
  late UserIdentityCubit identity;
  late _FakeAuthRepository authRepo;
  late AuthCubit authCubit;
  late _FakePatientCubit patientCubit;

  setUp(() async {
    l10n = await AppLocalizations.delegate.load(const Locale('pt', 'BR'));
    identity = UserIdentityCubit(
      accountService: _FakeAccountService(fullName: 'Ana Silva'),
    );
    authRepo = _FakeAuthRepository();
    authCubit = AuthCubit(
      loginUseCase: LoginUseCase(authRepo),
      logoutUseCase: LogoutUseCase(authRepo),
      getAuthStatusUseCase: GetAuthStatusUseCase(authRepo),
      registerUseCase: RegisterUseCase(authRepo),
      connectivityChanges: const Stream.empty(),
    );
    patientCubit = _FakePatientCubit();
  });

  tearDown(() async {
    await identity.close();
    await authCubit.close();
    await patientCubit.close();
  });

  Future<void> pumpSettings(WidgetTester tester) async {
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<AuthCubit>.value(value: authCubit),
          BlocProvider<UserIdentityCubit>.value(value: identity),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const SettingsPage(),
        ),
      ),
    );
    await tester.pump();
  }

  Future<void> pumpProfile(WidgetTester tester, PatientState state) async {
    patientCubit.setState(state);
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<PatientCubit>.value(value: patientCubit),
          BlocProvider<UserIdentityCubit>.value(value: identity),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const ProfilePage(),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets(
    'SettingsPage renders every section title, row and toggle from AppLocalizations',
    (tester) async {
      await pumpSettings(tester);

      expect(
        find.text(l10n.settingsGlucoseSectionTitle.toUpperCase()),
        findsOneWidget,
      );
      expect(
        find.text(l10n.genericSensorSectionTitle.toUpperCase()),
        findsOneWidget,
      );
      expect(
        find.text(l10n.genericDataSectionTitle.toUpperCase()),
        findsOneWidget,
      );
      expect(find.text(l10n.settingsGlucoseAlertsRowLabel), findsOneWidget);
      expect(find.text(l10n.settingsConfigureRowValue), findsOneWidget);
      expect(find.text(l10n.settingsManageSensorRowLabel), findsOneWidget);
      expect(find.text(l10n.settingsSelectRowValue), findsOneWidget);
      expect(find.text(l10n.settingsExportDataRowLabel), findsOneWidget);
      expect(find.text(l10n.settingsComingSoonRowValue), findsOneWidget);
      expect(
        find.text(l10n.settingsNotificationsSectionTitle),
        findsOneWidget,
      );
      expect(
        find.text(l10n.settingsLowGlucoseAlertToggleLabel),
        findsOneWidget,
      );
      expect(
        find.text(l10n.settingsHighGlucoseAlertToggleLabel),
        findsOneWidget,
      );
      expect(find.text(l10n.settingsSignalLossToggleLabel), findsOneWidget);
    },
  );

  testWidgets(
    'SettingsPage logout button shows the localized confirmation and cancel '
    'leaves the session untouched',
    (tester) async {
      await pumpSettings(tester);

      final logoutButton =
          find.widgetWithText(OutlinedButton, l10n.settingsLogoutTile);
      await tester.ensureVisible(logoutButton);
      await tester.pumpAndSettle();
      await tester.tap(logoutButton);
      await tester.pump();

      expect(find.text(l10n.settingsLogoutConfirmMessage), findsOneWidget);
      expect(find.text(l10n.genericCancelButton), findsOneWidget);

      await tester.tap(find.text(l10n.genericCancelButton));
      await tester.pump();

      expect(authRepo.logoutCalls, 0);
    },
  );

  // Moved here from user_app_bar_test.dart on 2026-08-24: the header's
  // identity/logout chip was removed, so Settings is the only place that can
  // end a session and the confirm path must be covered where it lives.
  testWidgets(
    'SettingsPage logout confirmation calls AuthCubit.logout()',
    (tester) async {
      await pumpSettings(tester);

      final logoutButton =
          find.widgetWithText(OutlinedButton, l10n.settingsLogoutTile);
      await tester.ensureVisible(logoutButton);
      await tester.pumpAndSettle();
      await tester.tap(logoutButton);
      await tester.pump();

      // The dialog repeats the tile label on its confirm action; the last
      // match is the one inside the dialog.
      await tester.tap(find.text(l10n.settingsLogoutTile).last);
      await tester.pumpAndSettle();

      expect(authRepo.logoutCalls, 1);
    },
  );

  testWidgets(
    'ProfilePage renders sections, rows and formatted values from AppLocalizations',
    (tester) async {
      final session = SensorSession(
        sensorId: 'SN123',
        createdAt: DateTime.now(),
      );
      final reading = GlucoseReadingItem(
        value: 120,
        timestamp: DateTime.now(),
        trend: GlucoseTrend.stable,
        rate: 0,
      );

      await pumpProfile(
        tester,
        PatientState(
          readings: [reading],
          sensorState: SensorUiState(session: session),
        ),
      );

      expect(find.text(l10n.profileTitle), findsOneWidget);
      expect(find.text(l10n.profileEditProfileLink), findsOneWidget);
      expect(
        find.text(l10n.genericSensorSectionTitle.toUpperCase()),
        findsOneWidget,
      );
      expect(
        find.text(l10n.profileGlucoseTargetsSectionTitle.toUpperCase()),
        findsOneWidget,
      );
      expect(
        find.text(l10n.genericDataSectionTitle.toUpperCase()),
        findsOneWidget,
      );
      expect(find.text(l10n.profileSensorIdRowLabel), findsOneWidget);
      expect(find.text(l10n.profileLastReadingRowLabel), findsOneWidget);
      expect(find.text(l10n.genericGlucoseValue('120')), findsOneWidget);
      expect(find.text(l10n.profileDaysLeftRowLabel), findsOneWidget);
      expect(find.text(l10n.profileDaysLeftValue(14)), findsOneWidget);
      expect(find.text(l10n.profileLowAlertRowLabel), findsOneWidget);
      expect(find.text(l10n.profileHighAlertRowLabel), findsOneWidget);
      expect(find.text(l10n.genericGlucoseValue(80)), findsOneWidget);
      expect(find.text(l10n.genericGlucoseValue(180)), findsOneWidget);
      expect(find.text(l10n.profileReadingsHistoryRowLabel), findsOneWidget);
      expect(find.text(l10n.profileReadingsCountValue(1)), findsOneWidget);
      expect(find.text(l10n.profileSharedCareTitle), findsOneWidget);
      expect(find.text(l10n.profileSharedCareSubtitle), findsOneWidget);
    },
  );

  test(
    'settings_page.dart and profile_page.dart no longer hardcode the '
    'Portuguese strings that used to live directly in the widget tree',
    () async {
      final settingsSource = await File(
        'lib/features/patient/presentation/pages/settings_page.dart',
      ).readAsString();
      final profileSource = await File(
        'lib/features/patient/presentation/pages/profile_page.dart',
      ).readAsString();

      const migratedSettingsLiterals = [
        "'Glicose'",
        "'Alertas de glicose'",
        "'Configurar'",
        "'Sensor'",
        "'Gerenciar sensor'",
        "'Selecionar'",
        "'Dados'",
        "'Exportar dados'",
        "'Em breve'",
        "'Deseja sair da sua conta?'",
        "'Cancelar'",
        "'NOTIFICAÇÕES'",
        "'Alerta de glicose baixa'",
        "'Alerta de glicose alta'",
        "'Perda de sinal'",
      ];
      for (final literal in migratedSettingsLiterals) {
        expect(
          settingsSource.contains(literal),
          isFalse,
          reason: '$literal should now come from AppLocalizations',
        );
      }

      const migratedProfileLiterals = [
        "'Perfil'",
        "'Editar perfil'",
        "'Sensor'",
        "'ID do sensor'",
        "'Última leitura'",
        "'Dias restantes'",
        "'Metas de glicose'",
        "'Alerta baixo'",
        "'Alerta alto'",
        "'Dados'",
        "'Histórico de leituras'",
        "'Cuidado compartilhado'",
        "'Em breve — conecte seu médico'",
      ];
      for (final literal in migratedProfileLiterals) {
        expect(
          profileSource.contains(literal),
          isFalse,
          reason: '$literal should now come from AppLocalizations',
        );
      }
    },
  );
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

/// `initialize()` is a no-op so the fake never touches its repository — these
/// tests only exercise the page around an explicitly set [PatientState],
/// mirroring the fake in `shell_tabs_user_app_bar_test.dart`.
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

  void setState(PatientState state) => emit(state);
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
