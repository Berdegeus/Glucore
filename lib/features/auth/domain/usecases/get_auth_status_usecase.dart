import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

class GetAuthStatusUseCase implements UseCase<bool, NoParams> {
  const GetAuthStatusUseCase(this.repository);

  final AuthRepository repository;

  @override
  Future<bool> call(NoParams params) {
    return repository.isLoggedIn();
  }
}
