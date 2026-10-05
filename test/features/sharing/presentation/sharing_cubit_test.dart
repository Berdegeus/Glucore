import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/sharing/domain/entities/grant.dart';
import 'package:glucore/features/sharing/domain/entities/invite_code.dart';
import 'package:glucore/features/sharing/domain/repositories/sharing_repository.dart';
import 'package:glucore/features/sharing/domain/sharing_failure.dart';
import 'package:glucore/features/sharing/domain/usecases/generate_invite.dart';
import 'package:glucore/features/sharing/domain/usecases/list_grants.dart';
import 'package:glucore/features/sharing/domain/usecases/revoke_grant.dart';
import 'package:glucore/features/sharing/presentation/cubit/sharing_cubit.dart';
import 'package:glucore/features/sharing/presentation/cubit/sharing_state.dart';

/// Porta dublê: `failure`, se definido, faz toda operação lançar.
class _FakeSharingRepository implements SharingRepository {
  _FakeSharingRepository({required this.grants});

  List<Grant> grants;
  SharingFailure? failure;
  final revoked = <String>[];

  static final invite = InviteCode(
    code: 'K7M2PQ9X',
    expiresAt: DateTime.utc(2026, 10, 6, 12),
  );

  @override
  Future<InviteCode> generateInvite() async =>
      failure == null ? invite : throw failure!;

  @override
  Future<List<Grant>> listGrants() async =>
      failure == null ? grants : throw failure!;

  @override
  Future<void> revokeGrant(String id) async {
    if (failure != null) throw failure!;
    revoked.add(id);
  }
}

Grant _grant(String id) => Grant(
      id: id,
      professionalName: 'Profissional $id',
      specialty: 'Endocrinologia',
      grantedAt: DateTime.utc(2026, 10, 1),
    );

void main() {
  late _FakeSharingRepository repository;
  late SharingCubit cubit;

  setUp(() {
    repository = _FakeSharingRepository(grants: [_grant('g1'), _grant('g2')]);
    cubit = SharingCubit(
      generateInvite: GenerateInvite(repository),
      listGrants: ListGrants(repository),
      revokeGrant: RevokeGrant(repository),
    );
    addTearDown(cubit.close);
  });

  test('começa ocioso, sem código e sem vínculos', () {
    expect(cubit.state, const SharingState());
    expect(cubit.state.status, SharingStatus.idle);
  });

  group('CON-01: gerar o código', () {
    test('passa por loading e termina em inviteReady com o código', () async {
      final states = <SharingState>[];
      final sub = cubit.stream.listen(states.add);

      await cubit.generateInvite();
      await pumpEventQueue();
      await sub.cancel();

      expect(states, [
        const SharingState(status: SharingStatus.loading),
        SharingState(
          status: SharingStatus.inviteReady,
          invite: _FakeSharingRepository.invite,
        ),
      ]);
    });

    test('um novo pedido limpa o código anterior enquanto carrega', () async {
      await cubit.generateInvite();
      final states = <SharingState>[];
      final sub = cubit.stream.listen(states.add);

      await cubit.generateInvite();
      await pumpEventQueue();
      await sub.cancel();

      expect(states.first.status, SharingStatus.loading);
      expect(states.first.invite, isNull);
    });
  });

  group('CON-13: gerar sem rede', () {
    test('vai a offline e não deixa código no estado', () async {
      repository.failure = const SharingFailure(SharingFailureKind.offline);

      await cubit.generateInvite();

      expect(cubit.state.status, SharingStatus.offline);
      expect(cubit.state.invite, isNull);
      expect(cubit.state.error, isNull);
    });

    test('um código já mostrado some quando o novo pedido cai offline', () async {
      await cubit.generateInvite();
      expect(cubit.state.invite, isNotNull);
      repository.failure = const SharingFailure(SharingFailureKind.offline);

      await cubit.generateInvite();

      expect(cubit.state.status, SharingStatus.offline);
      expect(cubit.state.invite, isNull);
    });

    test('outra falha vai a error com a chave do motivo e sem código', () async {
      repository.failure = const SharingFailure(SharingFailureKind.forbidden);

      await cubit.generateInvite();

      expect(cubit.state.status, SharingStatus.error);
      expect(cubit.state.error, SharingError.forbidden);
      expect(cubit.state.invite, isNull);
    });
  });

  group('CON-08: vínculos', () {
    test('loadGrants guarda a lista e volta a ocioso', () async {
      await cubit.loadGrants();

      expect(cubit.state.status, SharingStatus.idle);
      expect(cubit.state.grants.map((g) => g.id), ['g1', 'g2']);
    });

    test('loadGrants mantém o código mostrado (status inviteReady)', () async {
      await cubit.generateInvite();

      await cubit.loadGrants();

      expect(cubit.state.status, SharingStatus.inviteReady);
      expect(cubit.state.invite, _FakeSharingRepository.invite);
    });

    test('falha ao listar preserva a lista anterior e informa o motivo', () async {
      await cubit.loadGrants();
      repository.failure = const SharingFailure(SharingFailureKind.offline);

      await cubit.loadGrants();

      expect(cubit.state.status, SharingStatus.error);
      expect(cubit.state.error, SharingError.offline);
      expect(cubit.state.grants.map((g) => g.id), ['g1', 'g2']);
    });

    test('revogar remove da lista só o vínculo revogado', () async {
      await cubit.loadGrants();

      await cubit.revoke('g1');

      expect(repository.revoked, ['g1']);
      expect(cubit.state.grants.map((g) => g.id), ['g2']);
      expect(cubit.state.status, SharingStatus.idle);
    });

    test('falha ao revogar preserva a lista anterior e informa o motivo', () async {
      await cubit.loadGrants();
      repository.failure = const SharingFailure(SharingFailureKind.notFound);

      await cubit.revoke('g1');

      expect(cubit.state.status, SharingStatus.error);
      expect(cubit.state.error, SharingError.notFound);
      expect(cubit.state.grants.map((g) => g.id), ['g1', 'g2']);
    });
  });
}
