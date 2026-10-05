import '../../../../core/usecase/usecase.dart';
import '../repositories/sharing_repository.dart';

/// Revoga pelo `id` do vínculo.
class RevokeGrant implements UseCase<void, String> {
  const RevokeGrant(this.repository);

  final SharingRepository repository;

  @override
  Future<void> call(String params) => repository.revokeGrant(params);
}
