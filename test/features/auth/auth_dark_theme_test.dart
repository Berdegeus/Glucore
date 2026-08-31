import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/core/theme/glucore_colors.dart';
import 'package:glucore/features/auth/domain/repositories/auth_repository.dart';
import 'package:glucore/features/auth/domain/usecases/get_auth_status_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/login_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/logout_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/register_usecase.dart';
import 'package:glucore/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:glucore/features/auth/presentation/pages/login_page.dart';
import 'package:glucore/features/auth/presentation/pages/onboarding_page.dart';
import 'package:glucore/features/auth/presentation/pages/splash_page.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

/// THEME-05 — "The system SHALL resolver as cores de superfície e de texto pelo
/// tema ativo em todas as telas do app." Escopo desta tarefa: as telas de auth,
/// os widgets compartilhados e o `core`.
///
/// Cada tela é renderizada em `ThemeMode.dark` e a árvore montada é varrida:
/// uma superfície ou tinta ainda vinda de constante estática apareceria com o
/// valor claro, que é o que as asserções proíbem.
void main() {
  /// Superfícies que só existem no tema claro.
  final lightOnlySurfaces = <Color>{
    GlucoreColors.light.surfaceCanvas,
    GlucoreColors.light.surfaceElevated,
    GlucoreColors.light.surfaceSunken,
  };

  /// Tintas que só existem no tema claro. `Colors.white` fica de fora: é a cor
  /// legítima do texto sobre a marca, nos dois temas.
  final lightOnlyInks = <Color>{
    GlucoreColors.light.ink,
    GlucoreColors.light.inkMuted,
  };

  late _FakeAuthRepository repo;
  late AuthCubit cubit;

  setUp(() {
    repo = _FakeAuthRepository();
    cubit = AuthCubit(
      loginUseCase: LoginUseCase(repo),
      logoutUseCase: LogoutUseCase(repo),
      getAuthStatusUseCase: GetAuthStatusUseCase(repo),
      registerUseCase: RegisterUseCase(repo),
      connectivityChanges: const Stream.empty(),
    );
    addTearDown(cubit.close);
  });

  Future<void> pumpDark(WidgetTester tester, Widget page) async {
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: ThemeMode.dark,
        home: BlocProvider<AuthCubit>.value(value: cubit, child: page),
      ),
    );
    await tester.pump();
  }

  List<Color> surfacesOf(WidgetTester tester) {
    final colors = <Color>[];
    for (final container
        in tester.widgetList<Container>(find.byType(Container))) {
      if (container.color != null) colors.add(container.color!);
      final decoration = container.decoration;
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

  List<Color> inksOf(WidgetTester tester) => [
        for (final text in tester.widgetList<Text>(find.byType(Text)))
          if (text.style?.color != null) text.style!.color!,
      ];

  final screens = <String, Widget>{
    'LoginPage': const LoginPage(),
    'OnboardingPage': OnboardingPage(onDone: () {}),
  };

  for (final entry in screens.entries) {
    testWidgets(
        '${entry.key} paints no light-theme surface under ThemeMode.dark',
        (tester) async {
      await pumpDark(tester, entry.value);

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
      await pumpDark(tester, entry.value);

      for (final color in inksOf(tester)) {
        expect(
          lightOnlyInks.contains(color),
          isFalse,
          reason: '${entry.key} resolveu $color, uma tinta do tema claro',
        );
      }
    });
  }

  testWidgets('SplashPage takes its brand background from the dark palette',
      (tester) async {
    await pumpDark(tester, SplashPage(onFinish: () {}));

    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
    expect(scaffold.backgroundColor, GlucoreColors.dark.brandBlue);
    expect(scaffold.backgroundColor, isNot(GlucoreColors.light.brandBlue));

    // O timer da splash não pode vazar para o próximo teste.
    await tester.pump(const Duration(milliseconds: 1600));
  });

  testWidgets('alert colours resolve from the active theme', (tester) async {
    late BuildContext darkContext;
    late BuildContext lightContext;

    Future<BuildContext> contextIn(ThemeMode mode) async {
      late BuildContext captured;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: mode,
          home: Builder(builder: (context) {
            captured = context;
            return const SizedBox.shrink();
          }),
        ),
      );
      // O `MaterialApp` anima a troca de tema; a asserção só vale depois que
      // a transição termina.
      await tester.pumpAndSettle();
      return captured;
    }

    darkContext = await contextIn(ThemeMode.dark);
    expect(
      AppAlertType.sensorReconnected.color(darkContext),
      GlucoreColors.dark.brandPrimary,
    );

    lightContext = await contextIn(ThemeMode.light);
    expect(
      AppAlertType.sensorReconnected.color(lightContext),
      GlucoreColors.light.brandPrimary,
    );
  });

  testWidgets('alert colours keep the clinical hues across themes (THEME-04)',
      (tester) async {
    late BuildContext darkContext;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: ThemeMode.dark,
        home: Builder(builder: (context) {
          darkContext = context;
          return const SizedBox.shrink();
        }),
      ),
    );

    expect(
      AppAlertType.glucoseLow.color(darkContext),
      GlucoreColors.light.warningLow,
    );
    expect(
      AppAlertType.glucoseHigh.color(darkContext),
      GlucoreColors.light.warningHigh,
    );
  });

  test('no colour in lib/ resolves from a static AppTheme constant', () async {
    // `AppTheme` ainda expõe `light()`, `dark()` e `monoStyle`: montagem de
    // tema e fábrica de fonte, não cor. O que não pode sobrar é constante de
    // cor lida direto da classe.
    const allowed = {'light', 'dark', 'monoStyle'};
    final offenders = <String>[];
    final pattern = RegExp(r'AppTheme\.(\w+)');

    await for (final entity in Directory('lib').list(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      final path = entity.path.replaceAll(Platform.pathSeparator, '/');
      if (path.contains('lib/core/theme/')) continue;
      final source = await entity.readAsString();
      for (final match in pattern.allMatches(source)) {
        if (!allowed.contains(match.group(1))) {
          offenders.add('$path: ${match.group(0)}');
        }
      }
    }

    expect(offenders, isEmpty);
  });
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
