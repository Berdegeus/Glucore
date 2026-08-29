import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/app.dart';
import 'package:glucore/core/session/session_expiry_notifier.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/core/theme/theme_cubit.dart';
import 'package:glucore/features/auth/domain/repositories/auth_repository.dart';
import 'package:glucore/features/auth/domain/usecases/get_auth_status_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/login_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/logout_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/register_usecase.dart';
import 'package:glucore/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:glucore/features/auth/presentation/pages/login_page.dart';
import 'package:glucore/features/auth/presentation/pages/register_page.dart';
import 'package:glucore/injection_container.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Spec: TCC-12 — spec.md P2 (autorização) AC6 and the edge case "várias
/// requisições recebem 401 TOKEN_INVALID simultaneamente": one logout, one
/// login screen, no stacked routes.
void main() {
  late _FakeAuthRepository repo;
  late SessionExpiryNotifier notifier;
  late AuthCubit cubit;

  setUp(() {
    SharedPreferences.setMockInitialValues({'onboarding_done': true});
    repo = _FakeAuthRepository();
    notifier = SessionExpiryNotifier();
    cubit = AuthCubit(
      loginUseCase: LoginUseCase(repo),
      logoutUseCase: LogoutUseCase(repo),
      getAuthStatusUseCase: GetAuthStatusUseCase(repo),
      registerUseCase: RegisterUseCase(repo),
      connectivityChanges: const Stream.empty(),
    );
    // App resolves all three from the container; the factory hands back the
    // same instance so the test can drive it.
    sl.registerFactory<AuthCubit>(() => cubit);
    sl.registerLazySingleton<SessionExpiryNotifier>(() => notifier);
    sl.registerLazySingleton<ThemeCubit>(ThemeCubit.new);
  });

  tearDown(() async {
    await sl.reset();
    notifier.dispose();
  });

  /// Boots the app past the splash screen and onto the login page.
  Future<void> bootToLogin(WidgetTester tester) async {
    await tester.pumpWidget(const App());
    await tester.pump(const Duration(seconds: 2)); // splash timer
    await tester.pumpAndSettle();
    expect(find.byType(LoginPage), findsOneWidget);
  }

  Future<void> pushRegisterRoute(WidgetTester tester) async {
    await tester.tap(find.widgetWithText(OutlinedButton, 'Criar conta'));
    await tester.pumpAndSettle();
    expect(find.byType(RegisterPage), findsOneWidget);
  }

  testWidgets('an expired session returns to login with the warning',
      (tester) async {
    await bootToLogin(tester);
    await pushRegisterRoute(tester);

    notifier.signal();
    await tester.pumpAndSettle();

    expect(find.byType(RegisterPage), findsNothing);
    expect(find.byType(LoginPage), findsOneWidget);
    expect(repo.logoutCalls, 1);

    expect(
      tester.widget<SnackBar>(find.byType(SnackBar)).backgroundColor,
      AppTheme.zoneHighBg,
    );
    expect(
      find.descendant(
        of: find.byType(SnackBar),
        matching: find.text('Sua sessão expirou. Entre novamente.'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('signalling twice logs out once and shows one login screen',
      (tester) async {
    await bootToLogin(tester);
    await pushRegisterRoute(tester);

    notifier.signal();
    notifier.signal();
    await tester.pumpAndSettle();

    expect(repo.logoutCalls, 1);
    expect(find.byType(LoginPage), findsOneWidget);
    expect(find.byType(SnackBar), findsOneWidget);
  });

  testWidgets('authenticating clears the latch so the next session can expire',
      (tester) async {
    await bootToLogin(tester);

    notifier.signal();
    await tester.pumpAndSettle();
    expect(notifier.expired, isTrue);

    // Signing in again must re-arm the signal for the new session. The tree is
    // deliberately not pumped: rendering the authenticated shell is out of
    // scope here.
    await cubit.login(email: 'ana@glucore.app', password: 'Senha123!');
    await tester.idle();

    expect(notifier.expired, isFalse);
  });
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
  Future<void> logout() async => logoutCalls++;
}
