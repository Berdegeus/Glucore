import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/theme/theme_cubit.dart';
import 'package:glucore/features/auth/domain/repositories/auth_repository.dart';
import 'package:glucore/features/auth/domain/usecases/get_auth_status_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/login_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/logout_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/register_usecase.dart';
import 'package:glucore/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:glucore/features/auth/presentation/cubit/auth_state.dart';
import 'package:glucore/features/patient/presentation/pages/settings_page.dart';
import 'package:glucore/l10n/l10n.dart';

/// Reproduces a real-device bug: logging out from `SettingsPage` left the
/// user stuck on the settings screen instead of seeing the login page.
///
/// Root cause: `SettingsPage` is a route PUSHED on top of `AuthGate`'s route
/// (route 0 of the app's single Navigator). `AuthGate` is a `BlocBuilder`
/// that swaps ITS OWN content (shell ↔ login) by `AuthStatus` — but that
/// swap only changes what route 0 renders underneath. It does not pop the
/// Navigator, so a pushed screen (Settings) stays on top, obscuring the
/// login page that route 0 now renders. The fix in `settings_page.dart`
/// pops back to the first route before/with triggering logout, mirroring
/// what `app.dart`'s `_handleSessionExpired` already does for session expiry.
///
/// This test stands in a lightweight "authenticated shell" placeholder for
/// `AuthGate`'s real `PatientShellPage` branch (which needs the full
/// Sensor/PatientCubit dependency graph — irrelevant to this navigation bug)
/// while keeping AuthGate's actual mechanism: a state-driven swap of route 0's
/// content, with SettingsPage pushed on top exactly as it is in production.
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

  testWidgets(
      'logging out from a pushed Settings screen reveals the login page',
      (tester) async {
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<AuthCubit>.value(value: cubit),
          BlocProvider<ThemeCubit>(create: (_) => ThemeCubit()),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: BlocBuilder<AuthCubit, AuthState>(
            builder: (context, state) {
              if (state.status == AuthStatus.authenticated) {
                // Stand-in for AuthGate's `PatientShellPage()` branch: a
                // screen that, like the real shell, pushes Settings onto the
                // SAME root Navigator AuthGate's own route lives on.
                return Scaffold(
                  body: Center(
                    child: TextButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const SettingsPage(),
                        ),
                      ),
                      child: const Text('SHELL'),
                    ),
                  ),
                );
              }
              return const _LoginPagePlaceholder();
            },
          ),
        ),
      ),
    );
    await tester.pump();

    // Start authenticated, as if the user already signed in.
    await cubit.checkAuthStatus();
    await tester.pumpAndSettle();
    expect(find.text('SHELL'), findsOneWidget);

    // Navigate into Settings the way the shell does: a normal push onto the
    // same root Navigator that renders route 0 above.
    await tester.tap(find.text('SHELL'));
    await tester.pumpAndSettle();
    expect(find.byType(SettingsPage), findsOneWidget);

    // Tap "Sair da conta" and confirm in the dialog. The tile sits below the
    // fold on this page — scroll it into the build window first, same as
    // settings_profile_l10n_test.dart already does.
    final logoutButton =
        find.widgetWithText(OutlinedButton, 'Sair da conta');
    await tester.scrollUntilVisible(logoutButton, 200);
    await tester.pumpAndSettle();
    await tester.tap(logoutButton);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Sair da conta'));
    await tester.pumpAndSettle();

    // The bug this guards against: without popping the Navigator, the app
    // would still show SettingsPage here — logout() only ever swapped what
    // route 0 renders underneath, and nothing was left to reveal it.
    expect(find.byType(SettingsPage), findsNothing);
    expect(find.byType(_LoginPagePlaceholder), findsOneWidget);
    expect(repo.logoutCalls, 1);
  });
}

/// Minimal stand-in for `LoginPage` — the identity of AuthGate's
/// unauthenticated branch is what this test asserts on, not its content.
class _LoginPagePlaceholder extends StatelessWidget {
  const _LoginPagePlaceholder();

  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: Text('LOGIN')));
}

class _FakeAuthRepository implements AuthRepository {
  int logoutCalls = 0;

  @override
  Future<AuthSessionStatus> isLoggedIn() async => AuthSessionStatus.authenticated;

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
