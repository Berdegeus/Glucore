import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/features/auth/data/datasources/account_service.dart';
import 'package:glucore/features/auth/domain/repositories/auth_repository.dart';
import 'package:glucore/features/auth/domain/usecases/get_auth_status_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/login_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/logout_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/register_usecase.dart';
import 'package:glucore/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:glucore/features/auth/presentation/widgets/password_field.dart';
import 'package:glucore/features/patient/presentation/cubit/user_identity_cubit.dart';
import 'package:glucore/features/patient/presentation/pages/change_password_page.dart';
import 'package:glucore/l10n/l10n.dart';

/// Spec: TCC-10 / TCC-11 — spec.md P2 "Tela dedicada de troca de senha" AC1,
/// AC2, AC3, AC5.
const _currentLabel = 'Senha atual *';
const _newLabel = 'Nova senha *';
const _confirmLabel = 'Confirmar nova senha *';

void main() {
  late _FakeAccountService account;
  late _FakeAuthRepository authRepo;
  late AuthCubit authCubit;
  late UserIdentityCubit identity;

  setUp(() {
    account = _FakeAccountService();
    authRepo = _FakeAuthRepository();
    authCubit = AuthCubit(
      loginUseCase: LoginUseCase(authRepo),
      logoutUseCase: LogoutUseCase(authRepo),
      getAuthStatusUseCase: GetAuthStatusUseCase(authRepo),
      registerUseCase: RegisterUseCase(authRepo),
      connectivityChanges: const Stream.empty(),
    );
    identity = UserIdentityCubit(accountService: account);
    GetIt.instance.registerSingleton<AccountService>(account);
  });

  tearDown(() async {
    await authCubit.close();
    await identity.close();
    GetIt.instance.reset();
  });

  /// Pushes the page on a real Navigator, from an origin screen, so a
  /// successful change can be observed popping back to that origin.
  Future<void> pumpFromOrigin(WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(500, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await identity.load('Paciente Glucore');
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<AuthCubit>.value(value: authCubit),
          BlocProvider<UserIdentityCubit>.value(value: identity),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const ChangePasswordPage(),
                    ),
                  ),
                  child: const Text('origin'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('origin'));
    await tester.pumpAndSettle();
  }

  Future<void> typePassword(
    WidgetTester tester,
    String label,
    String text,
  ) async {
    await tester.enterText(find.widgetWithText(PasswordField, label), text);
    await tester.pump();
  }

  Future<void> submit(WidgetTester tester) async {
    await tester.tap(find.widgetWithText(FilledButton, 'Atualizar senha'));
    await tester.pumpAndSettle();
  }

  testWidgets('the three password fields start empty and hidden',
      (tester) async {
    await pumpFromOrigin(tester);

    for (final label in [_currentLabel, _newLabel, _confirmLabel]) {
      final field = tester.widget<PasswordField>(
        find.widgetWithText(PasswordField, label),
      );
      expect(field.controller.text, isEmpty);
      expect(
        find.descendant(
          of: find.widgetWithText(PasswordField, label),
          matching: find.byIcon(Icons.visibility_outlined),
        ),
        findsOneWidget,
      );
    }
  });

  testWidgets('a weak new password blocks the submit', (tester) async {
    await pumpFromOrigin(tester);

    await typePassword(tester, _currentLabel, 'CurrentPass1!');
    await typePassword(tester, _newLabel, 'senha1234');
    await typePassword(tester, _confirmLabel, 'senha1234');
    await submit(tester);

    expect(
      find.text('A senha deve conter ao menos uma letra maiúscula'),
      findsOneWidget,
    );
    expect(account.changeCalls, isEmpty);
  });

  testWidgets('a diverging confirmation blocks the submit', (tester) async {
    await pumpFromOrigin(tester);

    await typePassword(tester, _currentLabel, 'CurrentPass1!');
    await typePassword(tester, _newLabel, 'NewPass123!');
    await typePassword(tester, _confirmLabel, 'NewPass123?');
    await submit(tester);

    expect(find.text('As senhas não coincidem.'), findsOneWidget);
    expect(account.changeCalls, isEmpty);
  });

  testWidgets(
      'an incorrect current password keeps the screen open with the error '
      'and the session active', (tester) async {
    account.failure = DioException(
      requestOptions: RequestOptions(path: '/auth/profile'),
      response: Response<void>(
        requestOptions: RequestOptions(path: '/auth/profile'),
        statusCode: 401,
      ),
      type: DioExceptionType.badResponse,
    );
    await pumpFromOrigin(tester);

    await typePassword(tester, _currentLabel, 'WrongPass1!');
    await typePassword(tester, _newLabel, 'NewPass123!');
    await typePassword(tester, _confirmLabel, 'NewPass123!');
    await submit(tester);

    expect(find.text('Senha atual incorreta.'), findsOneWidget);
    expect(find.byType(ChangePasswordPage), findsOneWidget);
    expect(authRepo.logoutCalls, 0);
  });

  testWidgets('success closes the screen and shows the message on the origin',
      (tester) async {
    await pumpFromOrigin(tester);

    await typePassword(tester, _currentLabel, 'CurrentPass1!');
    await typePassword(tester, _newLabel, 'NewPass123!');
    await typePassword(tester, _confirmLabel, 'NewPass123!');
    await submit(tester);

    expect(account.changeCalls, [('CurrentPass1!', 'NewPass123!')]);
    expect(find.byType(ChangePasswordPage), findsNothing);
    expect(find.text('origin'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(SnackBar),
        matching: find.text('Senha atualizada com sucesso.'),
      ),
      findsOneWidget,
    );
  });
}

class _FakeAccountService extends AccountService {
  _FakeAccountService() : super(Dio());

  final List<(String, String)> changeCalls = [];
  Object? failure;

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

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    if (failure != null) throw failure!;
    changeCalls.add((currentPassword, newPassword));
  }
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
