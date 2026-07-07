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
    required this.type,
    required this.timestamp,
  });

  final AppAlertType type;
  final DateTime timestamp;

  Map<String, dynamic> toJson() => {
    'type': type.name,
    'timestampMs': timestamp.millisecondsSinceEpoch,
  };

  factory AppAlertItem.fromJson(Map<String, dynamic> json) {
    return AppAlertItem(
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
    required this.grams,
    required this.description,
    required this.time,
  });

  final int grams;
  final String description;
  final DateTime time;

  Map<String, dynamic> toJson() => {
    'grams': grams,
    'description': description,
    'timeMs': time.millisecondsSinceEpoch,
  };

  factory CarbEntry.fromJson(Map<String, dynamic> json) {
    return CarbEntry(
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
    required this.units,
    required this.type,
    required this.time,
    required this.dayOfWeek,
  });

  final double units;
  final InsulinType type;
  final DateTime time;
  final String dayOfWeek;

  Map<String, dynamic> toJson() => {
    'units': units,
    'type': type.name,
    'timeMs': time.millisecondsSinceEpoch,
    'dayOfWeek': dayOfWeek,
  };

  factory InsulinEntry.fromJson(Map<String, dynamic> json) {
    return InsulinEntry(
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
