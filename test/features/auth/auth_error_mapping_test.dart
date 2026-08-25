import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/auth/domain/repositories/auth_repository.dart';
import 'package:glucore/features/auth/domain/usecases/get_auth_status_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/login_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/logout_usecase.dart';
import 'package:glucore/features/auth/domain/usecases/register_usecase.dart';
import 'package:glucore/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:glucore/features/auth/presentation/cubit/auth_state.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

/// Spec: TCC-09 — spec.md P2 (erros de banco) AC5 plus the app half of AC3 of
/// P1 (senha): the backend `code` decides the message, not the status.
DioException _responseError(int statusCode, Map<String, Object?> body) {
  final options = RequestOptions(path: '/auth/register');
  return DioException(
    requestOptions: options,
    type: DioExceptionType.badResponse,
    response: Response<Map<String, Object?>>(
      requestOptions: options,
      statusCode: statusCode,
      data: body,
    ),
  );
}

void main() {
  late _FakeAuthRepository repo;
  late AuthCubit cubit;
  late List<AuthState> states;

  /// Lets the cubit's broadcast stream deliver the queued states, then returns
  /// the error carried by the failure emission.
  Future<AuthError?> failureError() async {
    await Future<void>.delayed(Duration.zero);
    return states.firstWhere((s) => s.status == AuthStatus.failure).error;
  }

  setUp(() {
    repo = _FakeAuthRepository();
    cubit = AuthCubit(
      loginUseCase: LoginUseCase(repo),
      logoutUseCase: LogoutUseCase(repo),
      getAuthStatusUseCase: GetAuthStatusUseCase(repo),
      registerUseCase: RegisterUseCase(repo),
      connectivityChanges: const Stream.empty(),
    );
    states = [];
    cubit.stream.listen(states.add);
    addTearDown(cubit.close);
  });

  Future<void> register() => cubit.register(
        fullName: 'Ana Souza',
        email: 'ana@glucore.app',
        password: 'senha123',
      );

  test('400 WEAK_PASSWORD becomes AuthError.weakPassword', () async {
    repo.failure = _responseError(400, {
      'error': 'Weak password',
      'code': 'WEAK_PASSWORD',
    });

    await register();

    expect(await failureError(), AuthError.weakPassword);
  });

  test('503 DATABASE_UNAVAILABLE becomes AuthError.serviceUnavailable',
      () async {
    repo.failure = _responseError(503, {
      'error': 'Database unavailable',
      'code': 'DATABASE_UNAVAILABLE',
    });

    await cubit.login(email: 'ana@glucore.app', password: 'Senha123!');

    expect(await failureError(), AuthError.serviceUnavailable);
  });

  test('an unclassified server error stays generic', () async {
    repo.failure = _responseError(500, {'error': 'Internal server error'});

    await register();

    expect(await failureError(), AuthError.serverError);
  });

  test('a connection error is still a network error', () async {
    repo.failure = DioException.connectionError(
      requestOptions: RequestOptions(path: '/auth/register'),
      reason: 'backend unreachable',
    );

    await register();

    expect(await failureError(), AuthError.networkError);
  });

  group('messages', () {
    late AppLocalizations l10n;

    setUp(() async {
      l10n = await AppLocalizations.delegate.load(const Locale('pt'));
    });

    test('serviceUnavailable tells the user to try again later', () {
      expect(
        AuthError.serviceUnavailable.message(l10n),
        'Serviço temporariamente indisponível. Tente novamente em alguns minutos.',
      );
    });

    test('weakPassword states the strength rule', () {
      expect(
        AuthError.weakPassword.message(l10n),
        'Mínimo de 8 caracteres, com maiúscula, minúscula, número e '
        'caractere especial',
      );
    });
  });
}

class _FakeAuthRepository implements AuthRepository {
  Object? failure;

  @override
  Future<AuthSessionStatus> isLoggedIn() async => AuthSessionStatus.invalid;

  @override
  Future<bool> login({required String email, required String password}) async {
    if (failure != null) throw failure!;
    return true;
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
  }) async {
    if (failure != null) throw failure!;
    return true;
  }

  @override
  Future<void> logout() async {}
}
