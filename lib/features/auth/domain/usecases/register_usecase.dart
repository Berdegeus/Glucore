import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

class RegisterParams {
  const RegisterParams({required this.email, required this.password});

  final String email;
  final String password;
}

class RegisterUseCase implements UseCase<bool, RegisterParams> {
  const RegisterUseCase(this.repository);

  final AuthRepository repository;

  @override
  Future<bool> call(RegisterParams params) {
    return repository.register(email: params.email, password: params.password);
  }
}
