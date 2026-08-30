import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/api/auth_token_store.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/core/theme/glucore_colors.dart';
import 'package:glucore/features/auth/data/datasources/account_service.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/repositories/patient_repository_impl.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/domain/repositories/patient_repository.dart';
import 'package:glucore/features/patient/domain/usecases/patient_usecases.dart';
import 'package:glucore/features/patient/presentation/cubit/patient_cubit.dart';
import 'package:glucore/features/patient/presentation/cubit/patient_state.dart';
import 'package:glucore/features/patient/presentation/cubit/user_identity_cubit.dart';
import 'package:glucore/features/patient/presentation/pages/diary_page.dart';
import 'package:glucore/features/patient/presentation/pages/history_page.dart';
import 'package:glucore/features/patient/presentation/pages/monitoring_home_page.dart';
import 'package:glucore/features/sensor/domain/models.dart';
import 'package:glucore/features/sensor/presentation/cubit/sensor_cubit.dart';
import 'package:glucore/l10n/l10n.dart';

/// THEME-05 — "The system SHALL resolver as cores de superfície e de texto pelo
/// tema ativo em todas as telas do app." Escopo desta tarefa: monitoramento,
/// histórico e diário.
///
/// O teste renderiza cada tela em `ThemeMode.dark` e varre a árvore montada.
/// Uma superfície ou tinta que ainda saísse de constante estática apareceria
/// com o valor claro: é exatamente o que as asserções proíbem.
///
/// As faixas clínicas ficam de fora da proibição de propósito (THEME-04): o
/// matiz delas é o mesmo nos dois temas.
void main() {
  /// Superfícies que só existem no tema claro. Nenhuma pode aparecer como
  /// fundo de `Container`/`Scaffold` numa tela renderizada no escuro.
  final lightOnlySurfaces = <Color>{
    GlucoreColors.light.surfaceCanvas,
    GlucoreColors.light.surfaceElevated,
    GlucoreColors.light.surfaceSunken,
  };

  /// Tintas de texto que só existem no tema claro. `Colors.white` fica de fora
  /// porque é a cor legítima do texto sobre a faixa clínica, nos dois temas.
  final lightOnlyInks = <Color>{
    GlucoreColors.light.ink,
    GlucoreColors.light.inkMuted,
  };

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

  Future<void> pumpDark(
    WidgetTester tester,
    Widget page,
    PatientState state,
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
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: ThemeMode.dark,
          home: page,
        ),
      ),
    );
    // Um frame basta: nenhuma asserção depende da animação do gráfico, e
    // `pumpAndSettle` esperaria por ela até estourar o tempo.
    await tester.pump();
  }

  /// Cores de fundo efetivamente montadas na árvore.
  List<Color> surfacesOf(WidgetTester tester) {
    final colors = <Color>[];
    for (final container in tester.widgetList<Container>(find.byType(Container))) {
      final decoration = container.decoration;
      if (container.color != null) colors.add(container.color!);
      if (decoration is BoxDecoration && decoration.color != null) {
        colors.add(decoration.color!);
      }
    }
    for (final scaffold in tester.widgetList<Scaffold>(find.byType(Scaffold))) {
      if (scaffold.backgroundColor != null) {
        colors.add(scaffold.backgroundColor!);
      }
    }
    for (final material in tester.widgetList<Material>(find.byType(Material))) {
      if (material.color != null) colors.add(material.color!);
    }
    return colors;
  }

  /// Cores de texto efetivamente montadas na árvore.
  List<Color> inksOf(WidgetTester tester) => [
        for (final text in tester.widgetList<Text>(find.byType(Text)))
          if (text.style?.color != null) text.style!.color!,
      ];

  final now = DateTime.now();

  PatientState populated() => PatientState(
        readings: [
          GlucoseReadingItem(
            value: 118,
            timestamp: now,
            trend: GlucoseTrend.stable,
            rate: 0,
          ),
          GlucoseReadingItem(
            value: 96,
            timestamp: now.subtract(const Duration(minutes: 20)),
            trend: GlucoseTrend.falling,
            rate: -0.4,
          ),
        ],
        carbs: [
          CarbEntry.create(grams: 40, description: 'Café da manhã', time: now),
        ],
        insulin: [
          InsulinEntry.create(
            units: 6,
            type: InsulinType.bolus,
            time: now,
            dayOfWeek: kDaysOfWeek[now.weekday - 1],
          ),
        ],
        sensorState: SensorUiState(
          session: SensorSession(sensorId: 'SN123', createdAt: now),
        ),
      );

  final screens = <String, Widget>{
    'MonitoringHomePage': const MonitoringHomePage(),
    'HistoryPage': const HistoryPage(),
    'DiaryPage': const DiaryPage(),
  };

  for (final entry in screens.entries) {
    testWidgets('${entry.key} paints no light-theme surface under ThemeMode.dark',
        (tester) async {
      await pumpDark(tester, entry.value, populated());

      final surfaces = surfacesOf(tester);
      expect(surfaces, isNotEmpty,
          reason: 'a tela precisa ter pintado alguma superfície');
      for (final color in surfaces) {
        expect(
          lightOnlySurfaces.contains(color),
          isFalse,
          reason: '${entry.key} resolveu $color, uma superfície do tema claro',
        );
      }
    });

    testWidgets('${entry.key} paints no light-theme ink under ThemeMode.dark',
        (tester) async {
      await pumpDark(tester, entry.value, populated());

      for (final color in inksOf(tester)) {
        expect(
          lightOnlyInks.contains(color),
          isFalse,
          reason: '${entry.key} resolveu $color, uma tinta do tema claro',
        );
      }
    });

    testWidgets('${entry.key} paints the dark palette under ThemeMode.dark',
        (tester) async {
      await pumpDark(tester, entry.value, populated());

      expect(
        surfacesOf(tester),
        contains(GlucoreColors.dark.surfaceCanvas),
        reason: '${entry.key} deveria usar a superfície escura da paleta',
      );
    });
  }

  testWidgets('MonitoringHomePage takes its scaffold background from the '
      'dark palette', (tester) async {
    await pumpDark(tester, const MonitoringHomePage(), populated());

    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
    expect(scaffold.backgroundColor, GlucoreColors.dark.surfaceElevated);
  });

  testWidgets('the clinical band keeps the same hue in the dark theme '
      '(THEME-04)', (tester) async {
    await pumpDark(tester, const MonitoringHomePage(), populated());

    // 118 mg/dL cai na faixa alvo; o cartão herói pinta o fundo com o matiz
    // da faixa, que é idêntico nos dois temas.
    expect(surfacesOf(tester), contains(GlucoreColors.light.zoneTargetBg));
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
