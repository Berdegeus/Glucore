import 'entry_id.dart';

class CarbEntry {
  const CarbEntry({
    required this.id,
    required this.grams,
    required this.description,
    required this.time,
  });

  /// Cria uma entrada nova no app, com identidade própria (IDENT-01).
  factory CarbEntry.create({
    required int grams,
    required String description,
    required DateTime time,
  }) {
    return CarbEntry(
      id: newEntryId(),
      grams: grams,
      description: description,
      time: time,
    );
  }

  final String id;
  final int grams;
  final String description;
  final DateTime time;

  /// Preserva o [id] — mudar o horário não muda a identidade (IDENT-02).
  CarbEntry copyWith({int? grams, String? description, DateTime? time}) {
    return CarbEntry(
      id: id,
      grams: grams ?? this.grams,
      description: description ?? this.description,
      time: time ?? this.time,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'grams': grams,
    'description': description,
    'timeMs': time.millisecondsSinceEpoch,
  };

  factory CarbEntry.fromJson(Map<String, dynamic> json) {
    return CarbEntry(
      id: entryIdFrom(json['id']),
      grams: (json['grams'] as num?)?.toInt() ?? 0,
      description: json['description']?.toString() ?? '',
      time: DateTime.fromMillisecondsSinceEpoch(
        (json['timeMs'] as num?)?.toInt() ?? 0,
      ),
    );
  }
}
