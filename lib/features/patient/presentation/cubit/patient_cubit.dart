import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/notifications/notification_service.dart';
import '../../../sensor/domain/models.dart';
import '../../../sensor/presentation/cubit/sensor_cubit.dart';
import '../../data/repositories/patient_local_repository.dart';
import '../../presentation/models/patient_models.dart';
import 'patient_state.dart';

class PatientCubit extends Cubit<PatientState> {
  PatientCubit({required this.repository}) : super(const PatientState());

  final PatientLocalRepository repository;
  StreamSubscription<SensorUiState>? _sensorSubscription;

  Future<void> initialize(SensorCubit sensorCubit) async {
    final snapshot = await repository.load();
    emit(
      state.copyWith(
        readings: List<GlucoseReadingItem>.of(snapshot.readings, growable: false),
        alerts: List<AppAlertItem>.of(snapshot.alerts, growable: false),
        carbs: List<CarbEntry>.of(snapshot.carbs, growable: false),
        insulin: List<InsulinEntry>.of(snapshot.insulin, growable: false),
        alertSettings: snapshot.alertSettings,
        sensorState: sensorCubit.state,
      ),
    );

    await _sensorSubscription?.cancel();
    _sensorSubscription = sensorCubit.stream.listen(_handleSensorState);
    await _handleSensorState(sensorCubit.state);
  }

  Future<void> addCarbEntry(CarbEntry entry) async {
    final updated = [entry, ...state.carbs]
      ..sort((a, b) => b.time.compareTo(a.time));
    emit(state.copyWith(carbs: updated));
    await repository.saveCarbs(updated);
  }

  Future<void> addInsulinEntry(InsulinEntry entry) async {
    final updated = [entry, ...state.insulin]
      ..sort((a, b) => b.time.compareTo(a.time));
    emit(state.copyWith(insulin: updated));
    await repository.saveInsulin(updated);
  }

  Future<void> clearReadings() async {
    emit(state.copyWith(readings: const []));
    if (!state.sensorState.isMock) {
      await repository.saveReadings(const []);
    }
  }

  Future<void> updateAlertSettings(AlertSettingsModel settings) async {
    emit(state.copyWith(alertSettings: settings));
    await repository.saveAlertSettings(settings);
  }

  Future<void> _handleSensorState(SensorUiState sensorState) async {
    // When mock session ends, discard in-memory mock data and reload persisted state.
    final wasMock = state.sensorState.isMock;
    if (wasMock && !sensorState.isMock) {
      final snapshot = await repository.load();
      emit(
        state.copyWith(
          readings: List<GlucoseReadingItem>.of(snapshot.readings, growable: false),
          alerts: List<AppAlertItem>.of(snapshot.alerts, growable: false),
          sensorState: sensorState,
        ),
      );
      return;
    }

    var nextState = state.copyWith(sensorState: sensorState);
    var readings = state.readings;
    var alerts = state.alerts;
    // Never persist mock readings/alerts to storage.
    final isMock = sensorState.isMock;
    var persistReadings = false;
    var persistAlerts = false;

    final previousStatus = state.sensorState.status;

    if (sensorState.status == SensorConnectionStatus.syncingHistory &&
        sensorState.historyReading != null) {
      final updatedReadings = _upsertReading(readings, sensorState.historyReading!);
      if (!_sameReadingList(readings, updatedReadings)) {
        readings = updatedReadings;
        nextState = nextState.copyWith(readings: readings);
        persistReadings = true;
      }
    }

    if (sensorState.status == SensorConnectionStatus.readingAvailable &&
        sensorState.reading != null) {
      final updatedReadings = _upsertReading(readings, sensorState.reading!);
      if (!_sameReadingList(readings, updatedReadings)) {
        readings = updatedReadings;
        nextState = nextState.copyWith(readings: readings);
        persistReadings = true;
      }

      final thresholdAlerts = _withThresholdAlerts(
        currentReading: sensorState.reading!,
        alertSettings: nextState.alertSettings,
        alerts: alerts,
      );
      if (!_sameAlertList(alerts, thresholdAlerts)) {
        alerts = thresholdAlerts;
        nextState = nextState.copyWith(alerts: alerts);
        persistAlerts = true;
      }
    }

    if (sensorState.status == SensorConnectionStatus.connected &&
        (previousStatus == SensorConnectionStatus.disconnected ||
            previousStatus == SensorConnectionStatus.error)) {
      final updatedAlerts = _prependAlert(
        alerts,
        AppAlertItem(
          type: AppAlertType.sensorReconnected,
          timestamp: DateTime.now(),
        ),
      );
      if (!_sameAlertList(alerts, updatedAlerts)) {
        alerts = updatedAlerts;
        nextState = nextState.copyWith(alerts: alerts);
        persistAlerts = true;
      }
    }

    if (sensorState.status == SensorConnectionStatus.error &&
        sensorState.failure != null) {
      final updatedAlerts = _prependAlert(
        alerts,
        AppAlertItem(
          type: AppAlertType.syncFailure,
          timestamp: DateTime.now(),
        ),
      );
      if (!_sameAlertList(alerts, updatedAlerts)) {
        alerts = updatedAlerts;
        nextState = nextState.copyWith(alerts: alerts);
        persistAlerts = true;
      }
    }

    final wasActive = previousStatus == SensorConnectionStatus.connected ||
        previousStatus == SensorConnectionStatus.readingAvailable ||
        previousStatus == SensorConnectionStatus.syncingHistory ||
        previousStatus == SensorConnectionStatus.warmingUp;
    final nowLost = sensorState.status == SensorConnectionStatus.disconnected ||
        sensorState.status == SensorConnectionStatus.error;
    if (wasActive && nowLost) {
      NotificationService.instance.showSensorDisconnected();
    }

    emit(nextState);

    if (persistReadings && !isMock) {
      await repository.saveReadings(readings);
    }
    if (persistAlerts && !isMock) {
      await repository.saveAlerts(alerts);
    }
  }

  List<GlucoseReadingItem> _upsertReading(
    List<GlucoseReadingItem> current,
    GlucoseReading reading,
  ) {
    final entry = GlucoseReadingItem(
      value: reading.value,
      timestamp: reading.timestamp,
      trend: _trendFromRate(reading.rate),
      rate: reading.rate,
      alarmCode: reading.alarmCode,
    );

    final updated = List<GlucoseReadingItem>.of(
      current.where(
        (item) =>
            item.timestamp.millisecondsSinceEpoch !=
            entry.timestamp.millisecondsSinceEpoch,
      ),
      growable: true,
    );
    updated.add(entry);
    updated.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return updated.take(PatientLocalRepository.maxReadings).toList();
  }

  List<AppAlertItem> _withThresholdAlerts({
    required GlucoseReading currentReading,
    required AlertSettingsModel alertSettings,
    required List<AppAlertItem> alerts,
  }) {
    var updated = alerts;
    final now = DateTime.now();
    if (currentReading.value <= alertSettings.lowThreshold) {
      updated = _prependAlert(
        updated,
        AppAlertItem(type: AppAlertType.glucoseLow, timestamp: now),
      );
    } else if (currentReading.value >= alertSettings.highThreshold) {
      updated = _prependAlert(
        updated,
        AppAlertItem(type: AppAlertType.glucoseHigh, timestamp: now),
      );
    }
    return updated;
  }

  List<AppAlertItem> _prependAlert(
    List<AppAlertItem> current,
    AppAlertItem alert,
  ) {
    final duplicate = current.any((item) {
      if (item.type != alert.type) {
        return false;
      }
      return alert.timestamp.difference(item.timestamp).abs() <
          const Duration(minutes: 15);
    });

    if (duplicate) {
      return current;
    }

    return [alert, ...current].take(PatientLocalRepository.maxAlerts).toList();
  }

  GlucoseTrend _trendFromRate(double rate) {
    if (rate > 0) {
      return GlucoseTrend.rising;
    }
    if (rate < 0) {
      return GlucoseTrend.falling;
    }
    return GlucoseTrend.stable;
  }

  bool _sameReadingList(
    List<GlucoseReadingItem> left,
    List<GlucoseReadingItem> right,
  ) {
    if (identical(left, right)) {
      return true;
    }
    if (left.length != right.length) {
      return false;
    }
    for (var i = 0; i < left.length; i++) {
      final a = left[i];
      final b = right[i];
      if (a.timestamp != b.timestamp || a.value != b.value || a.rate != b.rate) {
        return false;
      }
    }
    return true;
  }

  bool _sameAlertList(List<AppAlertItem> left, List<AppAlertItem> right) {
    if (identical(left, right)) {
      return true;
    }
    if (left.length != right.length) {
      return false;
    }
    for (var i = 0; i < left.length; i++) {
      final a = left[i];
      final b = right[i];
      if (a.type != b.type || a.timestamp != b.timestamp) {
        return false;
      }
    }
    return true;
  }

  @override
  Future<void> close() async {
    await _sensorSubscription?.cancel();
    return super.close();
  }
}
