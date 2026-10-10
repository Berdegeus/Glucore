import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/events.dart';
import '../../domain/models.dart';
import '../../domain/sensor_repository.dart';

class SensorCubit extends Cubit<SensorUiState> {
  SensorCubit({required this.repository}) : super(SensorUiState.initial);

  final SensorRepository repository;
  StreamSubscription<SensorEvent>? _eventSubscription;
  bool _initialized = false;

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

  SensorUiState _mapEventToState(SensorEvent event) {
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
      // Kept across events; dropped with the session it belonged to.
      sensorLife: _sessionEnded(event) ? null : state.sensorLife,
    );
  }

  bool _sessionEnded(SensorEvent event) =>
      event.status == SensorConnectionStatus.idle && event.session == null;

  /// Statuses in which the sensor is delivering data, so its start is known.
  static const _liveStatuses = {
    SensorConnectionStatus.connected,
    SensorConnectionStatus.syncingHistory,
    SensorConnectionStatus.warmingUp,
    SensorConnectionStatus.readingAvailable,
  };

  bool _fetchingLife = false;

  /// Asks the library when the sensor ends. Read when data starts flowing and
  /// again on each live reading until it is known: right after pairing the
  /// start time does not exist yet. A failure leaves it unknown, never wrong.
  Future<void> _refreshSensorLife() async {
    if (_fetchingLife || isClosed) return;
    _fetchingLife = true;
    try {
      final life = await repository.getSensorLife();
      if (life == null || isClosed) return;
      if (state.sensorLife?.expectedEnd == life.expectedEnd &&
          state.sensorLife?.startedAt == life.startedAt) {
        return;
      }
      emit(state.copyWith(sensorLife: life));
    } catch (_) {
      // Unknown life is a valid answer.
    } finally {
      _fetchingLife = false;
    }
  }

  void _listenToEvents() {
    _eventSubscription?.cancel();
    _eventSubscription = repository.observeSessionEvents().listen(
      (event) {
        emit(_mapEventToState(event));
        if (_liveStatuses.contains(event.status) &&
            (state.sensorLife == null ||
                event.status == SensorConnectionStatus.readingAvailable)) {
          unawaited(_refreshSensorLife());
        }
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
        await startMonitoring();
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

  /// Readings the sensor library stored since [since]. A failure here must
  /// never disturb monitoring, so it degrades to "nothing to recover".
  Future<List<StoredSensorReading>> storedReadings(DateTime since) async {
    try {
      return await repository.getStoredReadings(since);
    } catch (_) {
      return const [];
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

  @override
  Future<void> close() async {
    await _eventSubscription?.cancel();
    return super.close();
  }
}
