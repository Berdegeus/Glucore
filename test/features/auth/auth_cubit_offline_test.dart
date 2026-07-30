import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/auth/domain/repositories/auth_repository.dart';
import 'package:glucore/features/auth/domain/usecases/get_auth_status_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/login_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/logout_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/register_usecase.dart';
import 'package:glucore/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:glucore/features/auth/presentation/cubit/auth_state.dart';

/// P18: an offline launch must NOT log the user out. `checkAuthStatus` maps the
/// ternary `AuthSessionStatus` so `unreachable` keeps the session (optimistic),
/// `invalid` logs out, and reconnecting revalidates a deferred session.
void main() {
  late _FakeAuthRepository repo;
  late StreamController<List<ConnectivityResult>> connectivity;
  late AuthCubit cubit;

  AuthCubit build() => AuthCubit(
        loginUseCase: LoginUseCase(repo),
        logoutUseCase: LogoutUseCase(repo),
        getAuthStatusUseCase: GetAuthStatusUseCase(repo),
        registerUseCase: RegisterUseCase(repo),
        connectivityChanges: connectivity.stream,
      );

  setUp(() {
    repo = _FakeAuthRepository();
    connectivity = StreamController<List<ConnectivityResult>>.broadcast();
  });

  tearDown(() async {
    await cubit.close();
    await connectivity.close();
  });

  test('unreachable keeps the session authenticated (optimistic)', () async {
    repo.statusResult = AuthSessionStatus.unreachable;
    cubit = build();

    await cubit.checkAuthStatus();

    expect(cubit.state.status, AuthStatus.authenticated);
    expect(cubit.state.offlineValidation, isTrue);
  });

  test('invalid logs the user out', () async {
    repo.statusResult = AuthSessionStatus.invalid;
    cubit = build();

    await cubit.checkAuthStatus();

    expect(cubit.state.status, AuthStatus.unauthenticated);
    expect(cubit.state.offlineValidation, isFalse);
  });

  test('authenticated confirms the session online', () async {
    repo.statusResult = AuthSessionStatus.authenticated;
    cubit = build();

    await cubit.checkAuthStatus();

    expect(cubit.state.status, AuthStatus.authenticated);
    expect(cubit.state.offlineValidation, isFalse);
  });

  test('reconnecting revalidates a deferred offline session', () async {
    repo.statusResult = AuthSessionStatus.unreachable;
    cubit = build();
    await cubit.checkAuthStatus();
    expect(cubit.state.offlineValidation, isTrue);

    // Backend now reachable and the token is accepted.
    repo.statusResult = AuthSessionStatus.authenticated;
    connectivity.add([ConnectivityResult.wifi]);
    await Future<void>.delayed(const Duration(milliseconds: 10));

    expect(cubit.state.status, AuthStatus.authenticated);
    expect(cubit.state.offlineValidation, isFalse);
  });
}

class _FakeAuthRepository implements AuthRepository {
  AuthSessionStatus statusResult = AuthSessionStatus.authenticated;

  @override
  Future<AuthSessionStatus> isLoggedIn() async => statusResult;

  @override
  Future<bool> login({required String email, required String password}) async =>
      true;

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
