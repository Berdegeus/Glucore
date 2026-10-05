import '../../../../core/usecase/usecase.dart';
import '../entities/invite_code.dart';
import '../repositories/sharing_repository.dart';

class GenerateInvite implements UseCase<InviteCode, NoParams> {
  const GenerateInvite(this.repository);

  final SharingRepository repository;

  @override
  Future<InviteCode> call(NoParams params) => repository.generateInvite();
}
