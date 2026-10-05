/// Código de uso único que o paciente entrega ao profissional (CON-01).
class InviteCode {
  const InviteCode({required this.code, required this.expiresAt});

  final String code;

  /// Instante em que o código deixa de valer, em UTC.
  final DateTime expiresAt;

  @override
  bool operator ==(Object other) =>
      other is InviteCode && other.code == code && other.expiresAt == expiresAt;

  @override
  int get hashCode => Object.hash(code, expiresAt);
}
