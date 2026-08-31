import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/api/auth_token_store.dart';
import 'package:glucore/features/auth/data/datasources/account_service.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/repositories/patient_repository_impl.dart';
import 'package:glucore/features/patient/domain/repositories/patient_repository.dart';
import 'package:glucore/features/patient/domain/usecases/patient_usecases.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/presentation/cubit/patient_cubit.dart';
import 'package:glucore/features/patient/presentation/cubit/patient_state.dart';
import 'package:glucore/features/patient/presentation/cubit/user_identity_cubit.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/presentation/pages/monitoring_home_page.dart';
import 'package:glucore/features/patient/presentation/pages/sensor_choice_page.dart';
import 'package:glucore/features/sensor/domain/models.dart';
import 'package:glucore/features/sensor/presentation/cubit/sensor_cubit.dart';
import 'package:glucore/l10n/l10n.dart';

/// Spec: TCC-14 / spec.md P3 "Identidade visual e responsividade consistentes"
/// AC1 (all user-facing text in `monitoring_home_page.dart` comes from
/// `AppLocalizations`) and AC2 (no `Colors.red`/`Colors.green` anywhere in
/// `lib/`). Independent Test: reading the file with the app's pt/pt_BR
/// localizations must produce the same strings the widget renders, and the
/// source must no longer construct destructive UI from `Colors.red`.
void main() {
  late AppLocalizations l10n;
  late _FakePatientCubit patientCubit;
  late UserIdentityCubit identity;

  setUp(() async {
    l10n = await AppLocalizations.delegate.load(const Locale('pt', 'BR'));
    patientCubit = _FakePatientCubit();
    identity = UserIdentityCubit(
      accountService: _FakeAccountService(fullName: 'Ana Silva'),
    );
  });

  tearDown(() async {
    await patientCubit.close();
    await identity.close();
  });

  Future<void> pump(WidgetTester tester, PatientState state) async {
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
          home: const MonitoringHomePage(),
        ),
      ),
    );
    // A single frame is enough: none of these assertions depend on
    // GlucoseChart's own transition animation finishing, and pumping to
    // settle would time out waiting on it.
    await tester.pump();
  }

  testWidgets(
    'shows the localized bluetooth tooltip instead of a hardcoded string',
    (tester) async {
      await pump(tester, const PatientState());

      final tooltipFinder = find.byTooltip(l10n.monitoringPairSensorTooltip);
      expect(tooltipFinder, findsOneWidget);
    },
  );

  testWidgets(
    'P30: pairing icon opens brand selection, not a fixed brand flow',
    (tester) async {
      await pump(tester, const PatientState());

      await tester.tap(find.byTooltip(l10n.monitoringPairSensorTooltip));
      await tester.pumpAndSettle();

      expect(find.byType(SensorChoicePage), findsOneWidget);
    },
  );

  testWidgets(
    'shows the localized no-sensor card title and subtitle while scanning',
    (tester) async {
      await pump(
        tester,
        const PatientState(
          sensorState: SensorUiState(status: SensorConnectionStatus.scanning),
        ),
      );

      expect(find.text(l10n.monitoringNoSensorScanningTitle), findsOneWidget);
      expect(
        find.text(l10n.monitoringNoSensorScanningSubtitle),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'shows the localized default no-sensor card when disconnected',
    (tester) async {
      await pump(
        tester,
        const PatientState(
          sensorState:
              SensorUiState(status: SensorConnectionStatus.disconnected),
        ),
      );

      expect(find.text(l10n.monitoringNoSensorDefaultTitle), findsOneWidget);
      expect(
        find.text(l10n.monitoringNoSensorDefaultSubtitle),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'shows localized stats row labels and the GMI estimate from AppLocalizations',
    (tester) async {
      final now = DateTime.now();
      final readings = List.generate(
        14,
        (i) => GlucoseReadingItem(
          value: 100,
          timestamp: now.subtract(Duration(minutes: i)),
          trend: GlucoseTrend.stable,
          rate: 0,
        ),
      );

      await pump(tester, PatientState(readings: readings));

      expect(find.text(l10n.monitoringChartSectionTitle), findsOneWidget);
      expect(find.text(l10n.monitoringTimeInTargetLabel), findsOneWidget);
      expect(find.text(l10n.monitoringAverageLabel), findsOneWidget);
      expect(find.text(l10n.monitoringGmiEstimateLabel), findsOneWidget);
    },
  );

  testWidgets(
    'shows the sensor strip using the localized days-left template',
    (tester) async {
      final session = SensorSession(
        sensorId: 'SN12345678ABC',
        createdAt: DateTime.now(),
      );

      await pump(
        tester,
        PatientState(
          sensorState: SensorUiState(session: session),
        ),
      );

      expect(
        find.text(l10n.monitoringSensorDaysLeftLabel(14, 'SN123456')),
        findsOneWidget,
      );
    },
  );

  test(
    'no longer hardcodes Colors.red/Colors.green or the migrated Portuguese '
    'strings that used to live directly in the widget tree',
    () async {
      final source = await File(
        'lib/features/patient/presentation/pages/monitoring_home_page.dart',
      ).readAsString();

      expect(source.contains('Colors.red'), isFalse);
      expect(source.contains('Colors.green'), isFalse);

      const migratedLiterals = [
        "'Excluir registro?'",
        "'Esta ação não pode ser desfeita.'",
        "'Cancelar'",
        "'Excluir'",
        "'Editar'",
        "'Fechar'",
        "'Parear sensor'",
        "'Procurando sensor…'",
        "'Sem sensor conectado'",
        "'Últimas 12 horas'",
        "'Tempo no alvo'",
        "'Média'",
        "'GMI est.'",
      ];
      for (final literal in migratedLiterals) {
        expect(
          source.contains(literal),
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

/// `initialize()` is a no-op so the fake never touches its repository — these
/// tests only exercise the page around an explicitly set [PatientState],
/// mirroring the fake in `shell_tabs_user_app_bar_test.dart`.
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
