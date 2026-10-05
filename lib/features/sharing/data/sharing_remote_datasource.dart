import 'package:dio/dio.dart';

import '../domain/entities/grant.dart';
import '../domain/entities/invite_code.dart';
import 'sharing_failure_mapper.dart';

/// Chamadas REST do compartilhamento. O `Dio` vem do `ApiClient`: já leva o
/// prefixo `/api/v1` e o token do paciente.
///
/// Os erros de rede e HTTP saem como `SharingFailure` (ver
/// [sharingFailureFromDio]); corpo malformado sai como o erro de parsing.
class SharingRemoteDataSource {
  const SharingRemoteDataSource(this._dio);

  final Dio _dio;

  Future<InviteCode> generateInvite() async {
    final body = await _send(
      () => _dio.post<Map<String, dynamic>>('/sharing/invites'),
    );
    return InviteCode(
      code: body['code'] as String,
      expiresAt: DateTime.parse(body['expiresAt'] as String).toUtc(),
    );
  }

  Future<List<Grant>> listGrants() async {
    final body = await _send(
      () => _dio.get<Map<String, dynamic>>('/sharing/grants'),
    );
    return (body['grants'] as List<dynamic>).cast<Map<String, dynamic>>().map((
      row,
    ) {
      final professional = row['professional'] as Map<String, dynamic>;
      return Grant(
        id: row['id'] as String,
        professionalName: professional['fullName'] as String?,
        specialty: professional['specialty'] as String,
        grantedAt: DateTime.parse(row['grantedAt'] as String).toUtc(),
      );
    }).toList();
  }

  Future<void> revokeGrant(String id) async {
    await _send(() => _dio.delete<void>('/sharing/grants/$id'));
  }

  Future<T> _send<T>(Future<Response<T>> Function() request) async {
    try {
      return (await request()).data as T;
    } on DioException catch (error) {
      throw sharingFailureFromDio(error);
    }
  }
}
