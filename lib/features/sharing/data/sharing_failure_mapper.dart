import 'package:dio/dio.dart';

import '../domain/sharing_failure.dart';

/// Traduz um erro do Dio na falha do domínio (CON-13).
///
/// Sem resposta HTTP (rede fora, backend inalcançável, tempo esgotado) é
/// `offline`; com resposta, o status decide: `403` é `forbidden`, `404` é
/// `notFound` e o resto é `unknown`.
SharingFailure sharingFailureFromDio(DioException error) {
  switch (error.type) {
    case DioExceptionType.connectionError:
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      return const SharingFailure(SharingFailureKind.offline);
    default:
      break;
  }
  return switch (error.response?.statusCode) {
    403 => const SharingFailure(SharingFailureKind.forbidden),
    404 => const SharingFailure(SharingFailureKind.notFound),
    _ => const SharingFailure(SharingFailureKind.unknown),
  };
}
