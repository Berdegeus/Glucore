import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/api/auth_token_store.dart';
import 'package:glucore/features/auth/data/datasources/account_service.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/repositories/patient_repository.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/presentation/cubit/patient_cubit.dart';
import 'package:glucore/features/patient/presentation/cubit/patient_state.dart';
import 'package:glucore/features/patient/presentation/cubit/user_identity_cubit.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/presentation/pages/diary_page.dart';
import 'package:glucore/features/patient/presentation/pages/reports_page.dart';
import 'package:glucore/features/sensor/presentation/cubit/sensor_cubit.dart';
import 'package:glucore/l10n/l10n.dart';

/// Spec: TCC-15 / spec.md "P3: Identidade visual e responsividade" AC3 and
/// AC5 — above 600 dp Diary and Reports lay their content out in two
/// columns; at 600 dp or below they keep today's single-column layout.
void main() {
  late UserIdentityCubit identity;
  late _FakePatientCubit patientCubit;

  setUp(() {
    identity = UserIdentityCubit(
      accountService: _FakeAccountService(fullName: 'Ana Silva'),
    );
    patientCubit = _FakePatientCubit();
  });

  tearDown(() async {
    await identity.close();
    await patientCubit.close();
  });

  Future<void> pumpAtWidth(
    WidgetTester tester,
    Widget page,
    PatientState state,
    double width,
  ) async {
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
          home: Align(
            alignment: Alignment.topLeft,
            child: SizedBox(width: width, height: 900, child: page),
          ),
        ),
      ),
    );
    await tester.pump();
  }

  final now = DateTime.now();
  final yesterday = now.subtract(const Duration(days: 1));

  PatientState diaryState() => PatientState(
        carbs: [
          CarbEntry.create(grams: 40, description: 'Café da manhã', time: now),
          CarbEntry.create(
            grams: 60,
            description: 'Jantar de ontem',
            time: yesterday,
          ),
        ],
      );

  group('DiaryPage', () {
    testWidgets('lays today and yesterday side by side above 600 dp',
        (tester) async {
      await pumpAtWidth(tester, const DiaryPage(), diaryState(), 800);
      expect(tester.takeException(), isNull);

      final todayX = tester.getTopLeft(find.text('Hoje')).dx;
      final yesterdayX = tester.getTopLeft(find.text('Ontem')).dx;
      final todayY = tester.getTopLeft(find.text('Hoje')).dy;
      final yesterdayY = tester.getTopLeft(find.text('Ontem')).dy;

      expect(todayX, isNot(closeTo(yesterdayX, 1)));
      expect(todayY, closeTo(yesterdayY, 1));
    });

    testWidgets('keeps a single column at exactly 600 dp', (tester) async {
      await pumpAtWidth(tester, const DiaryPage(), diaryState(), 600);
      expect(tester.takeException(), isNull);

      final todayX = tester.getTopLeft(find.text('Hoje')).dx;
      final yesterdayX = tester.getTopLeft(find.text('Ontem')).dx;

      expect(todayX, closeTo(yesterdayX, 1));
    });

    testWidgets('keeps a single column and no overflow at 400 dp',
        (tester) async {
      await pumpAtWidth(tester, const DiaryPage(), diaryState(), 400);
      expect(tester.takeException(), isNull);

      final todayX = tester.getTopLeft(find.text('Hoje')).dx;
      final yesterdayX = tester.getTopLeft(find.text('Ontem')).dx;
      final todayY = tester.getTopLeft(find.text('Hoje')).dy;
      final yesterdayY = tester.getTopLeft(find.text('Ontem')).dy;

      expect(todayX, closeTo(yesterdayX, 1));
      expect(todayY, isNot(closeTo(yesterdayY, 1)));
    });
  });

  group('ReportsPage', () {
    PatientState reportsState() => PatientState(
          readings: [
            GlucoseReadingItem(
              value: 120,
              timestamp: now,
              trend: GlucoseTrend.stable,
              rate: 0,
            ),
          ],
        );

    testWidgets('lays the indicators and time-in-target cards side by side '
        'above 600 dp', (tester) async {
      await pumpAtWidth(tester, const ReportsPage(), reportsState(), 800);
      expect(tester.takeException(), isNull);

      final indicatorsX = tester.getTopLeft(find.text('INDICADORES')).dx;
      final tirX = tester.getTopLeft(find.text('TEMPO NO ALVO')).dx;
      final indicatorsY = tester.getTopLeft(find.text('INDICADORES')).dy;
      final tirY = tester.getTopLeft(find.text('TEMPO NO ALVO')).dy;

      expect(indicatorsX, isNot(closeTo(tirX, 1)));
      expect(indicatorsY, closeTo(tirY, 1));
    });

    testWidgets('keeps a single stacked column at exactly 600 dp',
        (tester) async {
      await pumpAtWidth(tester, const ReportsPage(), reportsState(), 600);
      expect(tester.takeException(), isNull);

      final indicatorsX = tester.getTopLeft(find.text('INDICADORES')).dx;
      final tirX = tester.getTopLeft(find.text('TEMPO NO ALVO')).dx;

      expect(indicatorsX, closeTo(tirX, 1));
    });

    testWidgets('keeps a single stacked column and no overflow at 400 dp',
        (tester) async {
      await pumpAtWidth(tester, const ReportsPage(), reportsState(), 400);
      expect(tester.takeException(), isNull);

      final indicatorsX = tester.getTopLeft(find.text('INDICADORES')).dx;
      final tirX = tester.getTopLeft(find.text('TEMPO NO ALVO')).dx;
      final indicatorsY = tester.getTopLeft(find.text('INDICADORES')).dy;
      final tirY = tester.getTopLeft(find.text('TEMPO NO ALVO')).dy;

      expect(indicatorsX, closeTo(tirX, 1));
      expect(indicatorsY, isNot(closeTo(tirY, 1)));
    });
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
