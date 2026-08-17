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
import 'package:glucore/features/patient/presentation/cubit/user_identity_cubit.dart';
import 'package:glucore/features/patient/presentation/pages/change_password_page.dart';
import 'package:glucore/features/patient/presentation/pages/profile_edit_page.dart';
import 'package:glucore/l10n/l10n.dart';

/// Spec: TCC-05 / TCC-07 / TCC-08 / TCC-11 — spec.md P1 "Obrigatório vs.
/// opcional coerente com o modelo" AC1-AC6, P2 "Orientação de preenchimento"
/// AC2, P2 "Telefone com máscara" AC1-AC4, P2 "Tela dedicada de troca de
/// senha" AC4.
const _nameLabel = 'Nome *';
const _birthLabel = 'Data de nascimento (opcional)';
const _weightLabel = 'Peso (kg) (opcional)';
const _phoneLabel = 'Telefone (opcional)';
const _targetLabel = 'Faixa alvo de glicose (mg/dL) *';

void main() {
  late _FakeAccountService account;
  late _FakeAuthRepository authRepo;
  late AuthCubit authCubit;
  late UserIdentityCubit identity;

  AccountProfile baseProfile({
    DateTime? birthDate,
    double? weightKg,
    String? phone,
  }) =>
      AccountProfile(
        email: 'ana@glucore.app',
        fullName: 'Ana Silva',
        birthDate: birthDate,
        diabetesType: null,
        weightKg: weightKg,
        targetRangeMin: 80,
        targetRangeMax: 180,
        phone: phone,
        createdAt: DateTime(2026, 1, 15),
      );

  setUp(() {
    account = _FakeAccountService(profile: baseProfile());
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

  Future<void> pumpPage(WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(500, 1800));
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
          home: const ProfileEditPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> type(WidgetTester tester, String label, String text) async {
    await tester.enterText(find.widgetWithText(TextFormField, label), text);
    await tester.pump();
  }

  Future<void> save(WidgetTester tester) async {
    await tester.tap(find.widgetWithText(FilledButton, 'Salvar alterações'));
    await tester.pumpAndSettle();
  }

  testWidgets(
      'empty birth date, weight and phone are accepted and saved as null',
      (tester) async {
    await pumpPage(tester);

    await type(tester, _birthLabel, '');
    await type(tester, _weightLabel, '');
    await type(tester, _phoneLabel, '');
    await save(tester);

    expect(account.updateCalls, hasLength(1));
    expect(account.updateCalls.single.birthDate, isNull);
    expect(account.updateCalls.single.weightKg, isNull);
    expect(account.updateCalls.single.phone, isNull);
  });

  testWidgets('required fields are marked with * and optional ones with '
      '"(opcional)"', (tester) async {
    await pumpPage(tester);

    expect(find.text(_nameLabel), findsOneWidget);
    expect(find.text(_birthLabel), findsOneWidget);
    expect(find.text(_weightLabel), findsOneWidget);
    expect(find.text(_phoneLabel), findsOneWidget);
    expect(find.text(_targetLabel), findsOneWidget);
  });

  testWidgets(
      'the current e-mail and account creation date show read-only, in a '
      'card distinct from the editable fields', (tester) async {
    await pumpPage(tester);

    expect(find.text('E-mail atual'), findsOneWidget);
    expect(find.text('ana@glucore.app'), findsOneWidget);
    expect(find.text('Conta criada em'), findsOneWidget);
    expect(find.text('15/01/2026'), findsOneWidget);
    // The read-only pair sits in a section card, never inside a TextFormField.
    expect(
      find.ancestor(
        of: find.text('ana@glucore.app'),
        matching: find.byType(TextFormField),
      ),
      findsNothing,
    );
  });

  testWidgets('a phone loaded from the backend appears already formatted',
      (tester) async {
    account.profile = baseProfile(phone: '11987654321');

    await pumpPage(tester);

    expect(find.text('(11) 98765-4321'), findsOneWidget);
  });

  testWidgets('the phone is masked while typing', (tester) async {
    await pumpPage(tester);

    await type(tester, _phoneLabel, '11987654321');

    expect(find.text('(11) 98765-4321'), findsOneWidget);
  });

  testWidgets('a phone with fewer than 10 digits blocks the submit',
      (tester) async {
    await pumpPage(tester);

    await type(tester, _phoneLabel, '119876543');
    await save(tester);

    expect(find.text('Telefone incompleto'), findsOneWidget);
    expect(account.updateCalls, isEmpty);
  });

  testWidgets('an unparseable birth date blocks the submit', (tester) async {
    await pumpPage(tester);

    await type(tester, _birthLabel, '32/13/2020');
    await save(tester);

    expect(find.text('Data inválida'), findsOneWidget);
    expect(account.updateCalls, isEmpty);
  });

  testWidgets('a non-positive weight blocks the submit', (tester) async {
    await pumpPage(tester);

    await type(tester, _weightLabel, '0');
    await save(tester);

    expect(find.text('Informe um valor numérico'), findsOneWidget);
    expect(account.updateCalls, isEmpty);
  });

  testWidgets('a successful save is reported through GlucoreMessenger',
      (tester) async {
    await pumpPage(tester);

    await save(tester);

    expect(
      tester.widget<SnackBar>(find.byType(SnackBar)).backgroundColor,
      AppTheme.zoneTargetBg,
    );
    expect(
      find.descendant(
        of: find.byType(SnackBar),
        matching: find.text('Perfil atualizado com sucesso.'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('a failed save is reported through GlucoreMessenger.error',
      (tester) async {
    account.updateFailure = DioException(
      requestOptions: RequestOptions(path: '/auth/profile'),
      type: DioExceptionType.connectionError,
    );

    await pumpPage(tester);
    await save(tester);

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
  });

  testWidgets('the "Alterar senha" link opens the dedicated screen',
      (tester) async {
    await pumpPage(tester);

    await tester.tap(find.widgetWithText(OutlinedButton, 'Alterar senha'));
    await tester.pumpAndSettle();

    expect(find.byType(ChangePasswordPage), findsOneWidget);
  });

  testWidgets(
      'the email-change current password field starts obscured and its icon '
      'reveals only that field', (tester) async {
    await pumpPage(tester);

    Finder editableText() => find.descendant(
          of: find.widgetWithText(TextFormField, 'Senha atual'),
          matching: find.byType(EditableText),
        );

    expect(
      tester.widget<EditableText>(editableText()).obscureText,
      isTrue,
      reason: 'starts hidden like every PasswordField',
    );

    await tester.tap(find.byIcon(Icons.visibility_outlined));
    await tester.pump();

    expect(tester.widget<EditableText>(editableText()).obscureText, isFalse);
  });
}

class _UpdateCall {
  _UpdateCall({
    required this.fullName,
    required this.birthDate,
    required this.weightKg,
    required this.targetRangeMin,
    required this.targetRangeMax,
    required this.phone,
  });

  final String fullName;
  final DateTime? birthDate;
  final double? weightKg;
  final int? targetRangeMin;
  final int? targetRangeMax;
  final String? phone;
}

class _FakeAccountService extends AccountService {
  _FakeAccountService({required this.profile}) : super(Dio());

  AccountProfile profile;
  Object? updateFailure;
  final List<_UpdateCall> updateCalls = [];

  @override
  Future<AccountProfile> fetchProfile() async => profile;

  @override
  Future<void> updateProfile({
    required String fullName,
    DateTime? birthDate,
    double? weightKg,
    int? targetRangeMin,
    int? targetRangeMax,
    String? diabetesType,
    String? phone,
  }) async {
    if (updateFailure != null) throw updateFailure!;
    updateCalls.add(
      _UpdateCall(
        fullName: fullName,
        birthDate: birthDate,
        weightKg: weightKg,
        targetRangeMin: targetRangeMin,
        targetRangeMax: targetRangeMax,
        phone: phone,
      ),
    );
  }
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
