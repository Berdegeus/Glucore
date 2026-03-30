import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/auth/domain/repositories/auth_repository.dart';
import 'package:glucore/features/auth/domain/usecases/login_usecase.dart';

class FakeAuthRepository implements AuthRepository {
  @override
  Future<bool> login({required String email, required String password}) async {
    return email == 'test@test.com' && password == '1234';
  }

  @override
  Future<void> logout() async {}

  @override
  Future<bool> isLoggedIn() async => false;
}

void main() {
  group('LoginUseCase', () {
    test('retorna true para credenciais válidas', () async {
      final useCase = LoginUseCase(FakeAuthRepository());

      final result = await useCase(
        const LoginParams(email: 'test@test.com', password: '1234'),
      );

      expect(result, isTrue);
    });
  });
}
