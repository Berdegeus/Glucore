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
