import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

class GetAuthStatusUseCase implements UseCase<AuthSessionStatus, NoParams> {
  const GetAuthStatusUseCase(this.repository);

  final AuthRepository repository;

  @override
  Future<AuthSessionStatus> call(NoParams params) {
    return repository.isLoggedIn();
  }
}
