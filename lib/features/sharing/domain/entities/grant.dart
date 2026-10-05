/// Vínculo ativo entre o paciente e um profissional de saúde (CON-08).
class Grant {
  const Grant({
    required this.id,
    required this.professionalName,
    required this.specialty,
    required this.grantedAt,
  });

  final String id;

  /// Nulo quando o nome do profissional não pôde ser composto (resposta
  /// degradada do gateway): a tela mostra um texto no lugar.
  final String? professionalName;
  final String specialty;

  /// Instante em que o vínculo foi criado, em UTC.
  final DateTime grantedAt;

  @override
  bool operator ==(Object other) =>
      other is Grant &&
      other.id == id &&
      other.professionalName == professionalName &&
      other.specialty == specialty &&
      other.grantedAt == grantedAt;

  @override
  int get hashCode => Object.hash(id, professionalName, specialty, grantedAt);
}
