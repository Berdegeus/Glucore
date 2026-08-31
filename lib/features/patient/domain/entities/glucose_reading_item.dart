enum GlucoseTrend { rising, stable, falling }

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
