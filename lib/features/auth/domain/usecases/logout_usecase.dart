import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

class LogoutUseCase implements UseCase<void, NoParams> {
  const LogoutUseCase(this.repository);

  final AuthRepository repository;

  @override
  Future<void> call(NoParams params) {
    return repository.logout();
  }
}
