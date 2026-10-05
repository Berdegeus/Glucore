import '../../../../core/usecase/usecase.dart';
import '../entities/grant.dart';
import '../repositories/sharing_repository.dart';

class ListGrants implements UseCase<List<Grant>, NoParams> {
  const ListGrants(this.repository);

  final SharingRepository repository;

  @override
  Future<List<Grant>> call(NoParams params) => repository.listGrants();
}
