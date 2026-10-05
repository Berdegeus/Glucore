import '../entities/grant.dart';
import '../entities/invite_code.dart';

/// Porta do compartilhamento com profissionais. Toda operação exige rede e
/// lança `SharingFailure` quando não consegue concluir.
abstract class SharingRepository {
  /// Gera um código de uso único, válido por 24 horas (CON-01).
  Future<InviteCode> generateInvite();

  /// Lista os profissionais vinculados ao paciente (CON-08).
  Future<List<Grant>> listGrants();

  /// Revoga o vínculo [id] (CON-08).
  Future<void> revokeGrant(String id);
}
