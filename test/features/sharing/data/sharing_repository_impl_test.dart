import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/sharing/data/sharing_remote_datasource.dart';
import 'package:glucore/features/sharing/data/sharing_repository_impl.dart';
import 'package:glucore/features/sharing/domain/entities/grant.dart';
import 'package:glucore/features/sharing/domain/entities/invite_code.dart';
import 'package:glucore/features/sharing/domain/sharing_failure.dart';

/// Fonte dublê: devolve valores fixos ou lança o erro configurado.
class _FakeRemote implements SharingRemoteDataSource {
  _FakeRemote({this.error});

  final Object? error;
  final revoked = <String>[];

  final invite = InviteCode(
    code: 'K7M2PQ9X',
    expiresAt: DateTime.utc(2026, 10, 6, 12),
  );
  final grants = [
    Grant(
      id: 'g1',
      professionalName: null,
      specialty: 'Endocrinologia',
      grantedAt: DateTime.utc(2026, 10, 1),
    ),
  ];

  @override
  Future<InviteCode> generateInvite() async => error == null ? invite : throw error!;

  @override
  Future<List<Grant>> listGrants() async => error == null ? grants : throw error!;

  @override
  Future<void> revokeGrant(String id) async {
    if (error != null) throw error!;
    revoked.add(id);
  }
}

DioException _dioError(DioExceptionType type, {int? status}) {
  final options = RequestOptions(path: '/sharing/grants');
  return DioException(
    requestOptions: options,
    type: type,
    response: status == null
        ? null
        : Response<dynamic>(requestOptions: options, statusCode: status),
  );
}

void main() {
  group('sucesso: devolve o que a fonte devolveu', () {
    test('generateInvite, listGrants e revokeGrant delegam à fonte', () async {
      final remote = _FakeRemote();
      final repository = SharingRepositoryImpl(remote);

      expect(await repository.generateInvite(), remote.invite);
      expect(await repository.listGrants(), remote.grants);
      await repository.revokeGrant('g1');
      expect(remote.revoked, ['g1']);
    });
  });

  group('CON-13: cada exceção da fonte vira a falha certa', () {
    final cases = <String, (Object, SharingFailureKind)>{
      'falha do domínio passa como está': (
        const SharingFailure(SharingFailureKind.offline),
        SharingFailureKind.offline,
      ),
      'DioException sem resposta vira offline': (
        _dioError(DioExceptionType.connectionError),
        SharingFailureKind.offline,
      ),
      'DioException 403 vira forbidden': (
        _dioError(DioExceptionType.badResponse, status: 403),
        SharingFailureKind.forbidden,
      ),
      'DioException 404 vira notFound': (
        _dioError(DioExceptionType.badResponse, status: 404),
        SharingFailureKind.notFound,
      ),
      'DioException 500 vira unknown': (
        _dioError(DioExceptionType.badResponse, status: 500),
        SharingFailureKind.unknown,
      ),
      'corpo malformado (TypeError) vira unknown': (
        TypeError(),
        SharingFailureKind.unknown,
      ),
      'data inválida (FormatException) vira unknown': (
        const FormatException('data'),
        SharingFailureKind.unknown,
      ),
    };

    final operations = <String, Future<Object?> Function(SharingRepositoryImpl)>{
      'generateInvite': (repository) => repository.generateInvite(),
      'listGrants': (repository) => repository.listGrants(),
      'revokeGrant': (repository) => repository.revokeGrant('g1'),
    };

    for (final operation in operations.entries) {
      for (final entry in cases.entries) {
        test('${operation.key}: ${entry.key}', () async {
          final repository = SharingRepositoryImpl(
            _FakeRemote(error: entry.value.$1),
          );

          await expectLater(
            operation.value(repository),
            throwsA(
              isA<SharingFailure>().having(
                (failure) => failure.kind,
                'kind',
                entry.value.$2,
              ),
            ),
          );
        });
      }
    }
  });
}
