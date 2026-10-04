import 'dart:convert';

/// Verbos aceitos na fila de operações (`pending_ops.op`).
abstract final class PendingOpKind {
  static const upsert = 'upsert';
  static const delete = 'delete';
}

/// Coleções do diário que viajam pelo op-log (`pending_ops.entity`).
///
/// Leituras e thresholds continuam no caminho de coleção (SYNC-10).
abstract final class PendingOpEntity {
  static const carbs = 'carbs';
  static const insulin = 'insulin';
  static const alerts = 'alerts';
}

/// Uma mutação de diário ainda não confirmada pelo backend (SYNC-01).
///
/// A ordem de drenagem é a de [seq] — `INTEGER PRIMARY KEY AUTOINCREMENT` da
/// tabela `pending_ops`, imune ao relógio do aparelho (SYNC-02). [entity] e
/// [op] são texto cru de propósito: uma linha gravada por uma versão futura do
/// app volta legível e é descartada pela drenagem, em vez de estourar na
/// leitura (SYNC-05).
class PendingOp {
  const PendingOp({
    this.seq,
    required this.entity,
    required this.entityId,
    required this.op,
    this.payloadJson,
    required this.createdAt,
  });

  /// Operação de criação ou edição: carrega o estado completo da entrada.
  factory PendingOp.upsert({
    required String entity,
    required String entityId,
    required Map<String, dynamic> payload,
    DateTime? createdAt,
  }) {
    return PendingOp(
      entity: entity,
      entityId: entityId,
      op: PendingOpKind.upsert,
      payloadJson: jsonEncode(payload),
      createdAt: (createdAt ?? DateTime.now()).millisecondsSinceEpoch,
    );
  }

  /// Operação de remoção: só o id viaja, então não há payload.
  factory PendingOp.delete({
    required String entity,
    required String entityId,
    DateTime? createdAt,
  }) {
    return PendingOp(
      entity: entity,
      entityId: entityId,
      op: PendingOpKind.delete,
      createdAt: (createdAt ?? DateTime.now()).millisecondsSinceEpoch,
    );
  }

  factory PendingOp.fromRow(Map<String, Object?> row) => PendingOp(
        seq: row['seq'] as int?,
        entity: row['entity'] as String,
        entityId: row['entity_id'] as String,
        op: row['op'] as String,
        payloadJson: row['payload_json'] as String?,
        createdAt: row['created_at'] as int,
      );

  /// Ordem total da fila; `null` enquanto a operação não foi enfileirada.
  final int? seq;
  final String entity;
  final String entityId;
  final String op;
  final String? payloadJson;
  final int createdAt;

  /// Payload decodificado, ou `null` quando ausente ou ilegível — a drenagem
  /// trata os dois casos como erro definitivo e descarta a operação (SYNC-05).
  Map<String, dynamic>? decodePayload() {
    final raw = payloadJson;
    if (raw == null) {
      return null;
    }
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map<String, dynamic> ? decoded : null;
    } on FormatException {
      return null;
    }
  }

  /// Linha para o `insert` — sem `seq`, que é atribuído pelo banco.
  Map<String, Object?> toRow() => {
        'entity': entity,
        'entity_id': entityId,
        'op': op,
        'payload_json': payloadJson,
        'created_at': createdAt,
      };
}
