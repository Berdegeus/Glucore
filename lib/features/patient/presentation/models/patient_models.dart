import 'package:flutter/material.dart';

enum GlucoseTrend { rising, stable, falling }

enum AppAlertType { imminentHypoRisk, sensorReconnected }

enum InsulinType { bolus, basal, correction }

enum SensorConnectionUiState {
  connected,
  searching,
  permissionPending,
  compatibilityError,
  reconnecting,
  unavailable,
  disconnected,
}

class GlucoseReadingItem {
  const GlucoseReadingItem({
    required this.value,
    required this.timestamp,
    required this.trend,
  });

  final int value;
  final DateTime timestamp;
  final GlucoseTrend trend;
}

class AppAlertItem {
  const AppAlertItem({
    required this.type,
    required this.timestamp,
    required this.color,
  });

  final AppAlertType type;
  final DateTime timestamp;
  final Color color;
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
}

class InsulinEntry {
  const InsulinEntry({
    required this.units,
    required this.type,
    required this.time,
  });

  final double units;
  final InsulinType type;
  final DateTime time;
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
}
