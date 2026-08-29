import 'entry_id.dart';

enum InsulinType { bolus, basal, correction }

const kDaysOfWeek = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
];

class InsulinEntry {
  const InsulinEntry({
    required this.id,
    required this.units,
    required this.type,
    required this.time,
    required this.dayOfWeek,
  });

  /// Cria uma entrada nova no app, com identidade própria (IDENT-01).
  factory InsulinEntry.create({
    required double units,
    required InsulinType type,
    required DateTime time,
    required String dayOfWeek,
  }) {
    return InsulinEntry(
      id: newEntryId(),
      units: units,
      type: type,
      time: time,
      dayOfWeek: dayOfWeek,
    );
  }

  final String id;
  final double units;
  final InsulinType type;
  final DateTime time;
  final String dayOfWeek;

  /// Preserva o [id] — mudar o horário não muda a identidade (IDENT-02).
  InsulinEntry copyWith({
    double? units,
    InsulinType? type,
    DateTime? time,
    String? dayOfWeek,
  }) {
    return InsulinEntry(
      id: id,
      units: units ?? this.units,
      type: type ?? this.type,
      time: time ?? this.time,
      dayOfWeek: dayOfWeek ?? this.dayOfWeek,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'units': units,
    'type': type.name,
    'timeMs': time.millisecondsSinceEpoch,
    'dayOfWeek': dayOfWeek,
  };

  factory InsulinEntry.fromJson(Map<String, dynamic> json) {
    return InsulinEntry(
      id: entryIdFrom(json['id']),
      units: (json['units'] as num?)?.toDouble() ?? 0,
      type: InsulinType.values.byName(
        json['type']?.toString() ?? InsulinType.bolus.name,
      ),
      time: DateTime.fromMillisecondsSinceEpoch(
        (json['timeMs'] as num?)?.toInt() ?? 0,
      ),
      dayOfWeek: json['dayOfWeek']?.toString() ?? kDaysOfWeek[0],
    );
  }
}
