import 'package:equatable/equatable.dart';

import '../../domain/entities/grant.dart';
import '../../domain/entities/invite_code.dart';

enum SharingStatus { idle, loading, inviteReady, offline, error }

/// Motivo de um [SharingStatus.error]; a tela traduz cada um em texto.
enum SharingError { offline, forbidden, notFound, unknown }

class SharingState extends Equatable {
  const SharingState({
    this.status = SharingStatus.idle,
    this.invite,
    this.grants = const [],
    this.error,
  });

  final SharingStatus status;

  /// O código a mostrar. Nunca existe junto de [SharingStatus.offline]
  /// (CON-13).
  final InviteCode? invite;
  final List<Grant> grants;

  /// Só tem valor quando [status] é [SharingStatus.error].
  final SharingError? error;

  /// [error] sempre é substituído (nulo limpa); [invite] só some com
  /// [clearInvite].
  SharingState copyWith({
    SharingStatus? status,
    InviteCode? invite,
    bool clearInvite = false,
    List<Grant>? grants,
    SharingError? error,
  }) {
    return SharingState(
      status: status ?? this.status,
      invite: clearInvite ? null : (invite ?? this.invite),
      grants: grants ?? this.grants,
      error: error,
    );
  }

  @override
  List<Object?> get props => [status, invite, grants, error];
}
