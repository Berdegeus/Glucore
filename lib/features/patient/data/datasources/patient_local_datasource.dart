import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../presentation/models/patient_models.dart';

class PatientLocalSnapshot {
  const PatientLocalSnapshot({
    required this.readings,
    required this.alerts,
    required this.carbs,
    required this.insulin,
    required this.alertSettings,
  });

  final List<GlucoseReadingItem> readings;
  final List<AppAlertItem> alerts;
  final List<CarbEntry> carbs;
  final List<InsulinEntry> insulin;
  final AlertSettingsModel alertSettings;
}

abstract class PatientLocalDataSource {
  Future<PatientLocalSnapshot> load();
  Future<void> saveReadings(List<GlucoseReadingItem> readings);
  Future<void> saveAlerts(List<AppAlertItem> alerts);
  Future<void> saveCarbs(List<CarbEntry> carbs);
  Future<void> saveInsulin(List<InsulinEntry> insulin);
  Future<void> saveAlertSettings(AlertSettingsModel settings);
}

class SharedPrefsPatientLocalDataSource implements PatientLocalDataSource {
  const SharedPrefsPatientLocalDataSource(this.sharedPreferences);

  final SharedPreferences sharedPreferences;

  static const _readingsKey = 'patient_glucose_readings_v1';
  static const _alertsKey = 'patient_alerts_v1';
  static const _carbsKey = 'patient_carbs_v1';
  static const _insulinKey = 'patient_insulin_v1';
  static const _alertSettingsKey = 'patient_alert_settings_v1';

  @override
  Future<PatientLocalSnapshot> load() async {
    return PatientLocalSnapshot(
      readings: _decodeList(
        key: _readingsKey,
        mapper: (json) => GlucoseReadingItem.fromJson(json),
      ),
      alerts: _decodeList(
        key: _alertsKey,
        mapper: (json) => AppAlertItem.fromJson(json),
      ),
      carbs: _decodeList(
        key: _carbsKey,
        mapper: (json) => CarbEntry.fromJson(json),
      ),
      insulin: _decodeList(
        key: _insulinKey,
        mapper: (json) => InsulinEntry.fromJson(json),
      ),
      alertSettings: _decodeObject(
        key: _alertSettingsKey,
        mapper: (json) => AlertSettingsModel.fromJson(json),
      ) ?? const AlertSettingsModel(lowThreshold: 80, highThreshold: 180),
    );
  }

  @override
  Future<void> saveReadings(List<GlucoseReadingItem> readings) {
    return _saveList(_readingsKey, readings.map((item) => item.toJson()).toList());
  }

  @override
  Future<void> saveAlerts(List<AppAlertItem> alerts) {
    return _saveList(_alertsKey, alerts.map((item) => item.toJson()).toList());
  }

  @override
  Future<void> saveCarbs(List<CarbEntry> carbs) {
    return _saveList(_carbsKey, carbs.map((item) => item.toJson()).toList());
  }

  @override
  Future<void> saveInsulin(List<InsulinEntry> insulin) {
    return _saveList(_insulinKey, insulin.map((item) => item.toJson()).toList());
  }

  @override
  Future<void> saveAlertSettings(AlertSettingsModel settings) {
    return sharedPreferences.setString(
      _alertSettingsKey,
      jsonEncode(settings.toJson()),
    );
  }

  List<T> _decodeList<T>({
    required String key,
    required T Function(Map<String, dynamic> json) mapper,
  }) {
    final raw = sharedPreferences.getString(key);
    if (raw == null || raw.isEmpty) {
      return <T>[];
    }

    final decoded = jsonDecode(raw);
    if (decoded is! List) {
      return <T>[];
    }

    return decoded
        .whereType<Map>()
        .map((item) => mapper(Map<String, dynamic>.from(item)))
        .toList(growable: false)
        .cast<T>();
  }

  T? _decodeObject<T>({
    required String key,
    required T Function(Map<String, dynamic> json) mapper,
  }) {
    final raw = sharedPreferences.getString(key);
    if (raw == null || raw.isEmpty) {
      return null;
    }

    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      return null;
    }
    return mapper(Map<String, dynamic>.from(decoded));
  }

  Future<void> _saveList(String key, List<Map<String, dynamic>> value) {
    return sharedPreferences.setString(key, jsonEncode(value));
  }
}
