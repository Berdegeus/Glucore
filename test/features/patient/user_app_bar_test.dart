import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/auth/data/datasources/account_service.dart';
import 'package:glucore/features/auth/domain/repositories/auth_repository.dart';
import 'package:glucore/features/auth/domain/usecases/get_auth_status_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/login_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/logout_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/register_usecase.dart';
import 'package:glucore/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:glucore/features/patient/presentation/cubit/user_identity_cubit.dart';
import 'package:glucore/features/patient/presentation/widgets/user_app_bar.dart';
import 'package:glucore/l10n/l10n.dart';

/// Spec: TCC-04 — spec.md P1 "Identidade do usuário e saída visíveis em todas
/// as telas" AC1, AC2, AC3, AC5.
void main() {
  late _FakeAuthRepository repo;
  late AuthCubit authCubit;

  setUp(() {
    repo = _FakeAuthRepository();
    authCubit = AuthCubit(
      loginUseCase: LoginUseCase(repo),
      logoutUseCase: LogoutUseCase(repo),
      getAuthStatusUseCase: GetAuthStatusUseCase(repo),
      registerUseCase: RegisterUseCase(repo),
      connectivityChanges: const Stream.empty(),
    );
  });

  tearDown(() => authCubit.close());

  Future<void> pumpAppBar(
    WidgetTester tester, {
    required UserIdentityCubit identity,
    List<Widget>? actions,
  }) async {
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<UserIdentityCubit>.value(value: identity),
          BlocProvider<AuthCubit>.value(value: authCubit),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            appBar: UserAppBar(actions: actions),
            body: const SizedBox(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> openMenu(WidgetTester tester) async {
    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
  }

  testWidgets('shows the loaded user name', (tester) async {
    final identity = UserIdentityCubit(
      accountService: _FakeAccountService(profile: _profile('Ana Silva')),
    );
    addTearDown(identity.close);
    await identity.load('Paciente Glucore');

    await pumpAppBar(tester, identity: identity);

    expect(find.text('Ana Silva'), findsOneWidget);
  });

  testWidgets('shows the default name while the profile has not loaded',
      (tester) async {
    final identity = UserIdentityCubit(
      accountService: _FakeAccountService(profile: _profile('Ana Silva')),
    );
    addTearDown(identity.close);
    // load() is deliberately never called: state.fullName stays null.

    await pumpAppBar(tester, identity: identity);

    expect(find.text('Paciente Glucore'), findsOneWidget);
  });

  testWidgets('the menu offers "Sair da conta"', (tester) async {
    final identity = UserIdentityCubit(
      accountService: _FakeAccountService(profile: _profile('Ana Silva')),
    );
    addTearDown(identity.close);
    await identity.load('Paciente Glucore');

    await pumpAppBar(tester, identity: identity);
    await openMenu(tester);

    expect(find.text('Sair da conta'), findsWidgets);
  });

  testWidgets('confirming the logout dialog calls AuthCubit.logout()',
      (tester) async {
    final identity = UserIdentityCubit(
      accountService: _FakeAccountService(profile: _profile('Ana Silva')),
    );
    addTearDown(identity.close);
    await identity.load('Paciente Glucore');

    await pumpAppBar(tester, identity: identity);
    await openMenu(tester);
    await tester.tap(find.text('Sair da conta').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sair da conta').last);
    await tester.pumpAndSettle();

    expect(repo.logoutCalls, 1);
  });

  testWidgets('cancelling the logout dialog does not call AuthCubit.logout()',
      (tester) async {
    final identity = UserIdentityCubit(
      accountService: _FakeAccountService(profile: _profile('Ana Silva')),
    );
    addTearDown(identity.close);
    await identity.load('Paciente Glucore');

    await pumpAppBar(tester, identity: identity);
    await openMenu(tester);
    await tester.tap(find.text('Sair da conta').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(repo.logoutCalls, 0);
  });

  testWidgets('extra actions passed in are still rendered and functional',
      (tester) async {
    final identity = UserIdentityCubit(
      accountService: _FakeAccountService(profile: _profile('Ana Silva')),
    );
    addTearDown(identity.close);
    await identity.load('Paciente Glucore');
    var tapped = false;

    await pumpAppBar(
      tester,
      identity: identity,
      actions: [
        IconButton(
          icon: const Icon(Icons.notifications_none_rounded),
          onPressed: () => tapped = true,
        ),
      ],
    );

    expect(find.byIcon(Icons.notifications_none_rounded), findsOneWidget);
    await tester.tap(find.byIcon(Icons.notifications_none_rounded));
    expect(tapped, isTrue);
  });
}

AccountProfile _profile(String fullName) => AccountProfile(
      email: 'ana@glucore.app',
      fullName: fullName,
      birthDate: null,
      diabetesType: null,
      weightKg: null,
      targetRangeMin: 80,
      targetRangeMax: 180,
    );

class _FakeAccountService extends AccountService {
  _FakeAccountService({this.profile}) : super(Dio());

  final AccountProfile? profile;

  @override
  Future<AccountProfile> fetchProfile() async => profile!;
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
