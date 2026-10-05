import '../../../core/error/failures.dart';

/// Por que uma operação de compartilhamento falhou.
enum SharingFailureKind {
  /// Sem rede ou backend inalcançável.
  offline,

  /// A conta não pode usar o compartilhamento (`403`).
  forbidden,

  /// O vínculo não existe ou não é do paciente (`404`).
  notFound,

  /// Qualquer outra falha.
  unknown,
}

/// Falha do domínio de compartilhamento, lançada pelo [SharingRepository].
class SharingFailure extends Failure implements Exception {
  const SharingFailure(this.kind) : super('Falha no compartilhamento');

  final SharingFailureKind kind;

  @override
  String toString() => 'SharingFailure(${kind.name})';
}
