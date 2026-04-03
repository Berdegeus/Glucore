import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../models/patient_models.dart';

class PatientMockStore {
  PatientMockStore._();

  static final ValueNotifier<List<GlucoseReadingItem>> readings = ValueNotifier([
    GlucoseReadingItem(
      value: 124,
      timestamp: DateTime.now().subtract(const Duration(minutes: 5)),
      trend: GlucoseTrend.stable,
    ),
    GlucoseReadingItem(
      value: 118,
      timestamp: DateTime.now().subtract(const Duration(minutes: 10)),
      trend: GlucoseTrend.falling,
    ),
    GlucoseReadingItem(
      value: 131,
      timestamp: DateTime.now().subtract(const Duration(minutes: 15)),
      trend: GlucoseTrend.rising,
    ),
  ]);

  static final ValueNotifier<List<AppAlertItem>> alerts = ValueNotifier([
    AppAlertItem(
      type: AppAlertType.imminentHypoRisk,
      timestamp: DateTime.now().subtract(const Duration(minutes: 7)),
      color: Colors.orange,
    ),
    AppAlertItem(
      type: AppAlertType.sensorReconnected,
      timestamp: DateTime.now().subtract(const Duration(minutes: 30)),
      color: AppTheme.brandPrimary,
    ),
  ]);

  static final ValueNotifier<List<CarbEntry>> carbs = ValueNotifier([]);
  static final ValueNotifier<List<InsulinEntry>> insulin = ValueNotifier([]);

  static final ValueNotifier<AlertSettingsModel> alertSettings = ValueNotifier(
    const AlertSettingsModel(lowThreshold: 80, highThreshold: 180),
  );

  static final ValueNotifier<SensorConnectionUiState> sensorState =
      ValueNotifier(SensorConnectionUiState.connected);

  static final ValueNotifier<bool> hasRecentReading = ValueNotifier(true);
  static final ValueNotifier<bool> predictionAvailable = ValueNotifier(true);
  static final ValueNotifier<bool> syncFailure = ValueNotifier(false);

  static int predictedIn15Minutes() {
    if (readings.value.isEmpty) return 0;
    return readings.value.first.value + 6;
  }

  static void addCarbEntry(CarbEntry entry) {
    carbs.value = [entry, ...carbs.value];
  }

  static void addInsulinEntry(InsulinEntry entry) {
    insulin.value = [entry, ...insulin.value];
  }

  static void updateAlertSettings(AlertSettingsModel value) {
    alertSettings.value = value;
  }

  static void setSensorState(SensorConnectionUiState state) {
    sensorState.value = state;
  }

  static void addAlert(AppAlertItem alert) {
    alerts.value = [alert, ...alerts.value];
  }
}
