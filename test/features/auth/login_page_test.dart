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
import 'package:glucore/features/auth/presentation/pages/login_page.dart';
import 'package:glucore/features/auth/presentation/widgets/password_field.dart';
import 'package:glucore/features/patient/presentation/widgets/glucore_form_layout.dart';
import 'package:glucore/l10n/l10n.dart';

/// Spec: TCC-02 / TCC-06 / TCC-15 — spec.md P1 AC4, AC5, AC8, P2 (mensagens)
/// AC2/AC3 and P3 (responsividade) AC4 applied to the login screen.
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

  Future<void> pumpLogin(WidgetTester tester, {Size? surface}) async {
    if (surface != null) {
      await tester.binding.setSurfaceSize(surface);
      addTearDown(() => tester.binding.setSurfaceSize(null));
    }
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: BlocProvider<AuthCubit>.value(
          value: cubit,
          child: const LoginPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> submit(WidgetTester tester) async {
    await tester.tap(find.widgetWithText(FilledButton, 'Entrar'));
    await tester.pumpAndSettle();
  }

  bool passwordIsObscured(WidgetTester tester) => tester
      .widget<EditableText>(
        find.descendant(
          of: find.byType(PasswordField),
          matching: find.byType(EditableText),
        ),
      )
      .obscureText;

  testWidgets('empty password blocks the submit with "Campo obrigatório"',
      (tester) async {
    await pumpLogin(tester);

    await tester.enterText(find.byType(TextFormField).first, 'ana@glucore.app');
    await submit(tester);

    expect(find.text('Campo obrigatório'), findsOneWidget);
    expect(repo.loginCalls, isEmpty);
  });

  testWidgets('a weak legacy password is accepted — no strength rule on login',
      (tester) async {
    await pumpLogin(tester);

    await tester.enterText(find.byType(TextFormField).first, 'ana@glucore.app');
    await tester.enterText(find.byType(PasswordField), 'senha123');
    await submit(tester);

    expect(repo.loginCalls, [('ana@glucore.app', 'senha123')]);
    expect(find.text('A senha deve conter ao menos uma letra maiúscula'),
        findsNothing);
    expect(find.text('A senha deve conter ao menos um caractere especial'),
        findsNothing);
  });

  testWidgets('the password field starts obscured and the icon reveals it',
      (tester) async {
    await pumpLogin(tester);

    expect(passwordIsObscured(tester), isTrue);

    await tester.tap(
      find.descendant(
        of: find.byType(PasswordField),
        matching: find.byType(IconButton),
      ),
    );
    await tester.pump();

    expect(passwordIsObscured(tester), isFalse);
  });

  testWidgets('a failed login is reported through GlucoreMessenger.error',
      (tester) async {
    repo.loginResult = false;
    await pumpLogin(tester);

    await tester.enterText(find.byType(TextFormField).first, 'ana@glucore.app');
    await tester.enterText(find.byType(PasswordField), 'Senha123!');
    await submit(tester);

    final snackBar = tester.widget<SnackBar>(find.byType(SnackBar));
    expect(snackBar.backgroundColor, AppTheme.zoneLowBg);
    expect(
      find.descendant(
        of: find.byType(SnackBar),
        matching: find.byIcon(Icons.error_outline),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byType(SnackBar),
        matching: find.text(
          'Credenciais inválidas. Use e-mail e senha com 4 ou mais caracteres.',
        ),
      ),
      findsOneWidget,
    );
  });

  testWidgets('above 600 dp the form is centred and capped at 560 dp',
      (tester) async {
    await pumpLogin(tester, surface: const Size(800, 900));

    final capped = find
        .descendant(
          of: find.byType(GlucoreFormLayout),
          matching: find.byType(ConstrainedBox),
        )
        .first;

    expect(tester.getSize(capped).width, 560);
    expect(tester.getTopLeft(capped).dx, 120);
  });
}

class _FakeAuthRepository implements AuthRepository {
  final List<(String, String)> loginCalls = [];
  bool loginResult = true;

  @override
  Future<AuthSessionStatus> isLoggedIn() async => AuthSessionStatus.invalid;

  @override
  Future<bool> login({required String email, required String password}) async {
    loginCalls.add((email, password));
    return loginResult;
  }

  @override
  Future<bool> register({
    required String fullName,
    required String email,
    required String password,
    DateTime? birthDate,
    double? weightKg,
    int? targetRangeMin,
    int? targetRangeMax,
  }) async =>
      true;

  @override
  Future<void> logout() async {}
}
