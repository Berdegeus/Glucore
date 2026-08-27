import 'package:uuid/uuid.dart';

const _uuid = Uuid();

final _uuidPattern = RegExp(
  r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-'
  r'[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
);

/// Identidade estável de uma entrada de diário (IDENT-01/IDENT-06).
///
/// Usa o id vindo do servidor quando ele é um UUID bem formado; caso contrário
/// gera um UUID v4 local, para que a entrada nunca fique sem identidade.
String _entryId(Object? candidate) {
  final value = candidate?.toString() ?? '';
  return _uuidPattern.hasMatch(value) ? value : _uuid.v4();
}

enum GlucoseTrend { rising, stable, falling }

enum AppAlertType { glucoseLow, glucoseHigh, sensorReconnected, syncFailure }

enum InsulinType { bolus, basal, correction }

class GlucoseReadingItem {
  const GlucoseReadingItem({
    required this.value,
    required this.timestamp,
    required this.trend,
    required this.rate,
    this.alarmCode,
  });

  final double value;
  final DateTime timestamp;
  final GlucoseTrend trend;
  final double rate;
  final int? alarmCode;

  GlucoseReadingItem copyWith({
    double? value,
    DateTime? timestamp,
    GlucoseTrend? trend,
    double? rate,
    int? alarmCode,
  }) {
    return GlucoseReadingItem(
      value: value ?? this.value,
      timestamp: timestamp ?? this.timestamp,
      trend: trend ?? this.trend,
      rate: rate ?? this.rate,
      alarmCode: alarmCode ?? this.alarmCode,
    );
  }

  Map<String, dynamic> toJson() => {
    'value': value,
    'timestampMs': timestamp.millisecondsSinceEpoch,
    'trend': trend.name,
    'rate': rate,
    'alarmCode': alarmCode,
  };

  factory GlucoseReadingItem.fromJson(Map<String, dynamic> json) {
    return GlucoseReadingItem(
      value: (json['value'] as num?)?.toDouble() ?? 0,
      timestamp: DateTime.fromMillisecondsSinceEpoch(
        (json['timestampMs'] as num?)?.toInt() ?? 0,
      ),
      trend: GlucoseTrend.values.byName(
        json['trend']?.toString() ?? GlucoseTrend.stable.name,
      ),
      rate: (json['rate'] as num?)?.toDouble() ?? 0,
      alarmCode: (json['alarmCode'] as num?)?.toInt(),
    );
  }
}

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
    return AppAlertItem(id: _uuid.v4(), type: type, timestamp: timestamp);
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
      id: _entryId(json['id']),
      type: AppAlertType.values.byName(
        json['type']?.toString() ?? AppAlertType.syncFailure.name,
      ),
      timestamp: DateTime.fromMillisecondsSinceEpoch(
        (json['timestampMs'] as num?)?.toInt() ?? 0,
      ),
    );
  }
}

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
      id: _uuid.v4(),
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
      id: _entryId(json['id']),
      grams: (json['grams'] as num?)?.toInt() ?? 0,
      description: json['description']?.toString() ?? '',
      time: DateTime.fromMillisecondsSinceEpoch(
        (json['timeMs'] as num?)?.toInt() ?? 0,
      ),
    );
  }
}

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
      id: _uuid.v4(),
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
      id: _entryId(json['id']),
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

class AlertSettingsModel {
  const AlertSettingsModel({
    required this.lowThreshold,
    required this.highThreshold,
  });

  final int lowThreshold;
  final int highThreshold;

  AlertSettingsModel copyWith({int? lowThreshold, int? highThreshold}) {
    return AlertSettingsModel(
      lowThreshold: lowThreshold ?? this.lowThreshold,
      highThreshold: highThreshold ?? this.highThreshold,
    );
  }

  Map<String, dynamic> toJson() => {
    'lowThreshold': lowThreshold,
    'highThreshold': highThreshold,
  };

  factory AlertSettingsModel.fromJson(Map<String, dynamic> json) {
    return AlertSettingsModel(
      lowThreshold: (json['lowThreshold'] as num?)?.toInt() ?? 80,
      highThreshold: (json['highThreshold'] as num?)?.toInt() ?? 180,
    );
  }
}
