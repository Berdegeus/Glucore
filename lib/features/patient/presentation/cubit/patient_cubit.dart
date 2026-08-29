import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/notifications/notification_service.dart';
import '../../../sensor/domain/models.dart';
import '../../../sensor/presentation/cubit/sensor_cubit.dart';
import '../../data/repositories/patient_repository.dart';
import '../../presentation/models/patient_models.dart';
import 'patient_state.dart';

class PatientCubit extends Cubit<PatientState> {
  PatientCubit({required this.repository}) : super(const PatientState());

  final PatientRepository repository;
  StreamSubscription<SensorUiState>? _sensorSubscription;

  Future<void> initialize(SensorCubit sensorCubit) async {
    // P19: bind the local database to the logged-in user. If a DIFFERENT
    // account is now signed in on this device, the local patient data was
    // wiped — also drop the sensor session so a previous patient's physical
    // sensor never streams into the new account.
    final switchedAccount = await repository.ensureOwner();
    if (switchedAccount) {
      await sensorCubit.clearSession();
    }

    // Snapshot local — nunca depende de rede.
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

    // Reconciliação com o backend em background (silenciosa se offline).
    unawaited(_refreshFromRemote());
  }

  Future<void> _refreshFromRemote() async {
    final refreshed = await repository.refreshFromRemote();
    // refreshFromRemote já persistiu o snapshot do servidor localmente
    // (pendências locais preservadas) e devolveu o snapshot local resultante.
    if (refreshed == null || isClosed) {
      return;
    }
    emit(
      state.copyWith(
        readings: List<GlucoseReadingItem>.of(refreshed.readings, growable: false),
        alerts: List<AppAlertItem>.of(refreshed.alerts, growable: false),
        carbs: List<CarbEntry>.of(refreshed.carbs, growable: false),
        insulin: List<InsulinEntry>.of(refreshed.insulin, growable: false),
        alertSettings: refreshed.alertSettings,
      ),
    );
  }

  // As mutações de diário gravam a entrada afetada, não a coleção inteira: o
  // estado local segue completo na memória, e só a entrada mexida viaja
  // (SYNC-01).

  Future<void> addCarbEntry(CarbEntry entry) async {
    final updated = [entry, ...state.carbs]
      ..sort((a, b) => b.time.compareTo(a.time));
    emit(state.copyWith(carbs: updated));
    await repository.addCarb(entry);
  }

  Future<void> addInsulinEntry(InsulinEntry entry) async {
    final updated = [entry, ...state.insulin]
      ..sort((a, b) => b.time.compareTo(a.time));
    emit(state.copyWith(insulin: updated));
    await repository.addInsulin(entry);
  }

  Future<void> editCarbEntry(CarbEntry entry) async {
    final updated = state.carbs
        .map((e) => e.id == entry.id ? entry : e)
        .toList()
      ..sort((a, b) => b.time.compareTo(a.time));
    emit(state.copyWith(carbs: updated));
    await repository.updateCarb(entry);
  }

  Future<void> deleteCarbEntry(CarbEntry entry) async {
    final updated = state.carbs.where((e) => e.id != entry.id).toList();
    emit(state.copyWith(carbs: updated));
    await repository.removeCarb(entry.id);
  }

  Future<void> editInsulinEntry(InsulinEntry entry) async {
    final updated = state.insulin
        .map((e) => e.id == entry.id ? entry : e)
        .toList()
      ..sort((a, b) => b.time.compareTo(a.time));
    emit(state.copyWith(insulin: updated));
    await repository.updateInsulin(entry);
  }

  Future<void> deleteInsulinEntry(InsulinEntry entry) async {
    final updated = state.insulin.where((e) => e.id != entry.id).toList();
    emit(state.copyWith(insulin: updated));
    await repository.removeInsulin(entry.id);
  }

  Future<void> clearReadings() async {
    emit(state.copyWith(readings: const []));
    await repository.saveReadings(const []);
  }

  Future<void> updateAlertSettings(AlertSettingsModel settings) async {
    emit(state.copyWith(alertSettings: settings));
    await repository.saveAlertSettings(settings);
  }

  Future<void> _handleSensorState(SensorUiState sensorState) async {
    var nextState = state.copyWith(sensorState: sensorState);
    var readings = state.readings;
    var alerts = state.alerts;
    var persistReadings = false;
    // Alertas nascidos neste evento: cada um é gravado por item (SYNC-01).
    final newAlerts = <AppAlertItem>[];

    final previousStatus = state.sensorState.status;

    if (sensorState.status == SensorConnectionStatus.syncingHistory &&
        sensorState.historyReading != null) {
      final updatedReadings = _upsertReading(readings, sensorState.historyReading!);
      if (!_sameReadingList(readings, updatedReadings)) {
        readings = updatedReadings;
        nextState = nextState.copyWith(readings: readings);
        // History backlog is persisted in a single batch when the current
        // reading arrives (readingAvailable), not once per history reading.
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

      final threshold = _thresholdAlertFor(
        currentReading: sensorState.reading!,
        alertSettings: nextState.alertSettings,
      );
      if (threshold != null) {
        final updatedAlerts = _prependAlert(alerts, threshold);
        if (!identical(alerts, updatedAlerts)) {
          alerts = updatedAlerts;
          nextState = nextState.copyWith(alerts: alerts);
          newAlerts.add(threshold);
        }
      }
    }

    if (sensorState.status == SensorConnectionStatus.connected &&
        (previousStatus == SensorConnectionStatus.disconnected ||
            previousStatus == SensorConnectionStatus.error)) {
      final reconnected = AppAlertItem.create(
        type: AppAlertType.sensorReconnected,
        timestamp: DateTime.now(),
      );
      final updatedAlerts = _prependAlert(alerts, reconnected);
      if (!identical(alerts, updatedAlerts)) {
        alerts = updatedAlerts;
        nextState = nextState.copyWith(alerts: alerts);
        newAlerts.add(reconnected);
      }
    }

    if (sensorState.status == SensorConnectionStatus.error &&
        sensorState.failure != null) {
      final failed = AppAlertItem.create(
        type: AppAlertType.syncFailure,
        timestamp: DateTime.now(),
      );
      final updatedAlerts = _prependAlert(alerts, failed);
      if (!identical(alerts, updatedAlerts)) {
        alerts = updatedAlerts;
        nextState = nextState.copyWith(alerts: alerts);
        newAlerts.add(failed);
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

    // Leituras seguem no caminho de coleção com debounce (SYNC-10).
    if (persistReadings) {
      await repository.saveReadings(readings);
    }
    for (final alert in newAlerts) {
      await repository.addAlert(alert);
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
    return updated.take(PatientRepository.maxReadings).toList();
  }

  AppAlertItem? _thresholdAlertFor({
    required GlucoseReading currentReading,
    required AlertSettingsModel alertSettings,
  }) {
    final now = DateTime.now();
    if (currentReading.value <= alertSettings.lowThreshold) {
      return AppAlertItem.create(type: AppAlertType.glucoseLow, timestamp: now);
    }
    if (currentReading.value >= alertSettings.highThreshold) {
      return AppAlertItem.create(type: AppAlertType.glucoseHigh, timestamp: now);
    }
    return null;
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

    return [alert, ...current].take(PatientRepository.maxAlerts).toList();
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

  @override
  Future<void> close() async {
    await _sensorSubscription?.cancel();
    return super.close();
  }
}
