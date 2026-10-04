import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/features/auth/domain/repositories/auth_repository.dart';
import 'package:glucore/features/auth/domain/usecases/get_auth_status_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/login_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/logout_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/register_usecase.dart';
import 'package:glucore/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:glucore/features/auth/presentation/pages/auth_gate.dart';
import 'package:glucore/features/auth/presentation/pages/login_page.dart';
import 'package:glucore/features/auth/presentation/widgets/password_field.dart';
import 'package:glucore/l10n/l10n.dart';

/// Reproduces a real-device bug that `login_page_test.dart` could not catch:
/// that file pumps `LoginPage` directly, bypassing `AuthGate` entirely. In
/// production, `AuthGate`'s `BlocBuilder` sits ABOVE `LoginPage` and swaps its
/// content by `AuthStatus`. A login attempt transitions
/// unauthenticated → loading → failure → unauthenticated; before the fix,
/// AuthGate treated `loading` the same for a boot-time check and for a login
/// attempt, replacing LoginPage with a full-screen spinner mid-submit. That
/// destroyed LoginPage's State — wiping the typed email/password — and its
/// BlocConsumer subscription, so the transient `failure` state's SnackBar was
/// never shown to anyone listening. The user just saw the form reset.
void main() {
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

  Future<void> pumpGate(WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: BlocProvider<AuthCubit>.value(
          value: cubit,
          child: const AuthGate(),
        ),
      ),
    );
    // AuthGate starts on AuthStatus.initial, which renders an indeterminate
    // CircularProgressIndicator — pumpAndSettle would spin forever on it.
    // Resolve to `unauthenticated` first, exactly like app.dart's initState
    // does via checkAuthStatus(), then settle on the (static) LoginPage.
    await cubit.checkAuthStatus();
    await tester.pumpAndSettle();
  }

  testWidgets(
      'a wrong password shows the error message and keeps the typed form',
      (tester) async {
    repo.loginResult = false;
    // The fake login() must genuinely suspend, like a real network call does
    // — otherwise loading→failure→unauthenticated resolves before Flutter
    // ever draws a frame for `loading`, and the bug this test targets
    // (AuthGate tearing LoginPage down mid-submit) never gets a chance to
    // happen. `tester.pump(duration)` below advances the fake clock past it.
    repo.loginDelay = const Duration(milliseconds: 200);
    await pumpGate(tester);

    await tester.enterText(find.byType(TextFormField).first, 'ana@glucore.app');
    await tester.enterText(find.byType(PasswordField), 'Senha123!');
    await tester.tap(find.widgetWithText(FilledButton, 'Entrar'));
    await tester.pump();

    // Sanity check: a real frame was drawn while the login request is still
    // in flight, and LoginPage itself (not a full-screen spinner replacing
    // it) is what shows that loading state — its own submit button switches
    // to "Entrando...". This is the exact frame the bug used to destroy.
    expect(find.text('Entrando...'), findsOneWidget);
    expect(find.byType(LoginPage), findsOneWidget);

    // Advance the fake clock past the simulated network delay.
    await tester.pump(const Duration(milliseconds: 250));

    // The bug this guards against: AuthGate used to swap to a full-screen
    // spinner mid-login, disposing LoginPage and losing this exact assertion
    // point — there would be nothing to find here but the spinner Scaffold.
    expect(find.byType(LoginPage), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(SnackBar),
        matching: find.text(
          'Credenciais inválidas. Use e-mail e senha com 4 ou mais caracteres.',
        ),
      ),
      findsOneWidget,
      reason: 'the failure state must reach a still-mounted listener',
    );

    // The user should not have to retype everything after a rejected attempt.
    expect(find.text('ana@glucore.app'), findsOneWidget);
  });
}

class _FakeAuthRepository implements AuthRepository {
  bool loginResult = true;

  /// Simulated network round trip. A real `Future.delayed` (advanced via
  /// `tester.pump(duration)`, Flutter's own idiom for this) — a `Completer`
  /// completed by a plain synchronous call does not reliably resume inside
  /// `testWidgets`'s zone-wrapped microtask scheduling.
  Duration loginDelay = Duration.zero;

  @override
  Future<AuthSessionStatus> isLoggedIn() async => AuthSessionStatus.invalid;

  @override
  Future<bool> login({required String email, required String password}) async {
    if (loginDelay > Duration.zero) await Future<void>.delayed(loginDelay);
    return loginResult;
  }

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
