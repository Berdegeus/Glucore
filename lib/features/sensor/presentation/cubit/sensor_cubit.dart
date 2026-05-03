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

  void _listenToEvents() {
    _eventSubscription?.cancel();
    _eventSubscription = repository.observeSessionEvents().listen(
      (event) {
        emit(
          SensorUiState(
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
          ),
        );
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

  Future<void> registerSensor(String barcode) async {
    emit(state.copyWith(clearFailure: true));
    try {
      await repository.registerSensor(barcode);
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

  @override
  Future<void> close() async {
    await _eventSubscription?.cancel();
    return super.close();
  }
}
