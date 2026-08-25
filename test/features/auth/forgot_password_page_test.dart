import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/features/auth/data/datasources/account_service.dart';
import 'package:glucore/features/auth/presentation/pages/forgot_password_page.dart';
import 'package:glucore/features/auth/presentation/widgets/password_field.dart';
import 'package:glucore/l10n/l10n.dart';

/// Spec: TCC-01 / TCC-03 / TCC-06 / TCC-07 — spec.md P1 (senha) AC1, AC2, AC5,
/// AC6, AC7; P2 (mensagens) AC3/AC4; P2 (orientação) AC3, applied to the reset
/// by token flow.
const _tokenLabel = 'Código recebido por e-mail *';
const _newPasswordLabel = 'Nova senha *';
const _confirmLabel = 'Confirmar senha *';

void main() {
  late _FakeAccountService account;

  setUp(() {
    account = _FakeAccountService();
    GetIt.instance.registerSingleton<AccountService>(account);
  });

  tearDown(() => GetIt.instance.reset());

  Future<void> pumpPage(WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(500, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const ForgotPasswordPage(),
      ),
    );
    await tester.pumpAndSettle();
  }

  /// Walks the first step so the reset form (token + passwords) is on screen.
  Future<void> reachResetStep(WidgetTester tester) async {
    await tester.enterText(
      find.widgetWithText(TextFormField, 'E-mail cadastrado *'),
      'ana@glucore.app',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Enviar instruções'));
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

  Future<void> submitReset(WidgetTester tester) async {
    await tester.tap(find.widgetWithText(FilledButton, 'Redefinir senha'));
    await tester.pumpAndSettle();
  }

  void expectErrorMessenger(WidgetTester tester, String message) {
    expect(
      tester.widget<SnackBar>(find.byType(SnackBar)).backgroundColor,
      AppTheme.zoneLowBg,
    );
    expect(
      find.descendant(
        of: find.byType(SnackBar),
        matching: find.byIcon(Icons.error_outline),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(of: find.byType(SnackBar), matching: find.text(message)),
      findsOneWidget,
    );
  }

  testWidgets('the token field explains where the code comes from and for how '
      'long it is valid', (tester) async {
    await pumpPage(tester);
    await reachResetStep(tester);

    expect(
      find.text('O código chega por e-mail e expira em 6 horas'),
      findsOneWidget,
    );
  });

  testWidgets('a weak new password blocks the submit', (tester) async {
    await pumpPage(tester);
    await reachResetStep(tester);

    await tester.enterText(
      find.widgetWithText(TextFormField, _tokenLabel),
      'ABC123',
    );
    await typePassword(tester, _newPasswordLabel, 'Senha1234');
    await typePassword(tester, _confirmLabel, 'Senha1234');
    await submitReset(tester);

    expect(
      find.text('A senha deve conter ao menos um caractere especial'),
      findsOneWidget,
    );
    expect(account.resetCalls, isEmpty);
  });

  testWidgets('a diverging confirmation blocks the submit', (tester) async {
    await pumpPage(tester);
    await reachResetStep(tester);

    await tester.enterText(
      find.widgetWithText(TextFormField, _tokenLabel),
      'ABC123',
    );
    await typePassword(tester, _newPasswordLabel, 'Senha123!');
    await typePassword(tester, _confirmLabel, 'Senha123?');
    await submitReset(tester);

    expect(find.text('As senhas não coincidem.'), findsOneWidget);
    expect(account.resetCalls, isEmpty);
  });

  testWidgets('an expired token is reported through GlucoreMessenger.error',
      (tester) async {
    account.resetFailure = DioException(
      requestOptions: RequestOptions(path: '/auth/reset-password'),
      response: Response<void>(
        requestOptions: RequestOptions(path: '/auth/reset-password'),
        statusCode: 400,
      ),
      type: DioExceptionType.badResponse,
    );
    await pumpPage(tester);
    await reachResetStep(tester);

    await tester.enterText(
      find.widgetWithText(TextFormField, _tokenLabel),
      'ABC123',
    );
    await typePassword(tester, _newPasswordLabel, 'Senha123!');
    await typePassword(tester, _confirmLabel, 'Senha123!');
    await submitReset(tester);

    expectErrorMessenger(tester, 'Código inválido ou expirado.');
  });

  testWidgets('a network failure asking for the code is reported through '
      'GlucoreMessenger.error', (tester) async {
    account.forgotFailure = DioException(
      requestOptions: RequestOptions(path: '/auth/forgot-password'),
      type: DioExceptionType.connectionError,
    );
    await pumpPage(tester);
    await reachResetStep(tester);

    expectErrorMessenger(
      tester,
      'Sem conexão. Verifique sua rede e tente novamente.',
    );
  });

  testWidgets('the success view uses the theme success colour', (tester) async {
    await pumpPage(tester);
    await reachResetStep(tester);

    await tester.enterText(
      find.widgetWithText(TextFormField, _tokenLabel),
      'ABC123',
    );
    await typePassword(tester, _newPasswordLabel, 'Senha123!');
    await typePassword(tester, _confirmLabel, 'Senha123!');
    await submitReset(tester);

    expect(account.resetCalls, [('ABC123', 'Senha123!')]);
    expect(
      tester.widget<Icon>(find.byIcon(Icons.check_circle_outline)).color,
      AppTheme.zoneTargetBg,
    );
  });
}

class _FakeAccountService extends AccountService {
  _FakeAccountService() : super(Dio());

  final List<(String, String)> resetCalls = [];
  Object? forgotFailure;
  Object? resetFailure;

  @override
  Future<void> forgotPassword(String email) async {
    if (forgotFailure != null) throw forgotFailure!;
  }

  @override
  Future<void> resetPassword({
    required String token,
    required String password,
  }) async {
    if (resetFailure != null) throw resetFailure!;
    resetCalls.add((token, password));
  }
}
