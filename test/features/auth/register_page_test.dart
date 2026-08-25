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
import 'package:glucore/features/auth/presentation/pages/register_page.dart';
import 'package:glucore/features/auth/presentation/widgets/password_field.dart';
import 'package:glucore/l10n/l10n.dart';

/// Spec: TCC-01 / TCC-03 / TCC-05 / TCC-07 / TCC-08 — spec.md P1 (senha) AC1,
/// AC2, AC6, AC7; P1 (obrigatório vs. opcional) AC1-AC5; P2 (orientação) AC1,
/// AC2, AC4; P2 (telefone) AC1-AC4; plus the "confirmação antes da senha" and
/// "faixa alvo com espaços" edge cases.
const _nameLabel = 'Nome completo *';
const _emailLabel = 'E-mail *';
const _phoneLabel = 'Telefone (opcional)';
const _birthLabel = 'Data de nascimento (opcional)';
const _weightLabel = 'Peso (kg) (opcional)';
const _targetLabel = 'Faixa alvo de glicose (mg/dL) *';
const _passwordLabel = 'Senha *';
const _confirmLabel = 'Confirmar senha *';

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

  Future<void> pumpRegister(WidgetTester tester) async {
    // Tall surface so every field of the form is laid out and reachable.
    await tester.binding.setSurfaceSize(const Size(500, 1800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: BlocProvider<AuthCubit>.value(
          value: cubit,
          child: const RegisterPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> type(WidgetTester tester, String label, String text) async {
    await tester.enterText(find.widgetWithText(TextFormField, label), text);
    await tester.pump();
  }

  Future<void> typePassword(
    WidgetTester tester,
    String label,
    String text,
  ) async {
    await tester.enterText(find.widgetWithText(PasswordField, label), text);
    await tester.pump();
  }

  /// Fills only the required fields with valid values.
  Future<void> fillRequired(
    WidgetTester tester, {
    String password = 'Senha123!',
    String? confirm,
  }) async {
    await type(tester, _nameLabel, 'Ana Souza');
    await type(tester, _emailLabel, 'ana@glucore.app');
    await typePassword(tester, _passwordLabel, password);
    await typePassword(tester, _confirmLabel, confirm ?? password);
  }

  Future<void> submit(WidgetTester tester) async {
    await tester.tap(find.widgetWithText(FilledButton, 'Criar conta'));
    await tester.pumpAndSettle();
  }

  testWidgets('a weak password blocks the submit with the violated rule',
      (tester) async {
    await pumpRegister(tester);

    await fillRequired(tester, password: 'senha123!');
    await submit(tester);

    expect(
      find.text('A senha deve conter ao menos uma letra maiúscula'),
      findsOneWidget,
    );
    expect(repo.calls, isEmpty);
  });

  testWidgets('the password field spells out the strength rule as helper text',
      (tester) async {
    await pumpRegister(tester);

    expect(
      find.descendant(
        of: find.widgetWithText(PasswordField, _passwordLabel),
        matching: find.text(
          'Mínimo de 8 caracteres, com maiúscula, minúscula, '
          'número e caractere especial',
        ),
      ),
      findsOneWidget,
    );
  });

  testWidgets('a diverging confirmation blocks the submit',
      (tester) async {
    await pumpRegister(tester);

    await fillRequired(tester, password: 'Senha123!', confirm: 'Senha123?');
    await submit(tester);

    expect(find.text('As senhas não coincidem.'), findsOneWidget);
    expect(repo.calls, isEmpty);
  });

  testWidgets('the confirmation typed first is only compared on submit',
      (tester) async {
    await pumpRegister(tester);

    await type(tester, _nameLabel, 'Ana Souza');
    await type(tester, _emailLabel, 'ana@glucore.app');
    // Confirmation before the password field: no error while typing.
    await typePassword(tester, _confirmLabel, 'Senha123!');
    expect(find.text('As senhas não coincidem.'), findsNothing);

    await typePassword(tester, _passwordLabel, 'Senha123!');
    await submit(tester);

    expect(find.text('As senhas não coincidem.'), findsNothing);
    expect(repo.calls, hasLength(1));
  });

  testWidgets('empty birth date, weight and phone are accepted',
      (tester) async {
    await pumpRegister(tester);

    await fillRequired(tester);
    await submit(tester);

    expect(repo.calls, hasLength(1));
    expect(repo.calls.single.phone, isNull);
    expect(repo.calls.single.birthDate, isNull);
    expect(repo.calls.single.weightKg, isNull);
  });

  testWidgets('labels mark required fields with * and optional ones',
      (tester) async {
    await pumpRegister(tester);

    expect(find.text(_nameLabel), findsOneWidget);
    expect(find.text(_emailLabel), findsOneWidget);
    expect(find.text(_targetLabel), findsOneWidget);
    expect(find.text(_passwordLabel), findsOneWidget);
    expect(find.text(_confirmLabel), findsOneWidget);
    expect(find.text(_phoneLabel), findsOneWidget);
    expect(find.text(_birthLabel), findsOneWidget);
    expect(find.text(_weightLabel), findsOneWidget);
  });

  testWidgets('the target range shows the format hint and rejects 180-80',
      (tester) async {
    await pumpRegister(tester);

    expect(
      find.text('Formato mín-máx em mg/dL, por exemplo 80-180'),
      findsOneWidget,
    );

    await fillRequired(tester);
    await type(tester, _targetLabel, '180-80');
    await submit(tester);

    expect(
      find.text('Use o formato 80-180, com o valor mínimo menor que o máximo'),
      findsOneWidget,
    );
    expect(repo.calls, isEmpty);
  });

  testWidgets('a target range with spaces is accepted and normalized',
      (tester) async {
    await pumpRegister(tester);

    await fillRequired(tester);
    await type(tester, _targetLabel, '80 - 180');
    await submit(tester);

    expect(repo.calls.single.targetRangeMin, 80);
    expect(repo.calls.single.targetRangeMax, 180);
  });

  testWidgets('the phone is masked while typing and sent as digits only',
      (tester) async {
    await pumpRegister(tester);

    await fillRequired(tester);
    await type(tester, _phoneLabel, '11987654321');

    expect(find.text('(11) 98765-4321'), findsOneWidget);

    await submit(tester);

    expect(repo.calls.single.phone, '11987654321');
  });

  testWidgets('a phone with fewer than 10 digits blocks the submit',
      (tester) async {
    await pumpRegister(tester);

    await fillRequired(tester);
    await type(tester, _phoneLabel, '119876543');
    await submit(tester);

    expect(find.text('Telefone incompleto'), findsOneWidget);
    expect(repo.calls, isEmpty);
  });

  testWidgets('an unparseable birth date blocks the submit',
      (tester) async {
    await pumpRegister(tester);

    await fillRequired(tester);
    await type(tester, _birthLabel, '32/13/2020');
    await submit(tester);

    expect(find.text('Data inválida'), findsOneWidget);
    expect(repo.calls, isEmpty);
  });

  testWidgets('a non-positive weight blocks the submit', (tester) async {
    await pumpRegister(tester);

    await fillRequired(tester);
    await type(tester, _weightLabel, '0');
    await submit(tester);

    expect(find.text('Informe um valor numérico'), findsOneWidget);
    expect(repo.calls, isEmpty);
  });
}

class _RegisterCall {
  _RegisterCall({
    required this.fullName,
    required this.email,
    required this.password,
    required this.phone,
    required this.birthDate,
    required this.weightKg,
    required this.targetRangeMin,
    required this.targetRangeMax,
  });

  final String fullName;
  final String email;
  final String password;
  final String? phone;
  final DateTime? birthDate;
  final double? weightKg;
  final int? targetRangeMin;
  final int? targetRangeMax;
}

class _FakeAuthRepository implements AuthRepository {
  final List<_RegisterCall> calls = [];

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
  }) async {
    calls.add(
      _RegisterCall(
        fullName: fullName,
        email: email,
        password: password,
        phone: phone,
        birthDate: birthDate,
        weightKg: weightKg,
        targetRangeMin: targetRangeMin,
        targetRangeMax: targetRangeMax,
      ),
    );
    return true;
  }

  @override
  Future<void> logout() async {}
}
