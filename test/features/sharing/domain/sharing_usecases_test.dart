import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/usecase/usecase.dart';
import 'package:glucore/features/sharing/domain/entities/grant.dart';
import 'package:glucore/features/sharing/domain/entities/invite_code.dart';
import 'package:glucore/features/sharing/domain/repositories/sharing_repository.dart';
import 'package:glucore/features/sharing/domain/sharing_failure.dart';
import 'package:glucore/features/sharing/domain/usecases/generate_invite.dart';
import 'package:glucore/features/sharing/domain/usecases/list_grants.dart';
import 'package:glucore/features/sharing/domain/usecases/revoke_grant.dart';

/// Porta dublê: devolve o que foi configurado e guarda o que recebeu.
class _FakeSharingRepository implements SharingRepository {
  final invite = InviteCode(
    code: 'K7M2PQ9X',
    expiresAt: DateTime.utc(2026, 10, 6, 12),
  );
  final grants = [
    Grant(
      id: 'g1',
      professionalName: 'Dra. Ana',
      specialty: 'Endocrinologia',
      grantedAt: DateTime.utc(2026, 10, 1),
    ),
  ];
  SharingFailure? failure;
  final revoked = <String>[];

  @override
  Future<InviteCode> generateInvite() async {
    if (failure != null) throw failure!;
    return invite;
  }

  @override
  Future<List<Grant>> listGrants() async {
    if (failure != null) throw failure!;
    return grants;
  }

  @override
  Future<void> revokeGrant(String id) async {
    if (failure != null) throw failure!;
    revoked.add(id);
  }
}

void main() {
  late _FakeSharingRepository repository;

  setUp(() => repository = _FakeSharingRepository());

  group('CON-01: GenerateInvite', () {
    test('devolve o código que o port gerou', () async {
      final result = await GenerateInvite(repository)(const NoParams());
      expect(result, repository.invite);
    });

    test('propaga a falha do port sem trocar o tipo', () async {
      repository.failure = const SharingFailure(SharingFailureKind.offline);
      await expectLater(
        GenerateInvite(repository)(const NoParams()),
        throwsA(
          isA<SharingFailure>().having(
            (f) => f.kind,
            'kind',
            SharingFailureKind.offline,
          ),
        ),
      );
    });
  });

  group('CON-08: ListGrants', () {
    test('devolve os vínculos que o port listou', () async {
      final result = await ListGrants(repository)(const NoParams());
      expect(result, repository.grants);
    });

    test('propaga a falha do port', () async {
      repository.failure = const SharingFailure(SharingFailureKind.forbidden);
      await expectLater(
        ListGrants(repository)(const NoParams()),
        throwsA(
          isA<SharingFailure>().having(
            (f) => f.kind,
            'kind',
            SharingFailureKind.forbidden,
          ),
        ),
      );
    });
  });

  group('CON-08: RevokeGrant', () {
    test('revoga pelo id recebido', () async {
      await RevokeGrant(repository)('g1');
      expect(repository.revoked, ['g1']);
    });

    test('propaga a falha do port e não revoga', () async {
      repository.failure = const SharingFailure(SharingFailureKind.notFound);
      await expectLater(
        RevokeGrant(repository)('g1'),
        throwsA(
          isA<SharingFailure>().having(
            (f) => f.kind,
            'kind',
            SharingFailureKind.notFound,
          ),
        ),
      );
      expect(repository.revoked, isEmpty);
    });
  });

  test('o domínio é Dart puro: não importa Flutter, Dio nem a camada de dados', () {
    final imports = Directory('lib/features/sharing/domain')
        .listSync(recursive: true)
        .whereType<File>()
        .where((file) => file.path.endsWith('.dart'))
        .expand((file) => file.readAsLinesSync())
        .where((line) => line.startsWith('import '))
        .where(
          (line) =>
              line.contains('package:flutter') ||
              line.contains('package:dio') ||
              line.contains('/data/') ||
              line.contains('/presentation/'),
        )
        .toList();
    expect(imports, isEmpty);
  });
}
