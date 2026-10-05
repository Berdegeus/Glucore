import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/usecase.dart';
import '../../domain/sharing_failure.dart';
import '../../domain/usecases/generate_invite.dart';
import '../../domain/usecases/list_grants.dart';
import '../../domain/usecases/revoke_grant.dart';
import 'sharing_state.dart';

/// Estado da tela de compartilhamento com profissionais.
///
/// Toda operação exige rede (não há cópia local): falhar nunca apaga a lista
/// de vínculos já carregada, e gerar o código sem rede nunca deixa um código
/// no estado (CON-13).
class SharingCubit extends Cubit<SharingState> {
  SharingCubit({
    required GenerateInvite generateInvite,
    required ListGrants listGrants,
    required RevokeGrant revokeGrant,
  })  : _generateInvite = generateInvite,
        _listGrants = listGrants,
        _revokeGrant = revokeGrant,
        super(const SharingState());

  final GenerateInvite _generateInvite;
  final ListGrants _listGrants;
  final RevokeGrant _revokeGrant;

  /// Gera o código (CON-01). O código anterior some da tela já ao tocar: ele
  /// deixa de valer no servidor assim que o novo é emitido (CON-03).
  Future<void> generateInvite() async {
    emit(state.copyWith(status: SharingStatus.loading, clearInvite: true));
    try {
      final invite = await _generateInvite(const NoParams());
      if (isClosed) return;
      emit(state.copyWith(status: SharingStatus.inviteReady, invite: invite));
    } on SharingFailure catch (failure) {
      if (isClosed) return;
      if (failure.kind == SharingFailureKind.offline) {
        emit(state.copyWith(status: SharingStatus.offline));
      } else {
        _emitError(failure);
      }
    }
  }

  /// Carrega os profissionais vinculados (CON-08).
  Future<void> loadGrants() async {
    emit(state.copyWith(status: SharingStatus.loading));
    try {
      final grants = await _listGrants(const NoParams());
      if (isClosed) return;
      emit(state.copyWith(status: _settledStatus, grants: grants));
    } on SharingFailure catch (failure) {
      _emitError(failure);
    }
  }

  /// Revoga o vínculo e o tira da lista só depois que o servidor confirma
  /// (CON-08).
  Future<void> revoke(String grantId) async {
    try {
      await _revokeGrant(grantId);
      if (isClosed) return;
      emit(
        state.copyWith(
          status: _settledStatus,
          grants: [
            for (final grant in state.grants)
              if (grant.id != grantId) grant,
          ],
        ),
      );
    } on SharingFailure catch (failure) {
      _emitError(failure);
    }
  }

  SharingStatus get _settledStatus =>
      state.invite == null ? SharingStatus.idle : SharingStatus.inviteReady;

  void _emitError(SharingFailure failure) {
    if (isClosed) return;
    emit(
      state.copyWith(status: SharingStatus.error, error: _errorOf(failure.kind)),
    );
  }

  SharingError _errorOf(SharingFailureKind kind) => switch (kind) {
        SharingFailureKind.offline => SharingError.offline,
        SharingFailureKind.forbidden => SharingError.forbidden,
        SharingFailureKind.notFound => SharingError.notFound,
        SharingFailureKind.unknown => SharingError.unknown,
      };
}
