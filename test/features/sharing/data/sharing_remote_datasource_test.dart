import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/sharing/data/sharing_remote_datasource.dart';
import 'package:glucore/features/sharing/domain/entities/grant.dart';
import 'package:glucore/features/sharing/domain/entities/invite_code.dart';
import 'package:glucore/features/sharing/domain/sharing_failure.dart';

/// Adaptador Dio dublê: responde com o status e o corpo configurados, ou
/// lança o [DioException] configurado (rede fora), e guarda a requisição.
class _StubAdapter implements HttpClientAdapter {
  _StubAdapter({this.status = 200, this.body, this.error});

  final int status;
  final Object? body;
  final DioExceptionType? error;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (error != null) {
      throw DioException(requestOptions: options, type: error!);
    }
    return ResponseBody.fromString(
      body == null ? '' : jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late _StubAdapter adapter;

  SharingRemoteDataSource sourceWith(_StubAdapter stub) {
    adapter = stub;
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/v1'))
      ..httpClientAdapter = stub;
    return SharingRemoteDataSource(dio);
  }

  Future<void> expectFailure(
    Future<Object?> Function(SharingRemoteDataSource source) call,
    _StubAdapter stub,
    SharingFailureKind kind,
  ) async {
    await expectLater(
      call(sourceWith(stub)),
      throwsA(
        isA<SharingFailure>().having((f) => f.kind, 'kind', kind),
      ),
    );
  }

  group('CON-01: gerar o código', () {
    test('201 vira InviteCode com a validade em UTC', () async {
      final source = sourceWith(
        _StubAdapter(
          status: 201,
          body: {'code': 'K7M2PQ9X', 'expiresAt': '2026-10-06T12:00:00.000Z'},
        ),
      );

      final invite = await source.generateInvite();

      expect(adapter.requests.single.method, 'POST');
      expect(adapter.requests.single.path, '/sharing/invites');
      expect(
        invite,
        InviteCode(
          code: 'K7M2PQ9X',
          expiresAt: DateTime.utc(2026, 10, 6, 12),
        ),
      );
      expect(invite.expiresAt.isUtc, isTrue);
    });

    test('data com deslocamento é normalizada para UTC', () async {
      final source = sourceWith(
        _StubAdapter(
          status: 201,
          body: {'code': 'K7M2PQ9X', 'expiresAt': '2026-10-06T09:00:00-03:00'},
        ),
      );

      final invite = await source.generateInvite();

      expect(invite.expiresAt, DateTime.utc(2026, 10, 6, 12));
      expect(invite.expiresAt.isUtc, isTrue);
    });
  });

  group('CON-13: erros viram falhas do domínio', () {
    const connectionErrors = {
      DioExceptionType.connectionError,
      DioExceptionType.connectionTimeout,
      DioExceptionType.receiveTimeout,
    };
    for (final type in connectionErrors) {
      test('${type.name} ao gerar vira offline', () async {
        await expectFailure(
          (source) => source.generateInvite(),
          _StubAdapter(error: type),
          SharingFailureKind.offline,
        );
      });
    }

    test('403 ao gerar vira forbidden', () async {
      await expectFailure(
        (source) => source.generateInvite(),
        _StubAdapter(status: 403, body: {'error': 'x', 'code': 'FORBIDDEN'}),
        SharingFailureKind.forbidden,
      );
    });

    test('404 ao revogar vira notFound', () async {
      await expectFailure(
        (source) => source.revokeGrant('g1'),
        _StubAdapter(status: 404, body: {'error': 'x', 'code': 'NOT_FOUND'}),
        SharingFailureKind.notFound,
      );
    });

    test('500 vira unknown', () async {
      await expectFailure(
        (source) => source.listGrants(),
        _StubAdapter(status: 500, body: {'error': 'x', 'code': 'INTERNAL'}),
        SharingFailureKind.unknown,
      );
    });

    test('sem rede ao listar vira offline', () async {
      await expectFailure(
        (source) => source.listGrants(),
        _StubAdapter(error: DioExceptionType.connectionError),
        SharingFailureKind.offline,
      );
    });
  });

  group('CON-08: listar e revogar vínculos', () {
    test('200 vira a lista de Grant, com nome nulo preservado', () async {
      final source = sourceWith(
        _StubAdapter(
          body: {
            'grants': [
              {
                'id': 'g1',
                'professional': {
                  'fullName': 'Dra. Ana Souza',
                  'specialty': 'Endocrinologia',
                },
                'grantedAt': '2026-10-01T15:30:00.000Z',
              },
              {
                'id': 'g2',
                'professional': {'fullName': null, 'specialty': 'Clínica geral'},
                'grantedAt': '2026-10-02T08:00:00.000Z',
              },
            ],
          },
        ),
      );

      final grants = await source.listGrants();

      expect(adapter.requests.single.method, 'GET');
      expect(adapter.requests.single.path, '/sharing/grants');
      expect(grants, [
        Grant(
          id: 'g1',
          professionalName: 'Dra. Ana Souza',
          specialty: 'Endocrinologia',
          grantedAt: DateTime.utc(2026, 10, 1, 15, 30),
        ),
        Grant(
          id: 'g2',
          professionalName: null,
          specialty: 'Clínica geral',
          grantedAt: DateTime.utc(2026, 10, 2, 8),
        ),
      ]);
      expect(grants.every((g) => g.grantedAt.isUtc), isTrue);
    });

    test('lista vazia vira lista vazia', () async {
      final source = sourceWith(_StubAdapter(body: {'grants': <Object>[]}));
      expect(await source.listGrants(), isEmpty);
    });

    test('204 ao revogar chama DELETE no vínculo certo', () async {
      final source = sourceWith(_StubAdapter(status: 204));

      await source.revokeGrant('g1');

      expect(adapter.requests.single.method, 'DELETE');
      expect(adapter.requests.single.path, '/sharing/grants/g1');
    });
  });
}
