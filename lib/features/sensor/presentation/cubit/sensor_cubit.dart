import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/repositories/mock_sensor_repository.dart';
import '../../domain/events.dart';
import '../../domain/models.dart';
import '../../domain/sensor_repository.dart';

class SensorCubit extends Cubit<SensorUiState> {
  SensorCubit({required this.repository}) : super(SensorUiState.initial);

  final SensorRepository repository;
  StreamSubscription<SensorEvent>? _eventSubscription;
  MockSensorRepository? _mockRepo;
  bool _initialized = false;
  bool get isMockActive => _mockRepo != null;

  Future<void> initialize() async {
    if (_initialized) {
      return;
    }
    _initialized = true;
    _listenToEvents();

    try {
      final restored = await repository.restoreSession();
      if (restored != null) {
        emit(
          state.copyWith(
            status: SensorConnectionStatus.disconnected,
            session: restored,
            clearFailure: true,
          ),
        );
        await startMonitoring();
      } else {
        emit(SensorUiState.initial);
      }
    } catch (e) {
      emit(
        state.copyWith(
          status: SensorConnectionStatus.error,
          failure: SensorFailure(e.toString()),
        ),
      );
    }
  }

  SensorUiState _mapEventToState(SensorEvent event, {required bool isMock}) {
    return SensorUiState(
      status: event.status,
      session: event.session ?? state.session,
      historySyncInfo: event.status == SensorConnectionStatus.syncingHistory
          ? event.historySyncInfo
          : null,
      historyReading: event.status == SensorConnectionStatus.syncingHistory
          ? event.historyReading
          : null,
      warmupInfo: event.warmupInfo ?? state.warmupInfo,
      reading: event.reading ?? state.reading,
      failure: event.failure,
      nfcInfo: event.nfc ?? state.nfcInfo,
      isMock: isMock,
    );
  }

  void _listenToEvents() {
    _eventSubscription?.cancel();
    _eventSubscription = repository.observeSessionEvents().listen(
      (event) {
        emit(_mapEventToState(event, isMock: false));
      },
      onError: (error) {
        emit(
          state.copyWith(
            status: SensorConnectionStatus.error,
            failure: SensorFailure(error.toString()),
          ),
        );
      },
    );
  }

  Future<void> registerSensor(
    String barcode, {
    SensorBrand brand = SensorBrand.sibionics,
  }) async {
    emit(state.copyWith(clearFailure: true));
    try {
      final session = await repository.registerSensor(barcode, brand: brand);
      if (session != null) {
        emit(state.copyWith(session: session, clearFailure: true));
      }
    } catch (e) {
      emit(
        state.copyWith(
          status: SensorConnectionStatus.error,
          failure: SensorFailure(e.toString()),
        ),
      );
    }
  }

  Future<void> submitTransmitter(String transmitterBarcode) async {
    try {
      await repository.submitTransmitter(transmitterBarcode);
      if (state.session != null) {
        emit(
          state.copyWith(
            session: state.session!.copyWith(transmitterId: transmitterBarcode),
          ),
        );
      }
    } catch (e) {
      emit(
        state.copyWith(
          status: SensorConnectionStatus.error,
          failure: SensorFailure(e.toString()),
        ),
      );
    }
  }

  Future<void> startMonitoring() async {
    if (state.status == SensorConnectionStatus.scanning ||
        state.status == SensorConnectionStatus.connecting ||
        state.status == SensorConnectionStatus.pairing ||
        state.status == SensorConnectionStatus.connected ||
        state.status == SensorConnectionStatus.syncingHistory ||
        state.status == SensorConnectionStatus.readingAvailable) {
      return;
    }
    emit(
      state.copyWith(
        status: SensorConnectionStatus.scanning,
        clearFailure: true,
      ),
    );
    try {
      await repository.startMonitoring();
    } catch (e) {
      emit(
        state.copyWith(
          status: SensorConnectionStatus.error,
          failure: SensorFailure(e.toString()),
        ),
      );
    }
  }

  Future<void> stopMonitoring() async {
    try {
      await repository.stopMonitoring();
    } catch (e) {
      emit(
        state.copyWith(
          status: SensorConnectionStatus.error,
          failure: SensorFailure(e.toString()),
        ),
      );
    }
  }

  Future<void> clearSession() async {
    try {
      await repository.clearSession();
      emit(SensorUiState.initial);
    } catch (e) {
      emit(
        state.copyWith(
          status: SensorConnectionStatus.error,
          failure: SensorFailure(e.toString()),
        ),
      );
    }
  }

  // ── Libre 2 (Abbott library + NFC) ─────────────────────────────────────────

  Future<AbbottLibraryStatus?> getAbbottLibraryStatus() async {
    try {
      return await repository.getAbbottLibraryStatus();
    } catch (e) {
      emit(
        state.copyWith(
          status: SensorConnectionStatus.error,
          failure: SensorFailure(e.toString()),
        ),
      );
      return null;
    }
  }

  /// Returns true on success; failures land in [SensorUiState.failure].
  Future<bool> installAbbottLibrary(String path) async {
    emit(state.copyWith(clearFailure: true));
    try {
      await repository.installAbbottLibrary(path);
      return true;
    } catch (e) {
      emit(
        state.copyWith(
          status: SensorConnectionStatus.error,
          failure: SensorFailure(e.toString()),
        ),
      );
      return false;
    }
  }

  Future<void> startNfcScan() async {
    emit(state.copyWith(clearFailure: true));
    try {
      await repository.startNfcScan();
    } catch (e) {
      emit(
        state.copyWith(
          status: SensorConnectionStatus.error,
          failure: SensorFailure(e.toString()),
        ),
      );
    }
  }

  Future<void> stopNfcScan() async {
    try {
      await repository.stopNfcScan();
    } catch (_) {
      // Stopping a scan that never started is not an error worth surfacing.
    }
  }

  /// Debug-only: replaces real sensor with a mock that replays a full
  /// connection sequence and emits periodic glucose readings.
  Future<void> activateMock() async {
    assert(kDebugMode, 'activateMock must only be called in debug mode');
    if (!kDebugMode) return;

    await _eventSubscription?.cancel();
    _mockRepo?.dispose();

    emit(SensorUiState.initial);

    final mock = MockSensorRepository();
    _mockRepo = mock;

    _eventSubscription = mock.observeSessionEvents().listen(
      (event) {
        emit(_mapEventToState(event, isMock: true));
      },
      onError: (error) {
        emit(
          state.copyWith(
            status: SensorConnectionStatus.error,
            failure: SensorFailure(error.toString()),
          ),
        );
      },
    );

    await mock.startMonitoring();
  }

  /// Debug-only: emits a single fake reading regardless of mock state.
  /// PatientCubit will add it to in-memory state but skip persistence (isMock: true).
  void injectMockReading(double value, {double rate = 0}) {
    assert(kDebugMode, 'injectMockReading must only be called in debug mode');
    if (!kDebugMode) return;
    emit(
      state.copyWith(
        status: SensorConnectionStatus.readingAvailable,
        reading: GlucoseReading(value: value, rate: rate),
        isMock: true,
      ),
    );
  }

  /// Debug-only: stops mock and resets to idle so PatientCubit discards mock data.
  Future<void> deactivateMock() async {
    assert(kDebugMode, 'deactivateMock must only be called in debug mode');
    if (!kDebugMode || _mockRepo == null) return;

    await _eventSubscription?.cancel();
    _mockRepo!.dispose();
    _mockRepo = null;
    _eventSubscription = null;

    emit(SensorUiState.initial);

    // Re-attach real event stream so the cubit is usable again.
    _listenToEvents();
  }

  @override
  Future<void> close() async {
    _mockRepo?.dispose();
    await _eventSubscription?.cancel();
    return super.close();
  }
}
