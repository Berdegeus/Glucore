import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/auth/data/datasources/account_service.dart';
import 'package:glucore/features/patient/presentation/cubit/user_identity_cubit.dart';

/// Spec: TCC-04 / TCC-11 — spec.md P1 "Identidade do usuário e saída visíveis
/// em todas as telas" AC5, AC6, and the edge case "IF o nome do usuário não
/// pode ser carregado por falha de rede THEN o cabeçalho SHALL exibir
/// 'Paciente Glucore'".
void main() {
  group('UserIdentityCubit', () {
    test('starts with no name until load resolves', () {
      final cubit = UserIdentityCubit(
        accountService: _FakeAccountService(profile: _profile('Ana Silva')),
      );
      addTearDown(cubit.close);

      expect(cubit.state.fullName, isNull);
    });

    test('load exposes the fetched full name', () async {
      final service = _FakeAccountService(profile: _profile('Ana Silva'));
      final cubit = UserIdentityCubit(accountService: service);
      addTearDown(cubit.close);

      await cubit.load('Paciente Glucore');

      expect(cubit.state.fullName, 'Ana Silva');
    });

    test('a failed fetch falls back to the given default name', () async {
      final service = _FakeAccountService(
        error: DioException(
          requestOptions: RequestOptions(path: '/auth/profile'),
          type: DioExceptionType.connectionError,
        ),
      );
      final cubit = UserIdentityCubit(accountService: service);
      addTearDown(cubit.close);

      await cubit.load('Paciente Glucore');

      expect(cubit.state.fullName, 'Paciente Glucore');
    });

    test('load fetches the profile only once per session', () async {
      final service = _FakeAccountService(profile: _profile('Ana Silva'));
      final cubit = UserIdentityCubit(accountService: service);
      addTearDown(cubit.close);

      await cubit.load('Paciente Glucore');
      await cubit.load('Paciente Glucore');

      expect(service.fetchCalls, 1);
    });

    test('overlapping calls made before the first resolves still fetch once',
        () async {
      final service = _FakeAccountService(profile: _profile('Ana Silva'));
      final cubit = UserIdentityCubit(accountService: service);
      addTearDown(cubit.close);

      final first = cubit.load('Paciente Glucore');
      final second = cubit.load('Paciente Glucore');
      await Future.wait([first, second]);

      expect(service.fetchCalls, 1);
    });
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
  _FakeAccountService({this.profile, this.error}) : super(Dio());

  final AccountProfile? profile;
  final Object? error;
  int fetchCalls = 0;

  @override
  Future<AccountProfile> fetchProfile() async {
    fetchCalls++;
    if (error != null) throw error!;
    return profile!;
  }
}
