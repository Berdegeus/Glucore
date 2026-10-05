import 'package:dio/dio.dart';

import '../domain/entities/grant.dart';
import '../domain/entities/invite_code.dart';
import '../domain/repositories/sharing_repository.dart';
import '../domain/sharing_failure.dart';
import 'sharing_failure_mapper.dart';
import 'sharing_remote_datasource.dart';

/// Implementação da porta sobre a fonte remota. Tudo que a fonte lança sai
/// daqui como [SharingFailure]: nenhum erro de Dio ou de parsing chega ao
/// domínio nem à tela.
class SharingRepositoryImpl implements SharingRepository {
  const SharingRepositoryImpl(this._remote);

  final SharingRemoteDataSource _remote;

  @override
  Future<InviteCode> generateInvite() => _guard(_remote.generateInvite);

  @override
  Future<List<Grant>> listGrants() => _guard(_remote.listGrants);

  @override
  Future<void> revokeGrant(String id) => _guard(() => _remote.revokeGrant(id));

  Future<T> _guard<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on SharingFailure {
      rethrow;
    } on DioException catch (error, stack) {
      Error.throwWithStackTrace(sharingFailureFromDio(error), stack);
    } catch (_, stack) {
      // Corpo fora do contrato (campo ausente, tipo errado, JSON inválido).
      Error.throwWithStackTrace(
        const SharingFailure(SharingFailureKind.unknown),
        stack,
      );
    }
  }
}
