import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

class LoginParams {
  const LoginParams({required this.email, required this.password});

  final String email;
  final String password;
}

class LoginUseCase implements UseCase<bool, LoginParams> {
  const LoginUseCase(this.repository);

  final AuthRepository repository;

  @override
  Future<bool> call(LoginParams params) {
    return repository.login(email: params.email, password: params.password);
  }
}
