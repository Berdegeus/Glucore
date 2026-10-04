import 'entry_id.dart';

enum AppAlertType { glucoseLow, glucoseHigh, sensorReconnected, syncFailure }

class AppAlertItem {
  const AppAlertItem({
    required this.id,
    required this.type,
    required this.timestamp,
  });

  /// Cria um alerta novo no app, com identidade própria (IDENT-01).
  factory AppAlertItem.create({
    required AppAlertType type,
    required DateTime timestamp,
  }) {
    return AppAlertItem(id: newEntryId(), type: type, timestamp: timestamp);
  }

  final String id;
  final AppAlertType type;
  final DateTime timestamp;

  /// Preserva o [id] — editar horário ou tipo não muda a identidade (IDENT-02).
  AppAlertItem copyWith({AppAlertType? type, DateTime? timestamp}) {
    return AppAlertItem(
      id: id,
      type: type ?? this.type,
      timestamp: timestamp ?? this.timestamp,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type.name,
    'timestampMs': timestamp.millisecondsSinceEpoch,
  };

  factory AppAlertItem.fromJson(Map<String, dynamic> json) {
    return AppAlertItem(
      id: entryIdFrom(json['id']),
      type: AppAlertType.values.byName(
        json['type']?.toString() ?? AppAlertType.syncFailure.name,
      ),
      timestamp: DateTime.fromMillisecondsSinceEpoch(
        (json['timestampMs'] as num?)?.toInt() ?? 0,
      ),
    );
  }
}
