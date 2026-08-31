import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/core/theme/glucore_colors.dart';
import 'package:glucore/core/theme/theme_cubit.dart';
import 'package:glucore/core/theme/theme_preference_store.dart';
import 'package:glucore/features/auth/data/datasources/account_service.dart';
import 'package:glucore/features/auth/domain/repositories/auth_repository.dart';
import 'package:glucore/features/auth/domain/usecases/get_auth_status_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/login_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/logout_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/register_usecase.dart';
import 'package:glucore/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:glucore/features/patient/presentation/cubit/user_identity_cubit.dart';
import 'package:glucore/features/patient/presentation/pages/settings_page.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// THEME-01 — "WHEN o usuário escolhe o tema escuro nas configurações THEN the
/// system SHALL aplicar o tema imediatamente, sem reiniciar o app."
///
/// O teste monta a mesma ligação que `app.dart` faz (`MaterialApp` escutando o
/// `ThemeCubit`), toca a opção e cobra a troca no mesmo frame: brilho, paleta
/// resolvida e marca da opção selecionada.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AppLocalizations l10n;
  late ThemeCubit themeCubit;
  late UserIdentityCubit identity;
  late AuthCubit authCubit;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    l10n = await AppLocalizations.delegate.load(const Locale('pt', 'BR'));
    themeCubit = ThemeCubit();
    identity = UserIdentityCubit(accountService: _FakeAccountService());
    final authRepo = _FakeAuthRepository();
    authCubit = AuthCubit(
      loginUseCase: LoginUseCase(authRepo),
      logoutUseCase: LogoutUseCase(authRepo),
      getAuthStatusUseCase: GetAuthStatusUseCase(authRepo),
      registerUseCase: RegisterUseCase(authRepo),
      connectivityChanges: const Stream.empty(),
    );
  });

  tearDown(() async {
    await themeCubit.close();
    await identity.close();
    await authCubit.close();
  });

  Future<void> pumpSettings(WidgetTester tester) async {
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<AuthCubit>.value(value: authCubit),
          BlocProvider<UserIdentityCubit>.value(value: identity),
          BlocProvider<ThemeCubit>.value(value: themeCubit),
        ],
        child: BlocBuilder<ThemeCubit, ThemeMode>(
          builder: (context, mode) => MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            themeMode: mode,
            home: const SettingsPage(),
          ),
        ),
      ),
    );
    await tester.pump();
  }

  ThemeData themeInUse(WidgetTester tester) =>
      Theme.of(tester.element(find.byType(SettingsPage)));

  /// A seção fica no fim da lista: rolar até ela é parte do gesto real.
  ///
  /// `pumpAndSettle` depois do toque cobre só a transição de tema do
  /// `MaterialApp`; não há recarga de app nem reconstrução da árvore entre o
  /// toque e a asserção.
  Future<void> tapOption(WidgetTester tester, String label) async {
    await tester.ensureVisible(find.text(label));
    await tester.pumpAndSettle();
    await tester.tap(find.text(label));
    await tester.pumpAndSettle();
  }

  testWidgets('offers the three theme options with localized labels',
      (tester) async {
    await pumpSettings(tester);

    await tester.ensureVisible(find.text(l10n.settingsThemeDarkLabel));
    await tester.pumpAndSettle();

    expect(find.text(l10n.settingsAppearanceSectionTitle), findsOneWidget);
    expect(find.text(l10n.settingsThemeSystemLabel), findsOneWidget);
    expect(find.text(l10n.settingsThemeLightLabel), findsOneWidget);
    expect(find.text(l10n.settingsThemeDarkLabel), findsOneWidget);
  });

  testWidgets(
      'picking dark applies the dark theme immediately, without a restart '
      '(THEME-01)', (tester) async {
    await pumpSettings(tester);

    expect(themeInUse(tester).brightness, Brightness.light);
    expect(
      themeInUse(tester).extension<GlucoreColors>()!.surfaceCanvas,
      GlucoreColors.light.surfaceCanvas,
    );

    await tapOption(tester, l10n.settingsThemeDarkLabel);

    expect(themeCubit.state, ThemeMode.dark);
    expect(find.byType(SettingsPage), findsOneWidget,
        reason: 'a mesma tela continua montada: nada foi reiniciado');
    expect(themeInUse(tester).brightness, Brightness.dark);
    expect(
      themeInUse(tester).extension<GlucoreColors>()!.surfaceCanvas,
      GlucoreColors.dark.surfaceCanvas,
    );
  });

  testWidgets('picking light after dark switches the theme straight back',
      (tester) async {
    await pumpSettings(tester);

    await tapOption(tester, l10n.settingsThemeDarkLabel);
    expect(themeInUse(tester).brightness, Brightness.dark);

    await tapOption(tester, l10n.settingsThemeLightLabel);

    expect(themeCubit.state, ThemeMode.light);
    expect(themeInUse(tester).brightness, Brightness.light);
  });

  testWidgets('the selected option is the only one marked', (tester) async {
    await pumpSettings(tester);

    Finder markFor(String label) => find.descendant(
          of: find.ancestor(
            of: find.text(label),
            matching: find.byType(InkWell),
          ),
          matching: find.byIcon(Icons.check),
        );

    await tester.ensureVisible(find.text(l10n.settingsThemeDarkLabel));
    await tester.pumpAndSettle();

    expect(markFor(l10n.settingsThemeSystemLabel), findsOneWidget);
    expect(markFor(l10n.settingsThemeDarkLabel), findsNothing);

    await tapOption(tester, l10n.settingsThemeDarkLabel);

    expect(markFor(l10n.settingsThemeDarkLabel), findsOneWidget);
    expect(markFor(l10n.settingsThemeSystemLabel), findsNothing);
    expect(markFor(l10n.settingsThemeLightLabel), findsNothing);
  });

  testWidgets('the chosen mode is written to the preference store (THEME-02)',
      (tester) async {
    await pumpSettings(tester);

    await tapOption(tester, l10n.settingsThemeDarkLabel);
    await tester.pumpAndSettle();

    expect(await const ThemePreferenceStore().read(), ThemeMode.dark);
  });
}

class _FakeAccountService extends AccountService {
  _FakeAccountService() : super(Dio());

  @override
  Future<AccountProfile> fetchProfile() async => const AccountProfile(
        email: 'ana@glucore.app',
        fullName: 'Ana Silva',
        birthDate: null,
        diabetesType: null,
        weightKg: null,
        targetRangeMin: 80,
        targetRangeMax: 180,
      );
}

class _FakeAuthRepository implements AuthRepository {
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
  Future<void> logout() async {}
}
